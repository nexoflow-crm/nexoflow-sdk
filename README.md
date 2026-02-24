# nexoflow-sdk

Official TypeScript SDK for the [NexoFlow](https://nexoflow.net) Content API.

Fetch blog posts, Things-to-Do pages, and images with full type safety — in 3 lines of code.

## Install

```bash
npm install nexoflow-sdk
```

## Quick Start

```ts
import { NexoFlow } from "nexoflow-sdk"

const nf = new NexoFlow({ apiKey: process.env.BLOG_API_KEY! })

// List posts
const { posts, pagination } = await nf.posts.list({ limit: 10 })

// Get a single post (HTML content, ready to render)
const post = await nf.posts.get("my-post-slug")
```

## Next.js Example

### Blog List Page

```tsx
// app/blog/page.tsx
import { NexoFlow } from "nexoflow-sdk"

const nf = new NexoFlow({
  apiKey: process.env.BLOG_API_KEY!,
  revalidate: 60, // ISR: refresh every 60 seconds
})

export default async function BlogPage() {
  const { posts } = await nf.posts.list({ limit: 12 })

  return (
    <div>
      <h1>Blog</h1>
      {posts.map((post) => (
        <article key={post.slug}>
          {post.featuredImageUrl && (
            <img src={post.featuredImageUrl} alt={post.title} />
          )}
          <h2><a href={`/blog/${post.slug}`}>{post.title}</a></h2>
          <p>{post.excerpt}</p>
        </article>
      ))}
    </div>
  )
}
```

### Single Post Page

```tsx
// app/blog/[slug]/page.tsx
import { NexoFlow, NexoFlowError } from "nexoflow-sdk"
import { notFound } from "next/navigation"

const nf = new NexoFlow({ apiKey: process.env.BLOG_API_KEY! })

export async function generateStaticParams() {
  return await nf.posts.slugs()
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  try {
    const post = await nf.posts.get(params.slug)
    return {
      title: post.metaTitle || post.title,
      description: post.metaDescription || post.excerpt,
    }
  } catch {
    return {}
  }
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  let post
  try {
    post = await nf.posts.get(params.slug)
  } catch (err) {
    if (err instanceof NexoFlowError && err.isNotFound) notFound()
    throw err
  }

  return (
    <article>
      <h1>{post.title}</h1>
      {post.featuredImageUrl && (
        <img src={post.featuredImageUrl} alt={post.title} />
      )}
      <style dangerouslySetInnerHTML={{ __html: post.contentStyles }} />
      <div
        className="post-content"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />
    </article>
  )
}
```

## API

### `new NexoFlow(config)`

| Option       | Type               | Default                  | Description                          |
| ------------ | ------------------ | ------------------------ | ------------------------------------ |
| `apiKey`     | `string`           | *required*               | Your project API key (`pk_live_…`)   |
| `baseUrl`    | `string`           | `https://nexoflow.net`   | NexoFlow instance URL                |
| `revalidate` | `number \| false`  | `60`                     | Default ISR cache time (seconds)     |
| `timeout`    | `number`           | `15000`                  | Request timeout (ms)                 |

### Posts

```ts
nf.posts.list(params?)    // List posts (paginated)
nf.posts.get(slug, opts?) // Get single post with content
nf.posts.all(params?)     // Get ALL posts (auto-paginated)
nf.posts.slugs()          // Get all slugs (for generateStaticParams)
```

**List params:** `page`, `limit`, `tag`, `category`, `sort` (`"newest"` | `"oldest"`)

**Get options:** `format` (`"html"` | `"markdown"`), `styled` (`boolean`)

### Things to Do

```ts
nf.thingsToDo.list(params?)    // List pages (paginated)
nf.thingsToDo.get(slug, opts?) // Get single page with attractions
nf.thingsToDo.all(params?)     // Get ALL pages (auto-paginated)
nf.thingsToDo.slugs()          // Get all slugs
```

**List params:** `page`, `limit`, `city`, `state`, `sort`

**Get options:** `format` (`"json"` | `"html"`)

## Error Handling

```ts
import { NexoFlow, NexoFlowError } from "nexoflow-sdk"

try {
  const post = await nf.posts.get("nonexistent")
} catch (err) {
  if (err instanceof NexoFlowError) {
    console.log(err.status)        // 404
    console.log(err.message)       // "Post not found."
    console.log(err.isNotFound)    // true
    console.log(err.isUnauthorized) // false
  }
}
```

## TypeScript

Every response is fully typed. Import individual types as needed:

```ts
import type { Post, PostListItem, Category, Author, Pagination } from "nexoflow-sdk"
```

## Requirements

- Node.js 18+ (uses native `fetch` and `AbortSignal.timeout`)
- Works with Next.js, Astro, Nuxt, Remix, SvelteKit, or any Node.js server

## License

MIT
