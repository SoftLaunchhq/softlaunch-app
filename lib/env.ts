// ─────────────────────────────────────────────────────────────
// lib/env.ts
// Startup environment variable validation.
// Import this at the top of lib/db.ts and any route that needs
// early-fail rather than a silent Prisma crash at query time.
// ─────────────────────────────────────────────────────────────

interface EnvCheck {
  name: string
  required: boolean
  /** If true, value must not be a placeholder. */
  noPlaceholder?: boolean
  /** If true, warn but don't throw. */
  warnOnly?: boolean
}

const ENV_CHECKS: EnvCheck[] = [
  // ── Core DB ────────────────────────────────────────────────
  { name: "DATABASE_URL",                    required: true,  noPlaceholder: true },
  // ── Clerk ──────────────────────────────────────────────────
  { name: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", required: true },
  { name: "CLERK_SECRET_KEY",                required: true },
  { name: "CLERK_WEBHOOK_SECRET",            required: true, warnOnly: true },
  // ── AI ─────────────────────────────────────────────────────
  { name: "OPENAI_API_KEY",                  required: true },
  // ── Email ──────────────────────────────────────────────────
  { name: "RESEND_API_KEY",                  required: true, warnOnly: true },
  // ── Stripe ─────────────────────────────────────────────────
  { name: "STRIPE_SECRET_KEY",               required: true, warnOnly: true },
  { name: "STRIPE_WEBHOOK_SECRET",           required: true, warnOnly: true },
]

const PLACEHOLDER_PATTERNS = [
  "user:password",
  "[PASSWORD]",
  "YOUR_PASSWORD",
  "replace_with_real_value",
  "pk_test_...",
  "sk_test_...",
  "sk-proj-...",
  "re_...",
  "whsec_...",
  "price_...",
]

function looksLikePlaceholder(value: string): boolean {
  return PLACEHOLDER_PATTERNS.some((p) => value.includes(p))
}

let validated = false

/**
 * Validate required environment variables.
 * - In development: throws on fatal missing/placeholder vars so you know immediately.
 * - In production: logs errors but does NOT throw (prevents hard-crash on first deploy
 *   while env is being set up — the DB layer will fail gracefully instead).
 *
 * Call once from lib/db.ts module init.
 */
export function validateEnv(): void {
  if (validated) return
  validated = true

  const isDev = process.env.NODE_ENV === "development"
  const errors: string[] = []
  const warnings: string[] = []

  for (const check of ENV_CHECKS) {
    const value = process.env[check.name]

    if (!value || value.trim() === "") {
      const msg = `Missing env var: ${check.name}`
      if (check.warnOnly) {
        warnings.push(msg)
      } else if (isDev) {
        errors.push(msg)
      } else {
        warnings.push(`PRODUCTION: ${msg}`)
      }
      continue
    }

    if (check.noPlaceholder && looksLikePlaceholder(value)) {
      const msg = `Placeholder value in ${check.name} — replace with real credentials`
      if (isDev) {
        errors.push(msg)
      } else {
        warnings.push(`PRODUCTION: ${msg}`)
      }
    }
  }

  // Log warnings regardless
  if (warnings.length > 0) {
    console.warn("[env] Configuration warnings:\n" + warnings.map((w) => `  ⚠ ${w}`).join("\n"))
  }

  // In dev, throw hard so the developer sees it immediately
  if (isDev && errors.length > 0) {
    throw new Error(
      "\n\n❌ SoftLaunch: Missing or invalid environment variables:\n" +
        errors.map((e) => `  • ${e}`).join("\n") +
        "\n\nFix these in .env.local and restart the dev server.\n" +
        "See .env.example for the full list of required variables.\n"
    )
  }
}

/**
 * Quick runtime check: is DATABASE_URL present and not a placeholder?
 * Use this for early-return DB guard in API routes.
 */
export function isDatabaseConfigured(): boolean {
  const url = process.env.DATABASE_URL
  if (!url || url.trim() === "") return false
  if (looksLikePlaceholder(url)) return false
  return true
}
