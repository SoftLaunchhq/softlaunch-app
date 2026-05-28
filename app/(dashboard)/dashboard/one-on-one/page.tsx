import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { MatchLockedState } from "@/components/one-on-one/MatchLockedState"
import { MatchPendingState } from "@/components/one-on-one/MatchPendingState"
import { MatchReviewState } from "@/components/one-on-one/MatchReviewState"
import { MatchActiveView } from "@/components/one-on-one/MatchActiveView"

// ─────────────────────────────────────────────────────────────
// DATA FETCHING
// ─────────────────────────────────────────────────────────────

async function getPageData(clerkId: string) {
  const user = await db.user.findUnique({
    where: { clerkId },
    include: {
      profile: {
        select: { firstName: true, lastName: true, photoUrl: true, headline: true },
      },
      driveProfile: { select: { archetype: true, ambition: true } },
      psychProfile: {
        select: {
          ambitionType: true, energyStyle: true, communicationStyle: true,
          accountabilityNeed: true, emotionalDriver: true, confidenceScore: true,
        },
      },
    },
  })

  return user
}

async function getMatch(userId: string) {
  return db.oneOnOneMatch.findFirst({
    where: {
      status: { in: ["PENDING_REVIEW", "APPROVED", "ACTIVE", "REMATCHING"] },
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    orderBy: [{ activatedAt: "desc" }, { approvedAt: "desc" }, { createdAt: "desc" }],
  })
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────

export default async function OneOnOnePage() {
  const { userId: clerkId } = await auth()
  if (!clerkId) redirect("/sign-in")

  const user = await getPageData(clerkId)
  if (!user) redirect("/sign-in")

  const isAdmin = user.role === "ADMIN" || user.role === "FOUNDER"

  // ── Flow A: Profile / BUZZ not complete enough for matching ──
  const hasDriveProfile = !!user.driveProfile
  const hasPsychProfile = !!user.psychProfile

  if (!hasDriveProfile) {
    return <MatchLockedState />
  }

  // ── Fetch current match ──
  const match = await getMatch(user.id)

  // ── Flow B: No match at all — in queue ──
  if (!match) {
    return <MatchPendingState firstName={user.profile?.firstName ?? null} />
  }

  // ── Flow C: Match pending admin review ──
  if (match.status === "PENDING_REVIEW" || match.status === "REMATCHING") {
    // Admin can see more info but for now redirect to admin panel
    if (isAdmin) {
      redirect("/admin/one-on-one")
    }
    return <MatchReviewState />
  }

  // ── Flow D: Match approved or active — show full view ──
  if (match.status === "APPROVED" || match.status === "ACTIVE") {
    // Determine who the peer is
    const peerId = match.userAId === user.id ? match.userBId : match.userAId

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

    if (!peer) {
      // Peer deleted — fall back to pending state
      return <MatchPendingState firstName={user.profile?.firstName ?? null} />
    }

    const scoreBreakdown = match.scoreBreakdown as {
      ambition: number; discipline: number; community: number; growth: number; openness: number;
      communicationStyle: number; emotionalDriver: number; accountabilityFit: number;
      driveScore: number; psychScore: number; finalScore: number;
    } | null

    const frictionPoints = match.frictionPoints as string[] | null

    return (
      <MatchActiveView
        matchId={match.id}
        status={match.status as "APPROVED" | "ACTIVE"}
        compatibilityScore={match.compatibilityScore}
        matchReason={match.matchReason}
        frictionPoints={frictionPoints}
        suggestedPrompt={match.suggestedPrompt}
        scoreBreakdown={scoreBreakdown}
        peer={{
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
        }}
        currentUserId={user.id}
        isUserA={match.userAId === user.id}
      />
    )
  }

  // Fallback (COMPLETED / edge cases)
  return <MatchPendingState firstName={user.profile?.firstName ?? null} />
}
