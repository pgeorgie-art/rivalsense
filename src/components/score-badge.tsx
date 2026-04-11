'use client'

import { useState } from 'react'

function getScoreColor(score: number) {
  if (score >= 70) return { ring: 'ring-blue-500', text: 'text-blue-400', bg: 'bg-blue-500' }
  if (score >= 45) return { ring: 'ring-amber-500', text: 'text-amber-400', bg: 'bg-amber-500' }
  return { ring: 'ring-red-500', text: 'text-red-400', bg: 'bg-red-500' }
}

interface ScoreBadgeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  breakdown?: {
    pricing_notes?: string
    promo_notes?: string
  }
}

export default function ScoreBadge({ score, size = 'md', breakdown }: ScoreBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const colors = getScoreColor(score)

  const sizeClasses = {
    sm: 'w-10 h-10 text-xs',
    md: 'w-14 h-14 text-sm',
    lg: 'w-20 h-20 text-lg',
  }

  return (
    <div className="relative inline-flex" onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
      <div className={`${sizeClasses[size]} rounded-full ring-2 ${colors.ring} bg-slate-800 flex flex-col items-center justify-center cursor-help`}>
        <span className={`font-bold ${colors.text} leading-none`}>{score}</span>
        <span className="text-slate-500 text-[10px] leading-none mt-0.5">/ 100</span>
      </div>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-xl z-50 text-left">
          <div className="flex items-center gap-1.5 mb-2">
            <div className={`w-2 h-2 rounded-full ${colors.bg}`} />
            <span className="text-white text-xs font-semibold">Market Positioning Score</span>
          </div>
          <p className="text-slate-400 text-xs mb-2">
            Based on observable pricing and promotional activity only. Does <strong className="text-slate-300">not</strong> include revenue, customer volume, foot traffic, or review data.
          </p>
          {breakdown && (
            <div className="space-y-1.5 border-t border-slate-700 pt-2">
              {breakdown.pricing_notes && (
                <p className="text-slate-400 text-xs">📊 {breakdown.pricing_notes}</p>
              )}
              {breakdown.promo_notes && (
                <p className="text-slate-400 text-xs">🎯 {breakdown.promo_notes}</p>
              )}
            </div>
          )}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-700" />
        </div>
      )}
    </div>
  )
}
