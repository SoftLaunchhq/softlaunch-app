import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { PendingCohortState } from "@/components/dashboard/PendingCohortState"
import { CohortView } from "@/components/dashboard/CohortView"
import { UpgradePrompt } from "@/components/dashboard/UpgradePrompt"
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
  const msg: string = (e.message as string) ?? ""
  return (
    msg.includes("ECONNREFUSED") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("connect timeout") ||
    msg.includes("postgresql://user:password") ||
    msg.includes("Can't reach database server") ||
    msg.includes("Environment variable not found: DATABASE_URL") ||
    msg.includes("Authentication failed against database server") ||
    msg.includes("password authentication failed") ||
    (msg.includes("credentials") && msg.includes("not valid"))
  )
}

async function getDashboardData(clerkId: string): Promise<DashboardResult> {
  // ── Safe dev-only log — shows config state without exposing secrets ──
  if (process.env.NODE_ENV === "development") {
    const url = process.env.DATABASE_URL
    console.log("[DB CHECK]", {
      hasDatabaseUrl: Boolean(url),
      hasDirectUrl:   Boolean(process.env.DIRECT_URL),
      urlLooksPlaceholder: Boolean(
        url?.includes("user:password") ||
        url?.includes("[PASSWORD]") ||
        url?.includes("YOUR_PASSWORD")
      ),
      urlHost: url
        ? (() => { try { return new URL(url).hostname } catch { return "unparseable" } })()
        : null,
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

/** Shown only for genuine DB connectivity or auth failures */
function DbErrorPrompt({ message }: { message: string }) {
  // ── ONLY flag placeholder when the URL itself contains placeholder text ──
  // Never confuse "server unreachable" with "env var not configured" — they
  // are completely different problems and get different fix instructions.
  const isPlaceholder =
    message.includes("postgresql://user:password") ||
    message.includes("[PASSWORD]") ||
    message.includes("YOUR_PASSWORD") ||
    message.includes("Environment variable not found: DATABASE_URL")

  const isAuthFailure =
    message.includes("Authentication failed") ||
    message.includes("password authentication failed") ||
    (message.includes("credentials") && message.includes("not valid"))

  // Server is healthy but we can't reach it — almost always means the
  // Supabase free-tier project is paused (pauses after ~1 week of inactivity).
  const isUnreachable =
    !isPlaceholder &&
    !isAuthFailure &&
    (message.includes("Can't reach database server") ||
      message.includes("ECONNREFUSED") ||
      message.includes("ETIMEDOUT") ||
      message.includes("connect timeout"))

  const title = isPlaceholder
    ? "Database not connected"
    : isAuthFailure
    ? "Wrong database password"
    : isUnreachable
    ? "Database server unreachable"
    : "Database error"

  const subtitle = isPlaceholder
    ? "DATABASE_URL is missing or still contains placeholder values in .env.local."
    : isAuthFailure
    ? "The database is reachable but rejected the credentials. The password in DATABASE_URL is incorrect."
    : isUnreachable
    ? "Your Supabase project is not responding. If you're on the free tier, it may be paused."
    : "The database returned an unexpected error."

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="neon-panel max-w-lg p-8">
        <div className="mb-4 text-4xl">
          {isAuthFailure ? "🔑" : isUnreachable ? "💤" : "🗄️"}
        </div>
        <h2 className="font-display mb-3 text-2xl font-bold text-brand-text">{title}</h2>
        <p className="mb-4 text-sm leading-relaxed text-brand-text-muted">{subtitle}</p>

        {/* ── Placeholder env fix ── */}
        {isPlaceholder && (
          <div className="rounded-xl border border-brand-border bg-brand-bg/60 p-4 text-left text-sm">
            <p className="mb-2 font-semibold text-brand-text-subtle uppercase tracking-wider text-xs">
              Fix in .env.local
            </p>
            <ol className="space-y-1.5 text-brand-text-muted">
              <li>1. Open <strong className="text-cyan-300">Supabase Dashboard → Settings → Database</strong></li>
              <li>2. Copy the <em>Session mode</em> connection string (port 5432)</li>
              <li>3. Paste as both <code className="rounded bg-brand-surface px-1 text-cyan-200">DATABASE_URL</code> and <code className="rounded bg-brand-surface px-1 text-cyan-200">DIRECT_URL</code></li>
              <li>4. Restart: <code className="rounded bg-brand-surface px-1 text-cyan-200">npm run dev</code></li>
            </ol>
          </div>
        )}

        {/* ── Auth failure fix ── */}
        {isAuthFailure && (
          <div className="rounded-xl border border-brand-border bg-brand-bg/60 p-4 text-left text-sm">
            <p className="mb-2 font-semibold text-brand-text-subtle uppercase tracking-wider text-xs">
              Fix in .env.local
            </p>
            <ol className="space-y-1.5 text-brand-text-muted">
              <li>1. Open <strong className="text-cyan-300">Supabase Dashboard → Settings → Database</strong></li>
              <li>2. Reset or verify your database password</li>
              <li>3. Copy the full connection string — Supabase pre-encodes special characters</li>
              <li>4. Update <code className="rounded bg-brand-surface px-1 text-cyan-200">DATABASE_URL</code> and <code className="rounded bg-brand-surface px-1 text-cyan-200">DIRECT_URL</code></li>
              <li>5. Restart: <code className="rounded bg-brand-surface px-1 text-cyan-200">npm run dev</code></li>
            </ol>
            <p className="mt-3 text-xs text-amber-300/80">
              ⚠ If your password contains special characters (#, @, !, etc.), always copy the string
              directly from Supabase — it pre-encodes the password for you.
            </p>
          </div>
        )}

        {/* ── Server unreachable — most likely Supabase paused ── */}
        {isUnreachable && (
          <div className="rounded-xl border border-brand-border bg-brand-bg/60 p-4 text-left text-sm">
            <p className="mb-2 font-semibold text-brand-text-subtle uppercase tracking-wider text-xs">
              How to fix
            </p>
            <ol className="space-y-1.5 text-brand-text-muted">
              <li>1. Go to <strong className="text-cyan-300">supabase.com/dashboard</strong></li>
              <li>2. Open your project — if it says <strong className="text-cyan-300">Paused</strong>, click <strong className="text-cyan-300">Restore project</strong></li>
              <li>3. Wait ~30 seconds for it to spin up</li>
              <li>4. Refresh this page</li>
            </ol>
            <p className="mt-3 text-xs text-amber-300/80">
              ⚠ Free-tier Supabase projects pause automatically after ~1 week of inactivity.
              Your DATABASE_URL is fine — the server just needs to wake up.
            </p>
          </div>
        )}

        {/* ── Unknown error — show raw message ── */}
        {!isPlaceholder && !isAuthFailure && !isUnreachable && (
          <div className="rounded-xl border border-brand-error/30 bg-brand-error/10 p-4 text-left">
            <p className="text-xs font-mono text-brand-error break-all">{message}</p>
          </div>
        )}
      </div>
    </div>
  )
}
