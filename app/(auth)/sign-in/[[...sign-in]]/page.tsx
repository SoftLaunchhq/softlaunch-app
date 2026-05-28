import { SignIn } from "@clerk/nextjs"
import Link from "next/link"
import Image from "next/image"

export default function SignInPage() {
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

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 mb-8">
        <Image src="/logo.png" alt="SoftLaunch" width={36} height={33} className="object-contain" />
        <span className="font-display text-lg font-bold text-brand-text">SoftLaunch</span>
      </Link>

      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="font-display text-2xl font-bold text-brand-text">Welcome back</h1>
          <p className="text-sm text-brand-text-muted mt-1">
            Sign in to your member account
          </p>
        </div>

        <SignIn
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
              identityPreviewText: "text-brand-text",
              identityPreviewEditButton: "text-brand-primary",
            },
          }}
        />

        <p className="mt-5 text-center text-xs text-brand-text-subtle">
          New here?{" "}
          <Link href="/sign-up" className="text-brand-primary hover:underline font-medium">
            Create your account →
          </Link>
        </p>
      </div>
    </div>
  )
}
