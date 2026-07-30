"use client"

/**
 * MeetupBanner
 *
 * Shows the current first-meetup state and available actions.
 * Rendered above the cohort chat.  When a poll is active, it also
 * renders the full voting widget inline.
 *
 * States rendered:
 *   NOT_STARTED            → "Plan your first meetup" CTA
 *   TIME_PROPOSED          → Proposed time + Confirm button
 *   TIME_CONFIRMED         → Who's in Charlotte? 2 buttons
 *   ASKING_EXISTING_LOCATION → "Suggest options" button
 *   POLL_ACTIVE            → Full poll voting widget
 *   LOCATION_CONFIRMED     → Meetup summary
 *   MEETUP_CONFIRMED       → Confirmed banner
 *   NO_COMMON_TIME         → "No common time" + leave option
 *   CHECKING_LOCATION      → Charlotte info message
 *   FINDING_TIME / null    → Loading or nothing
 */

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Calendar, MapPin, Users, CheckCircle2, Loader2, X, ChevronDown, ChevronUp, Vote, RefreshCw, Plane, LogOut
} from "lucide-react"
import { locationIcon } from "@/lib/meetup-locations"
import { DepartureModal } from "@/components/dashboard/DepartureModal"

// ─── Types ────────────────────────────────────────────────────

interface PollOption {
  id: string
  order: number
  name: string
  description: string
  address: string | null
  type: string
  recommended: boolean
  voteCount: number
}

interface Poll {
  id: string
  winnerId: string | null
  deadline: string | null
  closedAt: string | null
  options: PollOption[]
  totalVotes: number
  myVoteOptionId: string | null
}

interface Meetup {
  id: string
  state: string
  proposedTimeText: string | null
  proposedDate: string | null
  confirmedDate: string | null
  allInCharlotte: boolean | null
  confirmedLocation: string | null
}

interface MeetupBannerProps {
  cohortId: string
  currentUserId: string
  cohortName?: string
  /** Called after any state transition so CohortChat can refresh messages */
  onStateChange?: () => void
}

// ─── Main Component ───────────────────────────────────────────

export function MeetupBanner({ cohortId, currentUserId, cohortName = "your cohort", onStateChange }: MeetupBannerProps) {
  const [meetup, setMeetup] = useState<Meetup | null>(null)
  const [poll, setPoll] = useState<Poll | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isActing, setIsActing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [showDeparture, setShowDeparture] = useState(false)

  // ── Fetch state ───────────────────────────────────────────

  const fetchMeetup = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true)
    try {
      const res = await fetch(`/api/cohorts/${cohortId}/meetup`, { cache: "no-store" })
      if (!res.ok) return
      const data = await res.json()
      setMeetup(data.meetup)
      setPoll(data.poll)
    } catch {
      // Non-fatal
    } finally {
      setIsLoading(false)
    }
  }, [cohortId])

  useEffect(() => { fetchMeetup() }, [fetchMeetup])

  // Poll every 15 seconds when poll is active
  useEffect(() => {
    if (meetup?.state !== "POLL_ACTIVE") return
    const id = setInterval(() => fetchMeetup(true), 15_000)
    return () => clearInterval(id)
  }, [meetup?.state, fetchMeetup])

  // ── Action handler ────────────────────────────────────────

  const act = useCallback(async (action: string) => {
    setIsActing(true)
    setError(null)
    try {
      const res = await fetch(`/api/cohorts/${cohortId}/meetup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Something went wrong")
        return
      }
      await fetchMeetup(true)
      onStateChange?.()
    } catch {
      setError("Request failed — please try again")
    } finally {
      setIsActing(false)
    }
  }, [cohortId, fetchMeetup, onStateChange])

  // ── Vote handler ──────────────────────────────────────────

  const castVote = useCallback(async (optionId: string) => {
    setIsActing(true)
    setError(null)
    try {
      const res = await fetch(`/api/cohorts/${cohortId}/meetup/poll/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Vote failed")
        return
      }
      // Update poll vote counts optimistically
      setPoll((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          myVoteOptionId: optionId,
          totalVotes: prev.myVoteOptionId
            ? prev.totalVotes
            : prev.totalVotes + 1,
          options: prev.options.map((o) => ({
            ...o,
            voteCount: data.voteCounts[o.id] ?? 0,
          })),
        }
      })
    } catch {
      setError("Vote failed — please try again")
    } finally {
      setIsActing(false)
    }
  }, [cohortId])

  // ── Render ────────────────────────────────────────────────

  if (isLoading) return null

  // Don't show banner for terminal / not-yet-started states
  if (!meetup || meetup.state === "NOT_STARTED" || meetup.state === "COMPLETED" || meetup.state === "CANCELLED") {
    if (!meetup || meetup.state === "NOT_STARTED") {
      return (
        <div className="px-4 py-3 border-b border-brand-border/40 bg-brand-surface/30">
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-brand-primary flex-shrink-0" />
            <p className="text-sm text-brand-text-muted flex-1">
              <span className="font-medium text-brand-text">First Meetup</span> — let BUZZ find a time that works for everyone.
            </p>
            <button
              onClick={() => act("start")}
              disabled={isActing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-primary/20 border border-brand-primary/30 text-xs font-semibold text-brand-primary hover:bg-brand-primary/30 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Calendar className="w-3 h-3" />}
              Plan Meetup
            </button>
          </div>
        </div>
      )
    }
    return null
  }

  const state = meetup.state

  return (
    <>
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-brand-border/60 bg-brand-surface/40"
      >
        {/* Header row */}
        <div
          className="flex items-center justify-between px-4 py-2.5 cursor-pointer select-none"
          onClick={() => setCollapsed((c) => !c)}
        >
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-brand-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-primary">
              First Meetup
            </span>
            <StatePill state={state} />
          </div>
          <button className="text-brand-text-subtle hover:text-brand-text transition-colors">
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {/* Expandable body */}
        {!collapsed && (
          <div className="px-4 pb-3 space-y-3">
            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2">
                <p className="text-xs text-rose-300 flex-1">{error}</p>
                <button onClick={() => setError(null)}><X className="w-3 h-3 text-rose-400" /></button>
              </div>
            )}

            {/* TIME_PROPOSED */}
            {state === "TIME_PROPOSED" && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-brand-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-brand-text">Proposed time</p>
                    <p className="text-sm font-semibold text-brand-primary">{meetup.proposedTimeText}</p>
                  </div>
                </div>
                <button
                  onClick={() => act("confirm_time")}
                  disabled={isActing}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-primary/20 border border-brand-primary/40 text-sm font-semibold text-brand-primary hover:bg-brand-primary/30 transition-colors disabled:opacity-50 self-start sm:self-auto"
                >
                  {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Confirm Time
                </button>
              </div>
            )}

            {/* TIME_CONFIRMED → Charlotte check */}
            {state === "TIME_CONFIRMED" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-amber-300" />
                  <p className="text-sm text-brand-text">Are all members based in Charlotte?</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => act("everyone_in_charlotte")}
                    disabled={isActing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-sm font-medium text-emerald-200 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                  >
                    {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                    Yes — all in Charlotte
                  </button>
                  <button
                    onClick={() => act("not_everyone_charlotte")}
                    disabled={isActing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-sm font-medium text-amber-200 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                  >
                    Someone isn't in Charlotte
                  </button>
                </div>
              </div>
            )}

            {/* CHECKING_LOCATION → Travel willingness check */}
            {state === "CHECKING_LOCATION" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Plane className="w-4 h-4 text-amber-300" />
                  <p className="text-sm text-brand-text">
                    Would you be willing to travel to Charlotte for this meetup?
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => act("willing_to_travel")}
                    disabled={isActing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-sm font-medium text-emerald-200 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                  >
                    {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Yes, I can travel to Charlotte
                  </button>
                  <button
                    onClick={() => act("cannot_travel")}
                    disabled={isActing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-sm font-medium text-rose-300 hover:bg-rose-500/20 transition-colors disabled:opacity-50"
                  >
                    No, I can't travel there
                  </button>
                </div>
              </div>
            )}

            {/* ASKING_EXISTING_LOCATION */}
            {state === "ASKING_EXISTING_LOCATION" && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-brand-text-muted">
                  No spot in mind? BUZZ will suggest 4 options to vote on.
                </p>
                <button
                  onClick={() => act("no_existing_location")}
                  disabled={isActing}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-primary/15 border border-brand-primary/30 text-sm font-semibold text-brand-primary hover:bg-brand-primary/25 transition-colors disabled:opacity-50 self-start sm:self-auto"
                >
                  {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Vote className="w-3.5 h-3.5" />}
                  Suggest Options
                </button>
              </div>
            )}

            {/* POLL_ACTIVE */}
            {state === "POLL_ACTIVE" && poll && (
              <PollWidget
                poll={poll}
                onVote={castVote}
                onClose={() => act("close_poll")}
                isActing={isActing}
              />
            )}

            {/* LOCATION_CONFIRMED */}
            {state === "LOCATION_CONFIRMED" && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <p className="text-sm text-brand-text">
                    <span className="font-medium">{meetup.confirmedLocation}</span>
                    {meetup.proposedTimeText && ` · ${meetup.proposedTimeText}`}
                  </p>
                </div>
                <button
                  onClick={() => act("confirm_meetup")}
                  disabled={isActing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-sm font-medium text-emerald-200 hover:bg-emerald-500/25 transition-colors disabled:opacity-50 self-start sm:self-auto"
                >
                  {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Confirm Meetup
                </button>
              </div>
            )}

            {/* MEETUP_CONFIRMED */}
            {state === "MEETUP_CONFIRMED" && (
              <div className="flex items-center gap-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-200">Meetup confirmed</p>
                  <p className="text-xs text-brand-text-muted">
                    {meetup.proposedTimeText} at {meetup.confirmedLocation}
                  </p>
                </div>
              </div>
            )}

            {/* NO_COMMON_TIME */}
            {state === "NO_COMMON_TIME" && (
              <div className="space-y-2.5">
                <div className="rounded-xl bg-amber-500/8 border border-amber-500/20 px-3 py-2.5">
                  <p className="text-sm text-amber-200">
                    No common time found yet — but this cohort can still work! Head to your{" "}
                    <strong>Availability</strong> tab, add more windows, then retry.
                  </p>
                </div>
                <button
                  onClick={() => act("retry")}
                  disabled={isActing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-primary/15 border border-brand-primary/30 text-sm font-semibold text-brand-primary hover:bg-brand-primary/25 transition-colors disabled:opacity-50"
                >
                  {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Retry Scheduling
                </button>
              </div>
            )}

            {/* TRAVEL_DECLINED — only valid place to surface departure */}
            {state === "TRAVEL_DECLINED" && (
              <div className="space-y-2.5">
                <div className="rounded-xl bg-rose-500/8 border border-rose-500/20 px-3 py-2.5">
                  <p className="text-sm text-rose-200">
                    Since this cohort's meetups are in Charlotte and travel isn't possible, you may need to
                    find a better-fit group. See BUZZ's message above for your options.
                  </p>
                </div>
                <button
                  onClick={() => setShowDeparture(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-sm font-medium text-rose-300 hover:bg-rose-500/20 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Leave Cohort / Request Rematch
                </button>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>

    {showDeparture && (
      <DepartureModal
        cohortId={cohortId}
        cohortName={cohortName}
        isLocationIssue={true}
        onClose={() => setShowDeparture(false)}
        onConfirm={() => {
          setShowDeparture(false)
          onStateChange?.()
        }}
      />
    )}
  </>
  )
}

// ─── State Pill ───────────────────────────────────────────────

function StatePill({ state }: { state: string }) {
  const config: Record<string, { label: string; className: string }> = {
    FINDING_TIME:              { label: "Finding time…",     className: "text-brand-primary border-brand-primary/30 bg-brand-primary/10" },
    TIME_PROPOSED:             { label: "Time proposed",     className: "text-amber-300 border-amber-300/30 bg-amber-300/10" },
    TIME_CONFIRMED:            { label: "Time confirmed",    className: "text-emerald-300 border-emerald-300/30 bg-emerald-300/10" },
    CHECKING_LOCATION:         { label: "Travel check",     className: "text-amber-300 border-amber-300/30 bg-amber-300/10" },
    ASKING_EXISTING_LOCATION:  { label: "Pick a spot",      className: "text-brand-primary border-brand-primary/30 bg-brand-primary/10" },
    POLL_ACTIVE:               { label: "Vote open",        className: "text-brand-primary border-brand-primary/30 bg-brand-primary/10" },
    LOCATION_CONFIRMED:        { label: "Spot chosen",      className: "text-emerald-300 border-emerald-300/30 bg-emerald-300/10" },
    MEETUP_CONFIRMED:          { label: "Confirmed ✓",      className: "text-emerald-300 border-emerald-300/30 bg-emerald-300/10" },
    NO_COMMON_TIME:            { label: "No overlap",       className: "text-rose-300 border-rose-300/30 bg-rose-300/10" },
    TRAVEL_DECLINED:           { label: "Travel declined",  className: "text-rose-300 border-rose-300/30 bg-rose-300/10" },
    CANCELLED:                 { label: "Cancelled",        className: "text-brand-text-subtle border-brand-border bg-brand-surface" },
  }

  const c = config[state]
  if (!c) return null

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${c.className}`}>
      {c.label}
    </span>
  )
}

// ─── Poll Widget ──────────────────────────────────────────────

function useDeadlineCountdown(deadline: string | null) {
  const [remaining, setRemaining] = useState<string | null>(null)
  useEffect(() => {
    if (!deadline) return
    const update = () => {
      const diff = new Date(deadline).getTime() - Date.now()
      if (diff <= 0) { setRemaining("Closing soon…"); return }
      const h = Math.floor(diff / 3_600_000)
      const m = Math.floor((diff % 3_600_000) / 60_000)
      setRemaining(h > 0 ? `${h}h ${m}m left` : `${m}m left`)
    }
    update()
    const id = setInterval(update, 30_000)
    return () => clearInterval(id)
  }, [deadline])
  return remaining
}

function PollWidget({
  poll,
  onVote,
  onClose,
  isActing,
}: {
  poll: Poll
  onVote: (optionId: string) => void
  onClose: () => void
  isActing: boolean
}) {
  const countdown = useDeadlineCountdown(poll.deadline)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-text-subtle">
          Vote for your spot
        </p>
        <div className="flex items-center gap-3">
          {countdown && !poll.closedAt && (
            <span className="text-[11px] text-amber-300/80">⏱ {countdown}</span>
          )}
          <span className="text-[11px] text-brand-text-subtle">
            {poll.totalVotes} vote{poll.totalVotes !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {poll.options.map((opt) => {
          const isMyVote = poll.myVoteOptionId === opt.id
          const pct = poll.totalVotes > 0 ? Math.round((opt.voteCount / poll.totalVotes) * 100) : 0

          return (
            <button
              key={opt.id}
              onClick={() => !poll.closedAt && onVote(opt.id)}
              disabled={isActing || !!poll.closedAt}
              className={`
                relative overflow-hidden text-left rounded-xl border p-3 transition-all
                ${isMyVote
                  ? "border-brand-primary/50 bg-brand-primary/10"
                  : "border-brand-border/60 bg-brand-surface/50 hover:border-brand-primary/30 hover:bg-brand-surface/70"
                }
                ${poll.closedAt ? "cursor-default" : "cursor-pointer"}
                disabled:cursor-not-allowed
              `}
            >
              {/* Vote percentage bar */}
              {poll.totalVotes > 0 && (
                <div
                  className="absolute inset-y-0 left-0 bg-brand-primary/8 transition-all"
                  style={{ width: `${pct}%` }}
                />
              )}

              <div className="relative">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-brand-text leading-tight flex items-center gap-1.5 flex-wrap">
                      <span>{locationIcon(opt.type as any)}</span>
                      <span className="truncate">{opt.name}</span>
                      {isMyVote && <CheckCircle2 className="w-3.5 h-3.5 text-brand-primary flex-shrink-0" />}
                      {opt.recommended && (
                        <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider text-emerald-300 flex-shrink-0">
                          ★ Recommended
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-brand-text-muted mt-0.5 line-clamp-2">{opt.description}</p>
                    {opt.address && (
                      <p className="text-[10px] text-brand-text-subtle mt-1 flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5" />
                        {opt.address}
                      </p>
                    )}
                  </div>
                  {poll.totalVotes > 0 && (
                    <span className="text-xs font-bold text-brand-text-muted flex-shrink-0">{pct}%</span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Close poll button — shows after all 4 options have at least some votes, or admin wants to close */}
      {!poll.closedAt && poll.totalVotes >= 2 && (
        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            disabled={isActing}
            className="text-xs text-brand-text-subtle hover:text-brand-text transition-colors underline underline-offset-2"
          >
            {isActing ? "Closing…" : "Close poll & announce winner"}
          </button>
        </div>
      )}

      {poll.closedAt && (
        <p className="text-xs text-brand-text-subtle text-center pt-1">
          Voting closed
        </p>
      )}
    </div>
  )
}
