// ─────────────────────────────────────────────────────────────
// lib/partnerTracking.ts
// Client-side partner source tracking via cookie + localStorage.
// Set on landing page arrival, read after sign-up/sign-in,
// then cleared once the server has persisted the attribution.
// ─────────────────────────────────────────────────────────────

import { ACTIVE_PARTNER_SLUGS } from "./partners"

const COOKIE_KEY = "sl_partner"
const LS_KEY = "sl_partner_source"
const LS_CODE_KEY = "sl_partner_code"

// ─────────────────────────────────────────────────────────────
// Cookie helpers (edge-compatible vanilla JS)
// ─────────────────────────────────────────────────────────────

function setCookie(name: string, value: string, days: number) {
  if (typeof document === "undefined") return
  const expires = new Date(Date.now() + days * 86_400_000).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Called on the partner landing page (e.g. /cypg) to record the source.
 * Writes to both cookie and localStorage for maximum durability.
 */
export function recordPartnerArrival(
  partnerSlug: string,
  partnerCode?: string,
  ttlDays = 30
) {
  if (!ACTIVE_PARTNER_SLUGS.includes(partnerSlug)) return

  setCookie(COOKIE_KEY, partnerSlug, ttlDays)

  try {
    localStorage.setItem(LS_KEY, partnerSlug)
    if (partnerCode) localStorage.setItem(LS_CODE_KEY, partnerCode)
    else localStorage.removeItem(LS_CODE_KEY)
  } catch {
    // Private browsing / storage quota — cookie fallback is sufficient
  }
}

/**
 * Read the stored partner source. Prefers cookie (more reliable),
 * falls back to localStorage.
 */
export function readPartnerSource(): { source: string | null; code: string | null } {
  const cookieSource = getCookie(COOKIE_KEY)
  if (cookieSource && ACTIVE_PARTNER_SLUGS.includes(cookieSource)) {
    let code: string | null = null
    try {
      code = localStorage.getItem(LS_CODE_KEY)
    } catch {}
    return { source: cookieSource, code }
  }

  try {
    const lsSource = localStorage.getItem(LS_KEY)
    if (lsSource && ACTIVE_PARTNER_SLUGS.includes(lsSource)) {
      const code = localStorage.getItem(LS_CODE_KEY)
      return { source: lsSource, code }
    }
  } catch {}

  return { source: null, code: null }
}

/**
 * Clear partner tracking data after it has been successfully
 * persisted to the database (call from the post-sign-up hook).
 */
export function clearPartnerTracking() {
  deleteCookie(COOKIE_KEY)
  try {
    localStorage.removeItem(LS_KEY)
    localStorage.removeItem(LS_CODE_KEY)
  } catch {}
}

/**
 * Read partner source from a server-side request (reads the cookie header).
 * Use inside Server Components or API routes via `cookies()` from next/headers.
 */
export function readPartnerSourceFromCookies(
  cookieStore: { get: (name: string) => { value: string } | undefined }
): string | null {
  const val = cookieStore.get(COOKIE_KEY)?.value
  if (!val) return null
  return ACTIVE_PARTNER_SLUGS.includes(val) ? val : null
}
