import { db } from "@/lib/db"
import Link from "next/link"
import {
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  CreditCard,
  Search,
  ArrowRight,
  Zap,
  AlertCircle,
} from "lucide-react"
import { formatRelativeDate, cohortThemeLabel } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────

async function getUsers() {
  return db.user.findMany({
    where: { role: { not: "ADMIN" } }, // Exclude admin accounts from queue view
    include: {
      profile: true,
      driveProfile: true,
      subscription: true,
      memberships: {
        include: {
          cohort: { select: { id: true, name: true, status: true, currentWeek: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  })
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function statusBadge(user: Awaited<ReturnType<typeof getUsers>>[number]) {
  const membership = user.memberships[0]

  if (!user.onboardingComplete) {
    return { label: "Onboarding", color: "text-amber-200 bg-amber-300/10 border-amber-300/20" }
  }
  if (!membership) {
    return { label: "In Queue", color: "text-brand-primary bg-brand-primary/10 border-brand-primary/20" }
  }
  if (membership.status === "PENDING") {
    return { label: "Match Pending", color: "text-brand-accent bg-brand-accent/10 border-brand-accent/20" }
  }
  if (membership.status === "ACTIVE") {
    return { label: `Active, Wk ${membership.cohort.currentWeek}`, color: "text-emerald-200 bg-emerald-300/10 border-emerald-300/20" }
  }
  if (membership.status === "CHURNED") {
    return { label: "Churned", color: "text-red-300 bg-red-400/10 border-red-400/20" }
  }
  return { label: membership.status, color: "text-brand-text-muted bg-brand-surface border-brand-border" }
}

function waitDays(createdAt: Date) {
  return Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
}

// ─────────────────────────────────────────────────────────────
// ARCHETYPE GLYPH
// ─────────────────────────────────────────────────────────────

const ARCHETYPE_COLORS: Record<string, string> = {
  "the-pioneer": "bg-violet-500/20 text-violet-200 border-violet-400/20",
  "the-builder": "bg-brand-primary/20 text-brand-primary border-brand-primary/20",
  "the-connector": "bg-brand-secondary/20 text-brand-secondary border-brand-secondary/20",
  "the-disciplined": "bg-emerald-500/20 text-emerald-200 border-emerald-400/20",
  "the-creative": "bg-amber-500/20 text-amber-200 border-amber-400/20",
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────

export default async function AdminUsersPage() {
  const users = await getUsers()

  const stats = {
    total: users.length,
    onboarding: users.filter((u) => !u.onboardingComplete).length,
    inQueue: users.filter(
      (u) => u.onboardingComplete && u.memberships.length === 0
    ).length,
    active: users.filter(
      (u) => u.memberships[0]?.status === "ACTIVE"
    ).length,
    subscribed: users.filter(
      (u) => u.subscription?.status === "ACTIVE"
    ).length,
  }

  const urgentQueue = users.filter(
    (u) => u.onboardingComplete && u.memberships.length === 0 && waitDays(u.createdAt) >= 5
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-text">Users</h1>
        <p className="mt-1 text-sm text-brand-text-muted">
          {stats.total} total · {stats.inQueue} in queue · {stats.active} active in cohort
        </p>
      </div>

      {/* Stat row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Users", value: stats.total, icon: Users, color: "text-brand-primary" },
          { label: "In Queue", value: stats.inQueue, icon: Clock, color: "text-brand-accent" },
          { label: "In Cohort", value: stats.active, icon: CheckCircle2, color: "text-brand-secondary" },
          { label: "Subscribed", value: stats.subscribed, icon: CreditCard, color: "text-brand-primary" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-3 rounded-xl border border-brand-border bg-brand-surface p-4"
          >
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-brand-bg ${stat.color}`}>
              <stat.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xl font-bold text-brand-text">{stat.value}</p>
              <p className="text-xs text-brand-text-subtle">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Urgent queue alert */}
      {urgentQueue.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/10 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
          <div>
            <p className="text-sm font-medium text-amber-200">
              {urgentQueue.length} user{urgentQueue.length > 1 ? "s" : ""} waiting 5+ days without a cohort
            </p>
            <p className="mt-0.5 text-xs text-amber-300/70">
              {urgentQueue
                .map(
                  (u) =>
                    `${u.profile?.firstName ?? u.email} (${waitDays(u.createdAt)}d)`
                )
                .join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* User table */}
      <div className="rounded-2xl border border-brand-border overflow-hidden">
        <div className="border-b border-brand-border bg-brand-surface/80 px-5 py-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-text-subtle">
            All Users ({users.length})
          </p>
          <Link
            href="/admin/matching"
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border bg-brand-bg px-3 py-1.5 text-xs font-medium text-brand-text-muted transition-all hover:border-brand-primary/30 hover:text-brand-primary"
          >
            <Zap className="h-3 w-3" />
            Run matching
          </Link>
        </div>

        <div className="divide-y divide-brand-border">
          {users.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Users className="h-8 w-8 text-brand-text-subtle" />
              <p className="text-sm text-brand-text-muted">No users yet.</p>
            </div>
          )}

          {users.map((user) => {
            const badge = statusBadge(user)
            const membership = user.memberships[0]
            const archetypeColor =
              ARCHETYPE_COLORS[user.driveProfile?.archetypeSlug ?? ""] ??
              "bg-brand-surface text-brand-text-muted border-brand-border"
            const days = waitDays(user.createdAt)

            return (
              <div
                key={user.id}
                className="group flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-brand-surface/50 md:flex-row md:items-center md:gap-4"
              >
                {/* Avatar */}
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-gradient text-sm font-bold text-white">
                  {user.profile?.firstName?.[0] ?? user.email[0].toUpperCase()}
                </div>

                {/* Identity */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-brand-text truncate">
                      {user.profile
                        ? `${user.profile.firstName} ${user.profile.lastName}`
                        : user.email}
                    </p>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${badge.color}`}
                    >
                      {badge.label}
                    </span>
                    {days >= 5 && !membership && user.onboardingComplete && (
                      <span className="inline-flex items-center rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-300">
                        {days}d waiting
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-brand-text-subtle truncate">
                    {user.email}
                    {user.profile?.headline ? ` · ${user.profile.headline}` : ""}
                  </p>
                </div>

                {/* Archetype */}
                <div className="hidden flex-shrink-0 md:block">
                  {user.driveProfile ? (
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${archetypeColor}`}
                    >
                      {user.driveProfile.archetype}
                    </span>
                  ) : (
                    <span className="text-xs text-brand-text-subtle italic">
                      {user.onboardingComplete ? "No assessment" : "Incomplete"}
                    </span>
                  )}
                </div>

                {/* Cohort */}
                <div className="hidden min-w-[140px] flex-shrink-0 md:block">
                  {membership ? (
                    <Link
                      href={`/admin/cohorts/${membership.cohort.id}`}
                      className="text-xs text-brand-primary hover:underline"
                    >
                      {membership.cohort.name}
                    </Link>
                  ) : (
                    <span className="text-xs text-brand-text-subtle">—</span>
                  )}
                </div>

                {/* Billing */}
                <div className="hidden flex-shrink-0 md:block">
                  {user.subscription?.status === "ACTIVE" ? (
                    <span className="text-xs font-medium text-emerald-300">Subscribed</span>
                  ) : (
                    <span className="text-xs text-brand-text-subtle">Free trial</span>
                  )}
                </div>

                {/* Joined */}
                <div className="hidden flex-shrink-0 md:block text-xs text-brand-text-subtle">
                  {formatRelativeDate(user.createdAt)}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 md:flex-shrink-0">
                  {user.onboardingComplete && !membership && (
                    <Link
                      href={`/admin/matching?highlight=${user.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-brand-primary/25 bg-brand-primary/10 px-3 py-1.5 text-xs font-medium text-brand-primary transition-all hover:bg-brand-primary/20"
                    >
                      <Zap className="h-3 w-3" />
                      Match
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Onboarding incomplete section */}
      {stats.onboarding > 0 && (
        <div className="rounded-2xl border border-brand-border overflow-hidden">
          <div className="border-b border-brand-border bg-brand-surface/80 px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-text-subtle">
              Onboarding Incomplete ({stats.onboarding})
            </p>
          </div>
          <div className="divide-y divide-brand-border">
            {users
              .filter((u) => !u.onboardingComplete)
              .map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-4 px-5 py-3"
                >
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-surface border border-brand-border text-xs font-bold text-brand-text-subtle">
                    {user.email[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-brand-text-muted truncate">{user.email}</p>
                    <p className="text-xs text-brand-text-subtle">
                      Step: {user.onboardingStep} · Joined {formatRelativeDate(user.createdAt)}
                    </p>
                  </div>
                  <XCircle className="h-4 w-4 text-brand-text-subtle flex-shrink-0" />
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
