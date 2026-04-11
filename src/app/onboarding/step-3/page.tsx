'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const STATUS_MESSAGES = [
  { icon: '🔍', text: 'Scraping your business website…' },
  { icon: '🕷️', text: 'Analysing competitor websites…' },
  { icon: '🧠', text: 'Running AI competitive analysis…' },
  { icon: '📊', text: 'Computing Market Positioning Scores…' },
  { icon: '✨', text: 'Building your intelligence dashboard…' },
]

export default function OnboardingStep3() {
  const router = useRouter()
  const [statusIdx, setStatusIdx] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    // Rotate status messages every 8 seconds
    const interval = setInterval(() => {
      setStatusIdx(prev => Math.min(prev + 1, STATUS_MESSAGES.length - 1))
    }, 8000)

    // Trigger the pipeline
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
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
        <p className="text-red-400 text-sm mb-6">{error}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => { setError(null); window.location.reload() }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
            Try again
          </button>
          <button onClick={() => router.push('/dashboard')}
            className="px-4 py-2 border border-slate-600 hover:border-slate-500 text-slate-300 rounded-lg text-sm transition-colors">
            Skip to dashboard
          </button>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="text-center py-6">
        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Analysis complete!</h2>
        <p className="text-slate-400 text-sm">Loading your dashboard…</p>
      </div>
    )
  }

  return (
    <div className="text-center py-4">
      {/* Animated spinner */}
      <div className="relative w-20 h-20 mx-auto mb-6">
        <div className="absolute inset-0 rounded-full border-4 border-slate-700" />
        <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center text-2xl">
          {STATUS_MESSAGES[statusIdx].icon}
        </div>
      </div>

      <h2 className="text-xl font-bold text-white mb-2">Building your dashboard</h2>
      <p className="text-blue-400 text-sm font-medium mb-6 min-h-[1.25rem] transition-all">
        {STATUS_MESSAGES[statusIdx].text}
      </p>

      {/* Progress dots */}
      <div className="flex justify-center gap-1.5">
        {STATUS_MESSAGES.map((_, i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${
            i <= statusIdx ? 'w-4 bg-blue-500' : 'w-1.5 bg-slate-600'
          }`} />
        ))}
      </div>

      <p className="text-slate-500 text-xs mt-6">This may take up to 60 seconds per competitor</p>
    </div>
  )
}
