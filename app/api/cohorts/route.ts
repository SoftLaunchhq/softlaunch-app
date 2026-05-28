import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { generateCohortName } from "@/lib/utils"
import { z } from "zod"

const createCohortSchema = z.object({
  memberIds: z.array(z.string()).length(4, "Cohort must have exactly 4 members"),
  theme: z.string().optional(),
  matchScore: z.number().optional(),
  matchingVersion: z.number().optional(),
  notes: z.string().optional(),
})

// POST /api/cohorts — Create a new cohort (admin only)
export async function POST(req: NextRequest) {
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
    const data = createCohortSchema.parse(body)

    // Generate cohort name
    const cohortCount = await db.cohort.count()
    const cohortName = generateCohortName("Charlotte, NC", cohortCount + 1)

    // Create cohort + memberships in transaction
    const cohort = await db.$transaction(async (tx) => {
      const newCohort = await tx.cohort.create({
        data: {
          name: cohortName,
          theme: (data.theme as any) || "GENERAL",
          status: "PENDING_APPROVAL",
          city: "Charlotte, NC",
          matchScore: data.matchScore,
          matchingVersion: data.matchingVersion || 1,
          matchingNotes: data.notes,
        },
      })

      // Create memberships for all 4 members
      await tx.cohortMembership.createMany({
        data: data.memberIds.map((userId) => ({
          cohortId: newCohort.id,
          userId,
          status: "PENDING" as const,
          weekAccessLevel: 1,
          currentWeek: 1,
        })),
      })

      // Log admin action
      await tx.adminAction.create({
        data: {
          adminId: admin.id,
          cohortId: newCohort.id,
          actionType: "CREATED_COHORT",
          notes: data.notes,
          metadata: {
            memberIds: data.memberIds,
            matchScore: data.matchScore,
          },
        },
      })

      return newCohort
    })

    return NextResponse.json({ cohort }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error("Cohort creation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET /api/cohorts — List cohorts (admin: all, user: their own)
export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true, role: true },
    })
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const isAdmin = user.role === "ADMIN" || user.role === "FOUNDER"

    if (isAdmin) {
      const cohorts = await db.cohort.findMany({
        include: {
          memberships: {
            include: {
              user: { include: { profile: true, driveProfile: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })
      return NextResponse.json({ cohorts })
    } else {
      const memberships = await db.cohortMembership.findMany({
        where: { userId: user.id },
        include: {
          cohort: {
            include: {
              memberships: {
                include: {
                  user: { include: { profile: true, driveProfile: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })
      return NextResponse.json({ cohorts: memberships.map((m) => m.cohort) })
    }
  } catch (error) {
    console.error("Cohort list error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
