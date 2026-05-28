"use client"

import { Shield, Clock } from "lucide-react"

/**
 * Flow C — Match suggestion exists but is PENDING_REVIEW / not yet approved.
 * Non-admin users see a "being reviewed" holding state.
 * (Admin users are redirected to /admin/one-on-one from the page.tsx.)
 */
export function MatchReviewState() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-12 text-center">
      <div className="neon-panel max-w-md w-full p-8 md:p-10">

        {/* Animated icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-accent/10 border border-brand-accent/20">
          <div className="relative">
            <Shield className="h-7 w-7 text-brand-accent" />
            <span className="absolute -right-1 -top-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-50" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-brand-accent" />
            </span>
          </div>
        </div>

        <h1 className="font-display text-2xl font-bold text-brand-text">
          Your match is being reviewed.
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-brand-text-muted">
          We&apos;ve found a strong candidate. Before we make the introduction, a founder reviews
          the match to make sure it&apos;s actually right for you. This usually takes 24–48 hours.
        </p>

        {/* Status chip */}
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-brand-accent/30 bg-brand-accent/10 px-4 py-2">
          <Clock className="h-3.5 w-3.5 text-brand-accent" />
          <span className="text-xs font-semibold text-brand-accent">Under review</span>
        </div>

        <p className="mt-6 text-xs leading-relaxed text-brand-text-subtle">
          You&apos;ll receive an email when your match is ready. In the meantime, anything you share with BUZZ makes the match even better.
        </p>
      </div>
    </div>
  )
}
