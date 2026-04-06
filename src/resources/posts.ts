import type { HttpClient, ApiResponse } from "../http"
import type {
  ListPostsParams,
  ListPostsResponse,
  GetPostParams,
  GetPostResponse,
  PostListItem,
  RequestOptions,
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
    options?: RequestOptions,
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
      signal: options?.signal,
      revalidate: options?.revalidate,
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
    options?: RequestOptions,
  ): Promise<ApiResponse<GetPostResponse>> {
    if (!slug || typeof slug !== "string") {
      throw new Error("nexoflow-sdk: `slug` is required and must be a non-empty string.")
    }
    return this.http.request<GetPostResponse>({
      path: `/api/v1/content/posts/${encodeURIComponent(slug)}`,
      params: {
        format: params?.format,
        styled: params?.styled ? "true" : undefined,
      },
      signal: options?.signal,
      revalidate: options?.revalidate,
    })
  }

  /**
   * Fetch **all** posts across every page. Useful for static site generation.
   *
   * Automatically paginates through all available data. To cancel
   * a long-running fetch, pass an `AbortSignal` via options.
   *
   * ```ts
   * const allPosts = await nf.posts.all()
   * ```
   */
  async all(
    params?: Omit<ListPostsParams, "page">,
    options?: RequestOptions,
  ): Promise<PostListItem[]> {
    const allPosts: PostListItem[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const { data } = await this.list({ ...params, page, limit: 100 }, options)
      if (data.posts.length === 0) break
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
  async slugs(options?: RequestOptions): Promise<Array<{ slug: string }>> {
    const posts = await this.all(undefined, options)
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
    options?: RequestOptions,
  ): AsyncGenerator<PostListItem, void, undefined> {
    let page = 1
    let hasMore = true

    while (hasMore) {
      const { data } = await this.list({ ...params, page, limit: 100 }, options)
      if (data.posts.length === 0) break
      for (const post of data.posts) {
        yield post
      }
      hasMore = data.pagination.hasMore
      page++
    }
  }
}
