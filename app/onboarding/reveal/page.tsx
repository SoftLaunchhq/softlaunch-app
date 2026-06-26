"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight, Loader2 } from "lucide-react"

interface DriveProfileData {
  archetype: string
  archetypeSlug: string
  summary: string
  ambition: number
  community: number
  discipline: number
  openness: number
  growth: number
}

const DIMENSION_CONFIG: Record<string, { label: string; color: string }> = {
  ambition:   { label: "Ambition",   color: "#1DB896" },
  community:  { label: "Community",  color: "#7CC455" },
  discipline: { label: "Discipline", color: "#5EA83A" },
  openness:   { label: "Openness",   color: "#EE9F52" },
  growth:     { label: "Growth",     color: "#179E80" },
}

const ARCHETYPE_EMOJI: Record<string, string> = {
  builder:    "🔨",
  connector:  "🌿",
  disciplined:"⚡",
  visionary:  "🔭",
  creator:    "🎨",
  catalyst:   "🚀",
}

function DriveDimension({
  label,
  value,
  color,
  delay,
}: {
  label: string
  value: number
  color: string
  delay: number
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="text-brand-text-muted font-medium">{label}</span>
        <span className="tabular-nums font-semibold text-brand-text">{Math.round(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-brand-border">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.9, delay: delay + 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  )
}

export default function RevealPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<DriveProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<"loading" | "reveal" | "details">("loading")
  const [activeTab, setActiveTab] = useState<"summary" | "dimensions" | "next">("summary")

  useEffect(() => {
    fetch("/api/assessment/profile")
      .then((res) => {
        if (!res.ok) throw new Error("Profile not found")
        return res.json()
      })
      .then((data) => {
        setProfile(data)
        setLoading(false)
        setTimeout(() => setPhase("reveal"), 600)
        setTimeout(() => setPhase("details"), 2200)
      })
      .catch(() => router.push("/onboarding/assessment"))
  }, [router])

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-73px)] items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="h-10 w-10 rounded-2xl bg-brand-gradient flex items-center justify-center">
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          </div>
          <p className="text-sm text-brand-text-muted">Building your drive profile…</p>
        </motion.div>
      </div>
    )
  }

  if (!profile) return null

  const dimensions = [
    { key: "ambition",   value: profile.ambition },
    { key: "community",  value: profile.community },
    { key: "discipline", value: profile.discipline },
    { key: "openness",   value: profile.openness },
    { key: "growth",     value: profile.growth },
  ]

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col items-center justify-center py-12 px-6">
      <div className="w-full max-w-lg">

        {/* Archetype reveal */}
        <AnimatePresence mode="wait">
          {(phase === "reveal" || phase === "details") && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-10 text-center"
            >
              {/* Archetype badge */}
              <div className="relative mx-auto mb-6 h-20 w-20">
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 rounded-3xl"
                  style={{ background: "linear-gradient(135deg, #1DB896, #7CC455, #EE9F52)" }}
                />
                {[1, 2].map((i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 1, opacity: 0.3 }}
                    animate={{ scale: 1.6 + i * 0.3, opacity: 0 }}
                    transition={{
                      duration: 1.8,
                      delay: i * 0.25,
                      repeat: Infinity,
                      repeatDelay: 0.3,
                    }}
                    className="absolute inset-0 rounded-3xl"
                    style={{ background: "rgba(29,184,150,0.2)" }}
                  />
                ))}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl">
                    {ARCHETYPE_EMOJI[profile.archetypeSlug] ?? "✨"}
                  </span>
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-text-subtle mb-2">
                  Your archetype
                </p>
                <h1 className="font-display text-5xl font-bold gradient-text">
                  {profile.archetype}
                </h1>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Detail tabs */}
        <AnimatePresence>
          {phase === "details" && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-4"
            >
              {/* Tab switcher */}
              <div className="sl-panel p-1.5">
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { key: "summary" as const,    label: "Summary" },
                    { key: "dimensions" as const, label: "Dimensions" },
                    { key: "next" as const,       label: "Next step" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                        activeTab === tab.key
                          ? "bg-brand-primary/15 border border-brand-primary/30 text-brand-primary"
                          : "text-brand-text-muted hover:text-brand-text"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary */}
              {activeTab === "summary" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="sl-panel p-6"
                >
                  <p className="leading-relaxed text-brand-text-muted">{profile.summary}</p>
                </motion.div>
              )}

              {/* Dimensions */}
              {activeTab === "dimensions" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="sl-panel p-6"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-text-subtle mb-5">
                    Drive Profile
                  </p>
                  <div className="space-y-4">
                    {dimensions.map((dim, i) => (
                      <DriveDimension
                        key={dim.key}
                        label={DIMENSION_CONFIG[dim.key].label}
                        value={dim.value}
                        color={DIMENSION_CONFIG[dim.key].color}
                        delay={i * 0.1}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Next step */}
              {activeTab === "next" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col gap-4"
                >
                  <div className="sl-panel p-5">
                    <p className="text-sm text-brand-text-muted leading-relaxed">
                      Your drive profile will be shared with your matched cohort.
                      The next step is completing your public profile: who you are,
                      what you're working on, and when you're available.
                    </p>
                  </div>
                  <button
                    onClick={() => router.push("/onboarding/profile")}
                    className="sl-button w-full justify-center py-3.5"
                  >
                    Complete your profile
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
