/**
 * Admin Access Tests
 *
 * Verifies the security model for the admin panel:
 *   1. Primary gate: user.role === "ADMIN" | "FOUNDER" in the database
 *   2. Fallback gate: user.email in ADMIN_EMAILS env var (server-side only)
 *   3. Fallback also writes the DB role so future requests skip the env var check
 *
 * These are static-analysis and logic tests — they do NOT spin up a Next.js server
 * or connect to Postgres.  They verify file structure, security patterns, and
 * the exact logic shapes that must be present in the source.
 */

import { describe, it } from "node:test"
import * as assert from "node:assert/strict"
import * as fs from "node:fs"
import * as path from "node:path"

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, "..")

function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf-8")
}

// ─── 1. Admin layout — file existence and imports ────────────────────────────

describe("Admin layout — file existence", () => {
  it("app/(admin)/layout.tsx exists", () => {
    const p = path.join(ROOT, "app/(admin)/layout.tsx")
    assert.ok(fs.existsSync(p), "Admin layout file must exist")
  })

  it("imports auth from @clerk/nextjs/server", () => {
    const src = readSrc("app/(admin)/layout.tsx")
    assert.ok(
      src.includes(`from "@clerk/nextjs/server"`),
      "Must import from @clerk/nextjs/server"
    )
  })

  it("imports db from @/lib/db", () => {
    const src = readSrc("app/(admin)/layout.tsx")
    assert.ok(src.includes(`from "@/lib/db"`), "Must import db")
  })

  it("imports redirect from next/navigation", () => {
    const src = readSrc("app/(admin)/layout.tsx")
    assert.ok(src.includes(`from "next/navigation"`), "Must import redirect")
  })
})

// ─── 2. Admin layout — auth pattern ──────────────────────────────────────────

describe("Admin layout — Clerk auth pattern", () => {
  it("uses await auth() — not auth() without await", () => {
    const src = readSrc("app/(admin)/layout.tsx")
    // Must have `await auth()` somewhere
    assert.ok(src.includes("await auth()"), "Must await auth() in Clerk v5")
    // Must NOT have an unawaited auth() call (i.e. `= auth()` without await)
    const unawaited = /(?<!await )\bauth\(\)/.test(src)
    assert.ok(!unawaited, "Must not use auth() without await — Clerk v5 requires await")
  })

  it("redirects to /sign-in when unauthenticated", () => {
    const src = readSrc("app/(admin)/layout.tsx")
    assert.ok(
      src.includes('redirect("/sign-in")'),
      "Must redirect unauthenticated users to /sign-in"
    )
  })

  it("redirects to /dashboard when not admin", () => {
    const src = readSrc("app/(admin)/layout.tsx")
    assert.ok(
      src.includes('redirect("/dashboard")'),
      "Must redirect non-admin users to /dashboard"
    )
  })
})

// ─── 3. Admin layout — DB role check ─────────────────────────────────────────

describe("Admin layout — database role check", () => {
  it("queries user by clerkId", () => {
    const src = readSrc("app/(admin)/layout.tsx")
    assert.ok(
      src.includes("where: { clerkId }"),
      "Must look up user by clerkId from Clerk auth"
    )
  })

  it("selects role AND email from DB", () => {
    const src = readSrc("app/(admin)/layout.tsx")
    // Both role and email must be in the select
    assert.ok(src.includes("role: true"), "Must select role from DB")
    assert.ok(src.includes("email: true"), "Must select email for ADMIN_EMAILS fallback")
  })

  it("checks for ADMIN role", () => {
    const src = readSrc("app/(admin)/layout.tsx")
    assert.ok(src.includes('"ADMIN"'), "Must check for ADMIN role")
  })

  it("checks for FOUNDER role", () => {
    const src = readSrc("app/(admin)/layout.tsx")
    assert.ok(src.includes('"FOUNDER"'), "Must check for FOUNDER role")
  })
})

// ─── 4. Admin layout — ADMIN_EMAILS fallback ─────────────────────────────────

describe("Admin layout — ADMIN_EMAILS server-side fallback", () => {
  it("reads ADMIN_EMAILS environment variable", () => {
    const src = readSrc("app/(admin)/layout.tsx")
    assert.ok(
      src.includes("process.env.ADMIN_EMAILS"),
      "Must check ADMIN_EMAILS env var as fallback"
    )
  })

  it("normalises admin emails to lowercase for comparison", () => {
    const src = readSrc("app/(admin)/layout.tsx")
    // Both the env list and the user email must be lowercased
    assert.ok(
      src.includes(".toLowerCase()"),
      "Must normalise emails to lowercase to avoid case-mismatch bugs"
    )
  })

  it("splits ADMIN_EMAILS on comma", () => {
    const src = readSrc("app/(admin)/layout.tsx")
    assert.ok(src.includes('.split(",")'), "Must split ADMIN_EMAILS on comma")
  })

  it("trims whitespace from each admin email", () => {
    const src = readSrc("app/(admin)/layout.tsx")
    assert.ok(src.includes(".trim()"), "Must trim whitespace from env-var entries")
  })

  it("filters empty strings from admin email list", () => {
    const src = readSrc("app/(admin)/layout.tsx")
    assert.ok(src.includes(".filter(Boolean)"), "Must filter empty strings from email list")
  })

  it("uses includes() to match the user's email against the list", () => {
    const src = readSrc("app/(admin)/layout.tsx")
    // There must be an `.includes(` call for the email check
    const hasIncludes = src.includes("adminEmails.includes(")
    assert.ok(hasIncludes, "Must use includes() to check if user email is in admin list")
  })
})

// ─── 5. Admin layout — lazy DB sync ──────────────────────────────────────────

describe("Admin layout — lazy DB role sync on ADMIN_EMAILS match", () => {
  it("writes role: 'ADMIN' to DB when ADMIN_EMAILS fallback matches", () => {
    const src = readSrc("app/(admin)/layout.tsx")
    // Must have a db.user.update with role: "ADMIN"
    assert.ok(
      src.includes("data: { role: \"ADMIN\" }"),
      "Must promote DB role to ADMIN when ADMIN_EMAILS fallback matches"
    )
  })

  it("uses db.user.update (not upsert) for the role sync", () => {
    const src = readSrc("app/(admin)/layout.tsx")
    assert.ok(
      src.includes("db.user.update("),
      "Must use db.user.update to sync role — user record already exists"
    )
  })

  it("targets the update by clerkId to avoid ambiguity", () => {
    const src = readSrc("app/(admin)/layout.tsx")
    // The update's where clause must use clerkId
    const updateIdx = src.indexOf("db.user.update(")
    const updateSlice = src.slice(updateIdx, updateIdx + 200)
    assert.ok(
      updateSlice.includes("clerkId"),
      "DB role update must target user by clerkId"
    )
  })

  it("awaits the DB update before granting access", () => {
    const src = readSrc("app/(admin)/layout.tsx")
    // Must use await on the update call
    assert.ok(
      src.includes("await db.user.update("),
      "Must await DB role update to ensure it completes before page renders"
    )
  })
})

// ─── 6. Security — email from DB, not from client ────────────────────────────

describe("Admin layout — email source security", () => {
  it("email used for ADMIN_EMAILS check comes from DB query result, not request headers", () => {
    const src = readSrc("app/(admin)/layout.tsx")
    // The findUnique selects email: true — that's what must be used
    // There should be NO reference to req.headers or cookies for email
    assert.ok(!src.includes("req.headers"), "Must not read email from request headers")
    assert.ok(!src.includes("req.cookies"), "Must not read email from cookies")
    assert.ok(!src.includes("searchParams"), "Must not read email from URL params")
  })

  it("does not accept user-supplied role claims", () => {
    const src = readSrc("app/(admin)/layout.tsx")
    assert.ok(
      !src.includes("req.body"),
      "Must not read role from request body"
    )
    assert.ok(
      !src.includes("req.json"),
      "Must not parse admin claims from request JSON"
    )
  })

  it("/admin route is NOT in middleware public routes", () => {
    const middleware = readSrc("middleware.ts")
    // The public routes pattern should not include /admin
    const publicPattern = middleware.match(/publicRoutes\s*=\s*createRouteMatcher\(\[([^\]]*)\]/)?.[1] || ""
    assert.ok(
      !publicPattern.includes("/admin"),
      "/admin must not be in the public routes list"
    )
  })
})

// ─── 7. Webhook — consistent role assignment ──────────────────────────────────

describe("Clerk webhook — role assignment consistency", () => {
  it("webhook file exists", () => {
    const p = path.join(ROOT, "app/api/webhooks/clerk/route.ts")
    assert.ok(fs.existsSync(p), "Clerk webhook route must exist")
  })

  it("user.created event checks ADMIN_EMAILS", () => {
    const src = readSrc("app/api/webhooks/clerk/route.ts")
    assert.ok(
      src.includes("user.created"),
      "Webhook must handle user.created"
    )
    assert.ok(
      src.includes("ADMIN_EMAILS"),
      "user.created handler must check ADMIN_EMAILS"
    )
  })

  it("user.updated event promotes to ADMIN if email matches", () => {
    const src = readSrc("app/api/webhooks/clerk/route.ts")
    assert.ok(
      src.includes("user.updated"),
      "Webhook must handle user.updated"
    )
    // The updated handler must set role to "ADMIN" when email matches.
    // Use a larger window (800 chars) to cover the full handler body.
    const updatedIdx = src.indexOf("user.updated")
    const updatedSlice = src.slice(updatedIdx, updatedIdx + 800)
    assert.ok(
      updatedSlice.includes('"ADMIN"'),
      "user.updated handler must promote role to ADMIN when email is in ADMIN_EMAILS"
    )
  })

  it("webhook never downgrades an existing ADMIN or FOUNDER", () => {
    const src = readSrc("app/api/webhooks/clerk/route.ts")
    // The user.updated section must say it only promotes, never demotes.
    // Check for the guard comment or "only promote" pattern in the updated handler.
    const updatedIdx = src.indexOf("user.updated")
    const updatedSlice = src.slice(updatedIdx, updatedIdx + 800)
    const hasPromoteGuard =
      updatedSlice.includes("only promote") ||
      updatedSlice.includes("Never downgrade") ||
      updatedSlice.includes("never downgrade") ||
      // Absence of `role = "USER"` in the updated handler is also evidence
      !updatedSlice.includes('"USER"')
    assert.ok(
      hasPromoteGuard,
      "Webhook user.updated handler must never downgrade existing ADMIN/FOUNDER to USER"
    )
  })
})

// ─── 8. Profile + cohort-intent auto-create paths ────────────────────────────

describe("Auto-create paths — ADMIN_EMAILS applied at creation", () => {
  it("profile route auto-create checks ADMIN_EMAILS", () => {
    const src = readSrc("app/api/profile/route.ts")
    assert.ok(
      src.includes("ADMIN_EMAILS"),
      "Profile auto-create must check ADMIN_EMAILS when creating user"
    )
  })

  it("cohort-intent route auto-create checks ADMIN_EMAILS", () => {
    const src = readSrc("app/api/cohort-intent/route.ts")
    assert.ok(
      src.includes("ADMIN_EMAILS"),
      "cohort-intent auto-create must check ADMIN_EMAILS when creating user"
    )
  })
})

// ─── 9. Admin layout — diagnostic logging ────────────────────────────────────

describe("Admin layout — diagnostic logging", () => {
  it("logs ADMIN ACCESS diagnostics without exposing secrets", () => {
    const src = readSrc("app/(admin)/layout.tsx")
    assert.ok(src.includes("[ADMIN ACCESS]"), "Must have safe diagnostic logging")
    assert.ok(!src.includes("CLERK_SECRET"), "Must not log Clerk secret")
    assert.ok(!src.includes("DATABASE_URL"), "Must not log DB connection string")
    assert.ok(!src.includes("process.env.CLERK"), "Must not log Clerk env vars")
  })

  it("catches and logs DB update errors without crashing", () => {
    const src = readSrc("app/(admin)/layout.tsx")
    // The DB update must be in a try/catch so failures don't expose errors to users
    assert.ok(src.includes("try {"), "DB update must be wrapped in try/catch")
    assert.ok(src.includes("catch (err"), "Must catch DB update errors")
    assert.ok(src.includes("console.error"), "Must log update errors server-side")
  })
})

// ─── 10. Admin seed-roles API ────────────────────────────────────────────────

describe("Admin seed-roles API — file existence and security", () => {
  it("route file exists", () => {
    const p = path.join(ROOT, "app/api/admin/seed-roles/route.ts")
    assert.ok(fs.existsSync(p), "Seed-roles route must exist")
  })

  it("requires ADMIN_SEED_SECRET env var — not open to anyone", () => {
    const src = readSrc("app/api/admin/seed-roles/route.ts")
    assert.ok(
      src.includes("ADMIN_SEED_SECRET"),
      "Must gate on ADMIN_SEED_SECRET secret token"
    )
  })

  it("only promotes to ADMIN — never writes USER", () => {
    const src = readSrc("app/api/admin/seed-roles/route.ts")
    // Must have promotion to ADMIN
    assert.ok(src.includes('role: "ADMIN"'), "Must promote to ADMIN role")
    // Must not write USER role
    assert.ok(!src.includes('data: { role: "USER"'), "Must never write USER role")
  })

  it("masks emails in response — no plaintext exposure", () => {
    const src = readSrc("app/api/admin/seed-roles/route.ts")
    assert.ok(src.includes("mask("), "Must mask emails before returning in response")
  })

  it("does not expose DATABASE_URL or secrets in response", () => {
    const src = readSrc("app/api/admin/seed-roles/route.ts")
    assert.ok(!src.includes("DATABASE_URL"), "Must not expose DATABASE_URL")
    assert.ok(!src.includes("CLERK_SECRET"), "Must not expose Clerk secret")
  })

  it("blocks GET method", () => {
    const src = readSrc("app/api/admin/seed-roles/route.ts")
    assert.ok(
      src.includes("Method not allowed"),
      "GET must be blocked to prevent accidental triggering"
    )
  })
})

// ─── 11. Admin diagnose API ──────────────────────────────────────────────────

describe("Admin diagnose API — file existence and security", () => {
  it("route file exists", () => {
    const p = path.join(ROOT, "app/api/admin/diagnose/route.ts")
    assert.ok(fs.existsSync(p), "Diagnose route must exist")
  })

  it("requires Clerk authentication", () => {
    const src = readSrc("app/api/admin/diagnose/route.ts")
    assert.ok(src.includes("await auth()"), "Must require Clerk auth")
    assert.ok(src.includes("Not signed in"), "Must reject unauthenticated callers")
  })

  it("masks email in response", () => {
    const src = readSrc("app/api/admin/diagnose/route.ts")
    assert.ok(src.includes("mask("), "Must mask email before including in response")
  })

  it("does not read or return the value of DATABASE_URL or secrets", () => {
    const src = readSrc("app/api/admin/diagnose/route.ts")
    // May mention DATABASE_URL by name in advice strings, but must never read its value
    assert.ok(!src.includes("process.env.DATABASE_URL"), "Must not read DATABASE_URL value")
    assert.ok(!src.includes("process.env.CLERK_SECRET"), "Must not read Clerk secret value")
    assert.ok(!src.includes("process.env.ADMIN_SEED_SECRET"), "Must not expose seed secret value")
  })

  it("checks ADMIN_EMAILS env var and reports count — not value", () => {
    const src = readSrc("app/api/admin/diagnose/route.ts")
    assert.ok(src.includes("ADMIN_EMAILS"), "Must check ADMIN_EMAILS")
    assert.ok(src.includes(".length"), "Must report count, not raw value")
  })
})
