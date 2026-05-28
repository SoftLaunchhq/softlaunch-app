import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"

/**
 * POST /api/one-on-one/approve
 *
 * Admin-only. Creates (or updates) a OneOnOneMatch record with status APPROVED.
 * If the match already exists as PENDING_REVIEW, it is promoted to APPROVED.
 * If it doesn't exist yet (admin approved directly from suggestion), it is created.
 *
 * Body:
 * {
 *   userAId: string
 *   userBId: string
 *   compatibilityScore: number
 *   matchReason?: string
 *   frictionPoints?: string[]
 *   suggestedPrompt?: string
 *   scoreBreakdown?: object
 *   adminNotes?: string
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
    const {
      userAId,
      userBId,
      compatibilityScore,
      matchReason,
      frictionPoints,
      suggestedPrompt,
      scoreBreakdown,
      adminNotes,
    } = body

    if (!userAId || !userBId || compatibilityScore === undefined) {
      return NextResponse.json({ error: "Missing required fields: userAId, userBId, compatibilityScore" }, { status: 400 })
    }

    // Verify both users exist
    const [userA, userB] = await Promise.all([
      db.user.findUnique({ where: { id: userAId }, select: { id: true } }),
      db.user.findUnique({ where: { id: userBId }, select: { id: true } }),
    ])
    if (!userA || !userB) {
      return NextResponse.json({ error: "One or both users not found" }, { status: 404 })
    }

    const now = new Date()

    // Upsert: find existing pending match or create new approved one
    const existing = await db.oneOnOneMatch.findFirst({
      where: {
        status: "PENDING_REVIEW",
        OR: [
          { userAId, userBId },
          { userAId: userBId, userBId: userAId },
        ],
      },
    })

    let match
    if (existing) {
      match = await db.oneOnOneMatch.update({
        where: { id: existing.id },
        data: {
          status: "APPROVED",
          approvedBy: admin.id,
          approvedAt: now,
          adminNotes: adminNotes ?? existing.adminNotes,
          matchReason: matchReason ?? existing.matchReason,
          frictionPoints: frictionPoints ?? existing.frictionPoints,
          suggestedPrompt: suggestedPrompt ?? existing.suggestedPrompt,
          scoreBreakdown: scoreBreakdown ?? existing.scoreBreakdown,
        },
      })
    } else {
      match = await db.oneOnOneMatch.create({
        data: {
          userAId,
          userBId,
          status: "APPROVED",
          compatibilityScore,
          matchReason: matchReason ?? null,
          frictionPoints: frictionPoints ?? [],
          suggestedPrompt: suggestedPrompt ?? null,
          scoreBreakdown: scoreBreakdown ?? null,
          adminNotes: adminNotes ?? null,
          approvedBy: admin.id,
          approvedAt: now,
        },
      })
    }

    // Log admin action
    await db.adminAction.create({
      data: {
        adminId: admin.id,
        actionType: "APPROVED_ONE_ON_ONE_MATCH",
        notes: `Approved 1-on-1 match between ${userAId} and ${userBId} (score: ${compatibilityScore.toFixed(1)})`,
        metadata: { matchId: match.id, userAId, userBId, compatibilityScore },
      },
    })

    return NextResponse.json({ match, ok: true })
  } catch (err) {
    console.error("[one-on-one/approve] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
