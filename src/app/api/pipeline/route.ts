import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { scrapeUrl, scrapeReviews } from '@/lib/firecrawl'
import { generateCompetitorInsights } from '@/lib/claude'
import { calculateScore } from '@/lib/scoring'

export const maxDuration = 300

type AdminClient = ReturnType<typeof createAdminClient>

async function dbInsert(
  promise: ReturnType<ReturnType<AdminClient['from']>['insert']>,
  label: string,
) {
  const { error } = await promise
  if (error) console.error(`[Pipeline] ${label} insert error:`, error.message)
}

export async function POST() {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

    const [{ data: business, error: bizError }, { data: competitors, error: compError }] = await Promise.all([
      admin.from('businesses').select('*').eq('user_id', user.id).single(),
      admin.from('competitors').select('*').eq('user_id', user.id).order('slot_number'),
    ])

    if (bizError) return NextResponse.json({ error: `Business load failed: ${bizError.message}` }, { status: 500 })
    if (!business) return NextResponse.json({ error: 'No business found. Complete Step 1 first.' }, { status: 404 })
    if (compError) return NextResponse.json({ error: `Competitors load failed: ${compError.message}` }, { status: 500 })
    if (!competitors || competitors.length === 0) {
      return NextResponse.json({ error: 'No competitors found. Complete Step 2 first.' }, { status: 400 })
    }

    const results: Record<string, string> = {}

    // 1. Scrape the user's own business (benchmark only, failure is non-fatal)
    try {
      console.log(`[Pipeline] Scraping business: ${business.url}`)
      const bizScrape = await scrapeUrl(business.url)
      console.log(`[Pipeline] Business scrape: ${bizScrape.success ? 'ok' : bizScrape.error}`)
      await dbInsert(
        admin.from('scrape_results').insert({
          entity_id: business.id,
          entity_type: 'business',
          raw_content: bizScrape.markdown,
          parsed_pricing: bizScrape.services,
          parsed_promos: bizScrape.promos,
          scrape_status: bizScrape.success ? 'success' : 'failed',
          error_message: bizScrape.error ?? null,
        }),
        'Business scrape',
      )
      results['business'] = bizScrape.success ? 'scraped' : 'failed'
    } catch (bizErr) {
      console.warn('[Pipeline] Business scrape failed, continuing:', bizErr instanceof Error ? bizErr.message : bizErr)
      results['business'] = 'failed'
    }

    const businessContext = `Business: ${business.name}, Category: ${business.category || 'Local service'}, Location: ${business.city || ''}`
    type Competitor = NonNullable<typeof competitors>[number]
    type InsightEntry = { competitor: Competitor; insights: Awaited<ReturnType<typeof generateCompetitorInsights>> }
    const competitorInsightsList: InsightEntry[] = []

    // 2. Scrape + analyse each competitor
    for (const competitor of competitors) {
      try {
        console.log(`[Pipeline] Scraping competitor: ${competitor.url}`)
        const scrape = await scrapeUrl(competitor.url)
        console.log(`[Pipeline] Scrape: ${scrape.success ? `ok (${scrape.services.length} services, ${scrape.promos.length} promos)` : scrape.error}`)

        if (!scrape.success) {
          console.warn(`[Pipeline] Skipping ${competitor.url} — scrape failed`)
          await dbInsert(
            admin.from('scrape_results').insert({
              entity_id: competitor.id,
              entity_type: 'competitor',
              raw_content: '',
              parsed_pricing: [],
              parsed_promos: [],
              scrape_status: 'failed',
              error_message: scrape.error ?? 'Scrape returned no content',
            }),
            'Competitor scrape (failed)',
          )
          results[competitor.id] = 'failed'
          continue
        }

        // Collect reviews — never block on failure
        let reviewContent = ''
        let reviewSources: string[] = []
        try {
          console.log(`[Pipeline] Scraping reviews for: ${competitor.url}`)
          const reviewScrape = await scrapeReviews(competitor.name || competitor.url, competitor.url)
          if (reviewScrape.success) {
            reviewContent = reviewScrape.content
            reviewSources = reviewScrape.sources
            console.log(`[Pipeline] Reviews found from ${reviewSources.length} source(s)`)
          } else {
            console.log(`[Pipeline] No reviews found for ${competitor.url}`)
          }
        } catch (reviewErr) {
          console.warn(`[Pipeline] Review scrape failed for ${competitor.url}:`, reviewErr instanceof Error ? reviewErr.message : reviewErr)
        }

        // Build a rich context string for Claude from Firecrawl's structured extraction
        const structuredContext = scrape.services.length > 0
          ? `\nSTRUCTURED SERVICES & PRICING (extracted by Firecrawl):\n${scrape.services.map(s => `- ${s.service}: ${s.price}`).join('\n')}`
          : ''

        const promoContext = scrape.promos.length > 0
          ? `\nDETECTED PROMOTIONS:\n${scrape.promos.map(p => `- ${p.type}: ${p.description}`).join('\n')}`
          : ''

        const businessInfoContext = scrape.businessInfo.name
          ? `\nBUSINESS INFO: ${[
              scrape.businessInfo.name,
              scrape.businessInfo.address,
              scrape.businessInfo.phone,
              scrape.businessInfo.hours,
            ].filter(Boolean).join(' | ')}`
          : ''

        const enrichedMarkdown = `${scrape.markdown}${structuredContext}${promoContext}${businessInfoContext}`

        // Generate Claude insights using enriched content
        let insights = null
        try {
          console.log(`[Pipeline] Generating AI insights for: ${competitor.url}`)
          insights = await generateCompetitorInsights(
            competitor.name || competitor.url,
            competitor.url,
            enrichedMarkdown,
            businessContext,
            reviewContent,
            reviewSources,
          )
          console.log(`[Pipeline] AI insights generated for: ${competitor.url}`)
        } catch (aiErr) {
          console.warn(`[Pipeline] AI insights failed for ${competitor.url}:`, aiErr instanceof Error ? aiErr.message : aiErr)
        }

        // Merge Firecrawl structured data with Claude's parsed_pricing (prefer Firecrawl if available)
        const mergedPricing = insights?.parsed_pricing && insights.parsed_pricing.length > 0
          ? insights.parsed_pricing
          : scrape.services

        const mergedPromos = insights?.parsed_promos && insights.parsed_promos.length > 0
          ? insights.parsed_promos
          : scrape.promos

        // Store scrape result with structured data
        await dbInsert(
          admin.from('scrape_results').insert({
            entity_id: competitor.id,
            entity_type: 'competitor',
            raw_content: scrape.markdown,
            parsed_pricing: mergedPricing,
            parsed_promos: mergedPromos,
            scrape_status: 'success',
            error_message: null,
          }),
          'Competitor scrape',
        )

        // Store AI insights
        if (insights) {
          await dbInsert(
            admin.from('ai_insights').insert({
              competitor_id: competitor.id,
              summary_text: insights.summary,
              swot_strengths: insights.swot.strengths,
              swot_weaknesses: insights.swot.weaknesses,
              swot_opportunities: insights.swot.opportunities,
              swot_threats: insights.swot.threats,
              pricing_position: insights.pricing_position,
              market_positioning: insights.market_positioning ?? 'mid-market',
              promo_patterns: insights.promo_patterns,
              parsed_pricing: mergedPricing,
              parsed_promos: mergedPromos,
              sentiment: insights.sentiment,
            }),
            'AI insights',
          )
          competitorInsightsList.push({ competitor, insights: { ...insights, parsed_pricing: mergedPricing, parsed_promos: mergedPromos } })
        }

        results[competitor.id] = 'scraped'
      } catch (competitorErr) {
        console.error(`[Pipeline] Unexpected error for ${competitor.url}:`, competitorErr instanceof Error ? competitorErr.message : competitorErr)
        results[competitor.id] = 'error'
      }
    }

    // 3. Calculate competitive scores
    try {
      const allCompetitorPricing = competitorInsightsList.map(c => c.insights.parsed_pricing)

      for (const { competitor, insights } of competitorInsightsList) {
        try {
          const breakdown = calculateScore(
            insights.parsed_pricing,
            insights.parsed_promos,
            insights.pricing_position,
            allCompetitorPricing,
          )
          await dbInsert(
            admin.from('scores').insert({
              entity_id: competitor.id,
              entity_type: 'competitor',
              score: breakdown.total,
              score_breakdown: breakdown,
            }),
            'Competitor score',
          )
        } catch (scoreErr) {
          console.warn(`[Pipeline] Score failed for ${competitor.url}:`, scoreErr instanceof Error ? scoreErr.message : scoreErr)
        }
      }

      // Business benchmark score (static 50 — relative to competitors)
      await dbInsert(
        admin.from('scores').insert({
          entity_id: business.id,
          entity_type: 'business',
          score: 50,
          score_breakdown: {
            pricing_competitiveness: 30,
            promotional_activity: 20,
            total: 50,
            pricing_notes: 'Benchmark — your business score is relative to competitor data',
            promo_notes: 'See competitor cards for comparison',
          },
        }),
        'Business score',
      )
    } catch (scoringErr) {
      console.warn('[Pipeline] Scoring phase failed:', scoringErr instanceof Error ? scoringErr.message : scoringErr)
    }

    console.log('[Pipeline] Complete:', results)
    return NextResponse.json({ success: true, results })

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[Pipeline] Fatal error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
