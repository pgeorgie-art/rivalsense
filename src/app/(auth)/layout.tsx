export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex flex-col items-center gap-3 mb-2">
            <div className="bg-white rounded-xl p-2 shadow-lg">
              <img src="/logo.jpg" alt="RivalSense AI" className="h-14 w-auto object-contain" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">
              Rival<span className="text-red-500">Sense</span> <span className="text-slate-400">AI</span>
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">AI-powered competitor intelligence for local businesses</p>
        </div>
        {/* Auth Card */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl shadow-2xl p-8">
          {children}
        </div>
      </div>
    </div>
  )
}
