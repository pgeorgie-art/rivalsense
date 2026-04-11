import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsClient from './settings-client'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: business }, { data: competitors }] = await Promise.all([
    supabase.from('businesses').select('*').eq('user_id', user.id).single(),
    supabase.from('competitors').select('*').eq('user_id', user.id).order('slot_number'),
  ])

  return (
    <SettingsClient
      business={business}
      competitors={competitors ?? []}
      userEmail={user.email ?? ''}
    />
  )
}
