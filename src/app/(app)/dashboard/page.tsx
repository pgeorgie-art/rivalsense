import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ScoreBadge from '@/components/score-badge'
import PricingChart from '@/components/pricing-chart'

function getPricingPositionLabel(pos: string | null) {
  if (pos === 'below_market') return { label: 'Below market', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' }
  if (pos === 'above_market') return { label: 'Premium', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' }
  return { label: 'At market', color: 'text-slate-400 bg-slate-400/10 border-slate-400/20' }
}

function getMarketPositioningLabel(pos: string | null) {
  if (pos === 'luxury') return { label: 'Luxury', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' }
  if (pos === 'budget') return { label: 'Budget', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' }
  if (pos === 'mid-market') return { label: 'Mid-market', color: 'text-slate-400 bg-slate-400/10 border-slate-400/20' }
  return null
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Load business
  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // If no business, redirect to onboarding
  if (!business) redirect('/onboarding/step-1')

  // Load competitors with their latest insights and scores
  const { data: competitors } = await supabase
    .from('competitors')
    .select('*')
    .eq('user_id', user.id)
    .order('slot_number')

  if (!competitors || competitors.length === 0) redirect('/onboarding/step-2')

  // Load latest AI insights per competitor
  const competitorIds = competitors.map(c => c.id)
  const { data: insights } = await supabase
    .from('ai_insights')
    .select('*')
    .in('competitor_id', competitorIds)
    .order('generated_at', { ascending: false })

  // Latest insight per competitor
  type Insight = NonNullable<typeof insights>[number]
  const insightMap = new Map<string, Insight>()
  for (const insight of insights ?? []) {
    if (!insightMap.has(insight.competitor_id)) insightMap.set(insight.competitor_id, insight)
  }

  // Load latest scores
  const allEntityIds = [business.id, ...competitorIds]
  const { data: scores } = await supabase
    .from('scores')
    .select('*')
    .in('entity_id', allEntityIds)
    .order('calculated_at', { ascending: false })

  type Score = NonNullable<typeof scores>[number]
  const scoreMap = new Map<string, Score>()
  for (const score of scores ?? []) {
    if (!scoreMap.has(score.entity_id)) scoreMap.set(score.entity_id, score)
  }

  // Load unread alerts
  const { data: alerts } = await supabase
    .from('alerts')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_read', false)
    .order('created_at', { ascending: false })

  const alertCompetitorIds = new Set((alerts ?? []).map(a => a.competitor_id))

  // Check if any competitors have been scraped at all
  const hasData = insightMap.size > 0

  // Detect currency symbol from scraped price strings
  function detectCurrency(insights: Map<string, { parsed_pricing?: unknown }>): string {
    for (const insight of insights.values()) {
      const pricing = (insight?.parsed_pricing as Array<{price?: string}> | null) ?? []
      for (const item of pricing) {
        if (!item.price) continue
        const match = item.price.match(/^([£$€¥₹₩₪฿])/)
        if (match) return match[1]
      }
    }
    return '$' // default fallback
  }
  const currencySymbol = detectCurrency(insightMap as Map<string, { parsed_pricing?: unknown }>)

  // Build chart data
  const chartData = competitors.map(c => {
    const insight = insightMap.get(c.id)
    const pricing = (insight?.parsed_pricing as Array<{service: string; price_numeric: number | null}> | null) ?? []
    const prices = pricing.map(p => p.price_numeric).filter((n): n is number => n !== null)
    const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null
    return { name: c.name || new URL(c.url).hostname.replace('www.', ''), avg }
  }).filter(d => d.avg !== null)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Competitor Intelligence</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Tracking {competitors.length} competitor{competitors.length !== 1 ? 's' : ''} for {business.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasData && (
            <>
              <Link href="/compare"
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-400 hover:text-white border border-slate-600 hover:border-slate-500 rounded-lg transition-colors">
                Compare
              </Link>
              <Link href="/report"
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-400 hover:text-white border border-slate-600 hover:border-slate-500 rounded-lg transition-colors">
                Report
              </Link>
            </>
          )}
          {competitors.length < 5 && (
            <Link href="/settings"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-400 border border-blue-500/30 hover:border-blue-500 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add competitor
            </Link>
          )}
        </div>
      </div>

      {/* Alerts banner */}
      {(alerts ?? []).length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <div className="flex-1">
              <p className="text-amber-400 text-sm font-semibold mb-1">
                {(alerts ?? []).length} new competitor change{(alerts ?? []).length !== 1 ? 's' : ''} detected
              </p>
              <div className="space-y-1">
                {(alerts ?? []).slice(0, 3).map(alert => (
                  <p key={alert.id} className="text-amber-300/80 text-xs">{alert.message}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {!hasData ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Analysis in progress</h2>
          <p className="text-slate-400 text-sm mb-4">Your competitors are being analysed. This can take a few minutes.</p>
          <Link href="/onboarding/step-3"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Check progress
          </Link>
        </div>
      ) : (
        <>
          {/* Your business card */}
          <div className="bg-gradient-to-r from-blue-900/30 to-slate-800 border border-blue-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Your Business · Benchmark</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">{business.name}</h2>
                <p className="text-slate-400 text-sm">{business.category} · {business.city}</p>
              </div>
              <ScoreBadge score={scoreMap.get(business.id)?.score ?? 50}
                breakdown={scoreMap.get(business.id)?.score_breakdown} />
            </div>
          </div>

          {/* Competitor cards grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {competitors.map(competitor => {
              const insight = insightMap.get(competitor.id)
              const score = scoreMap.get(competitor.id)
              const hasAlert = alertCompetitorIds.has(competitor.id)
              const posLabel = getPricingPositionLabel(insight?.pricing_position ?? null)
              const mktLabel = getMarketPositioningLabel(insight?.market_positioning ?? null)
              const promoPatterns = (insight?.promo_patterns as string[] | null) ?? []

              return (
                <Link key={competitor.id} href={`/competitor/${competitor.id}`}
                  className="group bg-slate-800 hover:bg-slate-800/80 border border-slate-700 hover:border-slate-600 rounded-2xl p-5 transition-all relative block">
                  {hasAlert && (
                    <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-slate-800" />
                  )}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0 pr-3">
                      <h3 className="font-semibold text-white text-sm truncate">
                        {competitor.name || new URL(competitor.url).hostname.replace('www.', '')}
                      </h3>
                      <p className="text-slate-500 text-xs truncate">{competitor.url.replace(/^https?:\/\//, '').replace('www.', '')}</p>
                    </div>
                    <ScoreBadge score={score?.score ?? 0} size="sm" breakdown={score?.score_breakdown} />
                  </div>

                  {insight ? (
                    <>
                      <p className="text-slate-300 text-xs leading-relaxed line-clamp-2 mb-3">
                        {insight.summary_text}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${posLabel.color}`}>
                          {posLabel.label}
                        </span>
                        {mktLabel && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${mktLabel.color}`}>
                            {mktLabel.label}
                          </span>
                        )}
                        {promoPatterns.slice(0, 1).map((p, i) => (
                          <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-700 text-slate-300 border border-slate-600">
                            {p}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-500 text-xs">
                      <div className="w-3 h-3 rounded-full border-2 border-slate-500 border-t-transparent animate-spin" />
                      Analysis pending…
                    </div>
                  )}

                  <div className="mt-3 flex items-center text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    View full analysis →
                  </div>
                </Link>
              )
            })}

            {/* Empty slots */}
            {competitors.length < 5 && Array.from({ length: 5 - competitors.length }).map((_, i) => (
              <Link key={`empty-${i}`} href="/settings"
                className="bg-slate-800/30 border border-dashed border-slate-700 hover:border-slate-600 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 text-slate-600 hover:text-slate-400 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-xs">Add competitor</span>
              </Link>
            ))}
          </div>

          {/* Pricing comparison chart */}
          {chartData.length > 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
              <h2 className="text-base font-semibold text-white mb-1">Average Pricing Comparison</h2>
              <p className="text-slate-400 text-xs mb-4">Average service prices across all tracked competitors</p>
              <PricingChart data={chartData} currency={currencySymbol} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
