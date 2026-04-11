'use client'

import { useState } from 'react'

interface Props {
  lastReport: { content: string; generated_at: string } | null
  competitorCount: number
}

function formatReportContent(content: string) {
  // Split into lines and render with basic formatting
  const lines = content.split('\n')
  return lines.map((line, i) => {
    if (line.startsWith('**') && line.endsWith('**')) {
      return <h3 key={i} className="text-white font-semibold text-sm mt-5 mb-2 first:mt-0">{line.replace(/\*\*/g, '')}</h3>
    }
    if (/^\*\*[^*]+\*\*/.test(line)) {
      // Inline bold — heading with content
      const formatted = line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      return <p key={i} className="text-slate-300 text-sm leading-relaxed mb-1"
        dangerouslySetInnerHTML={{ __html: formatted }} />
    }
    if (line.startsWith('- ') || line.startsWith('• ')) {
      return (
        <li key={i} className="text-slate-300 text-sm leading-relaxed flex items-start gap-2 mb-1">
          <span className="text-blue-400 mt-1.5 flex-shrink-0 text-xs">•</span>
          <span>{line.replace(/^[-•]\s*/, '')}</span>
        </li>
      )
    }
    if (line.startsWith('#')) {
      return <h2 key={i} className="text-white font-bold text-base mt-4 mb-2">{line.replace(/^#+\s*/, '')}</h2>
    }
    if (line.trim() === '') return <div key={i} className="h-2" />
    return <p key={i} className="text-slate-300 text-sm leading-relaxed mb-1">{line}</p>
  })
}

export default function ReportClient({ lastReport, competitorCount }: Props) {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<string | null>(lastReport?.content ?? null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(lastReport?.generated_at ?? null)
  const [error, setError] = useState<string | null>(null)

  async function generateReport() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/report', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Report generation failed')
      setReport(data.content)
      setGeneratedAt(new Date().toISOString())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  function copyToClipboard() {
    if (report) navigator.clipboard.writeText(report)
  }

  return (
    <div className="space-y-4">
      {/* Generate button */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-white text-sm font-medium">
              {report ? 'Report ready' : 'Generate your weekly briefing'}
            </p>
            <p className="text-slate-400 text-xs mt-0.5">
              {report
                ? `Generated ${generatedAt ? new Date(generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'recently'}`
                : `Analyses ${competitorCount} competitor${competitorCount !== 1 ? 's' : ''} and produces actionable recommendations`
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            {report && (
              <button
                onClick={copyToClipboard}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-slate-600 hover:border-slate-500 rounded-lg transition-colors"
              >
                Copy
              </button>
            )}
            <button
              onClick={generateReport}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {report ? 'Regenerate' : 'Generate Report'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {loading && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-10 text-center">
          <div className="w-10 h-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Analysing {competitorCount} competitor{competitorCount !== 1 ? 's' : ''} and generating report…</p>
          <p className="text-slate-600 text-xs mt-1">This may take up to 30 seconds</p>
        </div>
      )}

      {!loading && report && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5 pb-4 border-b border-slate-700">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-blue-400 text-xs font-semibold uppercase tracking-wider">AI Intelligence Report</span>
          </div>
          <ul className="list-none space-y-0">
            {formatReportContent(report)}
          </ul>
        </div>
      )}

      {!loading && !report && !error && (
        <div className="bg-slate-800/50 border border-dashed border-slate-700 rounded-2xl p-10 text-center">
          <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-slate-400 text-sm">No report generated yet.</p>
          <p className="text-slate-600 text-xs mt-1">Click Generate Report to create your first weekly briefing.</p>
        </div>
      )}
    </div>
  )
}
