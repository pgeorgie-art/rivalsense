'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  LayoutDashboard,
  BarChart2,
  FileText,
  Settings,
  LogOut,
} from 'lucide-react'

export default function Nav({ unreadAlerts = 0 }: { unreadAlerts?: number }) {
  const pathname = usePathname()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  async function signOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const links = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/compare',   label: 'Compare',   icon: BarChart2 },
    { href: '/report',    label: 'Report',     icon: FileText },
    { href: '/settings',  label: 'Settings',   icon: Settings },
  ]

  return (
    <nav className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo + nav links */}
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
            <div className="bg-white rounded-lg p-1 flex items-center justify-center">
              <img src="/logo.jpg" alt="RivalSense AI" className="h-6 w-auto object-contain" />
            </div>
            <span className="font-bold text-foreground text-sm hidden sm:block">
              Rival<span className="text-red-500">Sense</span>{' '}
              <span className="text-muted-foreground font-normal">AI</span>
            </span>
          </Link>

          <Separator orientation="vertical" className="h-5 hidden sm:block" />

          <div className="flex items-center gap-0.5">
            {links.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link key={href} href={href}>
                  <Button
                    variant={active ? 'secondary' : 'ghost'}
                    size="sm"
                    className={`relative gap-1.5 ${active ? 'text-primary' : 'text-muted-foreground'}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{label}</span>
                    {href === '/dashboard' && unreadAlerts > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-1.5 -right-1.5 h-4 w-4 p-0 text-[10px] flex items-center justify-center"
                      >
                        {unreadAlerts > 9 ? '9+' : unreadAlerts}
                      </Badge>
                    )}
                  </Button>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Sign out */}
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          disabled={signingOut}
          className="gap-1.5 text-muted-foreground"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">{signingOut ? 'Signing out…' : 'Sign out'}</span>
        </Button>
      </div>
    </nav>
  )
}
