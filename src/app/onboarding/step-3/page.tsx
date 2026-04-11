'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  CheckCircle2, AlertCircle, RefreshCw,
  Search, Brain, BarChart2, Sparkles, Globe, ShieldCheck,
} from 'lucide-react'

const PIPELINE_STEPS = [
  { icon: Globe,      text: 'Scraping your business website…' },
  { icon: Search,     text: 'Analysing competitor websites…' },
  { icon: Brain,      text: 'Running AI competitive analysis…' },
  { icon: BarChart2,  text: 'Computing Market Positioning Scores…' },
  { icon: Sparkles,   text: 'Building your intelligence dashboard…' },
]

type Phase = 'pipeline' | 'verifying' | 'done' | 'error'

export default function OnboardingStep3() {
  const router = useRouter()
  const [stepIdx, setStepIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('pipeline')
  const [error, setError] = useState<string | null>(null)
  const [verifiedCount, setVerifiedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    // Cycle through pipeline step labels every 8s
    const labelInterval = setInterval(() => {
      setStepIdx(prev => Math.min(prev + 1, PIPELINE_STEPS.length - 1))
    }, 8000)

    async function run() {
      try {
        // ── 1. Run the pipeline ──────────────────────────────────────────────
        const res = await fetch('/api/pipeline', { method: 'POST' })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? 'Pipeline failed')
        }
        clearInterval(labelInterval)

        // ── 2. Verify insights were actually written ─────────────────────────
        setPhase('verifying')
        const supabase = createClient()

        const { data: competitors } = await supabase
          .from('competitors')
          .select('id')

        if (!competitors || competitors.length === 0) {
          throw new Error('No competitors found — please go back to Step 2.')
        }

        const competitorIds = competitors.map(c => c.id)
        setTotalCount(competitorIds.length)

        // Poll every 3s, up to 20 attempts (~60s) for at least one insight
        let attempts = 0
        const maxAttempts = 20

        while (attempts < maxAttempts) {
          const { count } = await supabase
            .from('ai_insights')
            .select('*', { count: 'exact', head: true })
            .in('competitor_id', competitorIds)

          const found = count ?? 0
          setVerifiedCount(found)

          if (found > 0) {
            setPhase('done')
            setTimeout(() => router.push('/dashboard'), 1500)
            return
          }

          attempts++
          await new Promise(r => setTimeout(r, 3000))
        }

        // Timed out — pipeline ran but no data written (likely missing API keys)
        throw new Error(
          'Analysis completed but no insights were saved. Please check that FIRECRAWL_API_KEY and ANTHROPIC_API_KEY are set in your Vercel environment variables.'
        )

      } catch (err) {
        clearInterval(labelInterval)
        setError(err instanceof Error ? err.message : 'Something went wrong')
        setPhase('error')
      }
    }

    run()
    return () => clearInterval(labelInterval)
  }, [router])

  // ── Error state ─────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="text-center py-6">
        <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Something went wrong</h2>
        <p className="text-destructive text-sm mb-6 max-w-sm mx-auto leading-relaxed">{error}</p>
        <div className="flex gap-3 justify-center">
          <Button
            onClick={() => { setError(null); setPhase('pipeline'); setStepIdx(0); window.location.reload() }}
            className="gap-2"
          >
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
  if (phase === 'done') {
    return (
      <div className="text-center py-6">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Analysis complete!</h2>
        <p className="text-muted-foreground text-sm">
          Found insights for {verifiedCount} of {totalCount} competitor{totalCount !== 1 ? 's' : ''}.
          Loading your dashboard…
        </p>
      </div>
    )
  }

  // ── Verifying state ─────────────────────────────────────────────────────────
  if (phase === 'verifying') {
    return (
      <div className="text-center py-4">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-border" />
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Confirming your data</h2>
        <p className="text-primary text-sm font-medium mb-6">
          Verifying insights for {totalCount} competitor{totalCount !== 1 ? 's' : ''}…
        </p>
        <Progress
          value={totalCount > 0 ? (verifiedCount / totalCount) * 100 : 0}
          className="h-1.5 mb-4"
        />
        <p className="text-muted-foreground text-xs">Almost there — hang tight</p>
      </div>
    )
  }

  // ── Pipeline running state ──────────────────────────────────────────────────
  const StepIcon = PIPELINE_STEPS[stepIdx].icon
  const progress = ((stepIdx + 1) / PIPELINE_STEPS.length) * 100

  return (
    <div className="text-center py-4">
      <div className="relative w-20 h-20 mx-auto mb-6">
        <div className="absolute inset-0 rounded-full border-4 border-border" />
        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <StepIcon className="w-7 h-7 text-primary" />
        </div>
      </div>

      <h2 className="text-xl font-bold text-foreground mb-2">Analysing your competitors</h2>
      <p className="text-primary text-sm font-medium mb-6 min-h-[1.25rem] transition-all">
        {PIPELINE_STEPS[stepIdx].text}
      </p>

      <div className="space-y-3 mb-4">
        <Progress value={progress} className="h-1.5" />
        <div className="flex justify-between px-1">
          {PIPELINE_STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors duration-500 ${
                i <= stepIdx ? 'bg-primary' : 'bg-border'
              }`}
            />
          ))}
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
        Please keep this page open — this may take up to 60 seconds per competitor
      </p>
    </div>
  )
}
