/**
 * BUZZ Cohort Facilitation API
 * POST /api/cohorts/[id]/buzz
 *
 * Generates a BUZZ AI facilitation message for the cohort chat and saves it.
 * BUZZ reads the last N messages for context and responds as the cohort facilitator.
 *
 * Behavior adapts by cohortIntent:
 *   - "social"       → community-building, relationship-focused, warm/playful tone
 *   - "professional" → strategic, goal-oriented, challenge-focused tone
 *
 * Authorization: caller must be an ACTIVE cohort member (or admin).
 * Rate limiting: returns 429 if BUZZ already posted in the last 30 seconds.
 *
 * Resilience: if OpenAI is unavailable, returns a local BUZZ fallback message.
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { BUZZ_SYSTEM_PROMPT } from "@/lib/buzz"

// ─── Local BUZZ fallback prompts by intent ────────────────────

const SOCIAL_BUZZ_PROMPTS = [
  "What's one thing that's been on your mind this week that you haven't told anyone yet?",
  "If your group could do one thing together outside of SoftLaunch, what would it be?",
  "What does 'showing up for someone' mean to you, and when did someone last do that for you?",
  "What's something you're proud of this week — big or small?",
  "Name one quality you admire in someone in this group. You don't have to tag them.",
  "What's something that energized you recently, and what's something that drained you?",
  "If you had to describe your vibe this week in three words, what would they be?",
  "What's one habit or ritual you have that most people don't know about?",
]

const PROFESSIONAL_BUZZ_PROMPTS = [
  "What's the one thing you need to make progress on this week — and what's standing in the way?",
  "Where have you been playing it safe when you know you should be taking a risk?",
  "What does success look like for you in the next 30 days, specifically?",
  "What's a challenge you're sitting with right now that you'd value a second opinion on?",
  "Name the biggest assumption in your current strategy. How would you test it?",
  "What's something you've been avoiding that you know you need to face?",
  "What did you learn this week — from a win, a loss, or an observation?",
  "If you had to bet on the one thing that will most move your work forward this month, what is it?",
]

function getLocalBuzzPrompt(intent: "social" | "professional" | null): string {
  const pool = intent === "social" ? SOCIAL_BUZZ_PROMPTS : PROFESSIONAL_BUZZ_PROMPTS
  return pool[Math.floor(Math.random() * pool.length)]
}

// ─── Authorization ────────────────────────────────────────────

async function requireCohortMember(cohortId: string) {
  const { userId: clerkId } = auth()
  if (!clerkId) throw NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dbUser = await db.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true },
  })
  if (!dbUser) throw NextResponse.json({ error: "User not found" }, { status: 401 })

  if (dbUser.role === "ADMIN") return { userId: dbUser.id, isAdmin: true }

  const membership = await db.cohortMembership.findUnique({
    where: { cohortId_userId: { cohortId, userId: dbUser.id } },
    select: { status: true },
  })

  if (!membership || membership.status !== "ACTIVE") {
    throw NextResponse.json(
      { error: "Forbidden: not an active cohort member" },
      { status: 403 }
    )
  }

  return { userId: dbUser.id, isAdmin: false }
}

// ─── Build BUZZ cohort system prompt ─────────────────────────

function buildCohortBuzzSystemPrompt(
  cohortName: string,
  intent: "social" | "professional" | null,
  weekNumber: number
): string {
  const intentContext =
    intent === "social"
      ? `This is a SOCIAL cohort. Members are here to build genuine friendships and a supportive community.
Focus on: personal stories, vulnerability, connection, shared experiences, emotional support, fun.
Avoid: pressure, performance metrics, hustle culture, career advice unless asked.
Tone: warm, curious, playful, human. Like a thoughtful friend asking the right question.`
      : `This is a PROFESSIONAL cohort. Members are here for accountability, career growth, and building momentum.
Focus on: goals, blockers, progress, strategic thinking, honest feedback, bold moves.
Avoid: small talk for its own sake, vague encouragement, generic advice.
Tone: direct, sharp, challenging but supportive. Like a coach who respects the person enough to push them.`

  return `${BUZZ_SYSTEM_PROMPT}

---

You are facilitating a COHORT CHAT for "${cohortName}", currently in Week ${weekNumber} of a 4-week arc.

${intentContext}

COHORT CHAT ROLE:
- You are BUZZ, the cohort facilitator. You appear in the group conversation as a named participant.
- Ask one focused, specific question that sparks real conversation between members.
- DO NOT give advice unless directly asked. DO NOT summarize what members said. DO NOT answer your own question.
- Keep your message under 80 words. One question only.
- Your question should be concrete enough that any member can answer it immediately.
- Do not use bullet points or lists. One natural, flowing question.
- End every message with a single question mark. No exclamation points.

IMPORTANT: You are talking TO the group, not about them. Use "you" and "your group" — never refer to members in third person.`
}

// ─── POST handler ─────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cohortId = params.id

  try {
    await requireCohortMember(cohortId)
  } catch (err) {
    if (err instanceof NextResponse) return err
    throw err
  }

  // Fetch cohort + recent messages for context
  const cohort = await db.cohort.findUnique({
    where: { id: cohortId },
    select: {
      id: true,
      name: true,
      currentWeek: true,
      memberships: {
        where: { status: "ACTIVE" },
        take: 4,
        select: {
          user: {
            select: {
              cohortIntent: true,
              profile: { select: { firstName: true } },
            },
          },
        },
      },
    },
  })

  if (!cohort) {
    return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
  }

  // Derive cohort intent from member intents (majority vote, default to professional)
  const intents = cohort.memberships
    .map((m) => m.user.cohortIntent)
    .filter(Boolean) as string[]
  const socialCount = intents.filter((i) => i === "social").length
  const cohortIntent: "social" | "professional" =
    socialCount > intents.length / 2 ? "social" : "professional"

  // Rate limit: don't let BUZZ post more than once per 30 seconds
  const recentBuzz = await (db as any).cohortMessage.findFirst({
    where: { cohortId, senderType: "BUZZ" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  })

  if (recentBuzz) {
    const msSinceLastBuzz = Date.now() - new Date(recentBuzz.createdAt).getTime()
    if (msSinceLastBuzz < 30_000) {
      return NextResponse.json(
        { error: "Rate limited: BUZZ just posted" },
        { status: 429 }
      )
    }
  }

  // Fetch last 10 messages for conversation context
  const recentMessages = await (db as any).cohortMessage.findMany({
    where: { cohortId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { senderName: true, senderType: true, content: true, createdAt: true },
  })
  const contextMessages = (recentMessages as any[]).reverse()

  const weekNumber = cohort.currentWeek || 1
  const systemPrompt = buildCohortBuzzSystemPrompt(cohort.name, cohortIntent, weekNumber)

  const hasKey = !!process.env.OPENAI_API_KEY

  let buzzContent: string

  if (!hasKey) {
    buzzContent = getLocalBuzzPrompt(cohortIntent)
  } else {
    try {
      const { default: OpenAI } = await import("openai")
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

      const conversationContext =
        contextMessages.length > 0
          ? contextMessages
              .map(
                (m: any) =>
                  `${m.senderType === "BUZZ" ? "BUZZ" : m.senderName || "Member"}: ${m.content}`
              )
              .join("\n")
          : "No messages yet — this is the opening of the cohort chat."

      const model = process.env.OPENAI_MODEL || "gpt-4o-mini"

      const completion = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Here is the recent cohort conversation:\n\n${conversationContext}\n\nPost your next BUZZ facilitation question now.`,
          },
        ],
        max_tokens: 150,
        temperature: 0.85,
      })

      buzzContent =
        completion.choices[0]?.message?.content?.trim() ||
        getLocalBuzzPrompt(cohortIntent)
    } catch (error: any) {
      console.error("[cohort-buzz] OpenAI error:", error?.message)
      buzzContent = getLocalBuzzPrompt(cohortIntent)
    }
  }

  // Save BUZZ message to DB
  try {
    const message = await (db as any).cohortMessage.create({
      data: {
        id: `buzz_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        cohortId,
        senderId: null,
        senderType: "BUZZ",
        senderName: "BUZZ",
        content: buzzContent,
      },
    })

    return NextResponse.json({ message })
  } catch (error) {
    console.error("[cohort-buzz] DB write error:", error)
    return NextResponse.json({ error: "Failed to save BUZZ message" }, { status: 500 })
  }
}
