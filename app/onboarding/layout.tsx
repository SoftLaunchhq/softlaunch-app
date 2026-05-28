import Link from "next/link"
import Image from "next/image"
import { OnboardingTabs } from "@/components/onboarding/OnboardingTabs"

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-bg">
      {/* Top bar */}
      <header className="border-b border-brand-border bg-brand-bg/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="SoftLaunch"
              width={32}
              height={29}
              className="object-contain flex-shrink-0"
            />
            <span className="font-semibold text-brand-text text-sm">SoftLaunch</span>
          </Link>
          <p className="text-xs text-brand-text-subtle hidden sm:block">
            Week 1 is always free
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <OnboardingTabs />
        {children}
      </main>
    </div>
  )
}
