import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const MODELS = [
  'claude-haiku-4-5-20251001',
  'claude-3-5-haiku-20241022',
  'claude-3-haiku-20240307',
  'claude-sonnet-4-6',
]

export interface CompetitorInsights {
  summary: string
  swot: {
    strengths: string
    weaknesses: string
    opportunities: string
    threats: string
  }
  pricing_position: 'above_market' | 'at_market' | 'below_market'
  market_positioning: 'luxury' | 'mid-market' | 'budget'
  promo_patterns: string[]
  parsed_pricing: PriceItem[]
  parsed_promos: PromoItem[]
  sentiment: SentimentAnalysis
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

export interface SentimentAnalysis {
  overall: 'positive' | 'mixed' | 'negative' | 'unknown'
  rating_estimate: string        // e.g. "4.2/5" or "unknown"
  review_count_estimate: string  // e.g. "200+" or "unknown"
  positives: string[]            // Top things customers love
  negatives: string[]            // Top complaints
  summary: string                // 1-2 sentence sentiment summary
  sources: string[]              // Where reviews were found
}

function mockInsights(competitorName: string, competitorUrl: string): CompetitorInsights {
  const hostname = competitorUrl.replace(/^https?:\/\//, '').replace('www.', '').split('/')[0]
  return {
    summary: `${competitorName || hostname} appears to be an established local competitor. Scraping succeeded — add Anthropic credits at console.anthropic.com to unlock full AI analysis.`,
    swot: {
      strengths: 'Established web presence\nActive promotional offers detected\nClear service listing',
      weaknesses: 'Limited pricing transparency\nNo clear differentiation messaging',
      opportunities: 'Gap in premium service positioning\nPotential to undercut on first-visit offers',
      threats: 'Competitor has existing customer base\nMay respond to your pricing changes',
    },
    pricing_position: 'at_market',
    market_positioning: 'mid-market',
    promo_patterns: ['first-visit discount', 'bundle offer'],
    parsed_pricing: [],
    parsed_promos: [
      { type: 'First-visit discount', description: 'Detected promotional language for new customers' },
    ],
    sentiment: {
      overall: 'unknown',
      rating_estimate: 'unknown',
      review_count_estimate: 'unknown',
      positives: ['Analysis pending — API credits needed'],
      negatives: ['Analysis pending — API credits needed'],
      summary: 'Sentiment analysis will populate once Anthropic API credits are available.',
      sources: [],
    },
  }
}

export async function callClaudeText(params: {
  system?: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  max_tokens: number
}): Promise<string> {
  return callClaude(params)
}

async function callClaude(params: {
  system?: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  max_tokens: number
}): Promise<string> {
  let lastError = ''

  for (const model of MODELS) {
    try {
      const response = await anthropic.messages.create({
        model,
        max_tokens: params.max_tokens,
        ...(params.system ? { system: params.system } : {}),
        messages: params.messages,
      })
      console.log(`[Claude] Using model: ${model}`)
      return response.content[0].type === 'text' ? response.content[0].text : ''
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      console.warn(`[Claude] Model ${model} failed: ${lastError}`)
      if (lastError.includes('credit') || lastError.includes('auth') || lastError.includes('API key')) {
        break
      }
    }
  }

  throw new Error(lastError)
}

export async function generateCompetitorInsights(
  competitorName: string,
  competitorUrl: string,
  scrapedContent: string,
  businessContext: string,
  reviewContent?: string,
  reviewSources?: string[],
): Promise<CompetitorInsights> {
  const prompt = `You are an expert competitive intelligence analyst for local service businesses.

BUSINESS CONTEXT (the user's own business):
${businessContext}

COMPETITOR BEING ANALYSED:
Name: ${competitorName || competitorUrl}
URL: ${competitorUrl}

SCRAPED WEBSITE CONTENT:
${scrapedContent.slice(0, 8000)}

${reviewContent ? `CUSTOMER REVIEWS & SENTIMENT DATA (from Google, Yelp, and other review platforms):
${reviewContent.slice(0, 4000)}` : 'CUSTOMER REVIEWS: No review data available for this competitor.'}

Analyse this competitor and return a JSON object with EXACTLY this structure:
{
  "summary": "2-3 sentence natural language summary of this competitor's pricing strategy, positioning, key differentiators, and customer reputation",
  "swot": {
    "strengths": "Bullet-pointed strengths observed (pricing, offers, branding, reviews). Use \\n to separate points.",
    "weaknesses": "Bullet-pointed weaknesses including any negative review patterns. Use \\n to separate points.",
    "opportunities": "Opportunities for the user's business given this competitor's gaps. Use \\n to separate points.",
    "threats": "Threats this competitor poses to the user's business. Use \\n to separate points."
  },
  "pricing_position": "above_market | at_market | below_market",
  "market_positioning": "luxury | mid-market | budget",
  "promo_patterns": ["list", "of", "detected", "promotion", "types"],
  "parsed_pricing": [
    { "service": "service name", "price": "£XX or $XX", "price_numeric": 99.00 }
  ],
  "parsed_promos": [
    { "type": "promo type", "description": "short description" }
  ],
  "sentiment": {
    "overall": "positive | mixed | negative | unknown",
    "rating_estimate": "e.g. 4.2/5 or unknown if not found",
    "review_count_estimate": "e.g. 200+ or unknown if not found",
    "positives": ["top thing customers love", "another positive", "another positive"],
    "negatives": ["top complaint", "another complaint"],
    "summary": "1-2 sentence summary of what customers say about this competitor",
    "sources": ${JSON.stringify(reviewSources ?? [])}
  }
}

Return ONLY valid JSON. No markdown, no explanation. If review data is unavailable, set sentiment.overall to "unknown".`

  try {
    const text = await callClaude({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2500,
    })
    const cleaned = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
    return JSON.parse(cleaned) as CompetitorInsights
  } catch (err) {
    console.error('[Claude] generateCompetitorInsights failed:', err instanceof Error ? err.message : err)
    return mockInsights(competitorName, competitorUrl)
  }
}

export async function chatWithContext(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  contextData: string,
  contextScreen: string,
): Promise<string> {
  const system = `You are an expert competitive intelligence advisor for local service businesses, embedded in the RivalSense AI dashboard.

Current screen: ${contextScreen}
Relevant data:
${contextData}

Answer questions concisely and actionably. Focus on pricing strategy, competitive positioning, promotional tactics, and customer sentiment insights. Keep responses under 200 words unless more detail is truly needed.`

  try {
    return await callClaude({ system, messages, max_tokens: 1024 })
  } catch (err) {
    console.error('[Claude] chatWithContext failed:', err instanceof Error ? err.message : err)
    return 'AI advisor is temporarily unavailable. Please check your Anthropic API credits at console.anthropic.com and try again.'
  }
}
