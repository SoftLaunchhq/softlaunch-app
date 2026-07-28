/**
 * Cohort Chat Messages API
 *
 * GET  /api/cohorts/[id]/messages  — Fetch last 60 messages for a cohort chat
 * POST /api/cohorts/[id]/messages  — Post a member message to the cohort chat
 *
 * Authorization (both methods):
 *   - Current authenticated user MUST be an ACTIVE member of the cohort.
 *   - Verified server-side via Clerk auth + Prisma membership check.
 *   - ADMIN users may read (for moderation) but NOT post.
 *
 * Raw SQL approach:
 *   Uses db.$queryRaw / db.$executeRaw instead of db.cohortMessage.*
 *   so it works before `prisma generate` is re-run after schema changes.
 *   The CohortMessage table is created automatically on first use.
 *
 * Security:
 *   - cohortId always comes from URL params, never from request body
 *   - senderId always set from authenticated user's DB record
 *   - senderType always hardcoded to "MEMBER" for user posts
 *   - Users cannot post as BUZZ or as another user
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"

// ─── Table bootstrap ──────────────────────────────────────────
// Creates the CohortMessage table and its indexes if they don't yet exist.
// Safe to call on every request — CREATE IF NOT EXISTS is a no-op when already present.

async function ensureCohortMessageTable() {
  try {
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS "CohortMessage" (
        "id"         TEXT         NOT NULL,
        "cohortId"   TEXT         NOT NULL,
        "senderId"   TEXT,
        "senderType" TEXT         NOT NULL DEFAULT 'MEMBER',
        "senderName" TEXT,
        "content"    TEXT         NOT NULL,
        "createdAt"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT "CohortMessage_pkey" PRIMARY KEY ("id")
      )
    `
    await db.$executeRaw`
      CREATE INDEX IF NOT EXISTS "CohortMessage_cohortId_createdAt_idx"
        ON "CohortMessage" ("cohortId", "createdAt")
    `
    await db.$executeRaw`
      CREATE INDEX IF NOT EXISTS "CohortMessage_senderId_idx"
        ON "CohortMessage" ("senderId")
    `
    // Add FK constraints if not yet present — wrapped separately so
    // a "already exists" error doesn't prevent the table from being used.
    await db.$executeRaw`
      DO $$ BEGIN
        ALTER TABLE "CohortMessage"
          ADD CONSTRAINT "CohortMessage_cohortId_fkey"
          FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `
    await db.$executeRaw`
      DO $$ BEGIN
        ALTER TABLE "CohortMessage"
          ADD CONSTRAINT "CohortMessage_senderId_fkey"
          FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `
  } catch (err: any) {
    // If table already fully exists and everything is fine this should not throw.
    // Log so we know if something unexpected happened.
    console.warn("[CohortMessage] ensureTable warning:", err?.message?.slice(0, 200))
  }
}

// ─── Auth helper ─────────────────────────────────────────────
// Returns the current DB user + their membership for the given cohort.
// Returns null for each field when auth/membership check fails, along with
// the appropriate HTTP error response to return.

type MemberCheckResult =
  | { ok: true; userId: string; senderName: string; isAdmin: boolean; errorResponse: null }
  | { ok: false; userId: null; senderName: null; isAdmin: null; errorResponse: NextResponse }

async function checkCohortMember(cohortId: string): Promise<MemberCheckResult> {
  // MUST await auth() — Clerk v5 auth() is async in Next.js Route Handlers
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return {
      ok: false, userId: null, senderName: null, isAdmin: null,
      errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  const dbUser = await db.user.findUnique({
    where: { clerkId },
    select: {
      id: true,
      role: true,
      profile: { select: { firstName: true, lastName: true } },
    },
  })

  if (!dbUser) {
    return {
      ok: false, userId: null, senderName: null, isAdmin: null,
      errorResponse: NextResponse.json({ error: "User not found" }, { status: 401 }),
    }
  }

  const senderName = dbUser.profile
    ? `${dbUser.profile.firstName} ${dbUser.profile.lastName}`.trim()
    : "Member"

  // Admins can read any chat but not post
  if (dbUser.role === "ADMIN") {
    return { ok: true, userId: dbUser.id, senderName, isAdmin: true, errorResponse: null }
  }

  const membership = await db.cohortMembership.findUnique({
    where: { cohortId_userId: { cohortId, userId: dbUser.id } },
    select: { status: true },
  })

  if (!membership || membership.status !== "ACTIVE") {
    return {
      ok: false, userId: null, senderName: null, isAdmin: null,
      errorResponse: NextResponse.json(
        { error: "Forbidden: you are not an active member of this cohort" },
        { status: 403 }
      ),
    }
  }

  return { ok: true, userId: dbUser.id, senderName, isAdmin: false, errorResponse: null }
}

// ─── GET /api/cohorts/[id]/messages ──────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cohortId = params.id

  const authResult = await checkCohortMember(cohortId)
  if (!authResult.ok) return authResult.errorResponse

  try {
    await ensureCohortMessageTable()

    // Fetch last 60 messages for this cohort, oldest first for display
    const rows = await db.$queryRaw<Array<{
      id: string
      cohortId: string
      senderId: string | null
      senderType: string
      senderName: string | null
      content: string
      createdAt: Date
    }>>`
      SELECT "id", "cohortId", "senderId", "senderType", "senderName", "content", "createdAt"
      FROM "CohortMessage"
      WHERE "cohortId" = ${cohortId}
      ORDER BY "createdAt" ASC
      LIMIT 60
    `

    // Convert Date objects to ISO strings for consistent JSON serialization
    const messages = rows.map((r) => ({
      ...r,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    }))

    return NextResponse.json({ messages })
  } catch (error: any) {
    console.error("[cohort-messages] GET error:", error?.message?.slice(0, 300))
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
  }
}

// ─── POST /api/cohorts/[id]/messages ─────────────────────────

const PostSchema = z.object({
  content: z.string().min(1, "Message cannot be empty").max(2000, "Message too long"),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cohortId = params.id

  const authResult = await checkCohortMember(cohortId)
  if (!authResult.ok) return authResult.errorResponse

  // Admins are read-only — cannot post as members
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

  const { userId, senderName } = authResult
  const messageId = `cm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const content = body.content.trim()

  try {
    await ensureCohortMessageTable()

    // Insert and return the new message in one query
    const rows = await db.$queryRaw<Array<{
      id: string
      cohortId: string
      senderId: string | null
      senderType: string
      senderName: string | null
      content: string
      createdAt: Date
    }>>`
      INSERT INTO "CohortMessage" ("id", "cohortId", "senderId", "senderType", "senderName", "content", "createdAt")
      VALUES (${messageId}, ${cohortId}, ${userId}, 'MEMBER', ${senderName}, ${content}, NOW())
      RETURNING "id", "cohortId", "senderId", "senderType", "senderName", "content", "createdAt"
    `

    const message = rows[0]
    if (!message) throw new Error("Insert returned no rows")

    return NextResponse.json({
      message: {
        ...message,
        createdAt: message.createdAt instanceof Date
          ? message.createdAt.toISOString()
          : message.createdAt,
      }
    }, { status: 201 })
  } catch (error: any) {
    console.error("[cohort-messages] POST error:", error?.message?.slice(0, 300))
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
  }
}
