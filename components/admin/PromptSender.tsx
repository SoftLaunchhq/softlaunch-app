"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Send, Loader2, CheckCircle2 } from "lucide-react"
import type { WeeklyPrompt } from "@prisma/client"

const DEFAULT_PROMPTS: Record<number, { title: string; text: string }> = {
  1: {
    title: "Week 1: Introductions",
    text: "Share one thing you're currently building, working on, or trying to figure out — and why it matters to you.",
  },
  2: {
    title: "Week 2: Accountability",
    text: "What's a habit or goal you've been struggling to stay consistent with? What would help you stay on track — and how can this group support you?",
  },
  3: {
    title: "Week 3: Vision",
    text: "What does success look like for you in the next 90 days? Be specific. What would you need to be true?",
  },
  4: {
    title: "Week 4: Reflection",
    text: "What's one thing you learned about yourself over the last 4 weeks — from this group, or from what it surfaced in you?",
  },
}

interface Props {
  cohortId: string
  currentWeek: number
  existingPrompts: WeeklyPrompt[]
}

export function PromptSender({ cohortId, currentWeek, existingPrompts }: Props) {
  const router = useRouter()
  const [selectedWeek, setSelectedWeek] = useState(currentWeek || 1)
  const [title, setTitle] = useState(DEFAULT_PROMPTS[currentWeek || 1]?.title || "")
  const [promptText, setPromptText] = useState(DEFAULT_PROMPTS[currentWeek || 1]?.text || "")
  const [resourceLink, setResourceLink] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const existingPrompt = existingPrompts.find((p) => p.weekNumber === selectedWeek)

  const handleWeekChange = (week: number) => {
    setSelectedWeek(week)
    const defaults = DEFAULT_PROMPTS[week]
    if (defaults) {
      setTitle(defaults.title)
      setPromptText(defaults.text)
    }
  }

  const handleSend = async () => {
    if (!title.trim() || !promptText.trim()) return

    setSending(true)
    try {
      const res = await fetch(`/api/cohorts/${cohortId}/prompts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekNumber: selectedWeek,
          title: title.trim(),
          promptText: promptText.trim(),
          resourceLink: resourceLink.trim() || null,
        }),
      })

      if (!res.ok) throw new Error("Failed to send prompt")

      setSent(true)
      setTimeout(() => {
        setSent(false)
        router.refresh()
      }, 2000)
    } catch (err) {
      console.error(err)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
      <h3 className="font-semibold text-brand-text text-sm mb-4 flex items-center gap-2">
        <Send className="w-4 h-4 text-brand-primary" />
        Send Weekly Prompt
      </h3>

      {/* Week selector */}
      <div className="flex gap-1 mb-4">
        {[1, 2, 3, 4].map((week) => {
          const hasPrompt = existingPrompts.some((p) => p.weekNumber === week)
          return (
            <button
              key={week}
              onClick={() => handleWeekChange(week)}
              className={`
                flex-1 py-2 rounded-lg text-xs font-medium transition-all
                ${selectedWeek === week
                  ? "bg-brand-primary text-white"
                  : "bg-brand-bg border border-brand-border text-brand-text-muted hover:border-brand-primary/30"
                }
              `}
            >
              Wk {week}
              {hasPrompt && <span className="ml-1 text-brand-success">✓</span>}
            </button>
          )
        })}
      </div>

      {existingPrompt && (
        <div className="mb-3 p-2 rounded-lg bg-brand-success/10 border border-brand-success/20">
          <p className="text-xs text-brand-success">
            ✓ Week {selectedWeek} prompt already sent. Sending again will override.
          </p>
        </div>
      )}

      <div className="space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Prompt title"
          className="w-full px-3 py-2 text-sm rounded-lg bg-brand-bg border border-brand-border text-brand-text focus:border-brand-primary focus:outline-none transition-colors"
        />
        <textarea
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder="Prompt text..."
          rows={4}
          className="w-full px-3 py-2 text-sm rounded-lg bg-brand-bg border border-brand-border text-brand-text focus:border-brand-primary focus:outline-none transition-colors resize-none"
        />
        <input
          value={resourceLink}
          onChange={(e) => setResourceLink(e.target.value)}
          placeholder="Resource link (optional Notion doc, article...)"
          className="w-full px-3 py-2 text-sm rounded-lg bg-brand-bg border border-brand-border text-brand-text placeholder-brand-text-subtle focus:border-brand-primary focus:outline-none transition-colors"
        />

        <button
          onClick={handleSend}
          disabled={!title.trim() || !promptText.trim() || sending}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary-hover transition-all disabled:opacity-60"
        >
          {sent ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Sent!
            </>
          ) : sending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Send to cohort
            </>
          )}
        </button>
      </div>
    </div>
  )
}
