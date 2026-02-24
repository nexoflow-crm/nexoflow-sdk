import type { HttpClient } from "../http"
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
   * const { pages, pagination } = await nf.thingsToDo.list({ city: "Austin" })
   * ```
   */
  async list(params?: ListThingsToDoParams): Promise<ListThingsToDoResponse> {
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
   * const { page } = await nf.thingsToDo.get("things-to-do-in-austin")
   * ```
   */
  async get(slug: string, params?: GetThingsToDoParams): Promise<GetThingsToDoResponse> {
    return this.http.request<GetThingsToDoResponse>({
      path: `/api/v1/content/things-to-do/${encodeURIComponent(slug)}`,
      params: {
        format: params?.format,
      },
    })
  }

  /**
   * Fetch ALL Things-to-Do pages across all pages.
   */
  async all(params?: Omit<ListThingsToDoParams, "page">): Promise<ThingsToDoListItem[]> {
    const allPages: ThingsToDoListItem[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const response = await this.list({ ...params, page, limit: 100 })
      allPages.push(...response.pages)
      hasMore = response.pagination.hasMore
      page++
    }

    return allPages
  }

  /**
   * Get all slugs. Useful for Next.js generateStaticParams.
   */
  async slugs(): Promise<Array<{ slug: string }>> {
    const pages = await this.all()
    return pages.map((p) => ({ slug: p.slug }))
  }
}
