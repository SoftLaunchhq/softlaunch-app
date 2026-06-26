"use client"

// ─────────────────────────────────────────────────────────────
// components/dashboard/DbErrorPrompt.tsx
// Shown when the dashboard can't reach the database.
// Classifies the error type and shows appropriate guidance.
// NEVER exposes raw error messages to users in production.
// ─────────────────────────────────────────────────────────────

interface Props {
  message: string
}

export function DbErrorPrompt({ message }: Props) {
  // ── Classify the error type ────────────────────────────────
  const isPlaceholder =
    message.includes("postgresql://user:password") ||
    message.includes("[PASSWORD]") ||
    message.includes("YOUR_PASSWORD") ||
    message.includes("replace_with_real_value") ||
    message.includes("Environment variable not found: DATABASE_URL")

  const isAuthFailure =
    (message.includes("Authentication failed") ||
      message.includes("password authentication failed") ||
      (message.includes("credentials") && message.includes("not valid"))) &&
    !message.includes("Tenant or user not found")

  // "Tenant or user not found" — Supabase pgbouncer/pooler error.
  // Returned when the project is PAUSED or the pool tenant doesn't exist.
  const isSupabasePaused =
    message.includes("Tenant or user not found") ||
    message.includes("tenant_not_found")

  const isPoolExhausted =
    message.includes("Max client connections reached") ||
    message.includes("remaining connection slots are reserved")

  const isUnreachable =
    !isPlaceholder &&
    !isAuthFailure &&
    !isSupabasePaused &&
    !isPoolExhausted &&
    (message.includes("Can't reach database server") ||
      message.includes("ECONNREFUSED") ||
      message.includes("ETIMEDOUT") ||
      message.includes("connect timeout") ||
      message.includes("SSL connection error") ||
      message.includes("FATAL:"))

  // ── Classify → display ─────────────────────────────────────
  const { emoji, title, subtitle } = isPlaceholder
    ? {
        emoji: "🔌",
        title: "Database not configured",
        subtitle:
          "DATABASE_URL is missing or still contains a placeholder. Check your environment variables.",
      }
    : isAuthFailure
    ? {
        emoji: "🔑",
        title: "Wrong database credentials",
        subtitle:
          "The database rejected the connection credentials. Verify your Supabase password and update DATABASE_URL.",
      }
    : isSupabasePaused
    ? {
        emoji: "💤",
        title: "Database temporarily offline",
        subtitle:
          "Your Supabase project appears to be paused. Free-tier projects sleep after ~1 week of inactivity. Restore it from your Supabase dashboard — this page will work again in about 30 seconds.",
      }
    : isPoolExhausted
    ? {
        emoji: "⏳",
        title: "Database at capacity",
        subtitle:
          "Too many concurrent connections right now. This resolves automatically — please try again in 30 seconds.",
      }
    : isUnreachable
    ? {
        emoji: "💤",
        title: "Database server unreachable",
        subtitle:
          "Your Supabase project is not responding. It may be paused or temporarily unavailable. Please try again in a moment.",
      }
    : {
        emoji: "🛠",
        title: "SoftLaunch is syncing",
        subtitle:
          "We're having a momentary issue connecting to your profile. Please refresh in a moment.",
      }

  // In production, never show the raw error message to end users.
  // In development, show full diagnostic details.
  const isDev = process.env.NODE_ENV === "development"

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="rounded-2xl border border-brand-border bg-brand-surface max-w-lg w-full p-8">
        <div className="mb-4 text-4xl">{emoji}</div>
        <h2 className="font-display mb-3 text-2xl font-bold text-brand-text">{title}</h2>
        <p className="mb-6 text-sm leading-relaxed text-brand-text-muted max-w-sm mx-auto">
          {subtitle}
        </p>

        {/* ── Retry button ── */}
        <button
          onClick={() => window.location.reload()}
          className="sl-button px-6 py-2.5 text-sm"
        >
          Try again
        </button>

        {/* ── Dev-only diagnostic section ── */}
        {isDev && (
          <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-left">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-amber-400">
              Dev diagnostic (not shown in production)
            </p>

            {isPlaceholder && (
              <ol className="space-y-1.5 text-xs text-brand-text-muted list-none">
                <li>1. Open <strong className="text-amber-300">Supabase → Settings → Database</strong></li>
                <li>2. Copy the Transaction pooler string (port 6543)</li>
                <li>3. Set as <code className="rounded bg-brand-surface px-1 text-amber-200">DATABASE_URL</code> in .env.local</li>
                <li>4. Restart: <code className="rounded bg-brand-surface px-1 text-amber-200">npm run dev</code></li>
              </ol>
            )}

            {isAuthFailure && (
              <ol className="space-y-1.5 text-xs text-brand-text-muted list-none">
                <li>1. Open <strong className="text-amber-300">Supabase → Settings → Database</strong></li>
                <li>2. Reset your database password</li>
                <li>3. Copy the full connection string (password is pre-encoded)</li>
                <li>4. Update <code className="rounded bg-brand-surface px-1 text-amber-200">DATABASE_URL</code> in .env.local</li>
                <li>5. Restart dev server</li>
              </ol>
            )}

            {(isSupabasePaused || isUnreachable) && (
              <ol className="space-y-1.5 text-xs text-brand-text-muted list-none">
                <li>1. Go to <strong className="text-amber-300">supabase.com/dashboard</strong></li>
                <li>2. If project shows Paused → click <strong className="text-amber-300">Restore project</strong></li>
                <li>3. Wait ~30 seconds, then refresh</li>
                <li>4. In Netlify: confirm DATABASE_URL is set under Site settings → Environment variables</li>
              </ol>
            )}

            <div className="mt-3 rounded bg-brand-bg p-2 text-[10px] font-mono text-brand-text-subtle break-all leading-relaxed">
              {message}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
