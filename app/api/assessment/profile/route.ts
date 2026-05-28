import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { cookies } from "next/headers"
import { db } from "@/lib/db"

// GET /api/assessment/profile — Get current user's drive profile
export async function GET() {
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 1. Try DB first
  try {
    const user = await db.user.findUnique({
      where: { clerkId },
      include: { driveProfile: true },
    })

    if (user?.driveProfile) {
      return NextResponse.json(user.driveProfile)
    }

    // User exists but no drive profile yet — check lite mode cookie as fallback
    // (covers race condition where DB is connected but assessment was done in lite mode)
  } catch (error: any) {
    const isConnError =
      error?.code === "P1001" ||
      error?.code === "P1017" ||
      error?.name === "PrismaClientInitializationError" ||
      error?.message?.includes("ECONNREFUSED") ||
      error?.message?.includes("postgresql://user:password")

    if (!isConnError) {
      console.error("Profile fetch error:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
    // Fall through to cookie fallback below
    console.warn("[assessment/profile] DB unavailable — reading from lite mode cookie")
  }

  // 2. Lite mode fallback: read from cookie
  const cookieStore = cookies()
  const liteCookie = cookieStore.get("sl_drive_v1")

  if (liteCookie?.value) {
    try {
      const profile = JSON.parse(liteCookie.value)
      // Validate that it has the minimum shape the reveal page expects
      if (profile.archetype && profile.archetypeSlug) {
        return NextResponse.json(profile)
      }
    } catch {
      // Cookie was malformed — fall through to 404
    }
  }

  return NextResponse.json({ error: "Drive profile not found" }, { status: 404 })
}
