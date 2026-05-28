/**
 * BUZZ Profile Insight API
 *
 * GET  /api/buzz/profile-insight — Fetch current user's PsychProfile
 * POST /api/buzz/profile-insight — Generate/refresh PsychProfile from all signals
 *
 * The POST route pulls all available signals (assessment, memories, conversation)
 * and uses OpenAI to generate a structured psychological profile.
 *
 * The GET route returns the stored profile for display in BuzzInsightCard.
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { buildProfileGenerationPrompt, isBuzzDbError } from "@/lib/buzz"

/** GET — return stored PsychProfile (or null if not yet generated) */
export async function GET() {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    })
    if (!user) return NextResponse.json({ profile: null })

    const profile = await (db as any).psychProfile.findUnique({
      where: { userId: user.id },
    })

    return NextResponse.json({ profile })
  } catch (err) {
    if (isBuzzDbError(err)) return NextResponse.json({ profile: null, lite: true })
    console.error("[buzz/profile-insight GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** POST — generate or refresh PsychProfile from all available signals */
export async function POST(_req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "BUZZ is offline — OPENAI_API_KEY not configured" }, { status: 503 })
  }

  try {
    const user = await db.user.findUnique({
      where: { clerkId },
      include: {
        driveProfile:  true,
        assessment:    { include: { answers: true } },
        buzzMemories:  true,
        buzzConversations: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    })

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    // Collect signals
    const assessmentAnswers = user.assessment?.answers.map((a) => ({
      question: a.questionText,
      answer:   a.answerText,
    })) ?? []

    const memories = user.buzzMemories.map((m) => ({
      key:   m.key,
      value: m.value,
    }))

    const conversationExcerpts = user.buzzConversations
      .filter((c) => c.role === "user")
      .map((c) => c.content)
      .slice(0, 8)

    const driveProfile = user.driveProfile ? {
      archetype:  user.driveProfile.archetype,
      ambition:   user.driveProfile.ambition,
      community:  user.driveProfile.community,
      discipline: user.driveProfile.discipline,
      openness:   user.driveProfile.openness,
      growth:     user.driveProfile.growth,
    } : undefined

    const promptContent = buildProfileGenerationPrompt({
      assessmentAnswers,
      memories,
      conversationExcerpts,
      driveProfile,
    })

    // Generate with OpenAI
    const { OpenAI } = await import("openai")
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
      messages: [
        { role: "system", content: "You are a psychographic profiler. Return only valid JSON." },
        { role: "user",   content: promptContent },
      ],
      max_tokens: 800,
      temperature: 0.4,
      response_format: { type: "json_object" },
    })

    const rawJson = completion.choices[0]?.message?.content ?? "{}"
    let profile: Record<string, unknown>
    try {
      profile = JSON.parse(rawJson)
    } catch {
      return NextResponse.json({ error: "Profile generation failed — invalid AI response" }, { status: 500 })
    }

    // Compute confidence score based on signal richness
    const signalCount = assessmentAnswers.length + memories.length + conversationExcerpts.length
    const confidenceScore = Math.min(1.0, signalCount / 20)

    // Upsert PsychProfile
    const savedProfile = await (db as any).psychProfile.upsert({
      where:  { userId: user.id },
      create: {
        userId:            user.id,
        ambitionType:      profile.ambitionType as string ?? null,
        energyStyle:       profile.energyStyle as string ?? null,
        communicationStyle: profile.communicationStyle as string ?? null,
        accountabilityNeed: profile.accountabilityNeed as string ?? null,
        emotionalDriver:   profile.emotionalDriver as string ?? null,
        riskProfile:       profile.riskProfile as string ?? null,
        socialPreference:  profile.socialPreference as string ?? null,
        conflictStyle:     profile.conflictStyle as string ?? null,
        matchingNeeds:     (profile.matchingNeeds as string[]) ?? [],
        redFlagsToAvoid:   (profile.redFlagsToAvoid as string[]) ?? [],
        idealPeerTraits:   (profile.idealPeerTraits as string[]) ?? [],
        summary:           profile.summary as string ?? "",
        confidenceScore,
        rawInsights:       profile,
        generatedAt:       new Date(),
      },
      update: {
        ambitionType:      profile.ambitionType as string ?? null,
        energyStyle:       profile.energyStyle as string ?? null,
        communicationStyle: profile.communicationStyle as string ?? null,
        accountabilityNeed: profile.accountabilityNeed as string ?? null,
        emotionalDriver:   profile.emotionalDriver as string ?? null,
        riskProfile:       profile.riskProfile as string ?? null,
        socialPreference:  profile.socialPreference as string ?? null,
        conflictStyle:     profile.conflictStyle as string ?? null,
        matchingNeeds:     (profile.matchingNeeds as string[]) ?? [],
        redFlagsToAvoid:   (profile.redFlagsToAvoid as string[]) ?? [],
        idealPeerTraits:   (profile.idealPeerTraits as string[]) ?? [],
        summary:           profile.summary as string ?? "",
        confidenceScore,
        rawInsights:       profile,
        generatedAt:       new Date(),
      },
    })

    return NextResponse.json({ success: true, profile: savedProfile })
  } catch (err) {
    if (isBuzzDbError(err)) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 })
    }
    console.error("[buzz/profile-insight POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
