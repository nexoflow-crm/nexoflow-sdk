/**
 * Structured error thrown by every failed SDK request.
 *
 * Inspect `status`, `code`, and convenience getters (`isNotFound`,
 * `isUnauthorized`, `isRateLimited`) to decide how to handle the failure.
 */
export class NexoFlowError extends Error {
  /** HTTP status code (e.g. 404, 401, 500). */
  readonly status: number
  /** Machine-readable error code (mirrors the API `code` field when present). */
  readonly code: string
  /** Server-assigned request id for support debugging. */
  readonly requestId?: string
  /** Arbitrary extra payload from the API `details` field. */
  readonly details?: unknown

  constructor(opts: {
    status: number
    message: string
    code?: string
    requestId?: string
    details?: unknown
  }) {
    super(opts.message)
    this.name = "NexoFlowError"
    this.status = opts.status
    this.code = opts.code ?? `HTTP_${opts.status}`
    this.requestId = opts.requestId
    this.details = opts.details

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
}
