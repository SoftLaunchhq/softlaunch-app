import { db } from "@/lib/db"
import Link from "next/link"
import { formatDate, cohortThemeLabel, paymentStatusBadge } from "@/lib/utils"
import { CheckCircle2, Clock, AlertCircle, XCircle, Plus } from "lucide-react"

const STATUS_BADGES: Record<string, { label: string; color: string; icon: any }> = {
  FORMING: { label: "Forming", color: "text-brand-text-muted bg-brand-border", icon: Clock },
  PENDING_APPROVAL: { label: "Pending Approval", color: "text-brand-warning bg-amber-950 border border-amber-500/30", icon: AlertCircle },
  APPROVED: { label: "Approved", color: "text-blue-400 bg-blue-950 border border-blue-500/30", icon: CheckCircle2 },
  ACTIVE: { label: "Active", color: "text-brand-success bg-emerald-950 border border-emerald-500/30", icon: CheckCircle2 },
  COMPLETED: { label: "Completed", color: "text-brand-text-muted bg-brand-border", icon: CheckCircle2 },
  DISSOLVED: { label: "Dissolved", color: "text-brand-error bg-red-950 border border-red-500/30", icon: XCircle },
}

export default async function AdminCohortsPage() {
  const cohorts = await db.cohort.findMany({
    include: {
      memberships: {
        include: {
          user: {
            include: {
              profile: true,
              subscription: { select: { status: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-text">Cohorts</h1>
          <p className="text-brand-text-muted text-sm mt-1">
            {cohorts.length} total · {cohorts.filter((c) => c.status === "ACTIVE").length} active
          </p>
        </div>
        <Link
          href="/admin/matching"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary-hover transition-all"
        >
          <Plus className="w-4 h-4" />
          Create cohort
        </Link>
      </div>

      {/* Cohort table */}
      <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-border">
              {["Cohort", "Theme", "Status", "Week", "Members", "Payments", "Created", ""].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-brand-text-subtle uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohorts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-brand-text-subtle">
                  No cohorts yet. Run the matching engine to create your first cohort.
                </td>
              </tr>
            ) : (
              cohorts.map((cohort) => {
                const badge = STATUS_BADGES[cohort.status]
                const BadgeIcon = badge.icon
                const paidCount = cohort.memberships.filter(
                  (m) => m.user.subscription?.status === "ACTIVE"
                ).length

                return (
                  <tr
                    key={cohort.id}
                    className="border-b border-brand-border hover:bg-brand-bg/50 transition-colors"
                  >
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-brand-text text-sm">{cohort.name}</p>
                        {cohort.matchScore && (
                          <p className="text-xs text-brand-text-subtle mt-0.5">
                            Match score: {cohort.matchScore.toFixed(1)}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs text-brand-text-muted">
                        {cohortThemeLabel(cohort.theme)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${badge.color}`}>
                        <BadgeIcon className="w-3 h-3" />
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-brand-text-muted">
                        {cohort.currentWeek > 0 ? `Week ${cohort.currentWeek}` : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex -space-x-1.5">
                        {cohort.memberships.slice(0, 4).map((m) => (
                          <div
                            key={m.id}
                            className="w-7 h-7 rounded-full bg-brand-primary/15 border-2 border-brand-surface flex items-center justify-center text-[10px] font-bold text-brand-primary"
                            title={`${m.user.profile?.firstName} ${m.user.profile?.lastName}`}
                          >
                            {m.user.profile?.firstName?.[0]}{m.user.profile?.lastName?.[0]}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-xs font-medium ${paidCount === cohort.memberships.length ? "text-brand-success" : "text-brand-text-muted"}`}>
                        {paidCount}/{cohort.memberships.length} paid
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs text-brand-text-subtle">
                        {formatDate(cohort.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/admin/cohorts/${cohort.id}`}
                        className="text-xs text-brand-primary hover:underline font-medium"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
