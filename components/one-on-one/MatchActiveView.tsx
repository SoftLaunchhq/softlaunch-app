"use client"

import { useState } from "react"
import { OneOnOneChat } from "./OneOnOneChat"
import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink, RefreshCw, Star } from "lucide-react"

// ── Types ────────────────────────────────────────────────────

interface Peer {
  id: string
  firstName: string | null
  lastName: string | null
  photoUrl: string | null
  headline: string | null
  bio: string | null
  linkedinUrl: string | null
  archetype: string | null
  archetypeSlug: string | null
  driveSummary: string | null
  ambition: number | null
  ambitionType: string | null
  energyStyle: string | null
  communicationStyle: string | null
  accountabilityNeed: string | null
  emotionalDriver: string | null
  psychSummary: string | null
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

interface MatchActiveViewProps {
  matchId: string
  status: "APPROVED" | "ACTIVE"
  compatibilityScore: number
  matchReason: string | null
  frictionPoints: string[] | null
  suggestedPrompt: string | null
  scoreBreakdown: ScoreBreakdown | null
  peer: Peer
  currentUserId: string
  isUserA: boolean
}

// ── Sub-components ───────────────────────────────────────────

function ScoreBar({ label, value, color = "brand-primary" }: { label: string; value: number; color?: string }) {
  const pct = Math.round(value * 100)
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-brand-text-subtle">{label}</span>
        <span className="text-xs font-semibold text-brand-text">{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-brand-border/50">
        <div
          className="h-1.5 rounded-full bg-brand-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function Avatar({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
  if (photoUrl) {
    return <img src={photoUrl} alt={name} className="h-20 w-20 rounded-2xl object-cover border border-brand-border/60" />
  }
  return (
    <div className="h-20 w-20 rounded-2xl bg-brand-primary/15 border border-brand-primary/25 flex items-center justify-center text-2xl font-bold text-brand-primary">
      {initials}
    </div>
  )
}

function CompatibilityRing({ score }: { score: number }) {
  const rounded = Math.round(score)
  const color = score >= 75 ? "#22c55e" : score >= 55 ? "#f59e0b" : "#ef4444"
  const circumference = 2 * Math.PI * 34
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
        <circle cx="44" cy="44" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle
          cx="44" cy="44" r="34" fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold leading-none" style={{ color }}>{rounded}</span>
        <span className="text-[9px] text-brand-text-subtle mt-0.5">/ 100</span>
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────

export function MatchActiveView({
  matchId,
  status,
  compatibilityScore,
  matchReason,
  frictionPoints,
  suggestedPrompt,
  scoreBreakdown,
  peer,
  currentUserId,
  isUserA,
}: MatchActiveViewProps) {
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [showFriction, setShowFriction] = useState(false)
  const [rematchRequesting, setRematchRequesting] = useState(false)
  const [rematchDone, setRematchDone] = useState(false)

  const peerName = `${peer.firstName ?? ""} ${peer.lastName ?? ""}`.trim() || "Your Match"

  const handleRematch = async () => {
    if (rematchDone) return
    setRematchRequesting(true)
    try {
      await fetch("/api/one-on-one/my-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_rematch", matchId }),
      })
      setRematchDone(true)
    } catch {
      // non-fatal
    } finally {
      setRematchRequesting(false)
    }
  }

  const formatLabel = (s: string | null) =>
    s ? s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : null

  return (
    <div className="space-y-6">
      {/* ── Match hero ── */}
      <div className="neon-panel p-6 md:p-8">
        <div className="neon-chip mb-5">Meet your strongest match.</div>

        <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
          {/* Avatar */}
          <Avatar name={peerName} photoUrl={peer.photoUrl} />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl font-bold text-brand-text md:text-3xl">
              {peerName}
            </h1>
            {peer.headline && (
              <p className="mt-1 text-sm text-brand-text-muted">{peer.headline}</p>
            )}
            {peer.archetype && (
              <span className="mt-2 inline-block rounded-full border border-brand-primary/30 bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-primary">
                {peer.archetype}
              </span>
            )}
            {peer.linkedinUrl && (
              <a
                href={peer.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 ml-2 inline-flex items-center gap-1 text-xs text-brand-text-subtle hover:text-brand-text"
              >
                LinkedIn <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {/* Score ring */}
          <div className="flex-shrink-0 flex flex-col items-center gap-1">
            <CompatibilityRing score={compatibilityScore} />
            <p className="text-[10px] text-brand-text-subtle uppercase tracking-wider font-semibold">
              Compatibility
            </p>
          </div>
        </div>

        {/* Why you match */}
        {matchReason && (
          <div className="mt-6 rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-4">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-primary flex items-center gap-1">
              <Star className="h-3 w-3" /> Why you match
            </p>
            <p className="text-sm leading-relaxed text-brand-text-muted">{matchReason}</p>
          </div>
        )}
      </div>

      {/* ── Peer psych snapshot ── */}
      <div className="sl-panel p-6 grid sm:grid-cols-2 gap-4">
        <div>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-brand-text-subtle">
            About {peer.firstName ?? "them"}
          </h3>
          <div className="space-y-2">
            {peer.ambitionType && (
              <div className="flex items-center justify-between rounded-lg bg-brand-bg/40 border border-brand-border/60 px-3 py-2">
                <span className="text-xs text-brand-text-subtle">Ambition type</span>
                <span className="text-xs font-semibold text-brand-text">{formatLabel(peer.ambitionType)}</span>
              </div>
            )}
            {peer.energyStyle && (
              <div className="flex items-center justify-between rounded-lg bg-brand-bg/40 border border-brand-border/60 px-3 py-2">
                <span className="text-xs text-brand-text-subtle">Energy style</span>
                <span className="text-xs font-semibold text-brand-text">{formatLabel(peer.energyStyle)}</span>
              </div>
            )}
            {peer.communicationStyle && (
              <div className="flex items-center justify-between rounded-lg bg-brand-bg/40 border border-brand-border/60 px-3 py-2">
                <span className="text-xs text-brand-text-subtle">Communication</span>
                <span className="text-xs font-semibold text-brand-text">{formatLabel(peer.communicationStyle)}</span>
              </div>
            )}
            {peer.accountabilityNeed && (
              <div className="flex items-center justify-between rounded-lg bg-brand-bg/40 border border-brand-border/60 px-3 py-2">
                <span className="text-xs text-brand-text-subtle">Accountability</span>
                <span className="text-xs font-semibold text-brand-text">{formatLabel(peer.accountabilityNeed)}</span>
              </div>
            )}
            {peer.emotionalDriver && (
              <div className="flex items-center justify-between rounded-lg bg-brand-bg/40 border border-brand-border/60 px-3 py-2">
                <span className="text-xs text-brand-text-subtle">Emotional driver</span>
                <span className="text-xs font-semibold text-brand-text">{formatLabel(peer.emotionalDriver)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Score breakdown */}
        {scoreBreakdown && (
          <div>
            <button
              onClick={() => setShowBreakdown((p) => !p)}
              className="mb-3 flex w-full items-center justify-between text-xs font-bold uppercase tracking-wider text-brand-text-subtle hover:text-brand-text"
            >
              Score breakdown
              {showBreakdown ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {showBreakdown && (
              <div className="space-y-3">
                <ScoreBar label="Ambition" value={scoreBreakdown.ambition} />
                <ScoreBar label="Discipline" value={scoreBreakdown.discipline} />
                <ScoreBar label="Communication" value={scoreBreakdown.communicationStyle} />
                <ScoreBar label="Accountability fit" value={scoreBreakdown.accountabilityFit} />
                <ScoreBar label="Emotional driver" value={scoreBreakdown.emotionalDriver} />
                <ScoreBar label="Growth mindset" value={scoreBreakdown.growth} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Friction points ── */}
      {frictionPoints && frictionPoints.length > 0 && (
        <div className="sl-panel p-5">
          <button
            onClick={() => setShowFriction((p) => !p)}
            className="flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-semibold text-brand-text">Possible friction points</span>
              <span className="rounded-full bg-amber-500/15 border border-amber-500/25 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                {frictionPoints.length}
              </span>
            </div>
            {showFriction ? <ChevronUp className="h-4 w-4 text-brand-text-subtle" /> : <ChevronDown className="h-4 w-4 text-brand-text-subtle" />}
          </button>

          {showFriction && (
            <div className="mt-4 space-y-2">
              {frictionPoints.map((point, i) => (
                <div key={i} className="rounded-xl border border-amber-500/15 bg-amber-500/5 px-4 py-3 text-sm text-brand-text-muted">
                  {point}
                </div>
              ))}
              <p className="mt-2 text-xs text-brand-text-subtle">
                Awareness of friction points helps you navigate them proactively. Name them early.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Chat ── */}
      <OneOnOneChat
        matchId={matchId}
        currentUserId={currentUserId}
        suggestedPrompt={suggestedPrompt}
        peerFirstName={peer.firstName}
      />

      {/* ── Footer actions ── */}
      <div className="sl-panel p-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-brand-text">Not feeling this match?</p>
          <p className="mt-0.5 text-xs text-brand-text-subtle">
            Request a rematch and we&apos;ll find a stronger fit. This takes 48–72 hours.
          </p>
        </div>
        <button
          onClick={handleRematch}
          disabled={rematchRequesting || rematchDone}
          className="inline-flex items-center gap-2 rounded-xl border border-brand-border/60 bg-brand-bg/40 px-4 py-2.5 text-sm font-medium text-brand-text-muted transition-all hover:border-brand-border hover:text-brand-text disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${rematchRequesting ? "animate-spin" : ""}`} />
          {rematchDone ? "Rematch requested" : "Request rematch"}
        </button>
      </div>
    </div>
  )
}
