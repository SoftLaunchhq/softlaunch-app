/**
 * POST /api/cohorts/[id]/departure
 *
 * Records a member departing a cohort and optionally requesting a rematch.
 * Also marks their membership as CHURNED and posts a BUZZ message
 * to the cohort informing the group that a member has left.
 *
 * Body:
 *   reason           string (required, 10–500 chars)
 *   requestedRematch boolean (default false)
 *   isLocationIssue  boolean (default false)
 *
 * Security:
 *   - Caller must be an ACTIVE member of this cohort (they are leaving themselves)
 *   - Users cannot depart on behalf of others
 *   - All fields validated server-side
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { z } from "zod"
import { db } from "@/lib/db"

const DepartureSchema = z.object({
  reason:           z.string().min(10, "Please provide a brief reason (at least 10 characters)").max(500),
  requestedRematch: z.boolean().default(false),
  isLocationIssue:  z.boolean().default(false),
})

function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

// Ensure CohortDeparture table exists
async function ensureDepartureTable() {
  try {
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
  } catch (err: any) {
    console.warn("[departure] ensureTable:", err?.message?.slice(0, 200))
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cohortId = params.id

  // ── 1. Auth ────────────────────────────────────────────────
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dbUser = await db.user.findUnique({
    where: { clerkId },
    select: {
      id: true,
      role: true,
      profile: { select: { firstName: true, lastName: true } },
    },
  })
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 401 })

  // ── 2. Verify active membership ────────────────────────────
  const membership = await db.cohortMembership.findUnique({
    where: { cohortId_userId: { cohortId, userId: dbUser.id } },
    select: { status: true, id: true },
  })
  if (!membership || membership.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "You are not an active member of this cohort" },
      { status: 403 }
    )
  }

  // ── 3. Parse body ──────────────────────────────────────────
  let data: z.infer<typeof DepartureSchema>
  try {
    data = DepartureSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  await ensureDepartureTable()

  try {
    // ── 4. Get current meetup state (optional context) ─────────
    let meetupState: string | null = null
    try {
      const meetups = await db.$queryRaw<Array<{ state: string }>>`
        SELECT "state" FROM "CohortMeetup" WHERE "cohortId" = ${cohortId} LIMIT 1
      `
      meetupState = meetups[0]?.state ?? null
    } catch {
      // Non-fatal — meetup table may not exist yet
    }

    // ── 5. Record departure ────────────────────────────────────
    const departureId = newId("dep")
    await db.$executeRaw`
      INSERT INTO "CohortDeparture"
        ("id","cohortId","userId","reason","requestedRematch","isLocationIssue","meetupStateAtDeparture","createdAt")
      VALUES (
        ${departureId}, ${cohortId}, ${dbUser.id},
        ${data.reason}, ${data.requestedRematch}, ${data.isLocationIssue},
        ${meetupState}, NOW()
      )
    `

    // ── 6. Mark membership as CHURNED + set leftAt + leftReason ──
    await db.cohortMembership.update({
      where: { cohortId_userId: { cohortId, userId: dbUser.id } },
      data: {
        status: "CHURNED",
        leftAt: new Date(),
        leftReason: data.reason.slice(0, 255),
      },
    })

    // ── 7. Post BUZZ notification to cohort chat ───────────────
    const memberName = dbUser.profile
      ? `${dbUser.profile.firstName} ${dbUser.profile.lastName}`.trim()
      : "A member"

    const buzzMsg = data.requestedRematch
      ? `${memberName} has left the cohort and requested a rematch. ` +
        `The team at SoftLaunch will be in touch. Keep going — you've got this.`
      : `${memberName} has left the cohort. Wishing them well. ` +
        `If you have questions, reach out to the SoftLaunch team.`

    try {
      const msgId = newId("cm")
      await db.$executeRaw`
        INSERT INTO "CohortMessage" ("id","cohortId","senderId","senderType","senderName","content","createdAt")
        VALUES (${msgId}, ${cohortId}, NULL, 'BUZZ', 'BUZZ', ${buzzMsg}, NOW())
      `
    } catch {
      // Non-fatal — BUZZ notification is best-effort
    }

    console.log("[departure]", {
      departureId, cohortId,
      userId: dbUser.id.slice(0, 8) + "…",
      requestedRematch: data.requestedRematch,
      isLocationIssue: data.isLocationIssue,
      meetupStateAtDeparture: meetupState,
    })

    return NextResponse.json({
      success: true,
      departureId,
      requestedRematch: data.requestedRematch,
    })

  } catch (err: any) {
    console.error("[departure] POST error:", err?.message?.slice(0, 300))
    return NextResponse.json({ error: "Failed to record departure" }, { status: 500 })
  }
}
