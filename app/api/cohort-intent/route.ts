import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { z } from "zod"

const schema = z.object({
  intent: z.enum(["social", "professional"], {
    errorMap: () => ({ message: "intent must be 'social' or 'professional'" }),
  }),
})

// POST /api/cohort-intent — Save the user's cohort intent selection
// Called from /onboarding/cohort-type before the user proceeds to /onboarding/assessment.
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let data: z.infer<typeof schema>
  try {
    const body = await req.json()
    data = schema.parse(body)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  try {
    await db.user.update({
      where: { clerkId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { cohortIntent: data.intent } as any,
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ""
    // Non-fatal: if DB is unavailable, still allow the user to continue to assessment.
    // cohortIntent is best-effort — the step should not block onboarding.
    if (
      msg.includes("ECONNREFUSED") ||
      msg.includes("ETIMEDOUT") ||
      msg.includes("Tenant or user not found") ||
      msg.includes("FATAL:")
    ) {
      console.warn("[cohort-intent] DB unavailable — skipping save, continuing onboarding")
      return NextResponse.json({ success: true, lite: true })
    }

    console.error("[cohort-intent] Error saving intent:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
