import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ScoreBadge from '@/components/score-badge'

function positionLabel(pos: string | null) {
  if (pos === 'above_market') return { text: 'Premium', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' }
  if (pos === 'below_market') return { text: 'Value', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' }
  return { text: 'At market', color: 'text-slate-300 bg-slate-700/50 border-slate-600' }
}

function marketLabel(pos: string | null) {
  if (pos === 'luxury') return { text: 'Luxury', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' }
  if (pos === 'budget') return { text: 'Budget', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' }
  return { text: 'Mid-market', color: 'text-slate-300 bg-slate-700/50 border-slate-600' }
}

function sentimentLabel(overall: string | null) {
  if (overall === 'positive') return { text: 'Positive', color: 'text-blue-400', icon: '😊' }
  if (overall === 'negative') return { text: 'Negative', color: 'text-red-400', icon: '😟' }
  if (overall === 'mixed') return { text: 'Mixed', color: 'text-amber-400', icon: '😐' }
  return { text: 'Unknown', color: 'text-slate-500', icon: '❓' }
}

export default async function ComparePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!business) redirect('/onboarding/step-1')

  const { data: competitors } = await supabase
    .from('competitors')
    .select('*')
    .eq('user_id', user.id)
    .order('slot_number')

  if (!competitors || competitors.length === 0) redirect('/onboarding/step-2')

  const competitorIds = competitors.map(c => c.id)

  const { data: insights } = await supabase
    .from('ai_insights')
    .select('*')
    .in('competitor_id', competitorIds)
    .order('generated_at', { ascending: false })

  type Insight = NonNullable<typeof insights>[number]
  const insightMap = new Map<string, Insight>()
  for (const insight of insights ?? []) {
    if (!insightMap.has(insight.competitor_id)) insightMap.set(insight.competitor_id, insight)
  }

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

  return (
    <div className="space-y-6 max-w-6xl">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-white">Side-by-Side Comparison</h1>
        <p className="text-slate-400 text-sm mt-1">Compare all competitors across key metrics</p>
      </div>

      {/* Overview table */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/50">
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-5 py-3 min-w-[200px]">Metric</th>
                {competitors.map(c => (
                  <th key={c.id} className="text-left text-xs font-semibold text-slate-300 px-4 py-3 min-w-[180px]">
                    <Link href={`/competitor/${c.id}`} className="hover:text-blue-400 transition-colors">
                      {c.name || new URL(c.url).hostname.replace('www.', '')}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {/* Score */}
              <tr>
                <td className="px-5 py-3.5 text-sm text-slate-400 font-medium">Market Score</td>
                {competitors.map(c => {
                  const score = scoreMap.get(c.id)
                  return (
                    <td key={c.id} className="px-4 py-3.5">
                      <ScoreBadge score={score?.score ?? 0} size="sm" breakdown={score?.score_breakdown} />
                    </td>
                  )
                })}
              </tr>

              {/* Pricing position */}
              <tr className="bg-slate-900/20">
                <td className="px-5 py-3.5 text-sm text-slate-400 font-medium">Pricing Position</td>
                {competitors.map(c => {
                  const insight = insightMap.get(c.id)
                  const label = positionLabel(insight?.pricing_position ?? null)
                  return (
                    <td key={c.id} className="px-4 py-3.5">
                      {insight ? (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${label.color}`}>
                          {label.text}
                        </span>
                      ) : <span className="text-slate-600 text-xs">—</span>}
                    </td>
                  )
                })}
              </tr>

              {/* Market positioning */}
              <tr>
                <td className="px-5 py-3.5 text-sm text-slate-400 font-medium">Market Segment</td>
                {competitors.map(c => {
                  const insight = insightMap.get(c.id)
                  const label = marketLabel(insight?.market_positioning ?? null)
                  return (
                    <td key={c.id} className="px-4 py-3.5">
                      {insight ? (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${label.color}`}>
                          {label.text}
                        </span>
                      ) : <span className="text-slate-600 text-xs">—</span>}
                    </td>
                  )
                })}
              </tr>

              {/* Customer sentiment */}
              <tr className="bg-slate-900/20">
                <td className="px-5 py-3.5 text-sm text-slate-400 font-medium">Customer Sentiment</td>
                {competitors.map(c => {
                  const insight = insightMap.get(c.id)
                  const sentiment = insight?.sentiment as { overall?: string; rating_estimate?: string } | null
                  const label = sentimentLabel(sentiment?.overall ?? null)
                  return (
                    <td key={c.id} className="px-4 py-3.5">
                      {insight ? (
                        <div className="flex items-center gap-1.5">
                          <span>{label.icon}</span>
                          <span className={`text-xs font-medium ${label.color}`}>{label.text}</span>
                          {sentiment?.rating_estimate && sentiment.rating_estimate !== 'unknown' && (
                            <span className="text-slate-500 text-xs">· {sentiment.rating_estimate}</span>
                          )}
                        </div>
                      ) : <span className="text-slate-600 text-xs">—</span>}
                    </td>
                  )
                })}
              </tr>

              {/* Active promotions */}
              <tr>
                <td className="px-5 py-3.5 text-sm text-slate-400 font-medium">Promotions Detected</td>
                {competitors.map(c => {
                  const insight = insightMap.get(c.id)
                  const promos = (insight?.promo_patterns as string[] | null) ?? []
                  return (
                    <td key={c.id} className="px-4 py-3.5">
                      {insight ? (
                        promos.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {promos.slice(0, 2).map((p, i) => (
                              <span key={i} className="px-1.5 py-0.5 bg-slate-700 text-slate-300 text-xs rounded">
                                {p}
                              </span>
                            ))}
                            {promos.length > 2 && (
                              <span className="text-slate-500 text-xs">+{promos.length - 2}</span>
                            )}
                          </div>
                        ) : <span className="text-slate-500 text-xs">None detected</span>
                      ) : <span className="text-slate-600 text-xs">—</span>}
                    </td>
                  )
                })}
              </tr>

              {/* Price range */}
              <tr className="bg-slate-900/20">
                <td className="px-5 py-3.5 text-sm text-slate-400 font-medium">Services Found</td>
                {competitors.map(c => {
                  const insight = insightMap.get(c.id)
                  const pricing = (insight?.parsed_pricing as Array<{service: string; price: string}> | null) ?? []
                  return (
                    <td key={c.id} className="px-4 py-3.5">
                      {insight ? (
                        <span className="text-slate-300 text-xs">{pricing.length} service{pricing.length !== 1 ? 's' : ''} found</span>
                      ) : <span className="text-slate-600 text-xs">—</span>}
                    </td>
                  )
                })}
              </tr>

              {/* Summary */}
              <tr>
                <td className="px-5 py-3.5 text-sm text-slate-400 font-medium align-top pt-4">Summary</td>
                {competitors.map(c => {
                  const insight = insightMap.get(c.id)
                  return (
                    <td key={c.id} className="px-4 py-3.5 align-top">
                      {insight?.summary_text ? (
                        <p className="text-slate-300 text-xs leading-relaxed line-clamp-3">{insight.summary_text}</p>
                      ) : (
                        <span className="text-slate-600 text-xs">Analysis pending…</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Pricing comparison detail */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
        <h2 className="text-base font-semibold text-white mb-4">Pricing Details</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {competitors.map(c => {
            const insight = insightMap.get(c.id)
            const pricing = (insight?.parsed_pricing as Array<{service: string; price: string}> | null) ?? []
            const name = c.name || new URL(c.url).hostname.replace('www.', '')
            return (
              <div key={c.id} className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
                <h3 className="text-sm font-semibold text-white mb-3 truncate">{name}</h3>
                {pricing.length > 0 ? (
                  <ul className="space-y-1.5">
                    {pricing.slice(0, 5).map((item, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-400 truncate">{item.service}</span>
                        <span className="text-blue-400 font-medium whitespace-nowrap">{item.price}</span>
                      </li>
                    ))}
                    {pricing.length > 5 && (
                      <li className="text-xs text-slate-500 text-center pt-1">+{pricing.length - 5} more</li>
                    )}
                  </ul>
                ) : (
                  <p className="text-slate-500 text-xs">{insight ? 'No pricing detected' : 'Analysis pending…'}</p>
                )}
                <Link href={`/competitor/${c.id}`}
                  className="mt-3 block text-xs text-blue-400 hover:text-blue-300 transition-colors">
                  View full analysis →
                </Link>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
