'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Check, ArrowRight, Loader2 } from 'lucide-react'

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
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
            step < current
              ? 'bg-primary text-primary-foreground'
              : step === current
              ? 'bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-card'
              : 'bg-muted text-muted-foreground'
          }`}>
            {step < current ? <Check className="w-3.5 h-3.5" /> : step}
          </div>
          {step < 3 && (
            <div className={`h-0.5 w-8 rounded-full transition-colors ${step < current ? 'bg-primary' : 'bg-border'}`} />
          )}
        </div>
      ))}
      <span className="ml-2 text-xs text-muted-foreground">Step {current} of 3</span>
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
      <h1 className="text-2xl font-bold text-foreground mb-1">Your business</h1>
      <p className="text-muted-foreground text-sm mb-6">
        This is your benchmark — we&apos;ll compare competitors against you
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Business name</Label>
          <Input
            id="name"
            type="text"
            required
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Glow Med Spa"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="url">Website URL</Label>
          <Input
            id="url"
            type="text"
            required
            value={form.url}
            onChange={e => set('url', e.target.value)}
            placeholder="glowmedspa.com"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            value={form.category}
            onChange={e => set('category', e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-input px-3 py-1 text-sm shadow-sm transition-colors text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Select a category</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              type="text"
              value={form.city}
              onChange={e => set('city', e.target.value)}
              placeholder="London"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="zip">ZIP / Postcode</Label>
            <Input
              id="zip"
              type="text"
              value={form.zip}
              onChange={e => set('zip', e.target.value)}
              placeholder="SW1A 1AA"
            />
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" disabled={loading} className="w-full mt-2">
          {loading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
          ) : (
            <>Continue <ArrowRight className="ml-2 h-4 w-4" /></>
          )}
        </Button>
      </form>
    </>
  )
}
