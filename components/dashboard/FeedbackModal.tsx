"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Star, Loader2, CheckCircle2 } from "lucide-react"

interface Member {
  user: {
    id: string
    profile: {
      firstName: string
      lastName: string
      photoUrl: string | null
    } | null
  }
}

interface Props {
  cohortId: string
  weekNumber: number
  members: Member[]
  onClose: () => void
}

export function FeedbackModal({ cohortId, weekNumber, members, onClose }: Props) {
  const [sessionRating, setSessionRating] = useState(0)
  const [groupChemistry, setGroupChemistry] = useState(0)
  const [topVibeWith, setTopVibeWith] = useState<string | null>(null)
  const [wouldContinue, setWouldContinue] = useState<boolean | null>(null)
  const [attended, setAttended] = useState<boolean | null>(null)
  const [openResponse, setOpenResponse] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    if (sessionRating === 0 || attended === null) return

    setSubmitting(true)
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohortId,
          weekNumber,
          type: "POST_WEEK",
          sessionRating,
          groupChemistry,
          topVibeWith,
          wouldContinue,
          attendanceConfirmed: attended,
          openResponse: openResponse.trim() || null,
        }),
      })

      if (!res.ok) throw new Error("Feedback submission failed")
      setSubmitted(true)

      // Close after showing success
      setTimeout(onClose, 2000)
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md bg-brand-surface border border-brand-border rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        >
          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 py-8 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-brand-success/15 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-brand-success" />
              </div>
              <div>
                <h3 className="font-semibold text-brand-text text-lg">Thanks for the feedback!</h3>
                <p className="text-brand-text-muted text-sm mt-1">
                  This helps us build better cohorts over time.
                </p>
              </div>
            </motion.div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-brand-text">Week {weekNumber} Check-in</h3>
                  <p className="text-xs text-brand-text-subtle mt-0.5">Takes about 60 seconds</p>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-brand-border flex items-center justify-center hover:bg-brand-border-light transition-colors"
                >
                  <X className="w-4 h-4 text-brand-text-muted" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Attendance */}
                <div>
                  <p className="text-sm font-medium text-brand-text mb-3">
                    Did you meet this week?
                  </p>
                  <div className="flex gap-2">
                    {[
                      { value: true, label: "Yes ✅" },
                      { value: false, label: "No ❌" },
                    ].map((opt) => (
                      <button
                        key={String(opt.value)}
                        onClick={() => setAttended(opt.value)}
                        className={`
                          flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all
                          ${attended === opt.value
                            ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                            : "border-brand-border text-brand-text-muted hover:border-brand-border-light"
                          }
                        `}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Session rating */}
                <div>
                  <p className="text-sm font-medium text-brand-text mb-3">
                    How valuable was this session? (1–5)
                  </p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setSessionRating(star)}
                        className="flex-1 flex items-center justify-center"
                      >
                        <Star
                          className={`w-7 h-7 transition-all ${
                            star <= sessionRating
                              ? "fill-brand-primary text-brand-primary scale-110"
                              : "text-brand-border hover:text-brand-primary/50"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Group chemistry */}
                <div>
                  <p className="text-sm font-medium text-brand-text mb-3">
                    Group chemistry (1–5)
                  </p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setGroupChemistry(star)}
                        className="flex-1 flex items-center justify-center"
                      >
                        <Star
                          className={`w-7 h-7 transition-all ${
                            star <= groupChemistry
                              ? "fill-brand-accent text-brand-accent scale-110"
                              : "text-brand-border hover:text-brand-accent/50"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Top vibe */}
                {members.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-brand-text mb-3">
                      Who did you vibe with most? (optional)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {members.map((m) => {
                        if (!m.user.profile) return null
                        const name = `${m.user.profile.firstName} ${m.user.profile.lastName}`
                        return (
                          <button
                            key={m.user.id}
                            onClick={() =>
                              setTopVibeWith(
                                topVibeWith === m.user.id ? null : m.user.id
                              )
                            }
                            className={`
                              px-3 py-1.5 rounded-full border text-sm transition-all
                              ${topVibeWith === m.user.id
                                ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                                : "border-brand-border text-brand-text-muted hover:border-brand-border-light"
                              }
                            `}
                          >
                            {name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Would continue */}
                <div>
                  <p className="text-sm font-medium text-brand-text mb-3">
                    Want to keep meeting with this group?
                  </p>
                  <div className="flex gap-2">
                    {[
                      { value: true, label: "Yes, definitely" },
                      { value: false, label: "Not sure yet" },
                    ].map((opt) => (
                      <button
                        key={String(opt.value)}
                        onClick={() => setWouldContinue(opt.value)}
                        className={`
                          flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all
                          ${wouldContinue === opt.value
                            ? "border-brand-success bg-brand-success/10 text-brand-success"
                            : "border-brand-border text-brand-text-muted hover:border-brand-border-light"
                          }
                        `}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Open response */}
                <div>
                  <p className="text-sm font-medium text-brand-text mb-2">
                    Anything else? (optional)
                  </p>
                  <textarea
                    value={openResponse}
                    onChange={(e) => setOpenResponse(e.target.value)}
                    placeholder="What made it great, or what could be better?"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-brand-bg border border-brand-border text-brand-text placeholder-brand-text-subtle focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary/50 transition-colors resize-none text-sm"
                  />
                </div>

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={sessionRating === 0 || attended === null || submitting}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:bg-brand-primary-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit feedback"
                  )}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
