import FirecrawlApp from '@mendable/firecrawl-js'

let _firecrawl: FirecrawlApp | null = null
function getFirecrawl() {
  if (!_firecrawl) _firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! })
  return _firecrawl
}

export interface PriceItem {
  service: string
  price: string
  price_numeric: number | null
}

export interface PromoItem {
  type: string
  description: string
}

export interface BusinessInfo {
  name: string | null
  phone: string | null
  address: string | null
  hours: string | null
  description: string | null
}

export interface StructuredScrapeResult {
  success: boolean
  markdown: string
  businessInfo: BusinessInfo
  services: PriceItem[]
  promos: PromoItem[]
  error?: string
}

const EXTRACT_PROMPT = `Extract all information about this business. Return:
- businessInfo: { name, phone, address, hours (e.g. "Mon-Sat 9am-6pm"), description (1 sentence) }
- services: list every service and price mentioned. Each item: { service (name), price (formatted, e.g. "$50"), price_numeric (number or null if not listed) }
- promos: any special offers, discounts or promotions. Each: { type (e.g. "first visit discount"), description }
Include packages, bundles, and individual services. If no price shown, use "POA" and null for price_numeric.`

export async function scrapeUrl(url: string): Promise<StructuredScrapeResult> {
  const empty: StructuredScrapeResult = {
    success: false,
    markdown: '',
    businessInfo: { name: null, phone: null, address: null, hours: null, description: null },
    services: [],
    promos: [],
  }

  try {
    const result = await getFirecrawl().scrape(url, {
      formats: ['markdown', 'json'],
      jsonOptions: {
        prompt: EXTRACT_PROMPT,
        schema: {
          type: 'object' as const,
          properties: {
            businessInfo: {
              type: 'object' as const,
              properties: {
                name: { type: 'string' as const },
                phone: { type: 'string' as const },
                address: { type: 'string' as const },
                hours: { type: 'string' as const },
                description: { type: 'string' as const },
              },
            },
            services: {
              type: 'array' as const,
              items: {
                type: 'object' as const,
                properties: {
                  service: { type: 'string' as const },
                  price: { type: 'string' as const },
                  price_numeric: { type: 'number' as const },
                },
                required: ['service', 'price'],
              },
            },
            promos: {
              type: 'array' as const,
              items: {
                type: 'object' as const,
                properties: {
                  type: { type: 'string' as const },
                  description: { type: 'string' as const },
                },
                required: ['type', 'description'],
              },
            },
          },
        } satisfies Record<string, unknown>,
      },
    })

    type ExtractedData = {
      businessInfo?: Partial<BusinessInfo>
      services?: Array<{ service?: string; price?: string; price_numeric?: number | null }>
      promos?: Array<{ type?: string; description?: string }>
    }

    const markdown = (result as { markdown?: string }).markdown ?? ''
    const extracted = ((result as { json?: ExtractedData }).json ?? {}) as ExtractedData

    const businessInfo: BusinessInfo = {
      name: extracted.businessInfo?.name ?? null,
      phone: extracted.businessInfo?.phone ?? null,
      address: extracted.businessInfo?.address ?? null,
      hours: extracted.businessInfo?.hours ?? null,
      description: extracted.businessInfo?.description ?? null,
    }

    const services: PriceItem[] = (extracted.services ?? []).map(s => ({
      service: s.service ?? 'Unknown service',
      price: s.price ?? 'POA',
      price_numeric: s.price_numeric ?? null,
    }))

    const promos: PromoItem[] = (extracted.promos ?? []).map(p => ({
      type: p.type ?? 'Promotion',
      description: p.description ?? '',
    }))

    // Scrape succeeded as long as we got markdown (structured data is a bonus)
    if (!markdown && services.length === 0) {
      return { ...empty, error: 'No content returned from scrape' }
    }

    return { success: true, markdown, businessInfo, services, promos }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown scrape error'
    console.error('[Firecrawl] scrapeUrl failed:', message)
    return { ...empty, error: message }
  }
}

export interface ReviewResult {
  success: boolean
  content: string
  sources: string[]
}

export async function scrapeReviews(
  competitorName: string,
  competitorUrl: string,
): Promise<ReviewResult> {
  const hostname = competitorUrl.replace(/^https?:\/\//, '').replace('www.', '').split('/')[0]
  const query = `${competitorName || hostname} customer reviews`

  try {
    const searchResult = await getFirecrawl().search(query, {
      limit: 5,
      scrapeOptions: { formats: ['markdown'] },
    })

    type SearchDoc = { url?: string; markdown?: string }
    const docs: SearchDoc[] = (searchResult as { data?: SearchDoc[] }).data ?? []

    if (!docs.length) return { success: false, content: '', sources: [] }

    const reviewSources = ['google', 'yelp', 'tripadvisor', 'trustpilot', 'facebook', 'reviews']
    const reviewDocs = docs
      .filter(d => reviewSources.some(s => (d.url ?? '').toLowerCase().includes(s)))
      .slice(0, 3)

    const docsToUse = reviewDocs.length > 0 ? reviewDocs : docs.slice(0, 3)
    const combinedContent = docsToUse
      .map(d => `Source: ${d.url}\n${(d.markdown ?? '').slice(0, 2000)}`)
      .join('\n\n---\n\n')
    const sources = docsToUse.map(d => d.url ?? '').filter(Boolean)

    return { success: true, content: combinedContent, sources }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Review search failed'
    console.warn('[Firecrawl] scrapeReviews failed:', message)
    return { success: false, content: '', sources: [] }
  }
}
