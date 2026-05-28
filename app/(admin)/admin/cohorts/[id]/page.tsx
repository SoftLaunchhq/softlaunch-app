import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { formatDate, cohortThemeLabel, formatCurrency } from "@/lib/utils"
import Link from "next/link"
import { CohortAdminActions } from "@/components/admin/CohortAdminActions"
import { PromptSender } from "@/components/admin/PromptSender"
import { ArrowLeft, ExternalLink } from "lucide-react"

export default async function CohortDetailPage({ params }: { params: { id: string } }) {
  const cohort = await db.cohort.findUnique({
    where: { id: params.id },
    include: {
      memberships: {
        include: {
          user: {
            include: {
              profile: true,
              driveProfile: true,
              subscription: true,
              feedbacks: {
                where: { cohortId: params.id },
                orderBy: { createdAt: "desc" },
              },
              attendances: {
                where: { cohortId: params.id },
                orderBy: { weekNumber: "asc" },
              },
            },
          },
        },
      },
      weeklyPrompts: { orderBy: { weekNumber: "asc" } },
      feedbacks: {
        include: { user: { include: { profile: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      adminActions: {
        include: { admin: { include: { profile: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  })

  if (!cohort) notFound()

  const avgFeedbackScore = cohort.feedbacks.length
    ? cohort.feedbacks.reduce((sum, f) => sum + (f.sessionRating || 0), 0) /
      cohort.feedbacks.filter((f) => f.sessionRating).length
    : null

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/admin/cohorts"
          className="flex items-center gap-1.5 text-sm text-brand-text-muted hover:text-brand-text mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          All cohorts
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-brand-text">
              {cohort.name}
            </h1>
            <p className="text-brand-text-muted text-sm mt-1">
              {cohortThemeLabel(cohort.theme)} · Created {formatDate(cohort.createdAt)}
              {avgFeedbackScore && ` · Avg rating: ${avgFeedbackScore.toFixed(1)}/5`}
            </p>
          </div>
          <CohortAdminActions cohort={cohort} />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left column: Members */}
        <div className="md:col-span-2 space-y-6">
          {/* Members */}
          <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
            <h2 className="font-semibold text-brand-text mb-4">Members</h2>
            <div className="space-y-4">
              {cohort.memberships.map((membership) => {
                const { user } = membership
                const attendanceRate = user.attendances.length
                  ? user.attendances.filter((a) => a.attended).length / user.attendances.length
                  : null
                const payStatus = user.subscription?.status || "FREE"

                return (
                  <div
                    key={membership.id}
                    className="flex items-center gap-4 p-4 rounded-xl bg-brand-bg border border-brand-border"
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-brand-primary/15 flex items-center justify-center text-sm font-bold text-brand-primary flex-shrink-0">
                      {user.profile?.firstName?.[0]}{user.profile?.lastName?.[0]}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-brand-text text-sm">
                          {user.profile?.firstName} {user.profile?.lastName}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          payStatus === "ACTIVE"
                            ? "bg-emerald-500/10 text-brand-success border border-emerald-500/20"
                            : payStatus === "PAST_DUE"
                            ? "bg-amber-500/10 text-brand-warning border border-amber-500/20"
                            : "bg-brand-border text-brand-text-muted"
                        }`}>
                          {payStatus === "ACTIVE" ? "Paid" : payStatus === "FREE" ? "Free tier" : payStatus}
                        </span>
                      </div>
                      <p className="text-xs text-brand-text-subtle mt-0.5">
                        {user.driveProfile?.archetype || "No drive profile"} ·{" "}
                        {user.email}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-brand-text-subtle flex-shrink-0">
                      {attendanceRate !== null && (
                        <span>
                          {Math.round(attendanceRate * 100)}% attendance
                        </span>
                      )}
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="text-brand-primary hover:underline"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Feedback summary */}
          {cohort.feedbacks.length > 0 && (
            <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
              <h2 className="font-semibold text-brand-text mb-4">Feedback Summary</h2>
              <div className="space-y-3">
                {cohort.feedbacks.slice(0, 5).map((fb) => (
                  <div key={fb.id} className="flex items-start gap-3 p-3 rounded-lg bg-brand-bg border border-brand-border">
                    <div className="w-7 h-7 rounded-full bg-brand-primary/15 flex items-center justify-center text-[10px] font-bold text-brand-primary flex-shrink-0 mt-0.5">
                      {fb.user.profile?.firstName?.[0]}{fb.user.profile?.lastName?.[0]}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-brand-text">
                          {fb.user.profile?.firstName} {fb.user.profile?.lastName}
                        </span>
                        <span className="text-xs text-brand-text-subtle">
                          Week {fb.weekNumber}
                        </span>
                        {fb.sessionRating && (
                          <span className="text-xs text-brand-primary font-semibold">
                            {fb.sessionRating}/5
                          </span>
                        )}
                      </div>
                      {fb.openResponse && (
                        <p className="text-xs text-brand-text-muted leading-relaxed">
                          "{fb.openResponse}"
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin action log */}
          {cohort.adminActions.length > 0 && (
            <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
              <h2 className="font-semibold text-brand-text mb-4">Admin Log</h2>
              <div className="space-y-2">
                {cohort.adminActions.map((action) => (
                  <div key={action.id} className="flex items-center gap-3 text-xs">
                    <span className="text-brand-text-subtle whitespace-nowrap">
                      {formatDate(action.createdAt)}
                    </span>
                    <span className="text-brand-primary font-medium">{action.actionType}</span>
                    <span className="text-brand-text-subtle">
                      by {action.admin.profile?.firstName}
                    </span>
                    {action.notes && (
                      <span className="text-brand-text-subtle truncate">· {action.notes}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column: Actions & Prompts */}
        <div className="space-y-6">
          {/* External links */}
          <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
            <h3 className="font-semibold text-brand-text text-sm mb-3">External Links</h3>
            <div className="space-y-2">
              {[
                { label: "WhatsApp Group", value: cohort.whatsappGroupLink, field: "whatsappGroupLink" },
                { label: "Notion Doc", value: cohort.notionDocLink, field: "notionDocLink" },
                { label: "Calendly", value: cohort.calendlyLink, field: "calendlyLink" },
              ].map((link) => (
                <div key={link.field} className="flex items-center justify-between">
                  <span className="text-xs text-brand-text-muted">{link.label}</span>
                  {link.value ? (
                    <a
                      href={link.value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-brand-primary hover:underline"
                    >
                      Open <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-xs text-brand-text-subtle">Not set</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Prompt sender */}
          <PromptSender cohortId={cohort.id} currentWeek={cohort.currentWeek} existingPrompts={cohort.weeklyPrompts} />
        </div>
      </div>
    </div>
  )
}
