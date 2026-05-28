"use client"

import Link from "next/link"
import { Lock, Sparkles, Brain, ArrowRight } from "lucide-react"

/**
 * Flow A — User has NOT completed onboarding / BUZZ deep-dive.
 * Profile is incomplete so we can't match them yet.
 */
export function MatchLockedState() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12 text-center">
      <div className="neon-panel max-w-lg w-full p-8 md:p-10">

        {/* Icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary/10 border border-brand-primary/20">
          <Lock className="h-7 w-7 text-brand-primary" />
        </div>

        {/* Title */}
        <h1 className="font-display text-2xl font-bold text-brand-text md:text-3xl">
          Your 1-on-1 match starts with your profile.
        </h1>

        {/* Body */}
        <p className="mt-3 text-sm leading-relaxed text-brand-text-muted">
          BUZZ needs to understand how you think, communicate, and build before we can find someone who actually fits. This isn&apos;t a quiz — it&apos;s the foundation of everything.
        </p>

        {/* What BUZZ learns */}
        <div className="mt-6 space-y-2 text-left">
          {[
            { icon: Brain,    text: "Your ambition type and energy style" },
            { icon: Sparkles, text: "How you communicate and process pressure" },
            { icon: ArrowRight, text: "What you need in a peer — and what you don't" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 rounded-xl border border-brand-border/60 bg-brand-bg/40 px-4 py-3">
              <Icon className="h-4 w-4 flex-shrink-0 text-brand-primary" />
              <span className="text-sm text-brand-text-muted">{text}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/dashboard/buzz"
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-primary/25 transition-all hover:bg-brand-primary/90 hover:shadow-brand-primary/35"
        >
          Complete BUZZ Deep-Dive
          <ArrowRight className="h-4 w-4" />
        </Link>

        <p className="mt-4 text-xs text-brand-text-subtle">
          Takes about 8 minutes · Private · Never shared
        </p>
      </div>
    </div>
  )
}
