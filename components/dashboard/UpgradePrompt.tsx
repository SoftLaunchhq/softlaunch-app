"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { ArrowRight, Loader2, Lock, Zap } from "lucide-react"

interface Props {
  cohortId: string
}

export function UpgradePrompt({ cohortId }: Props) {
  const [loading, setLoading] = useState(false)

  const handleUpgrade = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cohortId }),
      })

      const { url } = await res.json()
      if (url) window.location.href = url
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-2xl overflow-hidden border border-brand-primary/30"
    >
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/10 via-brand-primary/5 to-brand-accent/10" />
      <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 rounded-full blur-[80px]" />

      <div className="relative p-8 md:p-10">
        {/* Lock icon */}
        <div className="w-12 h-12 rounded-xl bg-brand-primary/15 border border-brand-primary/20 flex items-center justify-center mb-6">
          <Lock className="w-5 h-5 text-brand-primary" />
        </div>

        <h3 className="font-display text-2xl md:text-3xl font-bold text-brand-text mb-3">
          Week 1 complete. Keep going?
        </h3>

        <p className="text-brand-text-muted leading-relaxed mb-6 max-w-md">
          If you felt the chemistry, Weeks 2–4 are where real friendship happens.
          Accountability, shared goals, and peer relationships that actually stick.
        </p>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-brand-primary text-white font-semibold hover:bg-brand-primary-hover transition-all duration-150 hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] active:scale-[0.97] disabled:opacity-70"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Redirecting...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Unlock Weeks 2–4
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>

          <div className="text-sm text-brand-text-muted">
            <span className="text-brand-text font-semibold">$30–50/month</span>
            {" "}· Cancel anytime
          </div>
        </div>

        <p className="text-xs text-brand-text-subtle mt-4">
          Price is set at checkout. Cancel before Week 5 to avoid renewal.
        </p>
      </div>
    </motion.div>
  )
}
