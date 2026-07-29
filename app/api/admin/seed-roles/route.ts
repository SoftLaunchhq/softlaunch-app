/**
 * POST /api/admin/seed-roles
 *
 * ONE-TIME ADMIN BOOTSTRAPPING ENDPOINT
 *
 * Purpose: Directly promotes users in ADMIN_EMAILS (or an explicit override list)
 * to ADMIN role in the database. Designed to fix the case where users signed up
 * before their email was added to ADMIN_EMAILS, leaving their DB role as USER.
 *
 * Security:
 *   - Requires Bearer token matching ADMIN_SEED_SECRET env var
 *   - Never reads role from the request — only reads email
 *   - Only promotes to ADMIN — never downgrades
 *   - Safe to call multiple times (idempotent)
 *   - Returns masked emails in response (no plaintext exposure)
 *
 * Usage (one-time, from curl or Postman):
 *   POST https://softlaunchhq.com/api/admin/seed-roles
 *   Authorization: Bearer <ADMIN_SEED_SECRET>
 *   Content-Type: application/json
 *   Body: {} (uses ADMIN_EMAILS env var)
 *   OR
 *   Body: { "emails": ["choudhary31777@gmail.com", "alexvanpoole@gmail.com"] }
 *
 * After running: delete or disable this endpoint.
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

const mask = (email: string) =>
  email.replace(/^(.{3}).*(@.*)$/, "$1***$2")

export async function POST(req: NextRequest) {
  // ── 1. Verify secret token ────────────────────────────────────────
  const secret = process.env.ADMIN_SEED_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: "ADMIN_SEED_SECRET env var not configured" },
      { status: 503 }
    )
  }

  const authHeader = req.headers.get("authorization") || ""
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : ""

  if (!token || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ── 2. Determine target emails ────────────────────────────────────
  // Use request body if provided; fall back to ADMIN_EMAILS env var.
  let targetEmails: string[]
  try {
    const body = await req.json().catch(() => ({}))
    if (Array.isArray(body?.emails) && body.emails.length > 0) {
      targetEmails = body.emails.map((e: string) => e.trim().toLowerCase()).filter(Boolean)
    } else {
      targetEmails = (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    }
  } catch {
    targetEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  }

  if (targetEmails.length === 0) {
    return NextResponse.json(
      { error: "No target emails — set ADMIN_EMAILS or pass { emails: [...] } in body" },
      { status: 400 }
    )
  }

  // ── 3. Diagnostic: find users in DB ──────────────────────────────
  const results: Array<{
    emailMasked: string
    found: boolean
    previousRole?: string
    newRole?: string
    action: string
  }> = []

  for (const email of targetEmails) {
    let user
    try {
      user = await db.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true, email: true, role: true, clerkId: true },
      })
    } catch (err: any) {
      results.push({
        emailMasked: mask(email),
        found: false,
        action: `DB lookup failed: ${err?.message?.slice(0, 100)}`,
      })
      continue
    }

    if (!user) {
      results.push({
        emailMasked: mask(email),
        found: false,
        action: "NOT IN DB — user has never signed up or webhook never fired",
      })
      continue
    }

    if (user.role === "ADMIN" || user.role === "FOUNDER") {
      results.push({
        emailMasked: mask(email),
        found: true,
        previousRole: user.role,
        newRole: user.role,
        action: "already ADMIN/FOUNDER — skipped",
      })
      continue
    }

    // Promote to ADMIN
    try {
      await db.user.update({
        where: { id: user.id },
        data: { role: "ADMIN" },
      })
      results.push({
        emailMasked: mask(email),
        found: true,
        previousRole: user.role,
        newRole: "ADMIN",
        action: "PROMOTED to ADMIN",
      })
    } catch (err: any) {
      results.push({
        emailMasked: mask(email),
        found: true,
        previousRole: user.role,
        action: `update failed: ${err?.message?.slice(0, 100)}`,
      })
    }
  }

  const promoted = results.filter((r) => r.action.includes("PROMOTED")).length
  const notFound = results.filter((r) => !r.found).length
  const skipped = results.filter((r) => r.action.includes("already")).length

  console.log("[ADMIN SEED]", { promoted, notFound, skipped, total: targetEmails.length })

  return NextResponse.json({
    summary: { total: targetEmails.length, promoted, notFound, skipped },
    results,
    note: "Remove or disable this endpoint after use.",
  })
}

// Block all other methods
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}
