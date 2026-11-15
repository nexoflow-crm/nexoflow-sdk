import type { NexoFlowConfig, RateLimitInfo } from "./types"
import { NexoFlowError } from "./errors"
import { VERSION } from "./version"

// ── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = "https://nexoflow.net"
const DEFAULT_TIMEOUT = 15_000
const DEFAULT_RETRY_ATTEMPTS = 3
const DEFAULT_RETRY_DELAY = 500
/**
 * The longest a "try again in N seconds" answer (429 `Retry-After`) is waited out. A longer one fails at once with
 * `retryAfterMs` on the error: a page render should never sit and wait for minutes.
 */
export const MAX_RETRY_AFTER_MS = 5_000
/** Next.js drops cache tags longer than this. */
const MAX_CACHE_TAG_LENGTH = 256

// ── Public types ────────────────────────────────────────────────────────────

export interface FetchOptions {
  path: string
  params?: Record<string, string | number | boolean | undefined>
  revalidate?: number | false
  /** Next.js cache tags for this request (`revalidateTag` refreshes it). */
  tags?: string[]
  /** Per-request AbortSignal (composed with each attempt's timeout). */
  signal?: AbortSignal
  /** How a successful body is read. Default `"json"`. */
  as?: "json" | "text"
  /** Statuses answered with `data: null` instead of an error (llms.txt's 404 when the business has none). */
  nullOn?: number[]
  /**
   * With `nullOn`: only an answer that carries this header with this value counts (NexoFlow's own "there is none",
   * `X-NexoFlow-Reason`). Anything else with that status (a 404 from a wrong `baseUrl` or a proxy in front of the API,
   * plain text or not) is an error, never "there is none".
   */
  nullHeader?: { name: string; value: string }
}

export interface ApiResponse<T> {
  data: T
  rateLimit?: RateLimitInfo
  /**
   * Client-side id for this request, for your own logs and the SDK's debug lines. It is not sent to NexoFlow (a
   * per-call header would defeat the Next.js cache), so NexoFlow's logs do not know it.
   */
  traceId: string
  /** Total wall-clock time for the request including retries (ms). */
  durationMs: number
  /** How many attempts were made (1 = no retries). */
  attempts: number
}

/** A successful answer before it is decoded: kept as text so callers that share one request each get their own objects. */
interface RawAnswer {
  status: number
  ok: boolean
  text: string
  rateLimit?: RateLimitInfo
  traceId: string
  durationMs: number
  attempts: number
}

// ── Helpers ─────────────────────────────────────────────────────────────────

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

function isRetryable(status: number): boolean {
  return status >= 500 || status === 429
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
  const seconds = Number(raw.trim())
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
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

/** One signal that aborts when any of these does. */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const native = (AbortSignal as unknown as { any?: (signals: AbortSignal[]) => AbortSignal }).any
  if (typeof native === "function") return native(signals)
  const controller = new AbortController()
  const abort = (signal: AbortSignal) => {
    for (const other of signals) other.removeEventListener("abort", onAbort)
    controller.abort(signal.reason)
  }
  function onAbort(this: AbortSignal) {
    abort(this)
  }
  for (const signal of signals) {
    if (signal.aborted) {
      abort(signal)
      break
    }
    signal.addEventListener("abort", onAbort, { once: true })
  }
  return controller.signal
}

/** Wait, unless the caller cancels first (then reject with its reason). */
function pause(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason)
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal?.reason)
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

/** The cache tags Next.js accepts, without repeats. */
function usableTags(tags: string[] | undefined): string[] {
  if (!tags?.length) return []
  return [...new Set(tags.filter((tag) => typeof tag === "string" && tag.length > 0 && tag.length <= MAX_CACHE_TAG_LENGTH))]
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
  /**
   * With `dedupe` on, identical requests made at the same time share one call (each caller still gets its own
   * objects). Off by default: under Next.js each render must make its own fetch, because that call is what gives the
   * render its cache tags and revalidate time (and Next already dedupes identical fetches within one render).
   */
  const dedupe = config.dedupe === true
  const inFlight = new Map<string, Promise<RawAnswer>>()

  if (typeof fetchFn !== "function") {
    throw new Error(
      "nexoflow-sdk: No fetch implementation found. " +
        "Pass a custom `fetch` in the config or use a runtime with built-in fetch (Node 18+).",
    )
  }

  // Every header here is the same on every call. Next.js keys its fetch cache on the request's headers, so a header
  // that changes per call (a request id) would mean the cache never answers and every page render waits on the API.
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    "User-Agent": `nexoflow-sdk/${VERSION}`,
  }

  function buildHref(opts: FetchOptions): string {
    const url = new URL(`${baseUrl}${opts.path}`)
    if (opts.params) {
      for (const [key, value] of Object.entries(opts.params)) {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.set(key, String(value))
        }
      }
    }
    return url.toString()
  }

  function cancelled(traceId: string, attempts: number, start: number): NexoFlowError {
    return new NexoFlowError({
      status: 0,
      message: "Request was cancelled.",
      code: "ABORTED",
      traceId,
      attempts,
      elapsedMs: Date.now() - start,
    })
  }

  async function send(href: string, opts: FetchOptions): Promise<RawAnswer> {
    const traceId = generateTraceId()
    const revalidate = opts.revalidate ?? defaultRevalidate
    const tags = usableTags(opts.tags)
    const callerSignal = opts.signal
    const start = Date.now()
    let lastError: unknown
    let lastTimedOut = false

    /**
     * After a transport failure (no answer, or the body cut off): `true` to try again, `false` when the attempts are
     * used up. A cancel by the caller throws at once and is never retried.
     */
    async function tryAgainAfter(failure: unknown, timer: AbortSignal, attempt: number): Promise<boolean> {
      if (callerSignal?.aborted) throw cancelled(traceId, attempt, start)
      lastError = failure
      lastTimedOut = timer.aborted
      if (attempt >= maxAttempts) return false
      const wait = retryWait(retryDelay, attempt)
      if (debug) {
        console.debug(`[nexoflow-sdk] ${lastTimedOut ? "timed out" : `network error (${(failure as Error)?.message})`}, retrying in ${wait}ms [${traceId}]`)
      }
      try {
        await pause(wait, callerSignal)
      } catch {
        throw cancelled(traceId, attempt, start)
      }
      return true
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (callerSignal?.aborted) throw cancelled(traceId, attempt - 1, start)

      // Each attempt gets the full timeout: a retry after a slow attempt has its own time.
      const timer = AbortSignal.timeout(timeout)
      const signal = callerSignal ? anySignal([timer, callerSignal]) : timer
      const init: RequestInit & { next?: { revalidate?: number | false; tags?: string[] } } = {
        method: "GET",
        headers: { ...headers, Accept: opts.as === "text" ? "text/plain" : "application/json" },
        signal,
      }
      // Next.js data cache hint - harmlessly ignored by other runtimes.
      if (typeof revalidate === "number" || revalidate === false) {
        init.next = tags.length > 0 ? { revalidate, tags } : { revalidate }
      } else if (tags.length > 0) {
        init.next = { tags }
      }

      if (hooks?.beforeRequest) await hooks.beforeRequest({ url: href, init })
      if (debug) {
        console.debug(`[nexoflow-sdk] -> GET ${href} [${traceId}] (key: ${maskApiKey(config.apiKey)}, attempt ${attempt}/${maxAttempts})`)
      }

      let response: Response
      try {
        response = await fetchFn(href, init)
      } catch (failure) {
        if (await tryAgainAfter(failure, timer, attempt)) continue
        break
      }

      // Outside the transport's try: a hook that throws fails the call with its own error, once, never as a
      // network error and never retried. It gets a copy, so reading the body there never takes it from the SDK.
      if (hooks?.afterResponse) await hooks.afterResponse(response.clone())
      if (debug) {
        console.debug(`[nexoflow-sdk] <- ${response.status} (${Date.now() - start}ms, attempt ${attempt}/${maxAttempts}) [${traceId}]`)
      }

      const nullAnswer =
        !response.ok &&
        opts.nullOn?.includes(response.status) === true &&
        (!opts.nullHeader || (response.headers.get(opts.nullHeader.name) ?? "").trim().toLowerCase() === opts.nullHeader.value.toLowerCase())
      if (response.ok || nullAnswer) {
        let text: string
        try {
          // The body is read under the same timeout as the headers.
          text = await response.text()
        } catch (failure) {
          if (await tryAgainAfter(failure, timer, attempt)) continue
          break
        }
        return {
          status: response.status,
          ok: response.ok,
          text,
          rateLimit: extractRateLimit(response.headers),
          traceId,
          durationMs: Date.now() - start,
          attempts: attempt,
        }
      }

      let message = `Request failed with status ${response.status}`
      let code: string | undefined
      let requestId: string | undefined
      let details: unknown
      try {
        const body = await response.json()
        if (body?.error) message = body.error
        if (body?.code) code = body.code
        if (body?.requestId) requestId = body.requestId
        if (body?.details) details = body.details
      } catch {
        // The error body was not JSON; the status says enough.
      }

      const retryAfterMs = response.status === 429 ? parseRetryAfter(response.headers) : undefined
      const serverWaitTooLong = retryAfterMs !== undefined && retryAfterMs > MAX_RETRY_AFTER_MS
      if (isRetryable(response.status) && attempt < maxAttempts && !serverWaitTooLong) {
        const wait = retryAfterMs ?? retryWait(retryDelay, attempt)
        if (debug) {
          console.debug(`[nexoflow-sdk] retrying in ${wait}ms (${response.status}${retryAfterMs !== undefined ? ", server Retry-After" : ""}) [${traceId}]`)
        }
        try {
          await pause(wait, callerSignal)
        } catch {
          throw cancelled(traceId, attempt, start)
        }
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
        elapsedMs: Date.now() - start,
        retryAfterMs,
      })
    }

    const elapsed = Date.now() - start
    if (lastTimedOut) {
      throw new NexoFlowError({
        status: 0,
        message: `Request timed out after ${timeout}ms (${maxAttempts} attempt${maxAttempts > 1 ? "s" : ""})`,
        code: "TIMEOUT",
        traceId,
        attempts: maxAttempts,
        elapsedMs: elapsed,
      })
    }
    throw new NexoFlowError({
      status: 0,
      message: `Network request failed after ${maxAttempts} attempt${maxAttempts > 1 ? "s" : ""}: ${(lastError as Error)?.message ?? "unknown error"}`,
      code: "NETWORK_ERROR",
      traceId,
      attempts: maxAttempts,
      elapsedMs: elapsed,
    })
  }

  function decode<T>(raw: RawAnswer, opts: FetchOptions): ApiResponse<T> {
    const meta = { rateLimit: raw.rateLimit, traceId: raw.traceId, durationMs: raw.durationMs, attempts: raw.attempts }
    if (!raw.ok) return { data: null as T, ...meta }
    if (opts.as === "text") return { data: raw.text as T, ...meta }
    try {
      return { data: JSON.parse(raw.text) as T, ...meta }
    } catch {
      // Not retried: an HTML page instead of JSON is a wrong address or something in front of the API, every time.
      throw new NexoFlowError({
        status: raw.status,
        message: `NexoFlow answered HTTP ${raw.status} with something that is not JSON. Check \`baseUrl\`; a proxy or firewall in front of the API may have answered instead.`,
        code: "INVALID_RESPONSE",
        traceId: raw.traceId,
        attempts: raw.attempts,
        elapsedMs: raw.durationMs,
      })
    }
  }

  async function request<T>(opts: FetchOptions): Promise<ApiResponse<T>> {
    const href = buildHref(opts)
    // Sharing is opt-in, and a caller that can cancel always gets a call of its own, so its cancel never cuts off
    // anyone else.
    if (!dedupe || opts.signal) return decode<T>(await send(href, opts), opts)

    const key = [opts.as ?? "json", href, String(opts.revalidate ?? defaultRevalidate), usableTags(opts.tags).join(","), (opts.nullOn ?? []).join(","), opts.nullHeader ? `${opts.nullHeader.name}=${opts.nullHeader.value}` : ""].join(" ")
    let shared = inFlight.get(key)
    if (!shared) {
      shared = send(href, opts).finally(() => inFlight.delete(key))
      inFlight.set(key, shared)
    }
    return decode<T>(await shared, opts)
  }

  return { request }
}

export type HttpClient = ReturnType<typeof createHttpClient>
