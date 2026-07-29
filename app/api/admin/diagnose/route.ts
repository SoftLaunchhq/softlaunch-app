/**
 * GET /api/admin/diagnose
 *
 * TEMPORARY DIAGNOSTIC ENDPOINT — remove after debugging is complete.
 *
 * Returns the exact admin authorization state for the currently signed-in user.
 * Requires Clerk authentication (any signed-in user can call this).
 *
 * Exposes NO secrets, NO tokens, NO passwords.
 * Email is masked in the response.
 *
 * Usage:
 *   While signed in as Malika or Alex, fetch:
 *   GET https://softlaunchhq.com/api/admin/diagnose
 *
 * Use the response to identify exactly which step in the admin auth chain fails.
 */

import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"

const mask = (email: string) =>
  email.replace(/^(.{3}).*(@.*)$/, "$1***$2")

export async function GET() {
  // ── 1. Clerk authentication ───────────────────────────────────────
  const { userId: clerkId } = await auth()

  if (!clerkId) {
    return NextResponse.json({
      step: "clerk_auth",
      result: "FAIL",
      reason: "Not signed in — no Clerk user ID in session",
    })
  }

  // ── 2. DB user lookup ─────────────────────────────────────────────
  let user: { email: string; role: string } | null = null
  let dbError: string | null = null

  try {
    user = await db.user.findUnique({
      where: { clerkId },
      select: { email: true, role: true },
    })
  } catch (err: any) {
    dbError = err?.message?.slice(0, 200)
  }

  if (dbError) {
    return NextResponse.json({
      step: "db_lookup",
      result: "FAIL",
      reason: "DB error — check DATABASE_URL in Vercel env",
      error: dbError,
    })
  }

  if (!user) {
    return NextResponse.json({
      step: "db_lookup",
      result: "FAIL",
      reason: "No DB record found for this Clerk ID. The Clerk webhook may never have fired, or fired before DATABASE_URL was configured.",
      clerkIdPresent: true,
      dbUserFound: false,
      fix: "Call POST /api/admin/seed-roles with Authorization header, or insert the user via Supabase SQL editor.",
    })
  }

  // ── 3. Role check ─────────────────────────────────────────────────
  const roleOk = user.role === "ADMIN" || user.role === "FOUNDER"

  // ── 4. ADMIN_EMAILS check ─────────────────────────────────────────
  const adminEmailsRaw = process.env.ADMIN_EMAILS || ""
  const adminEmails = adminEmailsRaw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  const emailMatchesAdminList = adminEmails.includes(user.email.toLowerCase())

  const wouldBeGranted = roleOk || emailMatchesAdminList

  return NextResponse.json({
    step: "complete",
    result: wouldBeGranted ? "PASS — admin access would be granted" : "FAIL — access would be denied",

    checks: {
      "1_clerk_auth": { pass: true, detail: "Clerk user ID present in session" },
      "2_db_user_found": { pass: true, detail: "DB record found" },
      "3_db_email_masked": mask(user.email),
      "4_db_role": user.role,
      "5_role_is_admin_or_founder": { pass: roleOk, detail: roleOk ? `role=${user.role}` : `role=${user.role} — not ADMIN or FOUNDER` },
      "6_admin_emails_configured": { pass: adminEmails.length > 0, detail: `${adminEmails.length} entries in ADMIN_EMAILS env var` },
      "7_email_in_admin_list": { pass: emailMatchesAdminList, detail: emailMatchesAdminList ? "match found" : "no match — check for typos or whitespace in ADMIN_EMAILS" },
      "8_would_be_granted": wouldBeGranted,
    },

    action_needed: !wouldBeGranted
      ? roleOk
        ? null
        : emailMatchesAdminList
        ? "email matches ADMIN_EMAILS but something prevented promotion — check Vercel logs"
        : adminEmails.length === 0
        ? "ADMIN_EMAILS env var is empty or not set in Vercel — set it in Vercel Dashboard > Settings > Environment Variables"
        : "email not in ADMIN_EMAILS — add it, or call POST /api/admin/seed-roles"
      : null,
  })
}
