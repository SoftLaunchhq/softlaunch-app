/**
 * BUZZ Memory API
 *
 * GET  /api/buzz/memory — fetch all memories for current user
 * POST /api/buzz/memory — upsert one or more memory entries
 * DELETE /api/buzz/memory — clear all memories for current user
 *
 * Consent model: the client ONLY calls POST after user explicitly enables BUZZ memory.
 * This endpoint never auto-saves anything — every write is user-initiated.
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { z } from "zod"

const memoryEntrySchema = z.object({
  key: z.string().min(1).max(64),
  value: z.string().min(1).max(500),
  source: z.enum(["assessment", "conversation", "profile"]),
})

const postSchema = z.object({
  memories: z.array(memoryEntrySchema).min(1).max(50),
})

/** GET — return all stored BUZZ memories */
export async function GET() {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const user = await db.user.findUnique({ where: { clerkId }, select: { id: true } })
    if (!user) return NextResponse.json({ memories: [] })

    const memories = await db.buzzMemory.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
    })

    return NextResponse.json({ memories })
  } catch (error: any) {
    if (isDbUnavailable(error)) {
      return NextResponse.json({ memories: [], lite: true })
    }
    console.error("[buzz/memory GET]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** POST — upsert memory entries (only when user consents) */
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let parsed: z.infer<typeof postSchema>
  try {
    const body = await req.json()
    parsed = postSchema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  try {
    const user = await db.user.findUnique({ where: { clerkId }, select: { id: true } })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    // Upsert each memory entry
    await db.$transaction(
      parsed.memories.map((m) =>
        db.buzzMemory.upsert({
          where: { userId_key: { userId: user.id, key: m.key } },
          create: { userId: user.id, key: m.key, value: m.value, source: m.source },
          update: { value: m.value, source: m.source },
        })
      )
    )

    return NextResponse.json({ success: true, saved: parsed.memories.length })
  } catch (error: any) {
    if (isDbUnavailable(error)) {
      // Return success in lite mode — client stores in localStorage as fallback
      return NextResponse.json({ success: true, lite: true })
    }
    console.error("[buzz/memory POST]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** DELETE — wipe all memories (user-requested) */
export async function DELETE() {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const user = await db.user.findUnique({ where: { clerkId }, select: { id: true } })
    if (!user) return NextResponse.json({ success: true }) // Nothing to delete

    await db.buzzMemory.deleteMany({ where: { userId: user.id } })
    await db.buzzConversation.deleteMany({ where: { userId: user.id } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (isDbUnavailable(error)) {
      return NextResponse.json({ success: true, lite: true })
    }
    console.error("[buzz/memory DELETE]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function isDbUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const e = error as any
  return (
    e.code === "P1001" ||
    e.code === "P1017" ||
    e.name === "PrismaClientInitializationError" ||
    e?.message?.includes("ECONNREFUSED") ||
    e?.message?.includes("postgresql://user:password")
  )
}
