/**
 * SoftLaunch — 1-on-1 Matching Engine
 *
 * Extends the cohort matching system to find one highly compatible
 * peer for any given user.
 *
 * Scoring uses BOTH DriveProfile (quantitative) and PsychProfile
 * (qualitative/behavioral), giving a richer compatibility signal
 * than cohort matching alone.
 *
 * Design:
 *   - Reuses pairwiseScore() from lib/matching.ts for dimension math
 *   - Adds 7 PsychProfile compatibility checks on top
 *   - Returns ranked suggestions with human-readable reasoning
 */

import type { DriveProfile, PsychProfile } from "@prisma/client"
import { pairwiseScore } from "./matching"

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface OneOnOneMatchableUser {
  id: string
  profile: {
    firstName: string
    lastName: string
    photoUrl: string | null
    headline: string | null
  } | null
  driveProfile: DriveProfile
  psychProfile: PsychProfile | null
}

export interface OneOnOneScoreBreakdown {
  // Drive dimensions (from existing pairwiseScore)
  ambition: number       // 0-1
  discipline: number     // 0-1
  community: number      // 0-1
  growth: number         // 0-1
  openness: number       // 0-1

  // Psych dimensions (new, 1-on-1 specific)
  communicationStyle: number  // 0-1 — compatible messaging styles
  emotionalDriver: number     // 0-1 — shared motivational basis
  accountabilityFit: number   // 0-1 — complementary accountability needs
  idealPeerOverlap: number    // 0-1 — user's ideal traits ↔ other's traits
  redFlagAvoidance: number    // 0-1 — penalty for red-flag matches
  energyCompatibility: number // 0-1 — compatible energy styles

  // Composite
  driveScore: number   // 0-1 weighted average of drive dims
  psychScore: number   // 0-1 weighted average of psych dims
  finalScore: number   // 0-100 composite
}

export interface OneOnOneMatchSuggestion {
  userA: OneOnOneMatchableUser
  userB: OneOnOneMatchableUser
  compatibilityScore: number          // 0-100
  breakdown: OneOnOneScoreBreakdown
  matchReason: string                 // Human-readable narrative
  frictionPoints: string[]            // Potential friction areas
  suggestedPrompt: string             // First message suggestion for BUZZ
  warnings: string[]                  // Admin review flags
}

// ─────────────────────────────────────────────────────────────
// PSYCH SCORING HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Communication style compatibility matrix.
 * Some styles pair well (direct+direct), others clash (storyteller+direct).
 */
const COMM_COMPAT: Record<string, Record<string, number>> = {
  "direct-concise":  { "direct-concise": 0.95, "storyteller": 0.60, "listener-first": 0.85, "analytical": 0.80 },
  "storyteller":     { "direct-concise": 0.60, "storyteller": 0.80, "listener-first": 0.90, "analytical": 0.70 },
  "listener-first":  { "direct-concise": 0.85, "storyteller": 0.90, "listener-first": 0.75, "analytical": 0.85 },
  "analytical":      { "direct-concise": 0.80, "storyteller": 0.70, "listener-first": 0.85, "analytical": 0.90 },
}

/**
 * Accountability style compatibility.
 * Best pairings: external-pressure + partner-based (they both benefit),
 * self-directed + self-directed (mutual respect without dependency).
 */
const ACCT_COMPAT: Record<string, Record<string, number>> = {
  "external-pressure": { "external-pressure": 0.65, "self-directed": 0.70, "partner-based": 0.95, "system-driven": 0.75 },
  "self-directed":     { "external-pressure": 0.70, "self-directed": 0.90, "partner-based": 0.75, "system-driven": 0.80 },
  "partner-based":     { "external-pressure": 0.95, "self-directed": 0.75, "partner-based": 0.85, "system-driven": 0.70 },
  "system-driven":     { "external-pressure": 0.75, "self-directed": 0.80, "partner-based": 0.70, "system-driven": 0.90 },
}

/**
 * Energy style compatibility.
 * High-output + high-output = exciting but may burn out.
 * High-output + cyclical = good balance.
 */
const ENERGY_COMPAT: Record<string, Record<string, number>> = {
  "high-output":      { "high-output": 0.80, "selective-focus": 0.85, "cyclical": 0.75, "collaborative": 0.90 },
  "selective-focus":  { "high-output": 0.85, "selective-focus": 0.90, "cyclical": 0.80, "collaborative": 0.80 },
  "cyclical":         { "high-output": 0.75, "selective-focus": 0.80, "cyclical": 0.85, "collaborative": 0.80 },
  "collaborative":    { "high-output": 0.90, "selective-focus": 0.80, "cyclical": 0.80, "collaborative": 0.85 },
}

/** Emotional driver similarity bonus — shared motivation creates resonance. */
function emotionalDriverScore(a: string | null, b: string | null): number {
  if (!a || !b) return 0.70 // unknown — neutral
  if (a === b) return 0.90   // identical driver = deep resonance
  // Complementary pairs
  const COMPLEMENTARY: [string, string][] = [
    ["achievement", "mastery"],
    ["belonging", "impact"],
    ["freedom", "impact"],
    ["mastery", "achievement"],
  ]
  if (COMPLEMENTARY.some(([x, y]) => (a === x && b === y) || (a === y && b === x))) return 0.85
  return 0.65
}

/** Look up a compatibility score from a matrix, falling back gracefully. */
function matrixLookup(
  matrix: Record<string, Record<string, number>>,
  a: string | null,
  b: string | null,
  fallback = 0.70
): number {
  if (!a || !b) return fallback
  return matrix[a]?.[b] ?? matrix[b]?.[a] ?? fallback
}

/**
 * How much does user B embody user A's ideal peer traits?
 * Uses the PsychProfile.idealPeerTraits array to compute overlap.
 */
function idealPeerOverlapScore(
  userA: PsychProfile | null,
  userB: PsychProfile | null
): number {
  if (!userA || !userB) return 0.70

  const aTraits = new Set(userA.idealPeerTraits ?? [])
  const bTraits = new Set(userB.idealPeerTraits ?? [])

  if (aTraits.size === 0 && bTraits.size === 0) return 0.70

  // What fraction of A's ideals does B also value (approximate proxy)?
  // Real system: compare traits against B's PsychProfile.ambitionType, etc.
  // MVP: use symmetric overlap of traits arrays
  const union = new Set([...aTraits, ...bTraits])
  const intersection = [...aTraits].filter((t) => bTraits.has(t))
  const jaccardSimilarity = union.size > 0 ? intersection.length / union.size : 0

  // 0.5 base + up to 0.5 for full overlap
  return 0.50 + jaccardSimilarity * 0.50
}

/**
 * Penalty when user B has a trait that user A listed as a red flag.
 */
function redFlagPenalty(
  userA: PsychProfile | null,
  userB: PsychProfile | null
): number {
  if (!userA || !userB) return 0 // no data, no penalty

  const aRedFlags = userA.redFlagsToAvoid ?? []
  const bAmbitionType = userB.ambitionType ?? ""
  const bEnergyStyle = userB.energyStyle ?? ""

  // Check if B's traits overlap with A's red flags
  const bSignals = [bAmbitionType, bEnergyStyle]
  const hitCount = aRedFlags.filter((flag) =>
    bSignals.some((signal) => signal.includes(flag) || flag.includes(signal))
  ).length

  // 0.15 penalty per red flag hit, max 0.40
  return Math.min(0.40, hitCount * 0.15)
}

// ─────────────────────────────────────────────────────────────
// CORE SCORING
// ─────────────────────────────────────────────────────────────

/**
 * Enhanced pairwise score for 1-on-1 matching.
 * Combines DriveProfile (from existing engine) with PsychProfile.
 */
export function oneOnOneScore(
  userA: OneOnOneMatchableUser,
  userB: OneOnOneMatchableUser
): OneOnOneScoreBreakdown {
  // ── Drive dimensions (reuse existing engine) ──
  const base = pairwiseScore(userA.driveProfile, userB.driveProfile)
  const driveScore =
    base.breakdown.ambition * 0.30 +
    base.breakdown.discipline * 0.25 +
    base.breakdown.community * 0.20 +
    base.breakdown.growth * 0.15 +
    base.breakdown.openness * 0.10

  // ── Psych dimensions ──
  const pa = userA.psychProfile
  const pb = userB.psychProfile

  const communicationStyle = matrixLookup(COMM_COMPAT, pa?.communicationStyle ?? null, pb?.communicationStyle ?? null)
  const emotionalDriver = emotionalDriverScore(pa?.emotionalDriver ?? null, pb?.emotionalDriver ?? null)
  const accountabilityFit = matrixLookup(ACCT_COMPAT, pa?.accountabilityNeed ?? null, pb?.accountabilityNeed ?? null)
  const energyCompatibility = matrixLookup(ENERGY_COMPAT, pa?.energyStyle ?? null, pb?.energyStyle ?? null)
  const idealPeerOverlap = idealPeerOverlapScore(pa, pb)

  // Red flag penalty: check both ways
  const penaltyAtoB = redFlagPenalty(pa, pb)
  const penaltyBtoA = redFlagPenalty(pb, pa)
  const avgPenalty = (penaltyAtoB + penaltyBtoA) / 2
  const redFlagAvoidance = Math.max(0, 1 - avgPenalty)

  // Psych composite
  const psychScore =
    communicationStyle * 0.25 +
    emotionalDriver * 0.20 +
    accountabilityFit * 0.20 +
    energyCompatibility * 0.15 +
    idealPeerOverlap * 0.15 +
    redFlagAvoidance * 0.05

  // If psych profiles are missing, weight drive score more heavily
  const hasPsychData = pa && pb && (pa.communicationStyle || pa.ambitionType)
  const driveWeight = hasPsychData ? 0.45 : 0.80
  const psychWeight = hasPsychData ? 0.55 : 0.20

  const rawFinal = driveScore * driveWeight + psychScore * psychWeight
  const finalScore = Math.min(100, Math.max(0, rawFinal * 100))

  return {
    ambition: base.breakdown.ambition,
    discipline: base.breakdown.discipline,
    community: base.breakdown.community,
    growth: base.breakdown.growth,
    openness: base.breakdown.openness,
    communicationStyle,
    emotionalDriver,
    accountabilityFit,
    energyCompatibility,
    idealPeerOverlap,
    redFlagAvoidance,
    driveScore,
    psychScore,
    finalScore,
  }
}

// ─────────────────────────────────────────────────────────────
// NARRATIVE GENERATION
// ─────────────────────────────────────────────────────────────

/** Generates a premium human-readable match reason. */
export function generateMatchReason(
  userA: OneOnOneMatchableUser,
  userB: OneOnOneMatchableUser,
  breakdown: OneOnOneScoreBreakdown
): string {
  const nameB = userB.profile?.firstName ?? "your match"
  const nameA = userA.profile?.firstName ?? "you"
  const pa = userA.psychProfile
  const pb = userB.psychProfile

  const lines: string[] = []

  // Ambition alignment
  if (breakdown.ambition > 0.80) {
    lines.push(`${nameB} operates at your ambition level — neither of you will need to slow down for the other.`)
  } else if (breakdown.ambition > 0.65) {
    lines.push(`Your ambition and ${nameB}'s are well-matched — enough similarity to understand each other, enough difference to push.`)
  }

  // Communication
  if (breakdown.communicationStyle > 0.85) {
    lines.push(`Your communication styles are highly compatible — expect conversations that feel natural and direct.`)
  } else if (breakdown.communicationStyle > 0.70) {
    lines.push(`Your communication approaches complement each other — ${nameB} tends to ${pb?.communicationStyle?.replace(/-/g, " ")} while you lean ${pa?.communicationStyle?.replace(/-/g, " ")}.`)
  }

  // Accountability
  if (breakdown.accountabilityFit > 0.85) {
    lines.push(`Your accountability styles are a strong fit — one pushes, one pulls, and both of you benefit.`)
  }

  // Emotional driver
  if (pa?.emotionalDriver && pb?.emotionalDriver) {
    if (pa.emotionalDriver === pb.emotionalDriver) {
      lines.push(`You share a core drive around ${pa.emotionalDriver.replace(/-/g, " ")} — that shared hunger creates lasting connection.`)
    } else {
      lines.push(`${nameB} is motivated by ${pb.emotionalDriver.replace(/-/g, " ")} while you're driven by ${pa.emotionalDriver.replace(/-/g, " ")} — different fuel, same engine.`)
    }
  }

  // Discipline
  if (breakdown.discipline > 0.80) {
    lines.push(`Your discipline levels align — neither of you will tolerate excuses from the other.`)
  }

  // Fallback if few signals
  if (lines.length === 0) {
    lines.push(
      `${nameB} was selected because your psychological profiles, ambition levels, and behavioral patterns show the highest compatibility in the current pool.`
    )
  }

  return lines.slice(0, 3).join(" ")
}

/** Generates potential friction point warnings. */
export function generateFrictionPoints(
  userA: OneOnOneMatchableUser,
  userB: OneOnOneMatchableUser,
  breakdown: OneOnOneScoreBreakdown
): string[] {
  const nameB = userB.profile?.firstName ?? "your match"
  const pa = userA.psychProfile
  const pb = userB.psychProfile
  const friction: string[] = []

  if (breakdown.communicationStyle < 0.65) {
    friction.push(`Communication styles differ — ${nameB} may need more context than you naturally give, or vice versa. Name this early.`)
  }

  if (breakdown.ambition < 0.60) {
    friction.push(`Ambition gap detected. Set clear expectations about pace and output early so neither feels dragged or overwhelmed.`)
  }

  if (breakdown.accountabilityFit < 0.65) {
    friction.push(`Different accountability needs — agree on a structure for how you'll hold each other to commitments.`)
  }

  if (breakdown.energyCompatibility < 0.65) {
    friction.push(`Energy styles differ (${pa?.energyStyle?.replace(/-/g, " ")} vs. ${pb?.energyStyle?.replace(/-/g, " ")}) — best to schedule touchpoints around peak times.`)
  }

  if (breakdown.redFlagAvoidance < 0.75) {
    friction.push(`There are potential personality frictions in this match. Admin review is strongly recommended before activation.`)
  }

  return friction
}

/** Generates a suggested first message for BUZZ to offer the user. */
export function generateSuggestedPrompt(
  userA: OneOnOneMatchableUser,
  userB: OneOnOneMatchableUser
): string {
  const nameB = userB.profile?.firstName ?? "them"
  const nameA = userA.profile?.firstName ?? "them"
  const archetypeB = userB.driveProfile.archetype
  const pa = userA.psychProfile
  const pb = userB.psychProfile

  // Context-aware suggestion
  if (pa?.accountabilityNeed === "partner-based" || pb?.accountabilityNeed === "partner-based") {
    return `Hey ${nameB} — I'm ${nameA}. I saw we're both matched here. I've been looking for a real accountability partner, not just someone to chat with. What's the one thing you're pushing hardest on right now?`
  }

  if (pb?.ambitionType === "relentless-builder" || userB.driveProfile.ambition > 75) {
    return `Hey ${nameB}, I'm ${nameA}. We got matched — I looked at your background and I'm genuinely curious about the work you're doing. What's the biggest thing you're trying to crack right now?`
  }

  return `Hey ${nameB} — I'm ${nameA}. SoftLaunch matched us based on our profiles and I think I can see why. I'd love to start with a simple question: what does a genuinely productive week look like for you right now?`
}

// ─────────────────────────────────────────────────────────────
// MAIN SUGGESTION FUNCTION
// ─────────────────────────────────────────────────────────────

/**
 * Find the best 1-on-1 match for a target user from a pool.
 *
 * Returns ranked suggestions — admin reviews and picks one to approve.
 */
export function suggestOneOnOneMatches(
  pool: OneOnOneMatchableUser[],
  targetUser: OneOnOneMatchableUser,
  maxSuggestions = 5
): OneOnOneMatchSuggestion[] {
  // Filter out the target user and users without drive profiles
  const eligibleUsers = pool.filter(
    (u) => u.id !== targetUser.id && u.driveProfile
  )

  if (eligibleUsers.length === 0) return []

  // Score all eligible users against target
  const scored = eligibleUsers.map((candidate) => {
    const breakdown = oneOnOneScore(targetUser, candidate)
    const matchReason = generateMatchReason(targetUser, candidate, breakdown)
    const frictionPoints = generateFrictionPoints(targetUser, candidate, breakdown)
    const suggestedPrompt = generateSuggestedPrompt(targetUser, candidate)

    const warnings: string[] = []
    if (breakdown.finalScore < 55) {
      warnings.push(`Low overall score (${breakdown.finalScore.toFixed(0)}) — consider finding more users before approving.`)
    }
    if (breakdown.redFlagAvoidance < 0.75) {
      warnings.push("Potential red flag overlap detected — review psychographic notes before approving.")
    }
    if (!targetUser.psychProfile || !candidate.psychProfile) {
      warnings.push("One or both users have incomplete BUZZ profiles — score accuracy may be reduced.")
    }

    return {
      userA: targetUser,
      userB: candidate,
      compatibilityScore: breakdown.finalScore,
      breakdown,
      matchReason,
      frictionPoints,
      suggestedPrompt,
      warnings,
    }
  })

  // Sort by score descending
  scored.sort((a, b) => b.compatibilityScore - a.compatibilityScore)

  return scored.slice(0, maxSuggestions)
}

/**
 * Run 1-on-1 matching across an entire pool — pairs everyone optimally.
 * Used by the admin "Run All" function.
 *
 * Returns a list of match suggestions (one per user pair).
 * Admin reviews each pair and approves or rejects.
 */
export function suggestAllOneOnOneMatches(
  pool: OneOnOneMatchableUser[],
  maxPerUser = 3
): OneOnOneMatchSuggestion[] {
  const suggestions: OneOnOneMatchSuggestion[] = []
  const seen = new Set<string>() // "userA_userB" key to avoid duplicate pairs

  for (const user of pool) {
    const matches = suggestOneOnOneMatches(pool, user, maxPerUser)
    for (const match of matches) {
      const key = [match.userA.id, match.userB.id].sort().join("_")
      if (!seen.has(key)) {
        seen.add(key)
        suggestions.push(match)
      }
    }
  }

  // Sort by score
  suggestions.sort((a, b) => b.compatibilityScore - a.compatibilityScore)

  return suggestions
}
