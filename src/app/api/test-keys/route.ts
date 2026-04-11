import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import FirecrawlApp from '@mendable/firecrawl-js'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const results: Record<string, { ok: boolean; detail: string }> = {}

  // 1. Test Supabase
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('businesses').select('id').limit(1)
    results.supabase = error
      ? { ok: false, detail: error.message }
      : { ok: true, detail: 'Connected and tables exist' }
  } catch (e) {
    results.supabase = { ok: false, detail: String(e) }
  }

  // 2. Test Anthropic — try models from cheapest to most capable
  const modelsToTry = [
    'claude-haiku-4-5-20251001',
    'claude-3-5-haiku-20241022',
    'claude-3-haiku-20240307',
    'claude-sonnet-4-6',
  ]
  results.anthropic = { ok: false, detail: 'Not tested' }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  for (const model of modelsToTry) {
    try {
      const msg = await anthropic.messages.create({
        model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say: ok' }],
      })
      const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
      results.anthropic = { ok: true, detail: `Working with model: ${model} → "${text.trim()}"` }
      // Save working model to use in the app
      process.env.WORKING_CLAUDE_MODEL = model
      break
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      results.anthropic = { ok: false, detail: `${model}: ${msg}` }
    }
  }

  // 3. Test Firecrawl
  try {
    const fc = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! })
    // Just check the credit usage rather than doing a full scrape
    const result = await fc.scrape('https://example.com', { formats: ['markdown'] })
    const md = (result as { markdown?: string }).markdown
    results.firecrawl = md
      ? { ok: true, detail: 'Scrape successful — credits available' }
      : { ok: false, detail: 'Scrape returned no content' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    results.firecrawl = { ok: false, detail: msg }
  }

  const allOk = Object.values(results).every(r => r.ok)
  return NextResponse.json({ allOk, results }, { status: allOk ? 200 : 207 })
}
