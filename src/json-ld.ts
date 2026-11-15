/**
 * JSON-LD as the text of a `<script type="application/ld+json">`, safe to inject: `<`, `>` and `&` are written as
 * unicode escapes, so nothing in the data can close the script tag, and U+2028/U+2029 are escaped too. `""` when
 * there is nothing to print.
 *
 * ```tsx
 * // Next.js App Router: a script is valid in <head> or <body>; never wrap it in a <div> inside <head>.
 * const { data } = await nf.structuredData.forPath("/services/kitchen-remodeling")
 * return data.jsonld ? (
 *   <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(data.jsonld) }} />
 * ) : null
 * ```
 */
export function jsonLdText(jsonld: unknown): string {
  if (jsonld === null || jsonld === undefined) return ""
  return JSON.stringify(jsonld)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}
