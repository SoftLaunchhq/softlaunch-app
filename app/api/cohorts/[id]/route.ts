import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { z } from "zod"

const updateCohortSchema = z.object({
  status: z.enum(["APPROVED", "ACTIVE", "COMPLETED", "DISSOLVED"]).optional(),
  currentWeek: z.number().min(1).max(4).optional(),
  whatsappGroupLink: z.string().url().optional().nullable(),
  notionDocLink: z.string().url().optional().nullable(),
  calendlyLink: z.string().url().optional().nullable(),
  adminNotes: z.string().optional(),
})

// PATCH /api/cohorts/[id] — Update cohort (admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const body = await req.json()
    const updates = updateCohortSchema.parse(body)

    const cohort = await db.$transaction(async (tx) => {
      const updatedCohort = await tx.cohort.update({
        where: { id: params.id },
        data: {
          ...updates,
          ...(updates.status === "APPROVED" && {
            approvedBy: admin.id,
            approvedAt: new Date(),
          }),
        },
      })

      // If approving, activate all memberships
      if (updates.status === "APPROVED") {
        await tx.cohortMembership.updateMany({
          where: { cohortId: params.id },
          data: { status: "ACTIVE", joinedAt: new Date() },
        })
      }

      // Log admin action
      await tx.adminAction.create({
        data: {
          adminId: admin.id,
          cohortId: params.id,
          actionType: updates.status ? `${updates.status}_COHORT` : "UPDATED_COHORT",
          metadata: updates,
        },
      })

      return updatedCohort
    })

    return NextResponse.json({ cohort })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error("Cohort update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET /api/cohorts/[id] — Get single cohort
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const cohort = await db.cohort.findUnique({
      where: { id: params.id },
      include: {
        memberships: {
          include: {
            user: {
              include: {
                profile: true,
                driveProfile: true,
                subscription: true,
              },
            },
          },
        },
        weeklyPrompts: { orderBy: { weekNumber: "asc" } },
        feedbacks: {
          include: {
            user: { include: { profile: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        adminActions: {
          include: { admin: { include: { profile: true } } },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    })

    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
    }

    return NextResponse.json({ cohort })
  } catch (error) {
    console.error("Cohort fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
