/**
 * GET  /api/user/weekly-availability?cohortId=X&weekNumber=Y
 *   Returns all time slots for the given cohort week.
 *
 * POST /api/user/weekly-availability
 *   Upserts time slots for a given cohort week. Replaces all existing slots
 *   for that (userId, cohortId, weekNumber) combination so each week is
 *   independent and Week 2 never overwrites Week 1.
 *
 * POST body:
 *   cohortId:   string  (required)
 *   weekNumber: number  1–4
 *   days: {
 *     monday:    DayAvailability
 *     tuesday:   DayAvailability
 *     wednesday: DayAvailability
 *     thursday:  DayAvailability
 *     friday:    DayAvailability
 *     saturday:  DayAvailability
 *     sunday:    DayAvailability
 *   }
 *
 * DayAvailability:
 *   type:   "not_available" | "all_day" | "custom"
 *   blocks: Array<{ start: string; end: string }>  // "HH:MM" — only for "custom"
 *
 * Authorization: Clerk session required
 *
 * Raw SQL — prisma generate cannot run in sandbox, so all new-table
 * operations use db.$queryRaw / db.$executeRaw.
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { z } from "zod"

// ─── Types ───────────────────────────────────────────────────────────────────

const DAY_KEYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as const
type DayKey = typeof DAY_KEYS[number]

const BlockSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM"),
  end:   z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM"),
})

const DaySchema = z.object({
  type:   z.enum(["not_available", "all_day", "custom"]),
  blocks: z.array(BlockSchema).default([]),
})

const PostSchema = z.object({
  cohortId:   z.string().min(1),
  weekNumber: z.number().int().min(1).max(4),
  days: z.object({
    monday:    DaySchema,
    tuesday:   DaySchema,
    wednesday: DaySchema,
    thursday:  DaySchema,
    friday:    DaySchema,
    saturday:  DaySchema,
    sunday:    DaySchema,
  }),
})

// ─── Table bootstrap ─────────────────────────────────────────────────────────

async function ensureTable() {
  try {
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS "MemberWeeklyAvailability" (
        "id"          TEXT        NOT NULL,
        "userId"      TEXT        NOT NULL,
        "cohortId"    TEXT        NOT NULL,
        "weekNumber"  INTEGER     NOT NULL,
        "dayOfWeek"   TEXT        NOT NULL,
        "type"        TEXT        NOT NULL DEFAULT 'not_available',
        "startTime"   TEXT,
        "endTime"     TEXT,
        "blockIndex"  INTEGER     NOT NULL DEFAULT 0,
        "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "MemberWeeklyAvailability_pkey" PRIMARY KEY ("id")
      )
    `
    await db.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS "MemberWeeklyAvailability_unique_idx"
      ON "MemberWeeklyAvailability" ("userId","cohortId","weekNumber","dayOfWeek","blockIndex")
    `
    await db.$executeRaw`
      CREATE INDEX IF NOT EXISTS "MemberWeeklyAvailability_user_idx"
      ON "MemberWeeklyAvailability" ("userId","cohortId","weekNumber")
    `
  } catch {
    // Non-fatal — table may already exist
  }
}

// ─── ID helper ────────────────────────────────────────────────────────────────

function newId() {
  return `wa_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

// ─── Shape helper — row → structured day map ────────────────────────────────

type SlotRow = {
  userId: string
  cohortId: string
  weekNumber: number
  dayOfWeek: string
  type: string
  startTime: string | null
  endTime:   string | null
  blockIndex: number
}

function rowsToDays(rows: SlotRow[]) {
  const days: Record<DayKey, { type: string; blocks: Array<{ start: string; end: string }> }> = {
    monday:    { type: "not_available", blocks: [] },
    tuesday:   { type: "not_available", blocks: [] },
    wednesday: { type: "not_available", blocks: [] },
    thursday:  { type: "not_available", blocks: [] },
    friday:    { type: "not_available", blocks: [] },
    saturday:  { type: "not_available", blocks: [] },
    sunday:    { type: "not_available", blocks: [] },
  }

  for (const row of rows) {
    const day = row.dayOfWeek as DayKey
    if (!days[day]) continue
    days[day].type = row.type
    if (row.type === "custom" && row.startTime && row.endTime) {
      days[day].blocks.push({ start: row.startTime, end: row.endTime })
    }
  }

  // Sort blocks by start time
  for (const day of DAY_KEYS) {
    days[day].blocks.sort((a, b) => a.start.localeCompare(b.start))
  }

  return days
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const cohortId   = url.searchParams.get("cohortId")
  const weekNumber = Number(url.searchParams.get("weekNumber") ?? "1")

  if (!cohortId) return NextResponse.json({ error: "cohortId required" }, { status: 400 })

  const user = await db.user.findUnique({ where: { clerkId }, select: { id: true } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  await ensureTable()

  try {
    const rows = await db.$queryRaw<SlotRow[]>`
      SELECT "userId","cohortId","weekNumber","dayOfWeek","type","startTime","endTime","blockIndex"
      FROM "MemberWeeklyAvailability"
      WHERE "userId" = ${user.id} AND "cohortId" = ${cohortId} AND "weekNumber" = ${weekNumber}
      ORDER BY "dayOfWeek" ASC, "blockIndex" ASC
    `

    return NextResponse.json({
      weekNumber,
      days: rowsToDays(rows),
    })
  } catch (err: any) {
    console.error("[weekly-availability] GET error:", err?.message?.slice(0, 200))
    return NextResponse.json({ weekNumber, days: rowsToDays([]) })
  }
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: z.infer<typeof PostSchema>
  try {
    body = PostSchema.parse(await req.json())
  } catch (err: any) {
    return NextResponse.json({ error: "Invalid request", details: err.errors }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { clerkId }, select: { id: true } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  await ensureTable()

  try {
    // Delete all existing slots for this user+cohort+week (replace strategy)
    await db.$executeRaw`
      DELETE FROM "MemberWeeklyAvailability"
      WHERE "userId" = ${user.id} AND "cohortId" = ${body.cohortId} AND "weekNumber" = ${body.weekNumber}
    `

    // Insert new rows
    for (const day of DAY_KEYS) {
      const dayData = body.days[day]
      if (dayData.type === "custom" && dayData.blocks.length > 0) {
        for (let i = 0; i < dayData.blocks.length; i++) {
          const block = dayData.blocks[i]
          const id = newId()
          await db.$executeRaw`
            INSERT INTO "MemberWeeklyAvailability"
              ("id","userId","cohortId","weekNumber","dayOfWeek","type","startTime","endTime","blockIndex","createdAt","updatedAt")
            VALUES (
              ${id}, ${user.id}, ${body.cohortId}, ${body.weekNumber}, ${day},
              'custom', ${block.start}, ${block.end}, ${i}, NOW(), NOW()
            )
          `
        }
      } else {
        // For not_available or all_day — store a single row with blockIndex=0
        const id = newId()
        const slotType = dayData.type
        await db.$executeRaw`
          INSERT INTO "MemberWeeklyAvailability"
            ("id","userId","cohortId","weekNumber","dayOfWeek","type","startTime","endTime","blockIndex","createdAt","updatedAt")
          VALUES (
            ${id}, ${user.id}, ${body.cohortId}, ${body.weekNumber}, ${day},
            ${slotType}, NULL, NULL, 0, NOW(), NOW()
          )
        `
      }
    }

    // Check if cohort meetup is in NO_COMMON_TIME — signal client to retry
    let shouldRetry = false
    try {
      const meetups = await db.$queryRaw<Array<{ state: string }>>`
        SELECT "state" FROM "CohortMeetup" WHERE "cohortId" = ${body.cohortId} LIMIT 1
      `
      shouldRetry = meetups[0]?.state === "NO_COMMON_TIME"
    } catch {
      // Non-fatal
    }

    return NextResponse.json({ success: true, shouldRetry })
  } catch (err: any) {
    console.error("[weekly-availability] POST error:", err?.message?.slice(0, 300))
    return NextResponse.json({ error: "Failed to save availability" }, { status: 500 })
  }
}
