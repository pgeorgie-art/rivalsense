'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { CheckCircle2, AlertCircle, RefreshCw, Clock, Loader2, Globe } from 'lucide-react'

interface CompetitorStatus {
  id: string
  url: string
  name: string | null
  scrapeStatus: 'pending' | 'scraping' | 'analysing' | 'done' | 'failed'
}

export default function OnboardingStep3() {
  const router = useRouter()
  const [competitors, setCompetitors] = useState<CompetitorStatus[]>([])
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const pipelineStarted = useRef(false)

  useEffect(() => {
    if (pipelineStarted.current) return
    pipelineStarted.current = true

    const supabase = createClient()
    let pollInterval: ReturnType<typeof setInterval>

    async function start() {
      // ── Load competitors ───────────────────────────────────────────────────
      const { data: rows, error: compErr } = await supabase
        .from('competitors')
        .select('id, url, name')
        .order('slot_number')

      if (compErr || !rows || rows.length === 0) {
        setError('No competitors found. Please go back to Step 2.')
        return
      }

      const ids = rows.map(r => r.id)

      // Initialise all as pending
      setCompetitors(rows.map(r => ({
        id: r.id,
        url: r.url,
        name: r.name,
        scrapeStatus: 'pending',
      })))

      // ── Poll the DB every 3s for per-competitor progress ──────────────────
      pollInterval = setInterval(async () => {
        const [{ data: scrapeRows }, { data: insightRows }] = await Promise.all([
          supabase
            .from('scrape_results')
            .select('entity_id, scrape_status')
            .in('entity_id', ids)
            .eq('entity_type', 'competitor'),
          supabase
            .from('ai_insights')
            .select('competitor_id')
            .in('competitor_id', ids),
        ])

        const scrapeMap = new Map(
          (scrapeRows ?? []).map(r => [r.entity_id, r.scrape_status as string])
        )
        const insightSet = new Set((insightRows ?? []).map(r => r.competitor_id))

        const updated: CompetitorStatus[] = rows.map(r => {
          if (insightSet.has(r.id)) return { ...r, scrapeStatus: 'done' as const }
          const scrape = scrapeMap.get(r.id)
          if (scrape === 'failed')  return { ...r, scrapeStatus: 'failed' as const }
          if (scrape === 'success') return { ...r, scrapeStatus: 'analysing' as const }
          if (scrapeMap.has(r.id)) return { ...r, scrapeStatus: 'scraping' as const }
          return { ...r, scrapeStatus: 'pending' as const }
        })

        setCompetitors(updated)

        // All done when every competitor has insights
        if (updated.every(c => c.scrapeStatus === 'done' || c.scrapeStatus === 'failed')) {
          const anyDone = updated.some(c => c.scrapeStatus === 'done')
          if (anyDone) {
            clearInterval(pollInterval)
            setDone(true)
            setTimeout(() => router.push('/dashboard'), 1500)
          }
        }
      }, 3000)

      // ── Start the pipeline (runs while this page stays open) ──────────────
      try {
        const res = await fetch('/api/pipeline', { method: 'POST' })
        clearInterval(pollInterval)

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? 'Pipeline failed')
        }

        // Do a final DB check after pipeline resolves
        const [{ data: finalInsights }] = await Promise.all([
          supabase.from('ai_insights').select('competitor_id').in('competitor_id', ids),
        ])

        const finalInsightSet = new Set((finalInsights ?? []).map(r => r.competitor_id))

        if (finalInsightSet.size === 0) {
          throw new Error(
            'Analysis completed but no insights were saved. ' +
            'Check that FIRECRAWL_API_KEY and ANTHROPIC_API_KEY are set in your environment.'
          )
        }

        setCompetitors(rows.map(r => ({
          ...r,
          scrapeStatus: finalInsightSet.has(r.id) ? 'done' : 'failed',
        })))
        setDone(true)
        setTimeout(() => router.push('/dashboard'), 1500)

      } catch (err) {
        clearInterval(pollInterval)
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    }

    start()
    return () => clearInterval(pollInterval)
  }, [router])

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="text-center py-6">
        <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Something went wrong</h2>
        <p className="text-destructive text-sm mb-6 max-w-sm mx-auto leading-relaxed">{error}</p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => window.location.reload()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Try again
          </Button>
          <Button variant="outline" onClick={() => router.push('/onboarding/step-2')}>
            Back to Step 2
          </Button>
        </div>
      </div>
    )
  }

  // ── Done state ──────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="text-center py-6">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Analysis complete!</h2>
        <p className="text-muted-foreground text-sm">Loading your dashboard…</p>
      </div>
    )
  }

  // ── Progress state ──────────────────────────────────────────────────────────
  const total = competitors.length
  const doneCount = competitors.filter(c => c.scrapeStatus === 'done').length

  return (
    <div className="py-2">
      {/* Spinner + title */}
      <div className="text-center mb-6">
        <div className="relative w-16 h-16 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full border-4 border-border" />
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Globe className="w-6 h-6 text-primary" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-foreground mb-1">Analysing your competitors</h2>
        <p className="text-muted-foreground text-sm">
          {doneCount} of {total} complete — please keep this page open
        </p>
      </div>

      {/* Per-competitor status list */}
      <div className="space-y-2">
        {competitors.map(c => {
          const hostname = (() => {
            try { return new URL(c.url).hostname.replace('www.', '') }
            catch { return c.url }
          })()

          return (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border bg-muted/20"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <StatusIcon status={c.scrapeStatus} />
                <span className="text-sm text-foreground truncate font-medium">
                  {c.name || hostname}
                </span>
                {!c.name && (
                  <span className="text-xs text-muted-foreground truncate hidden sm:block">
                    {hostname}
                  </span>
                )}
              </div>
              <StatusLabel status={c.scrapeStatus} />
            </div>
          )
        })}

        {/* Placeholder rows while competitors are loading */}
        {competitors.length === 0 && (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-muted/20 border border-border animate-pulse" />
          ))
        )}
      </div>

      <p className="text-muted-foreground text-xs text-center mt-6">
        This may take up to 60 seconds per competitor
      </p>
    </div>
  )
}

function StatusIcon({ status }: { status: CompetitorStatus['scrapeStatus'] }) {
  switch (status) {
    case 'done':
      return <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
    case 'failed':
      return <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
    case 'analysing':
    case 'scraping':
      return <Loader2 className="w-4 h-4 text-primary shrink-0 animate-spin" />
    default:
      return <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
  }
}

function StatusLabel({ status }: { status: CompetitorStatus['scrapeStatus'] }) {
  const map: Record<CompetitorStatus['scrapeStatus'], { label: string; className: string }> = {
    pending:   { label: 'Queued',     className: 'text-muted-foreground' },
    scraping:  { label: 'Scraping…',  className: 'text-primary' },
    analysing: { label: 'Analysing…', className: 'text-primary' },
    done:      { label: 'Done',       className: 'text-primary font-medium' },
    failed:    { label: 'Failed',     className: 'text-destructive' },
  }
  const { label, className } = map[status]
  return <span className={`text-xs shrink-0 ${className}`}>{label}</span>
}
