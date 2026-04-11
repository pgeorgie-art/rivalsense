import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { chatWithContext } from '@/lib/claude'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages, contextScreen, contextEntityId, sessionId } = await request.json()

  // Build context data string from DB
  let contextData = ''

  if (contextEntityId) {
    // Competitor detail context
    const [{ data: competitor }, { data: insights }, { data: scores }] = await Promise.all([
      supabase.from('competitors').select('*').eq('id', contextEntityId).eq('user_id', user.id).single(),
      supabase.from('ai_insights').select('*').eq('competitor_id', contextEntityId).order('generated_at', { ascending: false }).limit(1),
      supabase.from('scores').select('*').eq('entity_id', contextEntityId).order('calculated_at', { ascending: false }).limit(1),
    ])

    if (competitor) {
      const insight = insights?.[0]
      const score = scores?.[0]
      contextData = `
Competitor: ${competitor.name || competitor.url}
URL: ${competitor.url}
Market Positioning Score: ${score?.score ?? 'N/A'}/100
Pricing Position: ${insight?.pricing_position ?? 'unknown'}
Summary: ${insight?.summary_text ?? 'Not available'}
Strengths: ${insight?.swot_strengths ?? 'N/A'}
Weaknesses: ${insight?.swot_weaknesses ?? 'N/A'}
Opportunities: ${insight?.swot_opportunities ?? 'N/A'}
Threats: ${insight?.swot_threats ?? 'N/A'}
Promo Patterns: ${((insight?.promo_patterns as string[]) ?? []).join(', ')}
Pricing: ${JSON.stringify(insight?.parsed_pricing ?? [])}
      `.trim()
    }
  } else {
    // Dashboard context — load all competitors summary
    const [{ data: business }, { data: competitors }, { data: allInsights }] = await Promise.all([
      supabase.from('businesses').select('*').eq('user_id', user.id).single(),
      supabase.from('competitors').select('*').eq('user_id', user.id).order('slot_number'),
      supabase.from('ai_insights').select('competitor_id, summary_text, pricing_position, promo_patterns').order('generated_at', { ascending: false }),
    ])

    type AiInsight = NonNullable<typeof allInsights>[number]
    const insightMap = new Map<string, AiInsight>()
    for (const i of allInsights ?? []) {
      if (!insightMap.has(i.competitor_id)) insightMap.set(i.competitor_id, i)
    }

    contextData = `
User's Business: ${business?.name ?? 'Unknown'} (${business?.category ?? ''}, ${business?.city ?? ''})
Competitors tracked: ${(competitors ?? []).length}

${(competitors ?? []).map(c => {
  const insight = insightMap.get(c.id)
  return `- ${c.name || c.url}: ${insight?.pricing_position ?? 'unknown'} pricing, promos: ${((insight?.promo_patterns as string[]) ?? []).join(', ')}`
}).join('\n')}
    `.trim()
  }

  // Get the latest user message
  const lastUserMessage = [...messages].reverse().find((m: {role: string}) => m.role === 'user')
  if (!lastUserMessage) return NextResponse.json({ error: 'No user message' }, { status: 400 })

  // Call Claude
  const reply = await chatWithContext(messages, contextData, contextScreen || 'dashboard')

  // Store/update chat session
  const allMessages = [...messages, { role: 'assistant', content: reply }]

  if (sessionId) {
    await supabase.from('chat_sessions').update({
      messages: allMessages,
      updated_at: new Date().toISOString(),
    }).eq('id', sessionId).eq('user_id', user.id)
  } else {
    await supabase.from('chat_sessions').insert({
      user_id: user.id,
      messages: allMessages,
      context_screen: contextScreen ?? 'dashboard',
      context_entity_id: contextEntityId ?? null,
    })
  }

  return NextResponse.json({ reply, messages: allMessages })
}
