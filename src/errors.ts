/**
 * Structured error thrown by every failed SDK request.
 *
 * Inspect `status`, `code`, and convenience getters (`isNotFound`,
 * `isUnauthorized`, `isRateLimited`, `isTimeout`, `isNetworkError`,
 * `isAborted`, `isInvalidResponse`) to decide how to handle the failure.
 *
 * Codes the SDK sets itself (status `0` unless noted):
 * - `TIMEOUT`: every attempt ran out of time (`timeout` is per attempt).
 * - `NETWORK_ERROR`: the API could not be reached.
 * - `ABORTED`: the request was cancelled with your own `signal`. Never retried.
 * - `INVALID_RESPONSE`: a success status with a body that is not JSON (status is the HTTP status). Never retried.
 * Otherwise `code` is the API's own, or `HTTP_<status>`.
 */
export class NexoFlowError extends Error {
  /** HTTP status code (e.g. 404, 401, 500). `0` for network/timeout errors. */
  readonly status: number
  /** Machine-readable error code (mirrors the API `code` field when present). */
  readonly code: string
  /** Server-assigned request id for support debugging. */
  readonly requestId?: string
  /** Client-side id of the request (the same as `ApiResponse.traceId`), for your own logs. Not sent to NexoFlow. */
  readonly traceId?: string
  /** Arbitrary extra payload from the API `details` field. */
  readonly details?: unknown
  /** How many attempts were made before this error was raised. */
  readonly attempts: number
  /** Total wall-clock time spent across all attempts (ms). */
  readonly elapsedMs: number
  /**
   * On a 429: how long the API asked to wait before trying again (ms). The SDK waits out short waits itself and fails
   * at once on a longer one, so a page never hangs; use this to schedule your own retry.
   */
  readonly retryAfterMs?: number

  constructor(opts: {
    status: number
    message: string
    code?: string
    requestId?: string
    traceId?: string
    details?: unknown
    attempts?: number
    elapsedMs?: number
    retryAfterMs?: number
  }) {
    super(opts.message)
    this.name = "NexoFlowError"
    this.status = opts.status
    this.code = opts.code ?? `HTTP_${opts.status}`
    this.requestId = opts.requestId
    this.traceId = opts.traceId
    this.details = opts.details
    this.attempts = opts.attempts ?? 1
    this.elapsedMs = opts.elapsedMs ?? 0
    this.retryAfterMs = opts.retryAfterMs

    // Maintain proper prototype chain for instanceof checks after transpilation
    Object.setPrototypeOf(this, new.target.prototype)
  }

  get isNotFound(): boolean {
    return this.status === 404
  }

  get isUnauthorized(): boolean {
    return this.status === 401
  }

  get isRateLimited(): boolean {
    return this.status === 429
  }

  get isTimeout(): boolean {
    return this.code === "TIMEOUT"
  }

  /** The API could not be reached or did not answer in time. A cancel is not a network error. */
  get isNetworkError(): boolean {
    return this.status === 0 && this.code !== "ABORTED"
  }

  /** The request was cancelled with your own `signal`. */
  get isAborted(): boolean {
    return this.code === "ABORTED"
  }

  /** A success status whose body was not JSON (a wrong `baseUrl`, or a proxy answering instead of the API). */
  get isInvalidResponse(): boolean {
    return this.code === "INVALID_RESPONSE"
  }
}
