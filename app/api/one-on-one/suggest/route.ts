import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import {
  suggestAllOneOnOneMatches,
  suggestOneOnOneMatches,
  type OneOnOneMatchableUser,
} from "@/lib/matching-one-on-one"

/**
 * POST /api/one-on-one/suggest
 *
 * Admin-only. Runs the 1-on-1 matching algorithm.
 *
 * Body (optional):
 *   { targetUserId?: string }  — if provided, suggest matches for one user only
 *
 * Returns:
 *   { suggestions: OneOnOneMatchSuggestion[] }
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

    const body = await req.json().catch(() => ({}))
    const targetUserId: string | undefined = body.targetUserId

    // Fetch all eligible users for matching pool:
    // - Completed onboarding
    // - Have a DriveProfile (required for scoring)
    // - No active 1-on-1 match already (APPROVED or ACTIVE status)
    const activeMatchUserIds = await db.oneOnOneMatch.findMany({
      where: { status: { in: ["APPROVED", "ACTIVE"] } },
      select: { userAId: true, userBId: true },
    })
    const alreadyMatchedIds = new Set(
      activeMatchUserIds.flatMap((m) => [m.userAId, m.userBId])
    )

    const poolUsers = await db.user.findMany({
      where: {
        onboardingComplete: true,
        driveProfile: { isNot: null },
      },
      include: {
        profile: {
          select: { firstName: true, lastName: true, photoUrl: true, headline: true },
        },
        driveProfile: true,
        psychProfile: true,
      },
    })

    // Shape into MatchableUser
    const pool: OneOnOneMatchableUser[] = poolUsers
      .filter((u): u is typeof u & { driveProfile: NonNullable<typeof u.driveProfile> } =>
        u.driveProfile !== null
      )
      .map((u) => ({
        id: u.id,
        profile: u.profile,
        driveProfile: u.driveProfile,
        psychProfile: u.psychProfile,
      }))

    let suggestions
    if (targetUserId) {
      const targetUser = pool.find((u) => u.id === targetUserId)
      if (!targetUser) {
        return NextResponse.json({ error: "Target user not found in matching pool" }, { status: 404 })
      }
      suggestions = suggestOneOnOneMatches(pool, targetUser, 5)
    } else {
      suggestions = suggestAllOneOnOneMatches(pool, 3)
    }

    // Return serializable format
    const serialized = suggestions.map((s) => ({
      userA: {
        id: s.userA.id,
        name: `${s.userA.profile?.firstName ?? ""} ${s.userA.profile?.lastName ?? ""}`.trim(),
        firstName: s.userA.profile?.firstName ?? null,
        photoUrl: s.userA.profile?.photoUrl ?? null,
        headline: s.userA.profile?.headline ?? null,
        archetype: s.userA.driveProfile.archetype,
        archetypeSlug: s.userA.driveProfile.archetypeSlug,
        ambition: s.userA.driveProfile.ambition,
        ambitionType: s.userA.psychProfile?.ambitionType ?? null,
        energyStyle: s.userA.psychProfile?.energyStyle ?? null,
        communicationStyle: s.userA.psychProfile?.communicationStyle ?? null,
      },
      userB: {
        id: s.userB.id,
        name: `${s.userB.profile?.firstName ?? ""} ${s.userB.profile?.lastName ?? ""}`.trim(),
        firstName: s.userB.profile?.firstName ?? null,
        photoUrl: s.userB.profile?.photoUrl ?? null,
        headline: s.userB.profile?.headline ?? null,
        archetype: s.userB.driveProfile.archetype,
        archetypeSlug: s.userB.driveProfile.archetypeSlug,
        ambition: s.userB.driveProfile.ambition,
        ambitionType: s.userB.psychProfile?.ambitionType ?? null,
        energyStyle: s.userB.psychProfile?.energyStyle ?? null,
        communicationStyle: s.userB.psychProfile?.communicationStyle ?? null,
      },
      compatibilityScore: s.compatibilityScore,
      breakdown: s.breakdown,
      matchReason: s.matchReason,
      frictionPoints: s.frictionPoints,
      suggestedPrompt: s.suggestedPrompt,
      warnings: s.warnings,
    }))

    return NextResponse.json({ suggestions: serialized, total: serialized.length })
  } catch (err) {
    console.error("[one-on-one/suggest] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
