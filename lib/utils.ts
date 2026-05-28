import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(cents / 100)
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date))
}

export function formatRelativeDate(date: Date | string): string {
  const now = new Date()
  const d = new Date(date)
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return formatDate(date)
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0]}${lastName[0]}`.toUpperCase()
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

export function generateCohortName(city: string, index: number): string {
  const cityCode = city === "Charlotte, NC" ? "CLT" : city.slice(0, 3).toUpperCase()
  return `${cityCode}-${String(index).padStart(3, "0")}`
}

export function scoreToLabel(score: number): string {
  if (score >= 85) return "Very High"
  if (score >= 70) return "High"
  if (score >= 50) return "Moderate"
  if (score >= 30) return "Low"
  return "Very Low"
}

export function archetypeToColor(archetype: string): string {
  const colors: Record<string, string> = {
    builder:    "#1DB896",
    connector:  "#7CC455",
    disciplined:"#179E80",
    visionary:  "#EE9F52",
    creator:    "#5EA83A",
    catalyst:   "#EE9F52",
    default:    "#1DB896",
  }
  return colors[archetype.toLowerCase()] || colors.default
}

export function weekStatusLabel(week: number, currentWeek: number): string {
  if (week < currentWeek) return "Completed"
  if (week === currentWeek) return "Active"
  return "Upcoming"
}

export function cohortThemeLabel(theme: string): string {
  const labels: Record<string, string> = {
    CAREER_GROWTH: "Career Growth",
    FOUNDERS_BUILDERS: "Founders & Builders",
    FITNESS_DISCIPLINE: "Fitness & Discipline",
    ACCOUNTABILITY: "Accountability",
    CREATIVE_AMBITION: "Creative Ambition",
    GENERAL: "General",
  }
  return labels[theme] || theme
}

export function paymentStatusBadge(status: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    FREE: { label: "Free Trial", color: "text-brand-text-muted bg-brand-border" },
    ACTIVE: { label: "Active", color: "text-brand-success bg-emerald-950" },
    PAST_DUE: { label: "Past Due", color: "text-brand-warning bg-amber-950" },
    CANCELED: { label: "Canceled", color: "text-brand-error bg-red-950" },
    INCOMPLETE: { label: "Incomplete", color: "text-brand-text-muted bg-brand-border" },
  }
  return map[status] || { label: status, color: "text-brand-text-muted bg-brand-border" }
}
