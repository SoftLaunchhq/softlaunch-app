import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { PendingCohortState } from "@/components/dashboard/PendingCohortState"
import { CohortView } from "@/components/dashboard/CohortView"
import { UpgradePrompt } from "@/components/dashboard/UpgradePrompt"
import { DbErrorPrompt } from "@/components/dashboard/DbErrorPrompt"
import { CalendarDays, CreditCard, UsersRound } from "lucide-react"

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

type FullUser = NonNullable<Awaited<ReturnType<typeof fetchUser>>>

type PsychProfileData = {
  ambitionType?: string | null
  energyStyle?: string | null
  communicationStyle?: string | null
  accountabilityNeed?: string | null
  emotionalDriver?: string | null
  conflictStyle?: string | null
  summary?: string | null
  confidenceScore?: number
} | null

type DashboardResult =
  | { status: "ok"; user: FullUser; psychProfile: PsychProfileData }
  | { status: "db_unavailable"; error: string }
  | { status: "not_found" }
  | { status: "onboarding_incomplete"; step: string }

// ─────────────────────────────────────────────────────────────
// DB HELPERS
// ─────────────────────────────────────────────────────────────

async function fetchUser(clerkId: string) {
  return db.user.findUnique({
    where: { clerkId },
    include: {
      profile: true,
      driveProfile: true,
      subscription: true,
      memberships: {
        where: { status: { in: ["ACTIVE", "PENDING"] } },
        include: {
          cohort: {
            include: {
              memberships: {
                include: {
                  user: { include: { profile: true, driveProfile: true } },
                },
              },
              weeklyPrompts: {
                where: { status: { in: ["ACTIVE", "COMPLETED"] } },
                orderBy: { weekNumber: "asc" },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })
}

/** True for any DB connectivity or auth failure (but NOT logic/schema errors) */
function isConnectionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const e = err as Record<string, unknown>
  // Prisma error codes: P1000=auth, P1001=unreachable, P1017=closed
  if (e.code === "P1000" || e.code === "P1001" || e.code === "P1017") return true
  if (e.name === "PrismaClientInitializationError") return true
  const msg: string = String((e.message as string) ?? "")
  return (
    msg.includes("ECONNREFUSED") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("connect timeout") ||
    msg.includes("postgresql://user:password") ||
    msg.includes("Can't reach database server") ||
    msg.includes("Environment variable not found: DATABASE_URL") ||
    msg.includes("Authentication failed against database server") ||
    msg.includes("password authentication failed") ||
    (msg.includes("credentials") && msg.includes("not valid")) ||
    // ── Supabase pgbouncer / pooler errors ───────────────────
    // These are returned when the project is paused, the tenant isn't found,
    // or the pooler rejects the session before the DB layer is reached.
    msg.includes("Tenant or user not found") ||
    msg.includes("tenant_not_found") ||
    msg.includes("Max client connections reached") ||
    msg.includes("remaining connection slots are reserved") ||
    // Any Postgres FATAL / ERROR that comes back over the pooler
    msg.includes("FATAL:") ||
    msg.includes("ERROR:  terminating connection") ||
    // SSL / TLS failures on cloud connections
    msg.includes("SSL connection error") ||
    msg.includes("SSL SYSCALL error")
  )
}

async function getDashboardData(clerkId: string): Promise<DashboardResult> {
  // ── Safe dev-only log — shows config state without exposing secrets ──
  if (process.env.NODE_ENV === "development") {
    const url = process.env.DATABASE_URL ?? ""
    let urlHost = "not set"
    try { urlHost = url ? new URL(url).hostname : "not set" } catch { urlHost = "unparseable" }
    console.log("[DB CHECK]", {
      hasDatabaseUrl: Boolean(url),
      urlHost,
      urlLooksPlaceholder: Boolean(
        url.includes("user:password") ||
        url.includes("[PASSWORD]") ||
        url.includes("YOUR_PASSWORD") ||
        url.includes("replace_with")
      ),
    })
  }

  // 1. Fetch user from DB
  let user: FullUser | null
  try {
    user = await fetchUser(clerkId)
  } catch (err) {
    if (isConnectionError(err)) {
      const msg = (err as Record<string, unknown>)?.message ?? "Unknown connection error"
      console.error("[dashboard] DB connection error:", msg)
      return { status: "db_unavailable", error: String(msg) }
    }
    console.error("[dashboard] Unexpected DB error:", err)
    return {
      status: "db_unavailable",
      error: `Database error: ${(err as Record<string, unknown>)?.message ?? String(err)}`,
    }
  }

  // 2. User record doesn't exist yet (lite-mode onboarding or missed webhook)
  //    Auto-create a minimal record and redirect to onboarding to complete it properly.
  if (!user) {
    try {
      const clerkUser = await currentUser()
      if (!clerkUser) return { status: "not_found" }

      const rawEmail = clerkUser.emailAddresses[0]?.emailAddress
      if (!rawEmail) return { status: "not_found" }
      const email = rawEmail.toLowerCase().trim()

      const adminEmails = (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)

      await db.user.upsert({
        where: { clerkId },
        create: {
          clerkId,
          email,
          role: adminEmails.includes(email) ? "ADMIN" : "USER",
          onboardingStep: "WELCOME",
          onboardingComplete: false,
        },
        update: {},
      })

      console.log(`[dashboard] Auto-created user record for ${email}`)
      // New users always start at WELCOME
      return { status: "onboarding_incomplete", step: "WELCOME" }
    } catch (err) {
      console.error("[dashboard] Failed to auto-create user:", err)
      return { status: "not_found" }
    }
  }

  // 2b. Role self-correction: if the user exists as USER but their email is now in
  //     ADMIN_EMAILS, promote them immediately. This handles the case where an admin
  //     signed up before being added to the env list, or where a missed webhook
  //     created the user with the wrong role.
  if (user.role === "USER") {
    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)

    if (adminEmails.includes(user.email.toLowerCase().trim())) {
      try {
        await db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } })
        // Reflect the corrected role in the local object so downstream checks work
        ;(user as any).role = "ADMIN"
        console.log(`[dashboard] Role auto-corrected to ADMIN for ${user.email}`)
      } catch (err) {
        console.error("[dashboard] Role correction failed:", err)
      }
    }
  }

  // 3. Check onboarding completeness.
  //    ADMIN and FOUNDER accounts bypass this — they need immediate access to /admin
  //    regardless of whether they completed the member onboarding flow.
  const isAdmin = (user as any).role === "ADMIN" || (user as any).role === "FOUNDER"
  if (!user.onboardingComplete && !isAdmin) {
    return { status: "onboarding_incomplete", step: user.onboardingStep }
  }

  // 4. Fetch psychProfile (new model — not in generated Prisma client yet)
  let psychProfile: PsychProfileData = null
  try {
    psychProfile = await (db as any).psychProfile.findUnique({ where: { userId: user.id } })
  } catch {
    // Model may not exist in DB yet — non-fatal
  }

  return { status: "ok", user, psychProfile }
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const { userId: clerkId } = await auth()
  if (!clerkId) redirect("/sign-in")

  const result = await getDashboardData(clerkId)

  // DB genuinely unavailable
  if (result.status === "db_unavailable") {
    return <DbErrorPrompt message={result.error} />
  }

  // No user and couldn't create one
  if (result.status === "not_found") {
    redirect("/sign-in")
  }

  // Onboarding incomplete — send to the right step
  if (result.status === "onboarding_incomplete") {
    const stepRoutes: Record<string, string> = {
      WELCOME: "/onboarding/welcome",
      ASSESSMENT: "/onboarding/assessment",
      REVEAL: "/onboarding/reveal",
      PROFILE: "/onboarding/profile",
    }
    const destination = stepRoutes[result.step] ?? "/onboarding/welcome"
    redirect(destination)
  }

  const { user, psychProfile } = result
  const activeMembership = user.memberships[0]
  const cohort = activeMembership?.cohort ?? null
  const subscription = user.subscription
  const weekAccessLevel = activeMembership?.weekAccessLevel ?? 1
  const hasActiveSubscription = subscription?.status === "ACTIVE"
  const isWeek2Plus = weekAccessLevel >= 2

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="neon-panel p-6 md:p-8">
        <div className="neon-chip mb-5">Live cohort space</div>
        <h1 className="font-display text-3xl font-bold text-brand-text md:text-4xl">
          {getGreeting()}, {user.profile?.firstName || "friend"}.
        </h1>
        <p className="mt-2 text-sm text-brand-text-muted">
          {cohort ? `${cohort.name} · Week ${cohort.currentWeek}` : "You're in the queue."}
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <StatCard
            icon={<UsersRound className="h-4 w-4" />}
            iconBg="bg-brand-primary/10 text-brand-primary"
            label="Cohort"
            value={cohort ? cohort.name : "Matching"}
          />
          <StatCard
            icon={<CalendarDays className="h-4 w-4" />}
            iconBg="bg-brand-accent/10 text-brand-accent"
            label="Week"
            value={cohort ? `Week ${cohort.currentWeek} of 4` : "—"}
          />
          <StatCard
            icon={<CreditCard className="h-4 w-4" />}
            iconBg="bg-brand-secondary/10 text-brand-secondary"
            label="Billing"
            value={subscription?.status === "ACTIVE" ? "Subscribed" : "Week 1 trial"}
          />
        </div>
      </div>

      {/* Main content */}
      {!cohort ? (
        <PendingCohortState
          driveProfile={user.driveProfile}
          psychProfile={psychProfile}
          firstName={user.profile?.firstName ?? undefined}
          joinedAt={user.createdAt}
        />
      ) : cohort.currentWeek >= 2 && !hasActiveSubscription && !isWeek2Plus ? (
        <>
          <CohortView
            cohort={cohort}
            currentUserId={user.id}
            membershipStatus={activeMembership.status}
            weekAccessLevel={1}
            subscription={subscription}
          />
          <UpgradePrompt cohortId={cohort.id} />
        </>
      ) : (
        <CohortView
          cohort={cohort}
          currentUserId={user.id}
          membershipStatus={activeMembership.status}
          weekAccessLevel={weekAccessLevel}
          subscription={subscription}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────

function StatCard({
  icon,
  iconBg,
  label,
  value,
}: {
  icon: React.ReactNode
  iconBg: string
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-brand-border/80 bg-brand-bg/50 px-4 py-3">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-brand-text-subtle">
          {label}
        </p>
        <p className="text-sm font-semibold text-brand-text truncate">{value}</p>
      </div>
    </div>
  )
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

// DbErrorPrompt is a client component — see components/dashboard/DbErrorPrompt.tsx
