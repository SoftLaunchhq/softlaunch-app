"use client"

import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowRight, Brain, Zap, Users } from "lucide-react"
import Image from "next/image"
import { useEffect } from "react"

const STEPS = [
  {
    icon: Brain,
    label: "Step 1 of 3",
    title: "5-question assessment",
    desc: "We surface what actually drives you. Takes 4 minutes.",
  },
  {
    icon: Zap,
    label: "Step 2 of 3",
    title: "Your drive profile",
    desc: "See your archetype. Meet BUZZ, your AI companion.",
  },
  {
    icon: Users,
    label: "Step 3 of 3",
    title: "Complete your profile",
    desc: "Tell us who you want around you.",
  },
]

export default function WelcomePage() {
  const router = useRouter()

  // Guard: if user already completed onboarding, skip to dashboard
  useEffect(() => {
    fetch("/api/profile")
      .then((res) => {
        if (res.ok) return res.json()
        return null
      })
      .then((data) => {
        if (data?.onboardingComplete === true) {
          router.replace("/dashboard")
        }
      })
      .catch(() => {
        // If the API call fails (DB down, network issue), just stay on the page
      })
  }, [router])

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col items-center justify-center py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        {/* Logo mark */}
        <div className="mb-8 flex justify-center">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative"
          >
            <Image
              src="/logo.png"
              alt="SoftLaunch"
              width={64}
              height={58}
              className="object-contain"
            />
          </motion.div>
        </div>

        {/* Headline */}
        <div className="text-center mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-text-subtle mb-3">
            SoftLaunch Onboarding
          </p>
          <h1 className="font-display text-4xl font-bold text-brand-text leading-tight mb-3">
            Let's find your
            <br />
            <span className="gradient-text">frequency.</span>
          </h1>
          <p className="text-brand-text-muted text-base leading-relaxed max-w-sm mx-auto">
            This takes about 4 minutes. No right answers.
            Just be direct. BUZZ will handle the rest.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-3 mb-8">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.08 }}
              className="flex items-start gap-4 sl-panel p-4"
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-surface-elevated border border-brand-border">
                <step.icon className="h-4 w-4 text-brand-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-text-subtle mb-0.5">
                  {step.label}
                </p>
                <p className="text-sm font-semibold text-brand-text">{step.title}</p>
                <p className="text-xs text-brand-text-muted mt-0.5">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => router.push("/onboarding/assessment")}
          className="sl-button w-full py-3.5 text-base justify-center"
        >
          Start the assessment
          <ArrowRight className="h-4 w-4" />
        </motion.button>

        <p className="text-center text-xs text-brand-text-subtle mt-4">
          Week 1 is always free. No credit card required.
        </p>
      </motion.div>
    </div>
  )
}
