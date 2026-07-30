/**
 * GET /api/cohorts/[id]/meetup/poll
 *
 * Returns the current active poll for the cohort's meetup,
 * including options and the calling user's vote (if any).
 *
 * Authorization: active member or admin
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"

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
    return { ok: false as const, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { ok: true as const, userId: dbUser.id, isAdmin: false, error: null }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cohortId = params.id
  const authResult = await checkMember(cohortId)
  if (!authResult.ok) return authResult.error

  try {
    // Get meetup
    const meetups = await db.$queryRaw<Array<{ id: string; state: string }>>`
      SELECT "id","state" FROM "CohortMeetup" WHERE "cohortId" = ${cohortId} LIMIT 1
    `
    const meetup = meetups[0]
    if (!meetup) return NextResponse.json({ poll: null })

    // Get poll
    const polls = await db.$queryRaw<Array<{
      id: string; meetupId: string; winnerId: string | null; closedAt: Date | null; createdAt: Date;
    }>>`
      SELECT * FROM "MeetupPoll" WHERE "meetupId" = ${meetup.id} LIMIT 1
    `
    const poll = polls[0]
    if (!poll) return NextResponse.json({ poll: null })

    // Get options with vote counts
    const options = await db.$queryRaw<Array<{
      id: string; pollId: string; order: number; name: string;
      description: string; address: string | null; type: string;
    }>>`
      SELECT * FROM "MeetupPollOption" WHERE "pollId" = ${poll.id} ORDER BY "order" ASC
    `

    const voteCounts = await db.$queryRaw<Array<{ optionId: string; count: bigint }>>`
      SELECT "optionId", COUNT(*) as count FROM "MeetupVote"
      WHERE "pollId" = ${poll.id} GROUP BY "optionId"
    `

    const voteCountMap: Record<string, number> = {}
    for (const vc of voteCounts) {
      voteCountMap[vc.optionId] = Number(vc.count)
    }

    // Get the calling user's vote
    const myVotes = await db.$queryRaw<Array<{ optionId: string }>>`
      SELECT "optionId" FROM "MeetupVote"
      WHERE "pollId" = ${poll.id} AND "userId" = ${authResult.userId}
      LIMIT 1
    `
    const myVoteOptionId = myVotes[0]?.optionId ?? null

    // Total vote count
    const totalVotes = Object.values(voteCountMap).reduce((a, b) => a + b, 0)

    return NextResponse.json({
      poll: {
        id: poll.id,
        meetupId: poll.meetupId,
        winnerId: poll.winnerId,
        closedAt: poll.closedAt?.toISOString() ?? null,
        createdAt: poll.createdAt.toISOString(),
        options: options.map((opt) => ({
          ...opt,
          voteCount: voteCountMap[opt.id] ?? 0,
        })),
        totalVotes,
        myVoteOptionId,
      },
    })
  } catch (err: any) {
    console.error("[meetup/poll] GET error:", err?.message?.slice(0, 300))
    return NextResponse.json({ error: "Failed to fetch poll" }, { status: 500 })
  }
}
