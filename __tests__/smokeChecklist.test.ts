/**
 * __tests__/smokeChecklist.test.ts
 *
 * Structural smoke tests — verify that all critical route files exist
 * and have the minimum required structural markers (auth guards, exports, etc.)
 *
 * These tests do NOT start a server or make HTTP requests.
 * They validate that the code that WOULD handle each route is present and correct.
 *
 * For a running-server smoke test, use: npm run test:smoke:live
 * (requires `npm run dev` to be running on port 3000)
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import * as fs from "node:fs"
import * as path from "node:path"

const ROOT = path.resolve(__dirname, "..")

function exists(relPath: string): boolean {
  return fs.existsSync(path.join(ROOT, relPath))
}

function readFile(relPath: string): string {
  try {
    return fs.readFileSync(path.join(ROOT, relPath), "utf-8")
  } catch {
    return ""
  }
}

// ─────────────────────────────────────────────────────────────
// ROUTE EXISTENCE CHECKS
// ─────────────────────────────────────────────────────────────

describe("Critical routes — file existence", () => {
  const routes = [
    // Marketing / public
    ["/ (home)", "app/page.tsx"],
    ["/cypg", "app/cypg/page.tsx"],
    // sign-in/up live in the (auth) route group
    ["/sign-in", "app/(auth)/sign-in/[[...sign-in]]/page.tsx"],
    ["/sign-up", "app/(auth)/sign-up/[[...sign-up]]/page.tsx"],
    ["/how-it-works", "app/how-it-works/page.tsx"],
    ["/pricing", "app/pricing/page.tsx"],
    ["/faq", "app/faq/page.tsx"],

    // Onboarding
    ["/onboarding/welcome", "app/onboarding/welcome/page.tsx"],
    ["/onboarding/cohort-type", "app/onboarding/cohort-type/page.tsx"],
    ["/onboarding/assessment", "app/onboarding/assessment/page.tsx"],
    ["/onboarding/reveal", "app/onboarding/reveal/page.tsx"],
    ["/onboarding/profile", "app/onboarding/profile/page.tsx"],

    // Dashboard
    ["/dashboard", "app/(dashboard)/dashboard/page.tsx"],

    // Admin
    ["/admin", "app/(admin)/admin/page.tsx"],
    ["/admin/users", "app/(admin)/admin/users/page.tsx"],
    ["/admin/matching", "app/(admin)/admin/matching/page.tsx"],
    ["/admin/cohorts", "app/(admin)/admin/cohorts/page.tsx"],

    // API
    ["/api/profile", "app/api/profile/route.ts"],
    ["/api/cohort-intent", "app/api/cohort-intent/route.ts"],
    ["/api/matching/suggest", "app/api/matching/suggest/route.ts"],
    ["/api/waitlist", "app/api/waitlist/route.ts"],
  ]

  for (const [routeName, relPath] of routes) {
    it(`${routeName} has a handler file`, () => {
      assert.ok(exists(relPath), `Missing route file for ${routeName}: ${relPath}`)
    })
  }
})

// ─────────────────────────────────────────────────────────────
// API ROUTE EXPORT CHECKS
// ─────────────────────────────────────────────────────────────

describe("API routes — correct HTTP method exports", () => {
  const routes: Array<[string, string, string[]]> = [
    ["profile", "app/api/profile/route.ts", ["POST", "GET"]],
    ["cohort-intent", "app/api/cohort-intent/route.ts", ["POST"]],
    ["matching/suggest", "app/api/matching/suggest/route.ts", ["POST"]],
    ["waitlist", "app/api/waitlist/route.ts", ["POST"]],
    ["billing/checkout", "app/api/billing/checkout/route.ts", ["POST"]],
  ]

  for (const [name, relPath, methods] of routes) {
    const src = readFile(relPath)
    for (const method of methods) {
      it(`/api/${name} exports ${method} handler`, () => {
        assert.ok(
          src.includes(`export async function ${method}`) ||
            src.includes(`export function ${method}`),
          `/api/${name} must export a ${method} handler`
        )
      })
    }
  }
})

// ─────────────────────────────────────────────────────────────
// AUTH PROTECTION CHECKS
// ─────────────────────────────────────────────────────────────

describe("Route auth protection patterns", () => {
  it("/dashboard redirects unauthenticated users (has auth() check)", () => {
    const src = readFile("app/(dashboard)/dashboard/page.tsx")
    assert.ok(
      src.includes("auth()") || src.includes("redirect"),
      "Dashboard must check auth and redirect unauthenticated users"
    )
  })

  it("/admin area checks ADMIN role", () => {
    // The role check is in the (admin) route-group layout, one level above /admin pages
    const groupLayoutSrc = readFile("app/(admin)/layout.tsx")
    assert.ok(
      groupLayoutSrc.includes("ADMIN") || groupLayoutSrc.includes("role"),
      "Admin area must gate on ADMIN role (check app/(admin)/layout.tsx)"
    )
  })

  it("all protected API routes call auth() from Clerk", () => {
    const protectedRoutes = [
      "app/api/profile/route.ts",
      "app/api/cohort-intent/route.ts",
      "app/api/billing/checkout/route.ts",
    ]
    for (const routePath of protectedRoutes) {
      const src = readFile(routePath)
      assert.ok(
        src.includes("auth()"),
        `${routePath} must call auth() from Clerk`
      )
    }
  })

  it("public routes (home, cypg, sign-in) do not call auth() unnecessarily", () => {
    const publicRoutes = [
      "app/cypg/page.tsx",
      "app/page.tsx",
    ]
    for (const routePath of publicRoutes) {
      const src = readFile(routePath)
      assert.ok(
        !src.includes('from "@clerk/nextjs/server"'),
        `${routePath} should not import server-side Clerk auth`
      )
    }
  })
})

// ─────────────────────────────────────────────────────────────
// COMPONENT SAFETY CHECKS
// ─────────────────────────────────────────────────────────────

describe("Component safety patterns", () => {
  it("Dashboard components directory exists", () => {
    assert.ok(
      exists("components/dashboard"),
      "components/dashboard directory must exist"
    )
  })

  it("PendingCohortState component exists", () => {
    assert.ok(
      exists("components/dashboard/PendingCohortState.tsx"),
      "PendingCohortState component must exist"
    )
  })

  it("CohortView component exists", () => {
    assert.ok(
      exists("components/dashboard/CohortView.tsx"),
      "CohortView component must exist"
    )
  })

  it("UpgradePrompt component exists", () => {
    assert.ok(
      exists("components/dashboard/UpgradePrompt.tsx"),
      "UpgradePrompt component must exist"
    )
  })

  it("DbErrorPrompt component exists", () => {
    assert.ok(
      exists("components/dashboard/DbErrorPrompt.tsx"),
      "DbErrorPrompt component must exist"
    )
  })
})

// ─────────────────────────────────────────────────────────────
// ENVIRONMENT VARIABLE DOCUMENTATION
// ─────────────────────────────────────────────────────────────

describe("Environment configuration", () => {
  it(".env.local exists (required for local dev)", () => {
    assert.ok(
      exists(".env.local"),
      ".env.local must exist for local development"
    )
  })

  it(".env.local has required Clerk variables", () => {
    const src = readFile(".env.local")
    assert.ok(
      src.includes("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
      ".env.local must have NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
    )
    assert.ok(
      src.includes("CLERK_SECRET_KEY"),
      ".env.local must have CLERK_SECRET_KEY"
    )
  })

  it(".env.local has DATABASE_URL with pgBouncer port (6543)", () => {
    const src = readFile(".env.local")
    assert.ok(
      src.includes("DATABASE_URL"),
      ".env.local must have DATABASE_URL"
    )
    assert.ok(
      src.includes(":6543") || src.includes("pgbouncer=true"),
      "DATABASE_URL should use pgBouncer port 6543 or have pgbouncer=true flag"
    )
  })

  it(".env.local has OPENAI_API_KEY", () => {
    const src = readFile(".env.local")
    assert.ok(src.includes("OPENAI_API_KEY"), ".env.local must have OPENAI_API_KEY")
  })

  it(".env.local has Stripe keys", () => {
    const src = readFile(".env.local")
    assert.ok(src.includes("STRIPE_SECRET_KEY"), ".env.local must have STRIPE_SECRET_KEY")
    assert.ok(src.includes("STRIPE_PRICE_ID"), ".env.local must have STRIPE_PRICE_ID")
  })

  it(".env.local has ADMIN_EMAILS including the two new admins", () => {
    const src = readFile(".env.local")
    assert.ok(
      src.toLowerCase().includes("choudhary31777@gmail.com"),
      "ADMIN_EMAILS must include choudhary31777@gmail.com"
    )
    assert.ok(
      src.toLowerCase().includes("alexvanpoole@gmail.com"),
      "ADMIN_EMAILS must include alexvanpoole@gmail.com"
    )
  })

  it(".env.local does NOT have placeholder DATABASE_URL", () => {
    const src = readFile(".env.local")
    const dbLine = src.split("\n").find((l) => l.startsWith("DATABASE_URL="))
    assert.ok(
      dbLine && !dbLine.includes("user:password") && !dbLine.includes("YOUR_PASSWORD"),
      "DATABASE_URL must not be a placeholder"
    )
  })
})

// ─────────────────────────────────────────────────────────────
// PRISMA SCHEMA CHECKS
// ─────────────────────────────────────────────────────────────

describe("Prisma schema", () => {
  const schemaSrc = readFile("prisma/schema.prisma")

  it("schema.prisma exists", () => {
    assert.ok(exists("prisma/schema.prisma"), "prisma/schema.prisma must exist")
  })

  it("binaryTargets includes rhel-openssl-1.0.x (for Vercel/AWS)", () => {
    assert.ok(
      schemaSrc.includes("rhel-openssl-1.0.x"),
      "schema.prisma must include rhel-openssl-1.0.x binary target for Vercel deployment"
    )
  })

  it("binaryTargets includes debian-openssl-3.0.x (for Ubuntu sandbox)", () => {
    assert.ok(
      schemaSrc.includes("debian-openssl-3.0.x"),
      "schema.prisma must include debian-openssl-3.0.x binary target"
    )
  })

  it("User model exists", () => {
    assert.ok(schemaSrc.includes("model User {"), "Prisma schema must have User model")
  })

  it("Cohort model exists", () => {
    assert.ok(schemaSrc.includes("model Cohort {"), "Prisma schema must have Cohort model")
  })

  it("DriveProfile model exists", () => {
    assert.ok(schemaSrc.includes("model DriveProfile {"), "Prisma schema must have DriveProfile model")
  })

  it("Subscription model exists", () => {
    assert.ok(schemaSrc.includes("model Subscription {"), "Prisma schema must have Subscription model")
  })
})

// ─────────────────────────────────────────────────────────────
// MANUAL SMOKE TEST CHECKLIST (output only, not auto-run)
// ─────────────────────────────────────────────────────────────

describe("Manual smoke test checklist (verify after npm run dev)", () => {
  const CHECKLIST = [
    "[ ] GET / → 200, home page loads",
    "[ ] GET /cypg → 200, CYPG landing page loads, '4 weeks free' visible",
    "[ ] GET /sign-in → 200, Clerk sign-in widget loads",
    "[ ] GET /sign-up → 200, Clerk sign-up widget loads",
    "[ ] GET /onboarding/welcome → 200 (auth redirects to sign-in if logged out)",
    "[ ] GET /onboarding/cohort-type → only shows Social + Professional options",
    "[ ] GET /dashboard → redirects to /sign-in if not authenticated",
    "[ ] GET /admin → redirects or returns 403 for non-admin users",
    "[ ] POST /api/cohort-intent with { intent: 'social' } → 200 + sets sl_cohort_intent cookie",
    "[ ] POST /api/profile with valid data → 200 (no 'Internal server error')",
    "[ ] POST /api/profile with no LinkedIn → 200 (linkedinUrl is optional)",
    "[ ] POST /api/buzz/chat → streams response or local fallback if OpenAI is down",
    "[ ] CYPG user: after sign-up, partner cookie is readable, benefit is active",
    "[ ] CYPG user: does not hit payment gate during 4-week benefit window",
    "[ ] Admin user: can access /admin/matching and see cohortIntent badges",
    "[ ] Admin user: can add/remove users from draft without deleting DB records",
  ]

  it("manual checklist is documented (see console output)", () => {
    // This test always passes — it just documents the manual steps
    console.log("\n\n╔══════════════════════════════════════════════════════════════╗")
    console.log("║          MANUAL SMOKE TEST CHECKLIST — Run with dev server    ║")
    console.log("╠══════════════════════════════════════════════════════════════╣")
    for (const item of CHECKLIST) {
      console.log(`║  ${item.padEnd(62)} ║`)
    }
    console.log("╚══════════════════════════════════════════════════════════════╝\n")
    assert.ok(CHECKLIST.length > 0, "Checklist should not be empty")
  })
})
