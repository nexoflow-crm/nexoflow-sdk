import type { NexoFlowConfig } from "./types"
import { createHttpClient } from "./http"
import { PostsResource } from "./resources/posts"
import { ThingsToDoResource } from "./resources/things-to-do"

/**
 * NexoFlow SDK client.
 *
 * ```ts
 * import { NexoFlow } from "nexoflow-sdk"
 *
 * const nf = new NexoFlow({ apiKey: process.env.BLOG_API_KEY! })
 *
 * const { posts } = await nf.posts.list({ limit: 10 })
 * const post = await nf.posts.get("my-post")
 * ```
 */
export class NexoFlow {
  readonly posts: PostsResource
  readonly thingsToDo: ThingsToDoResource

  constructor(config: NexoFlowConfig) {
    if (!config.apiKey) {
      throw new Error(
        "nexoflow-sdk: apiKey is required. " +
        "Get your key from the NexoFlow dashboard → Content API."
      )
    }

    const http = createHttpClient(config)
    this.posts = new PostsResource(http)
    this.thingsToDo = new ThingsToDoResource(http)
  }
}
