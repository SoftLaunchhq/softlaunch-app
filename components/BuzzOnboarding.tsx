"use client"

/**
 * BuzzOnboarding — Conversational deep-dive with BUZZ.
 *
 * Asks 12 psychographic questions one at a time in a chat interface.
 * Streams BUZZ's reaction/question from /api/buzz/onboarding.
 *
 * Resilience:
 * - If OpenAI is rate-limited, the API returns the static question text
 *   via a fallback stream — onboarding always works.
 * - If network fails entirely, falls back to showing the raw question locally.
 * - Profile generation has a keyword-based deterministic fallback too.
 *
 * Phases: intro → chat → generating → done
 */

import { useState, useRef, useEffect, useCallback } from "react"
import { useUser } from "@clerk/nextjs"
import { motion, AnimatePresence } from "framer-motion"
import { Send, Zap, Loader2, CheckCircle2, ChevronRight, RotateCcw, WifiOff } from "lucide-react"
import { BUZZ_ONBOARDING_QUESTIONS } from "@/lib/buzz"

interface Message {
  id:          string
  role:        "user" | "assistant"
  content:     string
  isStreaming?: boolean
  isFallback?: boolean  // true when rendered from static fallback (no AI)
}

interface CollectedAnswer {
  questionId: string
  question:   string
  answer:     string
}

interface BuzzOnboardingProps {
  driveProfile?: {
    archetype:     string
    archetypeSlug: string
    ambition:      number
    community:     number
    discipline:    number
    openness:      number
    growth:        number
  } | null
  firstName?: string
  onComplete?: (profile: Record<string, unknown>) => void
}

const TOTAL_QUESTIONS = BUZZ_ONBOARDING_QUESTIONS.length

const BUZZ_AVATAR = (
  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-primary to-brand-accent flex items-center justify-center flex-shrink-0 shadow-[0_0_16px_rgba(29,184,150,0.35)]">
    <Zap className="w-4 h-4 text-white" />
  </div>
)

// Local fallback: show static question text without any AI call
function buildStaticQuestionText(idx: number): string {
  const q = BUZZ_ONBOARDING_QUESTIONS[idx]
  if (!q) return "Tell me anything else that's on your mind."
  return `${q.prompt}\n\n${q.subtext}`
}

export function BuzzOnboarding({ driveProfile, firstName: _firstName, onComplete }: BuzzOnboardingProps) {
  const { user: clerkUser } = useUser()
  const initials = (
    clerkUser?.firstName?.slice(0, 2) ??
    clerkUser?.username?.slice(0, 2) ??
    "U"
  ).toUpperCase()

  const [phase, setPhase]               = useState<"intro" | "chat" | "generating" | "done">("intro")
  const [messages, setMessages]         = useState<Message[]>([])
  const [input, setInput]               = useState("")
  const [isStreaming, setIsStreaming]    = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [isOffline, setIsOffline]       = useState(false)  // AI unavailable but still functional
  const [questionIndex, setQuestionIndex] = useState(0)
  const [collectedAnswers, setCollectedAnswers] = useState<CollectedAnswer[]>([])
  const [generatedProfile, setGeneratedProfile] = useState<Record<string, unknown> | null>(null)
  const [isWaitingForAnswer, setIsWaitingForAnswer] = useState(false)

  const bottomRef   = useRef<HTMLDivElement>(null)
  const inputRef    = useRef<HTMLTextAreaElement>(null)
  const isSendingRef = useRef(false)  // sync guard — prevents double-send

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // ─── Ask a question via API (with local fallback) ────────────
  const askQuestion = useCallback(async (idx: number, currentMessages: Message[]) => {
    if (idx >= TOTAL_QUESTIONS) return

    setIsWaitingForAnswer(false)
    setError(null)
    const streamingId = `buzz-q${idx}-${Date.now()}`

    setMessages((prev) => [...prev, {
      id: streamingId, role: "assistant", content: "", isStreaming: true,
    }])
    setIsStreaming(true)

    // Trim history to last 8 messages to save tokens
    const trimmedHistory = currentMessages.slice(-8)

    try {
      const res = await fetch("/api/buzz/onboarding", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action:        "chat",
          questionIndex: idx,
          messages:      trimmedHistory.map((m) => ({ role: m.role, content: m.content })),
          driveProfile:  driveProfile ?? null,
        }),
      })

      // Non-streaming error response
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw Object.assign(
          new Error(errData.error ?? `BUZZ error (${res.status})`),
          { status: res.status }
        )
      }

      if (!res.body) throw new Error("No response body")

      const isFallback = res.headers.get("X-Buzz-Fallback") === "true"
      setIsOffline(isFallback)  // resets banner when OpenAI responds successfully

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setMessages((prev) =>
          prev.map((m) => m.id === streamingId
            ? { ...m, content: accumulated, isFallback }
            : m
          )
        )
      }

      setMessages((prev) =>
        prev.map((m) => m.id === streamingId
          ? { ...m, isStreaming: false, isFallback }
          : m
        )
      )
      setIsWaitingForAnswer(true)
    } catch (err: any) {
      // Remove the empty streaming placeholder
      setMessages((prev) => prev.filter((m) => m.id !== streamingId))

      // Local fallback — always keep onboarding working
      const staticText = buildStaticQuestionText(idx)
      setMessages((prev) => [...prev, {
        id:         `fallback-q${idx}`,
        role:       "assistant",
        content:    staticText,
        isStreaming: false,
        isFallback:  true,
      }])
      setIsOffline(true)
      setIsWaitingForAnswer(true)
      console.warn("[BuzzOnboarding] API failed — using static fallback:", err.message)
    } finally {
      setIsStreaming(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [driveProfile])

  // ─── Start the conversation ───────────────────────────────────
  const startConversation = useCallback(async () => {
    setPhase("chat")
    await askQuestion(0, [])
  }, [askQuestion])

  // ─── Handle user submitting an answer ────────────────────────
  const handleSendAnswer = useCallback(async () => {
    if (!input.trim() || isSendingRef.current || isStreaming) return
    isSendingRef.current = true

    const userText  = input.trim()
    const currentQ  = BUZZ_ONBOARDING_QUESTIONS[questionIndex]
    const userMsgId = `user-${Date.now()}`

    const userMsg: Message = { id: userMsgId, role: "user", content: userText }
    const updatedMessages  = [...messages, userMsg]

    setMessages(updatedMessages)
    setInput("")
    setIsWaitingForAnswer(false)

    const newAnswer: CollectedAnswer = {
      questionId: currentQ.id,
      question:   currentQ.prompt,
      answer:     userText,
    }
    const updatedAnswers = [...collectedAnswers, newAnswer]
    setCollectedAnswers(updatedAnswers)

    const nextIdx = questionIndex + 1

    if (nextIdx >= TOTAL_QUESTIONS) {
      // All questions answered — generate profile
      isSendingRef.current = false
      await generateProfile(updatedAnswers)
      return
    }

    // Advance and ask the next question
    setQuestionIndex(nextIdx)

    // Small natural pause
    await new Promise((r) => setTimeout(r, 350))

    // Stream BUZZ's reaction + next question
    const reactionId = `reaction-${Date.now()}`
    setMessages((prev) => [...prev, {
      id: reactionId, role: "assistant", content: "", isStreaming: true,
    }])
    setIsStreaming(true)
    setError(null)

    const trimmedHistory = updatedMessages.slice(-8)

    try {
      const res = await fetch("/api/buzz/onboarding", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action:           "chat",
          questionIndex:    nextIdx,
          userAnswer:       userText,
          messages:         trimmedHistory.map((m) => ({ role: m.role, content: m.content })),
          driveProfile:     driveProfile ?? null,
          collectedAnswers: updatedAnswers,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw Object.assign(
          new Error(errData.error ?? `BUZZ error (${res.status})`),
          { status: res.status }
        )
      }

      const isFallback = res.headers.get("X-Buzz-Fallback") === "true"
      setIsOffline(isFallback)  // resets banner when OpenAI responds successfully

      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setMessages((prev) =>
          prev.map((m) => m.id === reactionId
            ? { ...m, content: accumulated, isFallback }
            : m
          )
        )
      }

      setMessages((prev) =>
        prev.map((m) => m.id === reactionId
          ? { ...m, isStreaming: false, isFallback }
          : m
        )
      )
      setIsWaitingForAnswer(true)
    } catch (err: any) {
      // Remove the empty reaction placeholder
      setMessages((prev) => prev.filter((m) => m.id !== reactionId))

      // Local static fallback — always keep going
      const staticText = buildStaticQuestionText(nextIdx)
      setMessages((prev) => [...prev, {
        id:         `fallback-r${nextIdx}`,
        role:       "assistant",
        content:    staticText,
        isStreaming: false,
        isFallback:  true,
      }])
      setIsOffline(true)
      setIsWaitingForAnswer(true)
      console.warn("[BuzzOnboarding] Reaction API failed — using static fallback:", err.message)
    } finally {
      isSendingRef.current = false
      setIsStreaming(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [input, isStreaming, messages, questionIndex, collectedAnswers, driveProfile])

  // ─── Generate the profile at the end ─────────────────────────
  const generateProfile = useCallback(async (answers: CollectedAnswer[]) => {
    setPhase("generating")
    setError(null)

    try {
      const res = await fetch("/api/buzz/onboarding", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action:           "complete",
          collectedAnswers: answers,
          driveProfile:     driveProfile ?? null,
        }),
      })

      const data = await res.json()

      if (data.profile) {
        setGeneratedProfile(data.profile)
        setPhase("done")
        onComplete?.(data.profile)
        if (data.usedFallback) setIsOffline(true)
      } else {
        throw new Error(data.error ?? "Profile generation failed")
      }
    } catch (err: any) {
      console.error("[BuzzOnboarding] Profile generation error:", err)
      // Even if this fails, show completion — the local fallback in the API handles this
      setError("Couldn't generate full profile — try refreshing the page. Your answers were saved.")
      setPhase("chat")
      setIsWaitingForAnswer(true)
    }
  }, [driveProfile, onComplete])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendAnswer()
    }
  }

  const progress = Math.round((Math.min(questionIndex, TOTAL_QUESTIONS) / TOTAL_QUESTIONS) * 100)

  // ─── INTRO SCREEN ────────────────────────────────────────────
  if (phase === "intro") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center text-center max-w-md mx-auto py-8 px-4"
      >
        <div className="mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-accent flex items-center justify-center mx-auto mb-4 shadow-[0_0_24px_rgba(29,184,150,0.4)]">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-text-subtle mb-2">BUZZ Deep Dive</p>
          <h2 className="font-display text-3xl font-bold text-brand-text mb-3">Let's go deeper.</h2>
          <p className="text-brand-text-muted leading-relaxed">
            The assessment gave us your framework. This conversation gives BUZZ the context to match you with people who actually complement how you operate.
          </p>
        </div>

        <div className="sl-panel p-5 w-full text-left mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-text-subtle mb-3">What BUZZ asks about</p>
          <div className="space-y-2">
            {[
              "How you actually work",
              "What drains and energizes you",
              "What you need in a group",
              "Why you're really here",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2.5 text-sm text-brand-text-muted">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-primary flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-brand-text-subtle">12 questions · ~10 minutes · private</p>
        </div>

        <button
          onClick={startConversation}
          className="sl-button w-full py-3.5 justify-center text-base"
        >
          Start talking to BUZZ
          <ChevronRight className="w-4 h-4" />
        </button>

        <p className="mt-3 text-xs text-brand-text-subtle">
          BUZZ uses your answers to improve your matches and suggest better replies.
        </p>
      </motion.div>
    )
  }

  // ─── GENERATING SCREEN ───────────────────────────────────────
  if (phase === "generating") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center h-full py-16 text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-accent flex items-center justify-center mx-auto mb-5 shadow-[0_0_24px_rgba(29,184,150,0.4)]">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
        <h3 className="font-display text-2xl font-bold text-brand-text mb-2">
          Building your profile…
        </h3>
        <p className="text-brand-text-muted text-sm max-w-sm">
          BUZZ is analyzing your answers to understand how you operate, what you need, and who you'll connect with best.
        </p>
      </motion.div>
    )
  }

  // ─── DONE SCREEN ─────────────────────────────────────────────
  if (phase === "done" && generatedProfile) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg mx-auto py-8 px-4"
      >
        {/* Offline notice — subtle */}
        {isOffline && (
          <div className="flex items-center gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/8 px-3 py-2 mb-5 text-xs text-yellow-300">
            <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
            <span>BUZZ was offline — your profile was generated from your answers directly. It'll improve as you chat more.</span>
          </div>
        )}

        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-accent flex items-center justify-center mx-auto mb-4 shadow-[0_0_24px_rgba(29,184,150,0.4)]">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-text-subtle mb-2">Profile complete</p>
          <h2 className="font-display text-3xl font-bold text-brand-text mb-2">BUZZ gets you now.</h2>
          <p className="text-brand-text-muted text-sm leading-relaxed max-w-sm mx-auto">
            {(generatedProfile.summary as string) ?? "Your psychological profile is ready. BUZZ will use this to match you and suggest better replies."}
          </p>
        </div>

        {/* Key traits */}
        <div className="sl-panel p-6 mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-text-subtle mb-4">Your Profile</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Ambition type",  value: generatedProfile.ambitionType },
              { label: "Energy",         value: generatedProfile.energyStyle },
              { label: "Communication",  value: generatedProfile.communicationStyle },
              { label: "Accountability", value: generatedProfile.accountabilityNeed },
              { label: "Driver",         value: generatedProfile.emotionalDriver },
              { label: "Conflict style", value: generatedProfile.conflictStyle },
            ].filter((t) => t.value).map((trait) => (
              <div key={trait.label} className="bg-brand-surface-elevated rounded-xl p-3 border border-brand-border">
                <p className="text-[10px] text-brand-text-subtle uppercase tracking-wider mb-1">{trait.label}</p>
                <p className="text-sm font-medium text-brand-text capitalize">
                  {String(trait.value).replace(/-/g, " ")}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Ideal peer traits */}
        {Array.isArray(generatedProfile.idealPeerTraits) && generatedProfile.idealPeerTraits.length > 0 && (
          <div className="sl-panel p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-text-subtle mb-3">You'll connect best with people who are</p>
            <div className="flex flex-wrap gap-2">
              {(generatedProfile.idealPeerTraits as string[]).map((trait) => (
                <span
                  key={trait}
                  className="px-3 py-1.5 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-sm text-brand-primary font-medium capitalize"
                >
                  {trait.replace(/-/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    )
  }

  // ─── CHAT SCREEN ─────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Progress bar + offline indicator */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <div className="flex-1 h-1 bg-brand-border rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #1DB896, #7CC455)" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
        <span className="text-xs text-brand-text-subtle whitespace-nowrap">
          {Math.min(questionIndex, TOTAL_QUESTIONS)} / {TOTAL_QUESTIONS}
        </span>
        {isOffline && (
          <div className="flex items-center gap-1 text-[10px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-full px-2 py-0.5">
            <WifiOff className="w-2.5 h-2.5" />
            offline mode
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-hide">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              {msg.role === "assistant" && BUZZ_AVATAR}

              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line ${
                msg.role === "user"
                  ? "bg-brand-surface-elevated border border-brand-border text-brand-text ml-auto"
                  : msg.isFallback
                    ? "bg-brand-surface-elevated border border-brand-border/60 text-brand-text"
                    : "bg-brand-primary/8 border border-brand-primary/15 text-brand-text"
              }`}>
                {msg.content}
                {msg.isStreaming && (
                  <span className="inline-block w-1 h-4 ml-0.5 bg-brand-primary animate-pulse rounded-sm align-middle" />
                )}
              </div>

              {msg.role === "user" && (
                <div className="w-9 h-9 rounded-xl bg-brand-surface border border-brand-border flex items-center justify-center flex-shrink-0 text-xs font-bold text-brand-text-muted">
                  {initials}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Error state — only for truly unrecoverable errors */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-300"
          >
            <span className="flex-1">{error}</span>
            <button
              onClick={() => {
                setError(null)
                askQuestion(questionIndex, messages)
              }}
              className="flex items-center gap-1 text-xs text-brand-primary hover:underline flex-shrink-0"
            >
              <RotateCcw className="w-3 h-3" /> Retry
            </button>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-brand-border pt-4 flex-shrink-0">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isWaitingForAnswer
                ? "Your answer…"
                : isStreaming
                  ? "BUZZ is thinking…"
                  : ""
            }
            disabled={isStreaming || !isWaitingForAnswer}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-brand-border bg-brand-surface px-4 py-3 text-sm text-brand-text placeholder:text-brand-text-subtle focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 transition-colors max-h-32 disabled:opacity-50"
            style={{ minHeight: "48px" }}
            onInput={(e) => {
              const t = e.currentTarget
              t.style.height = "auto"
              t.style.height = `${Math.min(t.scrollHeight, 128)}px`
            }}
          />
          <button
            onClick={handleSendAnswer}
            disabled={!input.trim() || isStreaming || !isWaitingForAnswer}
            className="h-12 w-12 rounded-xl bg-brand-primary flex items-center justify-center flex-shrink-0 transition-all hover:bg-brand-primary-hover disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_16px_rgba(29,184,150,0.3)]"
          >
            {isStreaming
              ? <Loader2 className="w-4 h-4 text-white animate-spin" />
              : <Send className="w-4 h-4 text-white" />
            }
          </button>
        </div>
        <p className="text-center text-[10px] text-brand-text-subtle mt-2">
          Your answers are used privately to understand you better. BUZZ never shares them.
        </p>
      </div>
    </div>
  )
}
