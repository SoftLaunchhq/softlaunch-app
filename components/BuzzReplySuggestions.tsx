"use client"

/**
 * BuzzReplySuggestions — AI-powered reply suggestion cards.
 *
 * Given an incoming message, calls POST /api/buzz/suggest-reply
 * and renders 2-3 tone-labeled reply options the user can tap to use.
 *
 * When a suggestion is accepted, logs it back via POST /api/buzz/suggest-reply
 * with logAccepted set (behavioral learning signal).
 *
 * Props:
 * - incomingMessage: the message they're replying to
 * - conversationHistory: recent thread context
 * - userProfile: user's comm style + archetype for personalization
 * - onSelect: callback with the selected reply text
 * - onDismiss: optional dismiss callback
 */

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Zap, Copy, Check, Loader2, AlertCircle, RefreshCw, ChevronDown } from "lucide-react"

interface ConversationEntry {
  senderName: string
  content:    string
}

interface UserProfile {
  firstName?:          string
  communicationStyle?: string | null
  energyStyle?:        string | null
  conflictStyle?:      string | null
  archetype?:          string | null
}

export interface ReplySuggestion {
  text:      string
  tone:      string
  reasoning: string
}

interface BuzzReplySuggestionsProps {
  incomingMessage:     string
  conversationHistory?: ConversationEntry[]
  userProfile?:        UserProfile
  onSelect:            (text: string) => void
  onDismiss?:          () => void
  className?:          string
}

const TONE_STYLES: Record<string, { bg: string; border: string; badge: string; text: string }> = {
  warm:         { bg: "bg-orange-500/8",     border: "border-orange-500/20",    badge: "bg-orange-500/15 text-orange-300",    text: "text-brand-text" },
  direct:       { bg: "bg-brand-primary/8",  border: "border-brand-primary/20", badge: "bg-brand-primary/15 text-brand-primary", text: "text-brand-text" },
  professional: { bg: "bg-blue-500/8",       border: "border-blue-500/20",      badge: "bg-blue-500/15 text-blue-300",         text: "text-brand-text" },
  curious:      { bg: "bg-purple-500/8",     border: "border-purple-500/20",    badge: "bg-purple-500/15 text-purple-300",     text: "text-brand-text" },
  playful:      { bg: "bg-yellow-500/8",     border: "border-yellow-500/20",    badge: "bg-yellow-500/15 text-yellow-300",     text: "text-brand-text" },
  default:      { bg: "bg-brand-surface-elevated", border: "border-brand-border", badge: "bg-brand-border text-brand-text-muted", text: "text-brand-text" },
}

function getToneStyle(tone: string) {
  const key = tone.toLowerCase().split(" ")[0]
  return TONE_STYLES[key] ?? TONE_STYLES.default
}

function SuggestionCard({
  suggestion,
  index,
  onSelect,
  onLog,
}: {
  suggestion:  ReplySuggestion
  index:       number
  onSelect:    (text: string) => void
  onLog:       (suggestion: ReplySuggestion) => void
}) {
  const [copied, setCopied]  = useState(false)
  const [showWhy, setShowWhy] = useState(false)
  const style = getToneStyle(suggestion.tone)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(suggestion.text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    onLog(suggestion)
  }

  const handleUse = () => {
    onSelect(suggestion.text)
    onLog(suggestion)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className={`rounded-xl border ${style.border} ${style.bg} overflow-hidden`}
    >
      {/* Tone badge */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${style.badge}`}>
          {suggestion.tone}
        </span>
        <button
          onClick={() => setShowWhy((w) => !w)}
          className="flex items-center gap-1 text-[10px] text-brand-text-subtle hover:text-brand-text-muted transition-colors"
        >
          Why this? <ChevronDown className={`w-3 h-3 transition-transform ${showWhy ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Message text */}
      <p className={`px-3 py-2 text-sm leading-relaxed ${style.text}`}>
        {suggestion.text}
      </p>

      {/* Why this reasoning */}
      <AnimatePresence>
        {showWhy && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="px-3 pb-2 text-xs text-brand-text-muted italic border-t border-brand-border/50 pt-2 mt-1">
              {suggestion.reasoning}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex items-center gap-2 px-3 pb-3 pt-1">
        <button
          onClick={handleUse}
          className="flex-1 py-1.5 rounded-lg bg-brand-primary/90 text-white text-xs font-medium hover:bg-brand-primary transition-colors"
        >
          Use this reply
        </button>
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-lg border border-brand-border bg-brand-surface text-brand-text-muted hover:text-brand-text transition-colors"
          title="Copy to clipboard"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-brand-primary" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </motion.div>
  )
}

export function BuzzReplySuggestions({
  incomingMessage,
  conversationHistory = [],
  userProfile = {},
  onSelect,
  onDismiss,
  className = "",
}: BuzzReplySuggestionsProps) {
  const [suggestions, setSuggestions] = useState<ReplySuggestion[] | null>(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [fetched, setFetched]         = useState(false)

  const fetchSuggestions = useCallback(async () => {
    if (!incomingMessage.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/buzz/suggest-reply", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incomingMessage,
          conversationHistory: conversationHistory.slice(-6),
          userProfile,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Suggestion failed")
      setSuggestions(data.suggestions ?? [])
      setFetched(true)
    } catch (err: any) {
      setError(err.message ?? "BUZZ couldn't generate suggestions.")
    } finally {
      setLoading(false)
    }
  }, [incomingMessage, conversationHistory, userProfile])

  const logAccepted = useCallback(async (suggestion: ReplySuggestion) => {
    fetch("/api/buzz/suggest-reply", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        incomingMessage,
        logAccepted: { suggestionText: suggestion.text, tone: suggestion.tone },
      }),
    }).catch(() => {})
  }, [incomingMessage])

  // Not yet triggered — show the "Ask BUZZ" button
  if (!fetched && !loading) {
    return (
      <div className={`${className}`}>
        <button
          onClick={fetchSuggestions}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-xs font-medium hover:bg-brand-primary/15 transition-colors"
        >
          <Zap className="w-3.5 h-3.5" />
          BUZZ: suggest a reply
        </button>
      </div>
    )
  }

  // Loading
  if (loading) {
    return (
      <div className={`rounded-2xl border border-brand-border bg-brand-surface p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-brand-primary to-brand-accent flex items-center justify-center">
            <Zap className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs text-brand-text-muted">BUZZ is reading the conversation…</span>
        </div>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-brand-surface-elevated animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border border-brand-border bg-brand-surface overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-brand-primary to-brand-accent flex items-center justify-center shadow-[0_0_8px_rgba(29,184,150,0.4)]">
            <Zap className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs font-semibold text-brand-text">BUZZ Reply Suggestions</span>
          {userProfile.communicationStyle && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary">
              Tuned to your style
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchSuggestions}
            disabled={loading}
            className="p-1 rounded-lg text-brand-text-muted hover:text-brand-text transition-colors"
            title="Regenerate"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-[10px] text-brand-text-subtle hover:text-brand-text-muted transition-colors"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-300 flex-1">{error}</p>
          <button
            onClick={fetchSuggestions}
            className="text-xs text-brand-primary hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Suggestion cards */}
      {suggestions && suggestions.length > 0 && (
        <div className="p-3 space-y-2">
          {suggestions.map((s, i) => (
            <SuggestionCard
              key={i}
              suggestion={s}
              index={i}
              onSelect={onSelect}
              onLog={logAccepted}
            />
          ))}
          <p className="text-center text-[10px] text-brand-text-subtle pt-1">
            BUZZ adapts to your communication style over time.
          </p>
        </div>
      )}

      {suggestions && suggestions.length === 0 && !error && (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-brand-text-muted">No suggestions generated.</p>
          <button
            onClick={fetchSuggestions}
            className="mt-2 text-xs text-brand-primary hover:underline"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
