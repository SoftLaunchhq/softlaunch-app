/**
 * GET  /api/user/availability — return current user's CohortPreferences
 * POST /api/user/availability — upsert CohortPreferences with availability fields
 *
 * POST body (all optional):
 *   preferredDays:        string[]  e.g. ["monday","wednesday"]
 *   preferredTime:        string?   "mornings" | "evenings" | "weekends" | "flexible"
 *   timezone:             string?   e.g. "America/New_York"
 *   favoriteLocationType: string?   "coffee" | "library" | "coworking" | "restaurant" | "park" | "campus" | "bookstore" | "other"
 *   favoriteLocationText: string?   free-text description
 *   cohortId:             string?   if provided and meetup is in NO_COMMON_TIME, signal client to retry
 *
 * Raw SQL used for new schema fields (timezone / favoriteLocationType / favoriteLocationText)
 * because prisma generate can't run in this environment.
 *
 * Authorization: Clerk session required
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { z } from "zod"

const postSchema = z.object({
  preferredDays:        z.array(z.string()).optional(),
  preferredTime:        z.string().nullable().optional(),
  timezone:             z.string().nullable().optional(),
  favoriteLocationType: z.string().nullable().optional(),
  favoriteLocationText: z.string().nullable().optional(),
  cohortId:             z.string().optional(),
})

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await db.user.findUnique({
    where: { clerkId },
    select: { id: true },
  })

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  // Use raw SQL to include new columns that may not be in the generated Prisma client yet
  try {
    const rows = await db.$queryRaw<Array<{
      preferredDays: string[] | null
      preferredTime: string | null
      timezone: string | null
      favoriteLocationType: string | null
      favoriteLocationText: string | null
    }>>`
      SELECT
        "preferredDays",
        "preferredTime",
        COALESCE("timezone", NULL) AS "timezone",
        COALESCE("favoriteLocationType", NULL) AS "favoriteLocationType",
        COALESCE("favoriteLocationText", NULL) AS "favoriteLocationText"
      FROM "CohortPreferences"
      WHERE "userId" = ${user.id}
      LIMIT 1
    `

    const prefs = rows[0] ?? null

    return NextResponse.json({
      availability: prefs ?? {
        preferredDays:        [],
        preferredTime:        null,
        timezone:             null,
        favoriteLocationType: null,
        favoriteLocationText: null,
      },
    })
  } catch {
    // Fallback if new columns don't exist yet
    const prefs = await db.cohortPreferences.findUnique({
      where: { userId: user.id },
      select: { preferredDays: true, preferredTime: true },
    })
    return NextResponse.json({
      availability: prefs
        ? { ...prefs, timezone: null, favoriteLocationType: null, favoriteLocationText: null }
        : { preferredDays: [], preferredTime: null, timezone: null, favoriteLocationType: null, favoriteLocationText: null },
    })
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: z.infer<typeof postSchema>
  try {
    body = postSchema.parse(await req.json())
  } catch (err: any) {
    return NextResponse.json({ error: "Invalid request body", details: err.errors }, { status: 400 })
  }

  const user = await db.user.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  try {
    // Step 1: Upsert core fields (always works — these are in the original schema)
    const preferredDays = body.preferredDays ?? undefined
    const preferredTime = body.preferredTime ?? undefined

    const existing = await db.cohortPreferences.findUnique({ where: { userId: user.id } })

    if (!existing) {
      await db.cohortPreferences.create({
        data: {
          userId: user.id,
          preferredDays: (preferredDays ?? []) as string[],
          preferredTime: preferredTime ?? null,
        },
      })
    } else {
      await db.cohortPreferences.update({
        where: { userId: user.id },
        data: {
          ...(preferredDays !== undefined ? { preferredDays: preferredDays as string[] } : {}),
          ...(preferredTime !== undefined ? { preferredTime } : {}),
        },
      })
    }

    // Step 2: Upsert new columns via raw SQL (graceful if they don't exist yet)
    const hasNewFields =
      body.timezone !== undefined ||
      body.favoriteLocationType !== undefined ||
      body.favoriteLocationText !== undefined

    if (hasNewFields) {
      try {
        const tz   = body.timezone             ?? null
        const flt  = body.favoriteLocationType ?? null
        const flxt = body.favoriteLocationText ?? null

        await db.$executeRaw`
          UPDATE "CohortPreferences"
          SET
            "timezone"             = COALESCE(${tz},   "timezone"),
            "favoriteLocationType" = COALESCE(${flt},  "favoriteLocationType"),
            "favoriteLocationText" = COALESCE(${flxt}, "favoriteLocationText"),
            "updatedAt"            = NOW()
          WHERE "userId" = ${user.id}
        `
      } catch {
        // Non-fatal — new columns may not exist in DB yet
      }
    }

    // Return updated prefs
    let savedPrefs: Record<string, unknown>
    try {
      const rows = await db.$queryRaw<Array<{
        preferredDays: string[]
        preferredTime: string | null
        timezone: string | null
        favoriteLocationType: string | null
        favoriteLocationText: string | null
      }>>`
        SELECT "preferredDays","preferredTime","timezone","favoriteLocationType","favoriteLocationText"
        FROM "CohortPreferences" WHERE "userId" = ${user.id} LIMIT 1
      `
      savedPrefs = rows[0] ?? {}
    } catch {
      const p = await db.cohortPreferences.findUnique({
        where: { userId: user.id },
        select: { preferredDays: true, preferredTime: true },
      })
      savedPrefs = p ? { ...p, timezone: null, favoriteLocationType: null, favoriteLocationText: null } : {}
    }

    // Check if the cohort's meetup needs a retry (signal the client)
    let shouldRetry = false
    if (body.cohortId) {
      try {
        const meetups = await db.$queryRaw<Array<{ state: string }>>`
          SELECT "state" FROM "CohortMeetup" WHERE "cohortId" = ${body.cohortId} LIMIT 1
        `
        shouldRetry = meetups[0]?.state === "NO_COMMON_TIME"
      } catch {
        // Non-fatal
      }
    }

    return NextResponse.json({
      success: true,
      availability: savedPrefs,
      shouldRetry,
    })
  } catch (err: any) {
    console.error("[availability] POST error:", err?.message?.slice(0, 300))
    return NextResponse.json({ error: "Failed to save availability" }, { status: 500 })
  }
}
