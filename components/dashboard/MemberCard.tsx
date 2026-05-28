"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import { Sparkles } from "lucide-react"
import { getInitials, archetypeToColor } from "@/lib/utils"

interface Props {
  membership: {
    user: {
      profile: {
        firstName: string
        lastName: string
        photoUrl: string | null
        headline: string | null
      } | null
      driveProfile: {
        archetype: string
        archetypeSlug: string
        ambition: number
      } | null
    }
  }
  index: number
}

export function MemberCard({ membership, index }: Props) {
  const { user } = membership
  const profile = user.profile
  const driveProfile = user.driveProfile

  if (!profile) return null

  const initials = getInitials(profile.firstName, profile.lastName)
  const archetypeColor = driveProfile
    ? archetypeToColor(driveProfile.archetypeSlug)
    : "#1DB896"

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, type: "spring", stiffness: 380, damping: 28 }}
      whileHover={{
        y: -4,
        transition: { type: "spring", stiffness: 420, damping: 22 },
      }}
      whileTap={{ scale: 0.98 }}
      className="neon-panel group flex cursor-default flex-col items-center gap-4 p-6 text-center"
      style={{
        boxShadow: `0 0 0 1px ${archetypeColor}22, 0 18px 50px rgba(0,0,0,0.35)`,
      }}
    >
      <div className="relative">
        {profile.photoUrl ? (
          <div
            className="h-16 w-16 overflow-hidden rounded-full ring-2 ring-brand-primary/30 transition-all duration-300 group-hover:ring-brand-primary/60"
            style={{ boxShadow: `0 0 24px ${archetypeColor}40` }}
          >
            <Image
              src={profile.photoUrl}
              alt={`${profile.firstName} ${profile.lastName}`}
              width={64}
              height={64}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full text-lg font-semibold ring-2 ring-brand-primary/25 transition-all group-hover:ring-brand-primary/50"
            style={{
              backgroundColor: archetypeColor + "35",
              color: archetypeColor,
              boxShadow: `0 0 28px ${archetypeColor}45`,
            }}
          >
            {initials}
          </div>
        )}

        {driveProfile && (
          <motion.div
            className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-brand-surface"
            style={{ backgroundColor: archetypeColor }}
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>

      <div className="space-y-1">
        <p className="text-sm font-semibold text-brand-text">
          {profile.firstName} {profile.lastName}
        </p>
        {profile.headline && (
          <p className="line-clamp-2 text-xs leading-snug text-brand-text-subtle">
            {profile.headline}
          </p>
        )}
      </div>

      {driveProfile && (
        <span
          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium"
          style={{
            color: archetypeColor,
            backgroundColor: archetypeColor + "18",
            borderColor: archetypeColor + "40",
          }}
        >
          <Sparkles className="h-3 w-3 opacity-90" />
          {driveProfile.archetype}
        </span>
      )}
    </motion.div>
  )
}
