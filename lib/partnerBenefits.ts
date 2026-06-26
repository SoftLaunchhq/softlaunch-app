// ─────────────────────────────────────────────────────────────
// lib/partnerBenefits.ts
// Business logic for partner benefit activation and status checks.
// ─────────────────────────────────────────────────────────────

import { getPartner } from "./partners"

export interface PartnerBenefitStatus {
  active: boolean
  partnerName: string | null
  partnerSource: string | null
  daysRemaining: number | null
  benefitLabel: string | null
}

/**
 * Compute the current benefit status for a user given their stored partner fields.
 */
export function getPartnerBenefitStatus(user: {
  partnerSource: string | null
  partnerJoinedAt: Date | null
  partnerBenefitActive: boolean
}): PartnerBenefitStatus {
  const empty: PartnerBenefitStatus = {
    active: false,
    partnerName: null,
    partnerSource: null,
    daysRemaining: null,
    benefitLabel: null,
  }

  if (!user.partnerSource || !user.partnerBenefitActive) return empty

  const partner = getPartner(user.partnerSource)
  if (!partner) return empty

  // If no duration configured, benefit is indefinite
  if (!partner.benefitDurationDays) {
    return {
      active: true,
      partnerName: partner.name,
      partnerSource: partner.id,
      daysRemaining: null,
      benefitLabel: partner.benefitLabel ?? null,
    }
  }

  // Check if benefit window has expired
  const joinedAt = user.partnerJoinedAt ?? new Date()
  const expiresAt = new Date(joinedAt.getTime() + partner.benefitDurationDays * 86_400_000)
  const now = new Date()

  if (now > expiresAt) {
    return empty // Benefit expired
  }

  const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / 86_400_000)

  return {
    active: true,
    partnerName: partner.name,
    partnerSource: partner.id,
    daysRemaining,
    benefitLabel: partner.benefitLabel ?? null,
  }
}

/**
 * Determine whether a new user arriving from a partner should have
 * their benefit activated immediately.
 */
export function shouldActivateBenefit(partnerSource: string): boolean {
  const partner = getPartner(partnerSource)
  return !!partner?.active
}
