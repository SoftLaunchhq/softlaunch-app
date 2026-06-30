"use client"

// ─────────────────────────────────────────────────────────────
// app/onboarding/cohort-type/page.tsx
// Onboarding step: user selects Social or Professional cohort.
// Sits between /onboarding/welcome and /onboarding/assessment
// for new users, and is used in two other contexts:
//   1. One-time gate — existing users with null cohortIntent
//      are redirected here from /dashboard with ?returnTo=/dashboard
//   2. Voluntary edit — user clicks the "Cohort Type" card on
//      the dashboard with ?returnTo=/dashboard&current=social
//
// Supports ?returnTo=<path>  — must be an internal path (starts
// with "/" and not "//") to prevent open-redirect attacks.
// Supports ?current=<intent> — pre-selects the user's saved value.
// ─────────────────────────────────────────────────────────────

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowRight, Loader2, Heart, Briefcase } from "lucide-react"

type Intent = "social" | "professional"

interface CohortOption {
  id: Intent
  icon: React.ElementType
  title: string
  description: string
  accentClass: string
  iconBg: string
}

const OPTIONS: CohortOption[] = [
  {
    id: "social",
    icon: Heart,
    title: "Social Cohort",
    description:
      "I want to build genuine friendships, meaningful connections, and a stronger social circle.",
    accentClass:
      "border-brand-primary bg-brand-primary/10 shadow-[0_0_0_1px_rgba(29,184,150,0.4),0_0_24px_rgba(29,184,150,0.12)]",
    iconBg: "bg-brand-primary/15 text-brand-primary",
  },
  {
    id: "professional",
    icon: Briefcase,
    title: "Professional Cohort",
    description:
      "I want accountability, ambitious people, networking, and career-focused connections.",
    accentClass:
      "border-brand-accent bg-brand-accent/10 shadow-[0_0_0_1px_rgba(238,159,82,0.4),0_0_24px_rgba(238,159,82,0.12)]",
    iconBg: "bg-brand-accent/15 text-brand-accent",
  },
]

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Validates a returnTo value to prevent open-redirect attacks.
 * Only allows internal relative paths that start with "/" but NOT "//".
 * Falls back to /onboarding/assessment (standard new-user next step).
 */
function safeReturnTo(value: string | null): string {
  if (!value) return "/onboarding/assessment"
  const trimmed = value.trim()
  // Must be a root-relative path, not a protocol-relative URL (//evil.com)
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed
  return "/onboarding/assessment"
}

/**
 * Validates a ?current= param value. Returns the Intent if valid, null otherwise.
 */
function parseCurrentIntent(value: string | null): Intent | null {
  if (value === "social" || value === "professional") return value
  return null
}

// ─────────────────────────────────────────────────────────────
// Inner component — uses useSearchParams (must be in Suspense)
// ─────────────────────────────────────────────────────────────

function CohortTypeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Validated returnTo — safe against open-redirect
  const returnTo = safeReturnTo(searchParams.get("returnTo"))

  // Pre-selected value passed by the dashboard card link
  const currentIntent = parseCurrentIntent(searchParams.get("current"))

  // Initialize selection with saved value (null if no prior selection)
  const [selected, setSelected] = useState<Intent | null>(currentIntent)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleContinue = async () => {
    if (!selected) return
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/cohort-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: selected }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || "Could not save selection")
      }

      router.push(returnTo)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      setError(msg)
      setIsSubmitting(false)
    }
  }

  // Context flags
  const isDashboardReturn = returnTo === "/dashboard"
  // "edit" = user voluntarily came here to change an existing preference
  const isEditing = isDashboardReturn && currentIntent !== null

  // ── Copy variants ─────────────────────────────────────────
  const stepLabel = isEditing
    ? "Update preference"
    : isDashboardReturn
    ? "One quick question"
    : "Before we begin"

  const description = isEditing
    ? "You can change this anytime. Your updated preference will be used when we form your next cohort."
    : isDashboardReturn
    ? "We added this recently and want to make sure we match you with the right people."
    : "This helps us match you with people looking for the same kind of connection."

  const buttonLabel = isEditing
    ? "Save changes"
    : isDashboardReturn
    ? "Save and go to dashboard"
    : "Continue to assessment"

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col items-center justify-center py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="w-full max-w-lg"
      >
        {/* Step indicator */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-center text-xs font-semibold uppercase tracking-widest text-brand-text-subtle mb-6"
        >
          {stepLabel}
        </motion.p>

        {/* Heading */}
        <div className="text-center mb-10">
          <h1 className="font-display text-4xl font-bold text-brand-text leading-tight mb-3">
            What kind of cohort are
            <br />
            <span className="gradient-text">you looking for?</span>
          </h1>
          <p className="text-brand-text-muted text-base leading-relaxed max-w-sm mx-auto">
            {description}
          </p>
        </div>

        {/* Option cards */}
        <div className="space-y-4 mb-8">
          {OPTIONS.map((option, i) => {
            const isSelected = selected === option.id
            const Icon = option.icon

            return (
              <motion.button
                key={option.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.1 }}
                whileHover={{ scale: 1.015, y: -1 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => setSelected(option.id)}
                className={`
                  w-full text-left rounded-2xl border p-6 transition-all duration-200
                  flex items-start gap-5 group
                  ${
                    isSelected
                      ? option.accentClass
                      : "border-brand-border bg-brand-surface hover:border-brand-border-light hover:bg-brand-surface/80"
                  }
                `}
              >
                {/* Icon */}
                <div
                  className={`
                    flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl
                    transition-colors duration-200
                    ${
                      isSelected
                        ? option.iconBg
                        : "bg-brand-surface-elevated border border-brand-border"
                    }
                  `}
                >
                  <Icon
                    className={`h-5 w-5 transition-colors duration-200 ${
                      isSelected
                        ? option.id === "social"
                          ? "text-brand-primary"
                          : "text-brand-accent"
                        : "text-brand-text-muted group-hover:text-brand-text"
                    }`}
                  />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-semibold text-lg mb-1.5 transition-colors duration-150 ${
                      isSelected
                        ? "text-brand-text"
                        : "text-brand-text-muted group-hover:text-brand-text"
                    }`}
                  >
                    {option.title}
                  </p>
                  <p
                    className={`text-sm leading-relaxed transition-colors duration-150 ${
                      isSelected ? "text-brand-text-muted" : "text-brand-text-subtle"
                    }`}
                  >
                    {option.description}
                  </p>
                </div>

                {/* Checkmark */}
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-primary flex items-center justify-center mt-0.5"
                  >
                    <svg
                      className="w-3.5 h-3.5 text-slate-950"
                      viewBox="0 0 12 12"
                      fill="none"
                    >
                      <path
                        d="M2 6l3 3 5-5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </motion.div>
                )}
              </motion.button>
            )
          })}
        </div>

        {/* Error state */}
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-brand-error text-center mb-4"
          >
            {error}
          </motion.p>
        )}

        {/* CTA button */}
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          whileHover={selected ? { scale: 1.02 } : {}}
          whileTap={selected ? { scale: 0.97 } : {}}
          onClick={handleContinue}
          disabled={!selected || isSubmitting}
          className="sl-button w-full py-3.5 text-base justify-center disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              {buttonLabel}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </motion.button>

        {/* Footer hint — only shown when nothing is pre-selected */}
        {!currentIntent && (
          <p className="text-center text-xs text-brand-text-subtle mt-4">
            You must select one option to continue.
          </p>
        )}
      </motion.div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Page export — wraps content in Suspense so useSearchParams
// does not block the page render (Next.js App Router requirement).
// ─────────────────────────────────────────────────────────────

export default function CohortTypePage() {
  return (
    <Suspense>
      <CohortTypeContent />
    </Suspense>
  )
}
