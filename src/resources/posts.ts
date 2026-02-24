import type { HttpClient } from "../http"
import type {
  ListPostsParams,
  ListPostsResponse,
  GetPostParams,
  GetPostResponse,
  PostListItem,
  Pagination,
} from "../types"

export class PostsResource {
  constructor(private http: HttpClient) {}

  /**
   * List published posts (paginated).
   *
   * ```ts
   * const { posts, pagination } = await nf.posts.list({ limit: 10 })
   * ```
   */
  async list(params?: ListPostsParams): Promise<ListPostsResponse> {
    return this.http.request<ListPostsResponse>({
      path: "/api/v1/content/posts",
      params: {
        page: params?.page,
        limit: params?.limit,
        tag: params?.tag,
        category: params?.category,
        sort: params?.sort,
      },
    })
  }

  /**
   * Get a single post by slug with full content.
   *
   * ```ts
   * const post = await nf.posts.get("my-post-slug")
   * ```
   */
  async get(slug: string, params?: GetPostParams): Promise<GetPostResponse> {
    return this.http.request<GetPostResponse>({
      path: `/api/v1/content/posts/${encodeURIComponent(slug)}`,
      params: {
        format: params?.format,
        styled: params?.styled ? "true" : undefined,
      },
    })
  }

  /**
   * Fetch ALL posts across all pages. Useful for static site generation.
   *
   * ```ts
   * const allPosts = await nf.posts.all()
   * ```
   */
  async all(params?: Omit<ListPostsParams, "page">): Promise<PostListItem[]> {
    const allPosts: PostListItem[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const response = await this.list({ ...params, page, limit: 100 })
      allPosts.push(...response.posts)
      hasMore = response.pagination.hasMore
      page++
    }

    return allPosts
  }

  /**
   * Get all post slugs. Useful for Next.js generateStaticParams.
   *
   * ```ts
   * // app/blog/[slug]/page.tsx
   * export async function generateStaticParams() {
   *   return await nf.posts.slugs()
   * }
   * ```
   */
  async slugs(): Promise<Array<{ slug: string }>> {
    const posts = await this.all()
    return posts.map((p) => ({ slug: p.slug }))
  }
}
