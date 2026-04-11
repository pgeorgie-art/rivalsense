'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const EXAMPLE_PROMPTS = [
  'How do my competitors compare on pricing?',
  'Should I match this competitor\'s promotion?',
  'What\'s the biggest threat I should act on?',
  'What pricing gap can I exploit this week?',
]

function Markdown({ text }: { text: string }) {
  const html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
    .replace(/\n/g, '<br/>')
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}

export default function ChatPanel() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pathname = usePathname()

  const competitorMatch = pathname.match(/^\/competitor\/([a-f0-9-]{36})/)
  const contextEntityId = competitorMatch ? competitorMatch[1] : undefined

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    setMessages([])
    setSessionId(null)
  }, [contextEntityId])

  async function sendMessage(content: string) {
    if (!content.trim() || loading) return
    const userMsg: Message = { role: 'user', content }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          contextScreen: pathname,
          contextEntityId: contextEntityId ?? null,
          sessionId,
        }),
      })
      const data = await res.json()
      if (data.reply) {
        setMessages([...newMessages, { role: 'assistant', content: data.reply }])
        if (data.sessionId && !sessionId) setSessionId(data.sessionId)
      }
    } catch {
      setMessages([...newMessages, {
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
      }])
    } finally {
      setLoading(false)
    }
  }

  const contextLabel = contextEntityId ? 'Competitor context' : 'Dashboard context'

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-105 z-40"
        aria-label="Toggle AI Chat">
        {open ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-40 sm:hidden" onClick={() => setOpen(false)} />
      )}

      <div className={`fixed bottom-0 right-0 z-50 flex flex-col w-full sm:w-96 h-[600px] sm:h-[580px] sm:bottom-6 sm:right-6 bg-slate-950 border border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-2xl transition-transform duration-300 ${
        open ? 'translate-y-0' : 'translate-y-full sm:translate-y-[calc(100%+2rem)]'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600/20 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <p className="text-white text-sm font-semibold leading-none">AI Advisor</p>
              <p className="text-slate-500 text-xs">{contextLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button onClick={() => { setMessages([]); setSessionId(null) }}
                className="p-1.5 text-slate-500 hover:text-slate-300 rounded transition-colors text-xs">
                Clear
              </button>
            )}
            <button onClick={() => setOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="text-slate-400 text-xs text-center pt-2">
                {contextEntityId
                  ? 'Ask me anything about this competitor. I have full context of their pricing, promos, and SWOT.'
                  : 'Ask me anything about your competitive landscape. I have context of all your tracked competitors.'}
              </p>
              <div className="space-y-2">
                {EXAMPLE_PROMPTS.map((prompt, i) => (
                  <button key={i} onClick={() => sendMessage(prompt)}
                    className="w-full text-left px-3 py-2 bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-blue-600/40 rounded-lg text-slate-300 text-xs transition-colors">
                    💬 {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-slate-800 text-slate-300 border border-slate-700 rounded-bl-sm'
              }`}>
                {msg.role === 'assistant' ? <Markdown text={msg.content} /> : msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex items-center gap-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-slate-800 flex-shrink-0">
          <form onSubmit={e => { e.preventDefault(); sendMessage(input) }} className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about your competitors…"
              disabled={loading}
              className="flex-1 bg-slate-800 border border-slate-700 focus:border-blue-500 text-white placeholder-slate-500 rounded-xl px-3.5 py-2 text-xs outline-none transition-colors"
            />
            <button type="submit" disabled={loading || !input.trim()}
              className="w-9 h-9 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-colors flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
