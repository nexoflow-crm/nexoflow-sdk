import type { HttpClient, ApiResponse } from "../http"
import type {
  ListThingsToDoParams,
  ListThingsToDoResponse,
  GetThingsToDoParams,
  GetThingsToDoResponse,
  ThingsToDoListItem,
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
    })
  }

  /**
   * Get a single Things-to-Do page by slug with full attractions.
   *
   * ```ts
   * const { data } = await nf.thingsToDo.get("things-to-do-in-austin")
   * ```
   */
  async get(
    slug: string,
    params?: GetThingsToDoParams,
  ): Promise<ApiResponse<GetThingsToDoResponse>> {
    return this.http.request<GetThingsToDoResponse>({
      path: `/api/v1/content/things-to-do/${encodeURIComponent(slug)}`,
      params: {
        format: params?.format,
      },
    })
  }

  /**
   * Fetch **all** Things-to-Do pages across every page.
   */
  async all(
    params?: Omit<ListThingsToDoParams, "page">,
  ): Promise<ThingsToDoListItem[]> {
    const allPages: ThingsToDoListItem[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const { data } = await this.list({ ...params, page, limit: 100 })
      allPages.push(...data.pages)
      hasMore = data.pagination.hasMore
      page++
    }

    return allPages
  }

  /**
   * Get all slugs. Useful for Next.js `generateStaticParams`.
   */
  async slugs(): Promise<Array<{ slug: string }>> {
    const pages = await this.all()
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
  ): AsyncGenerator<ThingsToDoListItem, void, undefined> {
    let page = 1
    let hasMore = true

    while (hasMore) {
      const { data } = await this.list({ ...params, page, limit: 100 })
      for (const item of data.pages) {
        yield item
      }
      hasMore = data.pagination.hasMore
      page++
    }
  }
}
