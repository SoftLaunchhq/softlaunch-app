/**
 * PATCH /api/admin/departures/[id]
 *
 * Admin-only: update the status of a CohortDeparture record.
 *
 * Body:
 *   action: "approve_rematch" | "reject_rematch" | "archive" | "mark_reviewed"
 *   notes?: string  — optional admin notes
 *
 * Authorization: ADMIN or FOUNDER role required
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { z } from "zod"

const PatchSchema = z.object({
  action: z.enum(["approve_rematch", "reject_rematch", "archive", "mark_reviewed"]),
  notes:  z.string().optional(),
})

const STATUS_MAP: Record<string, string> = {
  approve_rematch: "rematch_approved",
  reject_rematch:  "rematch_rejected",
  archive:         "archived",
  mark_reviewed:   "reviewed",
}

// Ensure status column exists on CohortDeparture
async function ensureStatusColumn() {
  try {
    await db.$executeRaw`
      ALTER TABLE "CohortDeparture"
      ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending'
    `
  } catch { /* non-fatal */ }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const departureId = params.id

  // ── Auth ──────────────────────────────────────────────────────────────────
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await db.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true },
  })
  if (!user || (user.role !== "ADMIN" && user.role !== "FOUNDER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: z.infer<typeof PatchSchema>
  try {
    body = PatchSchema.parse(await req.json())
  } catch (err: any) {
    return NextResponse.json({ error: "Invalid request", details: err.errors }, { status: 400 })
  }

  await ensureStatusColumn()

  try {
    const newStatus     = STATUS_MAP[body.action] ?? "reviewed"
    const adminReviewed = body.action !== "archive"

    // Update status + adminReviewed
    await db.$executeRaw`
      UPDATE "CohortDeparture"
      SET "status" = ${newStatus}, "adminReviewed" = ${adminReviewed}
      WHERE "id" = ${departureId}
    `

    // Update adminNotes if provided
    if (body.notes) {
      await db.$executeRaw`
        UPDATE "CohortDeparture" SET "adminNotes" = ${body.notes} WHERE "id" = ${departureId}
      `
    }

    return NextResponse.json({ success: true, status: newStatus })
  } catch (err: any) {
    console.error("[admin/departures/patch]", err?.message?.slice(0, 200))
    return NextResponse.json({ error: "Failed to update departure" }, { status: 500 })
  }
}
