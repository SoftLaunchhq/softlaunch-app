"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react"
import { ASSESSMENT_QUESTIONS } from "@/lib/matching"
import { BuzzPanel } from "@/components/buzz/BuzzPanel"

interface Answer {
  questionId: string
  answerKey: string
}

function OptionCard({
  option,
  selected,
  onSelect,
}: {
  option: { key: string; text: string; icon: string }
  selected: boolean
  onSelect: () => void
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.01, y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={`
        w-full text-left px-5 py-4 rounded-xl border transition-all duration-150
        flex items-center gap-4 group
        ${selected
          ? "border-brand-primary bg-brand-primary/10 shadow-[0_0_0_1px_rgba(29,184,150,0.4),0_0_20px_rgba(29,184,150,0.12)]"
          : "border-brand-border bg-brand-surface hover:border-brand-border-light hover:bg-brand-surface/80"
        }
      `}
    >
      <span className={`text-2xl transition-transform duration-150 ${selected ? "scale-110" : "group-hover:scale-105"}`}>
        {option.icon}
      </span>
      <span className={`font-medium text-base transition-colors ${selected ? "text-brand-text" : "text-brand-text-muted"}`}>
        {option.text}
      </span>
      {selected && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="ml-auto w-5 h-5 rounded-full bg-brand-primary flex items-center justify-center flex-shrink-0"
        >
          <svg className="w-3 h-3 text-slate-950" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
      )}
    </motion.button>
  )
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const progress = (current / total) * 100
  return (
    <div className="w-full flex items-center gap-4">
      <div className="flex-1 h-1 bg-brand-border rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg, #1DB896, #7CC455, #EE9F52)" }}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
      <span className="text-sm text-brand-text-subtle whitespace-nowrap">
        {current} / {total}
      </span>
    </div>
  )
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
    transition: { duration: 0.25, ease: "easeIn" as const },
  }),
}

export default function AssessmentPage() {
  const router = useRouter()
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [direction, setDirection] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // BUZZ state
  const [showBuzz, setShowBuzz] = useState(false)
  const [buzzAnswer, setBuzzAnswer] = useState<{
    questionId: string
    questionText: string
    answerKey: string
    answerText: string
  } | null>(null)

  const question = ASSESSMENT_QUESTIONS[currentQuestion]
  const currentAnswer = answers.find((a) => a.questionId === question.id)
  const isAnswered = !!currentAnswer
  const isFirst = currentQuestion === 0
  const isLast = currentQuestion === ASSESSMENT_QUESTIONS.length - 1

  const handleSelect = useCallback(
    (answerKey: string) => {
      setAnswers((prev) => {
        const existing = prev.findIndex((a) => a.questionId === question.id)
        const newAnswer: Answer = { questionId: question.id, answerKey }
        if (existing >= 0) {
          return prev.map((a, i) => (i === existing ? newAnswer : a))
        }
        return [...prev, newAnswer]
      })
    },
    [question.id]
  )

  const advanceToNextOrSubmit = useCallback(async () => {
    if (isLast) {
      setIsSubmitting(true)
      setSubmitError(null)
      try {
        const response = await fetch("/api/assessment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers }),
        })

        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || "Submission failed")
        }

        router.push("/onboarding/reveal")
      } catch (error: any) {
        console.error("Assessment submission error:", error)
        setSubmitError(error.message || "Something went wrong. Please try again.")
        setIsSubmitting(false)
      }
      return
    }

    setShowBuzz(false)
    setDirection(1)
    setCurrentQuestion((prev) => prev + 1)
  }, [isLast, answers, router])

  const handleOptionSelect = useCallback(
    (key: string) => {
      handleSelect(key)

      // Show BUZZ after a short delay (feel intentional, not instant)
      const option = question.options.find((o) => o.key === key)
      if (option) {
        setBuzzAnswer({
          questionId: question.id,
          questionText: question.text,
          answerKey: key,
          answerText: option.text,
        })
        setTimeout(() => setShowBuzz(true), 500)
      }
    },
    [handleSelect, question]
  )

  const handleBack = useCallback(() => {
    if (isFirst) {
      router.push("/onboarding/welcome")
      return
    }
    setShowBuzz(false)
    setBuzzAnswer(null)
    setDirection(-1)
    setCurrentQuestion((prev) => prev - 1)
  }, [isFirst, router])

  // Hide BUZZ when question changes
  useEffect(() => {
    setShowBuzz(false)
    setBuzzAnswer(null)
  }, [currentQuestion])

  return (
    <div className="min-h-[calc(100vh-65px)] flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-10">
          <ProgressBar
            current={currentQuestion + (isAnswered ? 1 : 0)}
            total={ASSESSMENT_QUESTIONS.length}
          />
        </div>

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={question.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="mb-4"
          >
            <div className="text-sm text-brand-text-subtle mb-3">
              Question {currentQuestion + 1} of {ASSESSMENT_QUESTIONS.length}
            </div>

            <h2 className="font-display text-3xl md:text-4xl font-bold text-brand-text leading-tight mb-2">
              {question.text}
            </h2>

            <p className="text-brand-text-subtle text-sm mb-8">{question.subtext}</p>

            <div className="flex flex-col gap-3">
              {question.options.map((option) => (
                <OptionCard
                  key={option.key}
                  option={option}
                  selected={currentAnswer?.answerKey === option.key}
                  onSelect={() => handleOptionSelect(option.key)}
                />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* BUZZ Panel — appears after answer selection */}
        <AnimatePresence>
          {showBuzz && buzzAnswer && (
            <BuzzPanel
              key={`${buzzAnswer.questionId}-${buzzAnswer.answerKey}`}
              answer={buzzAnswer}
              driveProfile={null}
              onContinue={advanceToNextOrSubmit}
              isLastQuestion={isLast}
            />
          )}
        </AnimatePresence>

        {submitError && (
          <div className="mt-4 rounded-xl border border-brand-error/30 bg-brand-error/10 px-4 py-3 text-sm text-brand-error">
            {submitError}
          </div>
        )}

        <div className="flex items-center justify-between mt-6">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-brand-text-muted hover:text-brand-text transition-colors text-sm px-4 py-2 rounded-lg hover:bg-brand-surface"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          {/* Only show the explicit Next/Submit button when BUZZ is not showing
              (when BUZZ is shown, its "Next" button handles progression) */}
          {isLast && isAnswered && !showBuzz && (
            <motion.button
              whileHover={isAnswered ? { scale: 1.02 } : {}}
              whileTap={isAnswered ? { scale: 0.97 } : {}}
              onClick={advanceToNextOrSubmit}
              disabled={!isAnswered || isSubmitting}
              className={`
                flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-150
                ${isAnswered && !isSubmitting
                  ? "bg-brand-primary text-brand-bg hover:bg-brand-primary-hover shadow-[0_0_20px_rgba(29,184,150,0.3)]"
                  : "bg-brand-border text-brand-text-subtle cursor-not-allowed"
                }
              `}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  See my drive profile
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          )}
        </div>

        <p className="text-center text-xs text-brand-text-subtle mt-8">
          No right answers. This helps us understand how you think, not what you've done.
        </p>
      </div>
    </div>
  )
}
