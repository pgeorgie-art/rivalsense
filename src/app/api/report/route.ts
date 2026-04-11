import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { callClaudeText } from '@/lib/claude'

export const maxDuration = 120

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()

    const [{ data: business }, { data: competitors }] = await Promise.all([
      admin.from('businesses').select('*').eq('user_id', user.id).single(),
      admin.from('competitors').select('*').eq('user_id', user.id).order('slot_number'),
    ])

    if (!business) return NextResponse.json({ error: 'No business found' }, { status: 404 })
    if (!competitors || competitors.length === 0) return NextResponse.json({ error: 'No competitors found' }, { status: 400 })

    const competitorIds = competitors.map(c => c.id)

    const { data: insights } = await admin
      .from('ai_insights')
      .select('*')
      .in('competitor_id', competitorIds)
      .order('generated_at', { ascending: false })

    type Insight = NonNullable<typeof insights>[number]
    const insightMap = new Map<string, Insight>()
    for (const insight of insights ?? []) {
      if (!insightMap.has(insight.competitor_id)) insightMap.set(insight.competitor_id, insight)
    }

    const { data: scores } = await admin
      .from('scores')
      .select('*')
      .in('entity_id', competitorIds)
      .order('calculated_at', { ascending: false })

    type Score = NonNullable<typeof scores>[number]
    const scoreMap = new Map<string, Score>()
    for (const score of scores ?? []) {
      if (!scoreMap.has(score.entity_id)) scoreMap.set(score.entity_id, score)
    }

    // Build context for Claude
    const competitorSummaries = competitors.map(c => {
      const insight = insightMap.get(c.id)
      const score = scoreMap.get(c.id)
      const name = c.name || new URL(c.url).hostname.replace('www.', '')
      const pricing = (insight?.parsed_pricing as Array<{service: string; price: string}> | null) ?? []
      const promos = (insight?.promo_patterns as string[] | null) ?? []
      const sentiment = insight?.sentiment as { overall?: string; rating_estimate?: string } | null
      return `
COMPETITOR: ${name} (Score: ${score?.score ?? 'N/A'}/100)
- Pricing Position: ${insight?.pricing_position ?? 'unknown'}
- Market Segment: ${insight?.market_positioning ?? 'unknown'}
- Promotions: ${promos.join(', ') || 'none detected'}
- Sentiment: ${sentiment?.overall ?? 'unknown'} (rating: ${sentiment?.rating_estimate ?? 'unknown'})
- Services: ${pricing.slice(0, 3).map(p => `${p.service} ${p.price}`).join(', ') || 'none detected'}
- Summary: ${insight?.summary_text ?? 'No data yet'}
`.trim()
    }).join('\n\n')

    const prompt = `You are a competitive intelligence analyst. Generate a concise weekly intelligence report for a local business.

BUSINESS: ${business.name}
Category: ${business.category || 'Local service'}
Location: ${business.city || 'Unknown'}

COMPETITOR DATA:
${competitorSummaries}

Write a structured weekly competitive intelligence report with these sections:
1. **Executive Summary** (2-3 sentences on the competitive landscape)
2. **Key Threats** (top 2-3 immediate threats to watch)
3. **Opportunities** (top 2-3 actionable opportunities to exploit)
4. **Pricing Strategy Recommendation** (specific pricing action to take this week)
5. **Promotional Recommendation** (one specific promotion to run to counter competitors)
6. **Competitor to Watch** (which competitor needs closest monitoring and why)

Keep it concise, actionable, and specific. Use bullet points. Focus on what the business owner should DO this week.`

    const reportText = await callClaudeText({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
    })

    // Store the report
    const { data: report, error: insertError } = await admin
      .from('reports')
      .insert({
        user_id: user.id,
        content: reportText,
        generated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      // Table might not exist yet — return content anyway
      console.error('[Report] Insert error:', insertError.message)
      return NextResponse.json({ success: true, content: reportText, id: null })
    }

    return NextResponse.json({ success: true, content: reportText, id: report?.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[Report] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
