/**
 * SoftLaunch Matching Engine
 *
 * Finds optimal groups of 4 users based on:
 * 1. DriveProfile dimension similarity/complementarity
 * 2. Cohort theme alignment
 * 3. Availability overlap
 * 4. Behavior signals from past cohorts (V1.5)
 *
 * Designed to be extensible — add ML scoring in V2 by replacing
 * pairwiseScore() with a model inference call.
 */

import type {
  DriveProfile,
  CohortPreferences,
  CohortTheme,
  User,
} from "@prisma/client"

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface MatchableUser {
  id: string
  profile: {
    firstName: string
    lastName: string
    photoUrl: string | null
    headline: string | null
  } | null
  driveProfile: DriveProfile
  cohortPrefs: CohortPreferences | null
}

export interface PairScore {
  userA: string // userId
  userB: string // userId
  score: number // 0-1
  breakdown: {
    ambition: number
    discipline: number
    community: number
    growth: number
    openness: number
  }
}

export interface CohortSuggestion {
  members: MatchableUser[]
  compatibilityScore: number // 0-100
  themeAlignment: CohortTheme | null
  pairScores: PairScore[]
  warnings: string[]
  matchingVersion: number
}

// ─────────────────────────────────────────────────────────────
// SCORING FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Calculate pairwise compatibility between two users.
 *
 * Design principles:
 * - Ambition: similar is strongly preferred (ambitious people want equals)
 * - Discipline: similar is preferred (accountability requires equal drive)
 * - Community: slight complementarity OK (connector + builder = rich dynamic)
 * - Openness: complementary adds variety, but extremes clash
 * - Growth: similar is preferred (shared growth mindset bonds people)
 */
export function pairwiseScore(
  profileA: DriveProfile,
  profileB: DriveProfile
): PairScore {
  // Similarity score: 1.0 = identical, 0.0 = maximum difference
  const similarity = (a: number, b: number, maxPenaltyAt = 100): number =>
    Math.max(0, 1 - Math.abs(a - b) / maxPenaltyAt)

  // Complementarity score: best when slightly different, worst when identical
  // or completely opposite
  const complement = (a: number, b: number): number => {
    const diff = Math.abs(a - b)
    if (diff < 10) return 0.75 // Too similar — some tension is healthy
    if (diff <= 35) return 1.0  // Sweet spot
    if (diff <= 60) return 0.7  // Getting far apart
    return 0.3                   // Too far apart
  }

  const ambitionScore = similarity(profileA.ambition, profileB.ambition, 80)
  const disciplineScore = similarity(profileA.discipline, profileB.discipline, 80)
  const communityScore = complement(profileA.community, profileB.community)
  const growthScore = similarity(profileA.growth, profileB.growth, 90)
  const opennessScore = complement(profileA.openness, profileB.openness)

  // Weighted composite (weights sum to 1.0)
  const score =
    ambitionScore * 0.30 +
    disciplineScore * 0.25 +
    communityScore * 0.20 +
    growthScore * 0.15 +
    opennessScore * 0.10

  return {
    userA: profileA.userId,
    userB: profileB.userId,
    score,
    breakdown: {
      ambition: ambitionScore,
      discipline: disciplineScore,
      community: communityScore,
      growth: growthScore,
      openness: opennessScore,
    },
  }
}

/**
 * Calculate theme alignment bonus for a group.
 * Rewards groups where 3+ members share a preferred theme.
 */
export function themeAlignmentScore(users: MatchableUser[]): {
  score: number
  dominantTheme: CohortTheme | null
} {
  const allThemes = users.flatMap((u) => u.cohortPrefs?.preferredThemes ?? [])

  if (allThemes.length === 0) return { score: 0, dominantTheme: null }

  // Count theme occurrences
  const themeCounts = allThemes.reduce(
    (acc, theme) => {
      acc[theme] = (acc[theme] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  // Find dominant theme
  const sorted = Object.entries(themeCounts).sort(([, a], [, b]) => b - a)
  const [dominantTheme, dominantCount] = sorted[0]

  // Bonus: 0.1 per shared member beyond 2 (max +0.2 for 4/4 match)
  const bonus = Math.max(0, (dominantCount - 2) * 0.1)

  return {
    score: bonus,
    dominantTheme: dominantCount >= 2 ? (dominantTheme as CohortTheme) : null,
  }
}

/**
 * Calculate overall cohort compatibility score for a group of 4.
 *
 * Uses all C(4,2) = 6 pairwise combinations.
 */
export function cohortCompatibilityScore(users: MatchableUser[]): {
  score: number
  pairScores: PairScore[]
  warnings: string[]
  themeAlignment: CohortTheme | null
} {
  if (users.length !== 4) {
    throw new Error("Cohort must have exactly 4 members")
  }

  // Generate all 6 pairs
  const pairs: [MatchableUser, MatchableUser][] = []
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      pairs.push([users[i], users[j]])
    }
  }

  const pairScores = pairs.map(([a, b]) =>
    pairwiseScore(a.driveProfile, b.driveProfile)
  )

  const avgPairwiseScore =
    pairScores.reduce((sum, ps) => sum + ps.score, 0) / pairScores.length

  // Theme alignment bonus
  const { score: themeBonus, dominantTheme } = themeAlignmentScore(users)

  // Behavior amplifier (returns users with proven track record get a boost)
  const avgBehaviorAmplifier =
    users.reduce((sum, u) => sum + (u.driveProfile.behaviorAmplifier ?? 1.0), 0) /
    users.length

  // Ambition variance penalty
  const ambitionValues = users.map((u) => u.driveProfile.ambition)
  const ambitionVariance =
    Math.max(...ambitionValues) - Math.min(...ambitionValues)
  const ambitionPenalty = ambitionVariance > 35 ? (ambitionVariance - 35) / 200 : 0

  // Final score (0-100)
  const rawScore =
    (avgPairwiseScore + themeBonus) * avgBehaviorAmplifier - ambitionPenalty
  const finalScore = Math.min(100, Math.max(0, rawScore * 100))

  // Generate warnings for admin review
  const warnings: string[] = []

  if (ambitionVariance > 35) {
    warnings.push(
      `Ambition gap of ${ambitionVariance.toFixed(0)} pts — review if this is intentional`
    )
  }

  const lowPairs = pairScores.filter((ps) => ps.score < 0.45)
  if (lowPairs.length > 1) {
    warnings.push(
      `${lowPairs.length} low-compatibility pairs detected — consider swapping a member`
    )
  }

  const usersWithoutTheme = users.filter(
    (u) => !u.cohortPrefs?.preferredThemes?.length
  )
  if (usersWithoutTheme.length > 2) {
    warnings.push("Most members haven't specified a cohort theme preference")
  }

  return {
    score: finalScore,
    pairScores,
    warnings,
    themeAlignment: dominantTheme,
  }
}

// ─────────────────────────────────────────────────────────────
// GROUPING ALGORITHM
// ─────────────────────────────────────────────────────────────

/**
 * Get all combinations of k elements from array.
 */
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (arr.length < k) return []
  const [first, ...rest] = arr
  const withFirst = combinations(rest, k - 1).map((combo) => [first, ...combo])
  const withoutFirst = combinations(rest, k)
  return [...withFirst, ...withoutFirst]
}

/**
 * Main matching function.
 *
 * For MVP (≤ 20 users): exhaustive search of all C(N,4) combinations
 * For V2 (100+ users): implement greedy + local search
 *
 * Returns ranked list of cohort suggestions.
 */
export function suggestCohorts(
  users: MatchableUser[],
  maxSuggestions = 5
): CohortSuggestion[] {
  if (users.length < 4) {
    throw new Error(
      `Need at least 4 users in matching pool. Currently have ${users.length}.`
    )
  }

  const matchingVersion = 1

  // Filter users who have completed assessments
  const eligibleUsers = users.filter((u) => u.driveProfile)

  if (eligibleUsers.length < 4) {
    throw new Error(
      `Need at least 4 users with completed assessments. Currently have ${eligibleUsers.length}.`
    )
  }

  // For MVP: if N ≤ 16, use exhaustive search (C(16,4) = 1820 combinations)
  // For larger pools, use greedy approach
  if (eligibleUsers.length <= 16) {
    return exhaustiveSearch(eligibleUsers, maxSuggestions, matchingVersion)
  } else {
    return greedySearch(eligibleUsers, maxSuggestions, matchingVersion)
  }
}

function exhaustiveSearch(
  users: MatchableUser[],
  maxSuggestions: number,
  matchingVersion: number
): CohortSuggestion[] {
  const allGroups = combinations(users, 4)

  const scoredGroups = allGroups.map((group) => {
    const { score, pairScores, warnings, themeAlignment } =
      cohortCompatibilityScore(group)
    return {
      members: group,
      compatibilityScore: score,
      themeAlignment,
      pairScores,
      warnings,
      matchingVersion,
    }
  })

  // Sort by score descending
  scoredGroups.sort((a, b) => b.compatibilityScore - a.compatibilityScore)

  // Return top N non-overlapping groups
  return selectNonOverlapping(scoredGroups, maxSuggestions)
}

function greedySearch(
  users: MatchableUser[],
  maxSuggestions: number,
  matchingVersion: number
): CohortSuggestion[] {
  const suggestions: CohortSuggestion[] = []
  const usedUserIds = new Set<string>()

  let remaining = [...users]

  while (remaining.length >= 4 && suggestions.length < maxSuggestions) {
    // Find best group starting with the first user
    const seed = remaining[0]
    const others = remaining.filter((u) => u.id !== seed.id)

    // Score seed against all others
    const ranked = others.map((u) => ({
      user: u,
      score: pairwiseScore(seed.driveProfile, u.driveProfile).score,
    }))
    ranked.sort((a, b) => b.score - a.score)

    // Take top 3
    const groupMembers = [seed, ranked[0].user, ranked[1].user, ranked[2].user]

    const { score, pairScores, warnings, themeAlignment } =
      cohortCompatibilityScore(groupMembers)

    suggestions.push({
      members: groupMembers,
      compatibilityScore: score,
      themeAlignment,
      pairScores,
      warnings,
      matchingVersion,
    })

    // Remove used members from pool
    const usedIds = new Set(groupMembers.map((m) => m.id))
    remaining = remaining.filter((u) => !usedIds.has(u.id))
  }

  return suggestions.sort((a, b) => b.compatibilityScore - a.compatibilityScore)
}

/**
 * Select non-overlapping groups (no user in 2 suggestions).
 */
function selectNonOverlapping(
  sortedGroups: CohortSuggestion[],
  maxSuggestions: number
): CohortSuggestion[] {
  const selected: CohortSuggestion[] = []
  const usedUserIds = new Set<string>()

  for (const group of sortedGroups) {
    if (selected.length >= maxSuggestions) break

    const memberIds = group.members.map((m) => m.id)
    const hasOverlap = memberIds.some((id) => usedUserIds.has(id))

    if (!hasOverlap) {
      selected.push(group)
      memberIds.forEach((id) => usedUserIds.add(id))
    }
  }

  return selected
}

// ─────────────────────────────────────────────────────────────
// ASSESSMENT → DRIVE PROFILE
// ─────────────────────────────────────────────────────────────

/**
 * Assessment questions and their dimension mappings.
 * Each answer maps to dimension scores (0-20 each, summed to 0-100 per dimension).
 */
export const ASSESSMENT_QUESTIONS = [
  {
    id: "q1",
    text: "What drives you most right now?",
    subtext: "Be honest — there are no wrong answers here.",
    options: [
      {
        key: "career",
        text: "Career growth & advancement",
        icon: "📈",
        scores: { ambition: 20, community: 5, discipline: 10, openness: 5, growth: 15 },
        dimension: "ambition",
      },
      {
        key: "building",
        text: "Building something that matters",
        icon: "🔨",
        scores: { ambition: 18, community: 8, discipline: 14, openness: 10, growth: 16 },
        dimension: "ambition",
      },
      {
        key: "health",
        text: "Physical health & discipline",
        icon: "💪",
        scores: { ambition: 12, community: 8, discipline: 20, openness: 8, growth: 14 },
        dimension: "discipline",
      },
      {
        key: "creative",
        text: "Creative expression & craft",
        icon: "🎨",
        scores: { ambition: 10, community: 10, discipline: 12, openness: 18, growth: 16 },
        dimension: "openness",
      },
      {
        key: "personal",
        text: "Personal growth & self-discovery",
        icon: "🌱",
        scores: { ambition: 12, community: 12, discipline: 12, openness: 16, growth: 20 },
        dimension: "growth",
      },
    ],
  },
  {
    id: "q2",
    text: "What does a genuinely great week look like for you?",
    subtext: "Not the ideal — the real version.",
    options: [
      {
        key: "output",
        text: "I shipped a lot and hit my targets",
        icon: "🎯",
        scores: { ambition: 18, community: 4, discipline: 18, openness: 6, growth: 10 },
        dimension: "discipline",
      },
      {
        key: "deep_convo",
        text: "I had a few genuinely deep conversations",
        icon: "💬",
        scores: { ambition: 8, community: 20, discipline: 6, openness: 14, growth: 14 },
        dimension: "community",
      },
      {
        key: "physical",
        text: "I moved my body hard every day",
        icon: "🏃",
        scores: { ambition: 12, community: 6, discipline: 20, openness: 8, growth: 12 },
        dimension: "discipline",
      },
      {
        key: "creative_flow",
        text: "I was in a creative flow state",
        icon: "✨",
        scores: { ambition: 10, community: 8, discipline: 10, openness: 20, growth: 14 },
        dimension: "openness",
      },
      {
        key: "learning",
        text: "I learned something that changed my thinking",
        icon: "🧠",
        scores: { ambition: 12, community: 10, discipline: 8, openness: 16, growth: 20 },
        dimension: "growth",
      },
    ],
  },
  {
    id: "q3",
    text: "How do you recharge after a draining week?",
    subtext: "Your answer says a lot about how you work.",
    options: [
      {
        key: "solo",
        text: "Solo — I need space and silence",
        icon: "🎧",
        scores: { ambition: 10, community: 4, discipline: 14, openness: 12, growth: 14 },
        dimension: "community",
      },
      {
        key: "small_group",
        text: "Small group of close people",
        icon: "👥",
        scores: { ambition: 10, community: 18, discipline: 8, openness: 14, growth: 14 },
        dimension: "community",
      },
      {
        key: "exercise",
        text: "Intense exercise or physical activity",
        icon: "🏋️",
        scores: { ambition: 12, community: 6, discipline: 20, openness: 8, growth: 12 },
        dimension: "discipline",
      },
      {
        key: "creating",
        text: "Making or building something",
        icon: "🔧",
        scores: { ambition: 14, community: 6, discipline: 14, openness: 18, growth: 14 },
        dimension: "openness",
      },
      {
        key: "consuming",
        text: "Reading, podcasts, learning",
        icon: "📚",
        scores: { ambition: 10, community: 8, discipline: 10, openness: 16, growth: 20 },
        dimension: "growth",
      },
    ],
  },
  {
    id: "q4",
    text: "What do you want more of in your circle?",
    subtext: "Be specific — this shapes who you'll meet.",
    options: [
      {
        key: "accountability",
        text: "People who call me out when I slack",
        icon: "🔥",
        scores: { ambition: 14, community: 12, discipline: 20, openness: 8, growth: 14 },
        dimension: "discipline",
      },
      {
        key: "ambition",
        text: "People who push me to think bigger",
        icon: "🚀",
        scores: { ambition: 20, community: 10, discipline: 12, openness: 10, growth: 16 },
        dimension: "ambition",
      },
      {
        key: "creativity",
        text: "People who see the world differently",
        icon: "🌀",
        scores: { ambition: 10, community: 14, discipline: 8, openness: 20, growth: 16 },
        dimension: "openness",
      },
      {
        key: "depth",
        text: "People I can have real conversations with",
        icon: "🌊",
        scores: { ambition: 10, community: 20, discipline: 8, openness: 16, growth: 14 },
        dimension: "community",
      },
      {
        key: "honesty",
        text: "People who are brutally honest with me",
        icon: "⚡",
        scores: { ambition: 14, community: 14, discipline: 16, openness: 12, growth: 16 },
        dimension: "growth",
      },
    ],
  },
  {
    id: "q5",
    text: "Where are you in your journey right now?",
    subtext: "This helps us match you with people at a similar stage.",
    options: [
      {
        key: "starting",
        text: "Just starting — still figuring it out",
        icon: "🌅",
        scores: { ambition: 12, community: 14, discipline: 10, openness: 18, growth: 18 },
        dimension: "growth",
      },
      {
        key: "momentum",
        text: "Early momentum — things are beginning to move",
        icon: "⚡",
        scores: { ambition: 16, community: 12, discipline: 14, openness: 14, growth: 16 },
        dimension: "ambition",
      },
      {
        key: "building",
        text: "Building seriously — fully committed",
        icon: "🔨",
        scores: { ambition: 18, community: 10, discipline: 18, openness: 10, growth: 14 },
        dimension: "ambition",
      },
      {
        key: "scaling",
        text: "Scaling — need people at my level",
        icon: "📈",
        scores: { ambition: 20, community: 10, discipline: 16, openness: 10, growth: 12 },
        dimension: "ambition",
      },
      {
        key: "reinventing",
        text: "Reinventing — major transition underway",
        icon: "🦋",
        scores: { ambition: 14, community: 14, discipline: 12, openness: 18, growth: 18 },
        dimension: "openness",
      },
    ],
  },
]

/**
 * Archetypes based on dominant dimension combinations.
 */
export const ARCHETYPES = [
  {
    slug: "builder",
    name: "The Builder",
    summary:
      "You're driven by making things real. You thrive on shipping, on seeing ideas become tangible — and you need people around you who respect the work ethic it takes. You don't talk about doing things. You do them.",
    dominantDimensions: ["ambition", "discipline"],
  },
  {
    slug: "connector",
    name: "The Connector",
    summary:
      "You move through the world by building relationships that matter. You're the person who brings the right people together, who makes others feel seen, and who somehow always knows exactly who someone should meet.",
    dominantDimensions: ["community", "openness"],
  },
  {
    slug: "disciplined",
    name: "The Disciplined",
    summary:
      "Systems and habits are your superpower. While others talk about consistency, you live it. You know that the gap between who you are and who you want to be is closed one rep, one session, one day at a time.",
    dominantDimensions: ["discipline", "growth"],
  },
  {
    slug: "visionary",
    name: "The Visionary",
    summary:
      "You think in futures. You see patterns others miss, ask questions others don't bother with, and refuse to settle for 'that's just how it's done.' Your biggest challenge is finding people who can keep up.",
    dominantDimensions: ["ambition", "openness"],
  },
  {
    slug: "creator",
    name: "The Creator",
    summary:
      "You express yourself through making. Whether it's writing, building, designing, or performing — creation is how you process the world. You need space, but you also need people who understand why the work matters.",
    dominantDimensions: ["openness", "growth"],
  },
  {
    slug: "catalyst",
    name: "The Catalyst",
    summary:
      "You accelerate people. In every room you enter, energy shifts. You're not just growing yourself — you're pulling others forward with you. The right group doesn't just support you; they become better because of you.",
    dominantDimensions: ["community", "ambition"],
  },
]

/**
 * Generate drive profile from assessment answers.
 */
export function generateDriveProfile(
  userId: string,
  answers: { questionId: string; answerKey: string }[]
): Omit<DriveProfile, "id" | "createdAt" | "updatedAt"> {
  // Initialize dimension accumulators
  const dims = { ambition: 0, community: 0, discipline: 0, openness: 0, growth: 0 }
  const counts = { ambition: 0, community: 0, discipline: 0, openness: 0, growth: 0 }

  for (const answer of answers) {
    const question = ASSESSMENT_QUESTIONS.find((q) => q.id === answer.questionId)
    if (!question) continue

    const option = question.options.find((o) => o.key === answer.answerKey)
    if (!option) continue

    // Add all dimension scores from this answer
    for (const [dim, score] of Object.entries(option.scores)) {
      dims[dim as keyof typeof dims] += score
      counts[dim as keyof typeof counts]++
    }
  }

  // Normalize to 0-100 (max possible per dimension is 5 answers × 20 = 100)
  const normalize = (dim: keyof typeof dims): number =>
    Math.min(100, Math.max(0, dims[dim]))

  const ambition = normalize("ambition")
  const community = normalize("community")
  const discipline = normalize("discipline")
  const openness = normalize("openness")
  const growth = normalize("growth")

  // Find dominant archetype
  const scores = { ambition, community, discipline, openness, growth }
  const sortedDims = Object.entries(scores).sort(([, a], [, b]) => b - a)
  const [top1, top2] = sortedDims.map(([dim]) => dim)

  const archetype =
    ARCHETYPES.find(
      (a) =>
        a.dominantDimensions.includes(top1) &&
        a.dominantDimensions.includes(top2)
    ) ||
    ARCHETYPES.find((a) => a.dominantDimensions.includes(top1)) ||
    ARCHETYPES[0]

  return {
    userId,
    archetype: archetype.name,
    archetypeSlug: archetype.slug,
    summary: archetype.summary,
    ambition,
    community,
    discipline,
    openness,
    growth,
    behaviorAmplifier: 1.0,
    sessionAttendanceRate: 0,
    avgFeedbackRating: 0,
    cohortCompletionRate: 0,
    cohortsJoined: 0,
    version: 1,
  }
}

/**
 * Update behavior amplifier after cohort completion.
 * Call this when a user completes Week 4 or exits early.
 */
export function updateBehaviorAmplifier(
  currentProfile: DriveProfile,
  cohortData: {
    attendanceRate: number  // 0-1
    avgFeedbackRating: number // 1-5
    completed: boolean
  }
): { behaviorAmplifier: number; sessionAttendanceRate: number } {
  const newCohortsJoined = currentProfile.cohortsJoined + 1

  // Rolling average of attendance
  const newAttendanceRate =
    (currentProfile.sessionAttendanceRate * currentProfile.cohortsJoined +
      cohortData.attendanceRate) /
    newCohortsJoined

  // Completion bonus/penalty
  const completionMultiplier = cohortData.completed ? 1.1 : 0.9

  // Attendance-based modifier (0.7 to 1.3)
  const attendanceModifier = 0.7 + newAttendanceRate * 0.6

  // Feedback-based modifier (1-5 scale → 0.9 to 1.1)
  const feedbackModifier = 0.9 + (cohortData.avgFeedbackRating - 1) / (4 / 0.2)

  const newAmplifier = Math.min(
    1.5,
    Math.max(
      0.5,
      completionMultiplier * attendanceModifier * feedbackModifier
    )
  )

  return {
    behaviorAmplifier: Number(newAmplifier.toFixed(3)),
    sessionAttendanceRate: Number(newAttendanceRate.toFixed(3)),
  }
}
