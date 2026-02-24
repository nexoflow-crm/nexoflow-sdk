// ── Client Configuration ────────────────────────────────────────────────────

export interface NexoFlowConfig {
  /** Your project API key (pk_live_…). Required. */
  apiKey: string
  /** Base URL of the NexoFlow instance. Defaults to https://nexoflow.net */
  baseUrl?: string
  /** Default revalidate hint (seconds) for Next.js ISR caching. Defaults to 60. */
  revalidate?: number | false
  /** Request timeout in milliseconds. Defaults to 15000 (15s). */
  timeout?: number
}

// ── Pagination ──────────────────────────────────────────────────────────────

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasMore: boolean
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
  /** Rich category objects with color, icon, etc. */
  categoriesData: Category[]
  /** Rich tag objects */
  tagsData: Tag[]
  /** Rich author object */
  authorData: Author | null
}

export interface Post extends PostListItem {
  /** Full post body — HTML (default) or raw markdown depending on format param. */
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
  /** "html" returns server-rendered HTML. "markdown" returns raw markdown. Default: "html" */
  format?: "html" | "markdown"
  /** When true, wraps content in a styled container with CSS. Default: false */
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
  mapLink: string | null
  mapEmbed: string | null
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
  /** CSS styles for the page content. */
  contentStyles?: string
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
  /** "json" returns structured data. "html" returns pre-rendered sections. Default: "json" */
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
}

// ── Error ───────────────────────────────────────────────────────────────────

export interface NexoFlowErrorData {
  status: number
  message: string
  url: string
}
