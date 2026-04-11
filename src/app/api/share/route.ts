import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { competitor_id } = await req.json()
    if (!competitor_id) return NextResponse.json({ error: 'competitor_id required' }, { status: 400 })

    const admin = createAdminClient()

    // Verify ownership
    const { data: competitor } = await admin
      .from('competitors')
      .select('id, name, url')
      .eq('id', competitor_id)
      .eq('user_id', user.id)
      .single()

    if (!competitor) return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })

    // Create or get existing share token
    const { data: existing } = await admin
      .from('share_links')
      .select('token')
      .eq('competitor_id', competitor_id)
      .eq('user_id', user.id)
      .single()

    if (existing) {
      return NextResponse.json({ token: existing.token })
    }

    // Generate UUID token
    const token = crypto.randomUUID()

    const { error: insertError } = await admin.from('share_links').insert({
      token,
      competitor_id,
      user_id: user.id,
    })

    if (insertError) {
      console.error('[Share] Insert error:', insertError.message)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ token })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
