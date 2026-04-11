'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { CheckCircle2, AlertCircle, RefreshCw, ArrowRight, Search, Brain, BarChart2, Sparkles, Globe } from 'lucide-react'

const STATUS_MESSAGES = [
  { icon: Globe,      text: 'Scraping your business website…' },
  { icon: Search,     text: 'Analysing competitor websites…' },
  { icon: Brain,      text: 'Running AI competitive analysis…' },
  { icon: BarChart2,  text: 'Computing Market Positioning Scores…' },
  { icon: Sparkles,   text: 'Building your intelligence dashboard…' },
]

export default function OnboardingStep3() {
  const router = useRouter()
  const [statusIdx, setStatusIdx] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIdx(prev => Math.min(prev + 1, STATUS_MESSAGES.length - 1))
    }, 8000)

    async function runPipeline() {
      try {
        const res = await fetch('/api/pipeline', { method: 'POST' })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? 'Pipeline failed')
        }
        setDone(true)
        clearInterval(interval)
        setTimeout(() => router.push('/dashboard'), 1500)
      } catch (err) {
        clearInterval(interval)
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    }

    runPipeline()
    return () => clearInterval(interval)
  }, [router])

  if (error) {
    return (
      <div className="text-center py-6">
        <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Something went wrong</h2>
        <p className="text-destructive text-sm mb-6">{error}</p>
        <div className="flex gap-3 justify-center">
          <Button
            onClick={() => { setError(null); window.location.reload() }}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </Button>
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            Skip to dashboard
          </Button>
        </div>
      </div>
    )
  }

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

  const StatusIcon = STATUS_MESSAGES[statusIdx].icon
  const progress = ((statusIdx + 1) / STATUS_MESSAGES.length) * 100

  return (
    <div className="text-center py-4">
      {/* Animated spinner with icon */}
      <div className="relative w-20 h-20 mx-auto mb-6">
        <div className="absolute inset-0 rounded-full border-4 border-border" />
        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <StatusIcon className="w-7 h-7 text-primary" />
        </div>
      </div>

      <h2 className="text-xl font-bold text-foreground mb-2">Building your dashboard</h2>
      <p className="text-primary text-sm font-medium mb-6 min-h-[1.25rem] transition-all">
        {STATUS_MESSAGES[statusIdx].text}
      </p>

      {/* Progress bar */}
      <div className="space-y-2 mb-4">
        <Progress value={progress} className="h-1.5" />
        <div className="flex justify-between text-xs text-muted-foreground">
          {STATUS_MESSAGES.map((msg, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i <= statusIdx ? 'bg-primary' : 'bg-border'}`} />
          ))}
        </div>
      </div>

      <p className="text-muted-foreground text-xs">This may take up to 60 seconds per competitor</p>
    </div>
  )
}
