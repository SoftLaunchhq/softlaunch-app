"use client"

/**
 * AvailabilityPanel
 *
 * Lets members update their availability and favorite meetup location
 * after initial onboarding. Used in the CohortView Availability tab.
 *
 * If cohortId is provided and the meetup is currently in NO_COMMON_TIME,
 * saving will auto-trigger a retry scheduling request.
 */

import { useState, useEffect, useCallback } from "react"
import {
  Clock, MapPin, Globe, CheckCircle2, Loader2, RefreshCw, Save
} from "lucide-react"

// ─── Types ─────────────────────────────────────────────────────

interface AvailabilityData {
  preferredDays:        string[]
  preferredTime:        string | null
  timezone:             string | null
  favoriteLocationType: string | null
  favoriteLocationText: string | null
}

interface AvailabilityPanelProps {
  cohortId?: string
  /** Called after a successful save + optional auto-retry */
  onSaved?: () => void
}

// ─── Constants ─────────────────────────────────────────────────

const DAYS = [
  { value: "monday",    label: "Mon" },
  { value: "tuesday",   label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday",  label: "Thu" },
  { value: "friday",    label: "Fri" },
  { value: "saturday",  label: "Sat" },
  { value: "sunday",    label: "Sun" },
]

const TIME_PREFS = [
  { value: "mornings",  label: "Mornings",  sub: "8am – 12pm" },
  { value: "evenings",  label: "Evenings",  sub: "5pm – 9pm"  },
  { value: "weekends",  label: "Weekends",  sub: "Sat & Sun"  },
  { value: "flexible",  label: "Flexible",  sub: "Any time"   },
]

const LOCATION_TYPES = [
  { value: "coffee",    label: "☕ Coffee shop"       },
  { value: "library",   label: "📚 Library"           },
  { value: "coworking", label: "💼 Coworking space"   },
  { value: "restaurant",label: "🍽️ Restaurant"        },
  { value: "park",      label: "🌳 Park / outdoor"    },
  { value: "campus",    label: "🏫 Campus / college"  },
  { value: "bookstore", label: "📖 Bookstore"         },
  { value: "other",     label: "✨ Other"             },
]

// ─── Component ─────────────────────────────────────────────────

export function AvailabilityPanel({ cohortId, onSaved }: AvailabilityPanelProps) {
  const [data, setData] = useState<AvailabilityData>({
    preferredDays:        [],
    preferredTime:        null,
    timezone:             null,
    favoriteLocationType: null,
    favoriteLocationText: null,
  })
  const [isLoading, setIsLoading]   = useState(true)
  const [isSaving, setIsSaving]     = useState(false)
  const [saved, setSaved]           = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [willRetry, setWillRetry]   = useState(false)

  // ── Load ────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/user/availability", { cache: "no-store" })
      if (!res.ok) return
      const json = await res.json()
      if (json.availability) setData(json.availability)
    } catch {
      // Non-fatal
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Toggle helpers ──────────────────────────────────────────

  const toggleDay = (day: string) => {
    setData((prev) => ({
      ...prev,
      preferredDays: prev.preferredDays.includes(day)
        ? prev.preferredDays.filter((d) => d !== day)
        : [...prev.preferredDays, day],
    }))
  }

  // ── Save ────────────────────────────────────────────────────

  const save = async () => {
    setIsSaving(true)
    setError(null)
    setSaved(false)
    setWillRetry(false)
    try {
      const res = await fetch("/api/user/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, cohortId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "Failed to save — please try again")
        return
      }
      setSaved(true)

      // If shouldRetry is true, the server wants us to trigger a retry
      if (json.shouldRetry && cohortId) {
        setWillRetry(true)
        const retryRes = await fetch(`/api/cohorts/${cohortId}/meetup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "retry" }),
        })
        if (retryRes.ok) {
          onSaved?.()
        }
      } else {
        onSaved?.()
      }

      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError("Network error — please try again")
    } finally {
      setIsSaving(false)
      setWillRetry(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin text-brand-text-subtle" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Available days */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-brand-primary" />
          <h3 className="text-sm font-semibold text-brand-text">Available days</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {DAYS.map(({ value, label }) => {
            const active = data.preferredDays.includes(value)
            return (
              <button
                key={value}
                onClick={() => toggleDay(value)}
                className={`
                  px-3 py-1.5 rounded-lg border text-sm font-medium transition-all
                  ${active
                    ? "bg-brand-primary/20 border-brand-primary/50 text-brand-text"
                    : "bg-brand-surface/50 border-brand-border/60 text-brand-text-muted hover:border-brand-primary/30 hover:text-brand-text"
                  }
                `}
              >
                {label}
              </button>
            )
          })}
        </div>
      </section>

      {/* Preferred time */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-brand-text">Preferred time of day</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TIME_PREFS.map(({ value, label, sub }) => {
            const active = data.preferredTime === value
            return (
              <button
                key={value}
                onClick={() => setData((prev) => ({ ...prev, preferredTime: active ? null : value }))}
                className={`
                  flex flex-col items-start rounded-xl border p-3 text-left transition-all
                  ${active
                    ? "bg-brand-primary/15 border-brand-primary/40 text-brand-text"
                    : "bg-brand-surface/50 border-brand-border/60 text-brand-text-muted hover:border-brand-primary/25 hover:bg-brand-surface/70"
                  }
                `}
              >
                <span className="text-sm font-medium">{label}</span>
                <span className="text-xs text-brand-text-subtle mt-0.5">{sub}</span>
                {active && <CheckCircle2 className="mt-1 h-3 w-3 text-brand-primary" />}
              </button>
            )
          })}
        </div>
      </section>

      {/* Timezone */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-brand-primary" />
          <h3 className="text-sm font-semibold text-brand-text">Your timezone</h3>
        </div>
        <input
          type="text"
          value={data.timezone ?? ""}
          onChange={(e) => setData((prev) => ({ ...prev, timezone: e.target.value || null }))}
          placeholder="e.g. America/New_York, EST, GMT-5"
          className="w-full max-w-sm rounded-lg border border-brand-border/60 bg-brand-surface/60 px-3 py-2 text-sm text-brand-text placeholder-brand-text-subtle focus:border-brand-primary/50 focus:outline-none focus:ring-1 focus:ring-brand-primary/30"
        />
      </section>

      {/* Favorite meetup location */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-brand-primary" />
          <h3 className="text-sm font-semibold text-brand-text">Favorite place to meet up</h3>
        </div>
        <p className="text-xs text-brand-text-subtle">
          BUZZ uses this to suggest locations your group will actually enjoy.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {LOCATION_TYPES.map(({ value, label }) => {
            const active = data.favoriteLocationType === value
            return (
              <button
                key={value}
                onClick={() => setData((prev) => ({
                  ...prev,
                  favoriteLocationType: active ? null : value,
                }))}
                className={`
                  rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-all
                  ${active
                    ? "bg-brand-primary/15 border-brand-primary/40 text-brand-text"
                    : "bg-brand-surface/50 border-brand-border/60 text-brand-text-muted hover:border-brand-primary/25 hover:bg-brand-surface/70"
                  }
                `}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Free-text description */}
        <input
          type="text"
          value={data.favoriteLocationText ?? ""}
          onChange={(e) => setData((prev) => ({ ...prev, favoriteLocationText: e.target.value || null }))}
          placeholder="Any specific spot you love? (optional)"
          className="w-full rounded-lg border border-brand-border/60 bg-brand-surface/60 px-3 py-2 text-sm text-brand-text placeholder-brand-text-subtle focus:border-brand-primary/50 focus:outline-none focus:ring-1 focus:ring-brand-primary/30"
        />
      </section>

      {/* Error */}
      {error && (
        <p className="rounded-lg border border-rose-500/20 bg-rose-500/8 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={isSaving}
          className="flex items-center gap-2 rounded-xl bg-brand-primary/20 border border-brand-primary/40 px-4 py-2 text-sm font-semibold text-brand-primary hover:bg-brand-primary/30 transition-colors disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {willRetry ? "Retrying scheduling…" : "Saving…"}
            </>
          ) : saved ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Saved!
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" />
              Save Availability
            </>
          )}
        </button>

        {cohortId && (
          <p className="text-xs text-brand-text-subtle">
            Saving will automatically retry meetup scheduling if needed.
          </p>
        )}
      </div>
    </div>
  )
}
