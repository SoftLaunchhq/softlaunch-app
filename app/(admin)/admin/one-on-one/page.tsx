"use client"

import { useState } from "react"
import {
  Sparkles, Loader2, CheckCircle2, XCircle, AlertTriangle,
  ChevronDown, ChevronUp, Users, Brain, Zap, MessageSquare,
  RefreshCw, UserCheck,
} from "lucide-react"

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface UserPreview {
  id: string
  name: string
  firstName: string | null
  photoUrl: string | null
  headline: string | null
  archetype: string
  archetypeSlug: string
  ambition: number
  ambitionType: string | null
  energyStyle: string | null
  communicationStyle: string | null
}

interface ScoreBreakdown {
  ambition: number
  discipline: number
  community: number
  growth: number
  openness: number
  communicationStyle: number
  emotionalDriver: number
  accountabilityFit: number
  driveScore: number
  psychScore: number
  finalScore: number
}

interface SuggestionRaw {
  userA: UserPreview
  userB: UserPreview
  compatibilityScore: number
  breakdown: ScoreBreakdown
  matchReason: string
  frictionPoints: string[]
  suggestedPrompt: string
  warnings: string[]
}

type SuggestionUI = SuggestionRaw & { expanded: boolean; key: string }

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const color = score >= 75 ? "#22c55e" : score >= 55 ? "#f59e0b" : "#ef4444"
  const circumference = 2 * Math.PI * 28
  const offset = circumference - (score / 100) * circumference
  const rounded = Math.round(score)
  return (
    <div className="relative inline-flex items-center justify-center flex-shrink-0">
      <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
        <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle cx="36" cy="36" r="28" fill="none"
          stroke={color} strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-base font-bold leading-none" style={{ color }}>{rounded}</span>
        <span className="text-[8px] text-brand-text-subtle mt-0.5">/ 100</span>
      </div>
    </div>
  )
}

function MiniBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 75 ? "bg-green-400" : pct >= 55 ? "bg-amber-400" : "bg-red-400"
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 text-[10px] text-brand-text-subtle truncate">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-brand-border/40">
        <div className={`h-1 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-7 text-right text-[10px] font-semibold text-brand-text">{pct}%</span>
    </div>
  )
}

function UserCard({ user }: { user: UserPreview }) {
  const initials = user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
  const formatLabel = (s: string | null) => s ? s.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : null

  return (
    <div className="rounded-xl border border-brand-border/60 bg-brand-bg/40 p-4 flex-1 min-w-0">
      {/* Avatar + name */}
      <div className="flex items-center gap-3 mb-3">
        {user.photoUrl ? (
          <img src={user.photoUrl} alt={user.name} className="h-10 w-10 rounded-xl object-cover flex-shrink-0" />
        ) : (
          <div className="h-10 w-10 rounded-xl bg-brand-primary/15 border border-brand-primary/25 flex items-center justify-center text-sm font-bold text-brand-primary flex-shrink-0">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-brand-text truncate">{user.name}</p>
          <p className="text-xs text-brand-text-subtle truncate">{user.archetype}</p>
        </div>
      </div>

      {/* Traits */}
      <div className="space-y-1">
        {user.ambitionType && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-brand-text-subtle w-20 flex-shrink-0">Ambition</span>
            <span className="text-brand-text font-medium truncate">{formatLabel(user.ambitionType)}</span>
          </div>
        )}
        {user.energyStyle && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-brand-text-subtle w-20 flex-shrink-0">Energy</span>
            <span className="text-brand-text font-medium truncate">{formatLabel(user.energyStyle)}</span>
          </div>
        )}
        {user.communicationStyle && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-brand-text-subtle w-20 flex-shrink-0">Communication</span>
            <span className="text-brand-text font-medium truncate">{formatLabel(user.communicationStyle)}</span>
          </div>
        )}
      </div>

      {/* Ambition bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-brand-text-subtle">Ambition score</span>
          <span className="text-[10px] font-semibold text-brand-text">{Math.round(user.ambition)}</span>
        </div>
        <div className="h-1 rounded-full bg-brand-border/40">
          <div
            className="h-1 rounded-full bg-brand-primary"
            style={{ width: `${user.ambition}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────

export default function AdminOneOnOnePage() {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<SuggestionUI[]>([])
  const [approving, setApproving] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [approved, setApproved] = useState<Set<string>>(new Set())
  const [rejected, setRejected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState<number | null>(null)

  // Active matches (fetched separately)
  const [activeMatches, setActiveMatches] = useState<any[]>([])
  const [loadingActive, setLoadingActive] = useState(false)

  const runMatching = async () => {
    setLoading(true)
    setError(null)
    setSuggestions([])

    try {
      const res = await fetch("/api/one-on-one/suggest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Matching failed")

      const ui: SuggestionUI[] = (data.suggestions as SuggestionRaw[]).map((s, i) => ({
        ...s,
        expanded: i < 3, // auto-expand first 3
        key: `${s.userA.id}_${s.userB.id}`,
      }))
      setSuggestions(ui)
      setTotal(data.total)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (key: string) => {
    setSuggestions((prev) =>
      prev.map((s) => (s.key === key ? { ...s, expanded: !s.expanded } : s))
    )
  }

  const approvePair = async (s: SuggestionUI) => {
    setApproving(s.key)
    try {
      const res = await fetch("/api/one-on-one/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAId: s.userA.id,
          userBId: s.userB.id,
          compatibilityScore: s.compatibilityScore,
          matchReason: s.matchReason,
          frictionPoints: s.frictionPoints,
          suggestedPrompt: s.suggestedPrompt,
          scoreBreakdown: s.breakdown,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error)
      }
      setApproved((prev) => new Set([...prev, s.key]))
    } catch (err: any) {
      setError(`Approve failed: ${err.message}`)
    } finally {
      setApproving(null)
    }
  }

  const rejectPair = async (s: SuggestionUI) => {
    setRejecting(s.key)
    try {
      const res = await fetch("/api/one-on-one/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAId: s.userA.id,
          userBId: s.userB.id,
          reason: "Rejected during admin suggestion review",
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error)
      }
      setRejected((prev) => new Set([...prev, s.key]))
    } catch (err: any) {
      setError(`Reject failed: ${err.message}`)
    } finally {
      setRejecting(null)
    }
  }

  const isApproved = (key: string) => approved.has(key)
  const isRejected = (key: string) => rejected.has(key)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-text">1-on-1 Matching</h1>
          <p className="mt-1 text-sm text-brand-text-muted">
            Run the algorithm, review scored pairs, and approve matches. Approved pairs are visible to both users immediately.
          </p>
        </div>
        <button
          onClick={runMatching}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-primary/25 transition-all hover:bg-brand-primary/90 disabled:opacity-60"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Running…</>
          ) : (
            <><Sparkles className="h-4 w-4" /> Run Matching</>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Stats bar */}
      {total !== null && (
        <div className="sl-panel px-4 py-3 flex items-center gap-6 flex-wrap text-sm">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-brand-text-subtle" />
            <span className="text-brand-text-muted">
              <span className="font-semibold text-brand-text">{total}</span> pairs found
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <span className="text-brand-text-muted">
              <span className="font-semibold text-green-400">{approved.size}</span> approved
            </span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-400" />
            <span className="text-brand-text-muted">
              <span className="font-semibold text-red-400">{rejected.size}</span> rejected
            </span>
          </div>
        </div>
      )}

      {/* Suggestion cards */}
      {suggestions.length > 0 && (
        <div className="space-y-4">
          {suggestions.map((s) => {
            const isApp = isApproved(s.key)
            const isRej = isRejected(s.key)
            const approvingThis = approving === s.key
            const rejectingThis = rejecting === s.key

            return (
              <div
                key={s.key}
                className={`sl-panel overflow-hidden transition-all ${
                  isApp ? "border-green-500/30" : isRej ? "border-red-500/20 opacity-60" : ""
                }`}
              >
                {/* Card header */}
                <button
                  onClick={() => toggleExpand(s.key)}
                  className="flex w-full items-center gap-4 p-5 text-left"
                >
                  {/* Score ring */}
                  <ScoreRing score={s.compatibilityScore} />

                  {/* Names */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-brand-text">
                      {s.userA.name} × {s.userB.name}
                    </p>
                    <p className="text-xs text-brand-text-subtle mt-0.5">
                      {s.userA.archetype} · {s.userB.archetype}
                    </p>
                  </div>

                  {/* Warnings */}
                  {s.warnings.length > 0 && !isApp && !isRej && (
                    <div className="flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-400">
                      <AlertTriangle className="h-3 w-3" />
                      {s.warnings.length}
                    </div>
                  )}

                  {/* Status badges */}
                  {isApp && (
                    <span className="flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-bold text-green-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                    </span>
                  )}
                  {isRej && (
                    <span className="flex items-center gap-1 rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-400">
                      <XCircle className="h-3.5 w-3.5" /> Rejected
                    </span>
                  )}

                  {s.expanded ? (
                    <ChevronUp className="h-4 w-4 text-brand-text-subtle flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-brand-text-subtle flex-shrink-0" />
                  )}
                </button>

                {/* Expanded body */}
                {s.expanded && (
                  <div className="border-t border-brand-border/50 px-5 pb-5 pt-4 space-y-5">

                    {/* User cards */}
                    <div className="flex gap-3 flex-col sm:flex-row">
                      <UserCard user={s.userA} />
                      <div className="flex items-center justify-center text-brand-text-subtle text-lg font-light">×</div>
                      <UserCard user={s.userB} />
                    </div>

                    {/* Score breakdown */}
                    <div className="rounded-xl border border-brand-border/60 bg-brand-bg/30 p-4">
                      <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-brand-text-subtle">
                        Score breakdown
                      </p>
                      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                        <MiniBar label="Ambition" value={s.breakdown.ambition} />
                        <MiniBar label="Discipline" value={s.breakdown.discipline} />
                        <MiniBar label="Communication" value={s.breakdown.communicationStyle} />
                        <MiniBar label="Accountability" value={s.breakdown.accountabilityFit} />
                        <MiniBar label="Emotional driver" value={s.breakdown.emotionalDriver} />
                        <MiniBar label="Growth mindset" value={s.breakdown.growth} />
                        <MiniBar label="Drive score" value={s.breakdown.driveScore} />
                        <MiniBar label="Psych score" value={s.breakdown.psychScore} />
                      </div>
                    </div>

                    {/* Match reason */}
                    {s.matchReason && (
                      <div className="rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-4">
                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-primary">
                          Why they match
                        </p>
                        <p className="text-sm leading-relaxed text-brand-text-muted">{s.matchReason}</p>
                      </div>
                    )}

                    {/* Friction */}
                    {s.frictionPoints.length > 0 && (
                      <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-4">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                          Potential friction
                        </p>
                        <ul className="space-y-1.5">
                          {s.frictionPoints.map((fp, i) => (
                            <li key={i} className="text-xs text-brand-text-muted flex gap-2">
                              <span className="text-amber-400 flex-shrink-0">·</span>
                              {fp}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Suggested prompt */}
                    {s.suggestedPrompt && (
                      <div className="rounded-xl border border-brand-border/60 bg-brand-bg/30 p-4">
                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-text-subtle">
                          BUZZ suggested first message
                        </p>
                        <p className="text-xs leading-relaxed text-brand-text-muted italic">
                          &ldquo;{s.suggestedPrompt}&rdquo;
                        </p>
                      </div>
                    )}

                    {/* Warnings */}
                    {s.warnings.length > 0 && (
                      <div className="space-y-2">
                        {s.warnings.map((w, i) => (
                          <div key={i} className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-2.5 text-xs text-amber-300">
                            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                            {w}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action buttons */}
                    {!isApp && !isRej && (
                      <div className="flex items-center gap-3 pt-1">
                        <button
                          onClick={() => approvePair(s)}
                          disabled={!!approving || !!rejecting}
                          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-green-500/15 border border-green-500/30 px-4 py-2.5 text-sm font-semibold text-green-400 transition-all hover:bg-green-500/25 disabled:opacity-50"
                        >
                          {approvingThis ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Approving…</>
                          ) : (
                            <><CheckCircle2 className="h-4 w-4" /> Approve Match</>
                          )}
                        </button>
                        <button
                          onClick={() => rejectPair(s)}
                          disabled={!!approving || !!rejecting}
                          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/15 disabled:opacity-50"
                        >
                          {rejectingThis ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Rejecting…</>
                          ) : (
                            <><XCircle className="h-4 w-4" /> Reject</>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && suggestions.length === 0 && total === null && (
        <div className="flex min-h-[30vh] flex-col items-center justify-center text-center sl-panel p-10">
          <Users className="h-10 w-10 text-brand-text-subtle mb-4" />
          <p className="text-sm font-semibold text-brand-text">No suggestions yet</p>
          <p className="mt-1 text-sm text-brand-text-muted">
            Click "Run Matching" to generate 1-on-1 pair suggestions from the current user pool.
          </p>
        </div>
      )}

      {/* No results after run */}
      {!loading && suggestions.length === 0 && total === 0 && (
        <div className="sl-panel p-8 text-center">
          <p className="text-sm text-brand-text-muted">
            No eligible pairs found. Users need completed Drive Profiles to be included.
          </p>
        </div>
      )}
    </div>
  )
}
