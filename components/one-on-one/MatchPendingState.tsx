"use client"

import Link from "next/link"
import { CheckCircle2, Circle, Clock, MessageCircle } from "lucide-react"

interface MatchPendingStateProps {
  firstName?: string | null
}

const PIPELINE_STEPS = [
  {
    key: "analyzed",
    label: "Profile analyzed",
    sublabel: "Drive Profile + BUZZ insights mapped",
    done: true,
  },
  {
    key: "searching",
    label: "Compatibility search",
    sublabel: "Comparing against the pool using 12 dimensions",
    done: true,
  },
  {
    key: "review",
    label: "Founder review",
    sublabel: "A human confirms the match before it reaches you",
    done: false,
  },
  {
    key: "ready",
    label: "Match ready",
    sublabel: "You'll be notified when your match is approved",
    done: false,
  },
]

/**
 * Flow B — Onboarding complete, no match yet.
 * Shows the matching pipeline so users understand what's happening.
 */
export function MatchPendingState({ firstName }: MatchPendingStateProps) {
  return (
    <div className="space-y-6">
      {/* Hero panel */}
      <div className="neon-panel p-6 md:p-8">
        <div className="neon-chip mb-5">1-on-1 Matching</div>

        <h1 className="font-display text-2xl font-bold text-brand-text md:text-3xl">
          We&apos;re finding your strongest 1-on-1 match{firstName ? `, ${firstName}` : ""}.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-brand-text-muted">
          SoftLaunch compares your Drive Profile, BUZZ insights, communication style, and peer needs
          to find one person worth your time. Unlike a random intro, your match is reviewed before
          it reaches you.
        </p>

        {/* Pipeline */}
        <div className="mt-8 space-y-0">
          {PIPELINE_STEPS.map((step, i) => {
            const isLast = i === PIPELINE_STEPS.length - 1
            const isActive = !step.done && (i === 0 || PIPELINE_STEPS[i - 1].done)

            return (
              <div key={step.key} className="flex gap-4">
                {/* Line + Icon column */}
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border ${
                      step.done
                        ? "border-brand-primary/40 bg-brand-primary/10"
                        : isActive
                        ? "border-brand-accent/40 bg-brand-accent/10 animate-pulse"
                        : "border-brand-border bg-brand-bg/40"
                    }`}
                  >
                    {step.done ? (
                      <CheckCircle2 className="h-4 w-4 text-brand-primary" />
                    ) : isActive ? (
                      <Clock className="h-4 w-4 text-brand-accent" />
                    ) : (
                      <Circle className="h-4 w-4 text-brand-text-subtle" />
                    )}
                  </div>
                  {!isLast && (
                    <div
                      className={`w-px flex-1 my-1 ${
                        step.done ? "bg-brand-primary/30" : "bg-brand-border/50"
                      }`}
                      style={{ minHeight: "20px" }}
                    />
                  )}
                </div>

                {/* Text */}
                <div className="pb-6">
                  <p
                    className={`text-sm font-semibold ${
                      step.done
                        ? "text-brand-primary"
                        : isActive
                        ? "text-brand-accent"
                        : "text-brand-text-subtle"
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="mt-0.5 text-xs text-brand-text-subtle">{step.sublabel}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Why it takes time */}
      <div className="sl-panel p-6">
        <h3 className="text-sm font-semibold text-brand-text">Why we review every match</h3>
        <p className="mt-2 text-sm leading-relaxed text-brand-text-muted">
          The algorithm identifies your highest-compatibility candidates — but a human reviews the
          pairing before activating it. This protects the quality of every match and ensures no one
          gets a connection they didn&apos;t earn.
        </p>
      </div>

      {/* BUZZ CTA */}
      <div className="sl-panel p-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-brand-text">Talk to BUZZ while you wait</p>
          <p className="mt-0.5 text-xs text-brand-text-subtle">
            Every conversation improves your match accuracy.
          </p>
        </div>
        <Link
          href="/dashboard/buzz"
          className="inline-flex items-center gap-2 rounded-xl border border-brand-primary/30 bg-brand-primary/10 px-4 py-2.5 text-sm font-semibold text-brand-primary transition-all hover:bg-brand-primary/15"
        >
          <MessageCircle className="h-4 w-4" />
          Open BUZZ
        </Link>
      </div>
    </div>
  )
}
