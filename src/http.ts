import type { NexoFlowConfig } from "./types"
import { NexoFlowError } from "./errors"

const DEFAULT_BASE_URL = "https://nexoflow.net"
const DEFAULT_TIMEOUT = 15_000

export interface FetchOptions {
  path: string
  params?: Record<string, string | number | boolean | undefined>
  /** Override the default revalidate for this request. */
  revalidate?: number | false
}

export function createHttpClient(config: NexoFlowConfig) {
  const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "")
  const timeout = config.timeout ?? DEFAULT_TIMEOUT
  const defaultRevalidate = config.revalidate ?? 60

  async function request<T>(opts: FetchOptions): Promise<T> {
    const url = new URL(`${baseUrl}${opts.path}`)

    if (opts.params) {
      for (const [key, value] of Object.entries(opts.params)) {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.set(key, String(value))
        }
      }
    }

    const revalidate = opts.revalidate ?? defaultRevalidate

    const fetchInit: RequestInit & { next?: { revalidate?: number | false } } = {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(timeout),
    }

    // Next.js ISR support — only applied in server-side contexts
    if (typeof revalidate === "number" || revalidate === false) {
      fetchInit.next = { revalidate }
    }

    const response = await fetch(url.toString(), fetchInit)

    if (!response.ok) {
      let message = `Request failed with status ${response.status}`
      try {
        const body = await response.json()
        if (body.error) message = body.error
      } catch {
        // Body wasn't JSON — use the default message
      }
      throw new NexoFlowError({
        status: response.status,
        message,
        url: url.toString(),
      })
    }

    return response.json() as Promise<T>
  }

  return { request }
}

export type HttpClient = ReturnType<typeof createHttpClient>
