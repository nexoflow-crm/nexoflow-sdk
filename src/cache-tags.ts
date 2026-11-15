/**
 * The Next.js cache tags the SDK puts on its requests, so a site can refresh exactly what changed with
 * `revalidateTag` instead of waiting out `revalidate` (from a route protected by a secret):
 *
 * ```ts
 * import { revalidateTag } from "next/cache"
 * import { cacheTags } from "nexoflow-sdk"
 *
 * // Next.js 16 takes a cache profile; on Next.js 15 and earlier pass the tag alone.
 * revalidateTag(cacheTags.post("kitchen-remodel-cost"), "max") // one post's page
 * revalidateTag(cacheTags.posts, "max")                         // every post list and post page
 * revalidateTag(cacheTags.all, "max")                           // everything read from NexoFlow
 * ```
 *
 * Other runtimes ignore them.
 */
export const cacheTags = {
  /** Everything the SDK reads. */
  all: "nexoflow",
  /** Post lists and every single post. */
  posts: "nexoflow:posts",
  /** One post, by slug. */
  post: (slug: string) => `nexoflow:post:${slug}`,
  /** Things-to-Do lists and every single page. */
  thingsToDo: "nexoflow:things-to-do",
  /** One Things-to-Do page, by slug. */
  thingsToDoPage: (slug: string) => `nexoflow:things-to-do:${slug}`,
  siteSettings: "nexoflow:site-settings",
  structuredData: "nexoflow:structured-data",
  llmsTxt: "nexoflow:llms-txt",
} as const

/** The SDK's tags for a request, plus the caller's own. */
export function withTags(own: readonly string[], extra: readonly string[] | undefined): string[] {
  return extra?.length ? [...own, ...extra] : [...own]
}
