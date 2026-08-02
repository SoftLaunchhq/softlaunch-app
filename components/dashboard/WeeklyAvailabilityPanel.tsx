"use client"

/**
 * WeeklyAvailabilityPanel
 *
 * Replaces the old AvailabilityPanel with a weekly granularity system.
 *
 * Each cohort week (1–4) has independent availability:
 *   - Per day (Mon–Sun): "Not available" / "Available all day" / "Custom hours"
 *   - Custom hours: one or more time blocks with start + end time
 *
 * Also manages the favorite meetup location (type + specific place).
 *
 * On save:
 *   1. POSTs weekly slots to /api/user/weekly-availability
 *   2. POSTs meetup prefs to /api/user/availability (existing endpoint)
 *   3. If the meetup is in NO_COMMON_TIME, auto-triggers a retry
 */

import { useState, useEffect, useCallback } from "react"
import {
  Clock, MapPin, CheckCircle2, Loader2, Save, Plus, Trash2, Calendar,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type DayType = "not_available" | "all_day" | "custom"

interface TimeBlock {
  start: string  // "HH:MM"
  end:   string  // "HH:MM"
}

interface DayAvailability {
  type:   DayType
  blocks: TimeBlock[]
}

type WeekDays = {
  monday:    DayAvailability
  tuesday:   DayAvailability
  wednesday: DayAvailability
  thursday:  DayAvailability
  friday:    DayAvailability
  saturday:  DayAvailability
  sunday:    DayAvailability
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_KEYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as const
type DayKey = typeof DAY_KEYS[number]

const DAY_LABELS: Record<DayKey, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
  friday: "Fri", saturday: "Sat", sunday: "Sun",
}

const DAY_FULL: Record<DayKey, string> = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday",
  friday: "Friday", saturday: "Saturday", sunday: "Sunday",
}

const LOCATION_TYPES = [
  { value: "coffee",    label: "☕ Coffee shop" },
  { value: "library",   label: "📚 Library" },
  { value: "coworking", label: "💼 Co-working" },
  { value: "restaurant",label: "🍽️ Restaurant" },
  { value: "park",      label: "🌳 Park" },
  { value: "university",label: "🎓 University" },
  { value: "startup",   label: "🚀 Startup office" },
  { value: "outdoor",   label: "🏞️ Outdoor" },
  { value: "other",     label: "✨ Other" },
]

const DEFAULT_DAYS: WeekDays = {
  monday:    { type: "not_available", blocks: [] },
  tuesday:   { type: "not_available", blocks: [] },
  wednesday: { type: "not_available", blocks: [] },
  thursday:  { type: "not_available", blocks: [] },
  friday:    { type: "not_available", blocks: [] },
  saturday:  { type: "not_available", blocks: [] },
  sunday:    { type: "not_available", blocks: [] },
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  cohortId:    string
  currentWeek: number  // 1–4 (passed from server)
  onSaved?:    () => void
}

export function WeeklyAvailabilityPanel({ cohortId, currentWeek, onSaved }: Props) {
  const [selectedWeek, setSelectedWeek] = useState<number>(currentWeek)
  const [days, setDays]                 = useState<WeekDays>({ ...DEFAULT_DAYS })
  const [locationType, setLocationType] = useState<string | null>(null)
  const [locationText, setLocationText] = useState<string>("")
  const [favoriteLocationText, setFavoriteLocationText] = useState<string>("")

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving]   = useState(false)
  const [saved, setSaved]         = useState(false)
  const [willRetry, setWillRetry] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  // ── Load weekly slots ────────────────────────────────────────────────────

  const loadWeekSlots = useCallback(async (week: number) => {
    setIsLoading(true)
    try {
      const res = await fetch(
        `/api/user/weekly-availability?cohortId=${encodeURIComponent(cohortId)}&weekNumber=${week}`,
        { cache: "no-store" }
      )
      if (res.ok) {
        const json = await res.json()
        if (json.days) setDays(json.days as WeekDays)
        else setDays({ ...DEFAULT_DAYS })
      } else {
        setDays({ ...DEFAULT_DAYS })
      }
    } catch {
      setDays({ ...DEFAULT_DAYS })
    } finally {
      setIsLoading(false)
    }
  }, [cohortId])

  // ── Load meetup location prefs (legacy endpoint) ─────────────────────────

  const loadLocationPrefs = useCallback(async () => {
    try {
      const res = await fetch("/api/user/availability", { cache: "no-store" })
      if (!res.ok) return
      const json = await res.json()
      if (json.availability) {
        setLocationType(json.availability.favoriteLocationType ?? null)
        setFavoriteLocationText(json.availability.favoriteLocationText ?? "")
      }
    } catch { /* non-fatal */ }
  }, [])

  useEffect(() => {
    loadWeekSlots(selectedWeek)
    loadLocationPrefs()
  }, [selectedWeek, loadWeekSlots, loadLocationPrefs])

  // ── Day type toggle ──────────────────────────────────────────────────────

  const setDayType = (day: DayKey, type: DayType) => {
    setDays((prev) => ({
      ...prev,
      [day]: {
        type,
        blocks: type === "custom"
          ? (prev[day].blocks.length > 0 ? prev[day].blocks : [{ start: "09:00", end: "17:00" }])
          : [],
      },
    }))
  }

  // ── Block helpers ────────────────────────────────────────────────────────

  const addBlock = (day: DayKey) => {
    setDays((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        blocks: [...prev[day].blocks, { start: "09:00", end: "17:00" }],
      },
    }))
  }

  const removeBlock = (day: DayKey, idx: number) => {
    setDays((prev) => {
      const blocks = prev[day].blocks.filter((_, i) => i !== idx)
      return {
        ...prev,
        [day]: {
          type: blocks.length === 0 ? "not_available" : "custom",
          blocks,
        },
      }
    })
  }

  const updateBlock = (day: DayKey, idx: number, field: "start" | "end", value: string) => {
    setDays((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        blocks: prev[day].blocks.map((b, i) => i === idx ? { ...b, [field]: value } : b),
      },
    }))
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  const save = async () => {
    setIsSaving(true)
    setError(null)
    setSaved(false)
    setWillRetry(false)

    try {
      // 1. Save weekly slots
      const slotsRes = await fetch("/api/user/weekly-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cohortId, weekNumber: selectedWeek, days }),
      })
      const slotsJson = await slotsRes.json()
      if (!slotsRes.ok) {
        setError(slotsJson.error ?? "Failed to save availability")
        return
      }

      // 2. Save meetup location prefs (legacy endpoint)
      try {
        await fetch("/api/user/availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cohortId,
            favoriteLocationType: locationType,
            favoriteLocationText: favoriteLocationText || null,
          }),
        })
      } catch { /* non-fatal */ }

      setSaved(true)

      // 3. Auto-retry scheduling if needed
      if (slotsJson.shouldRetry) {
        setWillRetry(true)
        try {
          const retryRes = await fetch(`/api/cohorts/${cohortId}/meetup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "retry" }),
          })
          if (retryRes.ok) onSaved?.()
        } catch { /* non-fatal */ }
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

  // ─────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-brand-text-subtle" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">

      {/* Week selector */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-brand-primary" />
          <h3 className="text-sm font-semibold text-brand-text">
            Availability for Week {selectedWeek}
          </h3>
          <span className="ml-auto text-xs text-brand-text-subtle">
            Each week is saved independently
          </span>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((w) => (
            <button
              key={w}
              onClick={() => setSelectedWeek(w)}
              className={`
                px-3 py-1.5 rounded-lg border text-sm font-medium transition-all
                ${selectedWeek === w
                  ? "bg-brand-primary/20 border-brand-primary/50 text-brand-text"
                  : "bg-brand-surface/50 border-brand-border/60 text-brand-text-muted hover:border-brand-primary/30 hover:text-brand-text"
                }
                ${w > currentWeek ? "opacity-50 cursor-not-allowed" : ""}
              `}
              disabled={w > currentWeek + 1}
            >
              Week {w}
            </button>
          ))}
        </div>
        <p className="text-xs text-brand-text-subtle">
          BUZZ uses your Week {currentWeek} availability to schedule your meetup.
          {selectedWeek !== currentWeek && ` You're editing Week ${selectedWeek}.`}
        </p>
      </section>

      {/* Per-day availability */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-brand-primary" />
          <h3 className="text-sm font-semibold text-brand-text">Daily availability</h3>
        </div>

        <div className="space-y-2">
          {DAY_KEYS.map((day) => {
            const dayData = days[day]
            return (
              <div
                key={day}
                className="rounded-xl border border-brand-border/60 bg-brand-surface/30 overflow-hidden"
              >
                {/* Day header row */}
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <span className="w-10 text-sm font-semibold text-brand-text flex-shrink-0">
                    {DAY_LABELS[day]}
                  </span>

                  {/* Type selector pills */}
                  <div className="flex gap-1.5 flex-wrap">
                    {(["not_available", "all_day", "custom"] as DayType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setDayType(day, t)}
                        className={`
                          px-2.5 py-1 rounded-lg text-xs font-medium transition-all border
                          ${dayData.type === t
                            ? t === "not_available"
                              ? "bg-brand-surface border-brand-border text-brand-text"
                              : "bg-brand-primary/20 border-brand-primary/50 text-brand-text"
                            : "bg-transparent border-brand-border/40 text-brand-text-muted hover:border-brand-primary/30 hover:text-brand-text"
                          }
                        `}
                      >
                        {t === "not_available" ? "Not available" :
                         t === "all_day" ? "All day" : "Custom hours"}
                      </button>
                    ))}
                  </div>

                  {/* Quick available badge */}
                  {dayData.type === "all_day" && (
                    <span className="ml-auto text-xs text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> All day
                    </span>
                  )}
                  {dayData.type === "not_available" && (
                    <span className="ml-auto text-xs text-brand-text-subtle">Unavailable</span>
                  )}

                  {/* Add block button (shown for custom) */}
                  {dayData.type === "custom" && (
                    <button
                      onClick={() => addBlock(day)}
                      className="ml-auto flex items-center gap-1 rounded-lg border border-brand-primary/30 px-2 py-1 text-xs text-brand-primary hover:bg-brand-primary/10 transition-colors"
                    >
                      <Plus className="h-3 w-3" /> Add block
                    </button>
                  )}
                </div>

                {/* Time blocks (custom only) */}
                {dayData.type === "custom" && dayData.blocks.length > 0 && (
                  <div className="border-t border-brand-border/40 px-3 py-2 space-y-2 bg-brand-bg/30">
                    {dayData.blocks.map((block, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="time"
                          value={block.start}
                          onChange={(e) => updateBlock(day, idx, "start", e.target.value)}
                          className="rounded-lg border border-brand-border/60 bg-brand-surface/60 px-2 py-1 text-sm text-brand-text focus:border-brand-primary/50 focus:outline-none focus:ring-1 focus:ring-brand-primary/30"
                        />
                        <span className="text-xs text-brand-text-subtle">to</span>
                        <input
                          type="time"
                          value={block.end}
                          onChange={(e) => updateBlock(day, idx, "end", e.target.value)}
                          className="rounded-lg border border-brand-border/60 bg-brand-surface/60 px-2 py-1 text-sm text-brand-text focus:border-brand-primary/50 focus:outline-none focus:ring-1 focus:ring-brand-primary/30"
                        />
                        <button
                          onClick={() => removeBlock(day, idx)}
                          className="ml-auto rounded-lg p-1.5 text-brand-text-subtle hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Prompt to add blocks if custom but empty */}
                {dayData.type === "custom" && dayData.blocks.length === 0 && (
                  <div className="border-t border-brand-border/40 px-3 py-2 bg-brand-bg/30">
                    <button
                      onClick={() => addBlock(day)}
                      className="text-xs text-brand-primary hover:underline"
                    >
                      + Add a time range for {DAY_FULL[day]}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Favorite meetup location */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-brand-primary" />
          <h3 className="text-sm font-semibold text-brand-text">Favorite place to meet up</h3>
        </div>
        <p className="text-xs text-brand-text-subtle">
          BUZZ uses your preferred style and specific spot when suggesting meetup locations.
        </p>

        {/* Style grid (9 types) */}
        <div className="grid grid-cols-3 gap-2">
          {LOCATION_TYPES.map(({ value, label }) => {
            const active = locationType === value
            return (
              <button
                key={value}
                onClick={() => setLocationType(active ? null : value)}
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

        {/* Specific place */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-brand-text-muted">
            Any specific spot you love? <span className="text-brand-text-subtle">(optional)</span>
          </label>
          <input
            type="text"
            value={favoriteLocationText}
            onChange={(e) => setFavoriteLocationText(e.target.value)}
            placeholder='e.g. "Optimist Hall", "The Goodyear House", "Atherton Mill"'
            className="w-full rounded-lg border border-brand-border/60 bg-brand-surface/60 px-3 py-2 text-sm text-brand-text placeholder-brand-text-subtle focus:border-brand-primary/50 focus:outline-none focus:ring-1 focus:ring-brand-primary/30"
          />
          <p className="text-xs text-brand-text-subtle">
            BUZZ will factor this in when generating meetup poll options.
          </p>
        </div>
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

        <p className="text-xs text-brand-text-subtle">
          Saving Week {currentWeek} will auto-retry meetup scheduling if needed.
        </p>
      </div>
    </div>
  )
}
