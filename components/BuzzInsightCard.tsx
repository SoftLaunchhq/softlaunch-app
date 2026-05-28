"use client"

/**
 * BuzzInsightCard — Displays the user's generated PsychProfile.
 *
 * Fetches from GET /api/buzz/profile-insight on mount.
 * Shows psychological dimensions, summary, and ideal peer traits.
 * Has a "Refresh Insights" button that calls POST /api/buzz/profile-insight.
 *
 * Used on /dashboard/buzz and /dashboard/profile.
 */

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Zap, Brain, RefreshCw, Loader2, ChevronDown, ChevronUp,
  Shield, Users, Flame, Eye, ArrowRight, Sparkles,
} from "lucide-react"

interface PsychProfile {
  id:                 string
  ambitionType:       string | null
  energyStyle:        string | null
  communicationStyle: string | null
  accountabilityNeed: string | null
  emotionalDriver:    string | null
  riskProfile:        string | null
  socialPreference:   string | null
  conflictStyle:      string | null
  matchingNeeds:      string[]
  redFlagsToAvoid:    string[]
  idealPeerTraits:    string[]
  summary:            string
  confidenceScore:    number
  generatedAt:        string | null
}

interface BuzzInsightCardProps {
  // If passed, skips the fetch (used in dashboard where profile is already loaded)
  initialProfile?: PsychProfile | null
  onRunOnboarding?: () => void
  className?: string
}

const DIMENSION_CONFIG: Array<{
  key:   keyof PsychProfile
  label: string
  icon:  React.ReactNode
  color: string
}> = [
  { key: "ambitionType",       label: "Ambition Style",     icon: <Flame className="w-3.5 h-3.5" />,  color: "text-orange-400" },
  { key: "energyStyle",        label: "Energy Style",        icon: <Zap className="w-3.5 h-3.5" />,    color: "text-yellow-400" },
  { key: "communicationStyle", label: "Communication",       icon: <Users className="w-3.5 h-3.5" />,  color: "text-blue-400"   },
  { key: "accountabilityNeed", label: "Accountability",      icon: <Shield className="w-3.5 h-3.5" />, color: "text-purple-400" },
  { key: "emotionalDriver",    label: "What Drives You",     icon: <Brain className="w-3.5 h-3.5" />,  color: "text-brand-primary" },
  { key: "riskProfile",        label: "Risk Tolerance",      icon: <ArrowRight className="w-3.5 h-3.5" />, color: "text-red-400" },
  { key: "socialPreference",   label: "Social Preference",   icon: <Users className="w-3.5 h-3.5" />,  color: "text-green-400"  },
  { key: "conflictStyle",      label: "Conflict Approach",   icon: <Eye className="w-3.5 h-3.5" />,    color: "text-pink-400"   },
]

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = pct >= 70 ? "bg-brand-primary" : pct >= 40 ? "bg-yellow-500" : "bg-red-500"
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-brand-border overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs text-brand-text-muted w-8 text-right">{pct}%</span>
    </div>
  )
}

export function BuzzInsightCard({
  initialProfile,
  onRunOnboarding,
  className = "",
}: BuzzInsightCardProps) {
  const [profile, setProfile]     = useState<PsychProfile | null>(initialProfile ?? null)
  const [loading, setLoading]     = useState(!initialProfile)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [expanded, setExpanded]   = useState(false)

  // Fetch profile on mount if not supplied
  useEffect(() => {
    if (initialProfile !== undefined) return
    fetch("/api/buzz/profile-insight")
      .then((r) => r.json())
      .then((data) => { setProfile(data.profile ?? null) })
      .catch(() => setError("Could not load your insights."))
      .finally(() => setLoading(false))
  }, [initialProfile])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      const res = await fetch("/api/buzz/profile-insight", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Refresh failed")
      setProfile(data.profile)
    } catch (err: any) {
      setError(err.message ?? "Could not refresh insights.")
    } finally {
      setRefreshing(false)
    }
  }, [])

  // ── Loading ──
  if (loading) {
    return (
      <div className={`rounded-2xl border border-brand-border bg-brand-surface p-6 ${className}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-xl bg-brand-primary/15 animate-pulse" />
          <div className="h-4 w-32 bg-brand-border rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-3 bg-brand-border rounded animate-pulse" style={{ width: `${80 - i * 10}%` }} />
          ))}
        </div>
      </div>
    )
  }

  // ── No profile yet ──
  if (!profile) {
    return (
      <div className={`rounded-2xl border border-brand-border bg-brand-surface p-6 ${className}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-primary to-brand-accent flex items-center justify-center shadow-[0_0_12px_rgba(29,184,150,0.3)]">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-brand-text">BUZZ Insights</h3>
            <p className="text-xs text-brand-text-muted">Your psychological profile</p>
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-brand-border bg-brand-surface-elevated p-4 text-center">
          <Sparkles className="w-5 h-5 text-brand-primary mx-auto mb-2" />
          <p className="text-sm text-brand-text mb-1">Profile not yet generated</p>
          <p className="text-xs text-brand-text-muted mb-4">
            BUZZ needs to learn about you first. Complete the BUZZ deep-dive to unlock your psychological profile.
          </p>
          {onRunOnboarding ? (
            <button
              onClick={onRunOnboarding}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary-hover transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              Start BUZZ Deep-Dive
            </button>
          ) : (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary-hover transition-colors disabled:opacity-50"
            >
              {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Generate from signals
            </button>
          )}
        </div>

        {error && <p className="text-xs text-red-400 mt-3 text-center">{error}</p>}
      </div>
    )
  }

  // ── Has profile ──
  const dimensions = DIMENSION_CONFIG.filter((d) => {
    const val = profile[d.key]
    return typeof val === "string" && val.trim().length > 0
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border border-brand-border bg-brand-surface overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="p-5 border-b border-brand-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-primary to-brand-accent flex items-center justify-center shadow-[0_0_12px_rgba(29,184,150,0.3)]">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-brand-text">BUZZ Insights</h3>
              <p className="text-xs text-brand-text-muted">Your psychological profile</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-text hover:bg-brand-surface-elevated transition-colors disabled:opacity-40"
            title="Refresh insights"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Confidence score */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-brand-text-muted">Profile Confidence</span>
            <span className="text-xs text-brand-text-subtle">
              {profile.generatedAt
                ? `Updated ${new Date(profile.generatedAt).toLocaleDateString()}`
                : "Just generated"}
            </span>
          </div>
          <ConfidenceBar score={profile.confidenceScore} />
          {profile.confidenceScore < 0.5 && (
            <p className="text-xs text-brand-text-subtle mt-1.5">
              Chat more with BUZZ to improve accuracy.
            </p>
          )}
        </div>
      </div>

      {/* Summary */}
      {profile.summary && (
        <div className="px-5 py-4 border-b border-brand-border bg-brand-primary/5">
          <p className="text-xs text-brand-text-muted uppercase tracking-wider mb-2 font-medium">BUZZ says</p>
          <p className="text-sm text-brand-text leading-relaxed italic">"{profile.summary}"</p>
        </div>
      )}

      {/* Dimensions grid */}
      <div className="p-5">
        <p className="text-xs text-brand-text-muted uppercase tracking-wider mb-3 font-medium">Your Profile</p>
        <div className="grid grid-cols-1 gap-2.5">
          {dimensions.slice(0, expanded ? dimensions.length : 4).map((d, i) => {
            const val = profile[d.key] as string
            return (
              <motion.div
                key={d.key}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between py-2 px-3 rounded-xl bg-brand-surface-elevated border border-brand-border"
              >
                <div className="flex items-center gap-2">
                  <span className={d.color}>{d.icon}</span>
                  <span className="text-xs text-brand-text-muted">{d.label}</span>
                </div>
                <span className="text-xs font-medium text-brand-text">{val}</span>
              </motion.div>
            )
          })}
        </div>

        {dimensions.length > 4 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 text-xs text-brand-text-muted hover:text-brand-primary transition-colors"
          >
            {expanded ? (
              <><ChevronUp className="w-3.5 h-3.5" /> Show less</>
            ) : (
              <><ChevronDown className="w-3.5 h-3.5" /> Show {dimensions.length - 4} more</>
            )}
          </button>
        )}
      </div>

      {/* Ideal peer traits */}
      <AnimatePresence>
        {profile.idealPeerTraits?.length > 0 && (
          <div className="px-5 pb-5 border-t border-brand-border pt-4">
            <p className="text-xs text-brand-text-muted uppercase tracking-wider mb-3 font-medium">You Thrive With</p>
            <div className="flex flex-wrap gap-2">
              {profile.idealPeerTraits.map((trait, i) => (
                <motion.span
                  key={trait}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-xs text-brand-primary"
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  {trait}
                </motion.span>
              ))}
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Matching needs note */}
      {profile.matchingNeeds?.length > 0 && (
        <div className="px-5 pb-4">
          <p className="text-xs text-brand-text-subtle">
            BUZZ is matching you with people who share your need for{" "}
            <span className="text-brand-text">{profile.matchingNeeds.slice(0, 2).join(" and ")}</span>.
          </p>
        </div>
      )}

      {error && (
        <div className="px-5 pb-4">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
    </motion.div>
  )
}
