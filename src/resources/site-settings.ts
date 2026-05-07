import type { HttpClient, ApiResponse } from "../http"
import type { SiteSettingsResponse, RequestOptions } from "../types"

export class SiteSettingsResource {
  constructor(private http: HttpClient) {}

  /**
   * Fetch the project's site settings (permalink structure + feature flags).
   *
   * Call this once at build/request time to read global configuration:
   *
   * ```ts
   * const { data: siteSettings } = await nf.siteSettings.get()
   *
   * // Build conditional UI based on feature flags
   * const showReadingTime = siteSettings.features.enableReadingTime
   * const showSchema = siteSettings.features.enableSchemaMarkup
   *
   * // Or use the permalinkStructure to build URLs manually
   * const structure = siteSettings.permalinkStructure // e.g. "/%year%/%month%/%slug%"
   * // Note: each post already has a resolved `path` field in list/single responses
   * ```
   */
  async get(options?: RequestOptions): Promise<ApiResponse<SiteSettingsResponse>> {
    return this.http.request<SiteSettingsResponse>({
      path: "/api/v1/content/site-settings",
      signal: options?.signal,
      revalidate: options?.revalidate,
    })
  }
}
