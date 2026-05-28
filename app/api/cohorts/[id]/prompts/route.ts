import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { z } from "zod"

const promptSchema = z.object({
  weekNumber: z.number().min(1).max(4),
  title: z.string().min(1),
  promptText: z.string().min(1),
  resourceLink: z.string().url().optional().nullable(),
})

// POST /api/cohorts/[id]/prompts — Send weekly prompt (admin only)
export async function POST(
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
    const data = promptSchema.parse(body)

    const prompt = await db.weeklyPrompt.upsert({
      where: {
        cohortId_weekNumber: {
          cohortId: params.id,
          weekNumber: data.weekNumber,
        },
      },
      create: {
        cohortId: params.id,
        weekNumber: data.weekNumber,
        title: data.title,
        promptText: data.promptText,
        resourceLink: data.resourceLink,
        status: "ACTIVE",
        sentAt: new Date(),
      },
      update: {
        title: data.title,
        promptText: data.promptText,
        resourceLink: data.resourceLink,
        status: "ACTIVE",
        sentAt: new Date(),
      },
    })

    await db.adminAction.create({
      data: {
        adminId: admin.id,
        cohortId: params.id,
        actionType: "SENT_PROMPT",
        notes: `Week ${data.weekNumber} prompt: "${data.title}"`,
      },
    })

    return NextResponse.json({ prompt })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error("Prompt creation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
