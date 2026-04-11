import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'

interface SentimentData {
  overall: string
  rating_estimate: string
  positives: string[]
  negatives: string[]
  summary: string
}

function positionLabel(pos: string | null) {
  if (pos === 'above_market') return { text: 'Premium', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' }
  if (pos === 'below_market') return { text: 'Value', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' }
  return { text: 'At market', color: 'text-slate-300 bg-slate-700/50 border-slate-600' }
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  // Look up share link
  const { data: shareLink } = await admin
    .from('share_links')
    .select('competitor_id, user_id, created_at')
    .eq('token', token)
    .single()

  if (!shareLink) notFound()

  // Load competitor
  const { data: competitor } = await admin
    .from('competitors')
    .select('*')
    .eq('id', shareLink.competitor_id)
    .single()

  if (!competitor) notFound()

  // Load latest insight
  const { data: insights } = await admin
    .from('ai_insights')
    .select('*')
    .eq('competitor_id', shareLink.competitor_id)
    .order('generated_at', { ascending: false })
    .limit(1)

  const insight = insights?.[0]

  // Load score
  const { data: scores } = await admin
    .from('scores')
    .select('score, score_breakdown')
    .eq('entity_id', shareLink.competitor_id)
    .order('calculated_at', { ascending: false })
    .limit(1)

  const score = scores?.[0]

  const competitorName = competitor.name || new URL(competitor.url).hostname.replace('www.', '')
  const posLabel = positionLabel(insight?.pricing_position ?? null)
  const promoPatterns = (insight?.promo_patterns as string[] | null) ?? []
  const parsedPricing = (insight?.parsed_pricing as Array<{service: string; price: string}> | null) ?? []
  const sentiment = (insight?.sentiment as SentimentData | null)

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header bar */}
      <div className="border-b border-slate-800 bg-slate-900">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-white flex items-center justify-center p-0.5">
              <img src="/logo.jpg" alt="RivalSense AI" className="w-full h-full object-contain" />
            </div>
            <span className="text-white text-sm font-semibold">Rival<span className="text-red-500">Sense</span> <span className="text-slate-400 font-normal">AI</span></span>
          </div>
          <span className="text-slate-500 text-xs">Shared competitive intelligence</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-white truncate">{competitorName}</h1>
                <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${posLabel.color}`}>
                  {posLabel.text}
                </span>
              </div>
              <a href={competitor.url} target="_blank" rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
                {competitor.url.replace(/^https?:\/\//, '').replace('www.', '')} ↗
              </a>
            </div>
            {score && (
              <div className="flex-shrink-0 text-center">
                <div className="w-14 h-14 rounded-full bg-slate-700 border-2 border-blue-500 flex items-center justify-center">
                  <span className="text-blue-400 font-bold text-lg">{score.score}</span>
                </div>
                <p className="text-slate-500 text-xs mt-1">Score</p>
              </div>
            )}
          </div>

          {insight?.summary_text && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <p className="text-slate-300 text-sm leading-relaxed">{insight.summary_text}</p>
            </div>
          )}
        </div>

        {/* Promotions */}
        {promoPatterns.length > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <h2 className="text-base font-semibold text-white mb-3">Promotion Tactics</h2>
            <div className="flex flex-wrap gap-2">
              {promoPatterns.map((p, i) => (
                <span key={i} className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-slate-300 text-sm">
                  🎯 {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Pricing */}
        {parsedPricing.length > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <h2 className="text-base font-semibold text-white mb-4">Pricing Breakdown</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left text-slate-400 font-medium pb-2 text-xs">Service</th>
                  <th className="text-right text-slate-400 font-medium pb-2 text-xs">Listed Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {parsedPricing.map((item, i) => (
                  <tr key={i}>
                    <td className="py-2 text-slate-200 text-xs">{item.service}</td>
                    <td className="py-2 text-right text-blue-400 font-medium text-xs">{item.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Sentiment */}
        {sentiment && sentiment.overall !== 'unknown' && (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <h2 className="text-base font-semibold text-white mb-3">Customer Sentiment</h2>
            {sentiment.summary && (
              <p className="text-slate-300 text-sm leading-relaxed mb-4">{sentiment.summary}</p>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              {sentiment.positives?.length > 0 && (
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-blue-400 mb-2">👍 What customers love</h3>
                  <ul className="space-y-1">
                    {sentiment.positives.slice(0, 3).map((p, i) => (
                      <li key={i} className="text-slate-300 text-xs flex items-start gap-1.5">
                        <span className="text-blue-400 mt-0.5">•</span> {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {sentiment.negatives?.length > 0 && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-red-400 mb-2">👎 Common complaints</h3>
                  <ul className="space-y-1">
                    {sentiment.negatives.slice(0, 3).map((n, i) => (
                      <li key={i} className="text-slate-300 text-xs flex items-start gap-1.5">
                        <span className="text-red-400 mt-0.5">•</span> {n}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SWOT */}
        {insight && (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <h2 className="text-base font-semibold text-white mb-4">SWOT Analysis</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { title: 'Strengths', content: insight.swot_strengths, icon: '💪', border: 'border-blue-500/20' },
                { title: 'Weaknesses', content: insight.swot_weaknesses, icon: '⚠️', border: 'border-red-500/20' },
                { title: 'Opportunities', content: insight.swot_opportunities, icon: '🚀', border: 'border-blue-500/20' },
                { title: 'Threats', content: insight.swot_threats, icon: '🔥', border: 'border-amber-500/20' },
              ].map(({ title, content, icon, border }) => {
                const lines = content?.split('\n').filter(Boolean) ?? []
                return (
                  <div key={title} className={`bg-slate-900/50 rounded-xl p-4 border ${border}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span>{icon}</span>
                      <h3 className="text-sm font-semibold text-white">{title}</h3>
                    </div>
                    <ul className="space-y-1.5">
                      {lines.map((line: string, i: number) => (
                        <li key={i} className="text-slate-300 text-xs flex items-start gap-1.5">
                          <span className="mt-1 flex-shrink-0">•</span>
                          <span>{line.replace(/^[•\-*]\s*/, '')}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!insight && (
          <div className="bg-slate-800/50 border border-dashed border-slate-700 rounded-2xl p-10 text-center">
            <p className="text-slate-400 text-sm">Analysis is still being generated. Check back shortly.</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-4 pb-2">
          <p className="text-slate-600 text-xs">
            Powered by <span className="text-slate-500 font-medium">Rival<span className="text-red-500">Sense</span> AI</span> · AI-powered competitor intelligence
          </p>
        </div>
      </div>
    </div>
  )
}
