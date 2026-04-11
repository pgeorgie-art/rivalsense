import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Nav from '@/components/nav'
import ChatPanel from '@/components/chat-panel'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { count } = await supabase
    .from('alerts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  return (
    <div className="min-h-screen bg-slate-900">
      <Nav unreadAlerts={count ?? 0} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>
      {/* Global dashboard-context chat; competitor pages render their own context-aware chat */}
      <ChatPanel />
    </div>
  )
}
