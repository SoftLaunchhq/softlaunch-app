import Link from "next/link"
import { FAQ_PAGE_ITEMS } from "@/lib/faq"
import { WaitlistForm } from "@/components/marketing/WaitlistForm"

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      {/* Navbar space */}
      <div className="pt-20" />

      {/* Header */}
      <section className="py-16 px-5 text-center">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest mb-4 text-brand-primary">
            Support
          </p>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-5 text-brand-text">
            Frequently asked questions
          </h1>
          <p className="text-lg max-w-xl mx-auto leading-relaxed text-brand-text-muted">
            Everything you need to know about SoftLaunch. Can&apos;t find what you&apos;re looking for?{" "}
            <a
              href="mailto:hello@softlaunch.co"
              className="underline underline-offset-2 text-brand-primary hover:text-brand-primary-hover transition-colors"
            >
              Ask us directly.
            </a>
          </p>
        </div>
      </section>

      {/* FAQ 2-column card grid */}
      <section className="px-5 pb-20">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FAQ_PAGE_ITEMS.map((item) => (
              <div
                key={item.q}
                className="rounded-2xl bg-brand-surface border border-brand-border p-6 sm:p-7 sl-panel"
              >
                <h3 className="font-semibold text-base mb-3 leading-snug text-brand-text">
                  {item.q}
                </h3>
                <p className="text-sm leading-relaxed text-brand-text-muted">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Still have a question */}
      <section className="py-16 px-5 bg-brand-surface/40">
        <div className="mx-auto max-w-2xl text-center flex flex-col items-center gap-4">
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-brand-text">
            Still have a question?
          </h2>
          <p className="text-sm max-w-md text-brand-text-muted">
            We actually read every message. Reach out and a real person will respond. Not a bot, not a template.
          </p>
          <a
            href="mailto:hello@softlaunch.co"
            className="sl-button-ghost inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition-colors"
          >
            hello@softlaunch.co
          </a>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-5 bg-brand-bg">
        <div className="mx-auto max-w-2xl text-center flex flex-col items-center gap-6">
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-brand-text">
            Ready to find your people?
          </h2>
          <p className="text-sm text-brand-text-muted">
            Join the waitlist. Founding members get priority matching and lifetime pricing.
          </p>
          <WaitlistForm variant="section" />
        </div>
      </section>

      {/* Minimal footer links */}
      <div className="py-8 px-5 text-center border-t border-brand-border">
        <div className="flex items-center justify-center gap-6 flex-wrap">
          {[
            { href: "/",             label: "Home" },
            { href: "/how-it-works", label: "How it works" },
            { href: "/pricing",      label: "Pricing" },
            { href: "/story",        label: "Our story" },
            { href: "/waitlist",     label: "Join waitlist" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs text-brand-text-subtle hover:text-brand-text-muted transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <p className="mt-4 text-xs text-brand-text-subtle">
          © {new Date().getFullYear()} SoftLaunch. All rights reserved.
        </p>
      </div>
    </div>
  )
}
