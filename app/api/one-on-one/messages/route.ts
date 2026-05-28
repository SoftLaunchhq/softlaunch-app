import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"

/**
 * GET /api/one-on-one/messages?matchId=...
 *
 * Returns paginated messages for a 1-on-1 match.
 * User must be a participant in the match.
 */
export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const matchId = searchParams.get("matchId")
    const cursor = searchParams.get("cursor") // message id for pagination
    const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "30", 10))

    if (!matchId) return NextResponse.json({ error: "matchId required" }, { status: 400 })

    // Verify user is in this match
    const match = await db.oneOnOneMatch.findFirst({
      where: {
        id: matchId,
        OR: [{ userAId: user.id }, { userBId: user.id }],
        status: { in: ["APPROVED", "ACTIVE"] },
      },
    })
    if (!match) return NextResponse.json({ error: "Match not found or not accessible" }, { status: 404 })

    const messages = await db.oneOnOneMessage.findMany({
      where: { matchId, ...(cursor ? { id: { lt: cursor } } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      include: {
        sender: {
          select: {
            id: true,
            profile: {
              select: { firstName: true, lastName: true, photoUrl: true },
            },
          },
        },
      },
    })

    const hasMore = messages.length > limit
    const items = hasMore ? messages.slice(0, limit) : messages
    const nextCursor = hasMore ? items[items.length - 1].id : null

    return NextResponse.json({
      messages: items.reverse(), // chronological order
      hasMore,
      nextCursor,
    })
  } catch (err) {
    console.error("[one-on-one/messages GET] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/one-on-one/messages
 *
 * Send a message in a 1-on-1 match.
 *
 * Body: { matchId: string, content: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const body = await req.json()
    const { matchId, content } = body

    if (!matchId || !content?.trim()) {
      return NextResponse.json({ error: "matchId and content required" }, { status: 400 })
    }

    if (content.length > 4000) {
      return NextResponse.json({ error: "Message too long (max 4000 chars)" }, { status: 400 })
    }

    // Verify user is in this match and it's ACTIVE or APPROVED
    const match = await db.oneOnOneMatch.findFirst({
      where: {
        id: matchId,
        OR: [{ userAId: user.id }, { userBId: user.id }],
        status: { in: ["APPROVED", "ACTIVE"] },
      },
    })
    if (!match) return NextResponse.json({ error: "Match not found or not accessible" }, { status: 404 })

    // Create message
    const message = await db.oneOnOneMessage.create({
      data: {
        matchId,
        senderId: user.id,
        content: content.trim(),
      },
      include: {
        sender: {
          select: {
            id: true,
            profile: {
              select: { firstName: true, lastName: true, photoUrl: true },
            },
          },
        },
      },
    })

    // If match was APPROVED, auto-activate it on first message
    if (match.status === "APPROVED") {
      await db.oneOnOneMatch.update({
        where: { id: matchId },
        data: { status: "ACTIVE", activatedAt: new Date() },
      })
    }

    return NextResponse.json({ message, ok: true })
  } catch (err) {
    console.error("[one-on-one/messages POST] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
