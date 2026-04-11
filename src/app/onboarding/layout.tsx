import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-primary/5 blur-3xl" />
      </div>
      <div className="relative w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center p-1 shadow">
              <img src="/logo.jpg" alt="RivalSense AI" className="w-full h-full object-contain" />
            </div>
            <span className="text-xl font-bold text-foreground">
              Rival<span className="text-red-500">Sense</span>{' '}
              <span className="text-muted-foreground font-normal">AI</span>
            </span>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 p-8">
          {children}
        </div>
      </div>
    </div>
  )
}
