import type { NexoFlowConfig } from "./types"
import { createHttpClient } from "./http"
import { PostsResource } from "./resources/posts"
import { ThingsToDoResource } from "./resources/things-to-do"
import { SiteSettingsResource } from "./resources/site-settings"
import { VERSION } from "./version"

const API_KEY_PREFIX = "pk_live_"

/**
 * NexoFlow SDK client - universal, isomorphic, enterprise-grade.
 *
 * **Server-side usage only.** Your `pk_live_*` key is a secret.
 * Never instantiate this class in browser-side code, React client components,
 * or any bundle that ships to the end user.
 *
 * ```ts
 * import { NexoFlow } from "nexoflow-sdk"
 *
 * const nf = new NexoFlow({ apiKey: process.env.NEXOFLOW_API_KEY! })
 *
 * const { data } = await nf.posts.list({ limit: 10 })
 * const { data: post } = await nf.posts.get("hello-world")
 * ```
 */
export class NexoFlow {
  /** Posts resource - list, get, iterate, fetch all. */
  readonly posts: PostsResource
  /** Things-to-Do resource - list, get, iterate, fetch all. */
  readonly thingsToDo: ThingsToDoResource
  /** Site settings resource - permalink structure and feature flags. */
  readonly siteSettings: SiteSettingsResource
  /** SDK version string. */
  static readonly version: string = VERSION

  constructor(config: NexoFlowConfig) {
    // ── Validate API key ──────────────────────────────────────────────────
    if (!config.apiKey) {
      throw new Error(
        "nexoflow-sdk: `apiKey` is required. " +
          "Get your key from the NexoFlow dashboard -> Developer API.",
      )
    }

    if (typeof config.apiKey !== "string") {
      throw new Error("nexoflow-sdk: `apiKey` must be a string.")
    }

    if (!config.apiKey.startsWith(API_KEY_PREFIX)) {
      throw new Error(
        `nexoflow-sdk: Invalid API key format. Keys must start with "${API_KEY_PREFIX}". ` +
          "Get your key from the NexoFlow dashboard -> Developer API.",
      )
    }

    // ── Browser environment guard ──────────────────────────────────────────
    if (typeof window !== "undefined") {
      const isBrowser =
        typeof document !== "undefined" &&
        typeof navigator !== "undefined"

      if (isBrowser) {
        console.warn(
          "[nexoflow-sdk] SECURITY WARNING: This SDK is intended for server-side use only. " +
            "Your API key is being exposed in a browser environment. " +
            "Move your NexoFlow calls to a server component, API route, or backend service.",
        )
      }
    }

    // ── Validate optional config ───────────────────────────────────────────
    if (config.timeout !== undefined && (config.timeout <= 0 || !Number.isFinite(config.timeout))) {
      throw new Error("nexoflow-sdk: `timeout` must be a positive finite number.")
    }

    if (config.retry?.attempts !== undefined && (config.retry.attempts < 1 || !Number.isInteger(config.retry.attempts))) {
      throw new Error("nexoflow-sdk: `retry.attempts` must be a positive integer.")
    }

    if (config.retry?.delay !== undefined && (config.retry.delay < 0 || !Number.isFinite(config.retry.delay))) {
      throw new Error("nexoflow-sdk: `retry.delay` must be a non-negative finite number.")
    }

    // ── Build internals ───────────────────────────────────────────────────
    const http = createHttpClient(config)
    this.posts = new PostsResource(http)
    this.thingsToDo = new ThingsToDoResource(http)
    this.siteSettings = new SiteSettingsResource(http)
  }
}
