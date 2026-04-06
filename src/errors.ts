/**
 * Structured error thrown by every failed SDK request.
 *
 * Inspect `status`, `code`, and convenience getters (`isNotFound`,
 * `isUnauthorized`, `isRateLimited`, `isTimeout`, `isNetworkError`)
 * to decide how to handle the failure.
 */
export class NexoFlowError extends Error {
  /** HTTP status code (e.g. 404, 401, 500). `0` for network/timeout errors. */
  readonly status: number
  /** Machine-readable error code (mirrors the API `code` field when present). */
  readonly code: string
  /** Server-assigned request id for support debugging. */
  readonly requestId?: string
  /** Client-generated request id for correlation. */
  readonly traceId?: string
  /** Arbitrary extra payload from the API `details` field. */
  readonly details?: unknown
  /** How many attempts were made before this error was raised. */
  readonly attempts: number
  /** Total wall-clock time spent across all attempts (ms). */
  readonly elapsedMs: number

  constructor(opts: {
    status: number
    message: string
    code?: string
    requestId?: string
    traceId?: string
    details?: unknown
    attempts?: number
    elapsedMs?: number
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

  get isNetworkError(): boolean {
    return this.status === 0
  }
}
