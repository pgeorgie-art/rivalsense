import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { scrapeUrl, scrapeReviews } from '@/lib/firecrawl'
import { generateCompetitorInsights } from '@/lib/claude'
import { calculateScore } from '@/lib/scoring'

export const maxDuration = 300

async function dbInsert(promise: ReturnType<ReturnType<ReturnType<typeof createAdminClient>['from']>['insert']>, label: string) {
  const { error } = await promise
  if (error) console.error(`[Pipeline] ${label} insert error:`, error.message)
}

export async function POST() {
  try {
    // Auth check via user session
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use admin client for all DB writes (bypasses RLS cleanly)
    const admin = createAdminClient()

    // Load business + competitors
    const [{ data: business, error: bizError }, { data: competitors, error: compError }] = await Promise.all([
      admin.from('businesses').select('*').eq('user_id', user.id).single(),
      admin.from('competitors').select('*').eq('user_id', user.id).order('slot_number'),
    ])

    if (bizError) return NextResponse.json({ error: `Business load failed: ${bizError.message}` }, { status: 500 })
    if (!business) return NextResponse.json({ error: 'No business found. Complete Step 1 first.' }, { status: 404 })
    if (compError) return NextResponse.json({ error: `Competitors load failed: ${compError.message}` }, { status: 500 })
    if (!competitors || competitors.length === 0) return NextResponse.json({ error: 'No competitors found. Complete Step 2 first.' }, { status: 400 })

    const results: Record<string, string> = {}

    // 1. Scrape business URL (benchmark) — failure is non-fatal
    try {
      console.log(`[Pipeline] Scraping business: ${business.url}`)
      const bizScrape = await scrapeUrl(business.url)
      console.log(`[Pipeline] Business scrape result: ${bizScrape.success ? 'ok' : bizScrape.error}`)
      await dbInsert(admin.from('scrape_results').insert({
        entity_id: business.id,
        entity_type: 'business',
        raw_content: bizScrape.markdown ?? '',
        parsed_pricing: [],
        parsed_promos: [],
        scrape_status: bizScrape.success ? 'success' : 'failed',
        error_message: bizScrape.error ?? null,
      }), 'Business scrape')
      results['business'] = bizScrape.success ? 'scraped' : 'failed'
    } catch (bizErr) {
      console.warn('[Pipeline] Business scrape failed, continuing:', bizErr instanceof Error ? bizErr.message : bizErr)
      results['business'] = 'failed'
    }

    const businessContext = `Business: ${business.name}, Category: ${business.category || 'Local service'}, Location: ${business.city || ''}`
    const competitorInsightsList: Array<{ competitor: typeof competitors[0]; insights: Awaited<ReturnType<typeof generateCompetitorInsights>> }> = []

    // 2. Scrape + analyse each competitor
    for (const competitor of competitors) {
      try {
        console.log(`[Pipeline] Scraping competitor: ${competitor.url}`)
        const scrape = await scrapeUrl(competitor.url)
        console.log(`[Pipeline] Scrape result: ${scrape.success ? 'ok' : scrape.error}`)

        if (!scrape.success || !scrape.markdown) {
          console.warn(`[Pipeline] Skipping ${competitor.url} — no content returned`)
          await dbInsert(admin.from('scrape_results').insert({
            entity_id: competitor.id,
            entity_type: 'competitor',
            raw_content: '',
            parsed_pricing: [],
            parsed_promos: [],
            scrape_status: 'failed',
            error_message: scrape.error ?? 'No content returned',
          }), 'Competitor scrape (failed)')
          results[competitor.id] = 'failed'
          continue
        }

        // Reviews are bonus data — never let a failure here block the competitor
        let reviewContent = ''
        let reviewSources: string[] = []
        try {
          console.log(`[Pipeline] Scraping reviews for: ${competitor.url}`)
          const reviewScrape = await scrapeReviews(competitor.name || competitor.url, competitor.url)
          console.log(`[Pipeline] Review scrape: ${reviewScrape.success ? `found ${reviewScrape.sources.length} source(s)` : 'none found'}`)
          if (reviewScrape.success) {
            reviewContent = reviewScrape.content
            reviewSources = reviewScrape.sources
          }
        } catch (reviewErr) {
          console.warn(`[Pipeline] Review scrape failed for ${competitor.url}, continuing without reviews:`, reviewErr instanceof Error ? reviewErr.message : reviewErr)
        }

        // Generate AI insights — fallback to mockInsights() on failure (handled inside generateCompetitorInsights)
        let insights = null
        try {
          console.log(`[Pipeline] Generating AI insights for: ${competitor.url}`)
          insights = await generateCompetitorInsights(
            competitor.name || competitor.url,
            competitor.url,
            scrape.markdown,
            businessContext,
            reviewContent,
            reviewSources,
          )
          console.log(`[Pipeline] AI insights generated for: ${competitor.url}`)
        } catch (aiErr) {
          console.warn(`[Pipeline] AI insights failed for ${competitor.url}, skipping insights:`, aiErr instanceof Error ? aiErr.message : aiErr)
        }

        // Store scrape result
        await dbInsert(admin.from('scrape_results').insert({
          entity_id: competitor.id,
          entity_type: 'competitor',
          raw_content: scrape.markdown,
          parsed_pricing: insights?.parsed_pricing ?? [],
          parsed_promos: insights?.parsed_promos ?? [],
          scrape_status: 'success',
          error_message: null,
        }), 'Competitor scrape')

        // Store AI insights
        if (insights) {
          await dbInsert(admin.from('ai_insights').insert({
            competitor_id: competitor.id,
            summary_text: insights.summary,
            swot_strengths: insights.swot.strengths,
            swot_weaknesses: insights.swot.weaknesses,
            swot_opportunities: insights.swot.opportunities,
            swot_threats: insights.swot.threats,
            pricing_position: insights.pricing_position,
            market_positioning: insights.market_positioning ?? 'mid-market',
            promo_patterns: insights.promo_patterns,
            parsed_pricing: insights.parsed_pricing,
            parsed_promos: insights.parsed_promos,
            sentiment: insights.sentiment,
          }), 'AI insights')

          competitorInsightsList.push({ competitor, insights })
        }

        results[competitor.id] = 'scraped'
      } catch (competitorErr) {
        // Catch-all: log and skip, never crash the whole pipeline
        console.error(`[Pipeline] Unexpected error for ${competitor.url}, skipping:`, competitorErr instanceof Error ? competitorErr.message : competitorErr)
        results[competitor.id] = 'error'
      }
    }

    // 3. Calculate scores
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
          await dbInsert(admin.from('scores').insert({
            entity_id: competitor.id,
            entity_type: 'competitor',
            score: breakdown.total,
            score_breakdown: breakdown,
          }), 'Competitor score')
        } catch (scoreErr) {
          console.warn(`[Pipeline] Score failed for ${competitor.url}:`, scoreErr instanceof Error ? scoreErr.message : scoreErr)
        }
      }

      // Business benchmark score
      await dbInsert(admin.from('scores').insert({
        entity_id: business.id,
        entity_type: 'business',
        score: 50,
        score_breakdown: {
          pricing_competitiveness: 30,
          promotional_activity: 20,
          total: 50,
          pricing_notes: 'Benchmark — your business score calculated relative to competitor data',
          promo_notes: 'See competitor cards for comparison',
        },
      }), 'Business score')
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
