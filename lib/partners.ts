// ─────────────────────────────────────────────────────────────
// lib/partners.ts
// Central registry of all SoftLaunch partner integrations.
// Add a new entry here when onboarding a new partner.
// ─────────────────────────────────────────────────────────────

export interface Partner {
  /** Unique slug stored in DB as partnerSource */
  id: string
  /** Human-readable name shown in admin dashboard */
  name: string
  /** Short description of the partnership */
  description: string
  /** URL path for this partner's custom landing page */
  landingPath: string
  /** Whether this partner is currently active */
  active: boolean
  /** Optional: partner logo URL (for landing page) */
  logoUrl?: string
  /** Optional: custom headline override for landing page */
  headline?: string
  /** Optional: custom subheadline override for landing page */
  subheadline?: string
  /** Optional: CTA button label override */
  ctaLabel?: string
  /** Optional: specific benefit description shown to users */
  benefitLabel?: string
  /** How long (days) the benefit is active after joining */
  benefitDurationDays?: number
  /** Tracking cookie TTL in days (default 30) */
  cookieTtlDays: number
}

export const PARTNERS: Record<string, Partner> = {
  cypg: {
    id: "cypg",
    name: "Can't You Play Golf?",
    description: "CYPG community partnership — golf & lifestyle audience",
    landingPath: "/cypg",
    active: true,
    headline: "Built for people who play golf and actually show up.",
    subheadline:
      "SoftLaunch is a tight-knit accountability community for driven people. CYPG members get first access — no waitlist, no card required for Week 1.",
    ctaLabel: "Join as a CYPG member →",
    benefitLabel: "CYPG members get priority matching + a free first month",
    benefitDurationDays: 30,
    cookieTtlDays: 30,
  },
  // Add future partners below:
  // podcast: { ... },
  // nba: { ... },
}

/** Look up a partner by slug. Returns undefined if not found or not active. */
export function getPartner(slug: string): Partner | undefined {
  const p = PARTNERS[slug.toLowerCase()]
  return p?.active ? p : undefined
}

/** All active partner slugs (for cookie validation) */
export const ACTIVE_PARTNER_SLUGS = Object.values(PARTNERS)
  .filter((p) => p.active)
  .map((p) => p.id)
