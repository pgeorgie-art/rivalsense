import Link from 'next/link'

const FEATURES = [
  {
    icon: '🕷️',
    title: 'Automated Competitor Scraping',
    desc: 'Add up to 5 competitor URLs. LET scrapes their pricing, offers, and services automatically — no manual browsing required.',
  },
  {
    icon: '🧠',
    title: 'AI-Powered Insights',
    desc: 'Claude AI generates a SWOT analysis, pricing intelligence, and promo pattern detection for every competitor you track.',
  },
  {
    icon: '📊',
    title: 'Market Positioning Score',
    desc: 'Every competitor gets a 1–100 score based on pricing competitiveness and promotional activity so you know exactly where you stand.',
  },
  {
    icon: '🔔',
    title: 'Change Detection Alerts',
    desc: 'Get notified the moment a competitor changes their pricing or launches a new promotion. Never be caught off guard again.',
  },
  {
    icon: '💬',
    title: 'AI Chat Advisor',
    desc: 'Ask questions like "Should I match this promotion?" and get instant, contextual recommendations based on live competitor data.',
  },
  {
    icon: '⚡',
    title: '60-Second Setup',
    desc: 'Register, enter your business URL, add competitors, and your intelligence dashboard is live — no technical expertise needed.',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Nav */}
      <nav className="border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center p-1">
              <img src="/logo.jpg" alt="RivalSense AI" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-white">Rival<span className="text-red-500">Sense</span> <span className="text-slate-400 font-normal">AI</span></span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-slate-400 hover:text-white text-sm transition-colors">
              Log in
            </Link>
            <Link href="/signup"
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 text-blue-400 text-sm mb-6">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          AI-powered competitor intelligence
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-5">
          Know what your competitors<br className="hidden sm:block" />
          are doing — <span className="text-blue-400">in seconds</span>
        </h1>
        <p className="text-slate-400 text-lg leading-relaxed mb-8 max-w-2xl mx-auto">
          RivalSense AI automatically scrapes competitor pricing, detects promotions, and delivers AI-powered insights in a clean dashboard. Turn 5–10 hours of weekly research into seconds of strategic advantage.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/signup"
            className="bg-blue-600 hover:bg-blue-500 text-white px-7 py-3.5 rounded-xl font-semibold text-base transition-colors shadow-lg shadow-blue-500/20">
            Start tracking competitors free →
          </Link>
          <Link href="/login"
            className="border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white px-7 py-3.5 rounded-xl font-medium text-base transition-colors">
            Log in to dashboard
          </Link>
        </div>
        <p className="text-slate-500 text-sm mt-4">No credit card required · Up to 5 competitors · Live AI insights</p>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-white mb-2">Everything you need to stay ahead</h2>
          <p className="text-slate-400">One dashboard. All the intelligence. Zero manual research.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((feature, i) => (
            <div key={i} className="bg-slate-800 border border-slate-700 rounded-2xl p-6 hover:border-slate-600 transition-colors">
              <div className="text-3xl mb-3">{feature.icon}</div>
              <h3 className="text-white font-semibold mb-2">{feature.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-800">
        <div className="max-w-2xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Ready to get the edge?</h2>
          <p className="text-slate-400 mb-6">Set up in 60 seconds. Dashboard live in minutes.</p>
          <Link href="/signup"
            className="inline-block bg-blue-600 hover:bg-blue-500 text-white px-8 py-3.5 rounded-xl font-semibold transition-colors shadow-lg shadow-blue-500/20">
            Create free account →
          </Link>
        </div>
      </section>
    </div>
  )
}
