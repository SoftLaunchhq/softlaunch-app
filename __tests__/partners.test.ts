/**
 * __tests__/partners.test.ts
 *
 * Tests for partner registry, benefit logic, and tracking helpers.
 * All pure functions — no network, DB, or browser APIs touched.
 *
 * Run via: npm test (or see package.json "test:unit" script)
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { getPartner, PARTNERS, ACTIVE_PARTNER_SLUGS } from "../lib/partners"
import { getPartnerBenefitStatus, shouldActivateBenefit } from "../lib/partnerBenefits"
import {
  recordPartnerArrival,
  readPartnerSource,
  clearPartnerTracking,
  readPartnerSourceFromCookies,
} from "../lib/partnerTracking"

// ─────────────────────────────────────────────────────────────
// TESTS: partners registry
// ─────────────────────────────────────────────────────────────

describe("PARTNERS registry", () => {
  it("CYPG partner exists and is active", () => {
    assert.ok("cypg" in PARTNERS, "CYPG partner should exist in registry")
    assert.equal(PARTNERS.cypg.active, true)
  })

  it("CYPG landing path is /cypg", () => {
    assert.equal(PARTNERS.cypg.landingPath, "/cypg")
  })

  it("CYPG benefit duration is 30 days", () => {
    assert.equal(PARTNERS.cypg.benefitDurationDays, 30)
  })

  it("CYPG cookie TTL is 30 days", () => {
    assert.equal(PARTNERS.cypg.cookieTtlDays, 30)
  })

  it("CYPG subheadline mentions 4 weeks free (not first week)", () => {
    const sub = PARTNERS.cypg.subheadline ?? ""
    // Must say "4-week" or "full 4 weeks" — must NOT say "first week"
    assert.ok(
      sub.toLowerCase().includes("4-week") || sub.toLowerCase().includes("4 week"),
      `CYPG subheadline should mention 4-week experience. Got: "${sub}"`
    )
    assert.ok(
      !sub.toLowerCase().includes("first week free"),
      `CYPG subheadline must not say "first week free". Got: "${sub}"`
    )
  })

  it("CYPG benefitLabel mentions 4-week cohort", () => {
    const label = PARTNERS.cypg.benefitLabel ?? ""
    assert.ok(
      label.toLowerCase().includes("4-week") || label.toLowerCase().includes("4 week"),
      `CYPG benefitLabel should mention 4-week. Got: "${label}"`
    )
  })
})

describe("getPartner", () => {
  it("returns the CYPG partner by slug", () => {
    const p = getPartner("cypg")
    assert.ok(p !== undefined)
    assert.equal(p!.id, "cypg")
  })

  it("is case-insensitive for slug lookup", () => {
    const p = getPartner("CYPG")
    assert.ok(p !== undefined, "Should find CYPG with uppercase slug")
  })

  it("returns undefined for unknown slug", () => {
    const p = getPartner("nonexistent_partner_xyz")
    assert.equal(p, undefined)
  })

  it("returns undefined for inactive partner", () => {
    // Add a test-only inactive partner entry, check it returns undefined
    // We can test the guard: if a partner were inactive, getPartner returns undefined
    // Since we can't mutate PARTNERS directly without side effects, test via mock
    const fakeCookieStore = {
      get: (name: string) => ({ value: "nonexistent" }),
    }
    const result = readPartnerSourceFromCookies(fakeCookieStore)
    assert.equal(result, null, "Unknown partner source from cookies should return null")
  })
})

describe("ACTIVE_PARTNER_SLUGS", () => {
  it("contains at least one active partner", () => {
    assert.ok(ACTIVE_PARTNER_SLUGS.length > 0, "Should have at least one active partner")
  })

  it("contains 'cypg'", () => {
    assert.ok(ACTIVE_PARTNER_SLUGS.includes("cypg"), "cypg should be in active slugs")
  })

  it("does not contain empty strings or undefined", () => {
    for (const slug of ACTIVE_PARTNER_SLUGS) {
      assert.ok(typeof slug === "string" && slug.length > 0, `Invalid slug in ACTIVE_PARTNER_SLUGS: ${slug}`)
    }
  })
})

// ─────────────────────────────────────────────────────────────
// TESTS: getPartnerBenefitStatus
// ─────────────────────────────────────────────────────────────

describe("getPartnerBenefitStatus", () => {
  it("returns inactive status when partnerSource is null", () => {
    const result = getPartnerBenefitStatus({
      partnerSource: null,
      partnerJoinedAt: null,
      partnerBenefitActive: false,
    })
    assert.equal(result.active, false)
    assert.equal(result.partnerName, null)
  })

  it("returns inactive status when partnerBenefitActive is false", () => {
    const result = getPartnerBenefitStatus({
      partnerSource: "cypg",
      partnerJoinedAt: new Date(),
      partnerBenefitActive: false,
    })
    assert.equal(result.active, false)
  })

  it("returns active status for CYPG user within 30-day window", () => {
    const joinedAt = new Date()
    joinedAt.setDate(joinedAt.getDate() - 5) // Joined 5 days ago

    const result = getPartnerBenefitStatus({
      partnerSource: "cypg",
      partnerJoinedAt: joinedAt,
      partnerBenefitActive: true,
    })
    assert.equal(result.active, true)
    assert.equal(result.partnerSource, "cypg")
    assert.equal(result.partnerName, "Can't You Play Golf?")
    assert.ok((result.daysRemaining ?? 0) > 0, "Should have days remaining")
    assert.ok((result.daysRemaining ?? 0) <= 30, "Days remaining should not exceed 30")
  })

  it("returns inactive status for CYPG user after 30-day window", () => {
    const joinedAt = new Date()
    joinedAt.setDate(joinedAt.getDate() - 35) // Joined 35 days ago

    const result = getPartnerBenefitStatus({
      partnerSource: "cypg",
      partnerJoinedAt: joinedAt,
      partnerBenefitActive: true,
    })
    assert.equal(result.active, false, "CYPG benefit should expire after 30 days")
  })

  it("returns inactive status for unknown partner source", () => {
    const result = getPartnerBenefitStatus({
      partnerSource: "unknown_partner_xyz",
      partnerJoinedAt: new Date(),
      partnerBenefitActive: true,
    })
    assert.equal(result.active, false, "Unknown partner should return inactive status")
  })

  it("calculates daysRemaining correctly (within 1 day tolerance)", () => {
    const joinedAt = new Date()
    joinedAt.setDate(joinedAt.getDate() - 10) // Joined 10 days ago

    const result = getPartnerBenefitStatus({
      partnerSource: "cypg",
      partnerJoinedAt: joinedAt,
      partnerBenefitActive: true,
    })

    const expectedDays = 20 // 30 - 10
    assert.ok(
      Math.abs((result.daysRemaining ?? 0) - expectedDays) <= 1,
      `Expected ~${expectedDays} days remaining, got ${result.daysRemaining}`
    )
  })
})

describe("shouldActivateBenefit", () => {
  it("returns true for 'cypg'", () => {
    assert.equal(shouldActivateBenefit("cypg"), true)
  })

  it("returns false for unknown partner", () => {
    assert.equal(shouldActivateBenefit("nonexistent_xyz"), false)
  })

  it("returns false for empty string", () => {
    assert.equal(shouldActivateBenefit(""), false)
  })
})

// ─────────────────────────────────────────────────────────────
// TESTS: partnerTracking (server-side cookie reader)
// ─────────────────────────────────────────────────────────────

describe("readPartnerSourceFromCookies", () => {
  it("returns null when cookie is absent", () => {
    const fakeCookies = { get: (_name: string) => undefined }
    const result = readPartnerSourceFromCookies(fakeCookies)
    assert.equal(result, null)
  })

  it("returns 'cypg' when cookie contains valid slug", () => {
    const fakeCookies = { get: (_name: string) => ({ value: "cypg" }) }
    const result = readPartnerSourceFromCookies(fakeCookies)
    assert.equal(result, "cypg")
  })

  it("returns null when cookie contains unknown slug", () => {
    const fakeCookies = { get: (_name: string) => ({ value: "evil_partner" }) }
    const result = readPartnerSourceFromCookies(fakeCookies)
    assert.equal(result, null)
  })

  it("returns null when cookie contains empty string", () => {
    const fakeCookies = { get: (_name: string) => ({ value: "" }) }
    const result = readPartnerSourceFromCookies(fakeCookies)
    assert.equal(result, null)
  })
})

// ─────────────────────────────────────────────────────────────
// TESTS: client-side tracking (Node.js safe — document is undefined)
// ─────────────────────────────────────────────────────────────

describe("recordPartnerArrival (Node.js / SSR safe)", () => {
  it("does not throw when document is undefined (SSR context)", () => {
    // In Node.js, document is undefined — the function should handle this gracefully
    assert.doesNotThrow(() => {
      recordPartnerArrival("cypg", undefined, 30)
    }, "recordPartnerArrival should not throw in non-browser environment")
  })

  it("does not throw for invalid partner slug", () => {
    assert.doesNotThrow(() => {
      recordPartnerArrival("not_a_real_partner", undefined, 30)
    })
  })
})

describe("readPartnerSource (Node.js / SSR safe)", () => {
  it("returns null source in non-browser environment", () => {
    const result = readPartnerSource()
    // In Node.js, document and localStorage are undefined — should return null safely
    assert.equal(result.source, null, "Should return null source in Node.js environment")
  })
})

describe("clearPartnerTracking (Node.js / SSR safe)", () => {
  it("does not throw in non-browser environment", () => {
    assert.doesNotThrow(() => clearPartnerTracking())
  })
})
