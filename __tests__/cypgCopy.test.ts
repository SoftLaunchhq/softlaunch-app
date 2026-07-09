/**
 * __tests__/cypgCopy.test.ts
 *
 * Static analysis of the CYPG landing page source code.
 * Verifies that copy is correct (4 weeks free, no "first week free" messaging).
 * Reads the actual source file — no runtime rendering needed.
 *
 * LAUNCH CRITICAL: CYPG traffic arrives today. These strings must be correct.
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import * as fs from "node:fs"
import * as path from "node:path"

const ROOT = path.resolve(__dirname, "..")
const CYPG_PAGE = path.join(ROOT, "app", "cypg", "page.tsx")
const PRICING_PAGE = path.join(ROOT, "app", "pricing", "page.tsx")
const PARTNERS_LIB = path.join(ROOT, "lib", "partners.ts")

function readFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8")
  } catch {
    return ""
  }
}

// ─────────────────────────────────────────────────────────────
// TESTS: CYPG page source copy
// ─────────────────────────────────────────────────────────────

describe("CYPG landing page copy", () => {
  const src = readFile(CYPG_PAGE)

  it("CYPG page file exists", () => {
    assert.ok(fs.existsSync(CYPG_PAGE), `CYPG page not found at ${CYPG_PAGE}`)
  })

  it("does NOT contain 'first week free' messaging", () => {
    const lower = src.toLowerCase()
    assert.ok(
      !lower.includes("first week free"),
      "CYPG page must not say 'first week free' — should say full 4 weeks free"
    )
  })

  it("does NOT contain 'week 1 free'", () => {
    const lower = src.toLowerCase()
    assert.ok(
      !lower.includes("week 1 free"),
      "CYPG page must not say 'week 1 free'"
    )
  })

  it("contains '4 weeks free' or '4-week experience' messaging", () => {
    const lower = src.toLowerCase()
    const hasFourWeeks =
      lower.includes("4 weeks free") ||
      lower.includes("4-week") ||
      lower.includes("four weeks")
    assert.ok(hasFourWeeks, "CYPG page must mention 4 weeks free benefit")
  })

  it("mentions 'no payment required' or equivalent", () => {
    const lower = src.toLowerCase()
    const hasNoPayment =
      lower.includes("no payment") ||
      lower.includes("no card") ||
      lower.includes("completely free") ||
      lower.includes("at no cost")
    assert.ok(hasNoPayment, "CYPG page must mention no payment required")
  })

  it("uses recordPartnerArrival on mount", () => {
    assert.ok(
      src.includes("recordPartnerArrival"),
      "CYPG page must call recordPartnerArrival to set partner cookie"
    )
  })

  it("calls recordPartnerArrival with 'cypg' slug", () => {
    assert.ok(
      src.includes('"cypg"') || src.includes("'cypg'"),
      "recordPartnerArrival must be called with 'cypg' slug"
    )
  })

  it("has a sign-up call-to-action link", () => {
    assert.ok(
      src.includes("/sign-up"),
      "CYPG page must link to /sign-up"
    )
  })

  it("'use client' directive is present (required for useEffect)", () => {
    assert.ok(
      src.includes('"use client"') || src.includes("'use client'"),
      "CYPG page must have 'use client' directive"
    )
  })

  it("does not import server-only modules", () => {
    assert.ok(
      !src.includes('from "@clerk/nextjs/server"'),
      "CYPG landing page should not import server-only Clerk modules"
    )
    assert.ok(
      !src.includes('from "@/lib/db"'),
      "CYPG landing page should not import the DB client"
    )
  })
})

// ─────────────────────────────────────────────────────────────
// TESTS: partners.ts copy fields
// ─────────────────────────────────────────────────────────────

describe("lib/partners.ts CYPG copy fields", () => {
  const src = readFile(PARTNERS_LIB)

  it("CYPG benefitLabel mentions '4-week cohort' (not 'first week')", () => {
    // Find the actual benefitLabel value line inside the PARTNERS object,
    // not the TypeScript interface type definition line.
    // The value line looks like: benefitLabel: "...",
    const lines = src.split("\n")
    const benefitValueLine = lines.find(
      (l) => l.includes("benefitLabel:") && l.includes('"')
    )
    assert.ok(benefitValueLine, "benefitLabel value should exist in PARTNERS object")

    const lower = (benefitValueLine ?? "").toLowerCase()
    assert.ok(
      !lower.includes("first week"),
      `CYPG benefitLabel must not mention 'first week'. Found: ${benefitValueLine?.trim()}`
    )
    assert.ok(
      lower.includes("4-week") || lower.includes("4 week"),
      `CYPG benefitLabel should mention 4-week. Found: ${benefitValueLine?.trim()}`
    )
  })

  it("CYPG benefitDurationDays is 30", () => {
    assert.ok(
      src.includes("benefitDurationDays: 30"),
      "CYPG benefit should be 30 days"
    )
  })
})

// ─────────────────────────────────────────────────────────────
// TESTS: Onboarding flow files exist
// ─────────────────────────────────────────────────────────────

describe("Onboarding pages exist", () => {
  const onboardingPages = [
    ["welcome", "app/onboarding/welcome/page.tsx"],
    ["cohort-type", "app/onboarding/cohort-type/page.tsx"],
    ["assessment", "app/onboarding/assessment/page.tsx"],
    ["reveal", "app/onboarding/reveal/page.tsx"],
    ["profile", "app/onboarding/profile/page.tsx"],
  ]

  for (const [name, relPath] of onboardingPages) {
    it(`${name} page exists`, () => {
      const fullPath = path.join(ROOT, relPath)
      assert.ok(
        fs.existsSync(fullPath),
        `Onboarding ${name} page not found at ${relPath}`
      )
    })
  }
})

describe("Cohort type page", () => {
  const src = readFile(path.join(ROOT, "app/onboarding/cohort-type/page.tsx"))

  it("only has 'social' and 'professional' as valid intent values", () => {
    // Check the Intent type or enum — should be "social" | "professional"
    const hasSocial = src.includes('"social"') || src.includes("'social'")
    const hasProfessional = src.includes('"professional"') || src.includes("'professional'")
    assert.ok(hasSocial, "Should have 'social' option")
    assert.ok(hasProfessional, "Should have 'professional' option")
  })

  it("does NOT have a third cohort type option", () => {
    // Common third types that should not exist
    const forbidden = ['"networking"', '"dating"', '"romantic"', '"creative"', '"health"']
    for (const type of forbidden) {
      assert.ok(
        !src.includes(type),
        `Cohort type page must not have "${type}" as an option`
      )
    }
  })

  it("has returnTo URL validation (safeReturnTo function)", () => {
    assert.ok(
      src.includes("safeReturnTo"),
      "Cohort type page must validate returnTo URL to prevent open redirect"
    )
  })

  it("has Suspense wrapper for useSearchParams", () => {
    assert.ok(
      src.includes("Suspense"),
      "Cohort type page must wrap useSearchParams in Suspense (Next.js requirement)"
    )
  })

  it("submits to /api/cohort-intent", () => {
    assert.ok(
      src.includes("/api/cohort-intent"),
      "Cohort type page must submit to /api/cohort-intent"
    )
  })
})

// ─────────────────────────────────────────────────────────────
// TESTS: Dashboard page critical features
// ─────────────────────────────────────────────────────────────

describe("Dashboard page", () => {
  const src = readFile(path.join(ROOT, "app/(dashboard)/dashboard/page.tsx"))

  it("dashboard page file exists", () => {
    assert.ok(
      fs.existsSync(path.join(ROOT, "app/(dashboard)/dashboard/page.tsx")),
      "Dashboard page must exist"
    )
  })

  it("cohort intent gate redirects to cohort-type page when intent is missing", () => {
    assert.ok(
      src.includes("/onboarding/cohort-type?returnTo=/dashboard"),
      "Dashboard must redirect users without cohortIntent to cohort-type selection"
    )
  })

  it("admin users bypass cohort intent gate", () => {
    assert.ok(
      src.includes("isAdminUser") || src.includes("ADMIN"),
      "Admin users must bypass the cohort intent gate"
    )
  })

  it("cohort type stat card has clickable href", () => {
    assert.ok(
      src.includes("/onboarding/cohort-type?returnTo=/dashboard"),
      "Cohort type stat card must be a clickable link back to cohort-type page"
    )
  })

  it("StatCard supports optional href prop", () => {
    assert.ok(
      src.includes("href?:") || src.includes("href?: string"),
      "StatCard component should have optional href prop"
    )
  })
})

// ─────────────────────────────────────────────────────────────
// TESTS: Admin pages exist and have protection
// ─────────────────────────────────────────────────────────────

describe("Admin pages", () => {
  const adminPages = [
    ["users", "app/(admin)/admin/users/page.tsx"],
    ["matching", "app/(admin)/admin/matching/page.tsx"],
    ["cohorts", "app/(admin)/admin/cohorts/page.tsx"],
  ]

  for (const [name, relPath] of adminPages) {
    it(`admin/${name} page file exists`, () => {
      const fullPath = path.join(ROOT, relPath)
      assert.ok(fs.existsSync(fullPath), `Admin ${name} page not found at ${relPath}`)
    })
  }

  it("admin layout or middleware checks ADMIN role", () => {
    // Check admin layout or individual pages for role check
    const layoutPath = path.join(ROOT, "app/(admin)/admin/layout.tsx")
    const usersPath = path.join(ROOT, "app/(admin)/admin/users/page.tsx")
    const layoutSrc = readFile(layoutPath)
    const usersSrc = readFile(usersPath)

    const hasRoleCheck =
      layoutSrc.includes("ADMIN") ||
      layoutSrc.includes("role") ||
      usersSrc.includes("ADMIN") ||
      usersSrc.includes("role")

    assert.ok(hasRoleCheck, "Admin pages must check for ADMIN role")
  })
})
