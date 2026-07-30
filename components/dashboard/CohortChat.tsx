"use client"

/**
 * CohortChat — Shared conversation space for an active cohort with BUZZ AI facilitator.
 *
 * Features:
 * - Member messages (left-aligned) + BUZZ messages (center, branded)
 * - Polling every 10 seconds for new messages
 * - Weekly prompt header when a prompt is active
 * - BUZZ facilitation button (triggers a BUZZ question)
 * - Mobile-responsive, full-height layout
 *
 * Authorization is enforced server-side by the API routes.
 * This component only reads/writes messages — it cannot post as BUZZ or another user.
 */

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Send, Zap, Sparkles, Loader2, MessageCircle, RefreshCw } from "lucide-react"
import { MeetupBanner } from "@/components/dashboard/MeetupBanner"

// ─── Types ────────────────────────────────────────────────────

export interface CohortChatMessage {
  id: string
  cohortId: string
  senderId: string | null
  senderType: "MEMBER" | "BUZZ"
  senderName: string | null
  content: string
  createdAt: string
}

interface WeeklyPrompt {
  promptText: string
  weekNumber: number
  title?: string | null
}

interface CohortChatProps {
  cohortId: string
  currentUserId: string
  cohortName: string
  activePrompt?: WeeklyPrompt | null
}

// ─── Helpers ─────────────────────────────────────────────────

function getInitials(name: string | null): string {
  if (!name) return "?"
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

// Stable hash → avatar color for a sender name (deterministic)
function getAvatarColor(name: string | null): string {
  const COLORS = [
    "bg-cyan-500/20 text-cyan-200 ring-cyan-500/30",
    "bg-violet-500/20 text-violet-200 ring-violet-500/30",
    "bg-emerald-500/20 text-emerald-200 ring-emerald-500/30",
    "bg-amber-500/20 text-amber-200 ring-amber-500/30",
    "bg-rose-500/20 text-rose-200 ring-rose-500/30",
  ]
  if (!name) return COLORS[0]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COLORS[Math.abs(hash) % COLORS.length]
}

// ─── BUZZ Message ─────────────────────────────────────────────

function BuzzMessage({ message }: { message: CohortChatMessage }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-center px-4 py-1"
    >
      <div className="max-w-sm w-full rounded-2xl border border-cyan-300/25 bg-cyan-300/8 px-4 py-3 text-center shadow-[0_0_20px_rgba(34,211,238,0.08)]">
        {/* BUZZ label */}
        <div className="flex items-center justify-center gap-1.5 mb-2">
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #1DB896, #7CC455)" }}
          >
            <Zap className="w-3 h-3 text-white" />
          </div>
          <span className="text-[11px] font-semibold tracking-wider uppercase text-cyan-300">
            BUZZ
          </span>
        </div>

        <p className="text-sm text-brand-text leading-relaxed">{message.content}</p>

        <span className="mt-2 block text-[10px] text-brand-text-subtle">
          {formatTime(message.createdAt)}
        </span>
      </div>
    </motion.div>
  )
}

// ─── Member Message ───────────────────────────────────────────

function MemberMessage({
  message,
  isOwn,
}: {
  message: CohortChatMessage
  isOwn: boolean
}) {
  const color = getAvatarColor(message.senderName)
  const initials = getInitials(message.senderName)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-end gap-2 px-4 py-0.5 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold ring-1 ${color}`}
      >
        {initials}
      </div>

      {/* Bubble */}
      <div className={`max-w-[70%] flex flex-col gap-0.5 ${isOwn ? "items-end" : "items-start"}`}>
        {!isOwn && (
          <span className="text-[11px] text-brand-text-subtle px-1">{message.senderName}</span>
        )}
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
            isOwn
              ? "bg-brand-primary/20 text-brand-text border border-brand-primary/30 rounded-br-sm"
              : "bg-brand-surface border border-brand-border text-brand-text rounded-bl-sm"
          }`}
        >
          {message.content}
        </div>
        <span className="text-[10px] text-brand-text-subtle px-1">{formatTime(message.createdAt)}</span>
      </div>
    </motion.div>
  )
}

// ─── Empty State ──────────────────────────────────────────────

function EmptyState({ onBuzzPrompt, isLoadingBuzz }: { onBuzzPrompt: () => void; isLoadingBuzz: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12 gap-5">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center border border-cyan-300/25 bg-cyan-300/10 shadow-[0_0_24px_rgba(34,211,238,0.12)]">
        <MessageCircle className="w-7 h-7 text-cyan-300" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-brand-text mb-1">Start the conversation</h3>
        <p className="text-sm text-brand-text-subtle leading-relaxed max-w-xs">
          This is your group's shared space. Share what's on your mind, or let BUZZ kick things off.
        </p>
      </div>
      <button
        onClick={onBuzzPrompt}
        disabled={isLoadingBuzz}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-cyan-300/30 bg-cyan-300/10 text-sm font-medium text-cyan-200 hover:bg-cyan-300/20 transition-colors disabled:opacity-50"
      >
        {isLoadingBuzz ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Zap className="w-4 h-4" />
        )}
        Ask BUZZ to start
      </button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────

export function CohortChat({
  cohortId,
  currentUserId,
  cohortName,
  activePrompt,
}: CohortChatProps) {
  const [messages, setMessages] = useState<CohortChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [isLoadingBuzz, setIsLoadingBuzz] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [lastFetchedAt, setLastFetchedAt] = useState(0)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch messages ────────────────────────────────────────

  const fetchMessages = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true)
      try {
        const res = await fetch(`/api/cohorts/${cohortId}/messages`, {
          cache: "no-store",
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          setError(err.error || "Failed to load messages")
          return
        }
        const data = await res.json()
        setMessages(data.messages || [])
        setLastFetchedAt(Date.now())
        setError(null)
      } catch {
        if (!silent) setError("Failed to load messages")
      } finally {
        if (!silent) setIsLoading(false)
      }
    },
    [cohortId]
  )

  // Initial load
  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  // Poll every 10 seconds
  useEffect(() => {
    pollingRef.current = setInterval(() => {
      fetchMessages(true)
    }, 10_000)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [fetchMessages])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // ── Send message ──────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const text = inputValue.trim()
    if (!text || isSending) return

    setInputValue("")
    setIsSending(true)

    // Optimistic update
    const optimisticMsg: CohortChatMessage = {
      id: `optimistic_${Date.now()}`,
      cohortId,
      senderId: currentUserId,
      senderType: "MEMBER",
      senderName: "You",
      content: text,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticMsg])

    try {
      const res = await fetch(`/api/cohorts/${cohortId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      })

      if (!res.ok) {
        // Roll back optimistic update
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id))
        const err = await res.json().catch(() => ({}))
        setError(err.error || "Failed to send")
        return
      }

      // Replace optimistic with real message
      const { message } = await res.json()
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticMsg.id ? message : m))
      )
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id))
      setError("Failed to send message")
    } finally {
      setIsSending(false)
    }
  }, [inputValue, isSending, cohortId, currentUserId])

  // ── Trigger BUZZ ──────────────────────────────────────────

  const handleBuzzPrompt = useCallback(async () => {
    if (isLoadingBuzz) return
    setIsLoadingBuzz(true)

    try {
      const res = await fetch(`/api/cohorts/${cohortId}/buzz`, {
        method: "POST",
      })

      if (res.status === 429) {
        // BUZZ already posted recently — just refresh
        await fetchMessages(true)
        return
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err.error || "BUZZ unavailable")
        return
      }

      const { message } = await res.json()
      setMessages((prev) => [...prev, message])
    } catch {
      setError("BUZZ unavailable right now")
    } finally {
      setIsLoadingBuzz(false)
    }
  }, [cohortId, fetchMessages, isLoadingBuzz])

  // ── Key handling ──────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-[500px] max-h-[700px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border/60 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #1DB896, #7CC455)" }}
          >
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-brand-text leading-none">Group Chat</p>
            <p className="text-[11px] text-brand-text-subtle mt-0.5">
              {cohortName} · BUZZ facilitated
            </p>
          </div>
        </div>

        {/* Refresh + BUZZ button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchMessages(true)}
            className="w-7 h-7 rounded-lg border border-brand-border/60 flex items-center justify-center text-brand-text-subtle hover:text-brand-text hover:border-brand-border transition-colors"
            title="Refresh messages"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleBuzzPrompt}
            disabled={isLoadingBuzz}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-300/30 bg-cyan-300/10 text-xs font-medium text-cyan-200 hover:bg-cyan-300/20 transition-colors disabled:opacity-50"
          >
            {isLoadingBuzz ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            Ask BUZZ
          </button>
        </div>
      </div>

      {/* First-meetup orchestration banner — shown above the weekly prompt */}
      <div className="flex-shrink-0">
        <MeetupBanner
          cohortId={cohortId}
          currentUserId={currentUserId}
          cohortName={cohortName}
          onStateChange={() => fetchMessages(true)}
        />
      </div>

      {/* Weekly prompt banner */}
      {activePrompt && (
        <div className="px-4 py-2.5 border-b border-brand-border/40 bg-brand-primary/5 flex-shrink-0">
          <div className="flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 text-brand-primary flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-primary">
                Week {activePrompt.weekNumber} Prompt
              </span>
              <p className="text-xs text-brand-text-muted mt-0.5 leading-snug">
                {activePrompt.promptText}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-rose-500/10 border-b border-rose-500/20 flex-shrink-0">
          <p className="text-xs text-rose-300">{error}</p>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto py-3 space-y-1 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 animate-spin text-brand-primary" />
          </div>
        ) : messages.length === 0 ? (
          <EmptyState onBuzzPrompt={handleBuzzPrompt} isLoadingBuzz={isLoadingBuzz} />
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) =>
              msg.senderType === "BUZZ" ? (
                <BuzzMessage key={msg.id} message={msg} />
              ) : (
                <MemberMessage
                  key={msg.id}
                  message={msg}
                  isOwn={msg.senderId === currentUserId}
                />
              )
            )}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-brand-border/60 px-4 py-3 flex-shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message the group… (Enter to send)"
            disabled={isSending}
            rows={1}
            className="flex-1 bg-brand-surface/60 border border-brand-border rounded-xl px-3.5 py-2.5 text-sm text-brand-text placeholder-brand-text-subtle focus:outline-none focus:border-brand-primary/50 resize-none disabled:opacity-50 min-h-[40px] max-h-[120px]"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isSending}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-brand-primary/20 hover:bg-brand-primary/30 border border-brand-primary/30 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
            ) : (
              <Send className="w-4 h-4 text-brand-primary" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-brand-text-subtle mt-1.5 text-center">
          Shift+Enter for new line · Visible to all cohort members
        </p>
      </div>
    </div>
  )
}
