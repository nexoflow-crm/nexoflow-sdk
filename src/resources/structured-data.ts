import type { HttpClient, ApiResponse } from "../http"
import type { RequestOptions, StructuredDataResponse } from "../types"
import { cacheTags, withTags } from "../cache-tags"

const MAX_PATH_LENGTH = 2048

/**
 * A page's path from a path or a full address, without its query or fragment, so both forms name the same page
 * ("https://site.com/services?x=1" and "services?x=1#top" are both "/services").
 */
function pagePath(pathOrUrl: string): string {
  const trimmed = pathOrUrl.trim()
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).pathname || "/"
    } catch {
      // Not a valid address after all: read it as a path below.
    }
  }
  const path = trimmed.replace(/^https?:\/\/[^/?#]*/i, "").split(/[?#]/, 1)[0] ?? ""
  return path.startsWith("/") ? path : `/${path}`
}

export class StructuredDataResource {
  constructor(private http: HttpClient) {}

  /**
   * The JSON-LD one page of the site should carry, from what NexoFlow knows about the business: who it is, its
   * services, the places it serves and the page itself. Call it for every page with that page's path. `jsonld` is
   * `null` when there is nothing for that page or schema markup is switched off in the site settings: print nothing
   * then.
   *
   * In React, print it as a `<script type="application/ld+json">` with `jsonLdText` (escaped, safe to inject). A
   * script is valid in `<head>` or `<body>`; never wrap it in a `<div>`, which is not allowed in `<head>` and pushes
   * every tag after it into the body. Where the page is built from strings (Astro `set:html`, Nuxt, plain HTML),
   * print `scriptTag` as it is: it is the whole `<script>` element, already escaped.
   *
   * On a page where it returns markup, do not add your own `BlogPosting` JSON-LD, so the page is not described
   * twice.
   *
   * ```tsx
   * import { jsonLdText } from "nexoflow-sdk"
   *
   * const { data } = await nf.structuredData.forPath("/services/kitchen-remodeling")
   * return data.jsonld ? (
   *   <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(data.jsonld) }} />
   * ) : null
   * ```
   */
  async forPath(path: string, options?: RequestOptions): Promise<ApiResponse<StructuredDataResponse>> {
    if (!path || typeof path !== "string") {
      throw new Error("nexoflow-sdk: `path` is required and must be a non-empty string, for example \"/services/drain-cleaning\".")
    }
    const page = pagePath(path)
    if (page.length > MAX_PATH_LENGTH) {
      throw new Error(`nexoflow-sdk: \`path\` is longer than ${MAX_PATH_LENGTH} characters.`)
    }
    return this.http.request<StructuredDataResponse>({
      path: "/api/v1/content/structured-data",
      params: { path: page },
      signal: options?.signal,
      revalidate: options?.revalidate,
      tags: withTags([cacheTags.all, cacheTags.structuredData], options?.tags),
    })
  }
}
