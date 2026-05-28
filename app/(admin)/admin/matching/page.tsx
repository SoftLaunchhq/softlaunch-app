"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Loader2, CheckCircle2, AlertTriangle, Users, ChevronDown } from "lucide-react"
import { cohortThemeLabel } from "@/lib/utils"
import type { CohortSuggestion } from "@/lib/matching"

interface SuggestionWithUI extends CohortSuggestion {
  expanded: boolean
}

export default function AdminMatchingPage() {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<SuggestionWithUI[]>([])
  const [approving, setApproving] = useState<number | null>(null)
  const [approved, setApproved] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [poolSize, setPoolSize] = useState<number | null>(null)

  const runMatching = async () => {
    setLoading(true)
    setError(null)
    setSuggestions([])

    try {
      const res = await fetch("/api/matching/suggest", { method: "POST" })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || "Matching failed")

      setSuggestions(data.suggestions.map((s: CohortSuggestion) => ({ ...s, expanded: true })))
      setPoolSize(data.poolSize)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const approveCohort = async (index: number) => {
    const suggestion = suggestions[index]
    setApproving(index)

    try {
      const res = await fetch("/api/cohorts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberIds: suggestion.members.map((m) => m.id),
          theme: suggestion.themeAlignment || "GENERAL",
          matchScore: suggestion.compatibilityScore,
          matchingVersion: suggestion.matchingVersion,
          notes: `Approved via matching engine. Score: ${suggestion.compatibilityScore.toFixed(1)}`,
        }),
      })

      if (!res.ok) throw new Error("Cohort creation failed")

      setApproved((prev) => new Set([...prev, index]))
    } catch (err) {
      console.error(err)
    } finally {
      setApproving(null)
    }
  }

  const toggleExpand = (index: number) => {
    setSuggestions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, expanded: !s.expanded } : s))
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-text">
            Matching Engine
          </h1>
          <p className="text-brand-text-muted text-sm mt-1">
            Run the algorithm, review suggestions, approve cohorts.
          </p>
        </div>

        <button
          onClick={runMatching}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-brand-primary text-white font-semibold hover:bg-brand-primary-hover transition-all disabled:opacity-60 hover:shadow-[0_0_20px_rgba(139,92,246,0.4)]"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Run Matching
            </>
          )}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-brand-error/30 bg-brand-error/10 p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-brand-error flex-shrink-0" />
          <p className="text-sm text-brand-error">{error}</p>
        </div>
      )}

      {/* Pool info */}
      {poolSize !== null && (
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4 flex items-center gap-3">
          <Users className="w-5 h-5 text-brand-primary" />
          <p className="text-sm text-brand-text-muted">
            <span className="text-brand-text font-semibold">{poolSize} users</span> in
            matching pool — {suggestions.length} cohort suggestion{suggestions.length !== 1 ? "s" : ""} generated
          </p>
        </div>
      )}

      {/* Suggestions */}
      <div className="space-y-4">
        {suggestions.map((suggestion, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`
              rounded-xl border transition-all
              ${approved.has(i)
                ? "border-brand-success/30 bg-brand-success/5"
                : "border-brand-border bg-brand-surface"
              }
            `}
          >
            {/* Suggestion header */}
            <div
              className="flex items-center justify-between p-5 cursor-pointer"
              onClick={() => toggleExpand(i)}
            >
              <div className="flex items-center gap-4">
                {/* Score ring */}
                <div className="relative w-14 h-14 flex-shrink-0">
                  <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                    <circle cx="28" cy="28" r="24" fill="none" stroke="#1E1E2E" strokeWidth="4" />
                    <circle
                      cx="28" cy="28" r="24"
                      fill="none"
                      stroke={suggestion.compatibilityScore >= 75 ? "#1DB896" : suggestion.compatibilityScore >= 55 ? "#EE9F52" : "#EF4444"}
                      strokeWidth="4"
                      strokeDasharray={`${(suggestion.compatibilityScore / 100) * 150.8} 150.8`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-brand-text">
                    {Math.round(suggestion.compatibilityScore)}
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-brand-text">Cohort #{i + 1}</span>
                    {suggestion.themeAlignment && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary font-medium">
                        {cohortThemeLabel(suggestion.themeAlignment)}
                      </span>
                    )}
                  </div>
                  {/* Member avatars */}
                  <div className="flex -space-x-1.5">
                    {suggestion.members.map((member, mi) => (
                      <div
                        key={member.id}
                        className="w-6 h-6 rounded-full bg-brand-primary/20 border border-brand-surface flex items-center justify-center text-[10px] font-bold text-brand-primary"
                      >
                        {member.profile?.firstName?.[0]}{member.profile?.lastName?.[0]}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Warnings */}
                {suggestion.warnings.length > 0 && (
                  <span className="hidden md:flex items-center gap-1 text-xs text-brand-warning">
                    <AlertTriangle className="w-3 h-3" />
                    {suggestion.warnings.length} warning{suggestion.warnings.length > 1 ? "s" : ""}
                  </span>
                )}

                {approved.has(i) ? (
                  <span className="flex items-center gap-1.5 text-xs text-brand-success font-medium px-3 py-1.5 rounded-lg bg-brand-success/10 border border-brand-success/20">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Approved
                  </span>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      approveCohort(i)
                    }}
                    disabled={approving === i}
                    className="text-xs px-3 py-1.5 rounded-lg bg-brand-primary text-white font-medium hover:bg-brand-primary-hover transition-all disabled:opacity-60"
                  >
                    {approving === i ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      "Approve"
                    )}
                  </button>
                )}

                <ChevronDown
                  className={`w-4 h-4 text-brand-text-muted transition-transform ${suggestion.expanded ? "rotate-180" : ""}`}
                />
              </div>
            </div>

            {/* Expanded detail */}
            <AnimatePresence>
              {suggestion.expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden border-t border-brand-border"
                >
                  <div className="p-5 space-y-5">
                    {/* Member cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {suggestion.members.map((member) => (
                        <div
                          key={member.id}
                          className="p-3 rounded-xl bg-brand-bg border border-brand-border"
                        >
                          <div className="w-10 h-10 rounded-full bg-brand-primary/15 flex items-center justify-center text-sm font-bold text-brand-primary mb-2">
                            {member.profile?.firstName?.[0]}{member.profile?.lastName?.[0]}
                          </div>
                          <p className="font-medium text-brand-text text-sm">
                            {member.profile?.firstName} {member.profile?.lastName}
                          </p>
                          <p className="text-xs text-brand-text-subtle mt-0.5">
                            {member.driveProfile.archetype}
                          </p>
                          <p className="text-xs text-brand-text-subtle mt-0.5">
                            Ambition: {Math.round(member.driveProfile.ambition)}
                          </p>

                          {/* Dimension mini-bars */}
                          <div className="mt-2 space-y-1">
                            {[
                              { label: "A", value: member.driveProfile.ambition, color: "#1DB896" },
                              { label: "D", value: member.driveProfile.discipline, color: "#179E80" },
                              { label: "C", value: member.driveProfile.community, color: "#7CC455" },
                            ].map((dim) => (
                              <div key={dim.label} className="flex items-center gap-1.5">
                                <span className="text-[10px] text-brand-text-subtle w-3">{dim.label}</span>
                                <div className="flex-1 h-1 bg-brand-border rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${dim.value}%`,
                                      backgroundColor: dim.color,
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pairwise scores */}
                    <div>
                      <p className="text-xs font-medium text-brand-text-subtle uppercase tracking-wider mb-2">
                        Pairwise Compatibility
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {suggestion.pairScores.map((ps) => {
                          const memberA = suggestion.members.find((m) => m.id === ps.userA)
                          const memberB = suggestion.members.find((m) => m.id === ps.userB)
                          const pct = Math.round(ps.score * 100)
                          return (
                            <div
                              key={`${ps.userA}-${ps.userB}`}
                              className="flex items-center justify-between p-2 rounded-lg bg-brand-bg text-xs"
                            >
                              <span className="text-brand-text-muted">
                                {memberA?.profile?.firstName} × {memberB?.profile?.firstName}
                              </span>
                              <span
                                className={`font-semibold ${
                                  pct >= 75 ? "text-brand-success" :
                                  pct >= 55 ? "text-brand-warning" : "text-brand-error"
                                }`}
                              >
                                {pct}%
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Warnings */}
                    {suggestion.warnings.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-brand-warning uppercase tracking-wider">
                          Warnings
                        </p>
                        {suggestion.warnings.map((w, wi) => (
                          <div
                            key={wi}
                            className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-brand-warning flex-shrink-0" />
                            <span className="text-xs text-brand-warning">{w}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Empty state */}
      {!loading && suggestions.length === 0 && !error && (
        <div className="text-center py-20 text-brand-text-subtle">
          <Sparkles className="w-10 h-10 mx-auto mb-4 text-brand-border" />
          <p className="text-lg font-medium text-brand-text-muted mb-2">
            No suggestions yet
          </p>
          <p className="text-sm max-w-sm mx-auto">
            Run the matching engine to generate cohort suggestions from users in the pool.
            You need at least 4 users with completed assessments.
          </p>
        </div>
      )}
    </div>
  )
}
