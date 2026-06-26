import Link from "next/link"
import Image from "next/image"
import { WaitlistForm } from "@/components/marketing/WaitlistForm"
import { FAQAccordion } from "@/components/marketing/FAQAccordion"
import {
  CheckCircle2,
  Shield,
  Users,
  Zap,
  Brain,
  Quote,
} from "lucide-react"

// ─────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────

const STATS = [
  { value: "73%", label: "of ambitious people report feeling isolated in their drive" },
  { value: "61%", label: "say their closest friends don't understand what they're building" },
  { value: "89%", label: "would invest in a community designed specifically for people like them" },
]

const PILLARS = [
  {
    icon: Brain,
    title: "Your Drive Profile",
    body: "A 12-question assessment maps your ambition style, growth edges, and life context. Not a personality type. A living picture of how you actually show up.",
  },
  {
    icon: Users,
    title: "Your Weekly Cohort",
    body: "Every week, a small group of matched people. A shared prompt. Real conversation. No performance, no pressure. Just people who get it.",
  },
  {
    icon: Zap,
    title: "BUZZ, your AI thought partner",
    body: "Between sessions, BUZZ helps you process what's coming up, sharpen your thinking, and prepare for the conversations that matter most.",
  },
]

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Take the Drive Assessment",
    body: "12 questions. 8 minutes. We learn how you think, what you're building, and where you're at. Not a personality quiz. A precision matching tool.",
  },
  {
    step: "02",
    title: "Get placed in your cohort",
    body: "Every week, we build your group from scratch. People whose ambition, values, and life context align with yours. Different industries. Same fire.",
  },
  {
    step: "03",
    title: "Engage with the weekly prompt",
    body: "One question, shared by your whole cohort. You respond. You read theirs. Real conversation starts from there. No icebreakers, no small talk.",
  },
  {
    step: "04",
    title: "Build something real",
    body: "The relationships that come from SoftLaunch don't feel like networking. They feel like finally being understood. And that changes everything.",
  },
]

const IS_THIS_FOR_YOU = [
  "You're building something. A company, a career, a creative practice, a second act. And you take it seriously.",
  "Your ambition is a core part of who you are, not something you apologize for.",
  "You're surrounded by people who love you but don't quite get what you're doing.",
  "You've tried networking events and group chats and Slack communities. And left each one feeling more alone.",
  "You don't need more followers. You need one person who actually gets it.",
]

const PRICING_FEATURES = [
  "Personalized Drive Profile assessment",
  "Weekly matched cohort (new every week)",
  "Structured prompts designed for depth",
  "BUZZ AI thought partner, always on",
  "Access to the full SoftLaunch archive",
  "Cancel anytime. No questions asked.",
]

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <main className="flex flex-col">

      {/* ─── HERO ─────────────────────────────────────────────── */}
      <section className="relative min-h-[92vh] flex flex-col items-center justify-center overflow-hidden px-5 pt-28 pb-20 text-center">
        {/* Ambient glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 20%, rgba(29,184,150,0.12) 0%, transparent 70%)",
          }}
        />

        <div className="mx-auto max-w-3xl flex flex-col items-center gap-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-primary/25 bg-brand-primary/10 px-4 py-1.5 text-xs font-medium text-brand-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-primary animate-pulse" />
            Now accepting founding members
          </div>

          {/* Headline */}
          <h1 className="font-display text-5xl font-bold tracking-tight text-brand-text leading-[1.1] sm:text-6xl md:text-7xl">
            Find the people
            <br />
            <span
              style={{
                background: "linear-gradient(135deg, #1DB896 0%, #7CC455 60%, #EE9F52 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              who get it.
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg text-brand-text-muted max-w-xl leading-relaxed sm:text-xl">
            SoftLaunch matches you with the people who get it. The ones who understand what it costs to build something, and make it worth it.
          </p>

          {/* Form */}
          <div className="w-full max-w-md mt-2">
            <WaitlistForm variant="hero" />
          </div>

          {/* Social proof */}
          <div className="flex items-center gap-2 text-xs text-brand-text-subtle mt-1">
            <div className="flex -space-x-2">
              {["#1DB896", "#7CC455", "#EE9F52", "#1A9E82", "#5EA83A"].map((c, i) => (
                <div
                  key={i}
                  className="w-6 h-6 rounded-full border-2 border-brand-bg"
                  style={{ background: c, opacity: 0.85 }}
                />
              ))}
            </div>
            <span>Joined by 200+ people on the waitlist</span>
          </div>
        </div>
      </section>

      {/* ─── HER WHY (MALLIKA QUOTE) ──────────────────────────── */}
      <section className="py-20 px-5 bg-brand-surface/40">
        <div className="mx-auto max-w-3xl">
          <div className="relative rounded-2xl border border-brand-border bg-brand-surface p-8 sm:p-12">
            <Quote
              className="absolute top-6 left-6 h-8 w-8 opacity-20"
              style={{ color: "#1DB896" }}
            />
            <blockquote className="pt-4">
              <p className="text-xl font-medium text-brand-text leading-relaxed sm:text-2xl">
                &ldquo;I have a great team. I have a supportive partner. I have friends who cheer me on. And still, there are days when I feel like no one in my life truly understands what I&apos;m doing or why it matters so much to me. That loneliness is the thing I wish someone would solve.&rdquo;
              </p>
              <footer className="mt-6 flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #1DB896, #7CC455)" }}
                >
                  S
                </div>
                <div>
                  <p className="text-sm font-semibold text-brand-text">Sophia, 34</p>
                  <p className="text-xs text-brand-text-subtle">Charlotte, NC</p>
                </div>
              </footer>
            </blockquote>
          </div>

          <p className="mt-8 text-center text-base text-brand-text-muted leading-relaxed">
            Sophia is not unusual. She is you. She is most of the people we talk to. And she is exactly who we built SoftLaunch for.
          </p>
        </div>
      </section>

      {/* ─── THE AMBITION TAX ─────────────────────────────────── */}
      <section className="py-24 px-5">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary mb-4">
              The Problem
            </p>
            <h2 className="font-display text-4xl font-bold text-brand-text tracking-tight sm:text-5xl">
              The more ambitious you become,
              <br className="hidden sm:block" /> the more alone you feel.
            </h2>
            <p className="mt-5 text-base text-brand-text-muted max-w-2xl mx-auto leading-relaxed">
              There&apos;s a tax that ambitious people pay that no one talks about. It&apos;s not paid in money. It&apos;s paid in belonging.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-10">
            {STATS.map((s) => (
              <div
                key={s.value}
                className="rounded-2xl border border-brand-border bg-brand-surface p-6 text-center"
              >
                <p
                  className="font-display text-4xl font-bold mb-2"
                  style={{
                    background: "linear-gradient(135deg, #1DB896 0%, #7CC455 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {s.value}
                </p>
                <p className="text-sm text-brand-text-muted leading-snug">{s.label}</p>
              </div>
            ))}
          </div>

          <p className="text-center text-brand-text-muted leading-relaxed max-w-2xl mx-auto">
            You didn&apos;t shrink your ambition. You expanded it. But the world around you stayed the same size. That gap between what you&apos;re building and who you can talk to about it is the Ambition Tax.
          </p>
        </div>
      </section>

      {/* ─── THE FOLLOW-THROUGH GAP ───────────────────────────── */}
      <section className="py-20 px-5 bg-brand-surface/40">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary mb-4">
            Why It Keeps Happening
          </p>
          <h2 className="font-display text-3xl font-bold text-brand-text tracking-tight sm:text-4xl mb-8">
            The Follow-Through Gap
          </h2>
          <div className="space-y-5 text-left max-w-2xl mx-auto">
            <p className="text-base text-brand-text-muted leading-relaxed">
              You&apos;ve tried. Networking events where everyone was performing. Online communities that felt like shouting into a feed. Masterminds with strangers who had nothing in common with you except a Stripe account.
            </p>
            <p className="text-base text-brand-text-muted leading-relaxed">
              The problem wasn&apos;t you. The problem was the design. Most communities are built for volume: more members, more engagement, more noise. None of them are built for you specifically.
            </p>
            <p className="text-base text-brand-text-muted leading-relaxed">
              SoftLaunch is different. We don&apos;t build communities. We build matches. Small, deliberate, meaningful. Designed to actually follow through.
            </p>
          </div>
        </div>
      </section>

      {/* ─── THE SOLUTION ─────────────────────────────────────── */}
      <section className="py-24 px-5">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary mb-4">
              The Solution
            </p>
            <h2 className="font-display text-4xl font-bold text-brand-text tracking-tight sm:text-5xl">
              Built for the version of you
              <br className="hidden sm:block" /> that no one else sees.
            </h2>
            <p className="mt-5 text-base text-brand-text-muted max-w-xl mx-auto leading-relaxed">
              Three things, working together, to give you the belonging you&apos;ve been building without.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {PILLARS.map((p) => {
              const Icon = p.icon
              return (
                <div
                  key={p.title}
                  className="rounded-2xl border border-brand-border bg-brand-surface p-6 flex flex-col gap-4"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #1DB896, #7CC455)" }}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-brand-text mb-2">{p.title}</h3>
                    <p className="text-sm text-brand-text-muted leading-relaxed">{p.body}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─────────────────────────────────────── */}
      <section className="py-24 px-5 bg-brand-surface/40">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary mb-4">
              How It Works
            </p>
            <h2 className="font-display text-4xl font-bold text-brand-text tracking-tight sm:text-5xl">
              Four steps to your people.
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {HOW_IT_WORKS.map((step) => (
              <div
                key={step.step}
                className="rounded-2xl border border-brand-border bg-brand-surface p-6 flex gap-5"
              >
                <span
                  className="font-display text-3xl font-bold flex-shrink-0 leading-none mt-0.5"
                  style={{
                    background: "linear-gradient(135deg, #1DB896 0%, #7CC455 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {step.step}
                </span>
                <div>
                  <h3 className="font-semibold text-brand-text mb-1.5">{step.title}</h3>
                  <p className="text-sm text-brand-text-muted leading-relaxed">{step.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link href="/how-it-works" className="text-sm font-medium text-brand-primary hover:text-brand-primary-hover transition-colors">
              Learn more about how we match →
            </Link>
          </div>
        </div>
      </section>

      {/* ─── SAFETY ───────────────────────────────────────────── */}
      <section className="py-20 px-5">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-8 sm:p-10 flex flex-col sm:flex-row gap-7 items-start">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #1DB896, #7CC455)" }}
            >
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-brand-text mb-3">
                Safe enough to be real.
              </h2>
              <div className="space-y-4 text-sm text-brand-text-muted leading-relaxed">
                <p>
                  Real conversation requires real safety. SoftLaunch is built from the ground up so that what you share inside stays inside, and the people you meet are exactly who they say they are.
                </p>
                <ul className="space-y-2.5 mt-2">
                  {[
                    { title: "Real verification", desc: "Every member is verified before they join. No anonymity, no bots, no bad actors." },
                    { title: "AI-powered message screening", desc: "Harmful or inappropriate content is flagged before it reaches you." },
                    { title: "Choose who you connect with", desc: "You control your connections and can opt out of anyone, at any time." },
                    { title: "Photo and screenshot protection", desc: "Your content stays in SoftLaunch. Not in screenshots or shared threads." },
                    { title: "Location sharing for meetups", desc: "When your cohort wants to meet IRL, our protected sharing keeps you in control." },
                    { title: "Emergency safety features", desc: "Help is one tap away, always." },
                  ].map((item) => (
                    <li key={item.title} className="flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 text-brand-primary flex-shrink-0 mt-0.5" />
                      <span><strong className="text-brand-text font-medium">{item.title}.</strong> {item.desc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── IS THIS FOR YOU ──────────────────────────────────── */}
      <section className="py-20 px-5 bg-brand-surface/40">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary mb-4">
              Is This For You
            </p>
            <h2 className="font-display text-4xl font-bold text-brand-text tracking-tight sm:text-5xl">
              SoftLaunch is for you if&hellip;
            </h2>
          </div>

          <div className="space-y-3">
            {IS_THIS_FOR_YOU.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-4 rounded-xl border border-brand-border bg-brand-surface px-5 py-4"
              >
                <CheckCircle2 className="w-5 h-5 text-brand-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-brand-text-muted leading-relaxed">{item}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-brand-border/50 bg-brand-bg px-5 py-4 text-center">
            <p className="text-sm text-brand-text-subtle">
              If you read this list and felt seen, you&apos;re exactly who we built this for.
            </p>
          </div>
        </div>
      </section>

      {/* ─── FOUNDER STORY ────────────────────────────────────── */}
      <section className="py-24 px-5">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary mb-4">
              Our Story
            </p>
            <h2 className="font-display text-4xl font-bold text-brand-text tracking-tight sm:text-5xl">
              Built by people who needed it.
            </h2>
          </div>

          {/* Story excerpt */}
          <div className="max-w-2xl mx-auto text-center mb-14">
            <div className="space-y-4 text-base text-brand-text-muted leading-relaxed">
              <p>
                Mallika was running a company, surrounded by people who supported her, and completely alone in what she was doing. Alex had spent a decade scaling teams and watching brilliant people disappear from the rooms that mattered. They met, compared notes, and realised they were describing the same problem from opposite ends.
              </p>
              <p>
                SoftLaunch is what they built instead of accepting that loneliness as the cost of ambition. A way to find the people who think like you, burn like you, and build like you. Without having to perform for them first.
              </p>
              <p className="text-brand-text font-medium">
                We hope it finds you.
              </p>
            </div>
          </div>

          {/* Team grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-10">
            {[
              { name: "Mallika Choudhary", title: "CEO & Co-Founder", image: "/team/mallika.png" },
              { name: "Alex Van Poole",    title: "COO & Co-Founder", image: "/team/alex.png"    },
              { name: "Sana Ullah",        title: "CTO & Co-Founder", image: "/team/sana.png"    },
            ].map((member) => (
              <div key={member.name} className="flex flex-col items-center gap-3 text-center">
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden shadow-md ring-1 ring-brand-border">
                  <Image
                    src={member.image}
                    alt={member.name}
                    fill
                    className="object-cover object-top"
                    sizes="80px"
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold text-brand-text">{member.name}</p>
                  <p className="text-xs text-brand-primary font-medium mt-0.5">{member.title}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link href="/story" className="text-sm font-medium text-brand-primary hover:text-brand-primary-hover transition-colors">
              Read the full story →
            </Link>
          </div>
        </div>
      </section>

      {/* ─── PRICING ──────────────────────────────────────────── */}
      <section className="py-24 px-5 bg-brand-surface/40">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary mb-4">
              Pricing
            </p>
            <h2 className="font-display text-4xl font-bold text-brand-text tracking-tight sm:text-5xl">
              Simple. Honest. Yours to cancel.
            </h2>
          </div>

          <div className="rounded-2xl border border-brand-primary/30 bg-brand-surface overflow-hidden">
            <div
              className="h-1.5 w-full"
              style={{ background: "linear-gradient(90deg, #1DB896 0%, #7CC455 60%, #EE9F52 100%)" }}
            />
            <div className="p-8 sm:p-10">
              <div className="mb-8">
                <div className="inline-flex items-center gap-2 rounded-full bg-brand-primary/10 border border-brand-primary/20 px-3 py-1 text-xs font-medium text-brand-primary mb-3">
                  First week free. Always.
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-display text-5xl font-bold text-brand-text">$29</span>
                  <span className="text-brand-text-muted">/month</span>
                </div>
                <p className="mt-1.5 text-sm text-brand-text-subtle">
                  Cancel anytime. No contracts. No questions.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 mb-8">
                {PRICING_FEATURES.map((f) => (
                  <div key={f} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-brand-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-brand-text-muted">{f}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-brand-border pt-7">
                <WaitlistForm variant="section" />
              </div>
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-brand-text-subtle">
            Less than one coffee meeting that went nowhere. More meaningful than all of them combined.
          </p>
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────────────────────── */}
      <section className="py-24 px-5">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary mb-4">
              FAQ
            </p>
            <h2 className="font-display text-4xl font-bold text-brand-text tracking-tight sm:text-5xl">
              Questions worth asking.
            </h2>
          </div>

          <FAQAccordion />

          <div className="mt-8 text-center">
            <Link href="/faq" className="text-sm font-medium text-brand-primary hover:text-brand-primary-hover transition-colors">
              See all FAQs →
            </Link>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ────────────────────────────────────────── */}
      <section className="py-28 px-5 relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 50% 50%, rgba(29,184,150,0.10) 0%, transparent 70%)",
          }}
        />

        <div className="mx-auto max-w-2xl flex flex-col items-center text-center gap-7">
          <Image
            src="/logo.png"
            alt="SoftLaunch"
            width={44}
            height={40}
            className="object-contain"
          />

          <h2 className="font-display text-4xl font-bold text-brand-text tracking-tight leading-[1.1] sm:text-5xl">
            Your people are out there.{" "}
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
          </h2>

          <p className="text-base text-brand-text-muted leading-relaxed max-w-lg">
            Join the waitlist. We&apos;re opening to founding members first. A small group of people who will shape what SoftLaunch becomes.
          </p>

          <WaitlistForm variant="section" />

          <p className="text-xs text-brand-text-subtle">
            Private by design · Inclusive by choice · First week always free
          </p>
        </div>
      </section>

      {/* ─── FOOTER ───────────────────────────────────────────── */}
      <footer className="border-t border-brand-border py-10 px-5">
        <div className="mx-auto max-w-6xl flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="SoftLaunch"
              width={28}
              height={25}
              className="object-contain"
            />
            <span className="font-semibold text-sm text-brand-text">SoftLaunch</span>
          </div>

          <nav className="flex flex-wrap justify-center gap-5">
            {[
              { href: "/how-it-works", label: "How it works" },
              { href: "/story", label: "Our story" },
              { href: "/pricing", label: "Pricing" },
              { href: "/faq", label: "FAQ" },
              { href: "/waitlist", label: "Join waitlist" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-xs text-brand-text-subtle hover:text-brand-text-muted transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <p className="text-xs text-brand-text-subtle">
            &copy; {new Date().getFullYear()} SoftLaunch. All rights reserved.
          </p>
        </div>
      </footer>

    </main>
  )
}
