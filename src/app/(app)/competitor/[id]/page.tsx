import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import ScoreBadge from '@/components/score-badge'
import PricingChart from '@/components/pricing-chart'
import ShareButton from '@/components/share-button'

interface SentimentData {
  overall: string
  rating_estimate: string
  review_count_estimate: string
  positives: string[]
  negatives: string[]
  summary: string
  sources: string[]
}

function SentimentSection({ sentiment }: { sentiment: SentimentData }) {
  const overallConfig: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    positive: { label: 'Positive', color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20', icon: '😊' },
    mixed:    { label: 'Mixed',    color: 'text-amber-400',   bg: 'bg-amber-400/10 border-amber-400/20',   icon: '😐' },
    negative: { label: 'Negative', color: 'text-red-400',     bg: 'bg-red-400/10 border-red-400/20',       icon: '😟' },
    unknown:  { label: 'Unknown',  color: 'text-slate-400',   bg: 'bg-slate-700/50 border-slate-600',      icon: '❓' },
  }
  const cfg = overallConfig[sentiment.overall] ?? overallConfig.unknown

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-white">Customer Sentiment</h2>
        <div className="flex items-center gap-3">
          {sentiment.rating_estimate !== 'unknown' && (
            <span className="text-blue-400 font-semibold text-sm">⭐ {sentiment.rating_estimate}</span>
          )}
          {sentiment.review_count_estimate !== 'unknown' && (
            <span className="text-slate-400 text-xs">{sentiment.review_count_estimate} reviews</span>
          )}
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.color}`}>
            {cfg.icon} {cfg.label}
          </span>
        </div>
      </div>

      {sentiment.summary && sentiment.summary !== 'No sentiment data available' && (
        <p className="text-slate-300 text-sm leading-relaxed mb-4">{sentiment.summary}</p>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {sentiment.positives.length > 0 && (
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-blue-400 mb-2">👍 What customers love</h3>
            <ul className="space-y-1.5">
              {sentiment.positives.map((p, i) => (
                <li key={i} className="text-slate-300 text-xs flex items-start gap-1.5">
                  <span className="text-blue-400 mt-0.5 flex-shrink-0">•</span> {p}
                </li>
              ))}
            </ul>
          </div>
        )}
        {sentiment.negatives.length > 0 && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-red-400 mb-2">👎 Common complaints</h3>
            <ul className="space-y-1.5">
              {sentiment.negatives.map((n, i) => (
                <li key={i} className="text-slate-300 text-xs flex items-start gap-1.5">
                  <span className="text-red-400 mt-0.5 flex-shrink-0">•</span> {n}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {sentiment.sources.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="text-slate-500 text-xs">Sources:</span>
          {sentiment.sources.map((src, i) => (
            <a key={i} href={src} target="_blank" rel="noopener noreferrer"
              className="text-xs text-slate-500 hover:text-blue-400 underline truncate max-w-[200px] transition-colors">
              {src.replace(/^https?:\/\//, '').split('/')[0]}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function SwotSection({ title, content, icon, colorClass }: {
  title: string; content: string; icon: string; colorClass: string
}) {
  const lines = content?.split('\n').filter(Boolean) ?? []
  return (
    <div className={`bg-slate-900/50 rounded-xl p-4 border ${colorClass}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{icon}</span>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {lines.length > 0 ? (
        <ul className="space-y-1.5">
          {lines.map((line, i) => (
            <li key={i} className="text-slate-300 text-xs flex items-start gap-1.5">
              <span className="mt-1 flex-shrink-0">•</span>
              <span>{line.replace(/^[•\-*]\s*/, '')}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-slate-500 text-xs">No data available</p>
      )}
    </div>
  )
}

export default async function CompetitorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Load competitor
  const { data: competitor } = await supabase
    .from('competitors')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!competitor) notFound()

  // Load business (for comparison)
  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Load latest insight
  const { data: insights } = await supabase
    .from('ai_insights')
    .select('*')
    .eq('competitor_id', id)
    .order('generated_at', { ascending: false })
    .limit(1)
  const insight = insights?.[0]

  // Load score
  const { data: scores } = await supabase
    .from('scores')
    .select('*')
    .eq('entity_id', id)
    .order('calculated_at', { ascending: false })
    .limit(1)
  const score = scores?.[0]

  // Load business score
  const { data: bizScores } = await supabase
    .from('scores')
    .select('*')
    .eq('entity_id', business?.id ?? '')
    .order('calculated_at', { ascending: false })
    .limit(1)
  const bizScore = bizScores?.[0]

  // Mark related alerts as read
  await supabase
    .from('alerts')
    .update({ is_read: true })
    .eq('competitor_id', id)
    .eq('user_id', user.id)

  const parsedPricing = (insight?.parsed_pricing as Array<{service: string; price: string; price_numeric: number | null}> | null) ?? []
  const parsedPromos = (insight?.parsed_promos as Array<{type: string; description: string}> | null) ?? []
  const promoPatterns = (insight?.promo_patterns as string[] | null) ?? []
  const sentiment = (insight?.sentiment as SentimentData | null) ?? null

  const competitorName = competitor.name || new URL(competitor.url).hostname.replace('www.', '')

  // Build chart data comparing competitor vs business
  const chartData = []
  if (parsedPricing.length > 0) {
    for (const item of parsedPricing.slice(0, 6)) {
      if (item.price_numeric !== null) {
        chartData.push({ name: item.service?.substring(0, 20) || 'Service', avg: item.price_numeric })
      }
    }
  }

  const pricingPositionMap: Record<string, { label: string; color: string; bg: string }> = {
    above_market: { label: 'Premium (above market)', color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20' },
    at_market: { label: 'At market rate', color: 'text-slate-300', bg: 'bg-slate-700/50 border-slate-600' },
    below_market: { label: 'Value (below market)', color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20' },
  }
  const pricingPositionMeta = pricingPositionMap[insight?.pricing_position ?? 'at_market'] ?? { label: 'Unknown', color: 'text-slate-400', bg: 'bg-slate-700 border-slate-600' }

  const marketPositioningMap: Record<string, { label: string; color: string; bg: string }> = {
    luxury: { label: 'Luxury', color: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/20' },
    'mid-market': { label: 'Mid-market', color: 'text-slate-300', bg: 'bg-slate-700/50 border-slate-600' },
    budget: { label: 'Budget', color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20' },
  }
  const marketPositioningMeta = marketPositioningMap[insight?.market_positioning ?? 'mid-market'] ?? { label: 'Mid-market', color: 'text-slate-300', bg: 'bg-slate-700/50 border-slate-600' }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back */}
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </Link>

      {/* Header */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="text-2xl font-bold text-white truncate">{competitorName}</h1>
              <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${pricingPositionMeta.bg} ${pricingPositionMeta.color}`}>
                {pricingPositionMeta.label}
              </span>
              {insight?.market_positioning && (
                <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${marketPositioningMeta.bg} ${marketPositioningMeta.color}`}>
                  {marketPositioningMeta.label}
                </span>
              )}
            </div>
            <a href={competitor.url} target="_blank" rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
              {competitor.url.replace(/^https?:\/\//, '').replace('www.', '')} ↗
            </a>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <ShareButton competitorId={id} competitorName={competitorName} />
            <ScoreBadge score={score?.score ?? 0} size="lg" breakdown={score?.score_breakdown} />
          </div>
        </div>

        {insight?.summary_text && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <p className="text-slate-300 text-sm leading-relaxed">{insight.summary_text}</p>
          </div>
        )}

        {/* Review metrics */}
        {sentiment && (
          <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-1">Star Rating</p>
              {sentiment.rating_estimate !== 'unknown' ? (
                <p className="text-xl font-bold text-blue-400">
                  ⭐ {sentiment.rating_estimate}
                </p>
              ) : (
                <p className="text-sm text-slate-500">—</p>
              )}
            </div>
            <div className="text-center border-x border-slate-700">
              <p className="text-xs text-slate-500 mb-1">Reviews</p>
              {sentiment.review_count_estimate !== 'unknown' ? (
                <p className="text-xl font-bold text-white">
                  {sentiment.review_count_estimate}
                </p>
              ) : (
                <p className="text-sm text-slate-500">—</p>
              )}
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-1">Sentiment</p>
              <p className={`text-sm font-semibold ${
                sentiment.overall === 'positive' ? 'text-blue-400' :
                sentiment.overall === 'negative' ? 'text-red-400' :
                sentiment.overall === 'mixed' ? 'text-amber-400' : 'text-slate-500'
              }`}>
                {sentiment.overall === 'positive' ? '😊 Positive' :
                 sentiment.overall === 'negative' ? '😟 Negative' :
                 sentiment.overall === 'mixed' ? '😐 Mixed' : '—'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Promo patterns */}
      {promoPatterns.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <h2 className="text-base font-semibold text-white mb-3">Promotion Tactics Detected</h2>
          <div className="flex flex-wrap gap-2">
            {promoPatterns.map((p, i) => (
              <span key={i} className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-slate-300 text-sm">
                🎯 {p}
              </span>
            ))}
          </div>
          {parsedPromos.length > 0 && (
            <div className="mt-4 space-y-2">
              {parsedPromos.map((promo, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-blue-400 font-medium whitespace-nowrap">{promo.type}:</span>
                  <span className="text-slate-300">{promo.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}


      {/* Customer Sentiment */}
      {insight && sentiment && (
        <SentimentSection sentiment={sentiment} />
      )}

      {/* SWOT Summary */}
      {insight && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <h2 className="text-base font-semibold text-white mb-4">SWOT Analysis</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <SwotSection title="Strengths" content={insight.swot_strengths ?? ''} icon="💪"
              colorClass="border-blue-500/20" />
            <SwotSection title="Weaknesses" content={insight.swot_weaknesses ?? ''} icon="⚠️"
              colorClass="border-red-500/20" />
            <SwotSection title="Opportunities for You" content={insight.swot_opportunities ?? ''} icon="🚀"
              colorClass="border-blue-500/20" />
            <SwotSection title="Threats to Watch" content={insight.swot_threats ?? ''} icon="🔥"
              colorClass="border-amber-500/20" />
          </div>
        </div>
      )}

      {!insight && (
        <div className="bg-slate-800/50 border border-dashed border-slate-700 rounded-2xl p-10 text-center">
          <p className="text-slate-400 text-sm">Analysis is still being generated. Check back shortly.</p>
          <Link href="/onboarding/step-3" className="mt-3 inline-block text-blue-400 hover:text-blue-300 text-sm">
            Check pipeline status →
          </Link>
        </div>
      )}

    </div>
  )
}
