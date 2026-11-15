import type { Pagination } from "./types"

/** The most items one page can hold (the API's own cap). */
export const PAGE_SIZE_MAX = 100
/** How many pages are read at the same time when every page is wanted. */
export const PAGE_CONCURRENCY = 4
/** A runaway total never turns into thousands of calls. */
const PAGE_COUNT_MAX = 1_000

type PageReader<T> = (page: number) => Promise<{ items: T[]; pagination: Pagination }>

/**
 * Run `work` over `inputs` with at most `limit` at a time, results in input order. After the first failure no new
 * input is started (the ones already running finish), and that failure is what the call rejects with.
 */
async function mapLimit<I, O>(inputs: I[], limit: number, work: (input: I) => Promise<O>): Promise<O[]> {
  const results = new Array<O>(inputs.length)
  let next = 0
  let failed = false
  async function worker() {
    while (!failed && next < inputs.length) {
      const index = next++
      try {
        results[index] = await work(inputs[index] as I)
      } catch (error) {
        failed = true
        throw error
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, inputs.length) }, worker))
  return results
}

function warnCapped(totalPages: number) {
  console.warn(`[nexoflow-sdk] stopped after ${PAGE_COUNT_MAX} pages; the API reported ${totalPages}. Read the rest with list({ page }).`)
}

/**
 * Every item across every page: the first page says how many pages there are, then the rest are read a few at a
 * time instead of one after another. If the list changes while it is read (a post is published), an item that
 * moved onto a later page is kept once, and one that moved onto a page already read can be missed: read again for
 * an exact list. At most 1,000 pages, with a warning when there are more.
 */
export async function readAllPages<T>(readPage: PageReader<T>, keyOf: (item: T) => string): Promise<T[]> {
  const first = await readPage(1)
  const pages: T[][] = [first.items]
  const totalPages = first.pagination?.totalPages
  if (first.pagination?.hasMore) {
    if (typeof totalPages === "number" && Number.isFinite(totalPages) && totalPages > 1) {
      if (totalPages > PAGE_COUNT_MAX) warnCapped(totalPages)
      const rest = Array.from({ length: Math.min(totalPages, PAGE_COUNT_MAX) - 1 }, (_, index) => index + 2)
      pages.push(...(await mapLimit(rest, PAGE_CONCURRENCY, async (page) => (await readPage(page)).items)))
    } else {
      // A server that does not say how many pages there are: read on until it says there are no more.
      let page = 2
      let hasMore = true
      while (hasMore && page <= PAGE_COUNT_MAX) {
        const next = await readPage(page)
        if (next.items.length === 0) break
        pages.push(next.items)
        hasMore = next.pagination?.hasMore === true
        page++
      }
    }
  }
  const seen = new Set<string>()
  const all: T[] = []
  for (const items of pages) {
    for (const item of items) {
      const key = keyOf(item)
      if (seen.has(key)) continue
      seen.add(key)
      all.push(item)
    }
  }
  return all
}

/**
 * One item at a time across every page; the next page is already on its way while this one is used. A loop that
 * stops early has still asked for the page after the one it stopped in (one extra call).
 */
export async function* iteratePages<T>(readPage: PageReader<T>): AsyncGenerator<T, void, undefined> {
  let page = 1
  let pending = readPage(page)
  while (page <= PAGE_COUNT_MAX) {
    const current = await pending
    const more = current.pagination?.hasMore === true && current.items.length > 0
    if (more) {
      pending = readPage(page + 1)
      // Read ahead: if the loop stops early, a failure of the page nobody asked for must not crash the process.
      pending.catch(() => undefined)
    }
    for (const item of current.items) yield item
    if (!more) return
    page++
  }
}
