// ─────────────────────────────────────────────────────────────
// app/api/partner/track/route.ts
// Called client-side after sign-up/sign-in to persist partner
// attribution from cookie → database.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { readPartnerSourceFromCookies } from "@/lib/partnerTracking"
import { shouldActivateBenefit } from "@/lib/partnerBenefits"
import { getPartner } from "@/lib/partners"

export async function POST(req: NextRequest) {
  try {
    // ── Auth check ────────────────────────────────────────
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // ── Read partner source ───────────────────────────────
    // Prefer request body (sent from client after clearPartnerTracking),
    // fall back to server-readable cookie.
    let partnerSource: string | null = null
    let partnerCode: string | null = null

    try {
      const body = await req.json()
      if (typeof body.source === "string") partnerSource = body.source
      if (typeof body.code === "string") partnerCode = body.code
    } catch {
      // Body not JSON or empty — read from cookie instead
    }

    if (!partnerSource) {
      const cookieStore = await cookies()
      partnerSource = readPartnerSourceFromCookies(cookieStore)
    }

    if (!partnerSource) {
      // No partner source found — nothing to persist
      return NextResponse.json({ ok: true, tracked: false })
    }

    // Validate the partner slug
    const partner = getPartner(partnerSource)
    if (!partner) {
      return NextResponse.json({ ok: true, tracked: false, reason: "unknown_partner" })
    }

    // ── Find user record ──────────────────────────────────
    const user = await (db.user.findUnique as Function)({
      where: { clerkId: userId },
      select: { id: true, partnerSource: true },
    }) as { id: string; partnerSource: string | null } | null

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Don't overwrite an existing attribution
    if (user.partnerSource) {
      return NextResponse.json({ ok: true, tracked: false, reason: "already_attributed" })
    }

    // ── Persist attribution ───────────────────────────────
    const activateBenefit = shouldActivateBenefit(partnerSource)

    await (db.user.update as Function)({
      where: { id: user.id },
      data: {
        partnerSource,
        partnerCode: partnerCode ?? undefined,
        partnerJoinedAt: new Date(),
        partnerBenefitActive: activateBenefit,
      },
    })

    console.log(`[PartnerTrack] User ${user.id} attributed to partner "${partnerSource}" (benefit: ${activateBenefit})`)

    return NextResponse.json({
      ok: true,
      tracked: true,
      partner: partner.name,
      benefitActive: activateBenefit,
    })
  } catch (error) {
    console.error("[PartnerTrack] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
