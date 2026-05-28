/**
 * SoftLaunch — Global TypeScript Types
 */

import type {
  User,
  Profile,
  Assessment,
  DriveProfile,
  CohortPreferences,
  Cohort,
  CohortMembership,
  WeeklyPrompt,
  Feedback,
  Subscription,
  Attendance,
} from "@prisma/client"

// ─────────────────────────────────────────────────────────────
// EXTENDED TYPES (with relations)
// ─────────────────────────────────────────────────────────────

export type UserWithProfile = User & {
  profile: Profile | null
  driveProfile: DriveProfile | null
}

export type UserWithFullData = User & {
  profile: Profile | null
  driveProfile: DriveProfile | null
  assessment: Assessment | null
  cohortPrefs: CohortPreferences | null
  subscription: Subscription | null
  memberships: CohortMembership[]
}

export type CohortWithMembers = Cohort & {
  memberships: (CohortMembership & {
    user: UserWithProfile
  })[]
}

export type CohortWithFullData = Cohort & {
  memberships: (CohortMembership & {
    user: UserWithFullData
  })[]
  weeklyPrompts: WeeklyPrompt[]
  feedbacks: (Feedback & {
    user: UserWithProfile
  })[]
}

// ─────────────────────────────────────────────────────────────
// API RESPONSE TYPES
// ─────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data?: T
  error?: string
  success?: boolean
}

export interface DashboardData {
  user: UserWithFullData
  activeCohort: CohortWithMembers | null
  pendingCohort: CohortWithMembers | null
  subscription: Subscription | null
}

export interface AdminStatsData {
  totalUsers: number
  usersInPool: number
  activeCohorts: number
  pendingApproval: number
  completedCohorts: number
  activeSubscriptions: number
  mrr: number
}

// ─────────────────────────────────────────────────────────────
// FORM TYPES
// ─────────────────────────────────────────────────────────────

export interface AssessmentAnswerInput {
  questionId: string
  answerKey: string
}

export interface FeedbackInput {
  cohortId: string
  weekNumber: number
  type: "POST_SESSION" | "POST_WEEK" | "EXIT"
  sessionRating?: number
  groupChemistry?: number
  wouldContinue?: boolean
  topVibeWith?: string | null
  attendanceConfirmed?: boolean
  openResponse?: string | null
}

// ─────────────────────────────────────────────────────────────
// MATCHING TYPES
// ─────────────────────────────────────────────────────────────

export interface MatchingPoolUser {
  id: string
  firstName: string
  lastName: string
  photoUrl: string | null
  archetype: string
  ambition: number
  community: number
  discipline: number
  openness: number
  growth: number
  preferredThemes: string[]
  waitingDays: number
}

// ─────────────────────────────────────────────────────────────
// BILLING TYPES
// ─────────────────────────────────────────────────────────────

export interface BillingStatus {
  status: "FREE" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "INCOMPLETE"
  weekAccessLevel: number
  canAccessWeek: (week: number) => boolean
  currentPeriodEnd: Date | null
}

// ─────────────────────────────────────────────────────────────
// UI TYPES
// ─────────────────────────────────────────────────────────────

export interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

export interface ToastMessage {
  id: string
  type: "success" | "error" | "warning" | "info"
  title: string
  description?: string
}
