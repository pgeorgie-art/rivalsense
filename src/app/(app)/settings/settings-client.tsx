'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Business {
  id: string
  name: string
  url: string
  category: string | null
  city: string | null
  zip: string | null
}

interface Competitor {
  id: string
  name: string | null
  url: string
  slot_number: number
}

const CATEGORIES = [
  'Med Spa', 'Salon & Beauty', 'Dental Clinic', 'Fitness & Gym',
  'Personal Training', 'Chiropractic', 'Massage Therapy', 'Skin Care',
  'Laser Clinic', 'Wellness Center', 'Veterinary / Breeder', 'Other',
]

export default function SettingsClient({
  business,
  competitors,
  userEmail,
}: {
  business: Business | null
  competitors: Competitor[]
  userEmail: string
}) {
  const router = useRouter()
  const supabase = createClient()

  const [bizForm, setBizForm] = useState({
    name: business?.name ?? '',
    url: business?.url ?? '',
    category: business?.category ?? '',
    city: business?.city ?? '',
    zip: business?.zip ?? '',
  })
  const [bizSaving, setBizSaving] = useState(false)
  const [bizSaved, setBizSaved] = useState(false)
  const [bizError, setBizError] = useState<string | null>(null)

  const [newUrl, setNewUrl] = useState('')
  const [addingUrl, setAddingUrl] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvResult, setCsvResult] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function setBiz(field: string, value: string) {
    setBizForm(prev => ({ ...prev, [field]: value }))
    setBizSaved(false)
  }

  async function saveBusiness(e: React.FormEvent) {
    e.preventDefault()
    setBizError(null)
    setBizSaving(true)

    let url = bizForm.url.trim()
    if (!url.startsWith('http')) url = 'https://' + url

    const { error } = await supabase.from('businesses').upsert({
      ...(business?.id ? { id: business.id } : {}),
      name: bizForm.name.trim(),
      url,
      category: bizForm.category,
      city: bizForm.city.trim(),
      zip: bizForm.zip.trim(),
    }, { onConflict: 'user_id' })

    if (error) { setBizError(error.message) }
    else { setBizSaved(true) }
    setBizSaving(false)
  }

  async function removeCompetitor(id: string) {
    setRemovingId(id)
    await supabase.from('competitors').delete().eq('id', id)
    router.refresh()
    setRemovingId(null)
  }

  async function addCompetitor(e: React.FormEvent) {
    e.preventDefault()
    setAddError(null)
    if (!newUrl.trim()) return
    if (competitors.length >= 5) { setAddError('Maximum 5 competitors allowed'); return }

    let url = newUrl.trim()
    if (!url.startsWith('http')) url = 'https://' + url

    try { new URL(url) } catch { setAddError('Invalid URL'); return }

    setAddingUrl(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const usedSlots = new Set(competitors.map(c => c.slot_number))
    let slot = 1
    while (usedSlots.has(slot)) slot++

    const { error } = await supabase.from('competitors').insert({
      user_id: user.id,
      url,
      slot_number: slot,
    })

    if (error) { setAddError(error.message) }
    else {
      setNewUrl('')
      router.refresh()
    }
    setAddingUrl(false)
  }

  async function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvResult(null)
    setAddError(null)
    setCsvImporting(true)

    try {
      const text = await file.text()
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      // Skip header row if it looks like a header
      const dataLines = lines[0]?.toLowerCase().includes('url') || lines[0]?.toLowerCase().includes('name')
        ? lines.slice(1) : lines

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const slotsAvailable = 5 - competitors.length
      const toImport = dataLines.slice(0, slotsAvailable)

      if (toImport.length === 0) {
        setCsvResult('No capacity — you already have 5 competitors tracked.')
        setCsvImporting(false)
        return
      }

      let imported = 0
      const usedSlots = new Set(competitors.map(c => c.slot_number))
      let slot = 1

      for (const line of toImport) {
        // Support: URL only, or "name,url" or "url,name" formats
        const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''))
        let url = ''
        let name = ''

        if (parts.length === 1) {
          url = parts[0]
        } else {
          // Detect which column is URL
          const urlCol = parts.find(p => p.startsWith('http') || p.includes('.'))
          url = urlCol ?? parts[0]
          name = parts.find(p => p !== url) ?? ''
        }

        if (!url.startsWith('http')) url = 'https://' + url

        try { new URL(url) } catch { continue }

        while (usedSlots.has(slot)) slot++
        if (slot > 5) break

        const { error } = await supabase.from('competitors').insert({
          user_id: user.id,
          url,
          name: name || null,
          slot_number: slot,
        })

        if (!error) {
          usedSlots.add(slot)
          imported++
          slot++
        }
      }

      setCsvResult(`Imported ${imported} competitor${imported !== 1 ? 's' : ''} successfully.`)
      router.refresh()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'CSV import failed')
    } finally {
      setCsvImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 text-sm mt-1">Manage your business profile and tracked competitors</p>
      </div>

      {/* Account info */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
        <h2 className="text-base font-semibold text-white mb-3">Account</h2>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
            <span className="text-blue-400 font-semibold text-sm">{userEmail[0]?.toUpperCase()}</span>
          </div>
          <div>
            <p className="text-white text-sm font-medium">{userEmail}</p>
            <p className="text-slate-500 text-xs">Account email</p>
          </div>
        </div>
      </div>

      {/* Business details */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
        <h2 className="text-base font-semibold text-white mb-4">Your Business</h2>
        <form onSubmit={saveBusiness} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Business name</label>
              <input type="text" required value={bizForm.name} onChange={e => setBiz('name', e.target.value)}
                placeholder="Glow Med Spa" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Website URL</label>
              <input type="text" required value={bizForm.url} onChange={e => setBiz('url', e.target.value)}
                placeholder="glowmedspa.com" className="input-field" />
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Category</label>
              <select value={bizForm.category} onChange={e => setBiz('category', e.target.value)} className="input-field">
                <option value="">Select…</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">City</label>
              <input type="text" value={bizForm.city} onChange={e => setBiz('city', e.target.value)}
                placeholder="London" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">ZIP / Postcode</label>
              <input type="text" value={bizForm.zip} onChange={e => setBiz('zip', e.target.value)}
                placeholder="SW1A 1AA" className="input-field" />
            </div>
          </div>

          {bizError && <p className="text-red-400 text-sm">{bizError}</p>}
          {bizSaved && <p className="text-blue-400 text-sm">Changes saved!</p>}

          <button type="submit" disabled={bizSaving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 text-white rounded-lg text-sm font-medium transition-colors">
            {bizSaving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>

      {/* Competitors */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Competitors</h2>
          <span className="text-xs text-slate-400">{competitors.length} / 5 slots used</span>
        </div>

        {/* List */}
        <div className="space-y-2 mb-4">
          {competitors.map(competitor => (
            <div key={competitor.id}
              className="flex items-center justify-between bg-slate-700/50 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs text-slate-500 font-medium w-5 flex-shrink-0">#{competitor.slot_number}</span>
                <div className="min-w-0">
                  {competitor.name && <p className="text-white text-sm font-medium truncate">{competitor.name}</p>}
                  <p className="text-slate-400 text-xs truncate">{competitor.url.replace(/^https?:\/\//, '').replace('www.', '')}</p>
                </div>
              </div>
              <button onClick={() => removeCompetitor(competitor.id)} disabled={removingId === competitor.id}
                className="ml-3 p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors flex-shrink-0">
                {removingId === competitor.id ? (
                  <div className="w-4 h-4 rounded-full border-2 border-red-400 border-t-transparent animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            </div>
          ))}

          {competitors.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-4">No competitors added yet</p>
          )}
        </div>

        {/* Add new */}
        {competitors.length < 5 && (
          <>
            <form onSubmit={addCompetitor} className="flex gap-2">
              <input type="text" value={newUrl} onChange={e => setNewUrl(e.target.value)}
                placeholder="Add competitor URL (e.g. competitor.com)"
                className="input-field flex-1 text-sm" />
              <button type="submit" disabled={addingUrl || !newUrl.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap">
                {addingUrl ? 'Adding…' : '+ Add'}
              </button>
            </form>

            {/* CSV Import */}
            <div className="border border-dashed border-slate-600 rounded-xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-slate-300 text-sm font-medium">Bulk import via CSV</p>
                  <p className="text-slate-500 text-xs mt-0.5">Upload a CSV file with competitor URLs (one per row)</p>
                </div>
                <label className="cursor-pointer">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleCsvImport}
                    disabled={csvImporting || competitors.length >= 5}
                    className="hidden"
                  />
                  <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    csvImporting || competitors.length >= 5
                      ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-300 cursor-pointer'
                  }`}>
                    {csvImporting ? (
                      <>
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
                        Importing…
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Upload CSV
                      </>
                    )}
                  </span>
                </label>
              </div>
              {csvResult && <p className="text-blue-400 text-xs mt-2">{csvResult}</p>}
            </div>
          </>
        )}
        {addError && <p className="text-red-400 text-sm mt-2">{addError}</p>}
      </div>
    </div>
  )
}
