"use client"

/**
 * Admin Departures — /admin/departures
 *
 * Shows all member departures with reason, rematch request status,
 * and admin actions: Approve/Reject rematch, Archive, Mark reviewed.
 *
 * Authorization: enforced by the admin layout (ADMIN | FOUNDER only).
 */

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  LogOut, RefreshCw, MapPin, Clock, CheckCircle2, AlertCircle,
  ChevronDown, ChevronUp, Archive, ThumbsUp, ThumbsDown, Loader2,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Departure {
  id:                     string
  cohortId:               string
  userId:                 string
  reason:                 string
  requestedRematch:       boolean
  isLocationIssue:        boolean
  meetupStateAtDeparture: string | null
  adminReviewed:          boolean
  adminNotes:             string | null
  status:                 string
  createdAt:              string
  memberName:             string
  memberEmail:            string | null
  cohortName:             string
}

interface Summary {
  total:    number
  rematch:  number
  location: number
  pending:  number
}

// ─── Status pill ─────────────────────────────────────────────────────────────

function StatusPill({ status, requestedRematch }: { status: string; requestedRematch: boolean }) {
  const map: Record<string, string> = {
    pending:          "bg-amber-500/10 border-amber-500/25 text-amber-300",
    reviewed:         "bg-brand-surface border-brand-border text-brand-text-muted",
    rematch_approved: "bg-emerald-500/10 border-emerald-500/25 text-emerald-300",
    rematch_rejected: "bg-rose-500/10 border-rose-500/25 text-rose-300",
    archived:         "bg-brand-surface/50 border-brand-border/40 text-brand-text-subtle",
  }
  const labels: Record<string, string> = {
    pending:          "Pending review",
    reviewed:         "Reviewed",
    rematch_approved: "Rematch approved",
    rematch_rejected: "Rematch rejected",
    archived:         "Archived",
  }
  const cls = map[status] ?? map.pending
  const label = labels[status] ?? status

  if (status === "pending" && requestedRematch) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${map.pending}`}>
        <AlertCircle className="w-2.5 h-2.5" /> Rematch requested
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  )
}

// ─── Action buttons ───────────────────────────────────────────────────────────

function ActionButtons({
  departure,
  onUpdate,
}: {
  departure: Departure
  onUpdate:  (id: string, newStatus: string) => void
}) {
  const [loading, setLoading] = useState<string | null>(null)

  const act = async (action: string) => {
    setLoading(action)
    try {
      const res = await fetch(`/api/admin/departures/${departure.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (res.ok && json.status) {
        onUpdate(departure.id, json.status)
      }
    } catch { /* non-fatal */ }
    finally { setLoading(null) }
  }

  if (departure.status === "archived") {
    return <span className="text-xs text-brand-text-subtle">Archived</span>
  }

  return (
    <div className="flex flex-col gap-1.5">
      {departure.requestedRematch && departure.status !== "rematch_approved" && departure.status !== "rematch_rejected" && (
        <>
          <button
            onClick={() => act("approve_rematch")}
            disabled={!!loading}
            className="flex items-center gap-1 rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/15 transition-colors disabled:opacity-50"
          >
            {loading === "approve_rematch" ? <Loader2 className="w-3 h-3 animate-spin" /> : <ThumbsUp className="w-3 h-3" />}
            Approve rematch
          </button>
          <button
            onClick={() => act("reject_rematch")}
            disabled={!!loading}
            className="flex items-center gap-1 rounded-lg border border-rose-500/25 bg-rose-500/8 px-2 py-1 text-[11px] font-medium text-rose-300 hover:bg-rose-500/15 transition-colors disabled:opacity-50"
          >
            {loading === "reject_rematch" ? <Loader2 className="w-3 h-3 animate-spin" /> : <ThumbsDown className="w-3 h-3" />}
            Reject rematch
          </button>
        </>
      )}
      {!departure.adminReviewed && (
        <button
          onClick={() => act("mark_reviewed")}
          disabled={!!loading}
          className="flex items-center gap-1 rounded-lg border border-brand-border px-2 py-1 text-[11px] font-medium text-brand-text-muted hover:border-brand-primary/30 hover:text-brand-text transition-colors disabled:opacity-50"
        >
          {loading === "mark_reviewed" ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
          Mark reviewed
        </button>
      )}
      <button
        onClick={() => act("archive")}
        disabled={!!loading}
        className="flex items-center gap-1 rounded-lg border border-brand-border/60 px-2 py-1 text-[11px] font-medium text-brand-text-subtle hover:text-brand-text transition-colors disabled:opacity-50"
      >
        {loading === "archive" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Archive className="w-3 h-3" />}
        Archive
      </button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminDeparturesPage() {
  const [departures, setDepartures] = useState<Departure[]>([])
  const [summary, setSummary]       = useState<Summary>({ total: 0, rematch: 0, location: 0, pending: 0 })
  const [isLoading, setIsLoading]   = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter]         = useState<"all" | "pending" | "rematch">("all")

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/admin/departures")
      if (res.ok) {
        const json = await res.json()
        setDepartures(json.departures ?? [])
        setSummary(json.summary ?? { total: 0, rematch: 0, location: 0, pending: 0 })
      }
    } catch { /* non-fatal */ }
    finally { setIsLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleUpdate = (id: string, newStatus: string) => {
    setDepartures((prev) =>
      prev.map((d) =>
        d.id === id
          ? { ...d, status: newStatus, adminReviewed: newStatus !== "archived" }
          : d
      )
    )
    // Recalculate summary
    setSummary((prev) => ({
      ...prev,
      pending: prev.pending - 1 < 0 ? 0 : prev.pending - 1,
    }))
  }

  const filtered = departures.filter((d) => {
    if (filter === "pending")  return !d.adminReviewed && d.status === "pending"
    if (filter === "rematch")  return d.requestedRematch
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Departures</h1>
          <p className="text-sm text-brand-text-muted mt-1">Members who have left their cohorts.</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 rounded-xl border border-brand-border px-3 py-2 text-sm text-brand-text-muted hover:text-brand-text transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Total",            value: summary.total,    icon: LogOut,       color: "text-brand-text" },
          { label: "Rematch requests", value: summary.rematch,  icon: RefreshCw,    color: "text-brand-primary" },
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

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "pending", "rematch"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`
              px-3 py-1.5 rounded-lg border text-sm font-medium transition-all
              ${filter === f
                ? "border-brand-primary/50 bg-brand-primary/15 text-brand-text"
                : "border-brand-border/60 bg-brand-surface/50 text-brand-text-muted hover:border-brand-primary/30 hover:text-brand-text"
              }
            `}
          >
            {f === "all" ? "All" : f === "pending" ? "Pending review" : "Rematch requests"}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="neon-panel p-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-brand-text-subtle" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="neon-panel p-8 text-center">
          <LogOut className="mx-auto h-8 w-8 text-brand-text-subtle mb-3" />
          <p className="text-brand-text-muted">No departures match this filter.</p>
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
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-brand-text-subtle">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-brand-text-subtle">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-brand-text-subtle">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/40">
                {filtered.map((d) => (
                  <>
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
                        <p className="text-brand-text-muted text-xs leading-relaxed line-clamp-2">
                          {d.reason}
                        </p>
                        {d.meetupStateAtDeparture && (
                          <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-brand-text-subtle">
                            <Clock className="w-2.5 h-2.5" />
                            During: {d.meetupStateAtDeparture.replace(/_/g, " ").toLowerCase()}
                          </span>
                        )}
                        {/* Expand for admin notes */}
                        {d.adminNotes && (
                          <button
                            onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                            className="mt-1 flex items-center gap-1 text-[10px] text-brand-text-subtle hover:text-brand-text"
                          >
                            {expandedId === d.id ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                            Admin notes
                          </button>
                        )}
                        {expandedId === d.id && d.adminNotes && (
                          <p className="mt-1 text-[11px] text-brand-text-muted bg-brand-surface/50 rounded-lg px-2 py-1.5">
                            {d.adminNotes}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {d.requestedRematch && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 border border-brand-primary/20 px-2 py-0.5 text-[10px] font-medium text-brand-primary">
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
                          {new Date(d.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={d.status} requestedRematch={d.requestedRematch} />
                      </td>
                      <td className="px-4 py-3">
                        <ActionButtons departure={d} onUpdate={handleUpdate} />
                      </td>
                    </tr>
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
