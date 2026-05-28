"use client"

import { motion } from "framer-motion"
import { Clock, Share2, Users } from "lucide-react"
import type { DriveProfile } from "@prisma/client"
import { BuzzWaitingEngagement } from "@/components/BuzzWaitingEngagement"

interface PsychProfile {
  ambitionType?:       string | null
  energyStyle?:        string | null
  communicationStyle?: string | null
  accountabilityNeed?: string | null
  emotionalDriver?:    string | null
  conflictStyle?:      string | null
  summary?:            string | null
}

interface Props {
  driveProfile:  DriveProfile | null
  psychProfile?: PsychProfile | null
  firstName?:    string
  joinedAt?:     Date | string | null
}

export function PendingCohortState({ driveProfile, psychProfile, firstName, joinedAt }: Props) {
  const joinedDaysAgo = joinedAt
    ? Math.floor((Date.now() - new Date(joinedAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0

  // Coerce DriveProfile to BuzzWaitingEngagement shape
  const buzzDriveProfile = driveProfile
    ? {
        archetype:     driveProfile.archetype,
        archetypeSlug: driveProfile.archetypeSlug,
        ambition:      driveProfile.ambition,
        community:     driveProfile.community,
        discipline:    driveProfile.discipline,
        openness:      driveProfile.openness,
        growth:        driveProfile.growth,
      }
    : null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Main waiting card + drive profile */}
      <div className="lg:col-span-2 space-y-6">
        {/* Main pending card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl border border-brand-border bg-brand-surface overflow-hidden"
        >
          {/* Ambient glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-40 bg-brand-primary/5 blur-[80px] pointer-events-none" />

          <div className="relative p-8 md:p-12 text-center">
            {/* Animated waiting indicator */}
            <div className="relative w-16 h-16 mx-auto mb-6">
              <div className="w-16 h-16 rounded-full border-2 border-brand-border flex items-center justify-center">
                <Clock className="w-7 h-7 text-brand-primary" />
              </div>
              {[1, 2].map((i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 1, opacity: 0.3 }}
                  animate={{ scale: 1.8 + i * 0.3, opacity: 0 }}
                  transition={{
                    duration: 2,
                    delay: i * 0.5,
                    repeat: Infinity,
                    repeatType: "loop",
                  }}
                  className="absolute inset-0 rounded-full border border-brand-primary/30"
                />
              ))}
            </div>

            <h2 className="font-display text-3xl font-bold text-brand-text mb-3">
              You're in the queue.
            </h2>
            <p className="text-brand-text-muted max-w-sm mx-auto leading-relaxed">
              We match by hand. Every cohort is personally reviewed before launch.
              You'll hear from us within{" "}
              <strong className="text-brand-text">7 days</strong>.
            </p>

            <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-primary/10 border border-brand-primary/20 px-4 py-2 text-sm text-brand-primary font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse inline-block" />
              Application received
            </div>
          </div>

          {/* Info grid */}
          <div className="border-t border-brand-border grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-brand-border">
            {[
              {
                icon: Users,
                title: "Group of 4",
                desc: "You'll be matched with 3 compatible people.",
              },
              {
                icon: Clock,
                title: "Week 1 is free",
                desc: "No payment until after your first session.",
              },
              {
                icon: Share2,
                title: "Founders review",
                desc: "Every cohort is hand-approved by the team.",
              },
            ].map((item) => (
              <div key={item.title} className="p-6 flex flex-col gap-2">
                <item.icon className="w-5 h-5 text-brand-primary" />
                <h4 className="font-semibold text-brand-text text-sm">{item.title}</h4>
                <p className="text-brand-text-subtle text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Drive profile card (if assessment done) */}
        {driveProfile && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-brand-border bg-brand-surface p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-xs text-brand-text-subtle uppercase tracking-wider font-medium mb-1">
                  Your Drive Profile
                </p>
                <h3 className="font-semibold text-brand-text text-lg">
                  {driveProfile.archetype}
                </h3>
              </div>
              <div className="px-3 py-1 rounded-full bg-brand-primary/10 border border-brand-primary/20">
                <span className="text-xs text-brand-primary font-medium">
                  {driveProfile.archetypeSlug}
                </span>
              </div>
            </div>

            <p className="text-brand-text-muted text-sm leading-relaxed mb-5">
              {driveProfile.summary}
            </p>

            {/* Dimension bars */}
            <div className="space-y-3">
              {[
                { label: "Ambition",   value: driveProfile.ambition,   color: "#1DB896" },
                { label: "Community",  value: driveProfile.community,  color: "#7CC455" },
                { label: "Discipline", value: driveProfile.discipline, color: "#5EA83A" },
                { label: "Openness",   value: driveProfile.openness,   color: "#EE9F52" },
                { label: "Growth",     value: driveProfile.growth,     color: "#179E80" },
              ].map((dim) => (
                <div key={dim.label} className="flex items-center gap-3">
                  <span className="text-xs text-brand-text-subtle w-20 flex-shrink-0">
                    {dim.label}
                  </span>
                  <div className="flex-1 h-1.5 bg-brand-border rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${dim.value}%` }}
                      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: dim.color }}
                    />
                  </div>
                  <span className="text-xs text-brand-text-subtle w-8 text-right">
                    {Math.round(dim.value)}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Share CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border border-brand-border bg-brand-surface p-5 flex items-center justify-between"
        >
          <div>
            <p className="font-medium text-brand-text text-sm">Know someone who'd fit?</p>
            <p className="text-xs text-brand-text-subtle mt-0.5">
              Refer a friend — your cohort gets better the more they know your world.
            </p>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(
                `${process.env.NEXT_PUBLIC_APP_URL}?ref=friend`
              )
            }}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-brand-border hover:border-brand-primary text-brand-text-muted hover:text-brand-primary transition-all"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
        </motion.div>
      </div>

      {/* Right: BUZZ engagement sidebar */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.15 }}
        className="lg:col-span-1"
      >
        <BuzzWaitingEngagement
          firstName={firstName}
          driveProfile={buzzDriveProfile}
          psychProfile={psychProfile}
          joinedDaysAgo={joinedDaysAgo}
        />
      </motion.div>
    </div>
  )
}
