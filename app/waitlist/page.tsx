import { WaitlistForm } from "@/components/marketing/WaitlistForm"
import { CheckCircle2, Shield, Users, Zap } from "lucide-react"

const BENEFITS = [
  {
    icon: Users,
    title: "Be a founding member",
    body: "Founding members shape what SoftLaunch becomes. Your feedback is weighted, your voice matters.",
  },
  {
    icon: Zap,
    title: "First access to cohort matching",
    body: "When we open, you're first in. Before the general waitlist, before the public launch.",
  },
  {
    icon: Shield,
    title: "Founding member pricing",
    body: "Lock in $29/month forever. Founding members are never subject to price increases.",
  },
]

const WHAT_HAPPENS_NEXT = [
  "We'll send you a confirmation email within minutes.",
  "Within 48 hours, you'll receive an email from Sunny directly. Not a template.",
  "When we open founding member access, you'll be among the first notified.",
  "You take the Drive Assessment. We match you with your cohort. It begins.",
]

export default function WaitlistPage() {
  return (
    <main className="flex flex-col min-h-screen pt-20">

      {/* Hero */}
      <section className="py-24 px-5 relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(29,184,150,0.10) 0%, transparent 70%)",
          }}
        />

        <div className="mx-auto max-w-5xl grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">

          {/* Left: Copy */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary mb-4">
              Join the waitlist
            </p>
            <h1 className="font-display text-5xl font-bold text-brand-text tracking-tight leading-[1.1] mb-5">
              Your people are out there.
              <br />
              <span
                style={{
                  background: "linear-gradient(135deg, #1DB896 0%, #7CC455 60%, #EE9F52 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Let&apos;s find them.
              </span>
            </h1>
            <p className="text-base text-brand-text-muted leading-relaxed mb-8 max-w-md">
              SoftLaunch is opening to founding members first. Join the waitlist today to get first access, founding member pricing, and a personal note from our founder.
            </p>

            <div className="flex flex-col gap-3">
              {WHAT_HAPPENS_NEXT.map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold text-white"
                    style={{ background: "linear-gradient(135deg, #1DB896, #7CC455)" }}
                  >
                    {i + 1}
                  </div>
                  <p className="text-sm text-brand-text-muted leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Form */}
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-8">
            <h2 className="font-display text-2xl font-bold text-brand-text mb-1">Reserve your spot</h2>
            <p className="text-sm text-brand-text-muted mb-6">First week is always free. No credit card required.</p>
            <WaitlistForm variant="page" />
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 px-5 bg-brand-surface/40">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary mb-4">
              Founding Member Benefits
            </p>
            <h2 className="font-display text-3xl font-bold text-brand-text tracking-tight sm:text-4xl">
              Worth being early for.
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {BENEFITS.map((b) => {
              const Icon = b.icon
              return (
                <div key={b.title} className="rounded-2xl border border-brand-border bg-brand-surface p-6 flex flex-col gap-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #1DB896, #7CC455)" }}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-brand-text mb-1.5">{b.title}</h3>
                    <p className="text-sm text-brand-text-muted leading-relaxed">{b.body}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Reassurance */}
      <section className="py-16 px-5">
        <div className="mx-auto max-w-2xl text-center">
          <div className="flex flex-wrap justify-center gap-6 text-sm text-brand-text-subtle">
            {[
              "Private by design · inclusive by choice",
              "No selling your data. Ever.",
              "First week always free",
              "Cancel anytime",
            ].map((r) => (
              <div key={r} className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-primary flex-shrink-0" />
                <span>{r}</span>
              </div>
            ))}
          </div>

          {/* Direct sign-up path for people ready to start now */}
          <div className="mt-10 pt-10 border-t border-brand-border">
            <p className="text-brand-text-muted text-sm mb-4">
              Already have an invitation or ready to start your assessment?
            </p>
            <a
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-xl border border-brand-primary/40 bg-brand-primary/10 px-5 py-2.5 text-sm font-semibold text-brand-primary hover:bg-brand-primary/20 transition-colors"
            >
              Create your account →
            </a>
          </div>
        </div>
      </section>

    </main>
  )
}
