import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { scrapeUrl } from '@/lib/firecrawl'
import { generateCompetitorInsights } from '@/lib/claude'
import { calculateScore } from '@/lib/scoring'

export const maxDuration = 300

// This route can be called by a Vercel cron job or externally on a schedule.
// Vercel cron config is in vercel.json — runs weekly.
// Can also be triggered manually or via POST from the dashboard.

function detectChanges(
  prevPricing: Array<{service: string; price: string; price_numeric: number | null}>,
  newPricing: Array<{service: string; price: string; price_numeric: number | null}>,
  prevPromos: Array<{type: string; description: string}>,
  newPromos: Array<{type: string; description: string}>,
): { type: 'price_change' | 'new_promo' | 'content_change'; message: string }[] {
  const changes: { type: 'price_change' | 'new_promo' | 'content_change'; message: string }[] = []

  // Check for price changes
  for (const newItem of newPricing) {
    const prev = prevPricing.find(p => p.service === newItem.service)
    if (prev && prev.price_numeric !== null && newItem.price_numeric !== null) {
      if (Math.abs(prev.price_numeric - newItem.price_numeric) > 5) {
        const direction = newItem.price_numeric < prev.price_numeric ? 'dropped' : 'increased'
        changes.push({
          type: 'price_change',
          message: `${newItem.service} price ${direction} from ${prev.price} to ${newItem.price}`,
        })
      }
    } else if (!prev) {
      // New service detected
      changes.push({
        type: 'content_change',
        message: `New service detected: ${newItem.service} at ${newItem.price}`,
      })
    }
  }

  // Check for new promos
  const prevPromoTypes = new Set(prevPromos.map(p => p.type))
  for (const newPromo of newPromos) {
    if (!prevPromoTypes.has(newPromo.type)) {
      changes.push({
        type: 'new_promo',
        message: `New promotion detected: ${newPromo.type} — ${newPromo.description}`,
      })
    }
  }

  return changes
}

export async function POST(request: Request) {
  // Validate cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  // Get all users' competitors
  const { data: allCompetitors } = await supabase
    .from('competitors')
    .select('*, businesses!inner(name, category, city)')

  if (!allCompetitors || allCompetitors.length === 0) {
    return NextResponse.json({ message: 'No competitors to process' })
  }

  const results = []

  for (const competitor of allCompetitors) {
    // Get previous scrape result
    const { data: prevScrapes } = await supabase
      .from('scrape_results')
      .select('*')
      .eq('entity_id', competitor.id)
      .eq('entity_type', 'competitor')
      .order('scraped_at', { ascending: false })
      .limit(1)

    const prevScrape = prevScrapes?.[0]

    // Re-scrape
    const newScrape = await scrapeUrl(competitor.url)
    if (!newScrape.success || !newScrape.markdown) {
      await supabase.from('scrape_results').insert({
        entity_id: competitor.id,
        entity_type: 'competitor',
        raw_content: '',
        scrape_status: 'failed',
        error_message: newScrape.error,
      })
      continue
    }

    // Generate new insights
    const businessCtx = `Business category: ${competitor.businesses?.category ?? 'Local service'}, Location: ${competitor.businesses?.city ?? ''}`
    const newInsights = await generateCompetitorInsights(
      competitor.name || competitor.url,
      competitor.url,
      newScrape.markdown,
      businessCtx,
    )

    // Store new scrape
    await supabase.from('scrape_results').insert({
      entity_id: competitor.id,
      entity_type: 'competitor',
      raw_content: newScrape.markdown,
      parsed_pricing: newInsights.parsed_pricing,
      parsed_promos: newInsights.parsed_promos,
      scrape_status: 'success',
    })

    // Store new insights
    await supabase.from('ai_insights').insert({
      competitor_id: competitor.id,
      summary_text: newInsights.summary,
      swot_strengths: newInsights.swot.strengths,
      swot_weaknesses: newInsights.swot.weaknesses,
      swot_opportunities: newInsights.swot.opportunities,
      swot_threats: newInsights.swot.threats,
      pricing_position: newInsights.pricing_position,
      promo_patterns: newInsights.promo_patterns,
    })

    // Calculate new score
    const breakdown = calculateScore(
      newInsights.parsed_pricing,
      newInsights.parsed_promos,
      newInsights.pricing_position,
      [newInsights.parsed_pricing],
    )
    await supabase.from('scores').insert({
      entity_id: competitor.id,
      entity_type: 'competitor',
      score: breakdown.total,
      score_breakdown: breakdown,
    })

    // Detect changes vs previous scrape
    if (prevScrape) {
      const prevPricing = (prevScrape.parsed_pricing as Array<{service: string; price: string; price_numeric: number | null}>) ?? []
      const prevPromos = (prevScrape.parsed_promos as Array<{type: string; description: string}>) ?? []

      const changes = detectChanges(prevPricing, newInsights.parsed_pricing, prevPromos, newInsights.parsed_promos)

      for (const change of changes) {
        const competitorName = competitor.name || new URL(competitor.url).hostname.replace('www.', '')
        await supabase.from('alerts').insert({
          user_id: competitor.user_id,
          competitor_id: competitor.id,
          alert_type: change.type,
          message: `${competitorName}: ${change.message}`,
          is_read: false,
        })
      }

      results.push({ competitor: competitor.url, changes: changes.length })
    } else {
      results.push({ competitor: competitor.url, changes: 0, note: 'First scrape' })
    }
  }

  return NextResponse.json({ success: true, processed: results.length, results })
}

// GET for Vercel cron (cron jobs use GET)
export async function GET(request: Request) {
  return POST(request)
}
