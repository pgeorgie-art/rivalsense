'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const CATEGORIES = [
  'Med Spa', 'Salon & Beauty', 'Dental Clinic', 'Fitness & Gym',
  'Personal Training', 'Chiropractic', 'Massage Therapy', 'Skin Care',
  'Laser Clinic', 'Wellness Center', 'Veterinary / Breeder', 'Other',
]

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

export default function OnboardingStep1() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', url: '', category: '', city: '', zip: '' })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Normalise URL
    let url = form.url.trim()
    if (!url.startsWith('http')) url = 'https://' + url

    const { error } = await supabase.from('businesses').upsert({
      user_id: user.id,
      name: form.name.trim(),
      url,
      category: form.category,
      city: form.city.trim(),
      zip: form.zip.trim(),
    }, { onConflict: 'user_id' })

    if (error) { setError(error.message); setLoading(false); return }
    router.push('/onboarding/step-2')
  }

  return (
    <>
      <StepIndicator current={1} />
      <h1 className="text-2xl font-bold text-white mb-1">Your business</h1>
      <p className="text-slate-400 text-sm mb-6">This is your benchmark — we&apos;ll compare competitors against you</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Business name</label>
          <input type="text" required value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="Glow Med Spa" className="input-field" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Website URL</label>
          <input type="text" required value={form.url} onChange={e => set('url', e.target.value)}
            placeholder="glowmedspa.com" className="input-field" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Category</label>
          <select value={form.category} onChange={e => set('category', e.target.value)}
            className="input-field">
            <option value="">Select a category</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">City</label>
            <input type="text" value={form.city} onChange={e => set('city', e.target.value)}
              placeholder="London" className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">ZIP / Postcode</label>
            <input type="text" value={form.zip} onChange={e => set('zip', e.target.value)}
              placeholder="SW1A 1AA" className="input-field" />
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <button type="submit" disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition-colors mt-2">
          {loading ? 'Saving...' : 'Continue →'}
        </button>
      </form>
    </>
  )
}
