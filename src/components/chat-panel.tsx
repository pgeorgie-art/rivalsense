'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { MessageSquare, X, Send, Trash2, Sparkles, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const EXAMPLE_PROMPTS = [
  'How do my competitors compare on pricing?',
  "Should I match this competitor's promotion?",
  'What\'s the biggest threat I should act on?',
  'What pricing gap can I exploit this week?',
]

function Markdown({ text }: { text: string }) {
  const html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground">$1</strong>')
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
  const contextLabel = contextEntityId ? 'Competitor context' : 'Dashboard context'

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

  return (
    <>
      {/* Floating trigger button */}
      <Button
        onClick={() => setOpen(prev => !prev)}
        size="icon"
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-2xl shadow-primary/25 z-40 hover:scale-105 transition-transform"
        aria-label="Toggle AI Chat"
      >
        {open ? <X className="w-5 h-5" /> : <MessageSquare className="w-6 h-6" />}
      </Button>

      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 sm:hidden backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Chat panel */}
      <div className={cn(
        'fixed bottom-0 right-0 z-50 flex flex-col w-full sm:w-96 h-[600px] sm:h-[580px] sm:bottom-6 sm:right-6',
        'bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-black/40',
        'transition-transform duration-300',
        open ? 'translate-y-0' : 'translate-y-full sm:translate-y-[calc(100%+2rem)]'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-foreground text-sm font-semibold leading-none">AI Advisor</p>
              <p className="text-muted-foreground text-xs">{contextLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 text-muted-foreground hover:text-destructive"
                onClick={() => { setMessages([]); setSessionId(null) }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 text-muted-foreground"
              onClick={() => setOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <Separator />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="text-muted-foreground text-xs text-center pt-2">
                {contextEntityId
                  ? 'Ask me anything about this competitor. I have full context of their pricing, promos, and SWOT.'
                  : 'Ask me anything about your competitive landscape. I have context of all your tracked competitors.'}
              </p>
              <div className="space-y-2">
                {EXAMPLE_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(prompt)}
                    className="w-full text-left px-3 py-2 bg-muted/40 hover:bg-muted border border-border hover:border-primary/30 rounded-lg text-muted-foreground hover:text-foreground text-xs transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-muted text-muted-foreground border border-border rounded-bl-sm'
              )}>
                {msg.role === 'assistant' ? <Markdown text={msg.content} /> : msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex items-center gap-1">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <Separator />

        {/* Input */}
        <div className="px-4 py-3 flex-shrink-0">
          <form
            onSubmit={e => { e.preventDefault(); sendMessage(input) }}
            className="flex gap-2 items-center"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about your competitors…"
              disabled={loading}
              className="flex-1 bg-input border border-border focus:border-primary rounded-xl px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:ring-1 focus:ring-ring"
            />
            <Button
              type="submit"
              size="icon"
              disabled={loading || !input.trim()}
              className="w-9 h-9 rounded-xl shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        </div>
      </div>
    </>
  )
}
