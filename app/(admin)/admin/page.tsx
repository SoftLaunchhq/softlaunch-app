import { db } from "@/lib/db"
import { formatCurrency, formatRelativeDate } from "@/lib/utils"
import { PARTNERS } from "@/lib/partners"
import Link from "next/link"
import { AlertCircle, Clock, TrendingUp, Users, Group, CreditCard, CheckCircle2, Handshake } from "lucide-react"

async function getAdminStats() {
  const [
    totalUsers,
    usersInPool,
    activeCohorts,
    pendingApproval,
    completedCohorts,
    activeSubscriptions,
    recentFeedback,
    longWaitUsers,
    partnerCounts,
  ] = await Promise.all([
    db.user.count({ where: { onboardingComplete: true } }),
    db.user.count({
      where: {
        onboardingComplete: true,
        memberships: { none: { status: { in: ["ACTIVE", "PENDING"] } } },
      },
    }),
    db.cohort.count({ where: { status: "ACTIVE" } }),
    db.cohort.count({ where: { status: "PENDING_APPROVAL" } }),
    db.cohort.count({ where: { status: "COMPLETED" } }),
    db.subscription.count({ where: { status: "ACTIVE" } }),
    db.feedback.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      include: {
        user: { include: { profile: true } },
        cohort: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.user.findMany({
      where: {
        onboardingComplete: true,
        createdAt: { lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        memberships: { none: {} },
      },
      include: { profile: true },
      orderBy: { createdAt: "asc" },
      take: 10,
    }),
    // Partner analytics — select partnerSource for all attributed users
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db.user.findMany as any)({
      where: { partnerSource: { not: null } },
      select: { partnerSource: true },
    }) as Promise<{ partnerSource: string | null }[]>,
  ])

  // MRR calculation
  const subscriptions = await db.subscription.findMany({
    where: { status: "ACTIVE" },
    select: { amount: true },
  })
  const mrr = subscriptions.reduce((sum, s) => sum + (s.amount || 0), 0)

  // Active benefits count
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeBenefits = await (db.user.count as any)({ where: { partnerBenefitActive: true } }) as number

  // Group partnerCounts by source in JS
  const partnerCountMap: Record<string, number> = {}
  for (const row of partnerCounts) {
    const src = row.partnerSource ?? "unknown"
    partnerCountMap[src] = (partnerCountMap[src] ?? 0) + 1
  }
  const partnerBreakdown = Object.entries(partnerCountMap)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)

  return {
    totalUsers,
    usersInPool,
    activeCohorts,
    pendingApproval,
    completedCohorts,
    activeSubscriptions,
    mrr,
    recentFeedback,
    longWaitUsers,
    partnerBreakdown,
    activeBenefits,
  }
}

export default async function AdminOverviewPage() {
  const stats = await getAdminStats()

  const statCards = [
    {
      label: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
    },
    {
      label: "In Matching Pool",
      value: stats.usersInPool,
      icon: Clock,
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/20",
    },
    {
      label: "Active Cohorts",
      value: stats.activeCohorts,
      icon: Group,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
    },
    {
      label: "Pending Approval",
      value: stats.pendingApproval,
      icon: AlertCircle,
      color: "text-brand-primary",
      bg: "bg-brand-primary/10 border-brand-primary/20",
      urgent: stats.pendingApproval > 0,
      href: "/admin/cohorts",
    },
    {
      label: "Active Subscribers",
      value: stats.activeSubscriptions,
      icon: CreditCard,
      color: "text-pink-400",
      bg: "bg-pink-500/10 border-pink-500/20",
    },
    {
      label: "MRR",
      value: formatCurrency(stats.mrr),
      icon: TrendingUp,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-text">Admin Overview</h1>
        <p className="text-brand-text-muted text-sm mt-1">
          Charlotte Beta · {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={`
              relative rounded-xl border p-5 transition-all
              ${card.bg}
              ${card.urgent ? "ring-1 ring-brand-primary/40" : ""}
              ${card.href ? "hover:scale-[1.01] cursor-pointer" : ""}
            `}
          >
            {card.href ? (
              <Link href={card.href} className="absolute inset-0" />
            ) : null}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-brand-text-subtle uppercase tracking-wider">
                {card.label}
              </span>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <div className={`font-display text-3xl font-bold ${card.color}`}>
              {card.value}
            </div>
            {card.urgent && (
              <div className="mt-2 text-xs text-brand-primary font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse inline-block" />
                Needs attention
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Action Queue */}
        <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
          <h2 className="font-semibold text-brand-text mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-brand-warning" />
            Action Queue
          </h2>
          <div className="space-y-2">
            {stats.pendingApproval > 0 && (
              <Link
                href="/admin/cohorts"
                className="flex items-center justify-between p-3 rounded-lg bg-brand-primary/10 border border-brand-primary/20 hover:bg-brand-primary/15 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-brand-primary animate-pulse" />
                  <span className="text-sm font-medium text-brand-text">
                    {stats.pendingApproval} cohort{stats.pendingApproval > 1 ? "s" : ""} pending approval
                  </span>
                </div>
                <span className="text-xs text-brand-primary">Review →</span>
              </Link>
            )}

            {stats.usersInPool >= 4 && (
              <Link
                href="/admin/matching"
                className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-sm font-medium text-brand-text">
                    {stats.usersInPool} users ready to match
                  </span>
                </div>
                <span className="text-xs text-amber-400">Run matching →</span>
              </Link>
            )}

            {stats.longWaitUsers.length > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-brand-surface border border-brand-border">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-brand-text-subtle" />
                  <span className="text-sm text-brand-text-muted">
                    {stats.longWaitUsers.length} users waiting 7+ days
                  </span>
                </div>
                <Link href="/admin/users" className="text-xs text-brand-text-subtle hover:text-brand-text">
                  View →
                </Link>
              </div>
            )}

            {stats.pendingApproval === 0 && stats.usersInPool < 4 && (
              <div className="text-sm text-brand-text-subtle text-center py-4">
                All clear — no urgent actions.
              </div>
            )}
          </div>
        </div>

        {/* Recent Feedback */}
        <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
          <h2 className="font-semibold text-brand-text mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-brand-success" />
            Recent Feedback
          </h2>
          {stats.recentFeedback.length === 0 ? (
            <p className="text-sm text-brand-text-subtle text-center py-4">
              No feedback yet this week.
            </p>
          ) : (
            <div className="space-y-3">
              {stats.recentFeedback.map((fb) => (
                <div key={fb.id} className="flex items-center justify-between py-2 border-b border-brand-border last:border-0">
                  <div>
                    <p className="text-sm font-medium text-brand-text">
                      {fb.user.profile?.firstName} {fb.user.profile?.lastName}
                    </p>
                    <p className="text-xs text-brand-text-subtle">
                      {fb.cohort.name} · Week {fb.weekNumber}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {fb.sessionRating && (
                      <span className="text-xs text-brand-primary font-semibold">
                        {fb.sessionRating}/5
                      </span>
                    )}
                    <span className="text-xs text-brand-text-subtle">
                      {formatRelativeDate(fb.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Partner Analytics ─────────────────────────────── */}
      <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
        <h2 className="font-semibold text-brand-text mb-1 flex items-center gap-2">
          <Handshake className="w-4 h-4 text-brand-primary" />
          Partner Referrals
        </h2>
        <p className="text-xs text-brand-text-subtle mb-5">
          Users attributed via partner landing pages · {stats.activeBenefits} active benefit{stats.activeBenefits !== 1 ? "s" : ""}
        </p>

        {stats.partnerBreakdown.length === 0 ? (
          <p className="text-sm text-brand-text-subtle text-center py-6">
            No partner referrals recorded yet.
          </p>
        ) : (
          <div className="space-y-3">
            {stats.partnerBreakdown.map((row) => {
              const slug = row.source
              const partner = PARTNERS[slug]
              const count = row.count
              const totalPartnerUsers = stats.partnerBreakdown.reduce(
                (s, r) => s + r.count,
                0
              )
              const pct = totalPartnerUsers > 0 ? Math.round((count / totalPartnerUsers) * 100) : 0

              return (
                <div key={slug} className="flex items-center gap-4">
                  <div className="w-28 flex-shrink-0">
                    <p className="text-sm font-medium text-brand-text truncate">
                      {partner?.name ?? slug}
                    </p>
                    <p className="text-xs text-brand-text-subtle">{partner?.landingPath ?? `/${slug}`}</p>
                  </div>
                  <div className="flex-1 h-2 rounded-full bg-brand-bg overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="w-16 text-right">
                    <span className="text-sm font-semibold text-brand-text">{count}</span>
                    <span className="text-xs text-brand-text-subtle ml-1">users</span>
                  </div>
                  <div className="w-10 text-right text-xs text-brand-text-subtle">{pct}%</div>
                </div>
              )
            })}
          </div>
        )}

        {/* Quick link to /cypg */}
        <div className="mt-5 pt-4 border-t border-brand-border flex items-center justify-between">
          <p className="text-xs text-brand-text-subtle">
            Share <span className="font-mono text-brand-text">softlaunchhq.com/cypg</span> with CYPG audience
          </p>
          <Link
            href="/cypg"
            target="_blank"
            className="text-xs text-brand-primary hover:underline font-medium"
          >
            Preview page →
          </Link>
        </div>
      </div>

      {/* Long wait users */}
      {stats.longWaitUsers.length > 0 && (
        <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
          <h2 className="font-semibold text-brand-text mb-4">
            Users Waiting 7+ Days
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.longWaitUsers.map((user) => (
              <Link
                key={user.id}
                href={`/admin/users/${user.id}`}
                className="flex items-center gap-2 p-3 rounded-lg border border-brand-border hover:border-brand-primary/30 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-brand-primary/15 flex items-center justify-center text-xs font-semibold text-brand-primary">
                  {user.profile?.firstName?.[0]}{user.profile?.lastName?.[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-brand-text truncate">
                    {user.profile?.firstName} {user.profile?.lastName}
                  </p>
                  <p className="text-xs text-brand-text-subtle">
                    {formatRelativeDate(user.createdAt)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
