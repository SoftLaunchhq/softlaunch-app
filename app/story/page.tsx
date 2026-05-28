import Image from "next/image"
import Link from "next/link"
import { WaitlistForm } from "@/components/marketing/WaitlistForm"

const TEAM = [
  {
    name:  "Mallika Choudhary",
    title: "CEO & Co-Founder",
    image: "/team/mallika.png",
    bio:   "\"I want to make my parents proud and give back for everything they sacrificed. And prove that being called 'too much' was exactly what it takes.\"",
  },
  {
    name:  "Alex Van Poole",
    title: "COO & Co-Founder",
    image: "/team/alex.png",
    bio:   "\"I started my first business with $40. I refuse to let my family struggle the way I did. And I believe the highest-leverage thing you can do for a driven person is put them in the same room as the right people.\"",
  },
  {
    name:  "Sana Ullah",
    title: "CTO & Co-Founder",
    image: "/team/sana.png",
    bio:   "Sana built SoftLaunch end-to-end — the matching engine, the AI, the infrastructure. He's obsessed with the intersection of psychology and product, and with the question of what it really takes to match people in a way that lasts.",
  },
]

const TIMELINE = [
  {
    year:  "2019",
    title: "The thing we couldn't say out loud",
    body:  "Mallika was running a company. By every external measure, things were going well. And she was the loneliest she'd ever been.\n\nNot lonely for company. She had a team, a partner, friends who loved her. Lonely in a specific, painful way — the loneliness of being the only person in the room who understood what was at stake. The only person who knew what she'd given up to be there.",
  },
  {
    year:  "2020",
    title: "We looked for the answer everywhere",
    body:  "We tried everything. Networking events where everyone was performing. Online communities that felt like shouting into a feed. A mastermind that cost $15,000 and gave us twelve strangers with Stripe accounts and nothing else in common.\n\nEvery time we walked away from one of these things, we felt worse. Like maybe the problem was us. Like maybe we were asking for something that didn't exist.",
  },
  {
    year:  "2021",
    title: "We stopped looking and started building",
    body:  "We spent a year talking to people like us. Founders, executives, creatives, researchers — people who were building things that mattered and feeling the cost of it. The loneliness came up in every single conversation. Every one.\n\nWe started asking: what would it actually take to fix this? Not a group chat. Not a conference. Something that actually matched people — the way a great introduction works, but at scale, and built for this specific kind of loneliness.",
  },
  {
    year:  "2022",
    title: "The first version",
    body:  "We ran our first cohorts manually. Twelve people, matched by hand, given a single prompt. The conversations that happened in those first weeks were unlike anything we'd seen in a community context before.\n\nPeople who had never met each other were saying things like: 'I've never told anyone this before, but…' By week three, they were texting each other. By month two, two of them had started a project together.",
  },
  {
    year:  "Now",
    title: "What we're building",
    body:  "SoftLaunch is the thing we needed and couldn't find. A system for finding the people who get it — without having to perform for them first, without having to explain yourself from scratch, without having to settle for surface-level connection.\n\nWe're in early access. We're opening to founding members first. If you're reading this, you're exactly who we built this for.",
  },
]

export default function StoryPage() {
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
            Our Story
          </p>
          <h1 className="font-display text-5xl font-bold text-brand-text tracking-tight leading-[1.1] sm:text-6xl mb-5">
            Built by people
            <br />
            <span
              style={{
                background: "linear-gradient(135deg, #1DB896 0%, #7CC455 60%, #EE9F52 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              who needed it.
            </span>
          </h1>
          <p className="text-lg text-brand-text-muted max-w-xl mx-auto leading-relaxed">
            This is not a company founded on market research. It&apos;s a company founded on a feeling — and years of refusing to accept that the feeling was unfixable.
          </p>
        </div>
      </section>

      {/* Timeline */}
      <section className="px-5 pb-24">
        <div className="mx-auto max-w-2xl">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[22px] top-0 bottom-0 w-px bg-brand-border hidden sm:block" />

            <div className="flex flex-col gap-12">
              {TIMELINE.map((item) => (
                <div key={item.year} className="flex gap-6">
                  {/* Year bubble */}
                  <div className="flex-shrink-0 w-11 h-11 rounded-full border border-brand-primary/30 bg-brand-surface flex items-center justify-center hidden sm:flex z-10">
                    <span className="text-[10px] font-bold text-brand-primary leading-none text-center">
                      {item.year}
                    </span>
                  </div>

                  <div className="flex-1 pt-1">
                    <p className="text-xs font-semibold text-brand-primary mb-1 sm:hidden">{item.year}</p>
                    <h2 className="font-display text-xl font-bold text-brand-text mb-3">{item.title}</h2>
                    <div className="space-y-3">
                      {item.body.split("\n\n").map((para, j) => (
                        <p key={j} className="text-sm text-brand-text-muted leading-relaxed">{para}</p>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-24 px-5 bg-brand-surface/40">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary mb-4">
              The Team
            </p>
            <h2 className="font-display text-3xl font-bold text-brand-text tracking-tight sm:text-4xl">
              The people behind SoftLaunch.
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {TEAM.map((member) => (
              <div
                key={member.name}
                className="flex flex-col items-center text-center rounded-2xl border border-brand-border bg-brand-surface p-6 gap-5"
              >
                <div className="relative w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 shadow-md">
                  <Image
                    src={member.image}
                    alt={member.name}
                    fill
                    className="object-cover object-top"
                    sizes="96px"
                  />
                </div>
                <div>
                  <p className="font-semibold text-brand-text text-base">{member.name}</p>
                  <p className="text-xs text-brand-primary font-medium mt-0.5 mb-3">{member.title}</p>
                  <p className="text-sm text-brand-text-muted leading-relaxed">{member.bio}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 px-5">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary mb-4">
            What We Believe
          </p>
          <h2 className="font-display text-3xl font-bold text-brand-text tracking-tight sm:text-4xl mb-8">
            The principles we build from.
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-left">
            {[
              {
                title: "Belonging is not a luxury",
                body: "It's a prerequisite for building anything that lasts. We refuse to treat community as a nice-to-have.",
              },
              {
                title: "Depth over volume",
                body: "One real connection is worth more than a thousand followers. We optimize for the former.",
              },
              {
                title: "Privacy is non-negotiable",
                body: "Your data is yours. Your conversations stay inside SoftLaunch. No exceptions, no asterisks.",
              },
              {
                title: "Safety is a design requirement",
                body: "Not an afterthought — every feature is built so you can show up fully, without performing or protecting yourself.",
              },
            ].map((v) => (
              <div key={v.title} className="rounded-xl border border-brand-border bg-brand-surface p-5">
                <h3 className="font-semibold text-brand-text mb-2">{v.title}</h3>
                <p className="text-sm text-brand-text-muted leading-relaxed">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-5">
        <div className="mx-auto max-w-2xl text-center flex flex-col items-center gap-6">
          <h2 className="font-display text-4xl font-bold text-brand-text tracking-tight">
            We hope it finds you.
          </h2>
          <p className="text-brand-text-muted max-w-md mx-auto">
            — Mallika, Alex & Sana
          </p>
          <WaitlistForm variant="section" />
        </div>
      </section>

    </main>
  )
}
