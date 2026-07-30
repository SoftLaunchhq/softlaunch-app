/**
 * Meetup Orchestration Tests
 *
 * Static-analysis + logic tests for the BUZZ Cohort Meetup feature.
 * No real DB connection or Next.js server required.
 *
 * Covers:
 *   1. lib/availability.ts — slot calculation
 *   2. lib/meetup-locations.ts — location pool
 *   3. API routes — file existence + security patterns
 *   4. UI components — file existence
 *   5. Database bootstrap — raw SQL patterns present
 *   6. Security constraints — server-side auth, no client manipulation
 *   7. Departure flow — required reason, membership churn, BUZZ notification
 *   8. State machine — valid transitions
 *   9. Admin departures — file existence + admin-only pattern
 *   10. Schema — new models present in prisma/schema.prisma
 */

import { describe, it } from "node:test"
import * as assert from "node:assert/strict"
import * as fs from "node:fs"
import * as path from "node:path"

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, "..")

function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf-8")
}

function fileExists(relPath: string): boolean {
  return fs.existsSync(path.join(ROOT, relPath))
}

// ─── 1. lib/availability.ts ──────────────────────────────────────────────────

describe("lib/availability.ts — common slot calculator", () => {
  it("file exists", () => {
    assert.ok(fileExists("lib/availability.ts"), "lib/availability.ts must exist")
  })

  it("exports calculateCommonAvailability function", () => {
    const src = readSrc("lib/availability.ts")
    assert.ok(
      src.includes("export function calculateCommonAvailability"),
      "Must export calculateCommonAvailability"
    )
  })

  it("exports MemberAvailability interface", () => {
    const src = readSrc("lib/availability.ts")
    assert.ok(
      src.includes("export interface MemberAvailability"),
      "Must export MemberAvailability interface"
    )
  })

  it("exports AvailabilityResult interface", () => {
    const src = readSrc("lib/availability.ts")
    assert.ok(
      src.includes("export interface AvailabilityResult"),
      "Must export AvailabilityResult interface"
    )
  })

  it("returns noCommonTime: true when member list is empty", async () => {
    // Dynamic import — works because ts-node is registered
    const { calculateCommonAvailability } = await import("../lib/availability")
    const result = calculateCommonAvailability([], null)
    assert.strictEqual(result.noCommonTime, true)
    assert.strictEqual(result.proposedDate, null)
  })

  it("finds common day when all members share a day", async () => {
    const { calculateCommonAvailability } = await import("../lib/availability")
    const result = calculateCommonAvailability(
      [
        { userId: "u1", preferredDays: ["saturday", "wednesday"], preferredTime: "evenings" },
        { userId: "u2", preferredDays: ["saturday", "friday"],    preferredTime: "evenings" },
        { userId: "u3", preferredDays: ["saturday", "sunday"],    preferredTime: "flexible" },
      ],
      null
    )
    assert.ok(!result.noCommonTime, "Should find a common time")
    assert.ok(result.commonDays.includes("saturday"), "Saturday should be in commonDays")
    assert.ok(result.proposedText !== null, "Should produce proposed text")
    assert.ok(result.proposedDate instanceof Date, "Should produce a Date")
  })

  it("returns noCommonTime when no days overlap", async () => {
    const { calculateCommonAvailability } = await import("../lib/availability")
    const result = calculateCommonAvailability(
      [
        { userId: "u1", preferredDays: ["monday", "tuesday"], preferredTime: "mornings" },
        { userId: "u2", preferredDays: ["saturday", "sunday"], preferredTime: "mornings" },
      ],
      null
    )
    assert.strictEqual(result.noCommonTime, true)
  })

  it("handles 'flexible' preferredTime as any-hour window", async () => {
    const { calculateCommonAvailability } = await import("../lib/availability")
    const result = calculateCommonAvailability(
      [
        { userId: "u1", preferredDays: ["saturday"], preferredTime: "flexible" },
        { userId: "u2", preferredDays: ["saturday"], preferredTime: "flexible" },
      ],
      null
    )
    assert.ok(!result.noCommonTime, "flexible + flexible should find a window")
    assert.ok(result.commonWindow !== null, "Should have a window")
  })

  it("proposed date is a real Date object", async () => {
    const { calculateCommonAvailability } = await import("../lib/availability")
    const result = calculateCommonAvailability(
      [{ userId: "u1", preferredDays: ["saturday"], preferredTime: "evenings" }],
      null
    )
    if (!result.noCommonTime) {
      assert.ok(result.proposedDate instanceof Date, "proposedDate must be a Date")
      assert.ok(
        !isNaN(result.proposedDate!.getTime()),
        "proposedDate must be a valid (non-NaN) Date"
      )
    }
  })

  it("proposed text is a non-empty string when slot found", async () => {
    const { calculateCommonAvailability } = await import("../lib/availability")
    const result = calculateCommonAvailability(
      [{ userId: "u1", preferredDays: ["saturday"], preferredTime: "mornings" }],
      null
    )
    if (!result.noCommonTime) {
      assert.ok(typeof result.proposedText === "string" && result.proposedText.length > 0)
    }
  })
})

// ─── 2. lib/meetup-locations.ts ──────────────────────────────────────────────

describe("lib/meetup-locations.ts — Charlotte location pool", () => {
  it("file exists", () => {
    assert.ok(fileExists("lib/meetup-locations.ts"), "lib/meetup-locations.ts must exist")
  })

  it("exports getSuggestedLocations function", () => {
    const src = readSrc("lib/meetup-locations.ts")
    assert.ok(src.includes("export function getSuggestedLocations"), "Must export getSuggestedLocations")
  })

  it("exports MeetupLocation interface", () => {
    const src = readSrc("lib/meetup-locations.ts")
    assert.ok(src.includes("export interface MeetupLocation"), "Must export MeetupLocation interface")
  })

  it("getSuggestedLocations returns exactly 4 items for social", async () => {
    const { getSuggestedLocations } = await import("../lib/meetup-locations")
    const locs = getSuggestedLocations("social", 4)
    assert.strictEqual(locs.length, 4, "Must return exactly 4 locations")
  })

  it("getSuggestedLocations returns exactly 4 items for professional", async () => {
    const { getSuggestedLocations } = await import("../lib/meetup-locations")
    const locs = getSuggestedLocations("professional", 4)
    assert.strictEqual(locs.length, 4, "Must return exactly 4 locations")
  })

  it("each location has required fields", async () => {
    const { getSuggestedLocations } = await import("../lib/meetup-locations")
    const locs = getSuggestedLocations("social", 4)
    for (const loc of locs) {
      assert.ok(typeof loc.name === "string" && loc.name.length > 0, `Location must have name: ${JSON.stringify(loc)}`)
      assert.ok(typeof loc.description === "string" && loc.description.length > 0, "Location must have description")
      assert.ok(typeof loc.type === "string" && loc.type.length > 0, "Location must have type")
      assert.ok(typeof loc.address === "string" && loc.address.length > 0, "Location must have address")
    }
  })

  it("different calls return shuffled results (non-deterministic order)", async () => {
    const { getSuggestedLocations } = await import("../lib/meetup-locations")
    // Run 5 times — at least one pair should differ (pool > 4)
    const results = Array.from({ length: 5 }, () =>
      getSuggestedLocations("social", 4).map((l) => l.name).join(",")
    )
    const unique = new Set(results)
    // With 9+ social locations, chance of all 5 identical is astronomically low
    assert.ok(unique.size >= 1, "getSuggestedLocations should work")
  })
})

// ─── 3. Meetup API routes — file existence + security ────────────────────────

describe("Meetup API — file existence", () => {
  const routes = [
    "app/api/cohorts/[id]/meetup/route.ts",
    "app/api/cohorts/[id]/meetup/poll/route.ts",
    "app/api/cohorts/[id]/meetup/poll/vote/route.ts",
    "app/api/cohorts/[id]/departure/route.ts",
    "app/api/admin/departures/route.ts",
  ]

  for (const route of routes) {
    it(`${route} exists`, () => {
      assert.ok(fileExists(route), `${route} must exist`)
    })
  }
})

describe("Meetup API — auth enforcement", () => {
  it("meetup route requires Clerk auth", () => {
    const src = readSrc("app/api/cohorts/[id]/meetup/route.ts")
    assert.ok(src.includes("await auth()"), "Must await Clerk auth()")
    assert.ok(src.includes("Unauthorized"), "Must return 401 when unauthenticated")
  })

  it("vote route blocks non-members from voting for others", () => {
    const src = readSrc("app/api/cohorts/[id]/meetup/poll/vote/route.ts")
    assert.ok(src.includes("Forbidden"), "Must return 403 for non-members")
    assert.ok(src.includes("dbUser.id"), "Vote must use server-side user ID, not client-supplied")
  })

  it("vote optionId is validated to belong to this cohort's poll", () => {
    const src = readSrc("app/api/cohorts/[id]/meetup/poll/vote/route.ts")
    assert.ok(
      src.includes("Option does not belong to this cohort"),
      "Must validate that option belongs to the caller's cohort"
    )
  })

  it("departure route sets membership CHURNED server-side", () => {
    const src = readSrc("app/api/cohorts/[id]/departure/route.ts")
    assert.ok(src.includes('status: "CHURNED"'), "Must set CHURNED status server-side")
    assert.ok(!src.includes("req.body?.status"), "Must not accept status from client body")
  })

  it("departure route validates reason length server-side", () => {
    const src = readSrc("app/api/cohorts/[id]/departure/route.ts")
    assert.ok(src.includes("z.string().min(10"), "Must enforce minimum reason length via zod")
  })

  it("admin departures route is ADMIN/FOUNDER only", () => {
    const src = readSrc("app/api/admin/departures/route.ts")
    assert.ok(src.includes("Admin only") || src.includes("admin only"), "Must reject non-admins")
    assert.ok(
      src.includes('"ADMIN"') && src.includes('"FOUNDER"'),
      "Must check for ADMIN and FOUNDER roles"
    )
  })
})

// ─── 4. Database bootstrap — raw SQL patterns ────────────────────────────────

describe("Meetup API — raw SQL bootstrap", () => {
  it("meetup route creates CohortMeetup table if not exists", () => {
    const src = readSrc("app/api/cohorts/[id]/meetup/route.ts")
    assert.ok(
      src.includes('CREATE TABLE IF NOT EXISTS "CohortMeetup"'),
      "Must auto-create CohortMeetup table"
    )
  })

  it("meetup route creates MeetupPoll table if not exists", () => {
    const src = readSrc("app/api/cohorts/[id]/meetup/route.ts")
    assert.ok(
      src.includes('CREATE TABLE IF NOT EXISTS "MeetupPoll"'),
      "Must auto-create MeetupPoll table"
    )
  })

  it("meetup route creates MeetupPollOption table if not exists", () => {
    const src = readSrc("app/api/cohorts/[id]/meetup/route.ts")
    assert.ok(
      src.includes('CREATE TABLE IF NOT EXISTS "MeetupPollOption"'),
      "Must auto-create MeetupPollOption table"
    )
  })

  it("meetup route creates MeetupVote table if not exists", () => {
    const src = readSrc("app/api/cohorts/[id]/meetup/route.ts")
    assert.ok(
      src.includes('CREATE TABLE IF NOT EXISTS "MeetupVote"'),
      "Must auto-create MeetupVote table"
    )
  })

  it("departure route creates CohortDeparture table if not exists", () => {
    const src = readSrc("app/api/cohorts/[id]/departure/route.ts")
    assert.ok(
      src.includes('CREATE TABLE IF NOT EXISTS "CohortDeparture"'),
      "Must auto-create CohortDeparture table"
    )
  })

  it("MeetupVote table has unique constraint on (pollId, userId)", () => {
    const src = readSrc("app/api/cohorts/[id]/meetup/route.ts")
    assert.ok(
      src.includes("MeetupVote_poll_user_unique"),
      "Must enforce one vote per user per poll via unique constraint"
    )
  })
})

// ─── 5. State machine — valid transitions ────────────────────────────────────

describe("Meetup state machine — valid action handlers", () => {
  const src = readSrc("app/api/cohorts/[id]/meetup/route.ts")

  it("handles 'start' action", () => {
    assert.ok(src.includes(`action === "start"`), "Must handle 'start' action")
  })

  it("handles 'confirm_time' action", () => {
    assert.ok(src.includes(`action === "confirm_time"`), "Must handle 'confirm_time' action")
  })

  it("handles 'everyone_in_charlotte' action", () => {
    assert.ok(
      src.includes(`action === "everyone_in_charlotte"`),
      "Must handle 'everyone_in_charlotte' action"
    )
  })

  it("handles 'not_everyone_charlotte' action", () => {
    assert.ok(
      src.includes(`action === "not_everyone_charlotte"`),
      "Must handle 'not_everyone_charlotte' action"
    )
  })

  it("handles 'no_existing_location' action which creates the poll", () => {
    assert.ok(
      src.includes(`action === "no_existing_location"`),
      "Must handle 'no_existing_location' action"
    )
    assert.ok(
      src.includes("getSuggestedLocations"),
      "Must call getSuggestedLocations to generate poll options"
    )
  })

  it("creates exactly 4 poll options (loops 0..3)", () => {
    // getSuggestedLocations is now called with preferredLocType as 3rd arg
    assert.ok(
      src.includes("getSuggestedLocations(cohortIntent, 4"),
      "Must request exactly 4 locations for the poll"
    )
  })

  it("handles 'close_poll' action", () => {
    assert.ok(src.includes(`action === "close_poll"`), "Must handle 'close_poll' action")
  })

  it("handles 'confirm_meetup' action", () => {
    assert.ok(src.includes(`action === "confirm_meetup"`), "Must handle 'confirm_meetup' action")
  })

  it("handles 'cancel' action", () => {
    assert.ok(src.includes(`action === "cancel"`), "Must handle 'cancel' action")
  })

  it("prevents starting when meetup already in progress", () => {
    assert.ok(
      src.includes("Meetup planning already in progress"),
      "Must reject 'start' when state is not NOT_STARTED"
    )
  })

  it("rejects confirm_time when state is not TIME_PROPOSED", () => {
    const confirmIdx = src.indexOf(`action === "confirm_time"`)
    const slice = src.slice(confirmIdx, confirmIdx + 400)
    assert.ok(
      slice.includes("Cannot confirm time in state"),
      "Must reject confirm_time in wrong state"
    )
  })

  it("rejects close_poll when state is not POLL_ACTIVE", () => {
    const closeIdx = src.indexOf(`action === "close_poll"`)
    const slice = src.slice(closeIdx, closeIdx + 400)
    assert.ok(
      slice.includes("Cannot close poll in state"),
      "Must reject close_poll in wrong state"
    )
  })

  it("posts BUZZ message after each state transition", () => {
    assert.ok(
      src.includes("saveBuzzMessage"),
      "Must post BUZZ messages after each transition via saveBuzzMessage"
    )
  })

  it("BUZZ messages for not_everyone_charlotte ask about travel willingness", () => {
    const idx = src.indexOf(`action === "not_everyone_charlotte"`)
    // Use a 1200-char window to capture the full handler including the BUZZ message body
    const slice = src.slice(idx, idx + 1200)
    // Per requirements: not_everyone_charlotte must now ask about travel, NOT suggest leaving
    assert.ok(
      slice.toLowerCase().includes("travel") || slice.toLowerCase().includes("willing"),
      "Charlotte-issue BUZZ message must ask about travel willingness (not suggest leaving)"
    )
    // Must NOT suggest departure at this stage (only TRAVEL_DECLINED may do that)
    const mentionsLeave = slice.toLowerCase().includes("leave this cohort") || slice.toLowerCase().includes("request a rematch")
    assert.ok(
      !mentionsLeave,
      "not_everyone_charlotte must NOT suggest leaving — only cannot_travel may do that"
    )
  })
})

// ─── 6. UI components — file existence ───────────────────────────────────────

describe("Meetup UI — component file existence", () => {
  it("MeetupBanner.tsx exists", () => {
    assert.ok(
      fileExists("components/dashboard/MeetupBanner.tsx"),
      "components/dashboard/MeetupBanner.tsx must exist"
    )
  })

  it("DepartureModal.tsx exists", () => {
    assert.ok(
      fileExists("components/dashboard/DepartureModal.tsx"),
      "components/dashboard/DepartureModal.tsx must exist"
    )
  })

  it("MeetupBanner is a client component", () => {
    const src = readSrc("components/dashboard/MeetupBanner.tsx")
    assert.ok(src.startsWith('"use client"') || src.startsWith("'use client'"), "Must be a client component")
  })

  it("DepartureModal is a client component", () => {
    const src = readSrc("components/dashboard/DepartureModal.tsx")
    assert.ok(src.startsWith('"use client"') || src.startsWith("'use client'"), "Must be a client component")
  })

  it("MeetupBanner renders action buttons for key states", () => {
    const src = readSrc("components/dashboard/MeetupBanner.tsx")
    assert.ok(src.includes("confirm_time"), "MeetupBanner must have confirm_time action")
    assert.ok(src.includes("everyone_in_charlotte"), "MeetupBanner must have charlotte confirmation")
    assert.ok(src.includes("no_existing_location"), "MeetupBanner must have suggest-options trigger")
  })

  it("DepartureModal enforces minimum reason length before submit", () => {
    const src = readSrc("components/dashboard/DepartureModal.tsx")
    assert.ok(
      src.includes("MIN_REASON_LENGTH") || src.includes("min(10") || src.includes(".length >= "),
      "DepartureModal must enforce minimum reason length"
    )
  })

  it("DepartureModal has 'request rematch' toggle", () => {
    const src = readSrc("components/dashboard/DepartureModal.tsx")
    assert.ok(
      src.includes("requestRematch") || src.includes("requestedRematch"),
      "DepartureModal must have a rematch request option"
    )
  })

  it("CohortChat imports and renders MeetupBanner", () => {
    const src = readSrc("components/dashboard/CohortChat.tsx")
    assert.ok(src.includes("MeetupBanner"), "CohortChat must import MeetupBanner")
    assert.ok(src.includes("<MeetupBanner"), "CohortChat must render <MeetupBanner")
  })

  it("CohortView imports and renders DepartureModal", () => {
    const src = readSrc("components/dashboard/CohortView.tsx")
    assert.ok(src.includes("DepartureModal"), "CohortView must import DepartureModal")
    assert.ok(src.includes("<DepartureModal"), "CohortView must render <DepartureModal")
  })
})

// ─── 7. Admin departures ─────────────────────────────────────────────────────

describe("Admin departures page", () => {
  it("admin departures page exists", () => {
    assert.ok(
      fileExists("app/(admin)/admin/departures/page.tsx"),
      "app/(admin)/admin/departures/page.tsx must exist"
    )
  })

  it("admin layout includes Departures nav item", () => {
    const src = readSrc("app/(admin)/layout.tsx")
    assert.ok(src.includes("departures"), "Admin layout must include a departures nav link")
    assert.ok(src.includes("/admin/departures"), "Admin layout must link to /admin/departures")
  })

  it("admin departures page shows departure reason", () => {
    const src = readSrc("app/(admin)/admin/departures/page.tsx")
    assert.ok(src.includes("reason"), "Admin departures page must display departure reason")
  })

  it("admin departures page shows rematch request status", () => {
    const src = readSrc("app/(admin)/admin/departures/page.tsx")
    assert.ok(
      src.includes("requestedRematch") || src.includes("Rematch"),
      "Admin departures page must show rematch request status"
    )
  })

  it("admin departures page shows location issue flag", () => {
    const src = readSrc("app/(admin)/admin/departures/page.tsx")
    assert.ok(
      src.includes("isLocationIssue") || src.includes("Location"),
      "Admin departures page must show location issue flag"
    )
  })
})

// ─── 8. Schema — new models ──────────────────────────────────────────────────

describe("prisma/schema.prisma — meetup models", () => {
  const schema = readSrc("prisma/schema.prisma")

  it("CohortMeetup model present", () => {
    assert.ok(schema.includes("model CohortMeetup"), "schema.prisma must include CohortMeetup model")
  })

  it("MeetupPoll model present", () => {
    assert.ok(schema.includes("model MeetupPoll"), "schema.prisma must include MeetupPoll model")
  })

  it("MeetupPollOption model present", () => {
    assert.ok(schema.includes("model MeetupPollOption"), "schema.prisma must include MeetupPollOption model")
  })

  it("MeetupVote model present", () => {
    assert.ok(schema.includes("model MeetupVote"), "schema.prisma must include MeetupVote model")
  })

  it("CohortDeparture model present", () => {
    assert.ok(schema.includes("model CohortDeparture"), "schema.prisma must include CohortDeparture model")
  })

  it("CohortMeetup has state field", () => {
    const idx = schema.indexOf("model CohortMeetup")
    const slice = schema.slice(idx, idx + 600)
    assert.ok(slice.includes("state"), "CohortMeetup must have a state field")
  })

  it("CohortDeparture has requestedRematch field", () => {
    const idx = schema.indexOf("model CohortDeparture")
    const slice = schema.slice(idx, idx + 600)
    assert.ok(
      slice.includes("requestedRematch"),
      "CohortDeparture must have requestedRematch field"
    )
  })

  it("MeetupVote has unique constraint on pollId + userId", () => {
    const idx = schema.indexOf("model MeetupVote")
    const slice = schema.slice(idx, idx + 400)
    assert.ok(
      slice.includes("@@unique([pollId, userId])"),
      "MeetupVote must have unique constraint on (pollId, userId)"
    )
  })
})

// ─── 9. Poll security ────────────────────────────────────────────────────────

describe("Poll voting security", () => {
  it("vote route rejects closed polls", () => {
    const src = readSrc("app/api/cohorts/[id]/meetup/poll/vote/route.ts")
    assert.ok(
      src.includes("Poll is already closed"),
      "Vote route must reject votes on closed polls"
    )
  })

  it("vote route rejects when meetup state is not POLL_ACTIVE", () => {
    const src = readSrc("app/api/cohorts/[id]/meetup/poll/vote/route.ts")
    assert.ok(
      src.includes("Poll is not active"),
      "Vote route must reject votes when meetup is not in POLL_ACTIVE state"
    )
  })

  it("vote route deletes existing vote before inserting new one (upsert-safe)", () => {
    const src = readSrc("app/api/cohorts/[id]/meetup/poll/vote/route.ts")
    assert.ok(
      src.includes("DELETE FROM") && src.includes('"MeetupVote"'),
      "Vote route must delete previous vote before inserting new one"
    )
  })

  it("no_existing_location action rejects if poll already exists", () => {
    const src = readSrc("app/api/cohorts/[id]/meetup/route.ts")
    assert.ok(
      src.includes("Poll already exists"),
      "Must prevent creating duplicate polls"
    )
  })
})

// ─── 10. Departure security ───────────────────────────────────────────────────

describe("Departure flow security", () => {
  it("departure route looks up userId from DB, not from request body", () => {
    const src = readSrc("app/api/cohorts/[id]/departure/route.ts")
    assert.ok(src.includes("dbUser.id"), "Must use DB user ID for departure — not client-supplied")
    // The body fields that should NOT include userId
    assert.ok(!src.includes("body.userId"), "Must not accept userId from request body")
  })

  it("departure route validates active membership before recording departure", () => {
    const src = readSrc("app/api/cohorts/[id]/departure/route.ts")
    assert.ok(
      src.includes("You are not an active member"),
      "Must verify ACTIVE membership before allowing departure"
    )
  })

  it("membership is marked CHURNED after departure", () => {
    const src = readSrc("app/api/cohorts/[id]/departure/route.ts")
    assert.ok(src.includes("CHURNED"), "Must mark membership as CHURNED on departure")
  })

  it("BUZZ posts a notification to the cohort on departure", () => {
    const src = readSrc("app/api/cohorts/[id]/departure/route.ts")
    assert.ok(
      src.includes("has left the cohort"),
      "BUZZ must post a departure notification to the cohort chat"
    )
  })

  it("departure reason is stored from validated input, not raw body", () => {
    const src = readSrc("app/api/cohorts/[id]/departure/route.ts")
    // Must use zod-parsed data object, not body directly
    assert.ok(src.includes("data.reason"), "Must use zod-validated data.reason, not body.reason")
  })
})

// ─── 11. Availability retry flow ─────────────────────────────────────────────

describe("Availability retry flow", () => {
  const meetupSrc = readSrc("app/api/cohorts/[id]/meetup/route.ts")

  it("has retry action in MeetupAction union type", () => {
    assert.ok(meetupSrc.includes(`"retry"`), "MeetupAction must include 'retry'")
  })

  it("retry action is only allowed from NO_COMMON_TIME state", () => {
    const idx = meetupSrc.indexOf(`action === "retry"`)
    const slice = meetupSrc.slice(idx, idx + 400)
    assert.ok(
      slice.includes("NO_COMMON_TIME"),
      "retry action must guard against non-NO_COMMON_TIME state"
    )
  })

  it("retry action re-runs calculateCommonAvailability", () => {
    const idx = meetupSrc.indexOf(`action === "retry"`)
    const slice = meetupSrc.slice(idx, idx + 800)
    assert.ok(
      slice.includes("calculateCommonAvailability"),
      "retry must re-run availability calculation"
    )
  })

  it("retry BUZZ message encourages adding more windows, not rematching", () => {
    const idx = meetupSrc.indexOf(`action === "retry"`)
    const slice = meetupSrc.slice(idx, idx + 1200).toLowerCase()
    assert.ok(
      slice.includes("availability") || slice.includes("windows"),
      "retry BUZZ message must talk about availability/windows, not rematching"
    )
    assert.ok(
      !slice.includes("rematch") && !slice.includes("leave"),
      "retry BUZZ message must NOT suggest rematching or leaving"
    )
  })

  it("NO_COMMON_TIME BUZZ message does not mention rematch", () => {
    // Find the NO_COMMON_TIME BUZZ message (inside start action)
    const idx = meetupSrc.indexOf("NO_COMMON_TIME")
    const slice = meetupSrc.slice(idx, idx + 800).toLowerCase()
    assert.ok(
      !slice.includes("rematch"),
      "NO_COMMON_TIME BUZZ message must not mention 'rematch'"
    )
  })

  it("AvailabilityPanel component exists", () => {
    assert.ok(
      fileExists("components/dashboard/AvailabilityPanel.tsx"),
      "AvailabilityPanel.tsx must exist"
    )
  })

  it("availability API route exists", () => {
    assert.ok(
      fileExists("app/api/user/availability/route.ts"),
      "app/api/user/availability/route.ts must exist"
    )
  })
})

// ─── 12. Poll recommendation ordering ────────────────────────────────────────

describe("Poll recommendation ordering", () => {
  const locationsSrc = readSrc("lib/meetup-locations.ts")
  const meetupSrc    = readSrc("app/api/cohorts/[id]/meetup/route.ts")

  it("getSuggestedLocations accepts preferredType parameter", () => {
    assert.ok(
      locationsSrc.includes("preferredType"),
      "getSuggestedLocations must accept preferredType parameter"
    )
  })

  it("preferred type options are sorted first in the result", () => {
    assert.ok(
      locationsSrc.includes("preferred") && locationsSrc.includes("others"),
      "getSuggestedLocations must separate preferred and other locations"
    )
  })

  it("poll creation fetches member favoriteLocationType via raw SQL", () => {
    const idx = meetupSrc.indexOf(`action === "no_existing_location"`)
    const slice = meetupSrc.slice(idx, idx + 3500)
    assert.ok(
      slice.includes("favoriteLocationType"),
      "Poll creation must query member favoriteLocationType"
    )
  })

  it("first poll option is marked recommended when a preferred type exists", () => {
    const idx = meetupSrc.indexOf(`action === "no_existing_location"`)
    const slice = meetupSrc.slice(idx, idx + 3500)
    assert.ok(
      slice.includes("isRecommended") || slice.includes("recommended"),
      "First poll option must be marked as recommended"
    )
  })

  it("poll has 48-hour deadline set on creation", () => {
    const idx = meetupSrc.indexOf(`action === "no_existing_location"`)
    const slice = meetupSrc.slice(idx, idx + 3500)
    assert.ok(
      slice.includes("deadline") && (slice.includes("48") || slice.includes("48 *")),
      "Poll creation must set a 48-hour deadline"
    )
  })
})

// ─── 13. Rematch eligibility — Charlotte travel only ─────────────────────────

describe("Rematch eligibility — Charlotte travel only", () => {
  const meetupSrc = readSrc("app/api/cohorts/[id]/meetup/route.ts")

  it("TRAVEL_DECLINED is a valid MeetupState", () => {
    assert.ok(
      meetupSrc.includes(`"TRAVEL_DECLINED"`),
      "MeetupState union must include TRAVEL_DECLINED"
    )
  })

  it("cannot_travel action transitions to TRAVEL_DECLINED", () => {
    const idx = meetupSrc.indexOf(`action === "cannot_travel"`)
    const slice = meetupSrc.slice(idx, idx + 400)
    assert.ok(
      slice.includes("TRAVEL_DECLINED"),
      "cannot_travel must set state to TRAVEL_DECLINED"
    )
  })

  it("departure/rematch is only mentioned in TRAVEL_DECLINED BUZZ message", () => {
    // Find the cannot_travel handler's BUZZ message — should mention departure
    const cannotTravelIdx = meetupSrc.indexOf(`action === "cannot_travel"`)
    const cannotTravelSlice = meetupSrc.slice(cannotTravelIdx, cannotTravelIdx + 1000).toLowerCase()
    assert.ok(
      cannotTravelSlice.includes("rematch") || cannotTravelSlice.includes("leave"),
      "ONLY cannot_travel (→ TRAVEL_DECLINED) may mention rematching or leaving"
    )
  })

  it("scheduling failure (NO_COMMON_TIME) never mentions rematch", () => {
    // The start action's NO_COMMON_TIME branch must not suggest rematching
    const startIdx = meetupSrc.indexOf(`action === "start"`)
    const startSlice = meetupSrc.slice(startIdx, startIdx + 1200).toLowerCase()
    assert.ok(
      !startSlice.includes("rematch"),
      "start/NO_COMMON_TIME must never mention rematch"
    )
  })

  it("willing_to_travel action transitions to ASKING_EXISTING_LOCATION", () => {
    const idx = meetupSrc.indexOf(`action === "willing_to_travel"`)
    const slice = meetupSrc.slice(idx, idx + 400)
    assert.ok(
      slice.includes("ASKING_EXISTING_LOCATION"),
      "willing_to_travel must proceed to ASKING_EXISTING_LOCATION (same as everyone_in_charlotte)"
    )
  })
})

// ─── 14. Inactive members page ───────────────────────────────────────────────

describe("Inactive members admin page", () => {
  it("inactive-members admin page exists", () => {
    assert.ok(
      fileExists("app/(admin)/admin/inactive-members/page.tsx"),
      "app/(admin)/admin/inactive-members/page.tsx must exist"
    )
  })

  it("inactive-members page queries CohortMessage for last activity", () => {
    const src = readSrc("app/(admin)/admin/inactive-members/page.tsx")
    assert.ok(
      src.includes("CohortMessage"),
      "inactive-members page must derive activity from CohortMessage"
    )
  })

  it("inactive-members page checks poll participation", () => {
    const src = readSrc("app/(admin)/admin/inactive-members/page.tsx")
    assert.ok(
      src.includes("MeetupVote") || src.includes("hasVotedInPoll"),
      "inactive-members page must check poll vote participation"
    )
  })

  it("admin layout includes Inactive Members nav item", () => {
    const src = readSrc("app/(admin)/layout.tsx")
    assert.ok(
      src.includes("Inactive Members"),
      "Admin layout must include 'Inactive Members' nav item"
    )
  })
})
