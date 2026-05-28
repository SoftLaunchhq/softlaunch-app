"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CheckCircle2, Compass, ListChecks, Sparkles, UserRound } from "lucide-react"

const items = [
  { href: "/onboarding/welcome", label: "Welcome", icon: Compass },
  { href: "/onboarding/assessment", label: "Assessment", icon: ListChecks },
  { href: "/onboarding/reveal", label: "Profile Reveal", icon: Sparkles },
  { href: "/onboarding/profile", label: "Your Profile", icon: UserRound },
]

export function OnboardingTabs() {
  const pathname = usePathname()

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {items.map((item) => {
        const active = pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`
              inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all
              ${active
                ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-100"
                : "border-brand-border bg-brand-surface/60 text-brand-text-muted hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-brand-text"}
            `}
          >
            {active ? <CheckCircle2 className="h-4 w-4" /> : <item.icon className="h-4 w-4" />}
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}
