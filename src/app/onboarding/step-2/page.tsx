'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Check, ArrowLeft, ArrowRight, Plus, X, Loader2 } from 'lucide-react'

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

function isValidUrl(url: string) {
  try {
    new URL(url.startsWith('http') ? url : 'https://' + url)
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

    const newErrors = slots.map(s => s.trim() && !isValidUrl(s) ? 'Invalid URL' : '')
    if (newErrors.some(Boolean)) { setErrors(newErrors); return }

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

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
        <h1 className="text-2xl font-bold text-foreground">Add competitors</h1>
        <Badge variant="secondary" className="text-primary">
          {filledCount}/{MAX_SLOTS} added
        </Badge>
      </div>
      <p className="text-muted-foreground text-sm mb-6">
        Add up to 5 competitor websites. We&apos;ll scrape and analyse them automatically.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        {slots.map((url, idx) => (
          <div key={idx}>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center border border-input bg-input rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-ring transition-shadow">
                <span className="px-3 text-muted-foreground text-xs font-medium whitespace-nowrap border-r border-border py-2.5 bg-muted/30">
                  {idx + 1}
                </span>
                <input
                  type="text"
                  value={url}
                  onChange={e => updateSlot(idx, e.target.value)}
                  placeholder="competitor-site.com"
                  className="flex-1 bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none"
                />
              </div>
              {slots.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSlot(idx)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            {errors[idx] && (
              <p className="text-destructive text-xs mt-1">{errors[idx]}</p>
            )}
          </div>
        ))}

        {slots.length < MAX_SLOTS && (
          <Button
            type="button"
            variant="outline"
            onClick={addSlot}
            className="w-full border-dashed gap-2 text-muted-foreground hover:text-foreground"
          >
            <Plus className="w-4 h-4" />
            Add another competitor
          </Button>
        )}

        {saveError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/onboarding/step-1')}
            className="gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <Button type="submit" disabled={loading} className="flex-1 gap-1.5">
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
            ) : (
              <>Start analysing <ArrowRight className="h-4 w-4" /></>
            )}
          </Button>
        </div>
      </form>
    </>
  )
}
