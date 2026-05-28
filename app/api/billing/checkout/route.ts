import { NextRequest, NextResponse } from "next/server"
import { auth, currentUser } from "@clerk/nextjs/server"
import { createCheckoutSession } from "@/lib/stripe"
import { z } from "zod"

const checkoutSchema = z.object({
  // cohortId is optional — users can upgrade before being matched
  cohortId: z.string().optional().nullable(),
})

// POST /api/billing/checkout — Create Stripe checkout session
export async function POST(req: NextRequest) {
  // 1. Auth
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const clerkUser = await currentUser()
  if (!clerkUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  // 2. Parse body
  let cohortId: string | null = null
  try {
    const body = await req.json()
    const parsed = checkoutSchema.parse(body)
    cohortId = parsed.cohortId ?? null
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  // 3. Resolve user identity
  // Try DB first for the real user ID + profile name;
  // fall back to Clerk data when DB is unavailable (placeholder DATABASE_URL)
  let userId = clerkId
  let name = ""
  const email = clerkUser.emailAddresses[0]?.emailAddress ?? ""

  try {
    const { db } = await import("@/lib/db")
    const user = await db.user.findUnique({
      where: { clerkId },
      include: { profile: true },
    })
    if (user) {
      userId = user.id
      name = [user.profile?.firstName, user.profile?.lastName]
        .filter(Boolean)
        .join(" ")
    }
  } catch {
    // DB unavailable — use Clerk identity directly
  }

  // Fallback name from Clerk if profile not yet saved
  if (!name) {
    name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || email
  }

  // 4. Validate Stripe config before hitting the API
  const priceId = process.env.STRIPE_PRICE_ID_30
  if (!priceId) {
    console.error("[checkout] STRIPE_PRICE_ID_30 is not set in .env.local")
    return NextResponse.json(
      { error: "Payments are not configured yet. Contact support." },
      { status: 503 }
    )
  }
  if (priceId.startsWith("prod_")) {
    console.error("[checkout] STRIPE_PRICE_ID_30 is a product ID, not a price ID:", priceId)
    return NextResponse.json(
      {
        error:
          "Stripe config error: STRIPE_PRICE_ID_30 is set to a product ID (prod_...). " +
          "You need the Price ID. Go to Stripe Dashboard → Products → SoftLaunch Pro → copy the ID that starts with price_",
      },
      { status: 503 }
    )
  }

  // 5. Create checkout session
  const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard`

  try {
    const checkoutUrl = await createCheckoutSession({
      userId,
      email,
      name,
      cohortId,
      returnUrl,
    })

    return NextResponse.json({ url: checkoutUrl })
  } catch (error: any) {
    console.error("[checkout] Stripe error:", error)

    if (error?.message?.includes("price_") || error?.message?.includes("STRIPE_PRICE_ID_30")) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    if (error?.type === "StripeInvalidRequestError") {
      return NextResponse.json({ error: `Stripe: ${error.message}` }, { status: 400 })
    }

    return NextResponse.json(
      { error: "Failed to create checkout session. Please try again." },
      { status: 500 }
    )
  }
}
