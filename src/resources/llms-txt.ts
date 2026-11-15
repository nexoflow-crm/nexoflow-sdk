import type { HttpClient, ApiResponse } from "../http"
import type { RequestOptions } from "../types"
import { cacheTags, withTags } from "../cache-tags"
import { NexoFlowError } from "../errors"

const PLAIN_TEXT = "text/plain; charset=utf-8"

/** What NexoFlow's own "this business has no llms.txt" 404 says, and nothing else's does. */
const NO_LLMS_TXT = { name: "x-nexoflow-reason", value: "no-llms-txt" }

export interface LlmsTxtHandlerOptions {
  /** How long browsers and CDNs may keep the file, in seconds. Default `3600` (an hour). */
  maxAge?: number
}

export class LlmsTxtResource {
  constructor(private http: HttpClient) {}

  /**
   * The site's llms.txt as plain text: what the business is, how to reach it, its services, the places it serves
   * and its key pages, for AI assistants. `null` when NexoFlow says it has none to serve yet (no live website on
   * record, or schema markup switched off in the site settings): NexoFlow's own 404, which says
   * `X-NexoFlow-Reason: no-llms-txt`. A 404 from anything else (a wrong `baseUrl`, a proxy, whatever its content type)
   * is an error, never `null`.
   *
   * ```ts
   * const { data: text } = await nf.llmsTxt.get()
   * ```
   */
  async get(options?: RequestOptions): Promise<ApiResponse<string | null>> {
    return this.http.request<string | null>({
      path: "/api/v1/content/llms-txt",
      as: "text",
      nullOn: [404],
      nullHeader: NO_LLMS_TXT,
      signal: options?.signal,
      revalidate: options?.revalidate,
      tags: withTags([cacheTags.all, cacheTags.llmsTxt], options?.tags),
    })
  }

  /**
   * A ready route for `/llms.txt`: answers with NexoFlow's file, unchanged, as plain text. A 404 (cached for five
   * minutes) only when NexoFlow itself says the business has none. Anything else that is not the file answers 503 with
   * `Cache-Control: no-store`, so no CDN or crawler keeps "this file does not exist" for a problem that is only
   * temporary: an outage, a timeout, a revoked or rotated key, a 404 page from a wrong `baseUrl` or a proxy, or an
   * empty answer. The reason goes to the site's logs. Remove any static `llms.txt` next to it.
   *
   * ```ts
   * // app/llms.txt/route.ts (Next.js App Router)
   * export const GET = nf.llmsTxt.handler()
   * ```
   *
   * Works anywhere a handler returns a web `Response` (Remix, SvelteKit, Astro, Hono, Workers).
   */
  handler(handlerOptions?: LlmsTxtHandlerOptions): (request?: Request) => Promise<Response> {
    const maxAge = handlerOptions?.maxAge ?? 3600
    // Not "there is no file": a problem reading it. Visitors get a temporary answer nobody caches; the logs get why.
    const unavailable = (why: string) => {
      console.error(`[nexoflow-sdk] llms.txt could not be read from NexoFlow (${why})`)
      return new Response("Temporarily unavailable\n", {
        status: 503,
        headers: { "Content-Type": PLAIN_TEXT, "Cache-Control": "no-store", "Retry-After": "300" },
      })
    }
    return async () => {
      let data: string | null
      try {
        data = (await this.get()).data
      } catch (error) {
        return unavailable(error instanceof NexoFlowError ? `${error.code}: ${error.message}` : error instanceof Error ? error.message : String(error))
      }
      // NexoFlow never serves an empty file: an empty answer is something else answering.
      if (data !== null && !data.trim()) return unavailable("an empty answer")
      if (data) {
        return new Response(data, {
          status: 200,
          headers: { "Content-Type": PLAIN_TEXT, "Cache-Control": `public, max-age=${maxAge}`, "X-Content-Type-Options": "nosniff" },
        })
      }
      // NexoFlow answered that the business has no llms.txt yet.
      return new Response("Not found\n", { status: 404, headers: { "Content-Type": PLAIN_TEXT, "Cache-Control": "public, max-age=300" } })
    }
  }
}
