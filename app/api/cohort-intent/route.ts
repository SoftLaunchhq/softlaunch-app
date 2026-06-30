import { NextRequest, NextResponse } from "next/server"
import { auth, currentUser } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { z } from "zod"

// ─────────────────────────────────────────────────────────────
// POST /api/cohort-intent
//
// Saves the user's cohort type selection ("social" | "professional").
//
// Design notes:
// - Always sets a durable httpOnly cookie (sl_cohort_intent) FIRST.
//   This is what the dashboard gate reads, so the flow works even if
//   the DB column doesn't exist yet (i.e. before `prisma db push` is run).
// - Then attempts to persist to the database using $executeRaw so we
//   bypass the Prisma generated-client type check entirely.
//   $executeRaw works as long as the column exists in Postgres; if it
//   doesn't (column added to schema but not yet pushed), it logs clearly
//   and continues — the cookie keeps the user unblocked.
// - Works for: brand-new users, existing users, Clerk users missing from DB.
// ─────────────────────────────────────────────────────────────

const COOKIE_NAME = "sl_cohort_intent"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

const schema = z.object({
  intent: z.enum(["social", "professional"], {
    errorMap: () => ({ message: "intent must be 'social' or 'professional'" }),
  }),
})

export async function POST(req: NextRequest) {
  // ── 1. Auth ───────────────────────────────────────────────
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ── 2. Validate body ──────────────────────────────────────
  let data: z.infer<typeof schema>
  try {
    const body = await req.json()
    data = schema.parse(body)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0]?.message ?? "Invalid intent" }, { status: 400 })
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  // ── 3. Build response with cookie SET FIRST ───────────────
  // The cookie is the primary gate mechanism. It works immediately and
  // independently of whether the DB column exists yet.
  const res = NextResponse.json({ success: true })
  res.cookies.set(COOKIE_NAME, data.intent, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  })

  // ── 4. Persist to DB via raw SQL (bypasses Prisma client types) ───
  // Using $executeRaw so this works even before `prisma generate` is re-run.
  // If the column doesn't exist in the database yet, log clearly and continue —
  // the cookie above keeps the user flowing past the dashboard gate.
  try {
    // Ensure a User row exists for this clerkId before updating.
    // If the user record is missing (webhook missed), auto-create it.
    const existing = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    })

    if (!existing) {
      // Auto-create from Clerk — same pattern as the dashboard auto-create
      const clerkUser = await currentUser()
      const email = clerkUser?.emailAddresses?.[0]?.emailAddress?.toLowerCase().trim()
      if (email) {
        const adminEmails = (process.env.ADMIN_EMAILS || "")
          .split(",")
          .map((e: string) => e.trim().toLowerCase())
          .filter(Boolean)

        await db.user.upsert({
          where: { clerkId },
          create: {
            clerkId,
            email,
            role: adminEmails.includes(email) ? "ADMIN" : "USER",
            onboardingStep: "WELCOME",
            onboardingComplete: false,
          },
          update: {},
        })
        console.log(`[cohort-intent] Auto-created user for clerkId ${clerkId}`)
      }
    }

    // Write cohortIntent with raw SQL — bypasses Prisma client type checking.
    // This works whether or not `prisma generate` has been re-run after adding
    // the cohortIntent field to schema.prisma.
    await db.$executeRaw`
      UPDATE "User"
      SET "cohortIntent" = ${data.intent}, "updatedAt" = NOW()
      WHERE "clerkId" = ${clerkId}
    `
    console.log(`[cohort-intent] Saved intent="${data.intent}" for clerkId ${clerkId}`)
  } catch (dbErr: unknown) {
    const msg = dbErr instanceof Error ? dbErr.message : String(dbErr)

    // Detect "column does not exist" — this means prisma db push hasn't been run yet.
    if (msg.includes('column "cohortIntent"') || msg.includes("cohortIntent")) {
      console.error(
        "[cohort-intent] ⚠️  DB column 'cohortIntent' does not exist yet.\n" +
        "  Run the following on your local machine:\n" +
        "  1. npx prisma generate\n" +
        "  2. npx prisma db push --schema prisma/schema.prisma\n" +
        "  The cookie-based fallback is active — users can still continue."
      )
    } else {
      // Other DB error (connection issue, pool exhausted, etc.)
      console.warn("[cohort-intent] DB save failed (non-fatal, cookie is set):", msg)
    }
    // Do NOT return an error response — the cookie is set and that's enough
    // to get the user past the dashboard gate without an infinite redirect.
  }

  return res
}
