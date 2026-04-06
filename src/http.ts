import type { NexoFlowConfig, RateLimitInfo } from "./types"
import { NexoFlowError } from "./errors"
import { VERSION } from "./version"

// ── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = "https://nexoflow.net"
const DEFAULT_TIMEOUT = 15_000
const DEFAULT_RETRY_ATTEMPTS = 3
const DEFAULT_RETRY_DELAY = 500

// ── Public types ────────────────────────────────────────────────────────────

export interface FetchOptions {
  path: string
  params?: Record<string, string | number | boolean | undefined>
  revalidate?: number | false
  /** Per-request AbortSignal (composed with the global timeout). */
  signal?: AbortSignal
}

export interface ApiResponse<T> {
  data: T
  rateLimit?: RateLimitInfo
  /** Client-generated trace id for this request (for log correlation). */
  traceId: string
  /** Total wall-clock time for the request including retries (ms). */
  durationMs: number
  /** How many attempts were made (1 = no retries). */
  attempts: number
}

// ── Rate-limit header extraction ────────────────────────────────────────────

function extractRateLimit(headers: Headers): RateLimitInfo | undefined {
  const limit = headers.get("x-ratelimit-limit")
  const remaining = headers.get("x-ratelimit-remaining")
  const reset = headers.get("x-ratelimit-reset")

  if (!limit && !remaining && !reset) return undefined

  return {
    limit: limit ? parseInt(limit, 10) : undefined,
    remaining: remaining ? parseInt(remaining, 10) : undefined,
    reset: reset ? parseInt(reset, 10) : undefined,
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function isRetryable(status: number): boolean {
  return status >= 500 || status === 429
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Exponential backoff with jitter to prevent thundering herd. */
function retryWait(baseDelay: number, attempt: number): number {
  const exponential = baseDelay * Math.pow(2, attempt - 1)
  const jitter = exponential * 0.5 * Math.random()
  return Math.floor(exponential + jitter)
}

/** Parse Retry-After header (seconds or HTTP-date). */
function parseRetryAfter(headers: Headers): number | undefined {
  const raw = headers.get("retry-after")
  if (!raw) return undefined
  const seconds = parseInt(raw, 10)
  if (!isNaN(seconds)) return seconds * 1000
  const date = Date.parse(raw)
  if (!isNaN(date)) return Math.max(0, date - Date.now())
  return undefined
}

/** Generate a short unique trace id for request correlation. */
function generateTraceId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `nf_${ts}_${rand}`
}

/** Mask API key for safe debug logging: show prefix + last 4 chars. */
function maskApiKey(key: string): string {
  if (key.length <= 12) return "pk_live_****"
  return `${key.slice(0, 8)}...${key.slice(-4)}`
}

/** Compose multiple AbortSignals into one (any abort triggers all). */
function composeSignals(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController()
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason)
      return controller.signal
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true })
  }
  return controller.signal
}

function isTimeoutError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "TimeoutError") return true
  if (err instanceof DOMException && err.name === "AbortError") return true
  if (err instanceof Error && err.message.includes("timeout")) return true
  return false
}

// ── HTTP client factory ─────────────────────────────────────────────────────

export function createHttpClient(config: NexoFlowConfig) {
  const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "")
  const timeout = config.timeout ?? DEFAULT_TIMEOUT
  const defaultRevalidate = config.revalidate ?? 60
  const fetchFn = config.fetch ?? globalThis.fetch
  const maxAttempts = config.retry?.attempts ?? DEFAULT_RETRY_ATTEMPTS
  const retryDelay = config.retry?.delay ?? DEFAULT_RETRY_DELAY
  const debug = config.debug === true
  const hooks = config.hooks

  if (typeof fetchFn !== "function") {
    throw new Error(
      "nexoflow-sdk: No fetch implementation found. " +
        "Pass a custom `fetch` in the config or use a runtime with built-in fetch (Node 18+).",
    )
  }

  async function request<T>(opts: FetchOptions): Promise<ApiResponse<T>> {
    const url = new URL(`${baseUrl}${opts.path}`)
    const traceId = generateTraceId()

    if (opts.params) {
      for (const [key, value] of Object.entries(opts.params)) {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.set(key, String(value))
        }
      }
    }

    const revalidate = opts.revalidate ?? defaultRevalidate
    const href = url.toString()

    // Compose timeout signal with caller-provided signal
    const signals: AbortSignal[] = [AbortSignal.timeout(timeout)]
    if (opts.signal) signals.push(opts.signal)
    const composedSignal = signals.length === 1 ? signals[0] : composeSignals(signals)

    const init: RequestInit & { next?: { revalidate?: number | false } } = {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: "application/json",
        "User-Agent": `nexoflow-sdk/${VERSION}`,
        "X-Request-Id": traceId,
      },
      signal: composedSignal,
    }

    // Next.js ISR hint - harmlessly ignored by non-Next runtimes
    if (typeof revalidate === "number" || revalidate === false) {
      init.next = { revalidate }
    }

    // beforeRequest hook
    if (hooks?.beforeRequest) {
      await hooks.beforeRequest({ url: href, init })
    }

    if (debug) {
      console.debug(`[nexoflow-sdk] -> GET ${href} [${traceId}] (key: ${maskApiKey(config.apiKey)})`)
    }

    let lastError: unknown
    const start = Date.now()
    let attemptCount = 0

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attemptCount = attempt
      try {
        const response = await fetchFn(href, init)

        // afterResponse hook
        if (hooks?.afterResponse) {
          await hooks.afterResponse(response)
        }

        const elapsed = Date.now() - start

        if (debug) {
          console.debug(
            `[nexoflow-sdk] <- ${response.status} (${elapsed}ms, attempt ${attempt}/${maxAttempts}) [${traceId}]`,
          )
        }

        const rateLimit = extractRateLimit(response.headers)

        if (response.ok) {
          const data = (await response.json()) as T
          return { data, rateLimit, traceId, durationMs: elapsed, attempts: attempt }
        }

        // Parse error body
        let message = `Request failed with status ${response.status}`
        let code: string | undefined
        let requestId: string | undefined
        let details: unknown

        try {
          const body = await response.json()
          if (body.error) message = body.error
          if (body.code) code = body.code
          if (body.requestId) requestId = body.requestId
          if (body.details) details = body.details
        } catch {
          // body wasn't JSON
        }

        // Retry on transient server errors
        if (isRetryable(response.status) && attempt < maxAttempts) {
          // Respect Retry-After header on 429, otherwise use exponential backoff with jitter
          const serverWait = response.status === 429 ? parseRetryAfter(response.headers) : undefined
          const wait = serverWait ?? retryWait(retryDelay, attempt)
          if (debug) {
            console.debug(
              `[nexoflow-sdk] retrying in ${wait}ms (${response.status}${serverWait ? ", server Retry-After" : ""}) [${traceId}]`,
            )
          }
          await sleep(wait)
          continue
        }

        throw new NexoFlowError({
          status: response.status,
          message,
          code,
          requestId,
          traceId,
          details,
          attempts: attempt,
          elapsedMs: elapsed,
        })
      } catch (err) {
        if (err instanceof NexoFlowError) throw err

        const elapsed = Date.now() - start

        // Distinguish timeout from other network errors
        if (isTimeoutError(err)) {
          if (attempt >= maxAttempts) {
            throw new NexoFlowError({
              status: 0,
              message: `Request timed out after ${timeout}ms (${attempt} attempt${attempt > 1 ? "s" : ""})`,
              code: "TIMEOUT",
              traceId,
              attempts: attempt,
              elapsedMs: elapsed,
            })
          }
        }

        // Network / timeout errors - retry
        lastError = err
        if (attempt < maxAttempts) {
          const wait = retryWait(retryDelay, attempt)
          if (debug) {
            console.debug(
              `[nexoflow-sdk] network error, retrying in ${wait}ms - ${(err as Error).message} [${traceId}]`,
            )
          }
          await sleep(wait)
          continue
        }
      }
    }

    // All retries exhausted
    const elapsed = Date.now() - start
    throw new NexoFlowError({
      status: 0,
      message: `Network request failed after ${maxAttempts} attempts: ${(lastError as Error)?.message ?? "unknown error"}`,
      code: "NETWORK_ERROR",
      traceId,
      attempts: attemptCount,
      elapsedMs: elapsed,
    })
  }

  return { request }
}

export type HttpClient = ReturnType<typeof createHttpClient>
