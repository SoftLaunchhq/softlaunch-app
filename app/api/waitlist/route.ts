import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// ─────────────────────────────────────────────────────────────
// POST /api/waitlist
// Body: { email: string, city?: string }
// ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)

    if (!body || typeof body.email !== "string") {
      return NextResponse.json(
        { error: "A valid email is required." },
        { status: 400 }
      )
    }

    const email = body.email.trim().toLowerCase()

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      )
    }

    const city = typeof body.city === "string" ? body.city.trim() || null : null

    // Detect referral source from request headers
    const referer = req.headers.get("referer") || ""
    const source = referer.includes("instagram")
      ? "instagram"
      : referer.includes("twitter") || referer.includes("x.com")
      ? "twitter"
      : "landing_page"

    console.log(`[waitlist] New signup: ${email} city=${city ?? "—"} source=${source}`)

    // ── 1. Save to database ──────────────────────────────────
    let isNewSignup = true
    try {
      const result = await db.waitlist.upsert({
        where:  { email },
        create: { email, city, source },
        update: { ...(city ? { city } : {}) },
      })
      // If createdAt is within the last 2 seconds it's a new entry; otherwise a duplicate re-submit
      // (Waitlist model has no updatedAt — we check createdAt recency instead)
      isNewSignup = Date.now() - result.createdAt.getTime() < 2000
      console.log(`[waitlist] ✓ Saved to DB: ${email} (new=${isNewSignup})`)
    } catch (dbErr: any) {
      const msg = String(dbErr?.message ?? "")
      const isConnErr =
        msg.includes("ECONNREFUSED") ||
        msg.includes("connect timeout") ||
        msg.includes("Can't reach database") ||
        msg.includes("P1001")

      if (isConnErr) {
        console.warn("[waitlist] DB unreachable — continuing without save (dev mode)")
        if (process.env.NODE_ENV !== "production") {
          // In dev without a live DB, still fire the emails so flow is testable
          await Promise.all([
            sendUserConfirmation(email),
            sendFounderNotification(email, city, source),
          ])
          return NextResponse.json(
            { success: true, message: "You're on the list — we'll be in touch." },
            { status: 200 }
          )
        }
        return NextResponse.json(
          { error: "Our systems are having a moment. Please try again shortly." },
          { status: 503 }
        )
      }
      throw dbErr // re-throw unexpected DB errors
    }

    // ── 2. Send emails (non-blocking — never fail the request over email) ──
    await Promise.all([
      sendUserConfirmation(email),
      // Only notify founders on genuinely new signups, not duplicate re-submits
      isNewSignup ? sendFounderNotification(email, city, source) : Promise.resolve(),
    ])

    return NextResponse.json(
      { success: true, message: "You're on the list — we'll be in touch." },
      { status: 200 }
    )
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred."
    console.error("[waitlist] Unexpected error:", message)
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    )
  }
}

// ─────────────────────────────────────────────────────────────
// RESEND HELPER — shared setup
// ─────────────────────────────────────────────────────────────

async function getResend() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn("[waitlist:email] RESEND_API_KEY not set — skipping email")
    return null
  }
  const { Resend } = await import("resend")
  return new Resend(apiKey)
}

function getSender(): string {
  // Use FROM_EMAIL if set; fall back to Resend's shared test sender.
  // ⚠️  DOMAIN NOTE: To send FROM Founders@softlaunchhq.com or any custom
  // address, you must first verify the domain softlaunchhq.com at
  // https://resend.com/domains.  Until then, keep FROM_EMAIL=onboarding@resend.dev
  // (Resend's test sender) — but note that in test mode Resend only delivers
  // to the email address registered on your Resend account.
  return process.env.FROM_EMAIL || "onboarding@resend.dev"
}

// ─────────────────────────────────────────────────────────────
// EMAIL 1 — Confirmation to the person who just signed up
// ─────────────────────────────────────────────────────────────

async function sendUserConfirmation(toEmail: string): Promise<void> {
  const resend   = await getResend()
  const fromAddr = getSender()
  if (!resend) return

  console.log(`[waitlist:email] Sending confirmation → ${toEmail}`)

  try {
    const { data, error } = await resend.emails.send({
      from:    fromAddr,
      to:      [toEmail],
      subject: "You're on the SoftLaunch waitlist 🎉",
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're on the SoftLaunch waitlist</title>
</head>
<body style="margin:0;padding:0;background:#FAF9F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF9F6;padding:40px 16px;">
    <tr>
      <td>
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid rgba(0,0,0,0.07);overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid rgba(0,0,0,0.06);">
              <p style="margin:0;font-size:20px;font-weight:700;color:#111827;letter-spacing:-0.3px;">SoftLaunch</p>
              <p style="margin:4px 0 0;font-size:12px;color:#9CA3AF;">Your people are waiting.</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#111827;line-height:1.3;">
                You're on the waitlist. ✓
              </h1>
              <p style="margin:0 0 20px;font-size:15px;color:#4B5563;line-height:1.6;">
                We've got your spot. We review applications personally and reach out in batches — so you'll hear from us when your cohort is being formed.
              </p>
              <p style="margin:0 0 20px;font-size:15px;color:#4B5563;line-height:1.6;">
                In the meantime, SoftLaunch is for people who are building something and want to be surrounded by others doing the same. If that's you — you're exactly who we built this for.
              </p>
              <p style="margin:0 0 32px;font-size:15px;color:#4B5563;line-height:1.6;">
                — The SoftLaunch team
              </p>
              <a
                href="https://softlaunchhq.com"
                style="display:inline-block;background:#1DB896;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;letter-spacing:-0.1px;"
              >
                Learn more about SoftLaunch →
              </a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid rgba(0,0,0,0.06);">
              <p style="margin:0;font-size:11px;color:#9CA3AF;line-height:1.5;">
                You're receiving this because you signed up at softlaunchhq.com.
                We respect your inbox — expect to hear from us only when it matters.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim(),
    })

    if (error) {
      logResendError(error, toEmail, "confirmation", fromAddr)
    } else {
      console.log(`[waitlist:email] ✓ Confirmation sent → ${toEmail} (id: ${data?.id})`)
    }
  } catch (err: any) {
    console.error("[waitlist:email] sendUserConfirmation threw:", err?.message)
  }
}

// ─────────────────────────────────────────────────────────────
// EMAIL 2 — Internal notification to founders
// ─────────────────────────────────────────────────────────────

async function sendFounderNotification(
  signupEmail: string,
  city: string | null,
  source: string
): Promise<void> {
  const founderEmail = process.env.FOUNDER_EMAIL
  if (!founderEmail) {
    console.warn("[waitlist:email] FOUNDER_EMAIL not set — skipping founder notification")
    return
  }

  const resend   = await getResend()
  const fromAddr = getSender()
  if (!resend) return

  const now = new Date().toLocaleString("en-US", {
    timeZone:    "America/New_York",
    dateStyle:   "medium",
    timeStyle:   "short",
  })

  console.log(`[waitlist:email] Sending founder notification → ${founderEmail}`)

  try {
    const { data, error } = await resend.emails.send({
      from:    fromAddr,
      to:      [founderEmail],
      subject: `🚀 New waitlist signup: ${signupEmail}`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New SoftLaunch Waitlist Signup</title>
</head>
<body style="margin:0;padding:0;background:#FAF9F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF9F6;padding:40px 16px;">
    <tr>
      <td>
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid rgba(0,0,0,0.07);overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:24px 32px;background:#111827;border-radius:16px 16px 0 0;">
              <p style="margin:0;font-size:13px;font-weight:600;color:#1DB896;letter-spacing:0.5px;text-transform:uppercase;">SoftLaunch</p>
              <p style="margin:6px 0 0;font-size:20px;font-weight:700;color:#ffffff;line-height:1.3;">
                🚀 New waitlist signup
              </p>
            </td>
          </tr>
          <!-- Details -->
          <tr>
            <td style="padding:28px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #F3F4F6;">
                    <p style="margin:0;font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;">Email</p>
                    <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#111827;">${signupEmail}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #F3F4F6;">
                    <p style="margin:0;font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;">City</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#374151;">${city ?? "Not provided"}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #F3F4F6;">
                    <p style="margin:0;font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;">Source</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#374151;">${source}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;">
                    <p style="margin:0;font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;">Signed up</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#374151;">${now} ET</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 28px;">
              <a
                href="${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/admin"
                style="display:inline-block;background:#1DB896;color:#fff;text-decoration:none;padding:11px 22px;border-radius:10px;font-size:13px;font-weight:600;"
              >
                View in admin panel →
              </a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #F3F4F6;">
              <p style="margin:0;font-size:11px;color:#9CA3AF;">
                This is an automated notification from SoftLaunch.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim(),
    })

    if (error) {
      logResendError(error, founderEmail, "founder notification", fromAddr)
    } else {
      console.log(`[waitlist:email] ✓ Founder notification sent → ${founderEmail} (id: ${data?.id})`)
    }
  } catch (err: any) {
    console.error("[waitlist:email] sendFounderNotification threw:", err?.message)
  }
}

// ─────────────────────────────────────────────────────────────
// SHARED — Log Resend errors with useful context
// ─────────────────────────────────────────────────────────────

function logResendError(
  error: { message?: string; name?: string },
  recipient: string,
  kind: string,
  fromAddr: string
): void {
  const msg  = error.message?.toLowerCase() ?? ""
  const isDev = process.env.NODE_ENV !== "production"

  const isTestModeRestriction =
    msg.includes("testing") ||
    msg.includes("verify") ||
    msg.includes("domain") ||
    msg.includes("can only send") ||
    error.name === "validation_error"

  if (isTestModeRestriction && isDev) {
    console.warn(
      `[waitlist:email] Resend restriction on ${kind} to ${recipient}.\n` +
      `  FROM: ${fromAddr}\n` +
      `  Likely cause: domain not verified in Resend OR test-mode restriction\n` +
      `  Fix: verify softlaunchhq.com at https://resend.com/domains, then set\n` +
      `       FROM_EMAIL=Founders@softlaunchhq.com in .env.local\n` +
      `  The waitlist entry WAS saved to the database.`
    )
  } else {
    console.error(`[waitlist:email] Resend error on ${kind} to ${recipient}:`, error.message)
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/waitlist — Admin: return count + recent entries
// Protected by x-admin-key header
// ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const adminKey = req.headers.get("x-admin-key")
    if (!adminKey || adminKey !== process.env.ADMIN_SECRET_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const count  = await db.waitlist.count()
    const recent = await db.waitlist.findMany({
      orderBy: { createdAt: "desc" },
      take:    10,
      select:  { email: true, city: true, source: true, createdAt: true },
    })

    return NextResponse.json({ count, recent })
  } catch (error) {
    console.error("[waitlist:GET] Error:", error)
    return NextResponse.json({ error: "Failed to fetch waitlist." }, { status: 500 })
  }
}
