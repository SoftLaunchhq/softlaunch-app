"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  MessageCircle,
  Calendar,
  FileText,
  CheckCircle2,
  Lock,
  ChevronRight,
  Users2,
  LayoutDashboard,
  Sparkles,
  Wrench,
} from "lucide-react"
import { MemberCard } from "./MemberCard"
import { PromptCard } from "./PromptCard"
import { FeedbackModal } from "./FeedbackModal"
import { cohortThemeLabel } from "@/lib/utils"
import type { Cohort, CohortMembership, Subscription } from "@prisma/client"

interface Props {
  cohort: any // Full cohort with relations
  currentUserId: string
  membershipStatus: string
  weekAccessLevel: number
  subscription: Subscription | null
}

const WEEK_LABELS = ["", "Week 1", "Week 2", "Week 3", "Week 4"]

export function CohortView({
  cohort,
  currentUserId,
  membershipStatus,
  weekAccessLevel,
  subscription,
}: Props) {
  const [showFeedback, setShowFeedback] = useState(false)
  const [activeTab, setActiveTab] = useState<"overview" | "members" | "prompt" | "tools">("overview")

  const otherMembers = cohort.memberships.filter(
    (m: any) => m.userId !== currentUserId
  )
  const currentWeek = cohort.currentWeek || 1
  const activePrompt = cohort.weeklyPrompts?.find(
    (p: any) => p.weekNumber === currentWeek
  )
  const canSeePrompt = !!activePrompt && weekAccessLevel >= currentWeek
  const tabs = [
    { key: "overview" as const, label: "Overview", icon: LayoutDashboard },
    { key: "members" as const, label: "Members", icon: Users2 },
    { key: "prompt" as const, label: "Prompt", icon: Sparkles, disabled: !canSeePrompt },
    { key: "tools" as const, label: "Tools", icon: Wrench },
  ]

  return (
    <div className="space-y-6">
      {/* Cohort header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="neon-panel flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6"
      >
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-brand-border/80 bg-brand-bg/50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-brand-text-subtle">
              {cohortThemeLabel(cohort.theme)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-200">
              <span className="status-dot status-dot-active" />
              Active cohort
            </span>
          </div>
          <h2 className="font-display text-2xl font-bold text-brand-text md:text-3xl">
            {cohort.name}
          </h2>
        </div>
        <div className="flex items-center gap-3 text-sm text-brand-text-muted">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-200 ring-1 ring-cyan-300/25">
            <Users2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-brand-text-subtle">Cohort size</p>
            <p className="font-medium text-brand-text">{otherMembers.length + 1} people</p>
          </div>
        </div>
      </motion.div>

      {/* Week progress */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="neon-panel p-6 md:p-8"
      >
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary ring-1 ring-brand-primary/25">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-brand-text">{WEEK_LABELS[currentWeek]} of 4</p>
              <p className="text-xs text-brand-text-subtle">Your 4-week arc</p>
            </div>
          </div>
          <span className="rounded-full border border-brand-border/80 bg-brand-bg/50 px-3 py-1 text-xs text-brand-text-muted">
            {currentWeek === 1 ? "Free trial week" : `Week ${currentWeek} in progress`}
          </span>
        </div>

        {/* Week timeline */}
        <div className="flex items-center gap-0">
          {[1, 2, 3, 4].map((week, i) => {
            const isPast = week < currentWeek
            const isCurrent = week === currentWeek
            const isFuture = week > currentWeek
            const isLocked = week > 1 && weekAccessLevel < week && !subscription?.status.includes("ACTIVE")

            return (
              <div key={week} className="flex items-center flex-1">
                {/* Step */}
                <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                  <motion.div
                    animate={isCurrent ? { scale: [1, 1.06, 1] } : {}}
                    transition={{ duration: 2.4, repeat: isCurrent ? Infinity : 0, ease: "easeInOut" }}
                    className={`
                      flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all
                      ${isPast ? "border-brand-primary bg-brand-primary" : ""}
                      ${isCurrent ? "border-brand-primary bg-brand-primary/20 shadow-[0_0_18px_rgba(34,211,238,0.35)]" : ""}
                      ${isFuture && !isLocked ? "border-brand-border bg-brand-surface" : ""}
                      ${isLocked ? "border-brand-border bg-brand-surface" : ""}
                    `}
                  >
                    {isPast ? (
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    ) : isLocked ? (
                      <Lock className="w-3.5 h-3.5 text-brand-text-subtle" />
                    ) : (
                      <span className={`text-xs font-semibold ${isCurrent ? "text-brand-primary" : "text-brand-text-subtle"}`}>
                        {week}
                      </span>
                    )}
                  </motion.div>
                  <span className={`text-xs whitespace-nowrap ${isCurrent ? "text-brand-primary font-medium" : "text-brand-text-subtle"}`}>
                    {week === 1 ? "Free" : `Wk ${week}`}
                  </span>
                </div>

                {/* Connector */}
                {i < 3 && (
                  <div className={`flex-1 h-0.5 mx-1 ${week < currentWeek ? "bg-brand-primary" : "bg-brand-border"}`} />
                )}
              </div>
            )
          })}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="neon-panel p-3"
      >
        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          {tabs.map((tab) => (
            <motion.button
              key={tab.key}
              type="button"
              onClick={() => !tab.disabled && setActiveTab(tab.key)}
              disabled={tab.disabled}
              whileHover={tab.disabled ? {} : { y: -2 }}
              whileTap={tab.disabled ? {} : { scale: 0.98 }}
              className={`
                flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors
                ${activeTab === tab.key
                  ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.12)]"
                  : "border-brand-border/80 bg-brand-surface/50 text-brand-text-muted hover:border-cyan-300/25 hover:text-brand-text"
                }
                ${tab.disabled ? "cursor-not-allowed opacity-40" : ""}
              `}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </motion.button>
          ))}
        </div>

        <div className="rounded-2xl border border-brand-border/80 bg-brand-surface/55 p-5">
          {activeTab === "overview" && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-brand-border bg-brand-bg/60 p-4">
                <p className="text-xs uppercase tracking-wider text-brand-text-subtle">Current week</p>
                <p className="mt-2 text-2xl font-semibold text-brand-text">
                  {WEEK_LABELS[currentWeek]}
                </p>
                <p className="mt-1 text-sm text-brand-text-muted">
                  {currentWeek === 1 ? "Trial session unlocked." : "Momentum week in progress."}
                </p>
              </div>
              <div className="rounded-xl border border-brand-border bg-brand-bg/60 p-4">
                <p className="text-xs uppercase tracking-wider text-brand-text-subtle">Cohort status</p>
                <p className="mt-2 text-2xl font-semibold text-cyan-200">Active</p>
                <p className="mt-1 text-sm text-brand-text-muted">
                  You're matched with {otherMembers.length} members.
                </p>
              </div>
              <div className="rounded-xl border border-brand-border bg-brand-bg/60 p-4 md:col-span-2">
                <p className="text-xs uppercase tracking-wider text-brand-text-subtle">Next action</p>
                <p className="mt-2 text-base font-medium text-brand-text">
                  {canSeePrompt ? "Submit this week's reflection prompt." : "Complete Week 1 to unlock next prompt."}
                </p>
              </div>
            </div>
          )}

          {activeTab === "members" && (
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-brand-text">
                Your Cohort
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {otherMembers.map((membership: any, i: number) => (
                  <MemberCard key={membership.id} membership={membership} index={i} />
                ))}
              </div>
            </div>
          )}

          {activeTab === "prompt" && canSeePrompt && (
            <PromptCard prompt={activePrompt} weekNumber={currentWeek} cohortId={cohort.id} />
          )}

          {activeTab === "prompt" && !canSeePrompt && (
            <div className="rounded-xl border border-brand-border bg-brand-bg/60 p-6 text-center">
              <p className="text-sm text-brand-text-muted">
                Prompt unlocks when your access level reaches this week.
              </p>
            </div>
          )}

          {activeTab === "tools" && (
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-brand-text">
                Group Tools
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  {
                    icon: MessageCircle,
                    label: "WhatsApp Group",
                    sublabel: "Chat with your cohort",
                    href: cohort.whatsappGroupLink || "#",
                    disabled: !cohort.whatsappGroupLink,
                    color: "text-emerald-400",
                    bg: "bg-emerald-500/10 border-emerald-500/20",
                  },
                  {
                    icon: Calendar,
                    label: "Schedule",
                    sublabel: "Book time together",
                    href: cohort.calendlyLink || "#",
                    disabled: !cohort.calendlyLink,
                    color: "text-blue-400",
                    bg: "bg-blue-500/10 border-blue-500/20",
                  },
                  {
                    icon: FileText,
                    label: "Shared Docs",
                    sublabel: "Goals & notes on Notion",
                    href: cohort.notionDocLink || "#",
                    disabled: !cohort.notionDocLink,
                    color: "text-brand-text-muted",
                    bg: "bg-brand-surface border-brand-border",
                  },
                ].map((tool) => (
                  <a
                    key={tool.label}
                    href={tool.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`
                      flex items-center gap-3 rounded-xl border p-4 transition-all duration-150 group
                      ${tool.disabled
                        ? "opacity-40 cursor-not-allowed pointer-events-none"
                        : "hover:scale-[1.01] hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
                      }
                      ${tool.bg}
                    `}
                  >
                    <tool.icon className={`h-5 w-5 flex-shrink-0 ${tool.color}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-brand-text">{tool.label}</p>
                      <p className="truncate text-xs text-brand-text-subtle">{tool.sublabel}</p>
                    </div>
                    {!tool.disabled && (
                      <ChevronRight className="h-4 w-4 text-brand-text-subtle transition-transform group-hover:translate-x-0.5" />
                    )}
                  </a>
                ))}
              </div>
              {!cohort.whatsappGroupLink && (
                <p className="mt-3 text-xs text-brand-text-subtle">
                  Your group link will be shared by the SoftLaunch team within 24 hours of cohort approval.
                </p>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Feedback CTA */}
      {currentWeek >= 1 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="neon-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-sm font-medium text-brand-text">
              How was Week {currentWeek}?
            </p>
            <p className="mt-0.5 text-xs text-brand-text-subtle">
              Takes 60 seconds. Helps us improve your future matches.
            </p>
          </div>
          <motion.button
            type="button"
            onClick={() => setShowFeedback(true)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2.5 text-sm font-medium text-cyan-100 transition-colors hover:bg-cyan-300/20"
          >
            Give feedback
          </motion.button>
        </motion.div>
      )}

      {/* Feedback modal */}
      {showFeedback && (
        <FeedbackModal
          cohortId={cohort.id}
          weekNumber={currentWeek}
          members={otherMembers}
          onClose={() => setShowFeedback(false)}
        />
      )}
    </div>
  )
}
