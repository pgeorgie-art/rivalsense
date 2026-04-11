import FirecrawlApp from '@mendable/firecrawl-js'

let _firecrawl: FirecrawlApp | null = null
function getFirecrawl() {
  if (!_firecrawl) _firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! })
  return _firecrawl
}

export interface ScrapeResult {
  success: boolean
  markdown?: string
  error?: string
}

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  try {
    const result = await getFirecrawl().scrape(url, { formats: ['markdown'] })
    const markdown = (result as { markdown?: string }).markdown
    if (!markdown) return { success: false, error: 'No content returned from scrape' }
    return { success: true, markdown }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown scrape error'
    return { success: false, error: message }
  }
}

export interface ReviewResult {
  success: boolean
  content: string   // Combined review text for Claude
  sources: string[] // URLs that had reviews
}

export async function scrapeReviews(
  competitorName: string,
  competitorUrl: string,
): Promise<ReviewResult> {
  const hostname = competitorUrl.replace(/^https?:\/\//, '').replace('www.', '').split('/')[0]
  const query = `${competitorName || hostname} customer reviews`

  try {
    // Search for review pages
    const searchResult = await getFirecrawl().search(query, {
      limit: 5,
      scrapeOptions: { formats: ['markdown'] },
    })

    type SearchDoc = { url?: string; markdown?: string; title?: string }
    const docs: SearchDoc[] = (searchResult as { data?: SearchDoc[] }).data ?? []

    if (!docs.length) {
      return { success: false, content: '', sources: [] }
    }

    // Filter to review-heavy sources
    const reviewSources = ['google', 'yelp', 'tripadvisor', 'trustpilot', 'facebook', 'reviews']
    const reviewDocs = docs
      .filter(d => reviewSources.some(s => (d.url ?? '').toLowerCase().includes(s)))
      .slice(0, 3)

    // Fall back to all results if no dedicated review sites found
    const docsToUse = reviewDocs.length > 0 ? reviewDocs : docs.slice(0, 3)

    const combinedContent = docsToUse
      .map(d => `Source: ${d.url}\n${(d.markdown ?? '').slice(0, 2000)}`)
      .join('\n\n---\n\n')

    const sources = docsToUse.map(d => d.url ?? '').filter(Boolean)

    return {
      success: true,
      content: combinedContent,
      sources,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Review search failed'
    console.warn('[Firecrawl] Review scrape failed:', message)
    return { success: false, content: '', sources: [] }
  }
}
