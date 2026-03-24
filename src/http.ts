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
}

export interface ApiResponse<T> {
  data: T
  rateLimit?: RateLimitInfo
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

// ── Retry helpers ───────────────────────────────────────────────────────────

function isRetryable(status: number): boolean {
  return status >= 500 || status === 429
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

    if (opts.params) {
      for (const [key, value] of Object.entries(opts.params)) {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.set(key, String(value))
        }
      }
    }

    const revalidate = opts.revalidate ?? defaultRevalidate
    const href = url.toString()

    const init: RequestInit & { next?: { revalidate?: number | false } } = {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: "application/json",
        "User-Agent": `nexoflow-sdk/${VERSION}`,
      },
      signal: AbortSignal.timeout(timeout),
    }

    // Next.js ISR hint — harmlessly ignored by non-Next runtimes
    if (typeof revalidate === "number" || revalidate === false) {
      init.next = { revalidate }
    }

    // beforeRequest hook
    if (hooks?.beforeRequest) {
      await hooks.beforeRequest({ url: href, init })
    }

    if (debug) {
      console.debug(`[nexoflow-sdk] -> ${init.method} ${href}`)
    }

    let lastError: unknown
    const start = Date.now()

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetchFn(href, init)

        // afterResponse hook
        if (hooks?.afterResponse) {
          await hooks.afterResponse(response)
        }

        if (debug) {
          const ms = Date.now() - start
          console.debug(
            `[nexoflow-sdk] <- ${response.status} (${ms}ms, attempt ${attempt}/${maxAttempts})`,
          )
        }

        const rateLimit = extractRateLimit(response.headers)

        if (response.ok) {
          const data = (await response.json()) as T
          return { data, rateLimit }
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
          const wait = retryDelay * Math.pow(2, attempt - 1)
          if (debug) {
            console.debug(
              `[nexoflow-sdk] retrying in ${wait}ms (${response.status})`,
            )
          }
          await sleep(wait)
          continue
        }

        throw new NexoFlowError({ status: response.status, message, code, requestId, details })
      } catch (err) {
        if (err instanceof NexoFlowError) throw err

        // Network / timeout errors — retry
        lastError = err
        if (attempt < maxAttempts) {
          const wait = retryDelay * Math.pow(2, attempt - 1)
          if (debug) {
            console.debug(
              `[nexoflow-sdk] network error, retrying in ${wait}ms — ${(err as Error).message}`,
            )
          }
          await sleep(wait)
          continue
        }
      }
    }

    // All retries exhausted
    throw new NexoFlowError({
      status: 0,
      message: `Network request failed after ${maxAttempts} attempts: ${(lastError as Error)?.message ?? "unknown error"}`,
      code: "NETWORK_ERROR",
    })
  }

  return { request }
}

export type HttpClient = ReturnType<typeof createHttpClient>
