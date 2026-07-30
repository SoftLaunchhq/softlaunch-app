/**
 * lib/meetup-locations.ts
 *
 * Curated Charlotte meetup locations for BUZZ to suggest.
 *
 * Architecture note:
 *   Currently static — each call to getSuggestedLocations() returns 4 shuffled
 *   picks from the relevant pool.  The interface is designed so this can later
 *   be swapped for a live Places/Yelp/Google Places API call without touching
 *   any caller code — just replace the implementation of getSuggestedLocations().
 */

export type LocationCategory =
  | "coffee"
  | "restaurant"
  | "co-working"
  | "bar-lounge"
  | "rooftop"
  | "park"

export interface MeetupLocation {
  name: string
  description: string
  address: string
  neighborhood: string
  /** Category drives the icon shown in the poll card */
  type: LocationCategory
  /** Which cohort types this spot suits */
  cohortTypes: Array<"social" | "professional" | "both">
  /** Optional extra note, e.g. "Book ahead — fills up on weekends" */
  tip?: string
}

// ─── Social cohort locations ──────────────────────────────────
// Warm, relaxed, conversation-friendly spots.

const SOCIAL_LOCATIONS: MeetupLocation[] = [
  {
    name: "Amelie's French Bakery",
    description: "Quirky 24/7 bakery with cozy nooks, great pastries, and a no-rush vibe.",
    address: "330 N Tryon St, Charlotte, NC 28202",
    neighborhood: "NoDa / Uptown",
    type: "coffee",
    cohortTypes: ["social"],
    tip: "Grab a bench seat upstairs for more privacy.",
  },
  {
    name: "Unknown Brewing",
    description: "Laid-back taproom with plenty of seating, craft beer, and a huge patio.",
    address: "1327 S Mint St, Charlotte, NC 28203",
    neighborhood: "South End",
    type: "bar-lounge",
    cohortTypes: ["social"],
  },
  {
    name: "Common Market South End",
    description: "Neighborhood deli-bar with an artsy crowd, great sandwiches, and a relaxed porch.",
    address: "1515 S Tryon St, Charlotte, NC 28203",
    neighborhood: "South End",
    type: "bar-lounge",
    cohortTypes: ["social"],
  },
  {
    name: "Free Range Brewing",
    description: "Welcoming taproom in NoDa with board games, a dog-friendly patio, and rotating taps.",
    address: "2320 N Davidson St, Charlotte, NC 28205",
    neighborhood: "NoDa",
    type: "bar-lounge",
    cohortTypes: ["social"],
  },
  {
    name: "Hello, Sailor",
    description: "Lakeside bar on Lake Norman with a nautical vibe, seafood bites, and a killer deck.",
    address: "20000 Henderson Rd, Cornelius, NC 28031",
    neighborhood: "Lake Norman",
    type: "bar-lounge",
    cohortTypes: ["social"],
    tip: "Worth the short drive — stunning views.",
  },
  {
    name: "The Bluebird",
    description: "Low-key neighborhood restaurant in Plaza Midwood with great cocktails and a back patio.",
    address: "1523 Elizabeth Ave, Charlotte, NC 28204",
    neighborhood: "Plaza Midwood",
    type: "restaurant",
    cohortTypes: ["social"],
  },
  {
    name: "Optimist Hall",
    description: "Sprawling food hall with dozens of options, open layout, and ample group seating.",
    address: "1115 N Brevard St, Charlotte, NC 28206",
    neighborhood: "North End",
    type: "restaurant",
    cohortTypes: ["social", "both"],
  },
  {
    name: "Sycamore Brewing",
    description: "Popular South End brewery with a spacious taproom and rotating food trucks outside.",
    address: "2161 Hawkins St, Charlotte, NC 28203",
    neighborhood: "South End",
    type: "bar-lounge",
    cohortTypes: ["social"],
  },
  {
    name: "Uptown Amphitheatre (BBQ + lawn)",
    description: "Great outdoor spot on a nice day — bring BBQ from nearby stalls and spread out on the lawn.",
    address: "210 E Trade St, Charlotte, NC 28202",
    neighborhood: "Uptown",
    type: "park",
    cohortTypes: ["social"],
    tip: "Best on a weekend afternoon.",
  },
]

// ─── Professional cohort locations ────────────────────────────
// Quieter spots with better acoustics and a work-ready vibe.

const PROFESSIONAL_LOCATIONS: MeetupLocation[] = [
  {
    name: "Hygge Coworking — South End",
    description: "Modern co-working space with day-pass drop-in — private rooms and fast Wi-Fi.",
    address: "1415 S Church St, Charlotte, NC 28203",
    neighborhood: "South End",
    type: "co-working",
    cohortTypes: ["professional"],
    tip: "Book the conference room 24 hours ahead.",
  },
  {
    name: "Summit Coffee — South End",
    description: "Spacious specialty coffee shop with good acoustics and laptop-friendly tables.",
    address: "1338 S Tryon St, Charlotte, NC 28203",
    neighborhood: "South End",
    type: "coffee",
    cohortTypes: ["professional", "both"],
  },
  {
    name: "Birdsong Brewing",
    description: "Low-key NoDa brewery — quieter than most, with long tables good for small-group conversation.",
    address: "1016 N Davidson St, Charlotte, NC 28206",
    neighborhood: "NoDa",
    type: "bar-lounge",
    cohortTypes: ["professional"],
  },
  {
    name: "Rooster's Wood-Fired Kitchen",
    description: "Upscale but relaxed Myers Park restaurant — great for a working lunch or early dinner.",
    address: "6601 Morrison Blvd, Charlotte, NC 28211",
    neighborhood: "Myers Park",
    type: "restaurant",
    cohortTypes: ["professional"],
  },
  {
    name: "The Capital Grille (bar area)",
    description: "Bar area in a classic steakhouse — quieter than the dining room, solid drinks, polished vibe.",
    address: "201 N Tryon St, Charlotte, NC 28202",
    neighborhood: "Uptown",
    type: "restaurant",
    cohortTypes: ["professional"],
  },
  {
    name: "Camel City Coffee — Plaza Midwood",
    description: "Focused specialty coffee shop with minimal noise — good for accountability conversations.",
    address: "1511 Central Ave, Charlotte, NC 28205",
    neighborhood: "Plaza Midwood",
    type: "coffee",
    cohortTypes: ["professional"],
  },
  {
    name: "Industrious — Uptown Charlotte",
    description: "Premium co-working with a members' lounge open to day-pass visitors.",
    address: "101 N Tryon St, Charlotte, NC 28246",
    neighborhood: "Uptown",
    type: "co-working",
    cohortTypes: ["professional"],
    tip: "Call ahead to confirm day-pass availability.",
  },
  {
    name: "Merchant & Trade",
    description: "Rooftop bar with sweeping city views — early evening before the weekend crowd arrives.",
    address: "620 N College St, Charlotte, NC 28202",
    neighborhood: "Uptown",
    type: "rooftop",
    cohortTypes: ["professional", "both"],
    tip: "Get there by 6 PM on weekends to beat the line.",
  },
]

// ─── Utility ─────────────────────────────────────────────────

/** Fisher-Yates shuffle (in-place) */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Return exactly `count` location suggestions for the given cohort type.
 *
 * Pool selection:
 *   "social"       → SOCIAL_LOCATIONS
 *   "professional" → PROFESSIONAL_LOCATIONS
 *
 * If `preferredType` is supplied (derived from the most common member
 * favoriteLocationType), options that match that type are sorted first.
 * The first returned item is the one that should be marked "Recommended".
 *
 * Results are otherwise shuffled so repeated calls give variety.
 * Always returns exactly `count` items (or fewer if pool is smaller).
 */
export function getSuggestedLocations(
  cohortType: "social" | "professional",
  count = 4,
  preferredType?: string | null
): MeetupLocation[] {
  const pool =
    cohortType === "social"
      ? SOCIAL_LOCATIONS
      : PROFESSIONAL_LOCATIONS

  const shuffled = shuffle(pool)

  if (!preferredType) return shuffled.slice(0, count)

  // Map member favorite types to LocationCategory equivalents
  const typeMap: Record<string, LocationCategory> = {
    coffee:     "coffee",
    restaurant: "restaurant",
    coworking:  "co-working",
    library:    "co-working", // closest equivalent
    park:       "park",
    campus:     "co-working",
    bookstore:  "coffee", // closest warm/cozy equivalent
    other:      "coffee",
  }
  const mappedType = typeMap[preferredType] ?? null

  if (!mappedType) return shuffled.slice(0, count)

  // Put matching items first, rest after
  const preferred = shuffled.filter((l) => l.type === mappedType)
  const others    = shuffled.filter((l) => l.type !== mappedType)

  return [...preferred, ...others].slice(0, count)
}

/**
 * Return a location's emoji icon based on its category.
 * Used in poll option display.
 */
export function locationIcon(type: LocationCategory): string {
  const icons: Record<LocationCategory, string> = {
    coffee: "☕",
    restaurant: "🍽️",
    "co-working": "💻",
    "bar-lounge": "🍺",
    rooftop: "🌆",
    park: "🌿",
  }
  return icons[type] ?? "📍"
}
