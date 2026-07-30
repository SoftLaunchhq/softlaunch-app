/**
 * Admin Departures — /admin/departures
 *
 * Shows all member departures with reason, rematch request status,
 * and admin review controls.
 *
 * Authorization: enforced by the admin layout (ADMIN | FOUNDER only).
 */

import { db } from "@/lib/db"
import { format } from "date-fns"
import Link from "next/link"
import { LogOut, RefreshCw, MapPin, Clock, CheckCircle2, AlertCircle } from "lucide-react"

type DepartureRow = {
  id: string
  cohortId: string
  userId: string
  reason: string
  requestedRematch: boolean
  isLocationIssue: boolean
  meetupStateAtDeparture: string | null
  adminReviewed: boolean
  adminNotes: string | null
  createdAt: Date
}

async function getDepartures() {
  try {
    // Ensure table exists before querying
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS "CohortDeparture" (
        "id"                     TEXT        NOT NULL,
        "cohortId"               TEXT        NOT NULL,
        "userId"                 TEXT        NOT NULL,
        "reason"                 TEXT        NOT NULL,
        "requestedRematch"       BOOLEAN     NOT NULL DEFAULT false,
        "isLocationIssue"        BOOLEAN     NOT NULL DEFAULT false,
        "meetupStateAtDeparture" TEXT,
        "adminReviewed"          BOOLEAN     NOT NULL DEFAULT false,
        "adminNotes"             TEXT,
        "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "CohortDeparture_pkey" PRIMARY KEY ("id")
      )
    `
    await db.$executeRaw`
      CREATE INDEX IF NOT EXISTS "CohortDeparture_cohortId_idx" ON "CohortDeparture" ("cohortId")
    `
    await db.$executeRaw`
      CREATE INDEX IF NOT EXISTS "CohortDeparture_userId_idx" ON "CohortDeparture" ("userId")
    `

    const rows = await db.$queryRaw<DepartureRow[]>`
      SELECT * FROM "CohortDeparture" ORDER BY "createdAt" DESC LIMIT 200
    `

    if (rows.length === 0) return { departures: [], summary: { total: 0, rematch: 0, location: 0, pending: 0 } }

    // Enrich with user + cohort data
    const userIds = [...new Set(rows.map((r) => r.userId))]
    const cohortIds = [...new Set(rows.map((r) => r.cohortId))]

    const [users, cohorts] = await Promise.all([
      db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } },
      }),
      db.cohort.findMany({
        where: { id: { in: cohortIds } },
        select: { id: true, name: true },
      }),
    ])

    const userMap = Object.fromEntries(users.map((u) => [u.id, u]))
    const cohortMap = Object.fromEntries(cohorts.map((c) => [c.id, c]))

    const departures = rows.map((r) => {
      const user = userMap[r.userId]
      const cohort = cohortMap[r.cohortId]
      return {
        ...r,
        memberName: user?.profile
          ? `${user.profile.firstName} ${user.profile.lastName}`.trim()
          : "Unknown",
        memberEmail: user?.email ?? null,
        cohortName: cohort?.name ?? r.cohortId,
      }
    })

    const summary = {
      total: departures.length,
      rematch: departures.filter((d) => d.requestedRematch).length,
      location: departures.filter((d) => d.isLocationIssue).length,
      pending: departures.filter((d) => !d.adminReviewed).length,
    }

    return { departures, summary }
  } catch (err: any) {
    console.error("[admin/departures]", err?.message?.slice(0, 200))
    return { departures: [], summary: { total: 0, rematch: 0, location: 0, pending: 0 } }
  }
}

export default async function AdminDeparturesPage() {
  const { departures, summary } = await getDepartures()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Departures</h1>
          <p className="text-sm text-brand-text-muted mt-1">Members who have left their cohorts.</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Total",            value: summary.total,    icon: LogOut,       color: "text-brand-text" },
          { label: "Rematch requests", value: summary.rematch,  icon: RefreshCw,    color: "text-cyan-300" },
          { label: "Location issues",  value: summary.location, icon: MapPin,       color: "text-amber-300" },
          { label: "Pending review",   value: summary.pending,  icon: AlertCircle,  color: "text-rose-300" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="neon-panel p-4">
            <Icon className={`h-4 w-4 mb-2 ${color}`} />
            <p className="text-2xl font-bold text-brand-text">{value}</p>
            <p className="text-xs text-brand-text-muted mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Departures table */}
      {departures.length === 0 ? (
        <div className="neon-panel p-8 text-center">
          <LogOut className="mx-auto h-8 w-8 text-brand-text-subtle mb-3" />
          <p className="text-brand-text-muted">No departures yet.</p>
        </div>
      ) : (
        <div className="neon-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border/60">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-brand-text-subtle">Member</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-brand-text-subtle">Cohort</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-brand-text-subtle">Reason</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-brand-text-subtle">Flags</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-brand-text-subtle">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-brand-text-subtle">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/40">
                {departures.map((d: any) => (
                  <tr key={d.id} className="hover:bg-brand-surface/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-brand-text">{d.memberName}</p>
                      <p className="text-xs text-brand-text-subtle mt-0.5">{d.memberEmail}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/cohorts/${d.cohortId}`}
                        className="text-brand-text hover:text-brand-primary transition-colors"
                      >
                        {d.cohortName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-brand-text-muted text-xs leading-relaxed line-clamp-3">
                        {d.reason}
                      </p>
                      {d.meetupStateAtDeparture && (
                        <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-brand-text-subtle">
                          <Clock className="w-2.5 h-2.5" />
                          During: {d.meetupStateAtDeparture.replace(/_/g, " ").toLowerCase()}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {d.requestedRematch && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-300/10 border border-cyan-300/20 px-2 py-0.5 text-[10px] font-medium text-cyan-300">
                            <RefreshCw className="w-2.5 h-2.5" /> Rematch
                          </span>
                        )}
                        {d.isLocationIssue && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/10 border border-amber-300/20 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                            <MapPin className="w-2.5 h-2.5" /> Location
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-xs text-brand-text-muted">
                        {d.createdAt instanceof Date
                          ? format(d.createdAt, "MMM d, yyyy")
                          : new Date(d.createdAt as string).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {d.adminReviewed ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" /> Reviewed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-rose-400">
                          <AlertCircle className="w-3 h-3" /> Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
