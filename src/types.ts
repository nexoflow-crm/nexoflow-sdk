// ── Client Configuration ────────────────────────────────────────────────────

export interface NexoFlowConfig {
  /**
   * Your project API key (`pk_live_…`). **Required.**
   *
   * **WARNING - this key is SECRET.** Never expose it in browser-side code,
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

  /**
   * Time each attempt gets, in milliseconds. Defaults to `15_000` (15 s). A retry after a slow attempt gets the full
   * time again.
   */
  timeout?: number

  /**
   * Custom `fetch` implementation. When omitted the SDK uses `globalThis.fetch`.
   * Useful for polyfills, test doubles, or Cloudflare Workers bindings.
   */
  fetch?: typeof globalThis.fetch

  /**
   * Automatic retry policy for transient failures (network errors, timeouts, 5xx and 429). A cancel through your own
   * `signal` is never retried. A 429 asking to wait longer than 5 s fails at once with `retryAfterMs` on the error.
   */
  retry?: {
    /** Maximum number of attempts (including the initial request). Defaults to `3`. */
    attempts?: number
    /** Base delay between retries in ms (exponential backoff with jitter). Defaults to `500`. */
    delay?: number
  }

  /**
   * When `true` every request and response is logged to `console.debug`.
   * API keys are masked in debug output. Works in both Node.js and browser consoles.
   */
  debug?: boolean

  /**
   * Share one call between identical requests made at the same time. Default `false`.
   *
   * Turn it on only where nothing else dedupes requests (Express, Fastify, Astro SSR, Workers). Leave it off in
   * Next.js: there each render has to make its own fetch, because that call is what gives the render its cache tags
   * and `revalidate` time, and Next already dedupes identical fetches within one render. With it on, the hooks run
   * once per shared call.
   */
  dedupe?: boolean

  /** Optional hooks for request/response inspection or mutation. */
  hooks?: {
    /** Called just before each attempt's fetch. You may mutate `req`. */
    beforeRequest?: (req: { url: string; init: RequestInit }) => void | Promise<void>
    /**
     * Called after each successful or error response, with a copy of it (reading its body is safe). An error it
     * throws fails the call with that error as it is, once: it is not retried and not reported as a network error.
     */
    afterResponse?: (res: Response) => void | Promise<void>
  }
}

// ── Request Options (per-call overrides) ────────────────────────────────────

export interface RequestOptions {
  /**
   * Per-request AbortSignal for cancellation (composed with each attempt's timeout). A cancelled request fails with
   * code `ABORTED` and is not retried.
   */
  signal?: AbortSignal
  /** Override the default ISR revalidate hint for this request only. */
  revalidate?: number | false
  /** Extra Next.js cache tags for this request, on top of the SDK's own (see `cacheTags`). */
  tags?: string[]
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

/**
 * A field the business added to its posts in NexoFlow ("Project cost", "Service area"). Every field it sends to its
 * site that has a value on the post, in the business's order. Print the list once, and every field the business
 * adds later shows on its own, with no new release:
 *
 * ```tsx
 * {post.fields?.map((field) => (
 *   <p key={field.key}><strong>{field.label}:</strong> {field.text}</p>
 * ))}
 * ```
 */
export interface PostField {
  /** Stable name, never changes ("project_cost"). */
  key: string
  label: string
  type: "text" | "long_text" | "number" | "date" | "yes_no" | "choice" | "list" | "link"
  /** As stored: text, a number, yes or no, a day (`YYYY-MM-DD`), or a list of names. */
  value: string | number | boolean | string[] | null
  /** The value ready to print ("Yes", "Nov 13, 2026", "Kitchen, Bath"). */
  text: string
}

export interface Author {
  id: string
  slug: string
  name: string
  avatar: string | null
  bio: string | null
}

// ── Site Settings ────────────────────────────────────────────────────────────

/**
 * On/off flags for site-wide features, as configured in the NexoFlow dashboard.
 *
 * | Flag | What to render when `true` |
 * |---|---|
 * | `enableReadingTime` | "X min read" label on posts |
 * | `enableRelatedPosts` | Related articles section at the bottom |
 * | `enableSocialSharing` | Share buttons (Twitter/X, Facebook, LinkedIn, etc.) |
 * | `enableSchemaMarkup` | `<script type="application/ld+json">` BlogPosting JSON-LD |
 */
export interface SiteFeatures {
  enableRelatedPosts: boolean
  enableReadingTime: boolean
  enableSocialSharing: boolean
  enableSchemaMarkup: boolean
}

/**
 * Response from `GET /api/v1/content/site-settings`.
 *
 * Use this to read the project's permalink structure and feature flags once at
 * build time (e.g. inside `generateStaticParams` or a root layout server component).
 */
export interface SiteSettingsResponse {
  /**
   * Permalink pattern configured in the dashboard.
   * Tokens: `%slug%`, `%year%`, `%month%`, `%day%`, `%category%`.
   *
   * Each post in list/single responses already includes a resolved `path` field,
   * so you only need this if you're building URLs manually.
   */
  permalinkStructure: string
  /** On/off flags for each site-wide feature. */
  features: SiteFeatures
}

// ── Posts ────────────────────────────────────────────────────────────────────

/**
 * Resolved card for a related blog post (single-post endpoint only).
 * Order matches {@link Post.relatedPostSlugs}. Missing or unpublished slugs
 * appear with null metadata fields.
 */
export interface RelatedArticle {
  slug: string
  title: string | null
  metaTitle: string | null
  /** Absolute URL suitable for `<img src>` (proxied or CDN when applicable). */
  featuredImageUrl: string | null
  publishedAt: string | null
}

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
  /**
   * The featured image's real width and height in pixels, for `<img width height>` and
   * `og:image:width` / `og:image:height`. `null` when not known yet (the single-post
   * endpoint reads and keeps them; a list carries them once they are kept).
   */
  featuredImageWidth?: number | null
  featuredImageHeight?: number | null
  /** What the featured image shows, for its `alt`. `null` when no description is known. */
  featuredImageAlt?: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  categoriesData: Category[]
  tagsData: Tag[]
  authorData: Author | null
  /**
   * Ordered related post slugs from the editor (list and single-post responses).
   * Same as {@link PostListItem.relatedPostSlugs}; both are kept for API backward compatibility.
   */
  relatedPosts: string[]
  /** Same array as `relatedPosts`. */
  relatedPostSlugs: string[]
  /** When true, include `<meta name="robots" content="noindex">` on this page. */
  noIndex: boolean
  /** When true, include `nofollow` in the robots meta directive. */
  noFollow: boolean
  /**
   * Primary SEO focus keyword for this post (e.g. `"roof repair austin"`). Sent with a single post
   * (`posts.get`), not in lists. Inject into your `<head>` as needed - for example in Next.js:
   * ```ts
   * keywords: post.focusKeyword ? [post.focusKeyword] : undefined
   * ```
   * `null` when not set.
   */
  focusKeyword?: string | null
  /**
   * Estimated reading time in minutes (computed from word count at ~225 wpm).
   * Use this to render a "X min read" label. The dashboard `enableReadingTime`
   * feature flag controls whether to show it in your UI.
   */
  readingTimeMinutes: number
  /**
   * Resolved URL path for this post, built from the project's
   * `permalinkStructure` (e.g. `/%year%/%month%/%slug%` → `/2024/03/my-post`).
   * Ready to use as an `href` in your link components.
   */
  path: string
  /**
   * The business's own post fields with a value on this post (see {@link PostField}). Empty when it has none;
   * absent from servers older than this field.
   */
  fields?: PostField[]
}

export interface Post extends PostListItem {
  /** Primary SEO focus keyword for this post. `null` when not set. */
  focusKeyword: string | null
  /** Full post body - HTML (default) or raw markdown depending on `format`. */
  content: string
  /** CSS styles for the post content. Inject into your page for proper styling. */
  contentStyles: string
  /** Related Things-to-Do pages for cross-linking. */
  relatedThingsToDo: ThingsToDoRef[]
  /**
   * Resolved metadata for each slug in {@link Post.relatedPostSlugs}.
   * Not returned on list endpoints; use slugs and fetch details if needed.
   */
  relatedArticles: RelatedArticle[]
  /**
   * On/off flags for each site-wide feature as configured in the NexoFlow dashboard.
   * Use these to conditionally render reading time, related posts section,
   * social sharing buttons, and JSON-LD structured data.
   */
  siteFeatures: SiteFeatures
  /**
   * "People Also Ask" / FAQ items for this post. Empty when the post has no FAQ
   * section (the feature is opt-in per project in Content Rules).
   *
   * When `format: "html"`, the FAQ is also rendered inline in `content` as a
   * styled `<section class="nexoflow-faq">` accordion, and its CSS is included in
   * `contentStyles`. Use this structured array to emit FAQPage JSON-LD when
   * `siteFeatures.enableSchemaMarkup` is `true`:
   *
   * ```ts
   * if (post.siteFeatures.enableSchemaMarkup && post.faq.length) {
   *   const jsonLd = {
   *     "@context": "https://schema.org",
   *     "@type": "FAQPage",
   *     mainEntity: post.faq.map((f) => ({
   *       "@type": "Question",
   *       name: f.question,
   *       acceptedAnswer: { "@type": "Answer", text: f.answer },
   *     })),
   *   }
   *   // <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
   * }
   * ```
   */
  faq: FaqItem[]
}

export interface ThingsToDoRef {
  slug: string
  pageTitle: string
  cityName: string | null
  state: string | null
}

/**
 * A single "People Also Ask" / FAQ entry for a post. Populated on the
 * single-post endpoint only (empty array when the post has no FAQ section).
 */
export interface FaqItem {
  /** Reader-facing question, phrased the way people search. */
  question: string
  /** Concise answer (typically 2 to 4 sentences). */
  answer: string
}

// ── Posts API params ────────────────────────────────────────────────────────

export interface ListPostsParams {
  page?: number
  /** Posts per page, 1 to 100. Default 20. */
  limit?: number
  /** Only posts with this tag, written exactly as a post lists it in `tags`. */
  tag?: string
  /** Only posts in this category, written exactly as a post lists it in `categories` (the name, not the slug). */
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
  /** On/off flags for each site-wide feature. Use to conditionally render UI elements. */
  siteFeatures: SiteFeatures
  /** Permalink structure (e.g. `/%slug%` or `/%year%/%month%/%slug%`). Each post already has a resolved `path`. */
  permalinkStructure: string
  pagination: Pagination
}

export type GetPostResponse = Post

// ── Structured data ─────────────────────────────────────────────────────────

/** Response from `GET /api/v1/content/structured-data?path=…` (`nf.structuredData.forPath`). */
export interface StructuredDataResponse {
  /** The page's JSON-LD, or `null` when there is none for it or schema markup is switched off. */
  jsonld: Record<string, unknown> | null
  /** The same JSON-LD as a ready, escaped `<script type="application/ld+json">` tag. Present when `jsonld` is. */
  scriptTag?: string
}

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
  /** When true, omit from search indexes (e.g. pass through to `robots` / meta noindex). */
  noIndex: boolean
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
   * Full `<iframe ...></iframe>` HTML from NexoFlow. Use with `dangerouslySetInnerHTML` (or your framework's equivalent),
   * not as an iframe `src` attribute.
   */
  mapEmbed: string | null
  /**
   * HTTPS embed URL only (e.g. `https://maps.google.com/maps?...&output=embed`).
   * **Prefer this** for `<iframe src={mapEmbedSrc} />` in React/Vue/Svelte - avoids putting HTML into `src`.
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
  /** When true, omit from search indexes (e.g. `generateMetadata` → `robots: { index: false, follow: false }`). */
  noIndex: boolean
  attractions: Attraction[]
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  /** Present when `format: "html"` - full article HTML. */
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
