/**
 * __tests__/matching.test.ts
 *
 * Unit tests for the SoftLaunch matching engine (lib/matching.ts).
 * Uses Node.js built-in test runner (node:test) — no extra packages needed.
 *
 * Run: TS_NODE_PROJECT=tsconfig.test.json node --test --require ts-node/register __tests__/matching.test.ts
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  pairwiseScore,
  themeAlignmentScore,
  cohortCompatibilityScore,
  suggestCohorts,
  generateDriveProfile,
  updateBehaviorAmplifier,
  ARCHETYPES,
  ASSESSMENT_QUESTIONS,
  type MatchableUser,
} from "../lib/matching"

// ─────────────────────────────────────────────────────────────
// MOCK FACTORIES
// ─────────────────────────────────────────────────────────────

let _idCounter = 0
function makeId() {
  return `user-${++_idCounter}`
}

function makeDriveProfile(overrides: Partial<{
  ambition: number
  community: number
  discipline: number
  openness: number
  growth: number
  behaviorAmplifier: number
}> = {}) {
  const userId = makeId()
  return {
    id: `dp-${userId}`,
    userId,
    archetype: "Builder",
    archetypeSlug: "builder",
    summary: "Test user",
    ambition: overrides.ambition ?? 70,
    community: overrides.community ?? 60,
    discipline: overrides.discipline ?? 65,
    openness: overrides.openness ?? 55,
    growth: overrides.growth ?? 60,
    behaviorAmplifier: overrides.behaviorAmplifier ?? 1.0,
    sessionAttendanceRate: 0,
    avgFeedbackRating: 0,
    cohortCompletionRate: 0,
    cohortsJoined: 0,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeUser(overrides: {
  driveProfileOverrides?: Parameters<typeof makeDriveProfile>[0]
  cohortIntent?: "social" | "professional" | null
  themes?: string[]
} = {}): MatchableUser {
  const dp = makeDriveProfile(overrides.driveProfileOverrides)
  return {
    id: dp.userId,
    cohortIntent: overrides.cohortIntent ?? null,
    profile: {
      firstName: "Test",
      lastName: "User",
      photoUrl: null,
      headline: null,
    },
    driveProfile: dp,
    cohortPrefs: overrides.themes
      ? {
          id: `cp-${dp.userId}`,
          userId: dp.userId,
          preferredThemes: overrides.themes as any[],
          preferredDays: [],
          preferredTime: null,
          wantsFounders: false,
          wantsAthletes: false,
          wantsCreatives: false,
          wantsExecs: false,
          remoteOk: false,
          maxDistance: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      : null,
  }
}

/** Build a pool of N users, all with similar profiles (easy to form cohorts) */
function makeUserPool(n: number, intent?: "social" | "professional" | null): MatchableUser[] {
  return Array.from({ length: n }, () =>
    makeUser({ cohortIntent: intent ?? null, driveProfileOverrides: { ambition: 70 } })
  )
}

// ─────────────────────────────────────────────────────────────
// TESTS: pairwiseScore
// ─────────────────────────────────────────────────────────────

describe("pairwiseScore", () => {
  it("returns a score between 0 and 1", () => {
    const a = makeDriveProfile({ ambition: 80, discipline: 70 })
    const b = makeDriveProfile({ ambition: 75, discipline: 68 })
    const result = pairwiseScore(a, b)
    assert.ok(result.score >= 0, "score should be >= 0")
    assert.ok(result.score <= 1, "score should be <= 1")
  })

  it("gives high score to similar users", () => {
    const a = makeDriveProfile({ ambition: 75, discipline: 70, community: 50, openness: 55, growth: 65 })
    const b = makeDriveProfile({ ambition: 73, discipline: 72, community: 48, openness: 57, growth: 63 })
    const result = pairwiseScore(a, b)
    assert.ok(result.score > 0.7, `Expected high score for similar users, got ${result.score.toFixed(3)}`)
  })

  it("gives lower score to very different ambition levels", () => {
    const a = makeDriveProfile({ ambition: 100, discipline: 70, community: 50, openness: 50, growth: 50 })
    const b = makeDriveProfile({ ambition: 10, discipline: 70, community: 50, openness: 50, growth: 50 })
    const result = pairwiseScore(a, b)
    assert.ok(result.score < 0.7, `Expected lower score for very different ambition, got ${result.score.toFixed(3)}`)
  })

  it("includes a breakdown with all 5 dimensions", () => {
    const a = makeDriveProfile()
    const b = makeDriveProfile()
    const result = pairwiseScore(a, b)
    assert.ok("ambition" in result.breakdown)
    assert.ok("discipline" in result.breakdown)
    assert.ok("community" in result.breakdown)
    assert.ok("growth" in result.breakdown)
    assert.ok("openness" in result.breakdown)
  })

  it("sets correct userA and userB from driveProfile.userId", () => {
    const a = makeDriveProfile()
    const b = makeDriveProfile()
    const result = pairwiseScore(a, b)
    assert.equal(result.userA, a.userId)
    assert.equal(result.userB, b.userId)
  })
})

// ─────────────────────────────────────────────────────────────
// TESTS: themeAlignmentScore
// ─────────────────────────────────────────────────────────────

describe("themeAlignmentScore", () => {
  it("returns 0 score when no users have themes", () => {
    const users = makeUserPool(4)
    const result = themeAlignmentScore(users)
    assert.equal(result.score, 0)
    assert.equal(result.dominantTheme, null)
  })

  it("returns bonus score when 3+ users share a theme", () => {
    const users = [
      makeUser({ themes: ["CAREER_GROWTH"] }),
      makeUser({ themes: ["CAREER_GROWTH"] }),
      makeUser({ themes: ["CAREER_GROWTH"] }),
      makeUser({ themes: ["HEALTH_FITNESS"] }),
    ]
    const result = themeAlignmentScore(users)
    assert.ok(result.score > 0, "Expected positive score for shared theme")
    assert.equal(result.dominantTheme, "CAREER_GROWTH")
  })

  it("returns max bonus when all 4 share a theme", () => {
    const users = Array.from({ length: 4 }, () => makeUser({ themes: ["ENTREPRENEURSHIP"] }))
    const result4 = themeAlignmentScore(users)
    const users3 = [
      makeUser({ themes: ["ENTREPRENEURSHIP"] }),
      makeUser({ themes: ["ENTREPRENEURSHIP"] }),
      makeUser({ themes: ["ENTREPRENEURSHIP"] }),
      makeUser({ themes: ["HEALTH_FITNESS"] }),
    ]
    const result3 = themeAlignmentScore(users3)
    assert.ok(result4.score >= result3.score, "4/4 match should score at least as well as 3/4")
  })
})

// ─────────────────────────────────────────────────────────────
// TESTS: cohortCompatibilityScore
// ─────────────────────────────────────────────────────────────

describe("cohortCompatibilityScore", () => {
  it("throws if fewer than 2 members", () => {
    const users = [makeUser()]
    assert.throws(() => cohortCompatibilityScore(users), /at least 2/)
  })

  it("returns a score in 0–100 range", () => {
    const users = makeUserPool(4)
    const result = cohortCompatibilityScore(users)
    assert.ok(result.score >= 0 && result.score <= 100,
      `Score should be 0–100, got ${result.score}`)
  })

  it("returns correct number of pair scores for 4 members (C(4,2) = 6)", () => {
    const users = makeUserPool(4)
    const result = cohortCompatibilityScore(users)
    assert.equal(result.pairScores.length, 6, "Expected 6 pair scores for 4 members")
  })

  it("returns correct number of pair scores for 3 members (C(3,2) = 3)", () => {
    const users = makeUserPool(3)
    const result = cohortCompatibilityScore(users)
    assert.equal(result.pairScores.length, 3, "Expected 3 pair scores for 3 members")
  })

  it("adds ambition gap warning when gap > 35", () => {
    const users = [
      makeUser({ driveProfileOverrides: { ambition: 100 } }),
      makeUser({ driveProfileOverrides: { ambition: 60 } }),
      makeUser({ driveProfileOverrides: { ambition: 60 } }),
      makeUser({ driveProfileOverrides: { ambition: 60 } }),
    ]
    const result = cohortCompatibilityScore(users)
    const hasAmbitionWarning = result.warnings.some((w) => w.includes("Ambition gap"))
    assert.ok(hasAmbitionWarning, "Expected ambition gap warning")
  })

  it("does NOT add ambition warning when gap <= 35", () => {
    const users = [
      makeUser({ driveProfileOverrides: { ambition: 70 } }),
      makeUser({ driveProfileOverrides: { ambition: 65 } }),
      makeUser({ driveProfileOverrides: { ambition: 68 } }),
      makeUser({ driveProfileOverrides: { ambition: 72 } }),
    ]
    const result = cohortCompatibilityScore(users)
    const hasAmbitionWarning = result.warnings.some((w) => w.includes("Ambition gap"))
    assert.ok(!hasAmbitionWarning, "Should not warn about ambition when gap is small")
  })

  it("adds mixed-intent warning when social and professional in same group", () => {
    const users = [
      makeUser({ cohortIntent: "social" }),
      makeUser({ cohortIntent: "social" }),
      makeUser({ cohortIntent: "professional" }),
      makeUser({ cohortIntent: "professional" }),
    ]
    const result = cohortCompatibilityScore(users)
    const hasMixedWarning = result.warnings.some((w) => w.includes("Mixed cohort type"))
    assert.ok(hasMixedWarning, "Expected mixed-intent warning")
  })

  it("does NOT add mixed-intent warning when all are same intent", () => {
    const users = makeUserPool(4, "social")
    const result = cohortCompatibilityScore(users)
    const hasMixedWarning = result.warnings.some((w) => w.includes("Mixed cohort type"))
    assert.ok(!hasMixedWarning, "Should not warn about intent when all are social")
  })

  it("does NOT add mixed-intent warning when all have null intent", () => {
    const users = makeUserPool(4, null)
    const result = cohortCompatibilityScore(users)
    const hasMixedWarning = result.warnings.some((w) => w.includes("Mixed cohort type"))
    assert.ok(!hasMixedWarning, "Null intent users don't trigger mixed warning")
  })
})

// ─────────────────────────────────────────────────────────────
// TESTS: suggestCohorts
// ─────────────────────────────────────────────────────────────

describe("suggestCohorts", () => {
  it("throws when fewer than 4 eligible users", () => {
    const users = makeUserPool(3)
    assert.throws(() => suggestCohorts(users), /at least 4/)
  })

  it("returns at most maxSuggestions results", () => {
    const users = makeUserPool(12, "social")
    const result = suggestCohorts(users, 2)
    assert.ok(result.length <= 2, `Expected at most 2 suggestions, got ${result.length}`)
  })

  it("returns sorted by compatibilityScore descending", () => {
    const users = makeUserPool(8)
    const result = suggestCohorts(users, 2)
    if (result.length >= 2) {
      assert.ok(
        result[0].compatibilityScore >= result[1].compatibilityScore,
        "Suggestions should be sorted by score descending"
      )
    }
  })

  it("each suggestion has exactly 4 members", () => {
    const users = makeUserPool(8)
    const result = suggestCohorts(users, 3)
    for (const suggestion of result) {
      assert.equal(suggestion.members.length, 4, "Each cohort suggestion should have 4 members")
    }
  })

  it("no user appears in more than one suggestion (non-overlapping)", () => {
    const users = makeUserPool(8)
    const result = suggestCohorts(users, 2)
    const seenIds = new Set<string>()
    for (const suggestion of result) {
      for (const member of suggestion.members) {
        assert.ok(!seenIds.has(member.id), `User ${member.id} appears in multiple suggestions`)
        seenIds.add(member.id)
      }
    }
  })

  it("social users are matched together (social pool separation)", () => {
    // 4 social + 4 professional — with exhaust search, social should form their own cohort
    const socialUsers = makeUserPool(4, "social")
    const professionalUsers = makeUserPool(4, "professional")
    const allUsers = [...socialUsers, ...professionalUsers]

    const results = suggestCohorts(allUsers, 2)

    // Check that the first suggestion is pure social or pure professional (no mixed)
    const firstGroupIntents = results[0].members.map((m) => m.cohortIntent)
    const intentsInFirst = new Set(firstGroupIntents.filter(Boolean))
    assert.equal(intentsInFirst.size, 1,
      `First cohort should be pure social or pure professional. Got: ${[...intentsInFirst].join(",")}`)
  })

  it("users with null cohortIntent go to leftover pool, not social/professional pool", () => {
    const socialUsers = makeUserPool(4, "social")
    const nullUsers = makeUserPool(4, null)
    const allUsers = [...socialUsers, ...nullUsers]

    const results = suggestCohorts(allUsers, 2)

    // Social users should form a pure cohort
    const allGroupIntents = results.map((r) =>
      new Set(r.members.map((m) => m.cohortIntent).filter(Boolean))
    )

    const hasPureSocialGroup = allGroupIntents.some(
      (intents) => intents.size === 1 && intents.has("social")
    )
    assert.ok(hasPureSocialGroup, "Social users should form their own cohort")
  })

  it("includes matchingVersion in each suggestion", () => {
    const users = makeUserPool(4)
    const result = suggestCohorts(users, 1)
    assert.ok(result.length > 0)
    assert.equal(typeof result[0].matchingVersion, "number")
  })

  it("mixed pool leftover suggestions get a warning label", () => {
    // 3 social (not enough for a full group) + 3 professional (not enough) + 4 null
    // They should fall into a mixed leftover pool
    const users = [
      ...makeUserPool(3, "social"),
      ...makeUserPool(3, "professional"),
      ...makeUserPool(4, null),
    ]
    const results = suggestCohorts(users, 2)

    // At least one result should exist
    assert.ok(results.length > 0, "Should return at least one suggestion for 10 users")

    // If any result contains mixed intents, it should have a warning
    for (const suggestion of results) {
      const intents = new Set(
        suggestion.members.map((m) => m.cohortIntent).filter(Boolean)
      )
      if (intents.size > 1) {
        const hasMixedWarning = suggestion.warnings.some((w) => w.includes("Mixed cohort type"))
        assert.ok(hasMixedWarning, "Mixed-intent cohort should have a warning")
      }
    }
  })
})

// ─────────────────────────────────────────────────────────────
// TESTS: generateDriveProfile
// ─────────────────────────────────────────────────────────────

describe("generateDriveProfile", () => {
  it("produces all 5 dimensions in range 0–100", () => {
    const answers = [
      { questionId: "q1", answerKey: "career" },
      { questionId: "q2", answerKey: "output" },
      { questionId: "q3", answerKey: "exercise" },
      { questionId: "q4", answerKey: "accountability" },
      { questionId: "q5", answerKey: "building" },
    ]
    const profile = generateDriveProfile("user-gen-1", answers)
    for (const dim of ["ambition", "community", "discipline", "openness", "growth"] as const) {
      assert.ok(
        profile[dim] >= 0 && profile[dim] <= 100,
        `${dim} should be in 0-100, got ${profile[dim]}`
      )
    }
  })

  it("assigns a valid archetype name", () => {
    const answers = [
      { questionId: "q1", answerKey: "building" },
      { questionId: "q2", answerKey: "output" },
      { questionId: "q3", answerKey: "exercise" },
      { questionId: "q4", answerKey: "ambition" },
      { questionId: "q5", answerKey: "scaling" },
    ]
    const profile = generateDriveProfile("user-gen-2", answers)
    const validNames = ARCHETYPES.map((a) => a.name)
    assert.ok(
      validNames.includes(profile.archetype),
      `Archetype "${profile.archetype}" not in valid list`
    )
  })

  it("handles unknown question IDs gracefully (skips them)", () => {
    const answers = [
      { questionId: "q_nonexistent", answerKey: "career" },
      { questionId: "q1", answerKey: "career" },
    ]
    // Should not throw
    assert.doesNotThrow(() => generateDriveProfile("user-gen-3", answers))
  })

  it("handles empty answers array (returns zeroed profile with default archetype)", () => {
    const profile = generateDriveProfile("user-gen-4", [])
    assert.equal(profile.userId, "user-gen-4")
    assert.ok(ARCHETYPES.map((a) => a.name).includes(profile.archetype))
  })

  it("behaviorAmplifier starts at 1.0", () => {
    const profile = generateDriveProfile("user-gen-5", [])
    assert.equal(profile.behaviorAmplifier, 1.0)
  })
})

// ─────────────────────────────────────────────────────────────
// TESTS: updateBehaviorAmplifier
// ─────────────────────────────────────────────────────────────

describe("updateBehaviorAmplifier", () => {
  const baseProfile = {
    ...makeDriveProfile(),
    behaviorAmplifier: 1.0,
    sessionAttendanceRate: 0.8,
    cohortsJoined: 2,
  }

  it("stays in range [0.5, 1.5]", () => {
    // Test both extremes
    const resultHigh = updateBehaviorAmplifier(baseProfile, {
      attendanceRate: 1.0,
      avgFeedbackRating: 5,
      completed: true,
    })
    assert.ok(resultHigh.behaviorAmplifier <= 1.5, "Should cap at 1.5")

    const resultLow = updateBehaviorAmplifier(baseProfile, {
      attendanceRate: 0,
      avgFeedbackRating: 1,
      completed: false,
    })
    assert.ok(resultLow.behaviorAmplifier >= 0.5, "Should floor at 0.5")
  })

  it("high attendance + good rating + completion = amplifier > 1.0", () => {
    const result = updateBehaviorAmplifier(baseProfile, {
      attendanceRate: 1.0,
      avgFeedbackRating: 5,
      completed: true,
    })
    assert.ok(result.behaviorAmplifier > 1.0,
      `Expected > 1.0 for perfect cohort, got ${result.behaviorAmplifier}`)
  })

  it("low attendance + poor rating + no completion = amplifier < 1.0", () => {
    const result = updateBehaviorAmplifier(baseProfile, {
      attendanceRate: 0.2,
      avgFeedbackRating: 1,
      completed: false,
    })
    assert.ok(result.behaviorAmplifier < 1.0,
      `Expected < 1.0 for poor cohort, got ${result.behaviorAmplifier}`)
  })
})

// ─────────────────────────────────────────────────────────────
// TESTS: Assessment structure validation
// ─────────────────────────────────────────────────────────────

describe("ASSESSMENT_QUESTIONS", () => {
  it("has exactly 5 questions", () => {
    assert.equal(ASSESSMENT_QUESTIONS.length, 5, "Should have exactly 5 questions")
  })

  it("each question has exactly 5 options", () => {
    for (const q of ASSESSMENT_QUESTIONS) {
      assert.equal(q.options.length, 5, `Question ${q.id} should have 5 options`)
    }
  })

  it("every option has a scores object with all 5 dimensions", () => {
    const dims = ["ambition", "community", "discipline", "openness", "growth"]
    for (const q of ASSESSMENT_QUESTIONS) {
      for (const opt of q.options) {
        for (const dim of dims) {
          assert.ok(dim in opt.scores, `Option ${opt.key} in ${q.id} missing score for ${dim}`)
        }
      }
    }
  })

  it("question IDs are q1 through q5", () => {
    const ids = ASSESSMENT_QUESTIONS.map((q) => q.id)
    assert.deepEqual(ids, ["q1", "q2", "q3", "q4", "q5"])
  })
})

// ─────────────────────────────────────────────────────────────
// TESTS: ARCHETYPES
// ─────────────────────────────────────────────────────────────

describe("ARCHETYPES", () => {
  it("has exactly 6 archetypes", () => {
    assert.equal(ARCHETYPES.length, 6)
  })

  it("all archetype slugs are unique", () => {
    const slugs = ARCHETYPES.map((a) => a.slug)
    const unique = new Set(slugs)
    assert.equal(unique.size, slugs.length, "Duplicate archetype slugs found")
  })

  it("each archetype has exactly 2 dominant dimensions", () => {
    for (const a of ARCHETYPES) {
      assert.equal(
        a.dominantDimensions.length,
        2,
        `Archetype "${a.name}" should have 2 dominant dimensions`
      )
    }
  })

  it("all dominant dimensions are valid", () => {
    const valid = ["ambition", "community", "discipline", "openness", "growth"]
    for (const a of ARCHETYPES) {
      for (const dim of a.dominantDimensions) {
        assert.ok(valid.includes(dim), `Invalid dimension "${dim}" in archetype ${a.name}`)
      }
    }
  })
})
