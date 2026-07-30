"use client"

/**
 * DepartureModal
 *
 * Full-screen modal for leaving a cohort.
 * Collects a required reason (10+ chars) and optionally requests a rematch.
 *
 * Props:
 *   cohortId   — target cohort
 *   cohortName — display name
 *   isLocationIssue — pre-fills the "location issue" flag when departure is
 *                     triggered by the Charlotte check flow
 *   onClose    — called when modal is dismissed (no action taken)
 *   onConfirm  — called after successful departure; caller should redirect to /dashboard
 */

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, AlertTriangle, Loader2, LogOut, RefreshCw } from "lucide-react"

interface DepartureModalProps {
  cohortId: string
  cohortName: string
  isLocationIssue?: boolean
  onClose: () => void
  onConfirm: () => void
}

export function DepartureModal({
  cohortId,
  cohortName,
  isLocationIssue = false,
  onClose,
  onConfirm,
}: DepartureModalProps) {
  const [reason, setReason] = useState("")
  const [requestRematch, setRequestRematch] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const MIN_REASON_LENGTH = 10
  const canSubmit = reason.trim().length >= MIN_REASON_LENGTH && !isSubmitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/cohorts/${cohortId}/departure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reason.trim(),
          requestedRematch: requestRematch,
          isLocationIssue,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.")
        return
      }

      onConfirm()
    } catch {
      setError("Request failed — please check your connection and try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        {/* Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          className="relative w-full max-w-md rounded-2xl border border-brand-border bg-brand-bg shadow-2xl"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 w-7 h-7 rounded-lg flex items-center justify-center text-brand-text-subtle hover:text-brand-text hover:bg-brand-surface transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-6">
            {/* Header */}
            <div className="flex items-start gap-3 mb-5">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center">
                <LogOut className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-brand-text">Leave {cohortName}</h2>
                <p className="text-sm text-brand-text-muted mt-0.5">
                  This action cannot be undone. Your membership will be ended immediately.
                </p>
              </div>
            </div>

            {isLocationIssue && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20 px-3.5 py-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-200/90 leading-relaxed">
                  This cohort is built around an in-person Charlotte meetup. If location is the issue,
                  you can request a rematch below — we'll find a group that fits your geography.
                </p>
              </div>
            )}

            {/* Reason */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-brand-text mb-1.5">
                Why are you leaving? <span className="text-rose-400">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Share a brief reason — this helps us improve cohort matching for everyone."
                rows={4}
                className="w-full bg-brand-surface border border-brand-border rounded-xl px-3.5 py-2.5 text-sm text-brand-text placeholder-brand-text-subtle focus:outline-none focus:border-brand-primary/50 resize-none"
              />
              <p className={`text-[11px] mt-1 ${reason.trim().length < MIN_REASON_LENGTH ? "text-brand-text-subtle" : "text-emerald-400"}`}>
                {reason.trim().length}/{MIN_REASON_LENGTH} minimum characters
              </p>
            </div>

            {/* Rematch toggle */}
            <button
              type="button"
              onClick={() => setRequestRematch((r) => !r)}
              className={`
                w-full flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all mb-5
                ${requestRematch
                  ? "border-brand-primary/40 bg-brand-primary/10"
                  : "border-brand-border/60 bg-brand-surface/40 hover:border-brand-border"
                }
              `}
            >
              <div className={`
                flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all
                ${requestRematch ? "border-brand-primary bg-brand-primary" : "border-brand-border/80"}
              `}>
                {requestRematch && <RefreshCw className="w-3 h-3 text-white" />}
              </div>
              <div>
                <p className="text-sm font-medium text-brand-text">Request a rematch</p>
                <p className="text-xs text-brand-text-muted">
                  We'll find you a better-fit cohort — usually within a few days.
                </p>
              </div>
            </button>

            {/* Error */}
            {error && (
              <div className="mb-4 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2">
                <p className="text-xs text-rose-300">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl border border-brand-border text-sm font-medium text-brand-text-muted hover:text-brand-text hover:border-brand-border/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-sm font-semibold text-rose-300 hover:bg-rose-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                {requestRematch ? "Leave & request rematch" : "Leave cohort"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
