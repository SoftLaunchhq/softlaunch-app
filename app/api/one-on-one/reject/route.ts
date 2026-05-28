import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"

/**
 * POST /api/one-on-one/reject
 *
 * Admin-only. Marks a OneOnOneMatch as REJECTED.
 *
 * Body:
 * {
 *   matchId?: string          — if updating an existing PENDING_REVIEW record
 *   userAId?: string          — alternative: identify by user pair
 *   userBId?: string
 *   reason?: string           — admin note on why rejected
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const admin = await db.user.findUnique({
      where: { clerkId },
      select: { role: true, id: true },
    })
    if (!admin || (admin.role !== "ADMIN" && admin.role !== "FOUNDER")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { matchId, userAId, userBId, reason } = body

    let match
    if (matchId) {
      match = await db.oneOnOneMatch.findUnique({ where: { id: matchId } })
    } else if (userAId && userBId) {
      match = await db.oneOnOneMatch.findFirst({
        where: {
          OR: [
            { userAId, userBId },
            { userAId: userBId, userBId: userAId },
          ],
        },
      })
    }

    if (!match) {
      // Create a rejected record so it doesn't re-surface in suggestions
      if (!userAId || !userBId) {
        return NextResponse.json({ error: "Provide matchId or userAId+userBId" }, { status: 400 })
      }
      match = await db.oneOnOneMatch.create({
        data: {
          userAId,
          userBId,
          status: "REJECTED",
          compatibilityScore: 0,
          adminNotes: reason ?? "Rejected during suggestion review",
          rejectedBy: admin.id,
          rejectedAt: new Date(),
        },
      })
    } else {
      match = await db.oneOnOneMatch.update({
        where: { id: match.id },
        data: {
          status: "REJECTED",
          adminNotes: reason ?? match.adminNotes,
          rejectedBy: admin.id,
          rejectedAt: new Date(),
        },
      })
    }

    await db.adminAction.create({
      data: {
        adminId: admin.id,
        actionType: "REJECTED_ONE_ON_ONE_MATCH",
        notes: reason ?? "No reason provided",
        metadata: { matchId: match.id },
      },
    })

    return NextResponse.json({ match, ok: true })
  } catch (err) {
    console.error("[one-on-one/reject] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
