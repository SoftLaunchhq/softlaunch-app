"use client"

/**
 * BuzzPageClient — Full BUZZ dashboard page.
 *
 * Three-panel layout:
 * - Left sidebar: BUZZ Insights (PsychProfile) + quick-start prompts
 * - Main: Full BuzzChat
 * - Right (desktop): BUZZ Onboarding entry point if profile incomplete
 *
 * Responsive: collapses to single column on mobile.
 */

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Zap, Brain, MessageCircle, ArrowLeft, Sparkles } from "lucide-react"
import Link from "next/link"
import { BuzzChat } from "@/components/BuzzChat"
import { BuzzInsightCard } from "@/components/BuzzInsightCard"
import { BuzzOnboarding } from "@/components/BuzzOnboarding"

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
  confidenceScore?:    number
}

interface Props {
  driveProfile:  DriveProfile | null
  psychProfile:  PsychProfile | null
  firstName:     string | null
}

const STARTER_PROMPTS = [
  { emoji: "🎯", text: "Should I raise a round or stay bootstrapped?" },
  { emoji: "🤔", text: "How do I hold someone accountable without damaging the relationship?" },
  { emoji: "⚡", text: "I'm overwhelmed. What should I actually focus on this week?" },
  { emoji: "💡", text: "Am I thinking about this problem the right way?" },
  { emoji: "🔥", text: "Give me a brutal honest take on my current strategy." },
]

type Panel = "chat" | "onboarding"

export function BuzzPageClient({ driveProfile, psychProfile, firstName }: Props) {
  const [activePanel, setActivePanel] = useState<Panel>("chat")
  const [seedMessage, setSeedMessage]  = useState<string | undefined>(undefined)
  const [refreshKey, setRefreshKey]    = useState(0)

  const hasProfile  = !!psychProfile
  const lowConf     = (psychProfile?.confidenceScore ?? 0) < 0.4
  const showOnboardingCTA = !hasProfile || lowConf

  const handleStarterClick = (prompt: string) => {
    setSeedMessage(
      `Hey ${firstName ?? ""}! I want your honest take on something: ${prompt}`
    )
    setActivePanel("chat")
  }

  const handleOnboardingComplete = () => {
    setRefreshKey((k) => k + 1)
    setActivePanel("chat")
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 rounded-lg border border-brand-border text-brand-text-muted hover:text-brand-text hover:border-brand-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-primary to-brand-accent flex items-center justify-center shadow-[0_0_10px_rgba(29,184,150,0.4)]">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              <h1 className="font-display text-2xl font-bold text-brand-text">BUZZ</h1>
            </div>
            <p className="text-xs text-brand-text-muted mt-0.5">
              Your AI accountability partner. Decisive, honest, direct.
            </p>
          </div>
        </div>

        {/* Panel toggle (mobile) */}
        <div className="flex items-center gap-1 rounded-lg border border-brand-border bg-brand-surface p-1 sm:hidden">
          <button
            onClick={() => setActivePanel("chat")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activePanel === "chat"
                ? "bg-brand-primary text-white"
                : "text-brand-text-muted hover:text-brand-text"
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Chat
          </button>
          <button
            onClick={() => setActivePanel("onboarding")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activePanel === "onboarding"
                ? "bg-brand-primary text-white"
                : "text-brand-text-muted hover:text-brand-text"
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            Profile
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[70vh]">

        {/* Left sidebar: Insights + starter prompts */}
        <div className="lg:col-span-1 space-y-4 hidden sm:block">
          {/* BUZZ Insight Card */}
          <BuzzInsightCard
            key={refreshKey}
            onRunOnboarding={() => setActivePanel("onboarding")}
          />

          {/* Onboarding CTA if needed */}
          {showOnboardingCTA && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-brand-primary" />
                <span className="text-xs font-semibold text-brand-primary">
                  {hasProfile ? "Improve your profile" : "Unlock your profile"}
                </span>
              </div>
              <p className="text-xs text-brand-text-muted mb-3 leading-relaxed">
                {hasProfile
                  ? "Your profile needs more data. The BUZZ deep-dive takes 5 minutes and dramatically improves your matching."
                  : "Complete the BUZZ deep-dive so we can understand how you think, what drives you, and who you belong with."}
              </p>
              <button
                onClick={() => setActivePanel("onboarding")}
                className="w-full py-2 rounded-lg bg-brand-primary text-white text-xs font-medium hover:bg-brand-primary-hover transition-colors"
              >
                {hasProfile ? "Improve my profile" : "Start BUZZ deep-dive"}
              </button>
            </motion.div>
          )}

          {/* Starter prompts */}
          <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
            <p className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-3">
              Try asking BUZZ
            </p>
            <div className="space-y-2">
              {STARTER_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => handleStarterClick(p.text)}
                  className="w-full text-left flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-brand-surface-elevated transition-colors group"
                >
                  <span className="text-base leading-none flex-shrink-0">{p.emoji}</span>
                  <span className="text-xs text-brand-text-muted group-hover:text-brand-text transition-colors leading-relaxed">
                    {p.text}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Privacy note */}
          <p className="text-[10px] text-brand-text-subtle text-center px-2">
            BUZZ uses your profile to give better answers. Conversations are private and used only to improve your matching.
          </p>
        </div>

        {/* Main content area */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {activePanel === "chat" ? (
              <motion.div
                key="chat"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full rounded-2xl border border-brand-border bg-brand-surface overflow-hidden flex flex-col"
                style={{ minHeight: "600px" }}
              >
                {/* Chat header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-brand-border">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-primary to-brand-accent flex items-center justify-center shadow-[0_0_12px_rgba(29,184,150,0.4)]">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-brand-text">BUZZ</p>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
                      <p className="text-xs text-brand-text-muted">Online · gives real answers</p>
                    </div>
                  </div>
                  {/* Profile toggle for desktop */}
                  <button
                    onClick={() => setActivePanel("onboarding")}
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-border text-xs text-brand-text-muted hover:text-brand-primary hover:border-brand-primary transition-colors"
                  >
                    <Brain className="w-3.5 h-3.5" />
                    My profile
                  </button>
                </div>

                {/* Chat body */}
                <div className="flex-1 p-5 overflow-hidden">
                  <BuzzChat
                    key={`chat-${seedMessage}`}
                    driveProfile={driveProfile}
                    psychProfile={psychProfile}
                    openingMessage={
                      seedMessage
                        ? undefined
                        : `Hey${firstName ? ` ${firstName}` : ""}! I'm BUZZ, your accountability AI. I give real answers. No "it depends." No hedging. What's on your mind right now?`
                    }
                    className="h-full"
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="onboarding"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full rounded-2xl border border-brand-border bg-brand-surface overflow-hidden"
                style={{ minHeight: "600px" }}
              >
                {/* Onboarding header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-brand-primary" />
                    <span className="text-sm font-semibold text-brand-text">BUZZ Deep-Dive</span>
                  </div>
                  <button
                    onClick={() => setActivePanel("chat")}
                    className="text-xs text-brand-text-muted hover:text-brand-primary transition-colors"
                  >
                    Back to chat
                  </button>
                </div>

                <div className="p-5 h-[calc(100%-64px)] overflow-y-auto">
                  <BuzzOnboarding
                    driveProfile={driveProfile}
                    firstName={firstName ?? undefined}
                    onComplete={handleOnboardingComplete}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
