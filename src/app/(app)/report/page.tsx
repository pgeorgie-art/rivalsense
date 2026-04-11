import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ReportClient from './report-client'

export default async function ReportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('name, category, city')
    .eq('user_id', user.id)
    .single()

  if (!business) redirect('/onboarding/step-1')

  const { data: competitors } = await supabase
    .from('competitors')
    .select('id, name, url')
    .eq('user_id', user.id)

  if (!competitors || competitors.length === 0) redirect('/onboarding/step-2')

  // Try to get most recent report
  let lastReport: { content: string; generated_at: string } | null = null
  try {
    const { data } = await supabase
      .from('reports')
      .select('content, generated_at')
      .eq('user_id', user.id)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()
    lastReport = data
  } catch {
    // Table might not exist yet
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Weekly Intelligence Report</h1>
          <p className="text-slate-400 text-sm mt-1">
            AI-generated competitive briefing for {business.name}
          </p>
        </div>
      </div>

      <ReportClient lastReport={lastReport} competitorCount={competitors.length} />
    </div>
  )
}
