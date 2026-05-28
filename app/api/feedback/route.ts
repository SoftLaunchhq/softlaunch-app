import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { z } from "zod"

const feedbackSchema = z.object({
  cohortId: z.string(),
  weekNumber: z.number().min(1).max(4),
  type: z.enum(["POST_SESSION", "POST_WEEK", "EXIT"]),
  sessionRating: z.number().min(1).max(5).optional(),
  groupChemistry: z.number().min(1).max(5).optional(),
  wouldContinue: z.boolean().optional(),
  topVibeWith: z.string().optional().nullable(),
  sessionValue: z.number().min(1).max(5).optional(),
  attendanceConfirmed: z.boolean().optional(),
  openResponse: z.string().max(500).optional().nullable(),
})

// POST /api/feedback — Submit weekly feedback
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await db.user.findUnique({ where: { clerkId } })
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const body = await req.json()
    const data = feedbackSchema.parse(body)

    // Verify user is in this cohort
    const membership = await db.cohortMembership.findUnique({
      where: {
        cohortId_userId: {
          cohortId: data.cohortId,
          userId: user.id,
        },
      },
    })

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this cohort" }, { status: 403 })
    }

    // Upsert feedback (one per user per cohort per week per type)
    const feedback = await db.feedback.upsert({
      where: {
        userId_cohortId_weekNumber_type: {
          userId: user.id,
          cohortId: data.cohortId,
          weekNumber: data.weekNumber,
          type: data.type,
        },
      },
      create: {
        userId: user.id,
        cohortId: data.cohortId,
        weekNumber: data.weekNumber,
        type: data.type,
        sessionRating: data.sessionRating,
        groupChemistry: data.groupChemistry,
        wouldContinue: data.wouldContinue,
        topVibeWith: data.topVibeWith,
        sessionValue: data.sessionValue,
        attendanceConfirmed: data.attendanceConfirmed ?? false,
        openResponse: data.openResponse,
      },
      update: {
        sessionRating: data.sessionRating,
        groupChemistry: data.groupChemistry,
        wouldContinue: data.wouldContinue,
        topVibeWith: data.topVibeWith,
        sessionValue: data.sessionValue,
        attendanceConfirmed: data.attendanceConfirmed ?? false,
        openResponse: data.openResponse,
      },
    })

    // Also record attendance if confirmed
    if (data.attendanceConfirmed !== undefined) {
      await db.attendance.upsert({
        where: {
          userId_cohortId_weekNumber: {
            userId: user.id,
            cohortId: data.cohortId,
            weekNumber: data.weekNumber,
          },
        },
        create: {
          userId: user.id,
          cohortId: data.cohortId,
          weekNumber: data.weekNumber,
          attended: data.attendanceConfirmed,
          confirmedAt: new Date(),
          confirmedBy: "self",
        },
        update: {
          attended: data.attendanceConfirmed,
          confirmedAt: new Date(),
        },
      })
    }

    return NextResponse.json({ feedback })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error("Feedback error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
