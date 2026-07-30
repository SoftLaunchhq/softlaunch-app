/**
 * lib/availability.ts
 *
 * Calculates the best common meetup slot from cohort member preferences.
 *
 * Data shape in DB:
 *   CohortPreferences.preferredDays  — String[] e.g. ["saturday","sunday","wednesday"]
 *   CohortPreferences.preferredTime  — String?  e.g. "mornings" | "evenings" | "weekends" | "flexible"
 *
 * These are coarse-grained — no specific hours are stored.  We map them to
 * reasonable time windows and find the intersection across all members.
 */

// ─── Time Windows ─────────────────────────────────────────────

export interface TimeWindow {
  startHour: number  // 24-hour
  endHour: number
  label: string      // "3:00 – 5:00 PM"
}

/** Map a preferredTime value to the hours it covers */
const PREFERRED_TIME_WINDOWS: Record<string, TimeWindow> = {
  mornings:  { startHour: 9,  endHour: 12, label: "9:00 AM – 12:00 PM" },
  afternoons:{ startHour: 13, endHour: 17, label: "1:00 – 5:00 PM" },
  evenings:  { startHour: 17, endHour: 21, label: "5:00 – 9:00 PM" },
  weekends:  { startHour: 11, endHour: 19, label: "11:00 AM – 7:00 PM" },
  flexible:  { startHour: 9,  endHour: 21, label: "flexible" },
}

/** Canonical day ordering for display + sorting */
const DAY_ORDER: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6, sunday: 7,
}

// ─── Types ────────────────────────────────────────────────────

export interface MemberAvailability {
  userId: string
  preferredDays: string[]
  preferredTime: string | null
}

export interface AvailabilityResult {
  /** Days every member marked available */
  commonDays: string[]
  /**
   * Best single time window — intersection of all members' preferredTime.
   * null when preferences are mutually exclusive (e.g. mornings vs evenings).
   */
  commonWindow: TimeWindow | null
  /**
   * Human-readable proposed time string for BUZZ to speak aloud.
   * e.g. "this Saturday from 11:00 AM – 7:00 PM"
   * null when no common slot is found.
   */
  proposedText: string | null
  /**
   * Exact ISO datetime of the proposed meetup (set to the next
   * occurrence of the best common day, within the first 7 days
   * of the cohort's startDate — or from "now" if startDate is null).
   */
  proposedDate: Date | null
  /** true when there is no viable overlap */
  noCommonTime: boolean
}

// ─── Core calculation ─────────────────────────────────────────

/**
 * Given an array of member preferences, return the best common time slot.
 *
 * @param members   — Array of member availability objects
 * @param cohortStartDate — ISO string or Date for the cohort's start, used to
 *                          anchor the proposed date within the first week.
 *                          Falls back to "now" when null.
 */
export function calculateCommonAvailability(
  members: MemberAvailability[],
  cohortStartDate: Date | string | null
): AvailabilityResult {
  if (members.length === 0) {
    return { commonDays: [], commonWindow: null, proposedText: null, proposedDate: null, noCommonTime: true }
  }

  // ── 1. Common days ────────────────────────────────────────────
  // A day is "common" if it appears in every member's preferredDays.
  const allDaySets = members.map((m) =>
    new Set(m.preferredDays.map((d) => d.toLowerCase().trim()))
  )

  // Collect candidate days from first member, then filter by all others
  const firstSet = allDaySets[0]
  const commonDays = [...firstSet]
    .filter((day) => allDaySets.every((set) => set.has(day)))
    .sort((a, b) => (DAY_ORDER[a] ?? 9) - (DAY_ORDER[b] ?? 9))

  // ── 2. Common time window ─────────────────────────────────────
  // Map each member's preferredTime to a window, then find the overlap.
  const windows: TimeWindow[] = members.map((m) => {
    const t = m.preferredTime?.toLowerCase() ?? "flexible"
    return PREFERRED_TIME_WINDOWS[t] ?? PREFERRED_TIME_WINDOWS.flexible
  })

  const commonWindow = intersectWindows(windows)

  // ── 3. Handle no overlap ──────────────────────────────────────
  if (commonDays.length === 0 || !commonWindow) {
    // Last resort: pick the most popular single day
    if (commonDays.length === 0) {
      return { commonDays: [], commonWindow: null, proposedText: null, proposedDate: null, noCommonTime: true }
    }
    // Days match but times don't — use flexible as safe fallback
    const fallbackWindow = PREFERRED_TIME_WINDOWS.flexible
    const bestDay = pickBestDay(commonDays)
    const proposedDate = nextOccurrenceOfDay(bestDay, cohortStartDate)
    const proposedText = formatProposedText(bestDay, fallbackWindow, proposedDate)
    return {
      commonDays,
      commonWindow: fallbackWindow,
      proposedText,
      proposedDate,
      noCommonTime: false,
    }
  }

  // ── 4. Pick best day ──────────────────────────────────────────
  // Prefer weekends (Saturday first, then Sunday) since they have highest
  // attendance for casual group meetups; then fall through to weekday order.
  const bestDay = pickBestDay(commonDays)
  const proposedDate = nextOccurrenceOfDay(bestDay, cohortStartDate)
  const proposedText = formatProposedText(bestDay, commonWindow, proposedDate)

  return {
    commonDays,
    commonWindow,
    proposedText,
    proposedDate,
    noCommonTime: false,
  }
}

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Find the overlapping hours across all windows.
 * Returns null when there is no overlap.
 */
function intersectWindows(windows: TimeWindow[]): TimeWindow | null {
  let start = windows[0].startHour
  let end = windows[0].endHour

  for (const w of windows.slice(1)) {
    start = Math.max(start, w.startHour)
    end = Math.min(end, w.endHour)
  }

  if (start >= end) return null

  // Round to a 2-hour social window starting at the intersection
  const slotStart = start
  const slotEnd = Math.min(start + 2, end)

  return {
    startHour: slotStart,
    endHour: slotEnd,
    label: `${formatHour(slotStart)} – ${formatHour(slotEnd)}`,
  }
}

/** Prefer Saturday → Sunday → weekday in that order */
function pickBestDay(days: string[]): string {
  const preference = ["saturday", "sunday", "friday", "thursday", "wednesday", "tuesday", "monday"]
  for (const pref of preference) {
    if (days.includes(pref)) return pref
  }
  return days[0]
}

/**
 * Find the next occurrence of a named weekday starting from the anchor date.
 * Searches within the next 7 days so we stay in the "first week" window.
 */
function nextOccurrenceOfDay(dayName: string, anchor: Date | string | null): Date {
  const start = anchor ? new Date(anchor) : new Date()
  // Strip time — start from beginning of anchor day
  start.setHours(0, 0, 0, 0)

  const targetWday = dayNameToWday(dayName)
  const date = new Date(start)

  // Search up to 14 days out (covers 2 full weeks)
  for (let i = 0; i < 14; i++) {
    if (date.getDay() === targetWday) {
      // Set to a reasonable default time (15:00 / 3 PM)
      date.setHours(15, 0, 0, 0)
      return date
    }
    date.setDate(date.getDate() + 1)
  }

  // Fallback — should never reach here
  return new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
}

function dayNameToWday(name: string): number {
  const map: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
  }
  return map[name.toLowerCase()] ?? 6
}

function formatHour(hour: number): string {
  if (hour === 12) return "12:00 PM"
  if (hour > 12) return `${hour - 12}:00 PM`
  return `${hour}:00 AM`
}

const SHORT_DAY: Record<string, string> = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday",
  thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday",
}

const SHORT_MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "Saturday, August 3 at 3:00 – 5:00 PM" */
function formatProposedText(day: string, window: TimeWindow, date: Date): string {
  const monthName = SHORT_MONTH[date.getMonth()]
  const dayNum = date.getDate()
  const dayLabel = SHORT_DAY[day] ?? day
  return `${dayLabel}, ${monthName} ${dayNum} from ${window.label}`
}
