import type { NexoFlowErrorData } from "./types"

export class NexoFlowError extends Error {
  readonly status: number
  readonly url: string

  constructor(data: NexoFlowErrorData) {
    super(data.message)
    this.name = "NexoFlowError"
    this.status = data.status
    this.url = data.url
  }

  get isNotFound() {
    return this.status === 404
  }

  get isUnauthorized() {
    return this.status === 401
  }

  get isRateLimited() {
    return this.status === 429
  }
}
