import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ScoreBadge from '@/components/score-badge'
import PricingChart from '@/components/pricing-chart'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Bell, Plus, GitCompareArrows, FileText, TrendingUp, ArrowRight } from 'lucide-react'

function getPricingPositionLabel(pos: string | null) {
  if (pos === 'below_market') return { label: 'Below market', variant: 'secondary' as const, className: 'text-blue-400 border-blue-400/30 bg-blue-400/10' }
  if (pos === 'above_market') return { label: 'Premium', variant: 'secondary' as const, className: 'text-amber-400 border-amber-400/30 bg-amber-400/10' }
  return { label: 'At market', variant: 'secondary' as const, className: 'text-muted-foreground border-border bg-muted/50' }
}

function getMarketPositioningLabel(pos: string | null) {
  if (pos === 'luxury')     return { label: 'Luxury',     className: 'text-purple-400 border-purple-400/30 bg-purple-400/10' }
  if (pos === 'budget')     return { label: 'Budget',     className: 'text-blue-400 border-blue-400/30 bg-blue-400/10' }
  if (pos === 'mid-market') return { label: 'Mid-market', className: 'text-muted-foreground border-border bg-muted/50' }
  return null
}

export default async function DashboardPage() {
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

  const { data: alerts } = await supabase
    .from('alerts')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_read', false)
    .order('created_at', { ascending: false })

  const alertCompetitorIds = new Set((alerts ?? []).map(a => a.competitor_id))
  const hasData = insightMap.size > 0

  function detectCurrency(insights: Map<string, { parsed_pricing?: unknown }>): string {
    for (const insight of insights.values()) {
      const pricing = (insight?.parsed_pricing as Array<{price?: string}> | null) ?? []
      for (const item of pricing) {
        if (!item.price) continue
        const match = item.price.match(/^([£$€¥₹₩₪฿])/)
        if (match) return match[1]
      }
    }
    return '$'
  }
  const currencySymbol = detectCurrency(insightMap as Map<string, { parsed_pricing?: unknown }>)

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
          <h1 className="text-2xl font-bold text-foreground">Competitor Intelligence</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Tracking {competitors.length} competitor{competitors.length !== 1 ? 's' : ''} for{' '}
            <span className="text-foreground font-medium">{business.name}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasData && (
            <>
              <Link href="/compare">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <GitCompareArrows className="w-4 h-4" />
                  Compare
                </Button>
              </Link>
              <Link href="/report">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <FileText className="w-4 h-4" />
                  Report
                </Button>
              </Link>
            </>
          )}
          {competitors.length < 5 && (
            <Link href="/settings">
              <Button size="sm" className="gap-1.5">
                <Plus className="w-4 h-4" />
                Add competitor
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Alerts banner */}
      {(alerts ?? []).length > 0 && (
        <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-400">
          <Bell className="h-4 w-4 text-amber-400" />
          <AlertTitle className="text-amber-400">
            {(alerts ?? []).length} new competitor change{(alerts ?? []).length !== 1 ? 's' : ''} detected
          </AlertTitle>
          <AlertDescription className="text-amber-300/80">
            <ul className="mt-1 space-y-0.5">
              {(alerts ?? []).slice(0, 3).map(alert => (
                <li key={alert.id} className="text-xs">{alert.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {!hasData ? (
        <Card className="text-center py-12">
          <CardContent className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-1">Analysis in progress</h2>
              <p className="text-muted-foreground text-sm">
                Your competitors are being analysed. This can take a few minutes.
              </p>
            </div>
            <Link href="/onboarding/step-3">
              <Button className="gap-2">
                Check progress
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Your business card */}
          <Card className="border-primary/20 bg-gradient-to-r from-primary/10 to-card">
            <CardContent className="pt-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                  Your Business · Benchmark
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground">{business.name}</h2>
                  <p className="text-muted-foreground text-sm">
                    {business.category} · {business.city}
                  </p>
                </div>
                <ScoreBadge
                  score={scoreMap.get(business.id)?.score ?? 50}
                  breakdown={scoreMap.get(business.id)?.score_breakdown}
                />
              </div>
            </CardContent>
          </Card>

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
                <Link key={competitor.id} href={`/competitor/${competitor.id}`} className="group block">
                  <Card className="h-full transition-all duration-200 hover:border-border/80 hover:shadow-lg hover:shadow-black/20 relative">
                    {hasAlert && (
                      <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-card" />
                    )}
                    <CardContent className="pt-5 flex flex-col h-full">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0 pr-3">
                          <h3 className="font-semibold text-foreground text-sm truncate">
                            {competitor.name || new URL(competitor.url).hostname.replace('www.', '')}
                          </h3>
                          <p className="text-muted-foreground text-xs truncate">
                            {competitor.url.replace(/^https?:\/\//, '').replace('www.', '')}
                          </p>
                        </div>
                        <ScoreBadge score={score?.score ?? 0} size="sm" breakdown={score?.score_breakdown} />
                      </div>

                      {insight ? (
                        <>
                          <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2 mb-3 flex-1">
                            {insight.summary_text}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="outline" className={`text-xs ${posLabel.className}`}>
                              {posLabel.label}
                            </Badge>
                            {mktLabel && (
                              <Badge variant="outline" className={`text-xs ${mktLabel.className}`}>
                                {mktLabel.label}
                              </Badge>
                            )}
                            {promoPatterns.slice(0, 1).map((p, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {p}
                              </Badge>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 text-muted-foreground text-xs flex-1">
                          <div className="w-3 h-3 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />
                          Analysis pending…
                        </div>
                      )}

                      <div className="mt-3 flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        View full analysis <ArrowRight className="w-3 h-3" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}

            {/* Empty slots */}
            {competitors.length < 5 &&
              Array.from({ length: 5 - competitors.length }).map((_, i) => (
                <Link key={`empty-${i}`} href="/settings" className="block">
                  <Card className="h-full border-dashed hover:border-border/80 transition-colors">
                    <CardContent className="h-full min-h-[140px] flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                      <div className="w-8 h-8 rounded-full border-2 border-dashed border-current flex items-center justify-center">
                        <Plus className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-medium">Add competitor</span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
          </div>

          {/* Pricing comparison chart */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Average Pricing Comparison</CardTitle>
                <CardDescription>Average service prices across all tracked competitors</CardDescription>
              </CardHeader>
              <CardContent>
                <PricingChart data={chartData} currency={currencySymbol} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
