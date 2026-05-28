import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { z } from "zod"

const responseSchema = z.object({
  promptId: z.string(),
  responseText: z.string().min(1).max(2000),
})

// POST /api/responses — Submit weekly prompt response
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await db.user.findUnique({ where: { clerkId } })
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const body = await req.json()
    const { promptId, responseText } = responseSchema.parse(body)

    // Verify the prompt exists and user has access
    const prompt = await db.weeklyPrompt.findUnique({
      where: { id: promptId },
      include: {
        cohort: {
          include: {
            memberships: { where: { userId: user.id } },
          },
        },
      },
    })

    if (!prompt) {
      return NextResponse.json({ error: "Prompt not found" }, { status: 404 })
    }

    if (prompt.cohort.memberships.length === 0) {
      return NextResponse.json({ error: "Not a member of this cohort" }, { status: 403 })
    }

    const response = await db.weeklyResponse.upsert({
      where: {
        promptId_userId: { promptId, userId: user.id },
      },
      create: { promptId, userId: user.id, responseText },
      update: { responseText },
    })

    return NextResponse.json({ response })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error("Response error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
