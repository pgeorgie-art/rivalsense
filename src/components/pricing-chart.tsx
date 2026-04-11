'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface ChartDataPoint {
  name: string
  avg: number | null
}

const COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
  currency?: string
}

function CustomTooltip({ active, payload, label, currency = '$' }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl">
      <p className="text-slate-300 text-xs font-medium mb-1">{label}</p>
      <p className="text-blue-400 text-sm font-bold">{currency}{payload[0].value.toFixed(0)} avg</p>
    </div>
  )
}

export default function PricingChart({ data, currency = '$' }: { data: ChartDataPoint[]; currency?: string }) {
  const filtered = data.filter(d => d.avg !== null) as Array<{ name: string; avg: number }>

  if (filtered.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-slate-500 text-sm">
        No pricing data available yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={filtered} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false}
          tickFormatter={v => `${currency}${v}`} width={45} />
        <Tooltip content={<CustomTooltip currency={currency} />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <Bar dataKey="avg" radius={[6, 6, 0, 0]} maxBarSize={60}>
          {filtered.map((_, idx) => (
            <Cell key={idx} fill={COLORS[idx % COLORS.length]} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
