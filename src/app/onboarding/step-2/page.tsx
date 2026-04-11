'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {[1, 2, 3].map((step) => (
        <div key={step} className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
            step < current ? 'bg-blue-500 text-white' :
            step === current ? 'bg-blue-600 text-white ring-2 ring-blue-400' :
            'bg-slate-700 text-slate-400'
          }`}>
            {step < current ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            ) : step}
          </div>
          {step < 3 && <div className={`h-0.5 w-8 ${step < current ? 'bg-blue-500' : 'bg-slate-700'}`} />}
        </div>
      ))}
      <span className="ml-2 text-xs text-slate-400">Step {current} of 3</span>
    </div>
  )
}

function isValidUrl(url: string) {
  try {
    const u = url.startsWith('http') ? url : 'https://' + url
    new URL(u)
    return true
  } catch { return false }
}

const MAX_SLOTS = 5

export default function OnboardingStep2() {
  const router = useRouter()
  const [slots, setSlots] = useState<string[]>([''])
  const [errors, setErrors] = useState<string[]>([''])
  const [loading, setLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Load existing competitors if any
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from('competitors').select('url, slot_number').order('slot_number')
      if (data && data.length > 0) {
        const urls = data.map(d => d.url)
        setSlots(urls.length < MAX_SLOTS ? [...urls, ''] : urls)
        setErrors(Array(urls.length < MAX_SLOTS ? urls.length + 1 : urls.length).fill(''))
      }
    }
    load()
  }, [])

  function updateSlot(idx: number, value: string) {
    setSlots(prev => { const next = [...prev]; next[idx] = value; return next })
    setErrors(prev => { const next = [...prev]; next[idx] = ''; return next })
  }

  function addSlot() {
    if (slots.length < MAX_SLOTS) {
      setSlots(prev => [...prev, ''])
      setErrors(prev => [...prev, ''])
    }
  }

  function removeSlot(idx: number) {
    setSlots(prev => prev.filter((_, i) => i !== idx))
    setErrors(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaveError(null)

    const filled = slots.filter(s => s.trim())
    if (filled.length === 0) { setSaveError('Add at least 1 competitor URL'); return }

    // Validate URLs
    const newErrors = slots.map(s => s.trim() && !isValidUrl(s) ? 'Invalid URL' : '')
    if (newErrors.some(Boolean)) { setErrors(newErrors); return }

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Delete existing competitors, re-insert fresh
    await supabase.from('competitors').delete().eq('user_id', user.id)

    const toInsert = filled.map((url, idx) => ({
      user_id: user.id,
      url: url.startsWith('http') ? url : 'https://' + url,
      slot_number: idx + 1,
    }))

    const { error } = await supabase.from('competitors').insert(toInsert)
    if (error) { setSaveError(error.message); setLoading(false); return }

    router.push('/onboarding/step-3')
  }

  const filledCount = slots.filter(s => s.trim()).length

  return (
    <>
      <StepIndicator current={2} />
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-white">Add competitors</h1>
        <span className="text-sm font-medium text-blue-400">{filledCount}/{MAX_SLOTS} added</span>
      </div>
      <p className="text-slate-400 text-sm mb-6">Add up to 5 competitor websites. We&apos;ll scrape and analyse them automatically.</p>

      <form onSubmit={handleSubmit} className="space-y-3">
        {slots.map((url, idx) => (
          <div key={idx} className="flex gap-2">
            <div className="flex-1">
              <div className="flex items-center bg-slate-700 border border-slate-600 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
                <span className="px-3 text-slate-400 text-xs font-medium whitespace-nowrap border-r border-slate-600 py-2.5">
                  Slot {idx + 1}
                </span>
                <input
                  type="text"
                  value={url}
                  onChange={e => updateSlot(idx, e.target.value)}
                  placeholder="competitor-site.com"
                  className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder-slate-400 outline-none"
                />
              </div>
              {errors[idx] && <p className="text-red-400 text-xs mt-1">{errors[idx]}</p>}
            </div>
            {slots.length > 1 && (
              <button type="button" onClick={() => removeSlot(idx)}
                className="p-2.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}

        {slots.length < MAX_SLOTS && (
          <button type="button" onClick={addSlot}
            className="w-full border border-dashed border-slate-600 hover:border-blue-500 text-slate-400 hover:text-blue-400 rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add another competitor
          </button>
        )}

        {saveError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
            <p className="text-red-400 text-sm">{saveError}</p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.push('/onboarding/step-1')}
            className="px-4 py-2.5 text-slate-400 hover:text-white border border-slate-600 hover:border-slate-500 rounded-lg text-sm transition-colors">
            ← Back
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition-colors">
            {loading ? 'Saving...' : 'Start analysing →'}
          </button>
        </div>
      </form>
    </>
  )
}
