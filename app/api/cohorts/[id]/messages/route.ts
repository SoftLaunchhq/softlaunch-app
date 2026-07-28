/**
 * Cohort Chat Messages API
 *
 * GET  /api/cohorts/[id]/messages  — Fetch last 60 messages for a cohort chat
 * POST /api/cohorts/[id]/messages  — Post a member message to the cohort chat
 *
 * Authorization (both methods):
 *   - Current authenticated user MUST be an ACTIVE member of the cohort.
 *   - Verified server-side. Never rely on client-side guards alone.
 *
 * Security:
 *   - cohortId comes from URL params, never from the request body
 *   - senderId is always set from the authenticated user's DB record
 *   - Users cannot impersonate other members or post as BUZZ
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { z } from "zod"
import { db } from "@/lib/db"

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Verify that the current authenticated user is an ACTIVE member of the given cohort.
 * Returns { userId, membership } on success, throws NextResponse error on failure.
 */
async function requireCohortMember(cohortId: string) {
  const { userId: clerkId } = auth()
  if (!clerkId) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const dbUser = await db.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true, profile: { select: { firstName: true, lastName: true } } },
  })
  if (!dbUser) {
    throw NextResponse.json({ error: "User not found" }, { status: 401 })
  }

  // Admin users can read any cohort chat (for moderation)
  if (dbUser.role === "ADMIN") {
    return { userId: dbUser.id, dbUser, membership: null, isAdmin: true }
  }

  const membership = await db.cohortMembership.findUnique({
    where: { cohortId_userId: { cohortId, userId: dbUser.id } },
    select: { status: true, cohortId: true },
  })

  if (!membership || membership.status !== "ACTIVE") {
    throw NextResponse.json(
      { error: "Forbidden: you are not an active member of this cohort" },
      { status: 403 }
    )
  }

  return { userId: dbUser.id, dbUser, membership, isAdmin: false }
}

// ─── GET /api/cohorts/[id]/messages ──────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cohortId = params.id

  try {
    await requireCohortMember(cohortId)
  } catch (err) {
    if (err instanceof NextResponse) return err
    throw err
  }

  try {
    // Fetch last 60 messages, oldest first for display
    const messages = await (db as any).cohortMessage.findMany({
      where: { cohortId },
      orderBy: { createdAt: "asc" },
      take: 60,
      select: {
        id: true,
        cohortId: true,
        senderId: true,
        senderType: true,
        senderName: true,
        content: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ messages })
  } catch (error) {
    console.error("[cohort-messages] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
  }
}

// ─── POST /api/cohorts/[id]/messages ─────────────────────────

const PostSchema = z.object({
  content: z.string().min(1).max(2000),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cohortId = params.id

  let authResult: Awaited<ReturnType<typeof requireCohortMember>>
  try {
    authResult = await requireCohortMember(cohortId)
  } catch (err) {
    if (err instanceof NextResponse) return err
    throw err
  }

  // Admins cannot post as members (read-only access for admins)
  if (authResult.isAdmin) {
    return NextResponse.json(
      { error: "Admins cannot post to cohort chat" },
      { status: 403 }
    )
  }

  let body: z.infer<typeof PostSchema>
  try {
    body = PostSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { userId, dbUser } = authResult
  const profile = dbUser.profile
  const senderName = profile
    ? `${profile.firstName} ${profile.lastName}`.trim()
    : "Member"

  try {
    const message = await (db as any).cohortMessage.create({
      data: {
        id: `cm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        cohortId,
        senderId: userId,
        senderType: "MEMBER",
        senderName,
        content: body.content.trim(),
      },
    })

    return NextResponse.json({ message }, { status: 201 })
  } catch (error) {
    console.error("[cohort-messages] POST error:", error)
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
  }
}
