import Link from "next/link"
import { WaitlistForm } from "@/components/marketing/WaitlistForm"
import { Brain, Users, Zap, ArrowRight, CheckCircle2, BarChart2, Sparkles } from "lucide-react"

const STEPS = [
  {
    step: "01",
    icon: Brain,
    title: "Take the Drive Assessment",
    subtitle: "12 questions. 8 minutes. A picture that actually captures you.",
    body: [
      "We ask about how you show up when things are hard. What you're building and why it matters. Where you feel most alive — and where you feel most stuck.",
      "The Drive Assessment is not a personality quiz. It's a precision matching tool. Every answer shapes the five-dimensional Drive Profile we use to find your people.",
      "Dimensions: Ambition Intensity · Community Orientation · Discipline Style · Openness to Growth · Life Context",
    ],
  },
  {
    step: "02",
    icon: Users,
    title: "Get placed in your weekly cohort",
    subtitle: "Every week, a new group. Built specifically for you.",
    body: [
      "Our matching algorithm doesn't look for people who are like you on the surface. It looks for people who are like you underneath — in how they think, what they value, and where they're going.",
      "Cohorts are intentionally small (6–10 people) and intentionally diverse in industry. We've found that the richest conversations happen between people who share drive but not domain.",
      "Your cohort resets every week. That's a feature, not a bug — it means you're constantly expanding your circle while going deep with the right people at the right time.",
    ],
  },
  {
    step: "03",
    icon: Sparkles,
    title: "Engage with the weekly prompt",
    subtitle: "One question. Real answers. No performance required.",
    body: [
      "Every week, your cohort receives a shared prompt — a question designed to spark the kind of conversation you can't have anywhere else.",
      "The prompts are built for depth. Not \"what are you working on?\" — but \"what are you avoiding that you know you need to face?\" Not surface. Signal.",
      "You respond in your own time. You read your cohort's responses. Real conversation starts from there — not from icebreakers or forced intros, but from something worth talking about.",
    ],
  },
  {
    step: "04",
    icon: Zap,
    title: "Build, with BUZZ beside you",
    subtitle: "An AI thought partner who actually knows you.",
    body: [
      "Between weekly prompts, BUZZ is available whenever you need to think out loud. BUZZ knows your Drive Profile, your history, and your current context.",
      "Use BUZZ to process a hard decision, prepare for a difficult conversation, or just think through something you're not ready to share with your cohort yet.",
      "BUZZ does not give generic advice. BUZZ responds to you — specifically, contextually, and with the kind of directness you'd want from a smart friend.",
    ],
  },
]

const DIFFERENTIATORS = [
  {
    label: "Most communities",
    theirs: "Built for volume — more members, more engagement",
    ours: "Built for depth — 6–10 people, matched precisely",
  },
  {
    label: "Most networking",
    theirs: "Random connections, cold introductions",
    ours: "Algorithmically matched, based on your Drive Profile",
  },
  {
    label: "Most communities",
    theirs: "Static groups that stagnate after week two",
    ours: "Weekly fresh cohorts — always evolving, always relevant",
  },
  {
    label: "Most apps",
    theirs: "Generic AI that doesn't know you",
    ours: "BUZZ — a thought partner built from your profile",
  },
]

export default function HowItWorksPage() {
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
            How It Works
          </p>
          <h1 className="font-display text-5xl font-bold text-brand-text tracking-tight leading-[1.1] sm:text-6xl mb-5">
            Matching, not{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #1DB896 0%, #7CC455 60%, #EE9F52 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              broadcasting.
            </span>
          </h1>
          <p className="text-lg text-brand-text-muted max-w-xl mx-auto leading-relaxed">
            SoftLaunch is not a platform you post on. It&apos;s a system designed to find you the right people at the right time — and make the conversations that follow worth having.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="px-5 pb-24">
        <div className="mx-auto max-w-4xl flex flex-col gap-10">
          {STEPS.map((step, i) => {
            const Icon = step.icon
            const isEven = i % 2 === 1
            return (
              <div
                key={step.step}
                className="rounded-2xl border border-brand-border bg-brand-surface p-8 sm:p-10 flex flex-col sm:flex-row gap-8"
              >
                <div className="flex-shrink-0 flex flex-col items-start gap-3">
                  <span
                    className="font-display text-5xl font-bold leading-none"
                    style={{
                      background: "linear-gradient(135deg, #1DB896 0%, #7CC455 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    {step.step}
                  </span>
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #1DB896, #7CC455)" }}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div>
                  <h2 className="font-display text-2xl font-bold text-brand-text mb-1">{step.title}</h2>
                  <p className="text-sm font-medium text-brand-primary mb-4">{step.subtitle}</p>
                  <div className="space-y-3">
                    {step.body.map((para, j) => (
                      <p key={j} className="text-sm text-brand-text-muted leading-relaxed">{para}</p>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Why we're different */}
      <section className="py-20 px-5 bg-brand-surface/40">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary mb-4">
              Why Different
            </p>
            <h2 className="font-display text-3xl font-bold text-brand-text tracking-tight sm:text-4xl">
              Not another community. A match system.
            </h2>
          </div>

          <div className="rounded-2xl border border-brand-border bg-brand-surface overflow-hidden divide-y divide-brand-border">
            <div className="grid grid-cols-2 px-5 py-3 bg-brand-bg/50">
              <p className="text-xs font-semibold text-brand-text-subtle uppercase tracking-wider">Everyone else</p>
              <p className="text-xs font-semibold text-brand-primary uppercase tracking-wider">SoftLaunch</p>
            </div>
            {DIFFERENTIATORS.map((d, i) => (
              <div key={i} className="grid grid-cols-2 px-5 py-4 gap-4">
                <p className="text-sm text-brand-text-subtle leading-relaxed">{d.theirs}</p>
                <p className="text-sm text-brand-text-muted leading-relaxed">{d.ours}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-5">
        <div className="mx-auto max-w-2xl text-center flex flex-col items-center gap-6">
          <h2 className="font-display text-4xl font-bold text-brand-text tracking-tight">
            Ready to find your people?
          </h2>
          <p className="text-brand-text-muted max-w-md mx-auto">
            Join the waitlist. Your first week is free. No credit card needed.
          </p>
          <WaitlistForm variant="section" />
        </div>
      </section>

    </main>
  )
}
