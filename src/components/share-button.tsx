'use client'

import { useState } from 'react'

interface Props {
  competitorId: string
  competitorName: string
}

export default function ShareButton({ competitorId, competitorName }: Props) {
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleShare() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitor_id: competitorId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate share link')

      const shareUrl = `${window.location.origin}/share/${data.token}`
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Share failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleShare}
        disabled={loading}
        title={`Share ${competitorName} analysis`}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-slate-600 hover:border-slate-500 rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? (
          <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
        ) : copied ? (
          <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        )}
        {copied ? 'Copied!' : 'Share'}
      </button>
      {error && (
        <div className="absolute top-full right-0 mt-1 bg-red-900 border border-red-700 rounded-lg px-3 py-2 text-xs text-red-300 whitespace-nowrap z-10">
          {error}
        </div>
      )}
    </div>
  )
}
