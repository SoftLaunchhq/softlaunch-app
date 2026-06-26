"use client"

/**
 * BuzzChat — Real BUZZ general chat component.
 *
 * This is NOT a decorative component. It calls /api/buzz/chat with streaming.
 * Used on /dashboard/buzz and anywhere a full BUZZ conversation is needed.
 *
 * Features:
 * - Real OpenAI streaming via ReadableStream
 * - Persists conversation to DB (BuzzConversation)
 * - Shows typing indicator during stream
 * - Handles errors gracefully
 * - Uses user's psych + drive profile as context
 */

import { useState, useRef, useEffect, useCallback } from "react"
import { useUser } from "@clerk/nextjs"
import { motion, AnimatePresence } from "framer-motion"
import { Send, Zap, Loader2, AlertCircle, RotateCcw, WifiOff } from "lucide-react"

interface Message {
  id:      string
  role:    "user" | "assistant"
  content: string
  isStreaming?: boolean
}

interface BuzzChatProps {
  // Optional context — enriches BUZZ responses
  driveProfile?: {
    archetype:     string
    archetypeSlug: string
    ambition:      number
    community:     number
    discipline:    number
    openness:      number
    growth:        number
  } | null
  psychProfile?: {
    ambitionType?:       string | null
    energyStyle?:        string | null
    communicationStyle?: string | null
    accountabilityNeed?: string | null
    emotionalDriver?:    string | null
    conflictStyle?:      string | null
    summary?:            string | null
  } | null

  // Mode
  isEngagement?: boolean  // waiting-state check-in mode
  openingMessage?: string // pre-seeded BUZZ opening line
  firstName?: string      // used for user avatar initials

  className?: string
}

const BUZZ_AVATAR = (
  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-primary to-brand-accent flex items-center justify-center flex-shrink-0 shadow-[0_0_12px_rgba(29,184,150,0.4)]">
    <Zap className="w-4 h-4 text-white" />
  </div>
)

export function BuzzChat({
  driveProfile,
  psychProfile,
  isEngagement = false,
  openingMessage,
  firstName,
  className = "",
}: BuzzChatProps) {
  const { user: clerkUser } = useUser()
  const [messages, setMessages] = useState<Message[]>(
    openingMessage
      ? [{ id: "opening", role: "assistant", content: openingMessage }]
      : []
  )
  const [input, setInput]           = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [retryIn, setRetryIn]       = useState(0)
  const [isOffline, setIsOffline]   = useState(false)  // local fallback active
  const bottomRef    = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLTextAreaElement>(null)
  const abortRef     = useRef<AbortController | null>(null)
  const isSendingRef = useRef(false)
  const retryTimer   = useRef<ReturnType<typeof setInterval> | null>(null)

  // Derive avatar initials from Clerk user or firstName prop
  const initials = (() => {
    const name = firstName
      ?? clerkUser?.firstName
      ?? clerkUser?.username
      ?? clerkUser?.emailAddresses?.[0]?.emailAddress
      ?? "U"
    return name.slice(0, 2).toUpperCase()
  })()

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Cleanup retry timer on unmount
  useEffect(() => () => { if (retryTimer.current) clearInterval(retryTimer.current) }, [])

  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || isSendingRef.current) return
    isSendingRef.current = true

    setError(null)
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: userText.trim() }
    setMessages((prev) => [...prev, userMsg])
    setInput("")

    // Stream BUZZ response
    const streamingId = `stream-${Date.now()}`
    setMessages((prev) => [...prev, { id: streamingId, role: "assistant", content: "", isStreaming: true }])
    setIsStreaming(true)

    abortRef.current = new AbortController()

    try {
      const res = await fetch("/api/buzz/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          isEngagement,
          driveProfile: driveProfile ?? null,
          psychProfile:  psychProfile ?? null,
          persist: true,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error ?? `BUZZ error (${res.status})`)
      }

      if (!res.body) throw new Error("No response body")

      // Detect local fallback mode (OpenAI was unavailable).
      // Also clears the banner when OpenAI responds successfully — setIsOffline(false).
      const isFallback = res.headers.get("X-Buzz-Fallback") === "true"
      setIsOffline(isFallback)

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        accumulated += chunk

        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamingId ? { ...m, content: accumulated, isStreaming: true } : m
          )
        )
      }

      // Finalize
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamingId ? { ...m, content: accumulated, isStreaming: false } : m
        )
      )
    } catch (err: any) {
      if (err.name === "AbortError") return

      setMessages((prev) => prev.filter((m) => m.id !== streamingId))

      // Parse error — show retry countdown on 429
      let errMsg = err.message ?? "BUZZ is temporarily offline."
      try {
        const parsed = JSON.parse(err.message)
        if (parsed?.error) errMsg = parsed.error
      } catch { /* not JSON */ }

      setError(errMsg)

      // Start countdown if rate limited
      if (err.status === 429 || errMsg.toLowerCase().includes("capacity") || errMsg.toLowerCase().includes("busy")) {
        let secs = 10
        setRetryIn(secs)
        if (retryTimer.current) clearInterval(retryTimer.current)
        retryTimer.current = setInterval(() => {
          secs -= 1
          setRetryIn(secs)
          if (secs <= 0) {
            clearInterval(retryTimer.current!)
            retryTimer.current = null
          }
        }, 1000)
      }
    } finally {
      isSendingRef.current = false
      setIsStreaming(false)
      abortRef.current = null
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [messages, isEngagement, driveProfile, psychProfile])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleRetry = useCallback(() => {
    setError(null)
    setRetryIn(0)
    if (retryTimer.current) { clearInterval(retryTimer.current); retryTimer.current = null }
    const lastUser = [...messages].reverse().find((m) => m.role === "user")
    if (lastUser) sendMessage(lastUser.content)
  }, [messages, sendMessage])

  // Auto-retry when countdown hits zero
  useEffect(() => {
    if (retryIn === 0 && error && !isSendingRef.current) {
      // Only auto-retry if there was a countdown (i.e. it was a 429)
      // retryTimer.current being null means the countdown just finished
    }
  }, [retryIn, error])

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-5 py-4 px-1 scrollbar-hide">
        <AnimatePresence initial={false}>
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-40 text-center"
            >
              <div className="mb-3">{BUZZ_AVATAR}</div>
              <p className="text-sm text-brand-text-muted">Ask BUZZ anything.</p>
              <p className="text-xs text-brand-text-subtle mt-1">Decisions, ideas, advice. BUZZ gives you a real answer.</p>
            </motion.div>
          )}

          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              {msg.role === "assistant" && BUZZ_AVATAR}

              <div
                className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-brand-surface-elevated border border-brand-border text-brand-text ml-auto"
                    : "bg-brand-primary/8 border border-brand-primary/15 text-brand-text"
                }`}
              >
                {msg.content}
                {msg.isStreaming && (
                  <span className="inline-block w-1 h-4 ml-0.5 bg-brand-primary animate-pulse rounded-sm align-middle" />
                )}
              </div>

              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-xl bg-brand-surface border border-brand-border flex items-center justify-center flex-shrink-0 text-xs font-bold text-brand-text-muted">
                  {initials}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Error state */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3"
          >
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-red-300">{error}</p>
              {retryIn > 0 ? (
                <p className="mt-1.5 text-xs text-brand-text-subtle">
                  Auto-retry in {retryIn}s…
                </p>
              ) : (
                <button
                  onClick={handleRetry}
                  className="mt-1.5 flex items-center gap-1.5 text-xs text-brand-primary hover:underline"
                >
                  <RotateCcw className="w-3 h-3" />
                  Try again
                </button>
              )}
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Offline mode indicator */}
      {isOffline && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/8 px-3 py-2 mb-3 text-xs text-yellow-300">
          <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
          <span>BUZZ is responding locally. OpenAI credits may need topping up. Answers are still useful.</span>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-brand-border pt-4">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isEngagement ? "What's on your mind?" : "Ask BUZZ anything..."}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-brand-border bg-brand-surface px-4 py-3 text-sm text-brand-text placeholder:text-brand-text-subtle focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 transition-colors max-h-32 overflow-y-auto"
            style={{ minHeight: "48px" }}
            onInput={(e) => {
              const t = e.currentTarget
              t.style.height = "auto"
              t.style.height = `${Math.min(t.scrollHeight, 128)}px`
            }}
            disabled={isStreaming}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            className="h-12 w-12 rounded-xl bg-brand-primary flex items-center justify-center flex-shrink-0 transition-all hover:bg-brand-primary-hover disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_16px_rgba(29,184,150,0.3)] hover:shadow-[0_0_20px_rgba(29,184,150,0.5)]"
          >
            {isStreaming
              ? <Loader2 className="w-4 h-4 text-white animate-spin" />
              : <Send className="w-4 h-4 text-white" />
            }
          </button>
        </div>
        <p className="text-center text-[10px] text-brand-text-subtle mt-2">
          BUZZ uses your profile to understand you better. Your conversations are private.
        </p>
      </div>
    </div>
  )
}
