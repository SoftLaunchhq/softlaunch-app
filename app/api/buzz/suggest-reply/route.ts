/**
 * BUZZ Reply Suggestion API
 * POST /api/buzz/suggest-reply
 *
 * Given a message the user received + conversation context + their profile,
 * returns 2-3 reply options that match their communication style.
 *
 * Returns JSON (not streaming) — suggestions render as a card.
 * Logs a BehavioralSignal so BUZZ can improve over time.
 *
 * Model: always uses gpt-4o-mini (OPENAI_MODEL env var, default gpt-4o-mini)
 * gpt-4o is intentionally NOT the default — it uses 3 RPM on Tier 1.
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { z } from "zod"
import {
  BUZZ_SUGGEST_REPLY_PROMPT,
  buildReplySuggestionContext,
  isBuzzDbError,
} from "@/lib/buzz"
import { db } from "@/lib/db"

const suggestReplySchema = z.object({
  // The message the user needs to reply to
  incomingMessage: z.string().min(1).max(2000),

  // Recent conversation context (who said what)
  conversationHistory: z.array(z.object({
    senderName: z.string(),
    content:    z.string().max(500),
  })).max(10).optional().default([]),

  // User profile context (passed from client)
  userProfile: z.object({
    firstName:          z.string().optional(),
    communicationStyle: z.string().nullable().optional(),
    energyStyle:        z.string().nullable().optional(),
    conflictStyle:      z.string().nullable().optional(),
    archetype:          z.string().nullable().optional(),
  }).optional().default({}),

  // Log which suggestion was accepted (for learning)
  logAccepted: z.object({
    suggestionText: z.string(),
    tone:           z.string(),
  }).optional(),
})

export interface ReplySuggestion {
  text:      string
  tone:      string
  reasoning: string
}

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const hasKey = !!process.env.OPENAI_API_KEY
  const model  = process.env.OPENAI_MODEL ?? "gpt-4o-mini"  // NEVER default to gpt-4o
  console.log(`[BUZZ suggest-reply] key=${hasKey ? "✓" : "✗"} model=${model}`)

  if (!hasKey) {
    console.warn("[BUZZ suggest-reply] OPENAI_API_KEY not set — returning 503")
    return NextResponse.json({ error: "BUZZ is offline — API key not configured" }, { status: 503 })
  }

  let parsed: z.infer<typeof suggestReplySchema>
  try {
    const body = await req.json()
    parsed = suggestReplySchema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { incomingMessage, conversationHistory, userProfile, logAccepted } = parsed

  // Log accepted suggestion for behavioral learning (non-blocking)
  if (logAccepted) {
    logBehavioralSignal(clerkId, {
      signalType: "selected_reply",
      source:     "buzz_reply_suggestion",
      content:    logAccepted.suggestionText,
      metadata:   { tone: logAccepted.tone, incomingMessage },
    }).catch((e) => console.warn("[BUZZ suggest-reply] Signal log failed:", e.message))
    return NextResponse.json({ success: true })
  }

  // Build context for the suggestion prompt
  const contextBlock = buildReplySuggestionContext({
    incomingMessage,
    conversationHistory,
    userProfile,
  })

  const fullPrompt = `${contextBlock}\n\nGenerate 2-3 reply suggestions for this person to use.`

  try {
    const { OpenAI } = await import("openai")
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    console.log(`[BUZZ suggest-reply] Calling OpenAI model=${model}`)

    let rawJson: string

    try {
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: BUZZ_SUGGEST_REPLY_PROMPT },
          { role: "user",   content: fullPrompt },
        ],
        max_tokens:      600,
        temperature:     0.8,
        response_format: { type: "json_object" },
      })
      rawJson = completion.choices[0]?.message?.content ?? "{}"
      console.log("[BUZZ suggest-reply] ✓ OpenAI responded")
    } catch (err1: any) {
      const isQuotaExhausted =
        err1?.error?.code === "insufficient_quota" ||
        String(err1?.message ?? "").includes("insufficient_quota")

      if (err1?.status === 429 && !isQuotaExhausted && model !== "gpt-4o-mini") {
        // Rate-limited on a non-mini model — retry with mini
        console.warn(`[BUZZ suggest-reply] 429 on ${model} — retrying with gpt-4o-mini`)
        const fallback = await openai.chat.completions.create({
          model:           "gpt-4o-mini",
          messages: [
            { role: "system", content: BUZZ_SUGGEST_REPLY_PROMPT },
            { role: "user",   content: fullPrompt },
          ],
          max_tokens:      600,
          temperature:     0.8,
          response_format: { type: "json_object" },
        })
        rawJson = fallback.choices[0]?.message?.content ?? "{}"
        console.log("[BUZZ suggest-reply] ✓ gpt-4o-mini fallback responded")
      } else {
        throw err1
      }
    }

    let result: { suggestions?: ReplySuggestion[] }
    try {
      result = JSON.parse(rawJson)
    } catch {
      console.error("[BUZZ suggest-reply] Invalid JSON from OpenAI:", rawJson)
      return NextResponse.json({ error: "Suggestion generation failed" }, { status: 500 })
    }

    const suggestions = (result.suggestions ?? []).slice(0, 3)
    if (suggestions.length === 0) {
      console.error("[BUZZ suggest-reply] OpenAI returned empty suggestions array")
      return NextResponse.json({ error: "No suggestions generated" }, { status: 500 })
    }

    // Log signal (non-blocking)
    logBehavioralSignal(clerkId, {
      signalType: "reply_suggestions_requested",
      source:     "buzz_reply_suggestion",
      content:    incomingMessage,
      weight:     0.5,
    }).catch(() => {})

    return NextResponse.json({ suggestions })
  } catch (error: any) {
    console.error("[BUZZ suggest-reply] OpenAI error:", error?.status, error?.message)
    if (error?.status === 429) {
      return NextResponse.json({ error: "BUZZ is busy — try again in a moment" }, { status: 429 })
    }
    return NextResponse.json({ error: "Suggestion generation failed" }, { status: 503 })
  }
}

async function logBehavioralSignal(
  clerkId: string,
  signal: {
    signalType: string
    source:     string
    content:    string
    weight?:    number
    metadata?:  Record<string, unknown>
  }
) {
  try {
    const user = await db.user.findUnique({ where: { clerkId }, select: { id: true } })
    if (!user) return
    await (db as any).behavioralSignal.create({
      data: {
        userId:     user.id,
        signalType: signal.signalType,
        source:     signal.source,
        content:    signal.content,
        weight:     signal.weight ?? 1.0,
        metadata:   signal.metadata ?? null,
      },
    })
  } catch (err) {
    if (!isBuzzDbError(err)) throw err
  }
}
