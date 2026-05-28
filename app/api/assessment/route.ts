import { NextRequest, NextResponse } from "next/server"
import { auth, currentUser } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { generateDriveProfile, ASSESSMENT_QUESTIONS } from "@/lib/matching"
import { z } from "zod"

const answerSchema = z.object({
  questionId: z.string(),
  answerKey: z.string(),
})

const assessmentSchema = z.object({
  answers: z.array(answerSchema).length(5, "All 5 questions must be answered"),
})

/** Detect Prisma/DB connection errors vs. logic errors */
function isDbConnectionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const err = error as any
  if (err.code === "P1001" || err.code === "P1017" || err.code === "P2021") return true
  if (err.name === "PrismaClientInitializationError") return true
  const msg: string = err.message ?? ""
  if (
    msg.includes("ECONNREFUSED") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("connect timeout") ||
    msg.includes("password authentication failed") ||
    msg.includes("postgresql://user:password") ||
    msg.includes("Environment variable not found") ||
    msg.includes("Can't reach database server")
  )
    return true
  return false
}

// POST /api/assessment — Submit assessment answers and generate drive profile
export async function POST(req: NextRequest) {
  // 1. Auth
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. Parse & validate
  let answers: { questionId: string; answerKey: string }[]
  try {
    const body = await req.json()
    const parsed = assessmentSchema.parse(body)
    answers = parsed.answers
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid assessment data", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  // 3. Try full DB path
  try {
    // Get or auto-create user (handles webhook delay race conditions)
    let user = await db.user.findUnique({ where: { clerkId } })

    if (!user) {
      const clerkUser = await currentUser()
      const email = clerkUser?.emailAddresses?.[0]?.emailAddress
      if (!email) {
        return NextResponse.json({ error: "Could not retrieve user email" }, { status: 400 })
      }
      const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim())
      const role = adminEmails.includes(email) ? "ADMIN" : "USER"

      user = await db.user.upsert({
        where: { clerkId },
        create: { clerkId, email, role, onboardingStep: "ASSESSMENT", onboardingComplete: false },
        update: { email },
      })
    }

    // Build scored answers
    const scoredAnswers = answers.map((answer) => {
      const question = ASSESSMENT_QUESTIONS.find((q) => q.id === answer.questionId)
      const option = question?.options.find((o) => o.key === answer.answerKey)
      return {
        questionId: answer.questionId,
        questionText: question?.text || "",
        answerKey: answer.answerKey,
        answerText: option?.text || "",
        answerScore: option ? Object.values(option.scores).reduce((a, b) => a + b, 0) / 5 : 0,
        dimension: option?.dimension || "general",
      }
    })

    // Aggregate dimension scores
    const dims = { ambition: 0, community: 0, discipline: 0, openness: 0, growth: 0 }
    for (const answer of answers) {
      const question = ASSESSMENT_QUESTIONS.find((q) => q.id === answer.questionId)
      const option = question?.options.find((o) => o.key === answer.answerKey)
      if (!option) continue
      for (const [dim, score] of Object.entries(option.scores)) {
        dims[dim as keyof typeof dims] += score
      }
    }

    // Save assessment + drive profile in upsert
    const assessment = await db.assessment.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        completedAt: new Date(),
        version: 1,
        ambitionScore: dims.ambition,
        communityScore: dims.community,
        disciplineScore: dims.discipline,
        opennessScore: dims.openness,
        growthScore: dims.growth,
        answers: { create: scoredAnswers },
      },
      update: {
        completedAt: new Date(),
        ambitionScore: dims.ambition,
        communityScore: dims.community,
        disciplineScore: dims.discipline,
        opennessScore: dims.openness,
        growthScore: dims.growth,
        answers: { deleteMany: {}, create: scoredAnswers },
      },
    })

    const driveProfileData = generateDriveProfile(user.id, answers)
    await db.driveProfile.upsert({
      where: { userId: user.id },
      create: driveProfileData,
      update: driveProfileData,
    })

    await db.user.update({
      where: { id: user.id },
      data: { onboardingStep: "REVEAL" },
    })

    return NextResponse.json({ success: true, assessmentId: assessment.id })
  } catch (error) {
    // 4. If DB is unavailable, use lite mode (cookie-based)
    if (isDbConnectionError(error)) {
      console.warn("[assessment] DB unavailable — using lite mode cookie fallback")
      return liteModeFallback(answers)
    }

    console.error("Assessment submission error:", error)
    return NextResponse.json(
      { error: "Internal server error — check your DATABASE_URL in .env.local" },
      { status: 500 }
    )
  }
}

/**
 * Lite mode: compute drive profile in memory, store in cookie.
 * Used when DB is not connected (e.g., placeholder DATABASE_URL).
 */
function liteModeFallback(answers: { questionId: string; answerKey: string }[]): NextResponse {
  // Compute drive profile in memory using the same algorithm
  const driveProfile = generateDriveProfile("lite-user", answers)

  // Build the cookie payload (only what the reveal page needs)
  const cookiePayload = {
    archetype: driveProfile.archetype,
    archetypeSlug: driveProfile.archetypeSlug,
    summary: driveProfile.summary,
    ambition: driveProfile.ambition,
    community: driveProfile.community,
    discipline: driveProfile.discipline,
    openness: driveProfile.openness,
    growth: driveProfile.growth,
    // Also save raw answers so BUZZ.AI can read them later
    answers: answers.map((a) => {
      const question = ASSESSMENT_QUESTIONS.find((q) => q.id === a.questionId)
      const option = question?.options.find((o) => o.key === a.answerKey)
      return {
        questionId: a.questionId,
        questionText: question?.text ?? "",
        answerKey: a.answerKey,
        answerText: option?.text ?? "",
      }
    }),
  }

  const response = NextResponse.json({ success: true, lite: true })
  response.cookies.set("sl_drive_v1", JSON.stringify(cookiePayload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  })
  return response
}
