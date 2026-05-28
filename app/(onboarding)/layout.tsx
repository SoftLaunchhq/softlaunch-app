import Link from "next/link"
import { Zap } from "lucide-react"
import { OnboardingTabs } from "@/components/onboarding/OnboardingTabs"

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-brand-bg">
      <header className="mx-auto mt-4 flex w-[min(1100px,96%)] items-center justify-between rounded-2xl border border-brand-border/70 bg-brand-surface/65 px-6 py-4 backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-gradient flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-brand-text tracking-tight">SoftLaunch</span>
        </Link>
        <div className="text-sm text-brand-text-subtle">
          Need help?{" "}
          <a
            href="mailto:mallika@softlaunchhq.com"
            className="text-brand-primary hover:underline"
          >
            Contact us
          </a>
        </div>
      </header>

      <main className="mx-auto w-[min(1100px,96%)] py-4">
        <OnboardingTabs />
        {children}
      </main>
    </div>
  )
}
