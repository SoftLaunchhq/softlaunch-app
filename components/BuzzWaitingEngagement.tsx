"use client"

/**
 * BuzzWaitingEngagement — Engagement widget for users waiting for a cohort.
 *
 * Shown on /dashboard when the user's status is "pending" (no cohort yet).
 * BUZZ stays top-of-mind by offering check-ins, reflection prompts,
 * and keeping the user emotionally connected to the product.
 *
 * Sections:
 * 1. BUZZ Check-in prompt (rotates daily)
 * 2. Quick-reply chat with BUZZ (isEngagement=true mode)
 * 3. "While you wait" insight nudge based on their profile
 * 4. Progress signal — BUZZ explains what's happening during matching
 */

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Zap, Clock, Users, Star, ChevronRight, MessageCircle, X } from "lucide-react"
import { BuzzChat } from "./BuzzChat"

interface DriveProfile {
  archetype:     string
  archetypeSlug: string
  ambition:      number
  community:     number
  discipline:    number
  openness:      number
  growth:        number
}

interface PsychProfile {
  ambitionType?:       string | null
  energyStyle?:        string | null
  communicationStyle?: string | null
  accountabilityNeed?: string | null
  emotionalDriver?:    string | null
  conflictStyle?:      string | null
  summary?:            string | null
}

interface BuzzWaitingEngagementProps {
  firstName?:   string
  driveProfile?: DriveProfile | null
  psychProfile?: PsychProfile | null
  joinedDaysAgo?: number
  className?:   string
}

// Daily rotating check-in prompts
const ENGAGEMENT_PROMPTS = [
  { emoji: "🎯", text: "What's one thing you're trying to figure out right now in your business?" },
  { emoji: "⚡", text: "If your cohort starts this week, what's the first thing you'd want to discuss?" },
  { emoji: "🔥", text: "What's been your biggest win this month? (Big or small, both count.)" },
  { emoji: "🤔", text: "What's a decision you've been putting off that you need a real opinion on?" },
  { emoji: "💡", text: "What's an idea you have that you haven't told anyone about yet?" },
  { emoji: "🚧", text: "What's the one obstacle that keeps coming up for you?" },
  { emoji: "🎲", text: "What would you do differently if you had a group of peers to hold you accountable?" },
]

// "While you wait" tips based on archetype
const ARCHETYPE_TIPS: Record<string, { title: string; tip: string; action: string }> = {
  "The Executor": {
    title: "Use this time well",
    tip: "Executors like you do best with structured accountability. Write down 3 specific outcomes you want from your cohort. That clarity will make your first session electric.",
    action: "Set 3 outcomes",
  },
  "The Visionary": {
    title: "Get your ideas ready",
    tip: "Your cohort will benefit most from your big-picture thinking. Pick your boldest current idea to share in your first session. The kind of idea that might sound crazy at first.",
    action: "Pick your big idea",
  },
  "The Connector": {
    title: "Think about what you can offer",
    tip: "Connectors create the most value when they come prepared to give, not just receive. What introductions or resources could you bring to your cohort?",
    action: "Prep your contributions",
  },
  "The Analyst": {
    title: "Prepare the right questions",
    tip: "Your superpower is seeing what others miss. Come to your first cohort session with a problem you've been turning over in your head. The one you can't quite logic your way through alone.",
    action: "Define your key question",
  },
  "The Builder": {
    title: "What are you building?",
    tip: "Builders get the most from cohorts when they share early work, not just finished things. What's something in progress you'd like real feedback on?",
    action: "Pick something to share",
  },
}

const DEFAULT_TIP = {
  title: "Make the most of your cohort",
  tip: "The most valuable cohort members come with specific questions and real problems, not polished presentations. Start thinking about what you'd actually want to bring to the table.",
  action: "Think about your agenda",
}

function DailyPromptCard({
  firstName,
  onStartChat,
}: {
  firstName?: string
  onStartChat: (prompt: string) => void
}) {
  const [promptIndex] = useState(() => {
    const day = Math.floor(Date.now() / (1000 * 60 * 60 * 24))
    return day % ENGAGEMENT_PROMPTS.length
  })
  const prompt = ENGAGEMENT_PROMPTS[promptIndex]

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface-elevated p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none flex-shrink-0">{prompt.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-brand-text leading-relaxed">
            {firstName ? `${firstName}, ` : ""}{prompt.text}
          </p>
          <button
            onClick={() => onStartChat(prompt.text)}
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-brand-primary font-medium hover:underline"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Tell BUZZ
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

function MatchingProgressCard({ daysAgo }: { daysAgo: number }) {
  const stages = [
    { label: "Profile analyzed",     done: true  },
    { label: "Finding your people",  done: daysAgo >= 1 },
    { label: "Cohort forming",       done: daysAgo >= 3 },
    { label: "Cohort ready",         done: false },
  ]

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface-elevated p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-brand-primary" />
        <span className="text-xs font-semibold text-brand-text">Matching Progress</span>
      </div>
      <div className="space-y-2">
        {stages.map((stage, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
              stage.done
                ? "bg-brand-primary shadow-[0_0_8px_rgba(29,184,150,0.4)]"
                : i === stages.findIndex(s => !s.done)
                  ? "border-2 border-brand-primary bg-transparent"
                  : "border border-brand-border bg-transparent"
            }`}>
              {stage.done && (
                <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {!stage.done && i === stages.findIndex(s => !s.done) && (
                <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
              )}
            </div>
            <span className={`text-xs ${stage.done ? "text-brand-text" : i === stages.findIndex(s => !s.done) ? "text-brand-primary" : "text-brand-text-subtle"}`}>
              {stage.label}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-brand-text-subtle mt-3">
        BUZZ is finding people who match your psychology, not just your industry.
      </p>
    </div>
  )
}

export function BuzzWaitingEngagement({
  firstName,
  driveProfile,
  psychProfile,
  joinedDaysAgo = 0,
  className = "",
}: BuzzWaitingEngagementProps) {
  const [chatOpen, setChatOpen]          = useState(false)
  const [openingMessage, setOpeningMessage] = useState<string | undefined>(undefined)

  const archetype = driveProfile?.archetype ?? ""
  const tip = ARCHETYPE_TIPS[archetype] ?? DEFAULT_TIP

  const handleStartChat = (prompt: string) => {
    setOpeningMessage(
      `Hey${firstName ? ` ${firstName}` : ""}! I've been thinking about this: ${prompt} What's going on with you right now?`
    )
    setChatOpen(true)
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* BUZZ header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-primary to-brand-accent flex items-center justify-center shadow-[0_0_16px_rgba(29,184,150,0.4)]">
            <Zap className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-brand-text">BUZZ</h3>
            <p className="text-xs text-brand-text-muted">Your accountability AI</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-brand-primary/20 bg-brand-primary/8">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
          <span className="text-[10px] text-brand-primary font-medium">Matching in progress</span>
        </div>
      </div>

      {/* Daily prompt */}
      <DailyPromptCard firstName={firstName} onStartChat={handleStartChat} />

      {/* Matching progress */}
      <MatchingProgressCard daysAgo={joinedDaysAgo} />

      {/* Archetype-specific tip */}
      {tip && (
        <div className="rounded-xl border border-brand-border bg-brand-surface-elevated p-4">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-semibold text-brand-text">{tip.title}</span>
          </div>
          <p className="text-xs text-brand-text-muted leading-relaxed">{tip.tip}</p>
          <button
            onClick={() => handleStartChat(tip.tip)}
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-brand-primary font-medium hover:underline"
          >
            Talk to BUZZ about this
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Quick BUZZ chat button (if not already open) */}
      {!chatOpen && (
        <button
          onClick={() => {
            setOpeningMessage(
              `Hey${firstName ? ` ${firstName}` : ""}! While you're waiting for your cohort, I'm here. What's on your mind right now? A problem, an idea, a decision. I'll give you a real answer.`
            )
            setChatOpen(true)
          }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-brand-primary/20 bg-brand-primary/5 text-brand-primary text-sm font-medium hover:bg-brand-primary/10 transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          Open BUZZ Chat
        </button>
      )}

      {/* Inline BUZZ chat */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-brand-border bg-brand-surface overflow-hidden">
              {/* Chat header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-brand-primary to-brand-accent flex items-center justify-center">
                    <Zap className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-xs font-semibold text-brand-text">Chat with BUZZ</span>
                </div>
                <button
                  onClick={() => setChatOpen(false)}
                  className="p-1 rounded-lg text-brand-text-muted hover:text-brand-text transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Chat component */}
              <div className="h-80 p-4">
                <BuzzChat
                  driveProfile={driveProfile ?? null}
                  psychProfile={psychProfile ?? null}
                  isEngagement={true}
                  openingMessage={openingMessage}
                  className="h-full"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Privacy note */}
      <p className="text-center text-[10px] text-brand-text-subtle">
        BUZZ learns from every conversation to find you the right cohort.{" "}
        <span className="text-brand-text-muted">Your conversations are private.</span>
      </p>
    </div>
  )
}
