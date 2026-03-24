import type { NexoFlowConfig } from "./types"
import { createHttpClient } from "./http"
import { PostsResource } from "./resources/posts"
import { ThingsToDoResource } from "./resources/things-to-do"
import { VERSION } from "./version"

/**
 * NexoFlow SDK client — universal, isomorphic, production-grade.
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
  /** Posts resource — list, get, iterate. */
  readonly posts: PostsResource
  /** Things-to-Do resource — list, get, iterate. */
  readonly thingsToDo: ThingsToDoResource
  /** SDK version string. */
  static readonly version: string = VERSION

  constructor(config: NexoFlowConfig) {
    // ── Validate API key ──────────────────────────────────────────────────
    if (!config.apiKey) {
      throw new Error(
        "nexoflow-sdk: `apiKey` is required. " +
          "Get your key from the NexoFlow dashboard -> Content API.",
      )
    }

    // ── Browser environment warning ───────────────────────────────────────
    if (typeof window !== "undefined") {
      console.warn(
        "NexoFlow: This SDK is intended for server-side use. " +
          "Do not expose your API key in the browser. " +
          "If you see this in production, move your NexoFlow calls to a " +
          "server component, API route, or backend service.",
      )
    }

    // ── Build internals ───────────────────────────────────────────────────
    const http = createHttpClient(config)
    this.posts = new PostsResource(http)
    this.thingsToDo = new ThingsToDoResource(http)
  }
}
