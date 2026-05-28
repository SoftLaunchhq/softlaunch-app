import { SignUp } from "@clerk/nextjs"
import Link from "next/link"
import Image from "next/image"
import { CheckCircle2 } from "lucide-react"

const PERKS = [
  "Week 1 is always free — no card needed",
  "Your Drive Profile assessment takes 8 minutes",
  "Matched with your cohort within 48 hours",
  "BUZZ AI thought partner included",
]

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center px-5 py-16">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(29,184,150,0.09) 0%, transparent 70%)",
        }}
      />

      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">

        {/* Left — copy */}
        <div className="hidden lg:flex flex-col gap-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="SoftLaunch" width={36} height={33} className="object-contain" />
            <span className="font-display text-lg font-bold text-brand-text">SoftLaunch</span>
          </Link>

          <div>
            <h1 className="font-display text-4xl font-bold text-brand-text leading-tight mb-3">
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
            <p className="text-brand-text-muted leading-relaxed">
              Create your account to start the Drive Assessment and get matched with your first cohort.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {PERKS.map((p) => (
              <div key={p} className="flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-brand-primary flex-shrink-0" />
                <span className="text-sm text-brand-text-muted">{p}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right — form */}
        <div className="flex flex-col items-center">
          {/* Mobile logo */}
          <Link href="/" className="flex items-center gap-2.5 mb-6 lg:hidden">
            <Image src="/logo.png" alt="SoftLaunch" width={36} height={33} className="object-contain" />
            <span className="font-display text-lg font-bold text-brand-text">SoftLaunch</span>
          </Link>

          <div className="w-full max-w-sm">
            <div className="text-center mb-5 lg:hidden">
              <h1 className="font-display text-2xl font-bold text-brand-text">Create your account</h1>
              <p className="text-sm text-brand-text-muted mt-1">Week 1 is always free.</p>
            </div>

            <SignUp
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "w-full bg-brand-surface border border-brand-border shadow-none rounded-2xl",
                  headerTitle: "font-display text-brand-text",
                  headerSubtitle: "text-brand-text-muted",
                  formFieldInput:
                    "bg-brand-bg border-brand-border text-brand-text placeholder:text-brand-text-subtle focus:border-brand-primary focus:ring-brand-primary/20 rounded-xl",
                  formButtonPrimary:
                    "bg-brand-primary hover:bg-brand-primary-hover rounded-xl font-medium",
                  footerActionLink: "text-brand-primary hover:text-brand-primary-hover",
                },
              }}
            />

            <p className="mt-5 text-center text-xs text-brand-text-subtle">
              Already have an account?{" "}
              <Link href="/sign-in" className="text-brand-primary hover:underline font-medium">
                Sign in →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
