"use client"

/**
 * BuzzPanel — The BUZZ.AI chat interface shown during the assessment.
 *
 * Appears below each question after the user selects an answer.
 * BUZZ streams a reaction + follow-up question.
 * The user can reply or skip to the next question.
 *
 * Privacy: nothing is stored server-side unless `memoryEnabled` is true.
 * When DB is unavailable (lite mode), memories fall back to sessionStorage.
 */

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Send, ChevronRight, Zap, ToggleLeft, ToggleRight, Loader2 } from "lucide-react"
import { extractPersonalityInsights, getReplyStarters } from "@/lib/buzz"

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant"
  content: string
}

interface BuzzAnswer {
  questionId: string
  questionText: string
  answerKey: string
  answerText: string
}

interface DriveProfileSnippet {
  archetype: string
  archetypeSlug: string
  ambition: number
  community: number
  discipline: number
  openness: number
  growth: number
}

interface BuzzPanelProps {
  answer: BuzzAnswer
  driveProfile?: DriveProfileSnippet | null
  onContinue: () => void
  isLastQuestion?: boolean
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────

export function BuzzPanel({ answer, driveProfile, onContinue, isLastQuestion }: BuzzPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingContent, setStreamingContent] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoadingOpening, setIsLoadingOpening] = useState(true)
  const [inputValue, setInputValue] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [memoryEnabled, setMemoryEnabled] = useState(false)
  const [buzzOffline, setBuzzOffline] = useState(false)
  const [hasReplied, setHasReplied] = useState(false)
  const [replyStarters, setReplyStarters] = useState<string[]>([])

  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Load memory preference from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem("buzz_memory_enabled")
    if (stored !== null) setMemoryEnabled(stored === "true")
    setReplyStarters(getReplyStarters(answer.questionId, answer.answerKey))
  }, [answer.questionId, answer.answerKey])

  // Kick off the opening BUZZ message when answer changes
  useEffect(() => {
    setMessages([])
    setStreamingContent("")
    setHasReplied(false)
    setInputValue("")
    setIsLoadingOpening(true)
    setBuzzOffline(false)

    streamBuzz({ isOpening: true, currentMessages: [] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer.questionId, answer.answerKey])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamingContent])

  // Save personality insights when memory is enabled
  useEffect(() => {
    if (!memoryEnabled) return
    const insights = extractPersonalityInsights(
      answer.questionId,
      answer.answerKey,
      answer.answerText
    )
    if (insights.length === 0) return

    // Fire-and-forget: save memories
    fetch("/api/buzz/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memories: insights }),
    }).catch(() => {
      // Lite mode fallback: store in sessionStorage
      const existing = JSON.parse(sessionStorage.getItem("buzz_memories") || "{}")
      for (const i of insights) {
        existing[i.key] = i.value
      }
      sessionStorage.setItem("buzz_memories", JSON.stringify(existing))
    })
  }, [memoryEnabled, answer])

  const streamBuzz = useCallback(
    async ({
      isOpening,
      currentMessages,
      userMessage,
    }: {
      isOpening: boolean
      currentMessages: Message[]
      userMessage?: string
    }) => {
      // Cancel any in-flight stream
      abortRef.current?.abort()
      abortRef.current = new AbortController()

      setIsStreaming(true)
      setStreamingContent("")

      // Get lite mode memories from sessionStorage as fallback
      let memories: Array<{ key: string; value: string; source: string }> = []
      try {
        const raw = sessionStorage.getItem("buzz_memories")
        if (raw) {
          const obj = JSON.parse(raw)
          memories = Object.entries(obj).map(([key, value]) => ({
            key,
            value: String(value),
            source: "assessment",
          }))
        }
      } catch {}

      const outgoingMessages = userMessage
        ? [...currentMessages, { role: "user" as const, content: userMessage }]
        : currentMessages

      try {
        const res = await fetch("/api/buzz/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: answer.questionId,
            questionText: answer.questionText,
            answerKey: answer.answerKey,
            answerText: answer.answerText,
            isOpening,
            messages: outgoingMessages,
            memories,
            driveProfile,
          }),
          signal: abortRef.current.signal,
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          if (res.status === 503) {
            setBuzzOffline(true)
          }
          throw new Error(err.error || "BUZZ unavailable")
        }

        // Stream the response
        const reader = res.body?.getReader()
        if (!reader) throw new Error("No response stream")

        const decoder = new TextDecoder()
        let fullContent = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          fullContent += chunk
          setStreamingContent(fullContent)
        }

        // Commit the streamed message
        const assistantMessage: Message = { role: "assistant", content: fullContent }

        if (userMessage) {
          setMessages((prev) => [
            ...prev,
            { role: "user", content: userMessage },
            assistantMessage,
          ])
        } else {
          setMessages([assistantMessage])
        }
        setStreamingContent("")
      } catch (error: any) {
        if (error?.name === "AbortError") return
        console.error("[BuzzPanel] stream error:", error)
        if (!buzzOffline) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "Having a moment. Hit continue whenever you're ready.",
            },
          ])
        }
        setStreamingContent("")
      } finally {
        setIsStreaming(false)
        setIsLoadingOpening(false)
      }
    },
    [answer, driveProfile, buzzOffline]
  )

  const handleSend = useCallback(
    async (text?: string) => {
      const messageText = text ?? inputValue.trim()
      if (!messageText || isSending || isStreaming) return

      setInputValue("")
      setIsSending(false)
      setHasReplied(true)

      await streamBuzz({
        isOpening: false,
        currentMessages: messages,
        userMessage: messageText,
      })
    },
    [inputValue, isSending, isStreaming, messages, streamBuzz]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const toggleMemory = () => {
    const newVal = !memoryEnabled
    setMemoryEnabled(newVal)
    sessionStorage.setItem("buzz_memory_enabled", String(newVal))
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mt-4 rounded-2xl border border-brand-border/60 bg-brand-surface/70 backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-brand-border/40">
        <div className="relative flex-shrink-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1DB896, #7CC455)" }}>
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-brand-secondary" />
        </div>
        <span className="text-xs font-semibold text-brand-text tracking-wide">BUZZ</span>
        <span className="text-xs text-brand-text-subtle ml-0.5">is listening</span>

        {/* Memory toggle */}
        <button
          onClick={toggleMemory}
          className="ml-auto flex items-center gap-1.5 text-xs text-brand-text-subtle hover:text-brand-text transition-colors"
          title={memoryEnabled ? "BUZZ memory is ON. Click to disable." : "Enable BUZZ memory"}
        >
          {memoryEnabled ? (
            <ToggleRight className="w-4 h-4 text-brand-primary" />
          ) : (
            <ToggleLeft className="w-4 h-4" />
          )}
          <span className={memoryEnabled ? "text-brand-primary" : ""}>
            {memoryEnabled ? "Memory on" : "Memory off"}
          </span>
        </button>
      </div>

      {/* Messages */}
      <div className="px-4 py-3 space-y-3 min-h-[80px] max-h-[280px] overflow-y-auto">
        {isLoadingOpening && messages.length === 0 && !streamingContent && (
          <div className="flex items-center gap-2 text-brand-text-subtle text-sm">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-primary flex-shrink-0" />
            <span>BUZZ is thinking...</span>
          </div>
        )}

        {buzzOffline && messages.length === 0 && (
          <p className="text-sm text-brand-text-subtle italic">
            BUZZ is offline right now. Add your OPENAI_API_KEY to .env.local to enable it.
          </p>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-brand-primary/15 text-brand-text border border-brand-primary/25"
                    : "bg-transparent text-brand-text-muted"
                }`}
              >
                {msg.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Streaming message */}
        {streamingContent && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="max-w-[85%] text-sm text-brand-text-muted leading-relaxed">
              {streamingContent}
              <span className="inline-block w-1.5 h-3.5 bg-brand-primary ml-0.5 animate-pulse rounded-sm" />
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Reply starters (only shown before first reply) */}
      {!hasReplied && !isLoadingOpening && !isStreaming && replyStarters.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {replyStarters.map((starter) => (
            <button
              key={starter}
              onClick={() => handleSend(starter)}
              className="text-xs px-3 py-1.5 rounded-full border border-brand-border bg-brand-surface/60 text-brand-text-muted hover:border-brand-primary/40 hover:text-brand-text transition-all duration-150"
            >
              {starter}
            </button>
          ))}
        </div>
      )}

      {/* Input + Continue */}
      <div className="px-4 py-3 border-t border-brand-border/40 flex items-center gap-2">
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Reply to BUZZ..."
          disabled={isStreaming || buzzOffline}
          className="flex-1 bg-transparent text-sm text-brand-text placeholder-brand-text-subtle focus:outline-none disabled:opacity-40"
        />

        {inputValue.trim() ? (
          <button
            onClick={() => handleSend()}
            disabled={isStreaming}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-primary/20 hover:bg-brand-primary/30 border border-brand-primary/30 flex items-center justify-center transition-colors disabled:opacity-40"
          >
            <Send className="w-3.5 h-3.5 text-brand-primary" />
          </button>
        ) : (
          <button
            onClick={onContinue}
            disabled={isStreaming && !hasReplied}
            className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium text-brand-text-subtle hover:text-brand-text transition-colors px-3 py-1.5 rounded-lg hover:bg-brand-surface disabled:opacity-40"
          >
            {isLastQuestion ? "See my profile" : "Next"}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  )
}
