export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Subtle radial glow behind card */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex flex-col items-center gap-3 mb-2">
            <div className="bg-white rounded-xl p-2 shadow-lg shadow-black/40">
              <img src="/logo.jpg" alt="RivalSense AI" className="h-14 w-auto object-contain" />
            </div>
            <span className="text-2xl font-bold text-foreground tracking-tight">
              Rival<span className="text-red-500">Sense</span>{' '}
              <span className="text-muted-foreground font-normal">AI</span>
            </span>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            AI-powered competitor intelligence for local businesses
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 p-8">
          {children}
        </div>
      </div>
    </div>
  )
}
