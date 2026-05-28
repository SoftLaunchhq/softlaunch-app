"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { motion } from "framer-motion"
import { ArrowRight, Loader2, Check } from "lucide-react"
import { CohortTheme } from "@prisma/client"

const profileSchema = z.object({
  firstName:       z.string().min(1, "Required").max(50),
  lastName:        z.string().min(1, "Required").max(50),
  headline:        z.string().max(80).optional(),
  bio:             z.string().max(140).optional(),
  linkedinUrl:     z.string().url("Must be a valid URL").optional().or(z.literal("")),
  preferredThemes: z.array(z.nativeEnum(CohortTheme)).min(1, "Select at least one"),
  preferredDays:   z.array(z.string()).optional(),
  preferredTime:   z.string().optional(),
})

type ProfileFormData = z.infer<typeof profileSchema>

const THEME_OPTIONS = [
  { value: CohortTheme.FOUNDERS_BUILDERS,  emoji: "🔨", label: "Founders & Builders" },
  { value: CohortTheme.CAREER_GROWTH,      emoji: "📈", label: "Career Growth" },
  { value: CohortTheme.FITNESS_DISCIPLINE, emoji: "⚡", label: "Fitness & Discipline" },
  { value: CohortTheme.CREATIVE_AMBITION,  emoji: "🎨", label: "Creative Ambition" },
  { value: CohortTheme.ACCOUNTABILITY,     emoji: "🎯", label: "Accountability" },
]

const DAY_OPTIONS = [
  { value: "monday",    label: "Mon" },
  { value: "tuesday",   label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday",  label: "Thu" },
  { value: "friday",    label: "Fri" },
  { value: "saturday",  label: "Sat" },
  { value: "sunday",    label: "Sun" },
]

const TIME_OPTIONS = [
  { value: "mornings",  label: "Mornings" },
  { value: "evenings",  label: "Evenings" },
  { value: "weekends",  label: "Weekends" },
  { value: "flexible",  label: "Flexible" },
]

type Section = "identity" | "themes" | "availability"

export default function ProfilePage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting]   = useState(false)
  const [submitError, setSubmitError]     = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<Section>("identity")
  const [selectedThemes, setSelectedThemes] = useState<CohortTheme[]>([])
  const [selectedDays, setSelectedDays]   = useState<string[]>([])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { preferredThemes: [], preferredDays: [] },
  })

  const bioValue      = watch("bio") || ""
  const headlineValue = watch("headline") || ""

  const toggleTheme = (t: CohortTheme) => {
    const next = selectedThemes.includes(t)
      ? selectedThemes.filter((x) => x !== t)
      : [...selectedThemes, t]
    setSelectedThemes(next)
    setValue("preferredThemes", next, { shouldValidate: true })
  }

  const toggleDay = (d: string) => {
    const next = selectedDays.includes(d)
      ? selectedDays.filter((x) => x !== d)
      : [...selectedDays, d]
    setSelectedDays(next)
    setValue("preferredDays", next)
  }

  const onSubmit = async (data: ProfileFormData) => {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, preferredDays: selectedDays }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Profile save failed")
      }
      router.push("/dashboard")
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Something went wrong."
      setSubmitError(msg)
      setIsSubmitting(false)
    }
  }

  const inputCls =
    "w-full rounded-xl border border-brand-border bg-brand-surface-elevated px-4 py-3 text-brand-text " +
    "placeholder:text-brand-text-subtle focus:border-brand-primary focus:outline-none " +
    "focus:ring-2 focus:ring-brand-primary/20 transition-colors"

  const SECTIONS: { key: Section; label: string }[] = [
    { key: "identity",     label: "Identity" },
    { key: "themes",       label: "Themes" },
    { key: "availability", label: "Availability" },
  ]

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col items-center justify-center py-12">
      <div className="w-full max-w-lg">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-text-subtle mb-2">
            Last step
          </p>
          <h1 className="font-display text-4xl font-bold text-brand-text leading-tight">
            Complete your profile.
          </h1>
          <p className="text-brand-text-muted mt-1.5 text-sm">
            Your cohort will see this. Be direct and real.
          </p>
        </motion.div>

        {/* Section tabs */}
        <div className="sl-panel p-1.5 mb-6">
          <div className="grid grid-cols-3 gap-1.5">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setActiveSection(s.key)}
                className={`rounded-xl py-2 text-sm font-medium transition-all ${
                  activeSection === s.key
                    ? "bg-brand-primary/15 border border-brand-primary/30 text-brand-primary"
                    : "text-brand-text-muted hover:text-brand-text"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          {/* IDENTITY */}
          {activeSection === "identity" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input {...register("firstName")} placeholder="First name" className={inputCls} />
                  {errors.firstName && (
                    <p className="mt-1 text-xs text-brand-error">{errors.firstName.message}</p>
                  )}
                </div>
                <div>
                  <input {...register("lastName")} placeholder="Last name" className={inputCls} />
                  {errors.lastName && (
                    <p className="mt-1 text-xs text-brand-error">{errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div>
                <input
                  {...register("headline")}
                  placeholder='Headline — e.g. "Founder building in Charlotte"'
                  className={inputCls}
                />
                <p className={`mt-1 text-right text-xs ${headlineValue.length > 70 ? "text-brand-warning" : "text-brand-text-subtle"}`}>
                  {headlineValue.length}/80
                </p>
              </div>

              <div>
                <textarea
                  {...register("bio")}
                  placeholder="Short bio — what are you working on? (optional)"
                  rows={3}
                  className={`${inputCls} resize-none`}
                />
                <p className={`mt-1 text-right text-xs ${bioValue.length > 120 ? "text-brand-warning" : "text-brand-text-subtle"}`}>
                  {bioValue.length}/140
                </p>
              </div>

              <input
                {...register("linkedinUrl")}
                placeholder="LinkedIn URL (optional)"
                className={inputCls}
              />
              {errors.linkedinUrl && (
                <p className="mt-1 text-xs text-brand-error">{errors.linkedinUrl.message}</p>
              )}
            </motion.div>
          )}

          {/* THEMES */}
          {activeSection === "themes" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <p className="text-xs text-brand-text-subtle">
                What kind of group do you want? Select all that apply.
              </p>
              {THEME_OPTIONS.map((theme) => {
                const selected = selectedThemes.includes(theme.value)
                return (
                  <button
                    key={theme.value}
                    type="button"
                    onClick={() => toggleTheme(theme.value)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all ${
                      selected
                        ? "border-brand-primary/40 bg-brand-primary/10 text-brand-text"
                        : "border-brand-border bg-brand-surface text-brand-text-muted hover:border-brand-border-light"
                    }`}
                  >
                    <span className="text-xl">{theme.emoji}</span>
                    <span className="flex-1 text-sm font-medium">{theme.label}</span>
                    {selected && (
                      <div className="h-5 w-5 rounded-full bg-brand-primary flex items-center justify-center flex-shrink-0">
                        <Check className="h-3 w-3 text-brand-bg" />
                      </div>
                    )}
                  </button>
                )
              })}
              {errors.preferredThemes && (
                <p className="text-xs text-brand-error">{errors.preferredThemes.message}</p>
              )}
            </motion.div>
          )}

          {/* AVAILABILITY */}
          {activeSection === "availability" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div>
                <p className="text-sm font-medium text-brand-text mb-3">
                  When are you generally free?
                </p>
                <div className="flex flex-wrap gap-2">
                  {DAY_OPTIONS.map((day) => {
                    const sel = selectedDays.includes(day.value)
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                          sel
                            ? "border-brand-primary/40 bg-brand-primary/10 text-brand-primary"
                            : "border-brand-border bg-brand-surface text-brand-text-muted hover:border-brand-border-light"
                        }`}
                      >
                        {day.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-brand-text mb-3">Preferred time</p>
                <div className="flex flex-wrap gap-2">
                  {TIME_OPTIONS.map((t) => {
                    const sel = watch("preferredTime") === t.value
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setValue("preferredTime", t.value)}
                        className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                          sel
                            ? "border-brand-accent/40 bg-brand-accent/10 text-brand-accent"
                            : "border-brand-border bg-brand-surface text-brand-text-muted hover:border-brand-border-light"
                        }`}
                      >
                        {t.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* Error */}
          {submitError && (
            <div className="rounded-xl border border-brand-error/30 bg-brand-error/10 px-4 py-3 text-sm text-brand-error">
              {submitError}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="sl-button w-full justify-center py-3.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                I&apos;m ready to meet my people
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          <p className="text-center text-xs text-brand-text-subtle">
            We review every cohort personally. You'll hear from us within 7 days.
          </p>
        </form>
      </div>
    </div>
  )
}
