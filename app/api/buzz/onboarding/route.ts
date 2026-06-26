/**
 * BUZZ Conversational Onboarding API
 * POST /api/buzz/onboarding
 *
 * Powers the deep-dive BUZZ conversation after assessment.
 * BUZZ asks 12 psychographic questions one at a time, reacts to answers,
 * and builds a rich psychological signal set.
 *
 * When all questions are answered (action: "complete"), triggers PsychProfile
 * generation and saves BehavioralSignals to DB.
 *
 * Rate-limit resilience:
 * - Primary model falls back to gpt-4o-mini on 429
 * - Static fallback mode streams the raw question text when OpenAI is fully unavailable
 * - Profile generation has a deterministic keyword-based fallback
 *
 * Streaming response for individual questions.
 * JSON response for completion.
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { z } from "zod"
import {
  BUZZ_ONBOARDING_PROMPT,
  BUZZ_ONBOARDING_QUESTIONS,
  buildProfileGenerationPrompt,
  isBuzzDbError,
} from "@/lib/buzz"
import { db } from "@/lib/db"

const onboardingChatSchema = z.object({
  action: z.enum(["chat", "complete"]),

  // Current question being answered
  questionIndex: z.number().min(0).max(11).optional(),
  userAnswer:    z.string().max(2000).optional(),

  // Full conversation so far (we trim this server-side to save tokens)
  messages: z.array(z.object({
    role:    z.enum(["user", "assistant"]),
    content: z.string().max(4000),
  })).max(50).optional().default([]),

  // All answers collected so far (for completion)
  collectedAnswers: z.array(z.object({
    questionId: z.string(),
    question:   z.string(),
    answer:     z.string(),
  })).optional().default([]),

  // Context from assessment
  driveProfile: z.object({
    archetype:  z.string(),
    ambition:   z.number(),
    community:  z.number(),
    discipline: z.number(),
    openness:   z.number(),
    growth:     z.number(),
  }).optional().nullable(),
})

// ─────────────────────────────────────────────────────────────
// STATIC FALLBACK — streams question text directly when OpenAI is unavailable
// The questions themselves are well-crafted; no AI needed to display them.
// ─────────────────────────────────────────────────────────────

function buildFallbackQuestionText(idx: number): string {
  const q = BUZZ_ONBOARDING_QUESTIONS[idx]
  if (!q) return "Let's keep going. What else is on your mind?"
  return `${q.prompt}\n\n${q.subtext}`
}

function streamStaticText(text: string, extraHeaders?: Record<string, string>): Response {
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    start(controller) {
      // Stream in small chunks to keep the typewriter feel
      const words = text.split(" ")
      let i = 0
      const send = () => {
        if (i < words.length) {
          controller.enqueue(encoder.encode((i === 0 ? "" : " ") + words[i]))
          i++
          setTimeout(send, 18)
        } else {
          controller.close()
        }
      }
      send()
    },
  })
  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Buzz-Fallback": "true",
      ...extraHeaders,
    },
  })
}

// ─────────────────────────────────────────────────────────────
// DETERMINISTIC PROFILE FALLBACK — keyword-based when OpenAI fails during completion
// ─────────────────────────────────────────────────────────────

function generateFallbackProfile(
  answers: Array<{ questionId: string; question: string; answer: string }>,
  driveProfile?: { archetype: string; ambition: number; discipline: number; community: number } | null
): Record<string, unknown> {
  const allText = answers.map((a) => a.answer.toLowerCase()).join(" ")

  const ambitionType =
    allText.match(/scale|aggressive|fast|grow|dominate|win/) ? "relentless-builder" :
    allText.match(/purpose|meaning|impact|help|community/) ? "purpose-driven" :
    allText.match(/creat|build|make|design|craft/) ? "creative-force" :
    "steady-climber"

  const energyStyle =
    allText.match(/all day|non-stop|push|hustle|grind/) ? "high-output" :
    allText.match(/deep work|focus|single|block/) ? "selective-focus" :
    allText.match(/collab|team|together|people/) ? "collaborative" :
    "selective-focus"

  const communicationStyle =
    allText.match(/direct|straight|honest|blunt|clear/) ? "direct-concise" :
    allText.match(/story|context|explain|share/) ? "storyteller" :
    allText.match(/listen|understand|ask|question/) ? "listener-first" :
    "direct-concise"

  const emotionalDriver =
    allText.match(/impact|change|world|society|help/) ? "impact" :
    allText.match(/free|autonomy|control|independent/) ? "freedom" :
    allText.match(/belong|connection|community|friend/) ? "belonging" :
    allText.match(/master|best|expert|learn|skill/) ? "mastery" :
    "achievement"

  const conflictStyle =
    allText.match(/direct|confront|address|honest|say/) ? "direct-confronter" :
    allText.match(/harmony|avoid|peace|smooth/) ? "harmony-keeper" :
    allText.match(/analyz|data|think|process|rational/) ? "analytical-resolver" :
    "direct-confronter"

  const accountabilityNeed =
    allText.match(/deadline|pressure|external|someone|check-in/) ? "external-pressure" :
    allText.match(/system|habit|routine|plan|structure/) ? "system-driven" :
    allText.match(/partner|one person|accountability partner/) ? "partner-based" :
    "self-directed"

  // Prefer archetype-based traits if available
  const archetypeTraits: Record<string, string[]> = {
    "The Executor":  ["decisive", "action-oriented", "reliable"],
    "The Visionary": ["big-picture", "creative", "ambitious"],
    "The Connector": ["empathetic", "networked", "collaborative"],
    "The Analyst":   ["data-driven", "thoughtful", "precise"],
    "The Builder":   ["hands-on", "systematic", "focused"],
  }
  const idealPeerTraits = archetypeTraits[driveProfile?.archetype ?? ""] ?? ["driven", "honest", "growth-focused"]

  return {
    ambitionType,
    energyStyle,
    communicationStyle,
    accountabilityNeed,
    emotionalDriver,
    riskProfile:       "calculated-risks",
    socialPreference:  "selective-deep",
    conflictStyle,
    matchingNeeds:     ["accountability", "honest-feedback", "depth"],
    redFlagsToAvoid:   ["low-ambition", "all-talk", "passive"],
    idealPeerTraits,
    summary: `You're someone who operates with intention. You showed up to this process, answered honestly, and that already sets you apart. BUZZ will use your answers to match you with people who push, not just support. The profile will sharpen as you chat more.`,
    confidenceScore: 0.35,
    isFallback: true,
  }
}

// ─────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let parsed: z.infer<typeof onboardingChatSchema>
  try {
    const body = await req.json()
    parsed = onboardingChatSchema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { action, questionIndex, userAnswer, messages, collectedAnswers, driveProfile } = parsed

  const hasKey    = !!process.env.OPENAI_API_KEY
  const model     = process.env.OPENAI_MODEL ?? "gpt-4o-mini"
  const miniModel = "gpt-4o-mini"
  console.log(`[BUZZ onboarding] action=${action} q=${questionIndex ?? "n/a"} key=${hasKey ? "✓" : "✗"} model=${model}`)

  // ─── COMPLETE: Generate PsychProfile from all answers ──────
  if (action === "complete") {
    return handleCompletion(clerkId, collectedAnswers, driveProfile)
  }

  // ─── CHAT: Stream BUZZ's reaction + next question ──────────
  const currentQuestion = questionIndex !== undefined ? BUZZ_ONBOARDING_QUESTIONS[questionIndex] : null

  // If no OpenAI key — stream static question text immediately
  if (!hasKey) {
    console.warn("[BUZZ onboarding] No API key — serving static fallback")
    const text = buildFallbackQuestionText(questionIndex ?? 0)
    return streamStaticText(text)
  }

  // Trim conversation history to last 8 messages to reduce token usage
  const trimmedMessages = messages.slice(-8)

  // Build system prompt with drive profile context
  let systemContent = BUZZ_ONBOARDING_PROMPT
  if (driveProfile) {
    systemContent += `\n\n## What you already know about this person:\nArchetype: ${driveProfile.archetype}\nAmbition: ${driveProfile.ambition}/100, Community: ${driveProfile.community}/100, Discipline: ${driveProfile.discipline}/100`
  }
  if (currentQuestion) {
    systemContent += `\n\n## Current question context:\nQuestion ${(questionIndex ?? 0) + 1} of ${BUZZ_ONBOARDING_QUESTIONS.length}: "${currentQuestion.prompt}"\nTopic: ${currentQuestion.topic}`
    if (questionIndex === BUZZ_ONBOARDING_QUESTIONS.length - 1) {
      systemContent += `\nThis is the last question. After their answer, give a brief, honest closing reflection — 2-3 sentences max.`
    }
  }

  const openAIMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemContent },
  ]

  // Opening message: ask first question naturally
  if (trimmedMessages.length === 0 && currentQuestion) {
    openAIMessages.push({
      role: "user",
      content: `Start the deep-dive. Ask this question naturally in 1-2 sentences — don't introduce yourself again, just ask it with brief warmth: "${currentQuestion.prompt}". Subtext hint: "${currentQuestion.subtext}"`,
    })
  } else {
    for (const msg of trimmedMessages) {
      openAIMessages.push({ role: msg.role, content: msg.content })
    }
  }

  try {
    const { OpenAI } = await import("openai")
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    let stream: Awaited<ReturnType<typeof openai.chat.completions.create>> | null = null

    try {
      console.log(`[BUZZ onboarding] Calling OpenAI model=${model}`)
      stream = await openai.chat.completions.create({
        model,
        messages:    openAIMessages,
        stream:      true,
        max_tokens:  160,
        temperature: 0.82,
      })
    } catch (firstErr: any) {
      const isQuotaExhausted =
        firstErr?.error?.code === "insufficient_quota" ||
        String(firstErr?.message ?? "").includes("insufficient_quota")
      const isRateLimit = firstErr?.status === 429 && !isQuotaExhausted

      if (isRateLimit && model !== miniModel) {
        // Rate-limited on a non-mini model — retry with mini
        console.warn(`[BUZZ onboarding] 429 rate limit on ${model} — retrying with ${miniModel}`)
        try {
          stream = await openai.chat.completions.create({
            model:       miniModel,
            messages:    openAIMessages,
            stream:      true,
            max_tokens:  160,
            temperature: 0.82,
          })
        } catch {
          stream = null
        }
      } else {
        // Quota exhausted or unexpected error — go straight to local fallback
        console.warn(`[BUZZ onboarding] OpenAI error (${firstErr?.status ?? "unknown"}) — quota=${isQuotaExhausted}`)
        stream = null
      }
    }

    // All OpenAI attempts failed — serve static fallback (onboarding ALWAYS continues)
    if (!stream) {
      console.warn("[BUZZ onboarding] All OpenAI attempts failed — serving static fallback")
      const text = buildFallbackQuestionText(questionIndex ?? 0)
      return streamStaticText(text)
    }

    console.log("[BUZZ onboarding] ✓ OpenAI streaming response")

    const encoder = new TextEncoder()
    let fullResponse = ""

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream!) {
            const delta = chunk.choices[0]?.delta?.content
            if (delta) {
              fullResponse += delta
              controller.enqueue(encoder.encode(delta))
            }
          }
        } catch (err) {
          console.error("[BUZZ onboarding] Stream chunk error:", err)
        } finally {
          controller.close()

          // Log behavioral signal for the user's answer (non-blocking)
          if (userAnswer && currentQuestion) {
            saveBehavioralSignal(clerkId, {
              signalType: "onboarding_answer",
              source:     "onboarding_chat",
              content:    `${currentQuestion.prompt} → ${userAnswer}`,
              metadata:   { questionId: currentQuestion.id, topic: currentQuestion.topic },
            }).catch((e) => console.warn("[BUZZ onboarding] Signal save failed:", e.message))
          }
        }
      },
    })

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    })
  } catch (error: any) {
    // Outer safety net — ALWAYS stream static fallback, never return a JSON error
    // because the client expects a streaming response for the chat action
    console.error("[BUZZ onboarding] Unhandled error:", error?.status, error?.message)
    const text = buildFallbackQuestionText(questionIndex ?? 0)
    return streamStaticText(text)
  }
}

// ─────────────────────────────────────────────────────────────
// COMPLETION HANDLER
// ─────────────────────────────────────────────────────────────

async function handleCompletion(
  clerkId: string,
  collectedAnswers: Array<{ questionId: string; question: string; answer: string }>,
  driveProfile?: { archetype: string; ambition: number; community: number; discipline: number; openness: number; growth: number } | null
): Promise<NextResponse> {
  let profile: Record<string, unknown>
  let usedFallback = false

  // Try OpenAI profile generation
  if (process.env.OPENAI_API_KEY) {
    try {
      const { OpenAI } = await import("openai")
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

      const promptContent = buildProfileGenerationPrompt({
        assessmentAnswers: collectedAnswers.map((a) => ({
          question: a.question,
          answer:   a.answer,
        })),
        driveProfile: driveProfile ?? undefined,
      })

      const primaryModel = process.env.OPENAI_MODEL ?? "gpt-4o-mini"
      let completion: Awaited<ReturnType<typeof openai.chat.completions.create>>

      try {
        completion = await openai.chat.completions.create({
          model: primaryModel,
          messages: [
            { role: "system", content: "You are a psychographic profiler. Return only valid JSON." },
            { role: "user",   content: promptContent },
          ],
          max_tokens: 800,
          temperature: 0.5,
          response_format: { type: "json_object" },
        })
      } catch (err: any) {
        if (err?.status === 429) {
          completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "You are a psychographic profiler. Return only valid JSON." },
              { role: "user",   content: promptContent },
            ],
            max_tokens: 800,
            temperature: 0.5,
            response_format: { type: "json_object" },
          })
        } else {
          throw err
        }
      }

      const rawJson = completion.choices[0]?.message?.content ?? "{}"
      profile = JSON.parse(rawJson)
    } catch (err) {
      console.error("[buzz/onboarding] Profile generation failed — using fallback:", err)
      profile = generateFallbackProfile(collectedAnswers, driveProfile)
      usedFallback = true
    }
  } else {
    // No API key — deterministic fallback
    profile = generateFallbackProfile(collectedAnswers, driveProfile)
    usedFallback = true
  }

  // Save to DB (non-fatal if DB unavailable)
  try {
    const user = await db.user.findUnique({ where: { clerkId }, select: { id: true } })
    if (user) {
      const confidenceScore = usedFallback
        ? (profile.confidenceScore as number ?? 0.35)
        : Math.min(1.0, collectedAnswers.length / 12)

      await (db as any).psychProfile.upsert({
        where:  { userId: user.id },
        create: {
          userId:             user.id,
          ambitionType:       profile.ambitionType as string ?? null,
          energyStyle:        profile.energyStyle as string ?? null,
          communicationStyle: profile.communicationStyle as string ?? null,
          accountabilityNeed: profile.accountabilityNeed as string ?? null,
          emotionalDriver:    profile.emotionalDriver as string ?? null,
          riskProfile:        profile.riskProfile as string ?? null,
          socialPreference:   profile.socialPreference as string ?? null,
          conflictStyle:      profile.conflictStyle as string ?? null,
          matchingNeeds:      (profile.matchingNeeds as string[]) ?? [],
          redFlagsToAvoid:    (profile.redFlagsToAvoid as string[]) ?? [],
          idealPeerTraits:    (profile.idealPeerTraits as string[]) ?? [],
          summary:            profile.summary as string ?? "",
          confidenceScore,
          rawInsights:        profile,
          generatedAt:        new Date(),
        },
        update: {
          ambitionType:       profile.ambitionType as string ?? null,
          energyStyle:        profile.energyStyle as string ?? null,
          communicationStyle: profile.communicationStyle as string ?? null,
          accountabilityNeed: profile.accountabilityNeed as string ?? null,
          emotionalDriver:    profile.emotionalDriver as string ?? null,
          riskProfile:        profile.riskProfile as string ?? null,
          socialPreference:   profile.socialPreference as string ?? null,
          conflictStyle:      profile.conflictStyle as string ?? null,
          matchingNeeds:      (profile.matchingNeeds as string[]) ?? [],
          redFlagsToAvoid:    (profile.redFlagsToAvoid as string[]) ?? [],
          idealPeerTraits:    (profile.idealPeerTraits as string[]) ?? [],
          summary:            profile.summary as string ?? "",
          confidenceScore,
          rawInsights:        profile,
          generatedAt:        new Date(),
        },
      })

      // Save each answer as a behavioral signal
      if (collectedAnswers.length > 0) {
        await (db as any).behavioralSignal.createMany({
          data: collectedAnswers.map((a) => ({
            userId:    user.id,
            signalType: "onboarding_answer",
            source:    "onboarding_chat",
            content:   `${a.question} → ${a.answer}`,
            weight:    1.5,
            metadata:  { questionId: a.questionId },
          })),
          skipDuplicates: true,
        })
      }
    }
  } catch (dbErr) {
    if (!isBuzzDbError(dbErr)) {
      console.error("[buzz/onboarding] DB save error:", dbErr)
    }
    // Return profile even if DB save fails — don't block the user
  }

  return NextResponse.json({
    success:     true,
    profile,
    usedFallback,
    message:     usedFallback
      ? "Your profile has been generated. Chat with BUZZ more to sharpen it."
      : "Your psychological profile has been generated.",
  })
}

// ─────────────────────────────────────────────────────────────
// DB HELPERS
// ─────────────────────────────────────────────────────────────

async function saveBehavioralSignal(
  clerkId: string,
  signal: { signalType: string; source: string; content: string; metadata?: Record<string, unknown> }
) {
  try {
    const user = await db.user.findUnique({ where: { clerkId }, select: { id: true } })
    if (!user) return

    await (db as any).behavioralSignal.create({
      data: {
        userId:    user.id,
        signalType: signal.signalType,
        source:    signal.source,
        content:   signal.content,
        weight:    1.0,
        metadata:  signal.metadata ?? null,
      },
    })
  } catch (err) {
    if (!isBuzzDbError(err)) throw err
  }
}
