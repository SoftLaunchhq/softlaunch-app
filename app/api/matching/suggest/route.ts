import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { suggestCohorts, type MatchableUser } from "@/lib/matching"

// POST /api/matching/suggest — Run matching algorithm (admin only)
export async function POST() {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify admin role
    const admin = await db.user.findUnique({
      where: { clerkId },
      select: { role: true, id: true },
    })

    if (!admin || (admin.role !== "ADMIN" && admin.role !== "FOUNDER")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get all users in matching pool:
    // - Completed onboarding
    // - Have a drive profile (completed assessment)
    // - Not currently in an active cohort
    const poolUsers = await db.user.findMany({
      where: {
        onboardingComplete: true,
        driveProfile: { isNot: null },
        memberships: {
          none: {
            status: { in: ["ACTIVE", "PENDING"] },
          },
        },
      },
      include: {
        profile: {
          select: {
            firstName: true,
            lastName: true,
            photoUrl: true,
            headline: true,
          },
        },
        driveProfile: true,
        cohortPrefs: true,
      },
    })

    if (poolUsers.length < 4) {
      return NextResponse.json(
        {
          error: `Not enough users in matching pool. Need at least 4, have ${poolUsers.length}.`,
          poolSize: poolUsers.length,
        },
        { status: 400 }
      )
    }

    // Cast to MatchableUser format
    const matchableUsers: MatchableUser[] = poolUsers
      .filter((u) => u.driveProfile !== null)
      .map((u) => ({
        id: u.id,
        profile: u.profile,
        driveProfile: u.driveProfile!,
        cohortPrefs: u.cohortPrefs,
      }))

    // Run matching algorithm
    const suggestions = suggestCohorts(matchableUsers, 5)

    // Log admin action
    await db.adminAction.create({
      data: {
        adminId: admin.id,
        actionType: "RAN_MATCHING",
        notes: `Ran matching engine on pool of ${poolUsers.length} users. Generated ${suggestions.length} suggestions.`,
        metadata: {
          poolSize: poolUsers.length,
          suggestionsCount: suggestions.length,
          topScore: suggestions[0]?.compatibilityScore,
        },
      },
    })

    return NextResponse.json({
      suggestions,
      poolSize: poolUsers.length,
    })
  } catch (error) {
    console.error("Matching error:", error)
    return NextResponse.json(
      { error: (error as Error).message || "Internal server error" },
      { status: 500 }
    )
  }
}
