'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { BarChart2 } from 'lucide-react'

function getScoreColor(score: number) {
  if (score >= 70) return { ring: 'ring-blue-500',  text: 'text-blue-400',  dot: 'bg-blue-400'  }
  if (score >= 45) return { ring: 'ring-amber-500', text: 'text-amber-400', dot: 'bg-amber-400' }
  return              { ring: 'ring-red-500',   text: 'text-red-400',   dot: 'bg-red-400'   }
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
  const colors = getScoreColor(score)

  const sizeClasses = {
    sm: 'w-10 h-10 text-xs',
    md: 'w-14 h-14 text-sm',
    lg: 'w-20 h-20 text-lg',
  }

  return (
    <Tooltip>
      <TooltipTrigger>
        <div
          className={`${sizeClasses[size]} rounded-full ring-2 ${colors.ring} bg-card flex flex-col items-center justify-center cursor-help shrink-0`}
        >
          <span className={`font-bold ${colors.text} leading-none`}>{score}</span>
          <span className="text-muted-foreground text-[10px] leading-none mt-0.5">/ 100</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="w-64 p-3 text-left">
        <div className="flex items-center gap-1.5 mb-2">
          <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
          <span className="text-xs font-semibold">Market Positioning Score</span>
        </div>
        <p className="text-muted-foreground text-xs mb-2">
          Based on observable pricing and promotional activity only. Does{' '}
          <strong className="text-foreground">not</strong> include revenue, customer volume,
          foot traffic, or review data.
        </p>
        {breakdown && (breakdown.pricing_notes || breakdown.promo_notes) && (
          <div className="space-y-1.5 border-t border-border pt-2">
            {breakdown.pricing_notes && (
              <p className="text-muted-foreground text-xs flex gap-1.5">
                <BarChart2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-400" />
                {breakdown.pricing_notes}
              </p>
            )}
            {breakdown.promo_notes && (
              <p className="text-muted-foreground text-xs flex gap-1.5">
                <BarChart2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                {breakdown.promo_notes}
              </p>
            )}
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
