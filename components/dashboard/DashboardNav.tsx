"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, User, CreditCard, Zap, Shield, UserRound } from "lucide-react"

const MEMBER_NAV = [
  { href: "/dashboard",            icon: LayoutDashboard, label: "Dashboard" },
  { href: "/dashboard/buzz",       icon: Zap,             label: "BUZZ",         badge: "AI" },
  { href: "/dashboard/one-on-one", icon: UserRound,       label: "1-on-1 Match", badge: "New" },
  { href: "/dashboard/profile",    icon: User,            label: "My Profile" },
  { href: "/dashboard/billing",    icon: CreditCard,      label: "Billing" },
]

const ADMIN_NAV_ITEM = {
  href: "/admin",
  icon: Shield,
  label: "Admin Panel",
  badge: "⚡",
  isAdminLink: true,
}

export function DashboardNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname()

  const items = isAdmin ? [...MEMBER_NAV, ADMIN_NAV_ITEM] : MEMBER_NAV

  return (
    <nav className="flex-1 space-y-1">
      {items.map((item) => {
        const isActive =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href)

        const isAdminLink = "isAdminLink" in item && item.isAdminLink

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
              isAdminLink
                ? isActive
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                  : "text-brand-text-muted hover:bg-amber-500/10 hover:text-amber-400 border border-transparent"
                : isActive
                ? "bg-brand-primary/10 text-brand-primary border border-brand-primary/20"
                : "text-brand-text-muted hover:bg-brand-surface hover:text-brand-text border border-transparent"
            }`}
          >
            <item.icon
              className={`h-4 w-4 flex-shrink-0 ${
                isAdminLink && !isActive ? "text-amber-500/70" : ""
              }`}
            />
            <span className="flex-1">{item.label}</span>
            {"badge" in item && item.badge && (
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                  isAdminLink
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-brand-primary/20 text-brand-primary"
                }`}
              >
                {item.badge}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
