// ── Client Configuration ────────────────────────────────────────────────────

export interface NexoFlowConfig {
  /**
   * Your project API key (`pk_live_…`). **Required.**
   *
   * **WARNING — this key is SECRET.** Never expose it in browser-side code,
   * HTML source, or client bundles. Always read it from an environment
   * variable on the server:
   *
   * ```ts
   * new NexoFlow({ apiKey: process.env.NEXOFLOW_API_KEY! })
   * ```
   */
  apiKey: string

  /** Base URL of the NexoFlow instance. Defaults to `"https://nexoflow.net"`. */
  baseUrl?: string

  /** Default `next.revalidate` hint (seconds) for Next.js ISR caching. Defaults to `60`. */
  revalidate?: number | false

  /** Request timeout in milliseconds. Defaults to `15_000` (15 s). */
  timeout?: number

  /**
   * Custom `fetch` implementation. When omitted the SDK uses `globalThis.fetch`.
   * Useful for polyfills, test doubles, or Cloudflare Workers bindings.
   */
  fetch?: typeof globalThis.fetch

  /** Automatic retry policy for transient failures (network errors & 5xx). */
  retry?: {
    /** Maximum number of attempts (including the initial request). Defaults to `3`. */
    attempts?: number
    /** Base delay between retries in ms (doubles each attempt). Defaults to `500`. */
    delay?: number
  }

  /**
   * When `true` every request and response is logged to `console.debug`.
   * Works in both Node.js and browser consoles.
   */
  debug?: boolean

  /** Optional hooks for request/response inspection or mutation. */
  hooks?: {
    /** Called just before each fetch. You may mutate `req`. */
    beforeRequest?: (req: { url: string; init: RequestInit }) => void | Promise<void>
    /** Called after each successful or error response. */
    afterResponse?: (res: Response) => void | Promise<void>
  }
}

// ── Pagination ──────────────────────────────────────────────────────────────

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasMore: boolean
}

// ── Rate-limit metadata (extracted from response headers if present) ────────

export interface RateLimitInfo {
  limit?: number
  remaining?: number
  reset?: number
}

// ── Category / Tag / Author ─────────────────────────────────────────────────

export interface Category {
  id: string
  slug: string
  name: string
  description: string
  color: string
  icon: string
}

export interface Tag {
  id: string
  slug: string
  name: string
}

export interface Author {
  id: string
  slug: string
  name: string
  avatar: string | null
  bio: string | null
}

// ── Posts ────────────────────────────────────────────────────────────────────

export interface PostListItem {
  slug: string
  title: string
  excerpt: string | null
  metaTitle: string | null
  metaDescription: string | null
  tags: string[]
  categories: string[]
  author: string | null
  featuredImage: string | null
  featuredImageUrl: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  categoriesData: Category[]
  tagsData: Tag[]
  authorData: Author | null
}

export interface Post extends PostListItem {
  /** Full post body — HTML (default) or raw markdown depending on `format`. */
  content: string
  /** CSS styles for the post content. Inject into your page for proper styling. */
  contentStyles: string
  /** Related Things-to-Do pages for cross-linking. */
  relatedThingsToDo: ThingsToDoRef[]
}

export interface ThingsToDoRef {
  slug: string
  pageTitle: string
  cityName: string | null
  state: string | null
}

// ── Posts API params ────────────────────────────────────────────────────────

export interface ListPostsParams {
  page?: number
  limit?: number
  tag?: string
  category?: string
  sort?: "newest" | "oldest"
}

export interface GetPostParams {
  /** `"html"` returns server-rendered HTML. `"markdown"` returns raw markdown. Default: `"html"`. */
  format?: "html" | "markdown"
  /** When `true`, wraps content in a styled container with CSS. Default: `false`. */
  styled?: boolean
}

// ── Posts API responses ─────────────────────────────────────────────────────

export interface ListPostsResponse {
  posts: PostListItem[]
  thingsToDoPages: ThingsToDoRef[]
  pagination: Pagination
}

export interface GetPostResponse extends Post {}

// ── Things to Do ────────────────────────────────────────────────────────────

export interface ThingsToDoListItem {
  slug: string
  pageTitle: string
  cityName: string | null
  state: string | null
  cityPageUrl: string | null
  heroDescription: string | null
  heroImageUrl: string | null
  metaTitle: string | null
  metaDescription: string | null
  attractionCount: number
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Attraction {
  title: string
  address: string | null
  description: string | null
  /** Google Maps URL (opens in a new tab). */
  mapLink: string | null
  /**
   * Full `<iframe ...></iframe>` HTML from NexoFlow. Use with `dangerouslySetInnerHTML` (or your framework’s equivalent),
   * not as an iframe `src` attribute.
   */
  mapEmbed: string | null
  /**
   * HTTPS embed URL only (e.g. `https://maps.google.com/maps?...&output=embed`).
   * **Prefer this** for `<iframe src={mapEmbedSrc} />` in React/Vue/Svelte — avoids putting HTML into `src`.
   * May be `null` if only a short link exists and the API could not resolve a sync URL.
   */
  mapEmbedSrc: string | null
  order: number
}

export interface ThingsToDoPage {
  slug: string
  pageTitle: string
  cityName: string | null
  state: string | null
  cityPageUrl: string | null
  heroImageUrl: string | null
  heroDescription: string | null
  metaTitle: string | null
  metaDescription: string | null
  attractions: Attraction[]
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  /** Present when `format: "html"` — full article HTML. */
  contentHtml?: string
}

// ── Things to Do API params ─────────────────────────────────────────────────

export interface ListThingsToDoParams {
  page?: number
  limit?: number
  city?: string
  state?: string
  sort?: "newest" | "oldest"
}

export interface GetThingsToDoParams {
  /** `"json"` returns structured data. `"html"` returns pre-rendered sections. Default: `"json"`. */
  format?: "json" | "html"
}

// ── Things to Do API responses ──────────────────────────────────────────────

export interface ListThingsToDoResponse {
  pages: ThingsToDoListItem[]
  pagination: Pagination
}

export interface GetThingsToDoResponse {
  page: ThingsToDoPage
  contentStyles?: string
  layoutHints?: Record<string, unknown>
}
