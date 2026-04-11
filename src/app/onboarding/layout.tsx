import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center p-1">
              <img src="/logo.jpg" alt="RivalSense AI" className="w-full h-full object-contain" />
            </div>
            <span className="text-xl font-bold text-white">Rival<span className="text-red-500">Sense</span> <span className="text-slate-400 font-normal">AI</span></span>
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-8">
          {children}
        </div>
      </div>
    </div>
  )
}
