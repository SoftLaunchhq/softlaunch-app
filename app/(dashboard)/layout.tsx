import { redirect } from "next/navigation"
import { auth, currentUser } from "@clerk/nextjs/server"
import Link from "next/link"
import Image from "next/image"
import { UserButton } from "@clerk/nextjs"
import { DashboardNav } from "@/components/dashboard/DashboardNav"
import { PartnerTrackingTrigger } from "@/components/PartnerTrackingTrigger"
import { db } from "@/lib/db"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const user = await currentUser()

  // ── ADMIN_EMAILS: primary source of truth for admin access ──────────────
  // Trim + lowercase both sides to prevent space / case / typo mismatches.
  const adminEmailsList = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  const clerkEmail =
    user?.emailAddresses[0]?.emailAddress?.toLowerCase()?.trim() ?? ""
  const isConfiguredAdmin = clerkEmail !== "" && adminEmailsList.includes(clerkEmail)

  // ── DB role check (confirms what's persisted, but not the only signal) ──
  // Fall back to email-based check when DB is down or role not yet updated.
  let isAdmin = isConfiguredAdmin
  try {
    const dbUser = await db.user.findUnique({
      where: { clerkId: userId },
      select: { role: true },
    })

    if (dbUser) {
      // DB ADMIN/FOUNDER always trusted; email config is also trusted
      isAdmin = dbUser.role === "ADMIN" || dbUser.role === "FOUNDER" || isConfiguredAdmin

      // Self-correct: if email is in ADMIN_EMAILS but DB still says USER, fix it now
      // (fire-and-forget — doesn't block the render)
      if (isConfiguredAdmin && dbUser.role === "USER") {
        db.user
          .update({ where: { clerkId: userId }, data: { role: "ADMIN" } })
          .catch((e) => console.error("[layout] Role self-correction failed:", e))
      }
    }
  } catch {
    // DB unavailable — isAdmin falls back to isConfiguredAdmin (set above)
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[ADMIN CHECK]", {
      clerkEmail,
      adminEmailCount: adminEmailsList.length,
      matched: isConfiguredAdmin,
      isAdmin,
    })
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      {/* Fires partner attribution when user first lands after sign-up */}
      <PartnerTrackingTrigger />
      <div className="mx-auto flex w-full max-w-[1440px] gap-0 md:gap-5 p-0 md:p-5">

        {/* ── Sidebar ── */}
        <aside className="hidden md:flex md:w-64 md:flex-shrink-0 md:flex-col sl-panel md:h-[calc(100vh-40px)] md:sticky md:top-5 p-5">
          {/* Logo */}
          <Link href="/dashboard" className="mb-8 flex items-center gap-2.5 group">
            <Image
              src="/logo.png"
              alt="SoftLaunch"
              width={44}
              height={40}
              className="object-contain flex-shrink-0"
            />
            <div>
              <p className="text-sm font-semibold text-brand-text leading-none">SoftLaunch</p>
              <p className="text-[10px] text-brand-text-subtle leading-none mt-0.5">Member Console</p>
            </div>
          </Link>

          {/* Nav */}
          <DashboardNav isAdmin={isAdmin} />

          {/* User footer */}
          <div className="mt-4 border-t border-brand-border pt-4">
            <div className="flex items-center gap-3">
              <UserButton afterSignOutUrl="/" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-brand-text">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="truncate text-xs text-brand-text-subtle">
                  {user?.emailAddresses[0]?.emailAddress}
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="flex-1 min-w-0">
          {/* Mobile topbar */}
          <div className="sl-panel flex items-center justify-between px-4 py-3 md:hidden rounded-none border-x-0 border-t-0">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="SoftLaunch" width={40} height={36} className="object-contain" />
              <span className="text-sm font-semibold text-brand-text">SoftLaunch</span>
            </Link>
            <UserButton afterSignOutUrl="/" />
          </div>

          <div className="p-4 md:p-0 md:pt-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
