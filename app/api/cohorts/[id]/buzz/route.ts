/**
 * BUZZ Cohort Facilitation API
 * POST /api/cohorts/[id]/buzz
 *
 * Generates a BUZZ AI facilitation message for the cohort chat and saves it.
 *
 * Context BUZZ uses:
 *   - Cohort name + week number
 *   - Cohort intent (social vs professional) — derived from member intents
 *   - Member profiles + archetypes (used internally, never exposed to members)
 *   - Recent conversation history
 *
 * Behavior adapts by cohortIntent:
 *   "social"       → community-building, warm/playful, relationship-focused
 *   "professional" → strategic, goal-oriented, accountability-focused
 *
 * Authorization:
 *   - Must be an ACTIVE cohort member (or admin, for testing)
 *   - server-side via Clerk auth() + DB membership check
 *
 * Rate limiting:
 *   - 429 if BUZZ posted in the last 30 seconds (prevents duplicate prompts)
 *
 * Resilience:
 *   - Falls back to curated local prompts if OpenAI is unavailable
 *   - NEVER crashes the chat on AI failure
 *
 * Raw SQL approach:
 *   Uses db.$queryRaw / db.$executeRaw instead of db.cohortMessage.*
 *   so it works before `prisma generate` is re-run after schema changes.
 *   The CohortMessage table is created automatically on first use.
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { BUZZ_SYSTEM_PROMPT } from "@/lib/buzz"

// ─── Local BUZZ fallback prompts ─────────────────────────────
// High-quality, curated prompts used when OpenAI is unavailable.
// Separate pools for social vs professional cohorts.

const SOCIAL_BUZZ_PROMPTS = [
  "What's one thing that's been on your mind this week that you haven't told anyone yet?",
  "If this group could do one thing together outside of SoftLaunch, what would it be?",
  "What does 'showing up for someone' mean to you — and when did someone last do that for you?",
  "What's something you're genuinely proud of this week, big or small?",
  "What's something that energized you recently, and what's something that drained you?",
  "If you had to describe your headspace this week in three words, what would they be?",
  "What's one habit or ritual you have that most people don't know about?",
  "What's something you've been looking forward to lately — and why does it matter to you?",
  "What's one thing you wish someone had told you a year ago?",
  "If you could swap lives with someone in this group for a week, who would it be and what would you learn?",
]

const PROFESSIONAL_BUZZ_PROMPTS = [
  "What's the one thing you need to make progress on this week — and what's actually standing in the way?",
  "Where have you been playing it safe when you know you should be taking a risk?",
  "What does success look like for you in the next 30 days, specifically?",
  "What's a challenge you're sitting with right now that you'd value a second opinion on?",
  "Name the biggest assumption in your current strategy. How would you test it?",
  "What's something you've been avoiding that you know you need to face?",
  "What did you learn this week — from a win, a loss, or a moment of friction?",
  "If you had to bet on the one thing that will most move your work forward this month, what is it?",
  "What's a decision you're sitting on right now? What would have to be true for you to just make it?",
  "What are you optimizing for right now — and is it actually the right thing to optimize for?",
]

function getLocalBuzzPrompt(intent: "social" | "professional" | null): string {
  const pool = intent === "social" ? SOCIAL_BUZZ_PROMPTS : PROFESSIONAL_BUZZ_PROMPTS
  return pool[Math.floor(Math.random() * pool.length)]
}

// ─── Table bootstrap ──────────────────────────────────────────

async function ensureCohortMessageTable() {
  try {
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS "CohortMessage" (
        "id"         TEXT        NOT NULL,
        "cohortId"   TEXT        NOT NULL,
        "senderId"   TEXT,
        "senderType" TEXT        NOT NULL DEFAULT 'MEMBER',
        "senderName" TEXT,
        "content"    TEXT        NOT NULL,
        "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "CohortMessage_pkey" PRIMARY KEY ("id")
      )
    `
    await db.$executeRaw`
      CREATE INDEX IF NOT EXISTS "CohortMessage_cohortId_createdAt_idx"
        ON "CohortMessage" ("cohortId", "createdAt")
    `
    await db.$executeRaw`
      CREATE INDEX IF NOT EXISTS "CohortMessage_senderId_idx"
        ON "CohortMessage" ("senderId")
    `
    await db.$executeRaw`
      DO $$ BEGIN
        ALTER TABLE "CohortMessage"
          ADD CONSTRAINT "CohortMessage_cohortId_fkey"
          FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `
    await db.$executeRaw`
      DO $$ BEGIN
        ALTER TABLE "CohortMessage"
          ADD CONSTRAINT "CohortMessage_senderId_fkey"
          FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `
  } catch (err: any) {
    console.warn("[CohortMessage] ensureTable warning:", err?.message?.slice(0, 200))
  }
}

// ─── Auth helper ─────────────────────────────────────────────

async function checkCohortMember(cohortId: string) {
  // MUST await auth() — Clerk v5 auth() is async in Next.js Route Handlers
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return { ok: false as const, userId: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const dbUser = await db.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true },
  })

  if (!dbUser) {
    return { ok: false as const, userId: null, error: NextResponse.json({ error: "User not found" }, { status: 401 }) }
  }

  if (dbUser.role === "ADMIN") {
    return { ok: true as const, userId: dbUser.id, isAdmin: true, error: null }
  }

  const membership = await db.cohortMembership.findUnique({
    where: { cohortId_userId: { cohortId, userId: dbUser.id } },
    select: { status: true },
  })

  if (!membership || membership.status !== "ACTIVE") {
    return {
      ok: false as const,
      userId: null,
      error: NextResponse.json(
        { error: "Forbidden: not an active cohort member" },
        { status: 403 }
      ),
    }
  }

  return { ok: true as const, userId: dbUser.id, isAdmin: false, error: null }
}

// ─── Build BUZZ system prompt ─────────────────────────────────
// Includes social vs professional context + what BUZZ's role is in a group chat.

function buildCohortBuzzSystemPrompt(
  cohortName: string,
  intent: "social" | "professional" | null,
  weekNumber: number,
  memberContext: string
): string {
  const intentContext =
    intent === "social"
      ? `This is a SOCIAL cohort. Members joined to build genuine friendships and a supportive community.
Focus on: personal stories, vulnerability, shared experiences, emotional support, and fun.
Avoid: performance pressure, career metrics, hustle culture, professional advice unless explicitly asked.
Tone: warm, curious, playful, human — like a thoughtful friend asking exactly the right question.`
      : `This is a PROFESSIONAL cohort. Members joined for accountability, career growth, and building momentum.
Focus on: goals, blockers, strategy, honest reflection, bold moves, and real progress.
Avoid: generic small talk, vague encouragement, or surface-level responses.
Tone: direct, sharp, challenging but supportive — like a coach who cares enough to push you.`

  return `${BUZZ_SYSTEM_PROMPT}

---

You are facilitating the GROUP CHAT for "${cohortName}" (Week ${weekNumber} of 4).

COHORT TYPE:
${intentContext}

COHORT MEMBERS:
${memberContext || "A group of 4 members with complementary drives and goals."}

YOUR ROLE AS GROUP FACILITATOR:
- Post ONE focused question that sparks real conversation between members.
- Your goal is human-to-human connection — you facilitate, you do not dominate.
- DO NOT give advice. DO NOT summarize. DO NOT answer your own question.
- Keep your message under 80 words. One question. One question mark.
- Make the question concrete enough that any member can answer immediately.
- Do NOT write bullet points. Do NOT use exclamation points.
- DO NOT say things like "As your facilitator..." or "I want to ask you all..."
- Just ask the question directly, as if you're one of the group.

PRIVACY RULES:
- Never reveal what any individual member told you privately.
- Never reference specific assessment answers or profile scores.
- You may use your knowledge of the group to choose a relevant topic, but keep the question open.
- Never say "Based on your profiles" or "I know that X tends to..."

IMPORTANT: You are talking TO the group. Use "you" — never refer to members in third person.`
}

// ─── POST /api/cohorts/[id]/buzz ─────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cohortId = params.id

  // ── 1. Auth ────────────────────────────────────────────────
  const authResult = await checkCohortMember(cohortId)
  if (!authResult.ok) return authResult.error

  // ── 2. Fetch cohort + member context ──────────────────────
  const cohort = await db.cohort.findUnique({
    where: { id: cohortId },
    select: {
      id: true,
      name: true,
      currentWeek: true,
      memberships: {
        where: { status: "ACTIVE" },
        take: 6,
        select: {
          user: {
            select: {
              cohortIntent: true,
              profile: {
                select: { firstName: true, headline: true, bio: true },
              },
              driveProfile: {
                select: {
                  archetype: true,
                  archetypeSlug: true,
                  ambition: true,
                  community: true,
                  discipline: true,
                  openness: true,
                  growth: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!cohort) {
    return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
  }

  // ── 3. Derive cohort intent ────────────────────────────────
  // Majority vote among member intents; default to "professional"
  const intents = cohort.memberships
    .map((m) => m.user.cohortIntent)
    .filter(Boolean) as string[]
  const socialCount = intents.filter((i) => i === "social").length
  const cohortIntent: "social" | "professional" =
    socialCount > intents.length / 2 ? "social" : "professional"

  // ── 4. Ensure table exists ─────────────────────────────────
  await ensureCohortMessageTable()

  // ── 5. Rate limit ──────────────────────────────────────────
  // Prevent BUZZ from posting more than once per 30 seconds
  try {
    const recentBuzzRows = await db.$queryRaw<Array<{ createdAt: Date }>>`
      SELECT "createdAt" FROM "CohortMessage"
      WHERE "cohortId" = ${cohortId} AND "senderType" = 'BUZZ'
      ORDER BY "createdAt" DESC
      LIMIT 1
    `
    if (recentBuzzRows.length > 0) {
      const msSinceLast = Date.now() - new Date(recentBuzzRows[0].createdAt).getTime()
      if (msSinceLast < 30_000) {
        return NextResponse.json({ error: "Rate limited: BUZZ just posted" }, { status: 429 })
      }
    }
  } catch (rateErr: any) {
    // Non-fatal: if rate check fails, proceed anyway
    console.warn("[cohort-buzz] Rate check error (non-fatal):", rateErr?.message?.slice(0, 200))
  }

  // ── 6. Fetch recent conversation context ──────────────────
  let contextMessages: Array<{ senderName: string | null; senderType: string; content: string }> = []
  try {
    contextMessages = await db.$queryRaw<typeof contextMessages>`
      SELECT "senderName", "senderType", "content" FROM "CohortMessage"
      WHERE "cohortId" = ${cohortId}
      ORDER BY "createdAt" DESC
      LIMIT 12
    `
    contextMessages = [...contextMessages].reverse()
  } catch {
    // Non-fatal: BUZZ can post even with no conversation history
    contextMessages = []
  }

  // ── 7. Build member context for BUZZ ──────────────────────
  // Summarizes the group archetypes without exposing private scores.
  // Used internally by BUZZ only — never returned to clients.
  const memberContext = cohort.memberships
    .map((m, i) => {
      const p = m.user.profile
      const d = m.user.driveProfile
      const name = p?.firstName || `Member ${i + 1}`
      const headline = p?.headline || ""
      const archetype = d?.archetype || "Unknown"
      // Round scores so they don't look like precise assessments
      const traits = d
        ? `Ambition ${Math.round((d.ambition || 50) / 10) * 10}, Community ${Math.round((d.community || 50) / 10) * 10}, Growth ${Math.round((d.growth || 50) / 10) * 10}`
        : ""
      return `- ${name}${headline ? ` (${headline})` : ""}: ${archetype}${traits ? `. ${traits}.` : ""}`
    })
    .join("\n")

  // ── 8. Generate BUZZ message ──────────────────────────────
  const weekNumber = cohort.currentWeek || 1
  const systemPrompt = buildCohortBuzzSystemPrompt(
    cohort.name,
    cohortIntent,
    weekNumber,
    memberContext
  )

  const hasKey = !!process.env.OPENAI_API_KEY
  let buzzContent: string

  if (!hasKey) {
    console.log("[cohort-buzz] No OPENAI_API_KEY — using local fallback prompt")
    buzzContent = getLocalBuzzPrompt(cohortIntent)
  } else {
    try {
      const { default: OpenAI } = await import("openai")
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

      const conversationContext =
        contextMessages.length > 0
          ? contextMessages
              .map(
                (m) =>
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
            content: `Recent conversation:\n\n${conversationContext}\n\nPost your next facilitation question now. One question. Under 80 words.`,
          },
        ],
        max_tokens: 150,
        temperature: 0.82,
      })

      const aiText = completion.choices[0]?.message?.content?.trim()
      buzzContent = aiText || getLocalBuzzPrompt(cohortIntent)
    } catch (aiError: any) {
      console.error("[cohort-buzz] OpenAI error:", aiError?.message?.slice(0, 300))
      // Graceful fallback — BUZZ stays "alive" even when OpenAI is down
      buzzContent = getLocalBuzzPrompt(cohortIntent)
    }
  }

  // ── 9. Save BUZZ message to DB ────────────────────────────
  const messageId = `buzz_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  try {
    const rows = await db.$queryRaw<Array<{
      id: string
      cohortId: string
      senderId: string | null
      senderType: string
      senderName: string | null
      content: string
      createdAt: Date
    }>>`
      INSERT INTO "CohortMessage" ("id", "cohortId", "senderId", "senderType", "senderName", "content", "createdAt")
      VALUES (${messageId}, ${cohortId}, NULL, 'BUZZ', 'BUZZ', ${buzzContent}, NOW())
      RETURNING "id", "cohortId", "senderId", "senderType", "senderName", "content", "createdAt"
    `

    const message = rows[0]
    if (!message) throw new Error("BUZZ insert returned no rows")

    return NextResponse.json({
      message: {
        ...message,
        createdAt: message.createdAt instanceof Date
          ? message.createdAt.toISOString()
          : message.createdAt,
      },
    })
  } catch (dbError: any) {
    console.error("[cohort-buzz] DB write error:", dbError?.message?.slice(0, 300))
    return NextResponse.json(
      { error: "BUZZ couldn't save its message — please try again" },
      { status: 500 }
    )
  }
}
