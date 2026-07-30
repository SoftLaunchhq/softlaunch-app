/**
 * POST /api/cohorts/[id]/meetup/poll/vote
 *
 * Cast or change a vote in the active meetup poll.
 * One vote per user per poll — a second call replaces the first.
 *
 * Body: { optionId: string }
 *
 * Security:
 *   - User must be an ACTIVE member of this cohort
 *   - optionId must belong to the cohort's own poll
 *   - Users cannot vote on behalf of others
 *   - Poll must be open (no closedAt)
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"

function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
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
    select: { id: true, role: true },
  })
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 401 })

  // Only active members (not admins) can vote
  if (dbUser.role !== "ADMIN" && dbUser.role !== "FOUNDER") {
    const membership = await db.cohortMembership.findUnique({
      where: { cohortId_userId: { cohortId, userId: dbUser.id } },
      select: { status: true },
    })
    if (!membership || membership.status !== "ACTIVE") {
      return NextResponse.json({ error: "Forbidden: not an active member" }, { status: 403 })
    }
  }

  // ── 2. Parse body ──────────────────────────────────────────
  let optionId: string
  try {
    const body = await req.json()
    if (!body.optionId || typeof body.optionId !== "string") throw new Error("invalid")
    optionId = body.optionId
  } catch {
    return NextResponse.json({ error: "Body must include { optionId: string }" }, { status: 400 })
  }

  try {
    // ── 3. Validate option belongs to this cohort's poll ──────
    const rows = await db.$queryRaw<Array<{
      pollId: string; closedAt: Date | null; cohortId: string; meetupState: string;
    }>>`
      SELECT mv."pollId", mp."closedAt", cm."cohortId", cm."state" AS "meetupState"
      FROM "MeetupPollOption" mv
      JOIN "MeetupPoll" mp ON mp."id" = mv."pollId"
      JOIN "CohortMeetup" cm ON cm."id" = mp."meetupId"
      WHERE mv."id" = ${optionId}
      LIMIT 1
    `

    const row = rows[0]
    if (!row) return NextResponse.json({ error: "Option not found" }, { status: 404 })
    if (row.cohortId !== cohortId) return NextResponse.json({ error: "Option does not belong to this cohort" }, { status: 403 })
    if (row.closedAt) return NextResponse.json({ error: "Poll is already closed" }, { status: 409 })
    if (row.meetupState !== "POLL_ACTIVE") return NextResponse.json({ error: "Poll is not active" }, { status: 409 })

    const pollId = row.pollId

    // ── 4. Upsert vote (delete existing + insert new) ──────────
    await db.$executeRaw`
      DELETE FROM "MeetupVote" WHERE "pollId" = ${pollId} AND "userId" = ${dbUser.id}
    `
    const voteId = newId("vote")
    await db.$executeRaw`
      INSERT INTO "MeetupVote" ("id","pollId","optionId","userId","createdAt")
      VALUES (${voteId}, ${pollId}, ${optionId}, ${dbUser.id}, NOW())
    `

    // ── 5. Return updated vote counts ──────────────────────────
    const voteCounts = await db.$queryRaw<Array<{ optionId: string; count: bigint }>>`
      SELECT "optionId", COUNT(*) as count FROM "MeetupVote"
      WHERE "pollId" = ${pollId} GROUP BY "optionId"
    `

    const voteCountMap: Record<string, number> = {}
    for (const vc of voteCounts) {
      voteCountMap[vc.optionId] = Number(vc.count)
    }

    return NextResponse.json({
      success: true,
      myVoteOptionId: optionId,
      voteCounts: voteCountMap,
    })

  } catch (err: any) {
    console.error("[meetup/poll/vote] POST error:", err?.message?.slice(0, 300))
    return NextResponse.json({ error: "Failed to save vote" }, { status: 500 })
  }
}
