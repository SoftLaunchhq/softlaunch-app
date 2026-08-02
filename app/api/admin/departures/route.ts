/**
 * GET /api/admin/departures
 *
 * Returns all cohort departures, newest first.
 * Admins and Founders only.
 *
 * Query params:
 *   cohortId         — filter by specific cohort
 *   unreviewed=true  — only show admin-unreviewed departures
 *   limit=50         — page size (default 50, max 200)
 *   offset=0
 *
 * PATCH /api/admin/departures
 *
 * Mark a departure as reviewed, add admin notes.
 * Body: { departureId, adminNotes? }
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"

// Ensure table exists before querying
async function ensureDepartureTable() {
  try {
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS "CohortDeparture" (
        "id"                     TEXT        NOT NULL,
        "cohortId"               TEXT        NOT NULL,
        "userId"                 TEXT        NOT NULL,
        "reason"                 TEXT        NOT NULL,
        "requestedRematch"       BOOLEAN     NOT NULL DEFAULT false,
        "isLocationIssue"        BOOLEAN     NOT NULL DEFAULT false,
        "meetupStateAtDeparture" TEXT,
        "adminReviewed"          BOOLEAN     NOT NULL DEFAULT false,
        "adminNotes"             TEXT,
        "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "CohortDeparture_pkey" PRIMARY KEY ("id")
      )
    `
    await db.$executeRaw`
      CREATE INDEX IF NOT EXISTS "CohortDeparture_cohortId_idx" ON "CohortDeparture" ("cohortId")
    `
    await db.$executeRaw`
      CREATE INDEX IF NOT EXISTS "CohortDeparture_userId_idx" ON "CohortDeparture" ("userId")
    `
    // Add status column if it doesn't exist yet
    await db.$executeRaw`
      ALTER TABLE "CohortDeparture"
      ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending'
    `
  } catch (err: any) {
    console.warn("[admin/departures] ensureTable:", err?.message?.slice(0, 200))
  }
}

async function requireAdmin() {
  const { userId: clerkId } = await auth()
  if (!clerkId) return { ok: false as const, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  const dbUser = await db.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true },
  })
  if (!dbUser) return { ok: false as const, error: NextResponse.json({ error: "User not found" }, { status: 401 }) }
  if (dbUser.role !== "ADMIN" && dbUser.role !== "FOUNDER") {
    return { ok: false as const, error: NextResponse.json({ error: "Admin only" }, { status: 403 }) }
  }

  return { ok: true as const, userId: dbUser.id, error: null }
}

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin()
  if (!authResult.ok) return authResult.error

  const sp = req.nextUrl.searchParams
  const cohortId = sp.get("cohortId")
  const unreviewedOnly = sp.get("unreviewed") === "true"
  const limit = Math.min(Number(sp.get("limit") ?? 50), 200)
  const offset = Number(sp.get("offset") ?? 0)

  await ensureDepartureTable()

  try {
    // Fetch departures — join with User + Cohort for display names
    // We do the filtering in JS since Prisma raw SQL doesn't support conditional WHERE easily
    type DepartureRow = {
      id: string
      cohortId: string
      userId: string
      reason: string
      requestedRematch: boolean
      isLocationIssue: boolean
      meetupStateAtDeparture: string | null
      adminReviewed: boolean
      adminNotes: string | null
      status: string
      createdAt: Date
    }

    let rows: DepartureRow[]

    if (cohortId) {
      rows = await db.$queryRaw<DepartureRow[]>`
        SELECT *, COALESCE("status", 'pending') AS "status"
        FROM "CohortDeparture"
        WHERE "cohortId" = ${cohortId}
        ORDER BY "createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    } else {
      rows = await db.$queryRaw<DepartureRow[]>`
        SELECT *, COALESCE("status", 'pending') AS "status"
        FROM "CohortDeparture"
        ORDER BY "createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    }

    if (unreviewedOnly) {
      rows = rows.filter((r) => !r.adminReviewed)
    }

    // Enrich with user + cohort names
    const userIds = [...new Set(rows.map((r) => r.userId))]
    const cohortIds = [...new Set(rows.map((r) => r.cohortId))]

    const [users, cohorts] = await Promise.all([
      userIds.length > 0
        ? db.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } },
          })
        : [],
      cohortIds.length > 0
        ? db.cohort.findMany({
            where: { id: { in: cohortIds } },
            select: { id: true, name: true },
          })
        : [],
    ])

    const userMap = Object.fromEntries(users.map((u) => [u.id, u]))
    const cohortMap = Object.fromEntries(cohorts.map((c) => [c.id, c]))

    const departures = rows.map((r) => {
      const user = userMap[r.userId]
      const cohort = cohortMap[r.cohortId]
      const fullName = user?.profile
        ? `${user.profile.firstName} ${user.profile.lastName}`.trim()
        : "Unknown"
      return {
        ...r,
        status: r.status ?? "pending",
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
        memberName: fullName,
        memberEmail: user?.email ?? null,
        cohortName: cohort?.name ?? r.cohortId,
      }
    })

    // Summary counts
    const total    = departures.length
    const rematch  = departures.filter((d) => d.requestedRematch).length
    const location = departures.filter((d) => d.isLocationIssue).length
    const pending  = departures.filter((d) => !d.adminReviewed && (d.status === "pending" || !d.status)).length

    return NextResponse.json({ departures, summary: { total, rematch, location, pending } })

  } catch (err: any) {
    console.error("[admin/departures] GET error:", err?.message?.slice(0, 300))
    return NextResponse.json({ error: "Failed to fetch departures" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireAdmin()
  if (!authResult.ok) return authResult.error

  let body: { departureId: string; adminNotes?: string }
  try {
    body = await req.json()
    if (!body.departureId) throw new Error("missing departureId")
  } catch {
    return NextResponse.json({ error: "Body must include departureId" }, { status: 400 })
  }

  await ensureDepartureTable()

  try {
    const notes = body.adminNotes ?? null
    await db.$executeRaw`
      UPDATE "CohortDeparture"
      SET "adminReviewed" = true, "adminNotes" = ${notes}
      WHERE "id" = ${body.departureId}
    `
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[admin/departures] PATCH error:", err?.message?.slice(0, 300))
    return NextResponse.json({ error: "Failed to update departure" }, { status: 500 })
  }
}
