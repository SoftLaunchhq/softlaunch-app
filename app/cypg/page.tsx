"use client"

// ─────────────────────────────────────────────────────────────
// app/cypg/page.tsx
// CYPG (Can't You Play Golf?) partner landing page.
// Sets partner tracking cookie on mount, then drives user to sign-up.
// ─────────────────────────────────────────────────────────────

import { useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { CheckCircle2, ArrowRight, Users, Target, Zap } from "lucide-react"
import { recordPartnerArrival } from "@/lib/partnerTracking"

const PERKS = [
  {
    icon: Target,
    title: "Priority Matching",
    desc: "Jump the queue — CYPG members get matched to their first cohort in under 48 hours.",
  },
  {
    icon: Users,
    title: "Curated Community",
    desc: "4-person accountability groups of driven, vetted people who actually follow through.",
  },
  {
    icon: Zap,
    title: "First Week Free",
    desc: "No card required for Week 1. See if the group clicks before you ever pay a cent.",
  },
]

const SOCIAL_PROOF = [
  { quote: "First time I've had people in my corner who actually hold me to my word.", name: "Marcus T.", city: "Charlotte, NC" },
  { quote: "SoftLaunch changed how I think about accountability. It's not pressure — it's pull.", name: "Jordan R.", city: "Charlotte, NC" },
  { quote: "Week 1 and I already have three people who text me when I go quiet.", name: "Priya S.", city: "Charlotte, NC" },
]

export default function CYPGLandingPage() {
  // Record partner arrival on mount — sets cookie + localStorage
  useEffect(() => {
    recordPartnerArrival("cypg", undefined, 30)
  }, [])

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 50% -5%, rgba(29,184,150,0.12) 0%, transparent 65%)",
        }}
      />

      {/* ── Navbar ────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-5 py-4 max-w-6xl mx-auto">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo.png"
            alt="SoftLaunch"
            width={36}
            height={33}
            className="object-contain"
            priority
          />
          <span className="font-display text-[17px] font-bold tracking-tight text-brand-text">
            SoftLaunch
          </span>
        </Link>
        <Link
          href="/sign-in"
          className="text-sm font-medium text-brand-text-muted hover:text-brand-text transition-colors"
        >
          Already a member? Sign in →
        </Link>
      </nav>

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-5 pt-16 pb-10 text-center">
        {/* Partner badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-primary/30 bg-brand-primary/8 px-4 py-1.5 text-xs font-semibold text-brand-primary mb-8 tracking-wide uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
          Exclusive for CYPG Members
        </div>

        <h1 className="font-display text-5xl md:text-6xl font-bold leading-[1.08] tracking-tight mb-6">
          Built for people who
          <br />
          <span
            style={{
              background: "linear-gradient(135deg, #1DB896 0%, #7CC455 55%, #EE9F52 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            show up and deliver.
          </span>
        </h1>

        <p className="text-lg text-brand-text-muted leading-relaxed max-w-2xl mx-auto mb-10">
          SoftLaunch matches you into a tight-knit group of 4 driven people for 4 weeks of
          real accountability — no fluff, no corporate workshops.
          CYPG members get priority access and their first week free.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link
            href="/sign-up"
            className="sl-button flex items-center gap-2 px-7 py-3.5 text-base font-semibold"
          >
            Join as a CYPG member
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/how-it-works"
            className="text-sm font-medium text-brand-text-muted hover:text-brand-text transition-colors underline underline-offset-4"
          >
            How it works →
          </Link>
        </div>

        <p className="mt-4 text-xs text-brand-text-subtle">
          No credit card required for Week 1 · Takes 8 minutes to get started
        </p>
      </section>

      {/* ── Perks grid ─────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-5 py-14">
        <div className="grid md:grid-cols-3 gap-5">
          {PERKS.map((perk) => (
            <div
              key={perk.title}
              className="rounded-2xl border border-brand-border bg-brand-surface p-6"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-primary/12 flex items-center justify-center mb-4">
                <perk.icon className="w-5 h-5 text-brand-primary" />
              </div>
              <h3 className="font-semibold text-brand-text mb-2">{perk.title}</h3>
              <p className="text-sm text-brand-text-muted leading-relaxed">{perk.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works strip ──────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-5 py-10">
        <div className="rounded-2xl border border-brand-border bg-brand-surface/60 p-8">
          <h2 className="font-display text-2xl font-bold text-brand-text mb-6">
            What actually happens
          </h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: "01", label: "8-min Drive Profile", desc: "Tell BUZZ who you are and what actually drives you." },
              { step: "02", label: "48-hr Matching", desc: "Algorithm pairs you with 3 people who complement your style." },
              { step: "03", label: "Week 1 — Free", desc: "Meet your group. Set your 4-week goal. No card, no pressure." },
              { step: "04", label: "4 Weeks of Pull", desc: "Weekly check-ins, real talk, and people who hold you accountable." },
            ].map((s) => (
              <div key={s.step}>
                <div className="text-xs font-bold text-brand-primary mb-2 tracking-widest">{s.step}</div>
                <div className="font-semibold text-brand-text text-sm mb-1">{s.label}</div>
                <div className="text-xs text-brand-text-muted leading-relaxed">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Social proof ────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-5 py-10">
        <div className="grid md:grid-cols-3 gap-5">
          {SOCIAL_PROOF.map((item, i) => (
            <div
              key={i}
              className="rounded-2xl border border-brand-border bg-brand-surface p-6"
            >
              <div className="flex gap-0.5 mb-4">
                {[...Array(5)].map((_, s) => (
                  <span key={s} className="text-brand-primary text-sm">★</span>
                ))}
              </div>
              <p className="text-sm text-brand-text leading-relaxed mb-4">
                &ldquo;{item.quote}&rdquo;
              </p>
              <div className="text-xs text-brand-text-subtle font-medium">
                {item.name} · {item.city}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ──────────────────────────────────────── */}
      <section className="max-w-2xl mx-auto px-5 py-16 text-center">
        <h2 className="font-display text-4xl font-bold text-brand-text mb-4 leading-tight">
          Ready to find your people?
        </h2>
        <p className="text-brand-text-muted mb-8 leading-relaxed">
          Your CYPG connection gets you straight to the front — priority matching, no waitlist, first week on us.
        </p>

        <div className="flex flex-col gap-3 items-center">
          <Link
            href="/sign-up"
            className="sl-button flex items-center gap-2 px-8 py-4 text-base font-semibold w-full max-w-xs justify-center"
          >
            Claim your CYPG spot
            <ArrowRight className="w-4 h-4" />
          </Link>

          <div className="flex flex-col gap-1.5 mt-4">
            {[
              "No credit card for Week 1",
              "Priority matching within 48 hours",
              "Cancel anytime — no lock-in",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-brand-text-muted">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-primary flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-brand-border py-8 px-5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="SoftLaunch" width={24} height={22} className="object-contain opacity-60" />
            <span className="text-xs text-brand-text-subtle">
              © {new Date().getFullYear()} SoftLaunch · Charlotte, NC
            </span>
          </div>
          <div className="flex gap-5 text-xs text-brand-text-subtle">
            <Link href="/privacy" className="hover:text-brand-text transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-brand-text transition-colors">Terms</Link>
            <Link href="/" className="hover:text-brand-text transition-colors">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
