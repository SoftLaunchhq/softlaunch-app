/**
 * BUZZ General Chat API
 * POST /api/buzz/chat
 *
 * Handles all BUZZ conversations. Streams response via ReadableStream.
 *
 * Resilience tiers (in order):
 * 1. Primary model (OPENAI_MODEL env var, default gpt-4o-mini)
 * 2. gpt-4o-mini fallback if primary is different and returns 429
 * 3. Local contextual fallback response — BUZZ stays "alive" even with no OpenAI
 *
 * The local fallback reads the last user message and picks a BUZZ-quality
 * probing question from a contextual map. It streams word-by-word so the
 * typewriter effect is preserved. No generic error messages.
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { z } from "zod"
import {
  BUZZ_SYSTEM_PROMPT,
  BUZZ_ENGAGEMENT_PROMPT,
  buildBuzzContext,
  buildPrimingUserMessage,
  isBuzzDbError,
} from "@/lib/buzz"
import { db } from "@/lib/db"

// ─────────────────────────────────────────────────────────────
// LOCAL FALLBACK — BUZZ-quality responses without OpenAI
// Contextual probing questions that match BUZZ's voice.
// ─────────────────────────────────────────────────────────────

const FALLBACK_RESPONSES: Array<{ pattern: RegExp; responses: string[] }> = [
  {
    pattern: /stress|anxious|overwhelm|worried|nervous|panic|pressure/i,
    responses: [
      "That feeling is data. What's the one specific thing underneath all of it — if you had to name just one?",
      "Stress usually means something important is at stake. What's the real thing you're afraid of losing here?",
    ],
  },
  {
    pattern: /should i|decision|choice|option|choose|picking/i,
    responses: [
      "Before I weigh in — what does your gut already know? And what's stopping you from trusting it?",
      "What's the cost of getting this wrong? And the cost of waiting too long to decide?",
    ],
  },
  {
    pattern: /team|partner|cofounder|employee|hire|firing|person/i,
    responses: [
      "People problems are usually communication problems with something unsaid. What's the thing no one is saying directly?",
      "What would you tell a friend in this exact situation? Sometimes we already know the answer.",
    ],
  },
  {
    pattern: /money|funding|revenue|raise|investor|cash|runway|bootstrap/i,
    responses: [
      "What's your actual runway right now? And what would change if you had 12 more months of it?",
      "Are you raising because you need it or because it feels like validation? There's no wrong answer — but it changes the strategy completely.",
    ],
  },
  {
    pattern: /focus|priorit|todo|task|productive|distract|busy/i,
    responses: [
      "If you could only move one thing forward this week — just one — what would actually matter in 90 days?",
      "What are you doing that feels productive but isn't actually moving the needle?",
    ],
  },
  {
    pattern: /idea|startup|build|product|launch|market/i,
    responses: [
      "What's the fastest way to find out if you're wrong about this? That's usually the most useful question.",
      "Who's the one person who would tell you this idea is bad — and what would they say?",
    ],
  },
  {
    pattern: /exam|study|learn|class|school|university|degree/i,
    responses: [
      "Preparation anxiety usually means you care — which is a good sign. What's the specific gap you're most worried about?",
      "What's the one thing you could focus on for the next hour that would move the needle most?",
    ],
  },
  {
    pattern: /tired|burn|exhaust|energy|sleep|rest/i,
    responses: [
      "Burnout doesn't sneak up on people — they usually see it coming and push anyway. What are you protecting by not slowing down?",
      "What would actually help you recharge right now — not what you think you should do, what would actually work?",
    ],
  },
  {
    pattern: /relationship|friend|family|partner|dating|lonely/i,
    responses: [
      "The people around us either raise or lower the ceiling of what we think is possible. Which direction is this one pulling?",
      "What do you need from this person that you haven't asked for directly?",
    ],
  },
]

const DEFAULT_FALLBACK_RESPONSES = [
  "Tell me more. What's the part you're not saying yet?",
  "What would you do if you already knew the answer?",
  "What's the real question underneath that one?",
  "If this problem disappeared tomorrow, what would that free you up to do?",
  "What do you actually want — not what you think you should want?",
]

function getLocalFallbackResponse(
  messages: Array<{ role: string; content: string }>,
  isEngagement: boolean
): string {
  if (isEngagement) {
    return "What's one thing on your mind this week that you haven't had space to think through properly?"
  }

  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? ""

  for (const entry of FALLBACK_RESPONSES) {
    if (entry.pattern.test(lastUserMsg)) {
      const r = entry.responses[Math.floor(Math.random() * entry.responses.length)]
      return r
    }
  }

  return DEFAULT_FALLBACK_RESPONSES[Math.floor(Math.random() * DEFAULT_FALLBACK_RESPONSES.length)]
}

function streamText(text: string, fallback = false): Response {
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    start(controller) {
      const words = text.split(" ")
      let i = 0
      const send = () => {
        if (i < words.length) {
          controller.enqueue(encoder.encode((i === 0 ? "" : " ") + words[i]))
          i++
          setTimeout(send, 22)
        } else {
          controller.close()
        }
      }
      send()
    },
  })
  return new Response(readable, {
    headers: {
      "Content-Type":  "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      ...(fallback ? { "X-Buzz-Fallback": "true" } : {}),
    },
  })
}

// ─────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────

const messageSchema = z.object({
  role:    z.enum(["user", "assistant"]),
  content: z.string().max(4000),
})

const chatSchema = z.object({
  questionId:   z.string().optional(),
  questionText: z.string().optional(),
  answerKey:    z.string().optional(),
  answerText:   z.string().optional(),

  messages: z.array(messageSchema).max(30),

  isOpening:    z.boolean().optional().default(false),
  isEngagement: z.boolean().optional().default(false),

  memories: z.array(z.object({
    key:    z.string(),
    value:  z.string(),
    source: z.string(),
  })).optional().default([]),

  driveProfile: z.object({
    archetype:     z.string(),
    archetypeSlug: z.string(),
    ambition:      z.number(),
    community:     z.number(),
    discipline:    z.number(),
    openness:      z.number(),
    growth:        z.number(),
  }).optional().nullable(),

  psychProfile: z.object({
    ambitionType:       z.string().nullable().optional(),
    energyStyle:        z.string().nullable().optional(),
    communicationStyle: z.string().nullable().optional(),
    accountabilityNeed: z.string().nullable().optional(),
    emotionalDriver:    z.string().nullable().optional(),
    conflictStyle:      z.string().nullable().optional(),
    summary:            z.string().nullable().optional(),
  }).optional().nullable(),

  persist: z.boolean().optional().default(true),
})

// ─────────────────────────────────────────────────────────────
// HANDLER
// ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let parsed: z.infer<typeof chatSchema>
  try {
    const body = await req.json()
    parsed = chatSchema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const {
    questionId, questionText, answerKey, answerText,
    messages, isOpening, isEngagement,
    memories, driveProfile, psychProfile, persist,
  } = parsed

  const hasKey      = !!process.env.OPENAI_API_KEY
  const configModel = process.env.OPENAI_MODEL ?? "gpt-4o-mini"
  console.log(`[BUZZ chat] key=${hasKey ? "✓" : "✗"} model=${configModel} msgs=${messages.length} engagement=${isEngagement}`)

  // ── No API key — local fallback immediately ──────────────────
  if (!hasKey) {
    console.warn("[BUZZ chat] No API key — serving local fallback")
    const text = getLocalFallbackResponse(messages, isEngagement)
    return streamText(text, true)
  }

  // ── Build OpenAI messages ────────────────────────────────────
  const basePrompt    = isEngagement ? BUZZ_ENGAGEMENT_PROMPT : BUZZ_SYSTEM_PROMPT
  const contextBlock  = buildBuzzContext({ questionId, answerKey, answerText, memories, driveProfile, psychProfile })
  const systemContent = [basePrompt, contextBlock ? `\n\n${contextBlock}` : ""].join("")

  const openAIMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemContent },
  ]

  if (isOpening && questionText && answerText && questionId) {
    openAIMessages.push({
      role: "user",
      content: buildPrimingUserMessage(questionText, answerText, questionId),
    })
  }

  // Trim to last 12 messages to reduce token usage
  for (const msg of messages.slice(-12)) {
    openAIMessages.push({ role: msg.role, content: msg.content })
  }

  // ── Try OpenAI — with model fallback cascade ─────────────────
  try {
    const { OpenAI } = await import("openai")
    const openai    = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const miniModel = "gpt-4o-mini"

    // Attempt 1: configured model
    let stream: Awaited<ReturnType<typeof openai.chat.completions.create>> | null = null

    try {
      console.log(`[BUZZ chat] Calling OpenAI model=${configModel}`)
      stream = await openai.chat.completions.create({
        model:       configModel,
        messages:    openAIMessages,
        stream:      true,
        max_tokens:  isOpening ? 180 : 400,
        temperature: 0.82,
      })
    } catch (err1: any) {
      const isQuotaExhausted =
        err1?.error?.code === "insufficient_quota" ||
        String(err1?.message ?? "").includes("insufficient_quota")
      const isRateLimit = err1?.status === 429 && !isQuotaExhausted

      if (isRateLimit && configModel !== miniModel) {
        // Attempt 2: mini fallback on rate limit only
        console.warn(`[BUZZ chat] 429 rate limit on ${configModel} — trying ${miniModel}`)
        try {
          stream = await openai.chat.completions.create({
            model:       miniModel,
            messages:    openAIMessages,
            stream:      true,
            max_tokens:  isOpening ? 180 : 400,
            temperature: 0.82,
          })
        } catch {
          // Both failed — fall through to local fallback below
          stream = null
        }
      } else {
        // Quota exhausted or other error — serve local fallback
        console.warn(`[BUZZ chat] OpenAI error (${err1?.status}) quota=${isQuotaExhausted} — local fallback`)
        stream = null
      }
    }

    // ── Attempt 3: local fallback if all OpenAI attempts failed ─
    if (!stream) {
      console.warn("[BUZZ chat] All OpenAI attempts failed — serving local fallback")
      const text = getLocalFallbackResponse(messages, isEngagement)
      return streamText(text, true)
    }

    console.log("[BUZZ chat] ✓ OpenAI streaming response")

    // ── Stream the real OpenAI response ─────────────────────────
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
          console.error("[buzz/chat] Stream chunk error:", err)
        } finally {
          controller.close()

          // Persist to DB (non-blocking)
          if (persist && fullResponse && messages.length > 0) {
            const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")
            if (lastUserMsg) {
              persistConversation(clerkId, questionId, lastUserMsg.content, fullResponse)
                .catch((e) => console.warn("[buzz/chat] Persist failed:", e.message))
            }
          }
        }
      },
    })

    return new Response(readable, {
      headers: {
        "Content-Type":             "text/plain; charset=utf-8",
        "Cache-Control":            "no-cache",
        "X-Content-Type-Options":   "nosniff",
      },
    })
  } catch (error: any) {
    console.error("[buzz/chat] Unhandled error:", error)

    // Last resort: local fallback — never show a hard error in the chat UI
    const text = getLocalFallbackResponse(messages, isEngagement)
    return streamText(text, true)
  }
}

// ─────────────────────────────────────────────────────────────
// DB PERSISTENCE
// ─────────────────────────────────────────────────────────────

async function persistConversation(
  clerkId: string,
  questionId: string | undefined,
  userMessage: string,
  assistantResponse: string
) {
  try {
    const user = await db.user.findUnique({ where: { clerkId }, select: { id: true } })
    if (!user) return

    await db.buzzConversation.createMany({
      data: [
        { userId: user.id, questionId, role: "user",      content: userMessage },
        { userId: user.id, questionId, role: "assistant",  content: assistantResponse },
      ],
    })
  } catch (err) {
    if (!isBuzzDbError(err)) throw err
  }
}
