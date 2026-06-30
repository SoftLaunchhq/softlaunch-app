import { NextRequest, NextResponse } from "next/server"
import { auth, currentUser } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { z } from "zod"
import { CohortTheme } from "@prisma/client"

const profileSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  headline: z.string().max(80).optional(),
  bio: z.string().max(140).optional(),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
  preferredThemes: z.array(z.nativeEnum(CohortTheme)).min(1),
  preferredDays: z.array(z.string()).optional(),
  preferredTime: z.string().optional(),
})

/** Detect Prisma / DB connection errors (including pgBouncer-specific failures) */
function isDbConnectionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const e = error as any
  if (
    e.code === "P1000" || // Authentication failed against DB server
    e.code === "P1001" || // Can't reach DB server
    e.code === "P1017" || // Server closed connection
    e.code === "P2021" || // Table does not exist (schema mismatch)
    e.code === "P2028"    // Transaction API error — thrown when $transaction() is used
                          // with pgBouncer in transaction mode (?pgbouncer=true, port 6543)
  ) return true
  if (e.name === "PrismaClientInitializationError") return true
  const msg: string = e.message ?? ""
  return (
    msg.includes("ECONNREFUSED") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("connect timeout") ||
    msg.includes("password authentication failed") ||
    msg.includes("postgresql://user:password") ||
    msg.includes("Environment variable not found") ||
    msg.includes("Can't reach database server") ||
    msg.includes("Authentication failed against database server") ||
    msg.includes("credentials") ||
    // ── Supabase pgBouncer / pooler errors ────────────────────
    // Returned when the project is paused, the tenant isn't found,
    // or the pooler rejects the connection before hitting the DB layer.
    msg.includes("Tenant or user not found") ||
    msg.includes("tenant_not_found") ||
    msg.includes("Max client connections reached") ||
    msg.includes("remaining connection slots are reserved") ||
    msg.includes("FATAL:") ||
    msg.includes("ERROR:  terminating connection") ||
    msg.includes("SSL connection error") ||
    msg.includes("SSL SYSCALL error")
  )
}

// POST /api/profile — Create/update user profile (onboarding step 3)
export async function POST(req: NextRequest) {
  // 1. Auth
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // 2. Parse & validate body FIRST (before any DB calls)
  let data: z.infer<typeof profileSchema>
  try {
    const body = await req.json()
    data = profileSchema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  // 3. Try full DB path
  try {
    let user = await db.user.findUnique({ where: { clerkId } })

    if (!user) {
      // Webhook hasn't fired yet — auto-create from Clerk
      const clerkUser = await currentUser()
      const email = clerkUser?.emailAddresses?.[0]?.emailAddress
      if (!email) return NextResponse.json({ error: "User not found" }, { status: 404 })

      const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((e: string) => e.trim())
      user = await db.user.upsert({
        where: { clerkId },
        create: {
          clerkId,
          email,
          role: adminEmails.includes(email) ? "ADMIN" : "USER",
          onboardingStep: "PROFILE",
          onboardingComplete: false,
        },
        update: { email },
      })
    }

    // ─────────────────────────────────────────────────────────
    // Sequential writes — Prisma interactive transactions
    // ($transaction with async callback) are NOT compatible with
    // pgBouncer in transaction mode (?pgbouncer=true, port 6543).
    // That combination throws P2028 and surfaces as "Internal
    // server error". All three operations are idempotent upserts
    // so partial completion is safe to retry — atomicity is not
    // required here and the sequential approach is production-safe.
    // ─────────────────────────────────────────────────────────
    await db.profile.upsert({
      where: { userId: user!.id },
      create: {
        userId: user!.id,
        firstName: data.firstName,
        lastName: data.lastName,
        headline: data.headline,
        bio: data.bio,
        linkedinUrl: data.linkedinUrl || null,
      },
      update: {
        firstName: data.firstName,
        lastName: data.lastName,
        headline: data.headline,
        bio: data.bio,
        linkedinUrl: data.linkedinUrl || null,
      },
    })

    await db.cohortPreferences.upsert({
      where: { userId: user!.id },
      create: {
        userId: user!.id,
        preferredThemes: data.preferredThemes,
        preferredDays: data.preferredDays || [],
        preferredTime: data.preferredTime,
      },
      update: {
        preferredThemes: data.preferredThemes,
        preferredDays: data.preferredDays || [],
        preferredTime: data.preferredTime,
      },
    })

    await db.user.update({
      where: { id: user!.id },
      data: { onboardingStep: "COMPLETE", onboardingComplete: true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }

    // 4. If DB is unavailable, use lite mode (cookie-based)
    if (isDbConnectionError(error)) {
      console.warn("[profile] DB unavailable — using lite mode cookie fallback")
      return liteModeFallback(data)
    }

    // Structured log — surfaced in Vercel Function logs
    console.error("[profile] Unexpected save error:", {
      code: (error as any)?.code,
      name: (error as any)?.name,
      message: String((error as any)?.message ?? "").slice(0, 400),
    })
    // In development, return the raw error message so you can see exactly what failed
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json(
        {
          error: "Internal server error",
          detail: String((error as any)?.message ?? error),
          code: (error as any)?.code ?? null,
        },
        { status: 500 }
      )
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/profile — Fetch current user's profile
// ─────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const user = await db.user.findUnique({
      where: { clerkId },
      include: { profile: true, cohortPrefs: true },
    })

    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })

    return NextResponse.json({
      onboardingComplete: user.onboardingComplete,
      onboardingStep: user.onboardingStep,
      firstName: user.profile?.firstName ?? "",
      lastName: user.profile?.lastName ?? "",
      headline: user.profile?.headline ?? "",
      bio: user.profile?.bio ?? "",
      linkedinUrl: user.profile?.linkedinUrl ?? "",
      preferredThemes: user.cohortPrefs?.preferredThemes ?? [],
      preferredDays: user.cohortPrefs?.preferredDays ?? [],
      preferredTime: user.cohortPrefs?.preferredTime ?? "",
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ""
    const isConn =
      msg.includes("ECONNREFUSED") ||
      msg.includes("ETIMEDOUT")
    if (isConn) return NextResponse.json({ error: "db_unavailable" }, { status: 503 })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Lite mode: store profile data in a cookie and return success.
 * The user can continue to /dashboard; data will be synced when DB connects.
 */
function liteModeFallback(data: z.infer<typeof profileSchema>): NextResponse {
  const payload = {
    firstName: data.firstName,
    lastName: data.lastName,
    headline: data.headline || null,
    bio: data.bio || null,
    linkedinUrl: data.linkedinUrl || null,
    preferredThemes: data.preferredThemes,
    preferredDays: data.preferredDays || [],
    preferredTime: data.preferredTime || null,
  }

  const response = NextResponse.json({ success: true, lite: true })
  response.cookies.set("sl_profile_v1", JSON.stringify(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  })
  return response
}
