# nexoflow-sdk

The official TypeScript SDK for the [NexoFlow](https://nexoflow.net) Content API.

[![npm version](https://img.shields.io/npm/v/nexoflow-sdk)](https://www.npmjs.com/package/nexoflow-sdk)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

## What is NexoFlow?

[NexoFlow](https://nexoflow.net) is an **AI-powered content automation platform**. It lets you generate, schedule, and publish blog posts and social media content - all from one dashboard. NexoFlow handles AI writing, image generation, and multi-channel publishing (WordPress or any JavaScript framework via the Content API), then delivers your content so you can display it on any website.

**nexoflow-sdk** gives you a clean, type-safe way to fetch that content from any JavaScript or TypeScript backend. Zero dependencies, full TypeScript support, built-in retries, and works everywhere Node.js runs.

### Why use the SDK?

- **Zero dependencies** - nothing to audit, nothing to break.
- **Full TypeScript support** - every response is typed, autocomplete works out of the box.
- **Built-in retries & timeouts** - transient failures are handled automatically with exponential backoff.
- **Async iterators** - paginate through thousands of posts with a simple `for await` loop.
- **Framework-agnostic** - works in Next.js, Nuxt, SvelteKit, Astro, Remix, Express, Fastify, Cloudflare Workers, Deno, Bun, and any server runtime.
- **ISR-ready** - pass `revalidate` and the SDK sets the right cache headers for Next.js Incremental Static Regeneration.

---

## Install

```bash
npm install nexoflow-sdk
```

```bash
# or with yarn / pnpm
yarn add nexoflow-sdk
pnpm add nexoflow-sdk
```

---

## Quick Start

```ts
import { NexoFlow } from "nexoflow-sdk"

const nf = new NexoFlow({ apiKey: process.env.NEXOFLOW_API_KEY! })

// List recent posts
const { data } = await nf.posts.list({ limit: 10 })
console.log(data.posts)       // PostListItem[]
console.log(data.pagination)  // { page, limit, total, hasMore }

// Get a single post by slug
const { data: post } = await nf.posts.get("my-first-post")
console.log(post.title)
console.log(post.content) // full HTML content

// Iterate over ALL posts (auto-paginates)
for await (const post of nf.posts.iter()) {
  console.log(post.title)
}
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
- Only call the SDK from **server-side** code (Server Components, API routes, server loaders, etc.)

If the SDK detects it is running in a browser (`window` is defined), it prints a console warning. Execution is not blocked, but the warning indicates a security misconfiguration.

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
nf.posts.get(slug, opts?) // Get single post with full content
nf.posts.all(params?)     // Get ALL posts (auto-paginated)
nf.posts.slugs()          // Get all slugs (for static generation)
nf.posts.iter(params?)    // Async iterator over all posts
```

**List params:** `page`, `limit`, `tag`, `category`, `sort` (`"newest"` | `"oldest"`)

**Get options:** `format` (`"html"` | `"markdown"`), `styled` (`boolean`)

### Examples

**Blog index with pagination:**

```ts
const { data } = await nf.posts.list({ limit: 12, category: "engineering" })

for (const post of data.posts) {
  console.log(`${post.title} - ${post.excerpt}`)
}

if (data.pagination.hasMore) {
  const { data: page2 } = await nf.posts.list({ limit: 12, page: 2 })
}
```

**Static site generation (get all slugs):**

```ts
const slugs = await nf.posts.slugs()
// [{ slug: "intro-to-nextjs" }, { slug: "deploy-to-vercel" }, ...]
```

**Async iterator - process every post without manual pagination:**

```ts
for await (const post of nf.posts.iter({ category: "news" })) {
  console.log(post.title)
}
```

---

## Things to Do

For location-based content pages with structured attraction data.

```ts
nf.thingsToDo.list(params?)    // List pages (paginated)
nf.thingsToDo.get(slug, opts?) // Get single page with attractions
nf.thingsToDo.all(params?)     // Get ALL pages (auto-paginated)
nf.thingsToDo.slugs()          // Get all slugs
nf.thingsToDo.iter(params?)    // Async iterator over all pages
```

**List params:** `page`, `limit`, `city`, `state`, `sort`

**Get options:** `format` (`"json"` | `"html"`). With `"html"`, the response includes `page.contentHtml` plus top-level `contentStyles` and `layoutHints` for styling and layout guidance.

**SEO:** Each list item and full page includes `noIndex` (boolean). When it is `true`, tell crawlers not to index the URL—for example in Next.js App Router:

```ts
// app/things-to-do/[slug]/page.tsx
import type { Metadata } from "next"
import { NexoFlow } from "nexoflow-sdk"

const nf = new NexoFlow({ apiKey: process.env.NEXOFLOW_API_KEY! })

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const { data } = await nf.thingsToDo.get(slug)
  const page = data.page
  return {
    title: page.metaTitle || page.pageTitle,
    description: page.metaDescription ?? undefined,
    ...(page.noIndex ? { robots: { index: false, follow: false } } : {}),
  }
}
```

### Maps / embeds

Each attraction includes:

- **`mapEmbedSrc`** - HTTPS URL only. **Use this** for `<iframe src={attraction.mapEmbedSrc} />` (React, Vue, Svelte, etc.). This avoids passing full HTML into `src`, which browsers treat as a URL string and breaks the embed.
- **`mapEmbed`** - Full `<iframe …></iframe>` HTML from NexoFlow. Render with `dangerouslySetInnerHTML` (or your framework’s equivalent), **not** as an iframe `src`.
- **`mapLink`** - Opens the location in Google Maps in a new tab.

`mapEmbedSrc` may be `null` if only a short link was stored and the API could not derive a synchronous embed URL; fall back to `mapEmbed` or `mapLink` in that case.

---

## Error Handling

```ts
import { NexoFlow, NexoFlowError } from "nexoflow-sdk"

try {
  const { data } = await nf.posts.get("nonexistent")
} catch (err) {
  if (err instanceof NexoFlowError) {
    console.log(err.status)         // 404
    console.log(err.code)           // "HTTP_404"
    console.log(err.message)        // "Post not found."
    console.log(err.requestId)      // server request ID (if available)
    console.log(err.isNotFound)     // true
    console.log(err.isUnauthorized) // false
    console.log(err.isRateLimited)  // false
  }
}
```

---

## Framework Examples

### Next.js (App Router)

Use the SDK in **Server Components**, **Route Handlers**, or `generateStaticParams`. Never import it in client components.

```tsx
// app/blog/page.tsx - Server Component
import { NexoFlow } from "nexoflow-sdk"

const nf = new NexoFlow({
  apiKey: process.env.NEXOFLOW_API_KEY!,
  revalidate: 60,
})

export default async function BlogPage() {
  const { data } = await nf.posts.list({ limit: 12 })

  return (
    <main>
      {data.posts.map((post) => (
        <article key={post.slug}>
          {post.featuredImageUrl && (
            <img src={post.featuredImageUrl} alt={post.title} />
          )}
          <a href={`/blog/${post.slug}`}><h2>{post.title}</h2></a>
          <p>{post.excerpt}</p>
        </article>
      ))}
      {data.pagination.hasMore && (
        <a href={`/blog?page=${data.pagination.page + 1}`}>Next page</a>
      )}
    </main>
  )
}
```

```tsx
// app/blog/[slug]/page.tsx - Single post with static generation
import { NexoFlow, NexoFlowError } from "nexoflow-sdk"
import { notFound } from "next/navigation"

const nf = new NexoFlow({ apiKey: process.env.NEXOFLOW_API_KEY! })

export async function generateStaticParams() {
  return await nf.posts.slugs()
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  try {
    const { data: post } = await nf.posts.get(params.slug, { styled: true })
    return (
      <article>
        <h1>{post.title}</h1>
        {post.contentStyles && (
          <style dangerouslySetInnerHTML={{ __html: post.contentStyles }} />
        )}
        <div dangerouslySetInnerHTML={{ __html: post.content }} />
      </article>
    )
  } catch (err) {
    if (err instanceof NexoFlowError && err.isNotFound) notFound()
    throw err
  }
}
```

### Nuxt 3

Use in **server routes** - the API key stays on the server:

```ts
// server/api/posts.ts
import { NexoFlow } from "nexoflow-sdk"

const nf = new NexoFlow({ apiKey: process.env.NEXOFLOW_API_KEY! })

export default defineEventHandler(async () => {
  const { data } = await nf.posts.list({ limit: 20 })
  return data
})
```

```vue
<!-- pages/blog.vue -->
<script setup>
const { data: blogData } = await useFetch("/api/posts")
</script>

<template>
  <article v-for="post in blogData.posts" :key="post.slug">
    <NuxtLink :to="`/blog/${post.slug}`">
      <h2>{{ post.title }}</h2>
    </NuxtLink>
    <p>{{ post.excerpt }}</p>
  </article>
</template>
```

### SvelteKit

Use in **`load` functions** (`+page.server.ts`):

```ts
// src/routes/blog/+page.server.ts
import { NexoFlow } from "nexoflow-sdk"
import { NEXOFLOW_API_KEY } from "$env/static/private"

const nf = new NexoFlow({ apiKey: NEXOFLOW_API_KEY })

export async function load() {
  const { data } = await nf.posts.list({ limit: 20 })
  return { posts: data.posts, pagination: data.pagination }
}
```

### Astro

Use in **frontmatter** (runs at build time or SSR):

```astro
---
// src/pages/blog.astro
import { NexoFlow } from "nexoflow-sdk"

const nf = new NexoFlow({ apiKey: import.meta.env.NEXOFLOW_API_KEY })
const { data } = await nf.posts.list({ limit: 20 })
---

<html>
<body>
  {data.posts.map((post) => (
    <article>
      <a href={`/blog/${post.slug}`}><h2>{post.title}</h2></a>
      <p>{post.excerpt}</p>
    </article>
  ))}
</body>
</html>
```

### Remix

Use in **`loader` functions**:

```ts
// app/routes/blog.tsx
import { json } from "@remix-run/node"
import { useLoaderData, Link } from "@remix-run/react"
import { NexoFlow } from "nexoflow-sdk"

const nf = new NexoFlow({ apiKey: process.env.NEXOFLOW_API_KEY! })

export async function loader() {
  const { data } = await nf.posts.list({ limit: 20 })
  return json(data)
}

export default function Blog() {
  const { posts } = useLoaderData<typeof loader>()
  return (
    <main>
      {posts.map((post) => (
        <article key={post.slug}>
          <Link to={`/blog/${post.slug}`}><h2>{post.title}</h2></Link>
          <p>{post.excerpt}</p>
        </article>
      ))}
    </main>
  )
}
```

### Express / Fastify

```ts
import express from "express"
import { NexoFlow } from "nexoflow-sdk"

const app = express()
const nf = new NexoFlow({ apiKey: process.env.NEXOFLOW_API_KEY! })

app.get("/api/posts", async (req, res) => {
  const { data } = await nf.posts.list({ limit: 20 })
  res.json(data)
})

app.listen(3000)
```

### Edge Runtimes (Cloudflare Workers, Vercel Edge)

The SDK uses `globalThis.fetch` and `AbortSignal.timeout` - both available natively in edge runtimes:

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
import type {
  Post,
  PostListItem,
  Category,
  Author,
  Tag,
  Pagination,
  ApiResponse,
  RateLimitInfo,
} from "nexoflow-sdk"
```

---

## Requirements

- **Node.js 18+** (uses native `fetch` and `AbortSignal.timeout`)
- Works with Next.js, Nuxt, SvelteKit, Astro, Remix, Express, Fastify, Angular (server-side), Cloudflare Workers, Deno, and Bun

## Links

- [NexoFlow Dashboard](https://nexoflow.net) - create your project and get an API key
- [GitHub](https://github.com/nexoflow-crm/nexoflow-sdk) - source code, issues, contributions
- [npm](https://www.npmjs.com/package/nexoflow-sdk) - package registry

## License

MIT
