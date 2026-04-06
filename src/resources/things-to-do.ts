import type { HttpClient, ApiResponse } from "../http"
import type {
  ListThingsToDoParams,
  ListThingsToDoResponse,
  GetThingsToDoParams,
  GetThingsToDoResponse,
  ThingsToDoListItem,
  RequestOptions,
} from "../types"

export class ThingsToDoResource {
  constructor(private http: HttpClient) {}

  /**
   * List published Things-to-Do pages (paginated).
   *
   * ```ts
   * const { data } = await nf.thingsToDo.list({ city: "Austin" })
   * ```
   */
  async list(
    params?: ListThingsToDoParams,
    options?: RequestOptions,
  ): Promise<ApiResponse<ListThingsToDoResponse>> {
    return this.http.request<ListThingsToDoResponse>({
      path: "/api/v1/content/things-to-do",
      params: {
        page: params?.page,
        limit: params?.limit,
        city: params?.city,
        state: params?.state,
        sort: params?.sort,
      },
      signal: options?.signal,
      revalidate: options?.revalidate,
    })
  }

  /**
   * Get a single Things-to-Do page by slug with full attractions.
   *
   * Each attraction exposes `mapEmbedSrc` (HTTPS URL for `<iframe src={…} />`), `mapEmbed` (full iframe HTML - use with `dangerouslySetInnerHTML`, not as `src`), and `mapLink`.
   *
   * ```ts
   * const { data } = await nf.thingsToDo.get("things-to-do-in-austin")
   * ```
   */
  async get(
    slug: string,
    params?: GetThingsToDoParams,
    options?: RequestOptions,
  ): Promise<ApiResponse<GetThingsToDoResponse>> {
    if (!slug || typeof slug !== "string") {
      throw new Error("nexoflow-sdk: `slug` is required and must be a non-empty string.")
    }
    return this.http.request<GetThingsToDoResponse>({
      path: `/api/v1/content/things-to-do/${encodeURIComponent(slug)}`,
      params: {
        format: params?.format,
      },
      signal: options?.signal,
      revalidate: options?.revalidate,
    })
  }

  /**
   * Fetch **all** Things-to-Do pages across every page.
   * To cancel a long-running fetch, pass an `AbortSignal` via options.
   */
  async all(
    params?: Omit<ListThingsToDoParams, "page">,
    options?: RequestOptions,
  ): Promise<ThingsToDoListItem[]> {
    const allPages: ThingsToDoListItem[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const { data } = await this.list({ ...params, page, limit: 100 }, options)
      if (data.pages.length === 0) break
      allPages.push(...data.pages)
      hasMore = data.pagination.hasMore
      page++
    }

    return allPages
  }

  /**
   * Get all slugs. Useful for Next.js `generateStaticParams`.
   */
  async slugs(options?: RequestOptions): Promise<Array<{ slug: string }>> {
    const pages = await this.all(undefined, options)
    return pages.map((p) => ({ slug: p.slug }))
  }

  /**
   * Async iterator that yields one page at a time across all pages.
   *
   * ```ts
   * for await (const page of nf.thingsToDo.iter()) {
   *   console.log(page.pageTitle)
   * }
   * ```
   */
  async *iter(
    params?: Omit<ListThingsToDoParams, "page">,
    options?: RequestOptions,
  ): AsyncGenerator<ThingsToDoListItem, void, undefined> {
    let page = 1
    let hasMore = true

    while (hasMore) {
      const { data } = await this.list({ ...params, page, limit: 100 }, options)
      if (data.pages.length === 0) break
      for (const item of data.pages) {
        yield item
      }
      hasMore = data.pagination.hasMore
      page++
    }
  }
}
