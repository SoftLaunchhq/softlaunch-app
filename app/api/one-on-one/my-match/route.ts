import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"

/**
 * GET /api/one-on-one/my-match
 *
 * Authenticated user. Returns the current user's 1-on-1 match (if any).
 *
 * Returns:
 * {
 *   match: {
 *     id, status, compatibilityScore, matchReason, frictionPoints,
 *     suggestedPrompt, scoreBreakdown, approvedAt, activatedAt,
 *     peer: { id, firstName, lastName, photoUrl, headline, archetype,
 *             archetypeSlug, ambitionType, energyStyle, communicationStyle,
 *             summary }
 *   } | null
 * }
 */
export async function GET() {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    // Find the most recent non-rejected match (APPROVED or ACTIVE takes priority)
    const match = await db.oneOnOneMatch.findFirst({
      where: {
        status: { in: ["APPROVED", "ACTIVE", "PENDING_REVIEW", "REMATCHING"] },
        OR: [{ userAId: user.id }, { userBId: user.id }],
      },
      orderBy: [
        // Priority: ACTIVE > APPROVED > PENDING_REVIEW > REMATCHING
        { activatedAt: "desc" },
        { approvedAt: "desc" },
        { createdAt: "desc" },
      ],
    })

    if (!match) {
      return NextResponse.json({ match: null })
    }

    // Figure out who the peer is
    const peerId = match.userAId === user.id ? match.userBId : match.userAId
    const isPendingReview = match.status === "PENDING_REVIEW" || match.status === "REMATCHING"

    // For PENDING_REVIEW, don't reveal the peer's identity
    if (isPendingReview) {
      return NextResponse.json({
        match: {
          id: match.id,
          status: match.status,
          compatibilityScore: match.compatibilityScore,
          createdAt: match.createdAt,
          peer: null,
        },
      })
    }

    // Fetch peer details for approved/active matches
    const peer = await db.user.findUnique({
      where: { id: peerId },
      include: {
        profile: {
          select: {
            firstName: true,
            lastName: true,
            photoUrl: true,
            headline: true,
            bio: true,
            linkedinUrl: true,
          },
        },
        driveProfile: {
          select: {
            archetype: true,
            archetypeSlug: true,
            summary: true,
            ambition: true,
            discipline: true,
            community: true,
            openness: true,
            growth: true,
          },
        },
        psychProfile: {
          select: {
            ambitionType: true,
            energyStyle: true,
            communicationStyle: true,
            accountabilityNeed: true,
            emotionalDriver: true,
            summary: true,
          },
        },
      },
    })

    return NextResponse.json({
      match: {
        id: match.id,
        status: match.status,
        compatibilityScore: match.compatibilityScore,
        matchReason: match.matchReason,
        frictionPoints: match.frictionPoints,
        suggestedPrompt: match.suggestedPrompt,
        scoreBreakdown: match.scoreBreakdown,
        approvedAt: match.approvedAt,
        activatedAt: match.activatedAt,
        createdAt: match.createdAt,
        userARequestedRematch: match.userARequestedRematch,
        userBRequestedRematch: match.userBRequestedRematch,
        isUserA: match.userAId === user.id,
        peer: peer
          ? {
              id: peer.id,
              firstName: peer.profile?.firstName ?? null,
              lastName: peer.profile?.lastName ?? null,
              photoUrl: peer.profile?.photoUrl ?? null,
              headline: peer.profile?.headline ?? null,
              bio: peer.profile?.bio ?? null,
              linkedinUrl: peer.profile?.linkedinUrl ?? null,
              archetype: peer.driveProfile?.archetype ?? null,
              archetypeSlug: peer.driveProfile?.archetypeSlug ?? null,
              driveSummary: peer.driveProfile?.summary ?? null,
              ambition: peer.driveProfile?.ambition ?? null,
              ambitionType: peer.psychProfile?.ambitionType ?? null,
              energyStyle: peer.psychProfile?.energyStyle ?? null,
              communicationStyle: peer.psychProfile?.communicationStyle ?? null,
              accountabilityNeed: peer.psychProfile?.accountabilityNeed ?? null,
              emotionalDriver: peer.psychProfile?.emotionalDriver ?? null,
              psychSummary: peer.psychProfile?.summary ?? null,
            }
          : null,
      },
    })
  } catch (err) {
    console.error("[one-on-one/my-match] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/one-on-one/my-match
 *
 * Activate (mark as ACTIVE) or request a rematch.
 *
 * Body: { action: "activate" | "request_rematch" }
 */
export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const body = await req.json()
    const { action, matchId } = body

    const match = await db.oneOnOneMatch.findFirst({
      where: {
        id: matchId,
        OR: [{ userAId: user.id }, { userBId: user.id }],
      },
    })

    if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 })

    if (action === "activate" && match.status === "APPROVED") {
      await db.oneOnOneMatch.update({
        where: { id: match.id },
        data: { status: "ACTIVE", activatedAt: new Date() },
      })
      return NextResponse.json({ ok: true, status: "ACTIVE" })
    }

    if (action === "request_rematch") {
      const isUserA = match.userAId === user.id
      await db.oneOnOneMatch.update({
        where: { id: match.id },
        data: isUserA
          ? { userARequestedRematch: true }
          : { userBRequestedRematch: true },
      })
      return NextResponse.json({ ok: true, rematchRequested: true })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (err) {
    console.error("[one-on-one/my-match POST] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
