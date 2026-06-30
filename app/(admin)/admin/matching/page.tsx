"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Users,
  ChevronDown,
  X,
  UserPlus,
  RefreshCw,
  Info,
  Search,
} from "lucide-react"
import { cohortThemeLabel } from "@/lib/utils"
import type { CohortSuggestion, MatchableUser } from "@/lib/matching"

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

type AddingMode =
  | false               // panel closed
  | "add"               // adding a new member
  | { replace: string } // replacing member with this id

interface DraftSuggestion extends CohortSuggestion {
  // UI state
  expanded: boolean
  // Draft editing — these are what Approve actually uses
  draftMembers: MatchableUser[]
  // Original AI members — never mutated after initial load
  originalMembers: MatchableUser[]
  isManuallyEdited: boolean
  // Picker panel state
  addingMode: AddingMode
  addSearch: string
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function initDraft(s: CohortSuggestion): DraftSuggestion {
  return {
    ...s,
    expanded: true,
    draftMembers: [...s.members],
    originalMembers: [...s.members],
    isManuallyEdited: false,
    addingMode: false,
    addSearch: "",
  }
}

function memberInitials(m: MatchableUser): string {
  return `${m.profile?.firstName?.[0] ?? "?"}${m.profile?.lastName?.[0] ?? ""}`
}

function memberFullName(m: MatchableUser): string {
  return `${m.profile?.firstName ?? ""} ${m.profile?.lastName ?? ""}`.trim() || "Unknown"
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────

export default function AdminMatchingPage() {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<DraftSuggestion[]>([])
  const [approving, setApproving] = useState<number | null>(null)
  const [approved, setApproved] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [poolSize, setPoolSize] = useState<number | null>(null)
  // Full pool returned by the matching API — used for Add/Replace pickers
  const [poolUsers, setPoolUsers] = useState<MatchableUser[]>([])
  // Per-cohort duplicate-add warning
  const [dupWarning, setDupWarning] = useState<number | null>(null)

  // ── Run matching ──────────────────────────────────────────

  const runMatching = async () => {
    setLoading(true)
    setError(null)
    setSuggestions([])
    setApproved(new Set())
    setPoolUsers([])
    setDupWarning(null)

    try {
      const res = await fetch("/api/matching/suggest", { method: "POST" })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || "Matching failed")

      setSuggestions(
        (data.suggestions as CohortSuggestion[]).map(initDraft)
      )
      setPoolSize(data.poolSize)
      setPoolUsers(data.poolUsers ?? [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Draft editing ─────────────────────────────────────────

  const toggleExpand = (i: number) =>
    setSuggestions((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, expanded: !s.expanded } : s))
    )

  const openAddPanel = (i: number) =>
    setSuggestions((prev) =>
      prev.map((s, idx) =>
        idx === i ? { ...s, addingMode: "add", addSearch: "" } : s
      )
    )

  const openReplacePanel = (i: number, memberId: string) =>
    setSuggestions((prev) =>
      prev.map((s, idx) =>
        idx === i
          ? { ...s, addingMode: { replace: memberId }, addSearch: "" }
          : s
      )
    )

  const closePanel = (i: number) =>
    setSuggestions((prev) =>
      prev.map((s, idx) =>
        idx === i ? { ...s, addingMode: false, addSearch: "" } : s
      )
    )

  const setAddSearch = (i: number, value: string) =>
    setSuggestions((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, addSearch: value } : s))
    )

  const removeMember = (i: number, memberId: string) => {
    setSuggestions((prev) =>
      prev.map((s, idx) => {
        if (idx !== i) return s
        const draftMembers = s.draftMembers.filter((m) => m.id !== memberId)
        return {
          ...s,
          draftMembers,
          isManuallyEdited: true,
          addingMode: false,
        }
      })
    )
  }

  const addMember = (i: number, user: MatchableUser) => {
    setSuggestions((prev) =>
      prev.map((s, idx) => {
        if (idx !== i) return s
        // Duplicate guard
        if (s.draftMembers.some((m) => m.id === user.id)) {
          setDupWarning(i)
          setTimeout(() => setDupWarning(null), 3000)
          return { ...s, addingMode: false }
        }
        return {
          ...s,
          draftMembers: [...s.draftMembers, user],
          isManuallyEdited: true,
          addingMode: false,
          addSearch: "",
        }
      })
    )
  }

  const replaceMember = (i: number, oldId: string, newUser: MatchableUser) => {
    setSuggestions((prev) =>
      prev.map((s, idx) => {
        if (idx !== i) return s
        // Duplicate guard
        if (s.draftMembers.some((m) => m.id === newUser.id && m.id !== oldId)) {
          setDupWarning(i)
          setTimeout(() => setDupWarning(null), 3000)
          return { ...s, addingMode: false }
        }
        return {
          ...s,
          draftMembers: s.draftMembers.map((m) => (m.id === oldId ? newUser : m)),
          isManuallyEdited: true,
          addingMode: false,
          addSearch: "",
        }
      })
    )
  }

  // ── Approve ───────────────────────────────────────────────

  const approveCohort = async (index: number) => {
    const suggestion = suggestions[index]
    if (suggestion.draftMembers.length === 0) return
    setApproving(index)

    const isEdited = suggestion.isManuallyEdited
    const notes = isEdited
      ? `Manually edited before approval. Original AI score: ${suggestion.compatibilityScore.toFixed(1)}. Final members: ${suggestion.draftMembers.map(memberFullName).join(", ")}.`
      : `Approved via matching engine. Score: ${suggestion.compatibilityScore.toFixed(1)}`

    try {
      const res = await fetch("/api/cohorts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberIds: suggestion.draftMembers.map((m) => m.id),
          theme: suggestion.themeAlignment || "GENERAL",
          matchScore: suggestion.compatibilityScore,
          matchingVersion: suggestion.matchingVersion,
          notes,
          wasManuallyEdited: isEdited,
          originalMemberIds: suggestion.originalMembers.map((m) => m.id),
        }),
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || "Cohort creation failed")
      }

      setApproved((prev) => new Set([...prev, index]))
    } catch (err: any) {
      console.error(err)
      setError(err.message)
    } finally {
      setApproving(null)
    }
  }

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-text">
            Matching Engine
          </h1>
          <p className="text-brand-text-muted text-sm mt-1">
            AI generates cohort suggestions. Review, edit members, then approve.
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
            matching pool.{" "}
            <span className="text-brand-text font-semibold">{suggestions.length}</span>{" "}
            cohort suggestion{suggestions.length !== 1 ? "s" : ""} generated.
          </p>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-brand-text-subtle">
            <Info className="w-3 h-3" />
            AI suggested · you can edit before approving
          </div>
        </div>
      )}

      {/* Suggestions */}
      <div className="space-y-4">
        {suggestions.map((suggestion, i) => (
          <SuggestionCard
            key={i}
            index={i}
            suggestion={suggestion}
            poolUsers={poolUsers}
            allSuggestions={suggestions}
            isApproved={approved.has(i)}
            isApproving={approving === i}
            dupWarning={dupWarning === i}
            onToggleExpand={() => toggleExpand(i)}
            onApprove={() => approveCohort(i)}
            onRemove={(memberId) => removeMember(i, memberId)}
            onOpenAdd={() => openAddPanel(i)}
            onOpenReplace={(memberId) => openReplacePanel(i, memberId)}
            onClosePanel={() => closePanel(i)}
            onSearchChange={(v) => setAddSearch(i, v)}
            onAddMember={(user) => addMember(i, user)}
            onReplaceMember={(oldId, newUser) => replaceMember(i, oldId, newUser)}
          />
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

// ─────────────────────────────────────────────────────────────
// SUGGESTION CARD (extracted for clarity)
// ─────────────────────────────────────────────────────────────

interface SuggestionCardProps {
  index: number
  suggestion: DraftSuggestion
  poolUsers: MatchableUser[]
  allSuggestions: DraftSuggestion[]
  isApproved: boolean
  isApproving: boolean
  dupWarning: boolean
  onToggleExpand: () => void
  onApprove: () => void
  onRemove: (memberId: string) => void
  onOpenAdd: () => void
  onOpenReplace: (memberId: string) => void
  onClosePanel: () => void
  onSearchChange: (v: string) => void
  onAddMember: (user: MatchableUser) => void
  onReplaceMember: (oldId: string, newUser: MatchableUser) => void
}

function SuggestionCard({
  index,
  suggestion,
  poolUsers,
  allSuggestions,
  isApproved,
  isApproving,
  dupWarning,
  onToggleExpand,
  onApprove,
  onRemove,
  onOpenAdd,
  onOpenReplace,
  onClosePanel,
  onSearchChange,
  onAddMember,
  onReplaceMember,
}: SuggestionCardProps) {
  const { draftMembers, originalMembers, isManuallyEdited, addingMode, addSearch } = suggestion
  const memberCount = draftMembers.length
  const idealSize = 4

  // Size warnings
  const sizeWarning =
    memberCount === 0
      ? "Cohort has no members. Add at least one before approving."
      : memberCount < idealSize
      ? `${memberCount} member${memberCount === 1 ? "" : "s"} — ideal is ${idealSize}.`
      : memberCount > idealSize
      ? `${memberCount} members — ideal is ${idealSize}. Consider removing some.`
      : null

  // Members eligible to add/replace — exclude anyone already in this draft
  const currentIds = new Set(draftMembers.map((m) => m.id))

  // Filtered by search
  const eligibleUsers = useMemo(() => {
    const base = poolUsers.filter((u) => !currentIds.has(u.id))
    if (!addSearch.trim()) return base
    const q = addSearch.toLowerCase()
    return base.filter(
      (u) =>
        memberFullName(u).toLowerCase().includes(q) ||
        u.driveProfile.archetype?.toLowerCase().includes(q)
    )
  }, [poolUsers, currentIds, addSearch])

  // What member is being replaced (if any)
  const replacingId =
    addingMode && typeof addingMode === "object" ? addingMode.replace : null
  const replacingMember = replacingId
    ? draftMembers.find((m) => m.id === replacingId)
    : null

  const panelTitle = replacingId
    ? `Replace ${replacingMember ? memberFullName(replacingMember) : "member"} with…`
    : "Add a member"

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`
        rounded-xl border transition-all
        ${isApproved
          ? "border-brand-success/30 bg-brand-success/5"
          : isManuallyEdited
          ? "border-brand-primary/30 bg-brand-surface"
          : "border-brand-border bg-brand-surface"
        }
      `}
    >
      {/* ── Card header ───────────────────────────────────── */}
      <div
        className="flex items-center justify-between p-5 cursor-pointer"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-4">
          {/* Score ring */}
          <div className="relative w-14 h-14 flex-shrink-0">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="24" fill="none" stroke="#1E1E2E" strokeWidth="4" />
              <circle
                cx="28" cy="28" r="24"
                fill="none"
                stroke={
                  suggestion.compatibilityScore >= 75
                    ? "#1DB896"
                    : suggestion.compatibilityScore >= 55
                    ? "#EE9F52"
                    : "#EF4444"
                }
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
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-semibold text-brand-text">Cohort #{index + 1}</span>
              {suggestion.themeAlignment && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary font-medium">
                  {cohortThemeLabel(suggestion.themeAlignment)}
                </span>
              )}
              {isManuallyEdited && !isApproved && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-medium">
                  Manually edited
                </span>
              )}
            </div>
            {/* Member avatars — reflects draft */}
            <div className="flex -space-x-1.5">
              {draftMembers.map((member) => (
                <div
                  key={member.id}
                  className="w-6 h-6 rounded-full bg-brand-primary/20 border border-brand-surface flex items-center justify-center text-[10px] font-bold text-brand-primary"
                >
                  {memberInitials(member)}
                </div>
              ))}
              {memberCount === 0 && (
                <span className="text-xs text-brand-error">No members</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Original AI score label (only when edited) */}
          {isManuallyEdited && !isApproved && (
            <span className="hidden md:block text-[10px] text-brand-text-subtle">
              AI score: {Math.round(suggestion.compatibilityScore)}
              <br />
              <span className="text-amber-400">before manual edits</span>
            </span>
          )}

          {/* Warnings badge */}
          {suggestion.warnings.length > 0 && (
            <span className="hidden md:flex items-center gap-1 text-xs text-brand-warning">
              <AlertTriangle className="w-3 h-3" />
              {suggestion.warnings.length} warning{suggestion.warnings.length > 1 ? "s" : ""}
            </span>
          )}

          {isApproved ? (
            <span className="flex items-center gap-1.5 text-xs text-brand-success font-medium px-3 py-1.5 rounded-lg bg-brand-success/10 border border-brand-success/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Approved
            </span>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onApprove()
              }}
              disabled={isApproving || memberCount === 0}
              title={memberCount === 0 ? "Add at least one member before approving" : undefined}
              className="text-xs px-3 py-1.5 rounded-lg bg-brand-primary text-white font-medium hover:bg-brand-primary-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isApproving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isManuallyEdited ? (
                "Approve Edited"
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

      {/* ── Expanded detail ───────────────────────────────── */}
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

              {/* ── Edit info banner ──────────────────────── */}
              {!isApproved && (
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-brand-bg border border-brand-border text-xs text-brand-text-subtle">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 text-brand-primary" />
                  AI suggested this cohort. Remove, add, or replace members below before approving.
                </div>
              )}

              {/* ── Size warning ──────────────────────────── */}
              {!isApproved && sizeWarning && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border ${
                  memberCount === 0
                    ? "bg-brand-error/10 border-brand-error/30 text-brand-error"
                    : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                }`}>
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  {sizeWarning}
                </div>
              )}

              {/* ── Duplicate warning ─────────────────────── */}
              {dupWarning && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs border bg-brand-error/10 border-brand-error/30 text-brand-error">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  This person is already in this cohort.
                </div>
              )}

              {/* ── Member cards ──────────────────────────── */}
              <div>
                <p className="text-xs font-medium text-brand-text-subtle uppercase tracking-wider mb-3">
                  Members ({memberCount})
                  {isManuallyEdited && (
                    <span className="ml-2 normal-case text-amber-400">
                      · AI score reflects original {originalMembers.length}-person group
                    </span>
                  )}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {draftMembers.map((member) => (
                    <MemberCard
                      key={member.id}
                      member={member}
                      isApproved={isApproved}
                      onRemove={() => onRemove(member.id)}
                      onReplace={() => onOpenReplace(member.id)}
                    />
                  ))}

                  {/* "Add member" card placeholder */}
                  {!isApproved && (
                    <button
                      onClick={onOpenAdd}
                      className="p-3 rounded-xl border-2 border-dashed border-brand-border hover:border-brand-primary/40 text-brand-text-subtle hover:text-brand-primary transition-all flex flex-col items-center justify-center gap-2 min-h-[120px]"
                    >
                      <UserPlus className="w-5 h-5" />
                      <span className="text-xs font-medium">Add member</span>
                    </button>
                  )}
                </div>
              </div>

              {/* ── Add / Replace picker panel ────────────── */}
              <AnimatePresence>
                {addingMode !== false && !isApproved && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="rounded-xl border border-brand-primary/25 bg-brand-bg overflow-hidden"
                  >
                    {/* Panel header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border">
                      <div className="flex items-center gap-2">
                        {replacingId ? (
                          <RefreshCw className="w-3.5 h-3.5 text-brand-primary" />
                        ) : (
                          <UserPlus className="w-3.5 h-3.5 text-brand-primary" />
                        )}
                        <span className="text-sm font-medium text-brand-text">{panelTitle}</span>
                      </div>
                      <button
                        onClick={onClosePanel}
                        className="text-brand-text-subtle hover:text-brand-text transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Search */}
                    <div className="px-4 pt-3 pb-2">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-surface border border-brand-border">
                        <Search className="w-3.5 h-3.5 text-brand-text-subtle flex-shrink-0" />
                        <input
                          autoFocus
                          type="text"
                          value={addSearch}
                          onChange={(e) => onSearchChange(e.target.value)}
                          placeholder="Search by name or archetype…"
                          className="flex-1 bg-transparent text-sm text-brand-text placeholder:text-brand-text-subtle outline-none"
                        />
                      </div>
                    </div>

                    {/* User list */}
                    <div className="max-h-64 overflow-y-auto px-4 pb-4">
                      {eligibleUsers.length === 0 ? (
                        <p className="text-xs text-brand-text-subtle text-center py-6">
                          {addSearch
                            ? "No matching users found."
                            : "No eligible users available. All pool members are already in this cohort."}
                        </p>
                      ) : (
                        <div className="space-y-1.5 mt-2">
                          {eligibleUsers.map((user) => (
                            <PickerRow
                              key={user.id}
                              user={user}
                              onSelect={() => {
                                if (replacingId) {
                                  onReplaceMember(replacingId, user)
                                } else {
                                  onAddMember(user)
                                }
                              }}
                              actionLabel={replacingId ? "Replace" : "Add"}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Pairwise scores ───────────────────────── */}
              {suggestion.pairScores.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-brand-text-subtle uppercase tracking-wider mb-2">
                    Pairwise Compatibility
                    {isManuallyEdited && (
                      <span className="ml-1 normal-case text-brand-text-subtle font-normal">
                        (original AI scores)
                      </span>
                    )}
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
                              pct >= 75
                                ? "text-brand-success"
                                : pct >= 55
                                ? "text-brand-warning"
                                : "text-brand-error"
                            }`}
                          >
                            {pct}%
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── AI matching warnings ──────────────────── */}
              {suggestion.warnings.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-brand-warning uppercase tracking-wider">
                    Matching Warnings
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
  )
}

// ─────────────────────────────────────────────────────────────
// MEMBER CARD
// ─────────────────────────────────────────────────────────────

interface MemberCardProps {
  member: MatchableUser
  isApproved: boolean
  onRemove: () => void
  onReplace: () => void
}

function MemberCard({ member, isApproved, onRemove, onReplace }: MemberCardProps) {
  return (
    <div className="relative p-3 rounded-xl bg-brand-bg border border-brand-border group">
      {/* Admin controls — visible on hover, hidden after approval */}
      {!isApproved && (
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onReplace}
            title="Replace this member"
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-brand-text-subtle bg-brand-surface border border-brand-border hover:text-brand-primary hover:border-brand-primary/40 transition-colors"
          >
            <RefreshCw className="w-2.5 h-2.5" />
            Swap
          </button>
          <button
            onClick={onRemove}
            title="Remove from cohort"
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-brand-text-subtle bg-brand-surface border border-brand-border hover:text-brand-error hover:border-brand-error/40 transition-colors"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      )}

      <div className="w-10 h-10 rounded-full bg-brand-primary/15 flex items-center justify-center text-sm font-bold text-brand-primary mb-2">
        {memberInitials(member)}
      </div>
      <p className="font-medium text-brand-text text-sm pr-10">
        {memberFullName(member)}
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
                style={{ width: `${dim.value}%`, backgroundColor: dim.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PICKER ROW
// ─────────────────────────────────────────────────────────────

interface PickerRowProps {
  user: MatchableUser
  onSelect: () => void
  actionLabel: "Add" | "Replace"
}

function PickerRow({ user, onSelect, actionLabel }: PickerRowProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-brand-surface transition-colors">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-brand-primary/15 flex items-center justify-center text-xs font-bold text-brand-primary flex-shrink-0">
          {memberInitials(user)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-brand-text truncate">{memberFullName(user)}</p>
          <p className="text-xs text-brand-text-subtle truncate">{user.driveProfile.archetype}</p>
        </div>
      </div>
      <button
        onClick={onSelect}
        className={`ml-3 flex-shrink-0 text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
          actionLabel === "Replace"
            ? "bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25"
            : "bg-brand-primary/15 border border-brand-primary/30 text-brand-primary hover:bg-brand-primary/25"
        }`}
      >
        {actionLabel}
      </button>
    </div>
  )
}
