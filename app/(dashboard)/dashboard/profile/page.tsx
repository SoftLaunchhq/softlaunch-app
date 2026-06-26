"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { motion, AnimatePresence } from "framer-motion"
import {
  User,
  Linkedin,
  ArrowRight,
  Loader2,
  Check,
  CheckCircle2,
  Pencil,
  X,
} from "lucide-react"
import { CohortTheme } from "@prisma/client"

// ─────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────

const profileSchema = z.object({
  firstName: z.string().min(1, "Required").max(50),
  lastName: z.string().min(1, "Required").max(50),
  headline: z.string().max(80).optional(),
  bio: z.string().max(140).optional(),
  linkedinUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  preferredThemes: z.array(z.nativeEnum(CohortTheme)).min(1, "Select at least one"),
  preferredDays: z.array(z.string()).optional(),
  preferredTime: z.string().optional(),
})

type ProfileFormData = z.infer<typeof profileSchema>

// ─────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────

const THEME_OPTIONS = [
  { value: CohortTheme.FOUNDERS_BUILDERS, emoji: "🔨", label: "Founders & Builders" },
  { value: CohortTheme.CAREER_GROWTH, emoji: "📈", label: "Career Growth" },
  { value: CohortTheme.FITNESS_DISCIPLINE, emoji: "⚡", label: "Fitness & Discipline" },
  { value: CohortTheme.CREATIVE_AMBITION, emoji: "🎨", label: "Creative Ambition" },
  { value: CohortTheme.ACCOUNTABILITY, emoji: "🎯", label: "Accountability" },
]

const DAY_OPTIONS = [
  { value: "monday", label: "Mon" },
  { value: "tuesday", label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday", label: "Thu" },
  { value: "friday", label: "Fri" },
  { value: "saturday", label: "Sat" },
  { value: "sunday", label: "Sun" },
]

const TIME_OPTIONS = [
  { value: "mornings", label: "Mornings" },
  { value: "evenings", label: "Evenings" },
  { value: "weekends", label: "Weekends" },
  { value: "flexible", label: "Flexible" },
]

const inputCls =
  "w-full rounded-xl border border-brand-border bg-brand-surface px-4 py-3 text-brand-text " +
  "placeholder:text-brand-text-subtle focus:border-brand-primary focus:outline-none " +
  "focus:ring-2 focus:ring-brand-primary/20 transition-colors text-sm"

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────

export default function DashboardProfilePage() {
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [selectedThemes, setSelectedThemes] = useState<CohortTheme[]>([])
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [profileData, setProfileData] = useState<Partial<ProfileFormData> | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { preferredThemes: [], preferredDays: [] },
  })

  const bioValue = watch("bio") || ""
  const headlineValue = watch("headline") || ""
  const preferredTime = watch("preferredTime")

  // Load existing profile
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) {
          setProfileData(data)
          reset(data)
          if (data.preferredThemes) setSelectedThemes(data.preferredThemes)
          if (data.preferredDays) setSelectedDays(data.preferredDays)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [reset])

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
      setProfileData({ ...data, preferredDays: selectedDays })
      setSaved(true)
      setIsEditing(false)
      setTimeout(() => setSaved(false), 3000)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Something went wrong."
      setSubmitError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6 py-6 md:py-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-text">My Profile</h1>
          <p className="text-sm text-brand-text-muted mt-0.5">
            This is what your cohort sees about you.
          </p>
        </div>

        {saved && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 rounded-full bg-brand-primary/10 border border-brand-primary/20 px-3 py-1.5 text-xs font-medium text-brand-primary"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Saved
          </motion.div>
        )}
      </div>

      {/* ─── VIEW MODE ─────────────────────────────────────────── */}
      {!isEditing && (
        <div className="sl-panel p-6 space-y-5">
          {/* Identity */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #1DB896, #7CC455)" }}
              >
                {profileData?.firstName?.[0]?.toUpperCase() ?? <User className="w-5 h-5" />}
              </div>
              <div>
                <p className="font-semibold text-brand-text text-base">
                  {profileData?.firstName && profileData?.lastName
                    ? `${profileData.firstName} ${profileData.lastName}`
                    : "—"}
                </p>
                {profileData?.headline && (
                  <p className="text-sm text-brand-text-muted mt-0.5">{profileData.headline}</p>
                )}
                {profileData?.bio && (
                  <p className="text-sm text-brand-text-subtle mt-2 leading-relaxed">{profileData.bio}</p>
                )}
                {profileData?.linkedinUrl && (
                  <a
                    href={profileData.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-brand-primary hover:underline mt-2"
                  >
                    <Linkedin className="w-3 h-3" />
                    LinkedIn
                  </a>
                )}
              </div>
            </div>

            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 rounded-xl border border-brand-border bg-brand-surface px-3 py-2 text-xs font-medium text-brand-text-muted hover:border-brand-primary/30 hover:text-brand-primary transition-all flex-shrink-0"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-brand-border" />

          {/* Themes */}
          <div>
            <p className="text-xs font-semibold text-brand-text-subtle uppercase tracking-wider mb-3">
              Cohort interests
            </p>
            <div className="flex flex-wrap gap-2">
              {profileData?.preferredThemes && profileData.preferredThemes.length > 0 ? (
                profileData.preferredThemes.map((t) => {
                  const opt = THEME_OPTIONS.find((o) => o.value === t)
                  return opt ? (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1.5 rounded-full border border-brand-border bg-brand-surface px-3 py-1 text-xs text-brand-text-muted"
                    >
                      {opt.emoji} {opt.label}
                    </span>
                  ) : null
                })
              ) : (
                <p className="text-sm text-brand-text-subtle">Not set</p>
              )}
            </div>
          </div>

          {/* Availability */}
          {(profileData?.preferredDays?.length || profileData?.preferredTime) && (
            <>
              <div className="border-t border-brand-border" />
              <div>
                <p className="text-xs font-semibold text-brand-text-subtle uppercase tracking-wider mb-3">
                  Availability
                </p>
                <div className="flex flex-wrap gap-2">
                  {profileData?.preferredDays?.map((d) => {
                    const opt = DAY_OPTIONS.find((o) => o.value === d)
                    return opt ? (
                      <span
                        key={d}
                        className="rounded-lg border border-brand-border bg-brand-surface px-3 py-1 text-xs text-brand-text-muted"
                      >
                        {opt.label}
                      </span>
                    ) : null
                  })}
                  {profileData?.preferredTime && (
                    <span className="rounded-lg border border-brand-accent/30 bg-brand-accent/10 px-3 py-1 text-xs text-brand-accent">
                      {TIME_OPTIONS.find((t) => t.value === profileData.preferredTime)?.label ?? profileData.preferredTime}
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── EDIT MODE ─────────────────────────────────────────── */}
      {isEditing && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="sl-panel p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-brand-text">Edit profile</h2>
            <button
              onClick={() => { setIsEditing(false); setSubmitError(null) }}
              className="text-brand-text-muted hover:text-brand-text transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Name */}
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

            {/* Headline */}
            <div>
              <input
                {...register("headline")}
                placeholder='Headline, e.g. "Founder building in Charlotte"'
                className={inputCls}
              />
              <p className={`mt-1 text-right text-xs ${headlineValue.length > 70 ? "text-brand-warning" : "text-brand-text-subtle"}`}>
                {headlineValue.length}/80
              </p>
            </div>

            {/* Bio */}
            <div>
              <textarea
                {...register("bio")}
                placeholder="Short bio: what are you working on? (optional)"
                rows={3}
                className={`${inputCls} resize-none`}
              />
              <p className={`mt-1 text-right text-xs ${bioValue.length > 120 ? "text-brand-warning" : "text-brand-text-subtle"}`}>
                {bioValue.length}/140
              </p>
            </div>

            {/* LinkedIn */}
            <input
              {...register("linkedinUrl")}
              placeholder="LinkedIn URL (optional)"
              className={inputCls}
            />
            {errors.linkedinUrl && (
              <p className="text-xs text-brand-error">{errors.linkedinUrl.message}</p>
            )}

            {/* Divider */}
            <div className="border-t border-brand-border pt-2">
              <p className="text-xs font-semibold text-brand-text-subtle uppercase tracking-wider mb-3">
                Cohort interests
              </p>
              <div className="space-y-2">
                {THEME_OPTIONS.map((theme) => {
                  const selected = selectedThemes.includes(theme.value)
                  return (
                    <button
                      key={theme.value}
                      type="button"
                      onClick={() => toggleTheme(theme.value)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                        selected
                          ? "border-brand-primary/40 bg-brand-primary/10 text-brand-text"
                          : "border-brand-border bg-brand-surface text-brand-text-muted hover:border-brand-border-light"
                      }`}
                    >
                      <span>{theme.emoji}</span>
                      <span className="flex-1 text-sm">{theme.label}</span>
                      {selected && <Check className="w-4 h-4 text-brand-primary flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>
              {errors.preferredThemes && (
                <p className="mt-1 text-xs text-brand-error">{errors.preferredThemes.message}</p>
              )}
            </div>

            {/* Availability */}
            <div className="border-t border-brand-border pt-2 space-y-4">
              <div>
                <p className="text-xs font-semibold text-brand-text-subtle uppercase tracking-wider mb-3">
                  Preferred days
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
                <p className="text-xs font-semibold text-brand-text-subtle uppercase tracking-wider mb-3">
                  Preferred time
                </p>
                <div className="flex flex-wrap gap-2">
                  {TIME_OPTIONS.map((t) => {
                    const sel = preferredTime === t.value
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
            </div>

            {submitError && (
              <div className="rounded-xl border border-brand-error/30 bg-brand-error/10 px-4 py-3 text-sm text-brand-error">
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="sl-button w-full justify-center py-3 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  Save changes
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </motion.div>
      )}
    </div>
  )
}
