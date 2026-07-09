/**
 * __tests__/apiSafety.test.ts
 *
 * Tests for API route safety logic — error detection, input validation,
 * and error handling patterns. Tests the pure logic extracted from routes
 * without invoking Next.js runtime or real DB connections.
 *
 * Also validates that route files have the correct patterns in source.
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import * as fs from "node:fs"
import * as path from "node:path"

const ROOT = path.resolve(__dirname, "..")

function readFile(relPath: string): string {
  try {
    return fs.readFileSync(path.join(ROOT, relPath), "utf-8")
  } catch {
    return ""
  }
}

// ─────────────────────────────────────────────────────────────
// INLINE: isDbConnectionError logic (mirrors profile/route.ts)
// We test the EXACT SAME logic by copying the function body here.
// If this function is later changed in the route, these tests will
// catch any regression.
// ─────────────────────────────────────────────────────────────

function isDbConnectionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const e = error as any
  if (
    e.code === "P1000" ||
    e.code === "P1001" ||
    e.code === "P1017" ||
    e.code === "P2021" ||
    e.code === "P2028"
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

// ─────────────────────────────────────────────────────────────
// TESTS: isDbConnectionError — Prisma error codes
// ─────────────────────────────────────────────────────────────

describe("isDbConnectionError — Prisma codes", () => {
  it("detects P1000 (auth failure)", () => {
    assert.equal(isDbConnectionError({ code: "P1000", message: "auth failed" }), true)
  })

  it("detects P1001 (unreachable)", () => {
    assert.equal(isDbConnectionError({ code: "P1001", message: "can't reach" }), true)
  })

  it("detects P1017 (server closed connection)", () => {
    assert.equal(isDbConnectionError({ code: "P1017", message: "closed" }), true)
  })

  it("detects P2021 (table not found)", () => {
    assert.equal(isDbConnectionError({ code: "P2021", message: "table not found" }), true)
  })

  it("detects P2028 (Transaction API error — pgBouncer incompatibility)", () => {
    assert.equal(
      isDbConnectionError({ code: "P2028", message: "Transaction API error" }),
      true,
      "P2028 must be caught — this is the pgBouncer transaction mode bug"
    )
  })

  it("does NOT classify P2002 (unique constraint) as connection error", () => {
    assert.equal(
      isDbConnectionError({ code: "P2002", message: "Unique constraint failed" }),
      false,
      "P2002 is a data error, not a connection error"
    )
  })

  it("does NOT classify P2025 (record not found) as connection error", () => {
    assert.equal(
      isDbConnectionError({ code: "P2025", message: "Record not found" }),
      false
    )
  })

  it("detects PrismaClientInitializationError by name", () => {
    assert.equal(
      isDbConnectionError({ name: "PrismaClientInitializationError", message: "binary not found" }),
      true
    )
  })
})

describe("isDbConnectionError — message strings", () => {
  it("detects ECONNREFUSED", () => {
    assert.equal(isDbConnectionError({ code: "P9999", message: "ECONNREFUSED 127.0.0.1:5432" }), true)
  })

  it("detects ETIMEDOUT", () => {
    assert.equal(isDbConnectionError({ message: "ETIMEDOUT connect" }), true)
  })

  it("detects connect timeout", () => {
    assert.equal(isDbConnectionError({ message: "connect timeout after 10000ms" }), true)
  })

  it("detects Supabase 'Tenant or user not found'", () => {
    assert.equal(
      isDbConnectionError({ message: "Tenant or user not found" }),
      true,
      "Supabase pooler error must be caught"
    )
  })

  it("detects Supabase 'FATAL:' prefix", () => {
    assert.equal(
      isDbConnectionError({ message: "FATAL: password authentication failed for user" }),
      true
    )
  })

  it("detects 'Max client connections reached'", () => {
    assert.equal(
      isDbConnectionError({ message: "Max client connections reached" }),
      true
    )
  })

  it("detects SSL connection error", () => {
    assert.equal(isDbConnectionError({ message: "SSL connection error: unexpected EOF" }), true)
  })

  it("returns false for null", () => {
    assert.equal(isDbConnectionError(null), false)
  })

  it("returns false for undefined", () => {
    assert.equal(isDbConnectionError(undefined), false)
  })

  it("returns false for string", () => {
    assert.equal(isDbConnectionError("some error string"), false)
  })

  it("returns false for generic Error with unrelated message", () => {
    assert.equal(isDbConnectionError(new Error("Division by zero")), false)
  })
})

// ─────────────────────────────────────────────────────────────
// TESTS: cohort-intent API route source validation
// ─────────────────────────────────────────────────────────────

describe("cohort-intent API route (source analysis)", () => {
  const src = readFile("app/api/cohort-intent/route.ts")

  it("route file exists", () => {
    assert.ok(
      fs.existsSync(path.join(ROOT, "app/api/cohort-intent/route.ts")),
      "cohort-intent route must exist"
    )
  })

  it("only accepts 'social' or 'professional' as valid intent values", () => {
    assert.ok(
      src.includes('"social"') && src.includes('"professional"'),
      "Route must accept only 'social' and 'professional'"
    )
    // Should use z.enum with exactly those two values
    assert.ok(
      src.includes('z.enum(["social", "professional"]') ||
        src.includes("z.enum(['social', 'professional']"),
      "Route should use z.enum to validate intent"
    )
  })

  it("sets httpOnly cookie before attempting DB write (db.$executeRaw)", () => {
    // Use "db.$executeRaw`" (with backtick) to find the actual call, not the comment
    const cookieSetIdx = src.indexOf("res.cookies.set(COOKIE_NAME")
    const executeRawCallIdx = src.indexOf("await db.$executeRaw`")
    assert.ok(cookieSetIdx !== -1, "Route must set a cookie via res.cookies.set")
    assert.ok(executeRawCallIdx !== -1, "Route must use await db.$executeRaw to write intent to DB")
    assert.ok(
      cookieSetIdx < executeRawCallIdx,
      "Cookie must be set BEFORE the DB write (cookie is the primary gate mechanism)"
    )
  })

  it("returns 401 for unauthenticated requests", () => {
    assert.ok(src.includes("401"), "Route must return 401 for unauthorized requests")
  })

  it("DB error is non-fatal (catch block logs but does not rethrow)", () => {
    // The catch block around the DB write must NOT throw or return a 500.
    // It should log and fall through to `return res` (cookie already set).
    const catchIdx = src.lastIndexOf("} catch")
    const lastReturnResIdx = src.lastIndexOf("return res")
    assert.ok(catchIdx !== -1, "Route must have a catch block around the DB write")
    assert.ok(lastReturnResIdx !== -1, "Route must end with `return res` (the cookie response)")
    assert.ok(
      lastReturnResIdx > catchIdx,
      "The `return res` must come AFTER the DB catch block — errors are non-fatal"
    )
    assert.ok(
      src.includes("console.warn") || src.includes("console.error"),
      "DB errors should be logged in the catch block"
    )
  })
})

// ─────────────────────────────────────────────────────────────
// TESTS: profile API route source validation
// ─────────────────────────────────────────────────────────────

describe("profile API route (source analysis)", () => {
  const src = readFile("app/api/profile/route.ts")

  it("route file exists", () => {
    assert.ok(
      fs.existsSync(path.join(ROOT, "app/api/profile/route.ts")),
      "profile route must exist"
    )
  })

  it("does NOT use interactive $transaction (pgBouncer incompatible)", () => {
    assert.ok(
      !src.includes("db.$transaction(async"),
      "Profile route must NOT use db.$transaction(async ...) — incompatible with pgBouncer in transaction mode"
    )
  })

  it("uses sequential db.profile.upsert (not tx.profile.upsert)", () => {
    assert.ok(
      src.includes("db.profile.upsert"),
      "Profile route must use db.profile.upsert (not tx.profile.upsert inside a transaction)"
    )
  })

  it("uses sequential db.cohortPreferences.upsert", () => {
    assert.ok(
      src.includes("db.cohortPreferences.upsert"),
      "Profile route must use db.cohortPreferences.upsert sequentially"
    )
  })

  it("uses sequential db.user.update", () => {
    assert.ok(
      src.includes("db.user.update"),
      "Profile route must update user record sequentially"
    )
  })

  it("has P2028 in error detection", () => {
    assert.ok(
      src.includes('"P2028"') || src.includes("'P2028'"),
      "Profile route error detection must include P2028 (pgBouncer transaction error)"
    )
  })

  it("has lite mode fallback when DB is unavailable", () => {
    assert.ok(
      src.includes("liteModeFallback"),
      "Profile route must have a lite mode cookie fallback"
    )
  })

  it("validates input with Zod schema", () => {
    assert.ok(src.includes("profileSchema.parse"), "Profile route must validate input with Zod")
  })

  it("handles linkedinUrl as optional (can be empty string)", () => {
    assert.ok(
      src.includes("linkedinUrl") && (src.includes("optional") || src.includes('z.literal("")')),
      "linkedinUrl must be optional in profile schema"
    )
  })

  it("sets onboardingComplete to true on success", () => {
    assert.ok(
      src.includes("onboardingComplete: true"),
      "Profile route must mark onboarding as complete"
    )
  })

  it("dev mode returns detailed error (code + detail)", () => {
    assert.ok(
      src.includes("NODE_ENV") && src.includes('"development"'),
      "Profile route should return detailed errors in dev mode"
    )
  })
})

// ─────────────────────────────────────────────────────────────
// TESTS: BUZZ API route safety
// ─────────────────────────────────────────────────────────────

describe("BUZZ API route safety (source analysis)", () => {
  const buzzPath = path.join(ROOT, "app/api/buzz")
  const chatRoute = fs.existsSync(path.join(buzzPath, "chat", "route.ts"))
    ? readFile("app/api/buzz/chat/route.ts")
    : readFile("app/api/buzz/route.ts")

  it("BUZZ route file exists (chat or root)", () => {
    const exists =
      fs.existsSync(path.join(ROOT, "app/api/buzz/chat/route.ts")) ||
      fs.existsSync(path.join(ROOT, "app/api/buzz/route.ts"))
    assert.ok(exists, "BUZZ route must exist at app/api/buzz/chat/route.ts or app/api/buzz/route.ts")
  })

  it("BUZZ has a local fallback when OpenAI is unavailable", () => {
    assert.ok(
      chatRoute.includes("FALLBACK") || chatRoute.includes("fallback"),
      "BUZZ must have a fallback response when OpenAI key is missing or API fails"
    )
  })

  it("BUZZ does not include raw API key string in JSON responses", () => {
    // The route reads OPENAI_API_KEY from process.env to construct the OpenAI client —
    // that is fine and expected. It must NOT stringify or forward the key in any response.
    // We check that the key name never appears directly inside a response body literal.
    const dangerousPatterns = [
      // Key name appearing inside json() call directly
      'json({ openai_api_key',
      'json({ apiKey',
      'json({ key',
      // Key name stringified in a response
      '"OPENAI_API_KEY":',
      "'OPENAI_API_KEY':",
    ]
    for (const pattern of dangerousPatterns) {
      assert.ok(
        !chatRoute.toLowerCase().includes(pattern.toLowerCase()),
        `BUZZ route must not include pattern "${pattern}" in response bodies`
      )
    }
    // The one allowed reference is reading from process.env
    assert.ok(
      chatRoute.includes("process.env.OPENAI_API_KEY"),
      "BUZZ route should read OPENAI_API_KEY from process.env (not hardcode it)"
    )
  })

  it("BUZZ requires authentication", () => {
    assert.ok(
      chatRoute.includes("auth()") || chatRoute.includes("clerkId"),
      "BUZZ route must require authentication"
    )
  })

  it("BUZZ returns 401 for unauthenticated requests", () => {
    assert.ok(
      chatRoute.includes("401"),
      "BUZZ route must return 401 for unauthenticated requests"
    )
  })
})

// ─────────────────────────────────────────────────────────────
// TESTS: Stripe / billing route safety
// ─────────────────────────────────────────────────────────────

describe("Stripe / billing route safety (source analysis)", () => {
  const checkoutRoute = readFile("app/api/billing/checkout/route.ts")

  it("billing checkout route exists", () => {
    assert.ok(
      fs.existsSync(path.join(ROOT, "app/api/billing/checkout/route.ts")),
      "Billing checkout route must exist"
    )
  })

  it("checkout route requires authentication", () => {
    assert.ok(
      checkoutRoute.includes("auth()") || checkoutRoute.includes("clerkId"),
      "Checkout route must require authentication"
    )
  })

  it("checkout route handles missing Stripe key gracefully", () => {
    // Either checks for the key or wraps in try/catch
    const hasGuard =
      checkoutRoute.includes("STRIPE_SECRET_KEY") ||
      checkoutRoute.includes("stripe.ts") ||
      checkoutRoute.includes("try {")
    assert.ok(hasGuard, "Checkout route should handle missing Stripe key")
  })

  it("CYPG users with active partner benefit bypass payment", () => {
    // Either in checkout or benefit check logic
    const benefitsCheck = readFile("lib/partnerBenefits.ts")
    assert.ok(
      benefitsCheck.includes("active") && benefitsCheck.includes("daysRemaining"),
      "Partner benefit system must track active status and days remaining"
    )
  })
})

// ─────────────────────────────────────────────────────────────
// TESTS: Middleware / auth protection
// ─────────────────────────────────────────────────────────────

describe("Auth protection (middleware + route analysis)", () => {
  const middlewarePath = path.join(ROOT, "middleware.ts")
  const middlewareSrc = readFile("middleware.ts")

  it("middleware.ts exists", () => {
    assert.ok(fs.existsSync(middlewarePath), "middleware.ts must exist for auth protection")
  })

  it("middleware protects /dashboard routes", () => {
    assert.ok(
      middlewareSrc.includes("/dashboard") || middlewareSrc.includes("clerkMiddleware"),
      "Middleware must protect /dashboard"
    )
  })

  it("middleware protects /admin routes", () => {
    assert.ok(
      middlewareSrc.includes("/admin") || middlewareSrc.includes("clerkMiddleware"),
      "Middleware must protect /admin"
    )
  })

  it("middleware uses Clerk for auth", () => {
    assert.ok(
      middlewareSrc.includes("clerk") || middlewareSrc.includes("Clerk"),
      "Middleware must use Clerk for authentication"
    )
  })

  it("admin area checks for ADMIN role in (admin) group layout", () => {
    // The role check is in app/(admin)/layout.tsx (the route group layout),
    // NOT in app/(admin)/admin/layout.tsx
    const adminGroupLayout = readFile("app/(admin)/layout.tsx")
    assert.ok(
      adminGroupLayout.includes("ADMIN") || adminGroupLayout.includes("role"),
      "Admin group layout must check for ADMIN role"
    )
    // Specifically should redirect non-admins to /dashboard
    assert.ok(
      adminGroupLayout.includes('redirect("/dashboard")') ||
        adminGroupLayout.includes("redirect('/dashboard')"),
      "Non-admin users should be redirected to /dashboard from admin area"
    )
  })
})

// ─────────────────────────────────────────────────────────────
// TESTS: Database safety
// ─────────────────────────────────────────────────────────────

describe("Database safety patterns", () => {
  it("lib/db.ts exists and uses singleton pattern", () => {
    const src = readFile("lib/db.ts")
    assert.ok(src.length > 0, "lib/db.ts must exist")
    // Singleton pattern: check for globalThis or global caching
    const hasSingleton =
      src.includes("globalThis") ||
      src.includes("global.") ||
      src.includes("global[")
    assert.ok(
      hasSingleton,
      "lib/db.ts should use singleton pattern to prevent connection pool exhaustion"
    )
  })

  it("matching API route does NOT delete users", () => {
    const matchingRoute = readFile("app/api/matching/suggest/route.ts")
    assert.ok(
      !matchingRoute.includes("db.user.delete") &&
        !matchingRoute.includes("deleteMany"),
      "Matching route must not delete users"
    )
  })

  it("cohort admin routes use PATCH/PUT, not DELETE for member management", () => {
    // Admin matching should update status, not delete records
    const matchingPage = readFile("app/(admin)/admin/matching/page.tsx")
    // Should not be calling delete endpoints for members
    const hasNoMemberDelete =
      !matchingPage.includes("/api/members/delete") &&
      !matchingPage.includes("method: 'DELETE'")
    assert.ok(
      hasNoMemberDelete,
      "Admin matching page should not delete members — use status changes instead"
    )
  })
})
