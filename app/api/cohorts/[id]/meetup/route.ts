/**
 * Cohort Meetup Orchestration API
 *
 * GET  /api/cohorts/[id]/meetup  — Return current meetup state + active poll
 * POST /api/cohorts/[id]/meetup  — Advance meetup state + post a BUZZ message
 *
 * POST body: { action: MeetupAction }
 *
 * Actions:
 *   "start"                  — Kick off meetup planning (BUZZ calculates availability + proposes time)
 *   "confirm_time"           — Members confirm the proposed time
 *   "everyone_in_charlotte"  — All members confirm Charlotte attendance
 *   "not_everyone_charlotte" — Flag that someone can't do Charlotte (BUZZ explains departure option)
 *   "no_existing_location"   — No one has a spot in mind → create location poll
 *   "close_poll"             — Close voting + announce winner (admin or auto after all votes in)
 *   "confirm_meetup"         — Final meetup confirmation
 *   "cancel"                 — Cancel meetup planning
 *
 * State machine:
 *   NOT_STARTED → FINDING_TIME → TIME_PROPOSED → TIME_CONFIRMED
 *   → CHECKING_LOCATION → ASKING_EXISTING_LOCATION → POLL_ACTIVE
 *   → LOCATION_CONFIRMED → MEETUP_CONFIRMED → COMPLETED
 *   → NO_COMMON_TIME (dead end — BUZZ prompts departure)
 *   → CANCELLED
 *
 * Authorization:
 *   - GET: any active member or admin
 *   - POST: any active member or admin
 *
 * Raw SQL: all new table ops use db.$queryRaw / db.$executeRaw so no prisma
 * generate is required when deploying schema changes.
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { calculateCommonAvailability, MemberAvailability } from "@/lib/availability"
import { getSuggestedLocations } from "@/lib/meetup-locations"

// ─── Types ────────────────────────────────────────────────────

export type MeetupState =
  | "NOT_STARTED"
  | "FINDING_TIME"
  | "TIME_PROPOSED"
  | "TIME_CONFIRMED"
  | "CHECKING_LOCATION"
  | "ASKING_EXISTING_LOCATION"
  | "POLL_ACTIVE"
  | "LOCATION_CONFIRMED"
  | "MEETUP_CONFIRMED"
  | "COMPLETED"
  | "NO_COMMON_TIME"
  | "TRAVEL_DECLINED"
  | "CANCELLED"

type MeetupAction =
  | "start"
  | "retry"
  | "confirm_time"
  | "everyone_in_charlotte"
  | "not_everyone_charlotte"
  | "willing_to_travel"
  | "cannot_travel"
  | "no_existing_location"
  | "close_poll"
  | "confirm_meetup"
  | "cancel"

// ─── Table Bootstrap ──────────────────────────────────────────

async function ensureMeetupTables() {
  try {
    // CohortMeetup
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS "CohortMeetup" (
        "id"               TEXT        NOT NULL,
        "cohortId"         TEXT        NOT NULL,
        "state"            TEXT        NOT NULL DEFAULT 'NOT_STARTED',
        "proposedTimeText" TEXT,
        "proposedDate"     TIMESTAMPTZ,
        "confirmedDate"    TIMESTAMPTZ,
        "allInCharlotte"   BOOLEAN,
        "locationNotes"    TEXT,
        "confirmedLocation" TEXT,
        "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "CohortMeetup_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "CohortMeetup_cohortId_unique" UNIQUE ("cohortId")
      )
    `
    await db.$executeRaw`
      CREATE INDEX IF NOT EXISTS "CohortMeetup_cohortId_idx" ON "CohortMeetup" ("cohortId")
    `
    // FK to Cohort — ignore if already exists
    await db.$executeRaw`
      DO $$ BEGIN
        ALTER TABLE "CohortMeetup"
          ADD CONSTRAINT "CohortMeetup_cohortId_fkey"
          FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `

    // MeetupPoll
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS "MeetupPoll" (
        "id"        TEXT        NOT NULL,
        "meetupId"  TEXT        NOT NULL,
        "winnerId"  TEXT,
        "deadline"  TIMESTAMPTZ,
        "closedAt"  TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "MeetupPoll_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "MeetupPoll_meetupId_unique" UNIQUE ("meetupId")
      )
    `
    // Add deadline column if missing (existing tables)
    await db.$executeRaw`
      DO $$ BEGIN
        ALTER TABLE "MeetupPoll" ADD COLUMN "deadline" TIMESTAMPTZ;
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$
    `
    await db.$executeRaw`
      DO $$ BEGIN
        ALTER TABLE "MeetupPoll"
          ADD CONSTRAINT "MeetupPoll_meetupId_fkey"
          FOREIGN KEY ("meetupId") REFERENCES "CohortMeetup"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `

    // MeetupPollOption
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS "MeetupPollOption" (
        "id"          TEXT    NOT NULL,
        "pollId"      TEXT    NOT NULL,
        "order"       INTEGER NOT NULL,
        "name"        TEXT    NOT NULL,
        "description" TEXT    NOT NULL,
        "address"     TEXT,
        "type"        TEXT    NOT NULL,
        "recommended" BOOLEAN NOT NULL DEFAULT false,
        CONSTRAINT "MeetupPollOption_pkey" PRIMARY KEY ("id")
      )
    `
    // Add recommended column if missing (existing tables)
    await db.$executeRaw`
      DO $$ BEGIN
        ALTER TABLE "MeetupPollOption" ADD COLUMN "recommended" BOOLEAN NOT NULL DEFAULT false;
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$
    `
    await db.$executeRaw`
      CREATE INDEX IF NOT EXISTS "MeetupPollOption_pollId_idx" ON "MeetupPollOption" ("pollId")
    `
    await db.$executeRaw`
      DO $$ BEGIN
        ALTER TABLE "MeetupPollOption"
          ADD CONSTRAINT "MeetupPollOption_pollId_fkey"
          FOREIGN KEY ("pollId") REFERENCES "MeetupPoll"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `

    // MeetupVote
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS "MeetupVote" (
        "id"        TEXT        NOT NULL,
        "pollId"    TEXT        NOT NULL,
        "optionId"  TEXT        NOT NULL,
        "userId"    TEXT        NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "MeetupVote_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "MeetupVote_poll_user_unique" UNIQUE ("pollId", "userId")
      )
    `
    await db.$executeRaw`
      CREATE INDEX IF NOT EXISTS "MeetupVote_pollId_idx" ON "MeetupVote" ("pollId")
    `
    await db.$executeRaw`
      CREATE INDEX IF NOT EXISTS "MeetupVote_userId_idx" ON "MeetupVote" ("userId")
    `
    await db.$executeRaw`
      DO $$ BEGIN
        ALTER TABLE "MeetupVote"
          ADD CONSTRAINT "MeetupVote_pollId_fkey"
          FOREIGN KEY ("pollId") REFERENCES "MeetupPoll"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `
    await db.$executeRaw`
      DO $$ BEGIN
        ALTER TABLE "MeetupVote"
          ADD CONSTRAINT "MeetupVote_optionId_fkey"
          FOREIGN KEY ("optionId") REFERENCES "MeetupPollOption"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `

    // CohortDeparture
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS "CohortDeparture" (
        "id"                     TEXT        NOT NULL,
        "cohortId"               TEXT        NOT NULL,
        "userId"                 TEXT        NOT NULL,
        "reason"                 TEXT        NOT NULL,
        "requestedRematch"       BOOLEAN     NOT NULL DEFAULT false,
        "isLocationIssue"        BOOLEAN     NOT NULL DEFAULT false,
        "meetupStateAtDeparture" TEXT,
        "adminReviewed"          BOOLEAN     NOT NULL DEFAULT false,
        "adminNotes"             TEXT,
        "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "CohortDeparture_pkey" PRIMARY KEY ("id")
      )
    `
    await db.$executeRaw`
      CREATE INDEX IF NOT EXISTS "CohortDeparture_cohortId_idx" ON "CohortDeparture" ("cohortId")
    `
    await db.$executeRaw`
      CREATE INDEX IF NOT EXISTS "CohortDeparture_userId_idx" ON "CohortDeparture" ("userId")
    `

    // CohortMessage — ensure table exists and has messageType / metadata columns
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS "CohortMessage" (
        "id"         TEXT        NOT NULL,
        "cohortId"   TEXT        NOT NULL,
        "senderId"   TEXT,
        "senderType" TEXT        NOT NULL DEFAULT 'MEMBER',
        "senderName" TEXT,
        "content"    TEXT        NOT NULL,
        "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "CohortMessage_pkey" PRIMARY KEY ("id")
      )
    `

  } catch (err: any) {
    console.warn("[meetup] ensureMeetupTables warning:", err?.message?.slice(0, 200))
  }
}

// ─── Auth helper ─────────────────────────────────────────────

async function checkMember(cohortId: string) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return { ok: false as const, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  const dbUser = await db.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true },
  })
  if (!dbUser) return { ok: false as const, error: NextResponse.json({ error: "User not found" }, { status: 401 }) }

  if (dbUser.role === "ADMIN" || dbUser.role === "FOUNDER") {
    return { ok: true as const, userId: dbUser.id, isAdmin: true, error: null }
  }

  const membership = await db.cohortMembership.findUnique({
    where: { cohortId_userId: { cohortId, userId: dbUser.id } },
    select: { status: true },
  })
  if (!membership || membership.status !== "ACTIVE") {
    return { ok: false as const, error: NextResponse.json({ error: "Forbidden: not an active member" }, { status: 403 }) }
  }

  return { ok: true as const, userId: dbUser.id, isAdmin: false, error: null }
}

// ─── BUZZ message helper ─────────────────────────────────────

async function saveBuzzMessage(cohortId: string, content: string) {
  const id = `buzz_meet_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  try {
    await db.$executeRaw`
      INSERT INTO "CohortMessage" ("id","cohortId","senderId","senderType","senderName","content","createdAt")
      VALUES (${id}, ${cohortId}, NULL, 'BUZZ', 'BUZZ', ${content}, NOW())
    `
  } catch (err: any) {
    console.warn("[meetup] BUZZ message save failed:", err?.message?.slice(0, 200))
  }
}

// ─── cuid-like ID ────────────────────────────────────────────

function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

// ─── GET /api/cohorts/[id]/meetup ────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cohortId = params.id
  const auth = await checkMember(cohortId)
  if (!auth.ok) return auth.error

  await ensureMeetupTables()

  try {
    // Get meetup
    const meetups = await db.$queryRaw<Array<{
      id: string; cohortId: string; state: string;
      proposedTimeText: string | null; proposedDate: Date | null;
      confirmedDate: Date | null; allInCharlotte: boolean | null;
      locationNotes: string | null; confirmedLocation: string | null;
      createdAt: Date; updatedAt: Date;
    }>>`
      SELECT * FROM "CohortMeetup" WHERE "cohortId" = ${cohortId} LIMIT 1
    `
    const meetup = meetups[0] ?? null

    if (!meetup) {
      return NextResponse.json({ meetup: null, poll: null, votes: [] })
    }

    // Get poll if any
    const polls = await db.$queryRaw<Array<{
      id: string; meetupId: string; winnerId: string | null;
      deadline: Date | null; closedAt: Date | null; createdAt: Date;
    }>>`
      SELECT * FROM "MeetupPoll" WHERE "meetupId" = ${meetup.id} LIMIT 1
    `
    let poll = polls[0] ?? null

    let options: Array<{ id: string; pollId: string; order: number; name: string; description: string; address: string | null; type: string; recommended: boolean }> = []
    let votes: Array<{ id: string; pollId: string; optionId: string; userId: string; createdAt: Date }> = []

    if (poll) {
      // Auto-close poll if past 48h deadline and still open
      if (poll.deadline && !poll.closedAt && new Date() > new Date(poll.deadline) && meetup.state === "POLL_ACTIVE") {
        // Find winning option by vote count (or first option if no votes)
        const voteCounts = await db.$queryRaw<Array<{ optionId: string; count: bigint }>>`
          SELECT "optionId", COUNT(*) as count FROM "MeetupVote"
          WHERE "pollId" = ${poll.id} GROUP BY "optionId" ORDER BY count DESC
        `
        const firstOpt = await db.$queryRaw<Array<{ id: string; name: string }>>`
          SELECT "id","name" FROM "MeetupPollOption" WHERE "pollId" = ${poll.id} ORDER BY "order" ASC LIMIT 1
        `
        const winnerId = voteCounts[0]?.optionId ?? firstOpt[0]?.id ?? null
        const winnerName = firstOpt[0]?.name ?? "the chosen spot"

        if (winnerId) {
          await db.$executeRaw`
            UPDATE "MeetupPoll" SET "winnerId" = ${winnerId}, "closedAt" = NOW() WHERE "id" = ${poll.id}
          `
          await db.$executeRaw`
            UPDATE "CohortMeetup"
            SET "state" = 'LOCATION_CONFIRMED', "confirmedLocation" = ${winnerName}, "updatedAt" = NOW()
            WHERE "id" = ${meetup.id}
          `
          await saveBuzzMessage(
            meetup.cohortId,
            `The 48-hour voting window has closed. ${winnerName} wins! ` +
            `That's where you're meeting — ${meetup.proposedTimeText ?? "at the time you confirmed"}.`
          )
          // Refresh poll + meetup
          const updatedMeetups = await db.$queryRaw<Array<typeof meetup>>`
            SELECT * FROM "CohortMeetup" WHERE "id" = ${meetup.id} LIMIT 1
          `
          if (updatedMeetups[0]) Object.assign(meetup, updatedMeetups[0])
          poll = { ...poll, winnerId, closedAt: new Date() }
        }
      }

      options = await db.$queryRaw`
        SELECT * FROM "MeetupPollOption" WHERE "pollId" = ${poll.id} ORDER BY "order" ASC
      `
      votes = await db.$queryRaw`
        SELECT * FROM "MeetupVote" WHERE "pollId" = ${poll.id}
      `
    }

    return NextResponse.json({
      meetup: {
        ...meetup,
        proposedDate: meetup.proposedDate?.toISOString() ?? null,
        confirmedDate: meetup.confirmedDate?.toISOString() ?? null,
        createdAt: meetup.createdAt.toISOString(),
        updatedAt: meetup.updatedAt.toISOString(),
      },
      poll: poll ? {
        ...poll,
        deadline: poll.deadline ? new Date(poll.deadline).toISOString() : null,
        closedAt: poll.closedAt?.toISOString() ?? null,
        createdAt: poll.createdAt.toISOString(),
        options,
      } : null,
      votes: votes.map((v) => ({ ...v, createdAt: new Date(v.createdAt).toISOString() })),
      currentUserId: auth.userId,
    })
  } catch (err: any) {
    console.error("[meetup] GET error:", err?.message?.slice(0, 300))
    return NextResponse.json({ error: "Failed to fetch meetup" }, { status: 500 })
  }
}

// ─── POST /api/cohorts/[id]/meetup ───────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cohortId = params.id
  const authResult = await checkMember(cohortId)
  if (!authResult.ok) return authResult.error

  let action: MeetupAction
  try {
    const body = await req.json()
    action = body.action as MeetupAction
    if (!action) throw new Error("missing action")
  } catch {
    return NextResponse.json({ error: "Body must include { action }" }, { status: 400 })
  }

  await ensureMeetupTables()

  try {
    // Load current cohort + member availability
    const cohort = await db.cohort.findUnique({
      where: { id: cohortId },
      select: {
        id: true, name: true, startDate: true,
        memberships: {
          where: { status: "ACTIVE" },
          select: {
            user: {
              select: {
                id: true,
                cohortIntent: true,
                profile: { select: { firstName: true } },
                cohortPrefs: { select: { preferredDays: true, preferredTime: true } },
              },
            },
          },
        },
      },
    })

    if (!cohort) return NextResponse.json({ error: "Cohort not found" }, { status: 404 })

    // Get or verify existing meetup record
    const existingMeetups = await db.$queryRaw<Array<{
      id: string; state: string; proposedTimeText: string | null; proposedDate: Date | null;
      confirmedDate: Date | null; allInCharlotte: boolean | null; confirmedLocation: string | null;
    }>>`
      SELECT * FROM "CohortMeetup" WHERE "cohortId" = ${cohortId} LIMIT 1
    `
    let meetup = existingMeetups[0] ?? null

    const cohortIntent: "social" | "professional" = (() => {
      const intents = cohort.memberships.map((m) => m.user.cohortIntent).filter(Boolean) as string[]
      const s = intents.filter((i) => i === "social").length
      return s > intents.length / 2 ? "social" : "professional"
    })()

    // ── Action handlers ────────────────────────────────────────

    if (action === "start") {
      if (meetup && meetup.state !== "NOT_STARTED" && meetup.state !== "CANCELLED") {
        return NextResponse.json({ error: "Meetup planning already in progress", state: meetup.state }, { status: 409 })
      }

      // Calculate availability
      const memberAvails: MemberAvailability[] = cohort.memberships.map((m) => ({
        userId: m.user.id,
        preferredDays: m.user.cohortPrefs?.preferredDays ?? [],
        preferredTime: m.user.cohortPrefs?.preferredTime ?? null,
      }))

      const avail = calculateCommonAvailability(memberAvails, cohort.startDate)

      if (avail.noCommonTime) {
        // Create or update record with NO_COMMON_TIME state
        const meetupId = meetup?.id ?? newId("meet")
        if (!meetup) {
          await db.$executeRaw`
            INSERT INTO "CohortMeetup" ("id","cohortId","state","createdAt","updatedAt")
            VALUES (${meetupId}, ${cohortId}, 'NO_COMMON_TIME', NOW(), NOW())
          `
        } else {
          await db.$executeRaw`
            UPDATE "CohortMeetup" SET "state" = 'NO_COMMON_TIME', "updatedAt" = NOW()
            WHERE "id" = ${meetup.id}
          `
        }

        await saveBuzzMessage(
          cohortId,
          `I looked at everyone's availability and couldn't find a time that works for the whole group yet — ` +
          `but that's completely normal, and it doesn't mean this cohort can't work. ` +
          `It just means your schedules need a bit more overlap. ` +
          `Please head to your **Availability** tab and add a few more time windows. ` +
          `Once everyone updates, hit **Retry Scheduling** and I'll check again.`
        )

        return NextResponse.json({ state: "NO_COMMON_TIME", proposedText: null })
      }

      // We have a common slot — propose it
      const meetupId = meetup?.id ?? newId("meet")
      const proposed = avail.proposedText!
      const proposedDate = avail.proposedDate!

      if (!meetup) {
        await db.$executeRaw`
          INSERT INTO "CohortMeetup"
            ("id","cohortId","state","proposedTimeText","proposedDate","createdAt","updatedAt")
          VALUES (${meetupId}, ${cohortId}, 'TIME_PROPOSED', ${proposed}, ${proposedDate}, NOW(), NOW())
        `
      } else {
        await db.$executeRaw`
          UPDATE "CohortMeetup"
          SET "state" = 'TIME_PROPOSED', "proposedTimeText" = ${proposed},
              "proposedDate" = ${proposedDate}, "updatedAt" = NOW()
          WHERE "id" = ${meetup.id}
        `
      }

      await saveBuzzMessage(
        cohortId,
        `Week one — let's get your first meetup on the calendar before the week slips by. ` +
        `Looking at everyone's schedules, **${proposed}** seems like the best window. ` +
        `Does that work for everyone? Hit "Confirm Time" below, or let me know if there's a conflict.`
      )

      return NextResponse.json({ state: "TIME_PROPOSED", proposedText: proposed })
    }

    if (action === "retry") {
      // Allowed from NO_COMMON_TIME — re-run availability calculation
      if (!meetup || meetup.state !== "NO_COMMON_TIME") {
        return NextResponse.json({ error: `Can only retry from NO_COMMON_TIME state` }, { status: 409 })
      }

      const memberAvails: MemberAvailability[] = cohort.memberships.map((m) => ({
        userId: m.user.id,
        preferredDays: m.user.cohortPrefs?.preferredDays ?? [],
        preferredTime: m.user.cohortPrefs?.preferredTime ?? null,
      }))

      const avail = calculateCommonAvailability(memberAvails, cohort.startDate)

      if (avail.noCommonTime) {
        await db.$executeRaw`
          UPDATE "CohortMeetup" SET "state" = 'NO_COMMON_TIME', "updatedAt" = NOW() WHERE "id" = ${meetup.id}
        `
        await saveBuzzMessage(
          cohortId,
          `I checked again — still not quite enough overlap to lock in a shared window. ` +
          `No worries, just keep adding availability and we'll try again. ` +
          `The more windows you open up, the easier it is for me to find a match.`
        )
        return NextResponse.json({ state: "NO_COMMON_TIME", proposedText: null })
      }

      const proposed = avail.proposedText!
      const proposedDate = avail.proposedDate!

      await db.$executeRaw`
        UPDATE "CohortMeetup"
        SET "state" = 'TIME_PROPOSED', "proposedTimeText" = ${proposed},
            "proposedDate" = ${proposedDate}, "updatedAt" = NOW()
        WHERE "id" = ${meetup.id}
      `

      await saveBuzzMessage(
        cohortId,
        `Great news — I found a window that works! ` +
        `Based on your updated availability, **${proposed}** looks like the best fit. ` +
        `Does that work for everyone? Hit "Confirm Time" below to lock it in.`
      )

      return NextResponse.json({ state: "TIME_PROPOSED", proposedText: proposed })
    }

    // All remaining actions require an existing meetup record
    if (!meetup) {
      return NextResponse.json({ error: "No meetup in progress — start one first" }, { status: 404 })
    }

    if (action === "confirm_time") {
      if (meetup.state !== "TIME_PROPOSED") {
        return NextResponse.json({ error: `Cannot confirm time in state: ${meetup.state}` }, { status: 409 })
      }

      await db.$executeRaw`
        UPDATE "CohortMeetup"
        SET "state" = 'TIME_CONFIRMED', "confirmedDate" = ${meetup.proposedDate ?? new Date()}, "updatedAt" = NOW()
        WHERE "id" = ${meetup.id}
      `

      await saveBuzzMessage(
        cohortId,
        `Locked. ${meetup.proposedTimeText ?? "That time"} — it's in the books. ` +
        `Quick check before I suggest a spot: is everyone based in Charlotte, or is anyone joining from somewhere else?`
      )

      return NextResponse.json({ state: "TIME_CONFIRMED" })
    }

    if (action === "everyone_in_charlotte") {
      if (meetup.state !== "TIME_CONFIRMED" && meetup.state !== "CHECKING_LOCATION") {
        return NextResponse.json({ error: `Cannot confirm location in state: ${meetup.state}` }, { status: 409 })
      }

      await db.$executeRaw`
        UPDATE "CohortMeetup"
        SET "state" = 'ASKING_EXISTING_LOCATION', "allInCharlotte" = true, "updatedAt" = NOW()
        WHERE "id" = ${meetup.id}
      `

      await saveBuzzMessage(
        cohortId,
        `Perfect. Anyone already have a spot in mind for the meetup, or should I put together some options?`
      )

      return NextResponse.json({ state: "ASKING_EXISTING_LOCATION" })
    }

    if (action === "not_everyone_charlotte") {
      if (meetup.state !== "TIME_CONFIRMED" && meetup.state !== "CHECKING_LOCATION") {
        return NextResponse.json({ error: `Cannot handle location issue in state: ${meetup.state}` }, { status: 409 })
      }

      await db.$executeRaw`
        UPDATE "CohortMeetup"
        SET "state" = 'CHECKING_LOCATION', "allInCharlotte" = false, "updatedAt" = NOW()
        WHERE "id" = ${meetup.id}
      `

      await saveBuzzMessage(
        cohortId,
        `Got it — no problem at all! This cohort's first meetup is in person in Charlotte. ` +
        `If you're coming from somewhere else, that's totally fine as long as you're willing to make the trip. ` +
        `Are you willing to travel to Charlotte for this meetup?`
      )

      return NextResponse.json({ state: "CHECKING_LOCATION" })
    }

    if (action === "willing_to_travel") {
      if (meetup.state !== "CHECKING_LOCATION") {
        return NextResponse.json({ error: `Cannot confirm travel in state: ${meetup.state}` }, { status: 409 })
      }

      await db.$executeRaw`
        UPDATE "CohortMeetup"
        SET "state" = 'ASKING_EXISTING_LOCATION', "allInCharlotte" = true, "updatedAt" = NOW()
        WHERE "id" = ${meetup.id}
      `

      await saveBuzzMessage(
        cohortId,
        `Awesome — glad to hear it! Let's get a spot lined up. ` +
        `Anyone already have a place in mind, or should I put together some Charlotte options?`
      )

      return NextResponse.json({ state: "ASKING_EXISTING_LOCATION" })
    }

    if (action === "cannot_travel") {
      if (meetup.state !== "CHECKING_LOCATION") {
        return NextResponse.json({ error: `Cannot process travel decline in state: ${meetup.state}` }, { status: 409 })
      }

      await db.$executeRaw`
        UPDATE "CohortMeetup"
        SET "state" = 'TRAVEL_DECLINED', "updatedAt" = NOW()
        WHERE "id" = ${meetup.id}
      `

      await saveBuzzMessage(
        cohortId,
        `Understood — no worries at all. Since this cohort's meetups take place in Charlotte and you're not able to travel there, ` +
        `we may not be the right fit for you right now. ` +
        `You have two options: **Request a Rematch** to be placed in a cohort that works for your location, ` +
        `or **Leave Cohort** if you'd prefer to step away for now. ` +
        `We hope to connect with you again soon — use the button below to take the next step.`
      )

      return NextResponse.json({ state: "TRAVEL_DECLINED" })
    }

    if (action === "no_existing_location") {
      if (meetup.state !== "ASKING_EXISTING_LOCATION") {
        return NextResponse.json({ error: `Cannot create poll in state: ${meetup.state}` }, { status: 409 })
      }

      // Check for existing open poll
      const existingPolls = await db.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "MeetupPoll" WHERE "meetupId" = ${meetup.id} AND "closedAt" IS NULL LIMIT 1
      `
      if (existingPolls.length > 0) {
        return NextResponse.json({ error: "Poll already exists" }, { status: 409 })
      }

      // Find the most common preferred location type across members (raw SQL — new column)
      const memberIds = cohort.memberships.map((m: any) => m.user.id)
      let preferredLocType: string | null = null
      try {
        const locTypes = await db.$queryRaw<Array<{ favoriteLocationType: string | null }>>`
          SELECT "favoriteLocationType" FROM "CohortPreferences"
          WHERE "userId" = ANY(${memberIds}::text[]) AND "favoriteLocationType" IS NOT NULL
        `
        const locTypeCounts: Record<string, number> = {}
        for (const row of locTypes) {
          if (row.favoriteLocationType) {
            locTypeCounts[row.favoriteLocationType] = (locTypeCounts[row.favoriteLocationType] ?? 0) + 1
          }
        }
        preferredLocType = Object.entries(locTypeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
      } catch {
        // Column may not exist yet — non-fatal, fall back to no preference
        preferredLocType = null
      }

      // Generate 4 location options, preferred type first
      const locations = getSuggestedLocations(cohortIntent, 4, preferredLocType)

      // 48-hour poll deadline
      const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000)

      const pollId = newId("poll")
      await db.$executeRaw`
        INSERT INTO "MeetupPoll" ("id","meetupId","deadline","createdAt")
        VALUES (${pollId}, ${meetup.id}, ${deadline}, NOW())
      `

      for (let i = 0; i < locations.length; i++) {
        const loc = locations[i]
        const optId = newId("opt")
        const isRecommended = i === 0 && preferredLocType !== null
        await db.$executeRaw`
          INSERT INTO "MeetupPollOption" ("id","pollId","order","name","description","address","type","recommended")
          VALUES (${optId}, ${pollId}, ${i + 1}, ${loc.name}, ${loc.description}, ${loc.address ?? null}, ${loc.type}, ${isRecommended})
        `
      }

      // Advance state
      await db.$executeRaw`
        UPDATE "CohortMeetup" SET "state" = 'POLL_ACTIVE', "updatedAt" = NOW() WHERE "id" = ${meetup.id}
      `

      await saveBuzzMessage(
        cohortId,
        `Here are 4 spots that work well for this kind of group. ` +
        `Cast your vote in the meetup panel — takes 5 seconds, helps everyone plan.`
      )

      return NextResponse.json({ state: "POLL_ACTIVE", pollId })
    }

    if (action === "close_poll") {
      if (meetup.state !== "POLL_ACTIVE") {
        return NextResponse.json({ error: `Cannot close poll in state: ${meetup.state}` }, { status: 409 })
      }

      // Find the poll
      const polls = await db.$queryRaw<Array<{ id: string; winnerId: string | null }>>`
        SELECT "id","winnerId" FROM "MeetupPoll" WHERE "meetupId" = ${meetup.id} LIMIT 1
      `
      const poll = polls[0]
      if (!poll) return NextResponse.json({ error: "No poll found" }, { status: 404 })
      if (poll.winnerId) return NextResponse.json({ error: "Poll already closed" }, { status: 409 })

      // Count votes per option
      const voteCounts = await db.$queryRaw<Array<{ optionId: string; count: bigint }>>`
        SELECT "optionId", COUNT(*) as count FROM "MeetupVote"
        WHERE "pollId" = ${poll.id} GROUP BY "optionId" ORDER BY count DESC
      `

      let winnerId: string | null = null
      let winnerName = "the chosen spot"

      if (voteCounts.length > 0) {
        winnerId = voteCounts[0].optionId
        // Look up winner name
        const winnerRows = await db.$queryRaw<Array<{ name: string; address: string | null }>>`
          SELECT "name","address" FROM "MeetupPollOption" WHERE "id" = ${winnerId} LIMIT 1
        `
        if (winnerRows[0]) {
          winnerName = winnerRows[0].name
          const winnerAddress = winnerRows[0].address

          await db.$executeRaw`
            UPDATE "MeetupPoll" SET "winnerId" = ${winnerId}, "closedAt" = NOW() WHERE "id" = ${poll.id}
          `
          await db.$executeRaw`
            UPDATE "CohortMeetup"
            SET "state" = 'LOCATION_CONFIRMED', "confirmedLocation" = ${winnerName}, "updatedAt" = NOW()
            WHERE "id" = ${meetup.id}
          `

          await saveBuzzMessage(
            cohortId,
            `${winnerName} it is. You're all set — ${meetup.proposedTimeText ?? "the time you confirmed"} ` +
            `at ${winnerName}${winnerAddress ? ` (${winnerAddress})` : ""}. ` +
            `Mark your calendars and plan to get there a few minutes early.`
          )

          return NextResponse.json({ state: "LOCATION_CONFIRMED", winner: winnerName })
        }
      }

      // No votes cast — still close and pick first option
      const firstOption = await db.$queryRaw<Array<{ id: string; name: string }>>`
        SELECT "id","name" FROM "MeetupPollOption" WHERE "pollId" = ${poll.id} ORDER BY "order" ASC LIMIT 1
      `
      if (firstOption[0]) {
        winnerId = firstOption[0].id
        winnerName = firstOption[0].name
      }

      await db.$executeRaw`
        UPDATE "MeetupPoll" SET "winnerId" = ${winnerId}, "closedAt" = NOW() WHERE "id" = ${poll.id}
      `
      await db.$executeRaw`
        UPDATE "CohortMeetup"
        SET "state" = 'LOCATION_CONFIRMED', "confirmedLocation" = ${winnerName}, "updatedAt" = NOW()
        WHERE "id" = ${meetup.id}
      `

      await saveBuzzMessage(
        cohortId,
        `Looks like the votes are in. ${winnerName} is where you're meeting. ` +
        `${meetup.proposedTimeText ?? "See you there"}.`
      )

      return NextResponse.json({ state: "LOCATION_CONFIRMED", winner: winnerName })
    }

    if (action === "confirm_meetup") {
      if (meetup.state !== "LOCATION_CONFIRMED") {
        return NextResponse.json({ error: `Cannot confirm meetup in state: ${meetup.state}` }, { status: 409 })
      }

      await db.$executeRaw`
        UPDATE "CohortMeetup" SET "state" = 'MEETUP_CONFIRMED', "updatedAt" = NOW() WHERE "id" = ${meetup.id}
      `

      await saveBuzzMessage(
        cohortId,
        `Meetup confirmed. ${meetup.proposedTimeText ?? "Time TBD"} at ${meetup.confirmedLocation ?? "your chosen spot"}. ` +
        `Show up, be present, and make the most of it — this is what Week 1 is about.`
      )

      return NextResponse.json({ state: "MEETUP_CONFIRMED" })
    }

    if (action === "cancel") {
      await db.$executeRaw`
        UPDATE "CohortMeetup" SET "state" = 'CANCELLED', "updatedAt" = NOW() WHERE "id" = ${meetup.id}
      `
      await saveBuzzMessage(cohortId, "Meetup planning has been cancelled.")
      return NextResponse.json({ state: "CANCELLED" })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })

  } catch (err: any) {
    console.error("[meetup] POST error:", err?.message?.slice(0, 400))
    return NextResponse.json({ error: "Meetup action failed" }, { status: 500 })
  }
}
