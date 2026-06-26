import Link from "next/link"
import { WaitlistForm } from "@/components/marketing/WaitlistForm"
import { CheckCircle2, X } from "lucide-react"

const FEATURES = [
  { label: "Personalized Drive Profile assessment", included: true },
  { label: "Weekly matched cohort (6–10 people)", included: true },
  { label: "Structured weekly prompts designed for depth", included: true },
  { label: "BUZZ AI thought partner, available 24/7", included: true },
  { label: "Full conversation history & archive", included: true },
  { label: "Founder resources & community library", included: true },
  { label: "Early access to new features", included: true },
  { label: "Cancel anytime. No contracts, no penalties.", included: true },
]

const COMPARE = [
  { label: "Networking events", cost: "$50–200/event", value: "One night of small talk" },
  { label: "Online masterminds", cost: "$500–2,000/mo", value: "A Slack group and a Zoom call" },
  { label: "Executive coaching", cost: "$500–1,000/session", value: "One person's perspective" },
  { label: "SoftLaunch", cost: "$29/month", value: "The exact people you've been looking for", highlight: true },
]

export default function PricingPage() {
  return (
    <main className="flex flex-col min-h-screen pt-20">

      {/* Hero */}
      <section className="py-24 px-5 text-center relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(29,184,150,0.10) 0%, transparent 70%)",
          }}
        />
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary mb-4">
            Pricing
          </p>
          <h1 className="font-display text-5xl font-bold text-brand-text tracking-tight leading-[1.1] sm:text-6xl mb-5">
            Simple. Honest.{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #1DB896 0%, #7CC455 60%, #EE9F52 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Yours to cancel.
            </span>
          </h1>
          <p className="text-lg text-brand-text-muted max-w-xl mx-auto leading-relaxed">
            One price. Everything included. First week free. Always.
          </p>
        </div>
      </section>

      {/* Pricing card */}
      <section className="px-5 pb-16">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-brand-primary/30 bg-brand-surface overflow-hidden">
            <div
              className="h-1.5 w-full"
              style={{ background: "linear-gradient(90deg, #1DB896 0%, #7CC455 60%, #EE9F52 100%)" }}
            />
            <div className="p-8 sm:p-12">
              <div className="mb-8">
                <div className="inline-flex items-center gap-2 rounded-full bg-brand-primary/10 border border-brand-primary/20 px-3 py-1 text-xs font-medium text-brand-primary mb-3">
                  First week free. Always.
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-6xl font-bold text-brand-text">$29</span>
                  <div className="flex flex-col leading-tight">
                    <span className="text-brand-text-muted text-sm">/month</span>
                    <span className="text-brand-text-subtle text-xs">after free week</span>
                  </div>
                </div>
                <p className="mt-2 text-sm text-brand-text-subtle">
                  Cancel anytime. No questions. No penalty.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-8">
                {FEATURES.map((f) => (
                  <div key={f.label} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-brand-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-brand-text-muted">{f.label}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-brand-border pt-8">
                <WaitlistForm variant="page" />
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-brand-text-subtle">
            Less than one coffee meeting that went nowhere. More meaningful than all of them combined.
          </p>
        </div>
      </section>

      {/* Comparison table */}
      <section className="py-20 px-5 bg-brand-surface/40">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary mb-4">
              Context
            </p>
            <h2 className="font-display text-3xl font-bold text-brand-text tracking-tight sm:text-4xl">
              Put it in perspective.
            </h2>
          </div>

          <div className="rounded-2xl border border-brand-border bg-brand-surface overflow-hidden">
            <div className="grid grid-cols-3 px-5 py-3 bg-brand-bg/50 border-b border-brand-border">
              <p className="text-xs font-semibold text-brand-text-subtle uppercase tracking-wider">Option</p>
              <p className="text-xs font-semibold text-brand-text-subtle uppercase tracking-wider">Cost</p>
              <p className="text-xs font-semibold text-brand-text-subtle uppercase tracking-wider">What you get</p>
            </div>
            {COMPARE.map((row, i) => (
              <div
                key={i}
                className={`grid grid-cols-3 px-5 py-4 gap-3 border-b border-brand-border last:border-0 ${
                  row.highlight ? "bg-brand-primary/5" : ""
                }`}
              >
                <p className={`text-sm font-medium ${row.highlight ? "text-brand-primary" : "text-brand-text-muted"}`}>
                  {row.label}
                </p>
                <p className={`text-sm ${row.highlight ? "text-brand-text font-semibold" : "text-brand-text-subtle"}`}>
                  {row.cost}
                </p>
                <p className={`text-sm leading-snug ${row.highlight ? "text-brand-text-muted" : "text-brand-text-subtle"}`}>
                  {row.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ teaser */}
      <section className="py-20 px-5">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-2xl font-bold text-brand-text mb-3">
            Still have questions?
          </h2>
          <p className="text-brand-text-muted mb-5 text-sm">
            We&apos;ve answered the ones we get asked most.
          </p>
          <Link
            href="/faq"
            className="inline-flex items-center gap-2 text-sm font-medium text-brand-primary hover:text-brand-primary-hover transition-colors"
          >
            Read the FAQ →
          </Link>
        </div>
      </section>

    </main>
  )
}
