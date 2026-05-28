import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import Link from "next/link"
import { UserButton } from "@clerk/nextjs"
import {
  Zap,
  LayoutDashboard,
  Users,
  Group,
  Sparkles,
  Settings,
  Shield,
  UserRound,
} from "lucide-react"
import { db } from "@/lib/db"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId: clerkId } = await auth()
  if (!clerkId) redirect("/sign-in")

  // Check admin role
  const user = await db.user.findUnique({
    where: { clerkId },
    select: { role: true },
  })

  if (!user || (user.role !== "ADMIN" && user.role !== "FOUNDER")) {
    redirect("/dashboard")
  }

  const navItems = [
    { href: "/admin",          icon: LayoutDashboard, label: "Overview" },
    { href: "/admin/users",    icon: Users,            label: "Users" },
    { href: "/admin/cohorts",  icon: Group,            label: "Cohorts" },
    { href: "/admin/matching", icon: Sparkles,         label: "Cohort Matching" },
    { href: "/admin/one-on-one", icon: UserRound,      label: "1-on-1 Matching" },
  ]

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="mx-auto flex w-full max-w-[1600px] gap-5 p-4 md:p-6">
        <aside className="neon-panel hidden w-72 flex-shrink-0 flex-col p-5 md:flex">
          <Link href="/admin" className="mb-2 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm text-brand-text">SoftLaunch</p>
              <p className="text-xs text-brand-text-subtle">Control Center</p>
            </div>
          </Link>
          <div className="mb-6 flex items-center gap-1.5">
            <Shield className="h-3 w-3 text-brand-accent" />
            <span className="text-xs font-medium text-brand-accent">Admin Panel</span>
          </div>

          <nav className="flex-1 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-brand-text-muted transition-all hover:border-brand-accent/20 hover:bg-brand-accent/10 hover:text-brand-text"
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-5 space-y-2 border-t border-brand-border pt-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs text-brand-text-subtle transition-colors hover:text-brand-text"
            >
              ← Back to app
            </Link>
            <div className="px-3 py-2">
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-auto">
          <div className="mb-4 flex flex-wrap gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex items-center gap-2 rounded-xl border border-brand-border bg-brand-surface/60 px-3 py-2 text-sm text-brand-text-muted transition-all hover:border-brand-accent/30 hover:bg-brand-accent/10 hover:text-brand-text"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </div>

          <div className="max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
