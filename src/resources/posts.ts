import type { HttpClient, ApiResponse } from "../http"
import type {
  ListPostsParams,
  ListPostsResponse,
  GetPostParams,
  GetPostResponse,
  PostListItem,
  Pagination,
  RateLimitInfo,
} from "../types"

export class PostsResource {
  constructor(private http: HttpClient) {}

  /**
   * List published posts (paginated).
   *
   * ```ts
   * const { data, rateLimit } = await nf.posts.list({ limit: 10 })
   * const { posts, pagination } = data
   * ```
   */
  async list(
    params?: ListPostsParams,
  ): Promise<ApiResponse<ListPostsResponse>> {
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
   * const { data: post } = await nf.posts.get("my-post-slug")
   * ```
   */
  async get(
    slug: string,
    params?: GetPostParams,
  ): Promise<ApiResponse<GetPostResponse>> {
    return this.http.request<GetPostResponse>({
      path: `/api/v1/content/posts/${encodeURIComponent(slug)}`,
      params: {
        format: params?.format,
        styled: params?.styled ? "true" : undefined,
      },
    })
  }

  /**
   * Fetch **all** posts across every page. Useful for static site generation.
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
      const { data } = await this.list({ ...params, page, limit: 100 })
      allPosts.push(...data.posts)
      hasMore = data.pagination.hasMore
      page++
    }

    return allPosts
  }

  /**
   * Get all post slugs. Handy for Next.js `generateStaticParams`.
   *
   * ```ts
   * export async function generateStaticParams() {
   *   return await nf.posts.slugs()
   * }
   * ```
   */
  async slugs(): Promise<Array<{ slug: string }>> {
    const posts = await this.all()
    return posts.map((p) => ({ slug: p.slug }))
  }

  /**
   * Async iterator that yields one post-list item at a time across all pages.
   *
   * ```ts
   * for await (const post of nf.posts.iter({ category: "news" })) {
   *   console.log(post.title)
   * }
   * ```
   */
  async *iter(
    params?: Omit<ListPostsParams, "page">,
  ): AsyncGenerator<PostListItem, void, undefined> {
    let page = 1
    let hasMore = true

    while (hasMore) {
      const { data } = await this.list({ ...params, page, limit: 100 })
      for (const post of data.posts) {
        yield post
      }
      hasMore = data.pagination.hasMore
      page++
    }
  }
}
