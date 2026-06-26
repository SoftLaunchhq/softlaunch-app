"use client"

import { useState } from "react"
import { ArrowRight, Loader2, CheckCircle2, Lock } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface WaitlistFormProps {
  variant?: "hero" | "section" | "page"
}

export function WaitlistForm({ variant = "hero" }: WaitlistFormProps) {
  const [email, setEmail] = useState("")
  const [city, setCity] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), city: city.trim() }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Something went wrong. Please try again.")
      }

      setDone(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-3 py-2"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary/15 border border-brand-primary/30">
          <CheckCircle2 className="h-6 w-6 text-brand-primary" />
        </div>
        <p className="text-base font-semibold text-brand-text">You&apos;re in.</p>
        <p className="text-sm text-brand-text-muted text-center max-w-xs">
          Check your inbox. We&apos;ll be in touch within 48 hours with next steps.
        </p>
      </motion.div>
    )
  }

  const isPage = variant === "page"

  return (
    <form onSubmit={handleSubmit} className={`flex flex-col gap-3 ${isPage ? "w-full max-w-md" : "w-full max-w-md"}`}>
      <div className={`flex flex-col gap-2.5 ${isPage ? "" : "sm:flex-row"}`}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email"
          className="sl-input flex-1 text-sm"
        />
        {isPage && (
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Your city (optional)"
            className="sl-input text-sm"
          />
        )}
        <button
          type="submit"
          disabled={loading || !email}
          className="sl-button gap-2 px-5 py-3 text-sm whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Join waitlist
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>

      {error && (
        <p className="text-xs text-brand-error">{error}</p>
      )}

      <p className="flex items-center gap-1.5 text-xs text-brand-text-subtle">
        <Lock className="h-3 w-3 flex-shrink-0" />
        No selling your data. Check your inbox after signing up.
      </p>
    </form>
  )
}
