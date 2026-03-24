# nexoflow-sdk

Official TypeScript SDK for the [NexoFlow](https://nexoflow.net) Content API.

Fetch blog posts, Things-to-Do pages, and images with full type safety — universal, isomorphic, and production-grade. Works in Node.js, Next.js, Nuxt, SvelteKit, Angular, and any JavaScript server runtime.

## Install

```bash
npm install nexoflow-sdk
```

## Quick Start

```ts
import { NexoFlow } from "nexoflow-sdk"

const nf = new NexoFlow({ apiKey: process.env.NEXOFLOW_API_KEY! })

// List posts
const { data } = await nf.posts.list({ limit: 10 })
console.log(data.posts)

// Get a single post
const { data: post } = await nf.posts.get("my-post-slug")
```

---

## Server-Side Usage Only

Your NexoFlow API key (`pk_live_*`) is a **secret**. Treat it like a database password.

**Do NOT:**

- Import `nexoflow-sdk` in browser-side code or React client components
- Hard-code the key in source files that ship to the browser
- Use the key in `<script>` tags, Vite client bundles, or Angular services

**Do:**

- Store the key in an **environment variable** (e.g. `NEXOFLOW_API_KEY`)
- Only call the SDK from **server-side** code (see Framework Usage below)

```ts
// Always read from env vars — never hard-code
const nf = new NexoFlow({ apiKey: process.env.NEXOFLOW_API_KEY! })
```

If the SDK detects it is running in a browser (`window` is defined), it will print a console warning. Execution is **not** blocked, but the warning indicates a security misconfiguration.

---

## Configuration

```ts
const nf = new NexoFlow({
  // Required
  apiKey: process.env.NEXOFLOW_API_KEY!,

  // Optional
  baseUrl: "https://nexoflow.net",  // default
  timeout: 15_000,                   // 15 seconds (default)
  revalidate: 60,                    // Next.js ISR hint in seconds (default)

  // Custom fetch (useful for polyfills, edge runtimes, tests)
  fetch: customFetchFn,

  // Retry transient failures (5xx, network errors)
  retry: {
    attempts: 3, // default
    delay: 500,  // base delay in ms, doubles each retry (default)
  },

  // Debug logging (request/response details)
  debug: true,

  // Lifecycle hooks
  hooks: {
    beforeRequest: ({ url, init }) => {
      console.log("Requesting:", url)
    },
    afterResponse: (res) => {
      console.log("Status:", res.status)
    },
  },
})
```

| Option       | Type               | Default                | Description                                       |
| ------------ | ------------------ | ---------------------- | ------------------------------------------------- |
| `apiKey`     | `string`           | *required*             | Your project API key (`pk_live_*`)                |
| `baseUrl`    | `string`           | `https://nexoflow.net` | NexoFlow instance URL                             |
| `revalidate` | `number \| false`  | `60`                   | Default ISR cache time (seconds) for Next.js      |
| `timeout`    | `number`           | `15000`                | Request timeout (ms)                              |
| `fetch`      | `typeof fetch`     | `globalThis.fetch`     | Custom fetch implementation                       |
| `retry`      | `object`           | `{ attempts: 3, delay: 500 }` | Retry policy for transient failures       |
| `debug`      | `boolean`          | `false`                | Log request/response details to console           |
| `hooks`      | `object`           | `undefined`            | beforeRequest / afterResponse lifecycle hooks     |

---

## Response Format

Every SDK method returns a consistent envelope:

```ts
{
  data: T,               // the API response payload
  rateLimit?: {           // extracted from response headers (when available)
    limit?: number,
    remaining?: number,
    reset?: number,
  }
}
```

```ts
const { data, rateLimit } = await nf.posts.list({ limit: 5 })

console.log(data.posts)
console.log(data.pagination)
console.log(rateLimit?.remaining)
```

---

## Posts

```ts
nf.posts.list(params?)    // List posts (paginated)
nf.posts.get(slug, opts?) // Get single post with content
nf.posts.all(params?)     // Get ALL posts (auto-paginated)
nf.posts.slugs()          // Get all slugs (for generateStaticParams)
nf.posts.iter(params?)    // Async iterator over all posts
```

**List params:** `page`, `limit`, `tag`, `category`, `sort` (`"newest"` | `"oldest"`)

**Get options:** `format` (`"html"` | `"markdown"`), `styled` (`boolean`)

### Async Iterator

```ts
for await (const post of nf.posts.iter({ category: "news" })) {
  console.log(post.title)
}
```

---

## Things to Do

```ts
nf.thingsToDo.list(params?)    // List pages (paginated)
nf.thingsToDo.get(slug, opts?) // Get single page with attractions
nf.thingsToDo.all(params?)     // Get ALL pages (auto-paginated)
nf.thingsToDo.slugs()          // Get all slugs
nf.thingsToDo.iter(params?)    // Async iterator over all pages
```

**List params:** `page`, `limit`, `city`, `state`, `sort`

**Get options:** `format` (`"json"` | `"html"`)

---

## Error Handling

```ts
import { NexoFlow, NexoFlowError } from "nexoflow-sdk"

try {
  const { data } = await nf.posts.get("nonexistent")
} catch (err) {
  if (err instanceof NexoFlowError) {
    console.log(err.status)        // 404
    console.log(err.code)          // "HTTP_404"
    console.log(err.message)       // "Post not found."
    console.log(err.requestId)     // server request ID (if available)
    console.log(err.isNotFound)    // true
    console.log(err.isUnauthorized) // false
    console.log(err.isRateLimited) // false
  }
}
```

---

## Framework Usage

### Next.js (App Router)

Use the SDK in **Server Components**, **Route Handlers**, or `generateStaticParams`. Never in client components.

```tsx
// app/blog/page.tsx (Server Component)
import { NexoFlow } from "nexoflow-sdk"

const nf = new NexoFlow({
  apiKey: process.env.NEXOFLOW_API_KEY!,
  revalidate: 60,
})

export default async function BlogPage() {
  const { data } = await nf.posts.list({ limit: 12 })
  return (
    <div>
      {data.posts.map((post) => (
        <article key={post.slug}>
          <h2>{post.title}</h2>
        </article>
      ))}
    </div>
  )
}
```

```tsx
// app/blog/[slug]/page.tsx
import { NexoFlow, NexoFlowError } from "nexoflow-sdk"
import { notFound } from "next/navigation"

const nf = new NexoFlow({ apiKey: process.env.NEXOFLOW_API_KEY! })

export async function generateStaticParams() {
  return await nf.posts.slugs()
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  try {
    const { data: post } = await nf.posts.get(params.slug)
    return (
      <article>
        <h1>{post.title}</h1>
        <style dangerouslySetInnerHTML={{ __html: post.contentStyles }} />
        <div dangerouslySetInnerHTML={{ __html: post.content }} />
      </article>
    )
  } catch (err) {
    if (err instanceof NexoFlowError && err.isNotFound) notFound()
    throw err
  }
}
```

### Vue / Nuxt

Use in **server routes** or **server-side composables** only:

```ts
// server/api/posts.ts (Nuxt server route)
import { NexoFlow } from "nexoflow-sdk"

const nf = new NexoFlow({ apiKey: process.env.NEXOFLOW_API_KEY! })

export default defineEventHandler(async () => {
  const { data } = await nf.posts.list({ limit: 20 })
  return data
})
```

### SvelteKit

Use in **`load` functions** (server-side):

```ts
// src/routes/blog/+page.server.ts
import { NexoFlow } from "nexoflow-sdk"

const nf = new NexoFlow({ apiKey: import.meta.env.NEXOFLOW_API_KEY })

export async function load() {
  const { data } = await nf.posts.list({ limit: 20 })
  return { posts: data.posts }
}
```

### Angular

Angular runs in the browser. Use the SDK via a **backend API** or Angular Universal SSR:

```ts
// Backend API (Express, NestJS, etc.)
import { NexoFlow } from "nexoflow-sdk"

const nf = new NexoFlow({ apiKey: process.env.NEXOFLOW_API_KEY! })

app.get("/api/posts", async (req, res) => {
  const { data } = await nf.posts.list()
  res.json(data)
})
```

Then call your own API from the Angular service — never import the SDK directly in Angular components.

### Edge Runtimes (Cloudflare Workers, Vercel Edge)

The SDK uses `globalThis.fetch` and `AbortSignal.timeout`, both available in edge runtimes:

```ts
export default {
  async fetch(request: Request, env: Env) {
    const nf = new NexoFlow({ apiKey: env.NEXOFLOW_API_KEY })
    const { data } = await nf.posts.list({ limit: 5 })
    return Response.json(data)
  },
}
```

---

## TypeScript

Every response is fully typed. Import individual types as needed:

```ts
import type { Post, PostListItem, Category, Author, Pagination, ApiResponse } from "nexoflow-sdk"
```

---

## Requirements

- Node.js 18+ (uses native `fetch` and `AbortSignal.timeout`)
- Works with Next.js, Nuxt, SvelteKit, Astro, Remix, Angular (server-side), Cloudflare Workers, Deno, Bun

## License

MIT
