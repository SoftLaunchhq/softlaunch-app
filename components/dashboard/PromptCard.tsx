"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { MessageSquare, Send, Loader2, CheckCircle2, CalendarDays, ExternalLink } from "lucide-react"

interface Props {
  prompt: {
    id: string
    weekNumber: number
    title: string
    promptText: string
    resourceLink?: string | null
  }
  weekNumber: number
  cohortId: string
}

export function PromptCard({ prompt, weekNumber, cohortId }: Props) {
  const [response, setResponse] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)

  const handleSubmit = async () => {
    if (!response.trim() || submitting) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptId: prompt.id,
          responseText: response.trim(),
        }),
      })

      if (!res.ok) throw new Error("Failed to submit response")

      setSubmitted(true)
    } catch (err) {
      setError("Something went wrong. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, type: "spring", stiffness: 320, damping: 28 }}
      className="neon-panel overflow-hidden p-0"
    >
      <div className="border-b border-brand-border/70 bg-gradient-to-r from-brand-primary/8 via-brand-surface/80 to-brand-accent/8 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: [0, -6, 6, 0] }}
              transition={{ duration: 0.45 }}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/15 text-brand-primary ring-1 ring-brand-primary/30"
            >
              <MessageSquare className="h-5 w-5" />
            </motion.div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-text-subtle">
                Weekly prompt
              </p>
              <p className="font-display text-lg font-semibold text-brand-text">{prompt.title}</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-primary/25 bg-brand-primary/10 px-3 py-1.5 text-xs font-medium text-brand-primary">
            <CalendarDays className="h-3.5 w-3.5" />
            Week {weekNumber}
          </div>
        </div>
      </div>

      <div className="space-y-6 p-6 md:p-8">
        <p className="text-sm leading-relaxed text-brand-text-muted md:text-base">
          {prompt.promptText}
        </p>

        {prompt.resourceLink && (
          <motion.a
            href={prompt.resourceLink}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ x: 3 }}
            className="inline-flex items-center gap-2 rounded-xl border border-brand-border/80 bg-brand-bg/50 px-4 py-2.5 text-sm font-medium text-brand-primary transition-colors hover:border-brand-primary/40 hover:bg-brand-primary/10"
          >
            <ExternalLink className="h-4 w-4" />
            Open shared resource
          </motion.a>
        )}

        {submitted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 rounded-xl border border-brand-success/30 bg-brand-success/10 p-4"
          >
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-brand-success" />
            <div>
              <p className="text-sm font-medium text-brand-success">Response saved</p>
              <p className="mt-0.5 text-xs text-brand-text-subtle">
                Bring this to your cohort conversation this week.
              </p>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <div
              className={`rounded-xl border bg-brand-bg/70 transition-all duration-200 ${
                focused
                  ? "border-brand-primary/45 shadow-[0_0_0_1px_rgba(29,184,150,0.2),0_12px_40px_rgba(0,0,0,0.35)]"
                  : "border-brand-border"
              }`}
            >
              <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="Write your reflection…"
                rows={4}
                className="w-full resize-none rounded-xl bg-transparent px-4 py-3 text-sm text-brand-text placeholder:text-brand-text-subtle focus:outline-none"
              />
            </div>
            {error && <p className="text-xs text-brand-error">{error}</p>}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-brand-text-subtle">
                Private until you share it in the group.
              </p>
              <motion.button
                type="button"
                onClick={handleSubmit}
                disabled={!response.trim() || submitting}
                whileHover={{ scale: response.trim() && !submitting ? 1.02 : 1 }}
                whileTap={{ scale: response.trim() && !submitting ? 0.98 : 1 }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-brand-bg shadow-[0_0_24px_rgba(29,184,150,0.35)] transition-shadow hover:shadow-[0_0_32px_rgba(29,184,150,0.45)] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {submitting ? "Saving…" : "Save response"}
              </motion.button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
