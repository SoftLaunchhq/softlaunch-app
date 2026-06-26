import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { createBillingPortalSession } from "@/lib/stripe"
import { formatCurrency, formatDate } from "@/lib/utils"
import { CreditCard, ExternalLink, Check, AlertCircle, ArrowRight } from "lucide-react"
import Link from "next/link"

export default async function BillingPage() {
  const { userId: clerkId } = await auth()
  if (!clerkId) redirect("/sign-in")

  // Graceful DB error handling
  let user: Awaited<ReturnType<typeof fetchUser>> | null = null
  try {
    user = await fetchUser(clerkId)
  } catch {
    return <BillingError />
  }

  if (!user) redirect("/sign-in")

  const sub = user.subscription
  const isActive = sub?.status === "ACTIVE"
  const isPastDue = sub?.status === "PAST_DUE"

  let portalUrl: string | null = null
  if (sub?.stripeCustomerId) {
    try {
      portalUrl = await createBillingPortalSession({
        stripeCustomerId: sub.stripeCustomerId,
        returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
      })
    } catch {
      // Portal URL generation failed — show manual contact instead
    }
  }

  return (
    <div className="max-w-2xl space-y-6 py-6 md:py-8">

      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-text">Billing</h1>
        <p className="text-sm text-brand-text-muted mt-0.5">
          Manage your SoftLaunch subscription.
        </p>
      </div>

      {/* Subscription status */}
      <div className="sl-panel p-6">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isActive ? "bg-brand-success/15" : "bg-brand-surface"
              }`}
            >
              <CreditCard
                className={`w-5 h-5 ${isActive ? "text-brand-success" : "text-brand-text-muted"}`}
              />
            </div>
            <div>
              <p className="font-semibold text-brand-text">
                {isActive
                  ? "Active subscription"
                  : isPastDue
                  ? "Payment past due"
                  : "Free tier"}
              </p>
              <p className="text-xs text-brand-text-subtle mt-0.5">
                {isActive && sub?.amount
                  ? `${formatCurrency(sub.amount)}/month`
                  : "Week 1 access. Upgrade to continue."}
              </p>
            </div>
          </div>

          <span
            className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              isActive
                ? "bg-emerald-500/10 text-brand-success border border-emerald-500/20"
                : isPastDue
                ? "bg-amber-500/10 text-brand-warning border border-amber-500/20"
                : "bg-brand-border/50 text-brand-text-muted border border-brand-border"
            }`}
          >
            {sub?.status ?? "FREE"}
          </span>
        </div>

        {isActive && sub?.currentPeriodEnd && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-brand-bg border border-brand-border mb-4">
            <Check className="w-4 h-4 text-brand-success flex-shrink-0" />
            <p className="text-sm text-brand-text-muted">
              {sub.cancelAtPeriodEnd
                ? `Cancels on ${formatDate(sub.currentPeriodEnd)}`
                : `Renews on ${formatDate(sub.currentPeriodEnd)}`}
            </p>
          </div>
        )}

        {isPastDue && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-4">
            <AlertCircle className="w-4 h-4 text-brand-warning flex-shrink-0" />
            <p className="text-sm text-brand-warning">
              Your last payment failed. Update your payment method to continue.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2.5 mt-4">
          {portalUrl ? (
            <a
              href={portalUrl}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-brand-border text-sm font-medium text-brand-text hover:border-brand-primary/30 hover:text-brand-primary transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              Manage subscription in Stripe
            </a>
          ) : (
            <p className="text-xs text-brand-text-subtle text-center py-2">
              To manage your subscription, contact{" "}
              <a
                href="mailto:hello@softlaunchhq.com"
                className="text-brand-primary hover:underline"
              >
                hello@softlaunchhq.com
              </a>
            </p>
          )}

          {!isActive && !isPastDue && (
            <Link
              href="/api/billing/checkout"
              className="sl-button justify-center py-2.5 text-sm"
            >
              Upgrade to Weeks 2–4
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Pricing reminder */}
      {!isActive && (
        <div className="sl-panel p-5 flex items-start gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #1DB896, #7CC455)" }}
          >
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-brand-text mb-1">SoftLaunch Pro · $29/month</p>
            <p className="text-sm text-brand-text-muted leading-relaxed">
              Full cohort access, weekly matched prompts, BUZZ AI thought partner, and everything we add next.
              Cancel anytime. No questions asked.
            </p>
          </div>
        </div>
      )}

      {/* Payment history */}
      {user.payments.length > 0 && (
        <div className="sl-panel p-6">
          <h2 className="font-semibold text-brand-text mb-4">Payment history</h2>
          <div className="space-y-2">
            {user.payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between py-3 border-b border-brand-border last:border-0"
              >
                <div>
                  <p className="text-sm text-brand-text">
                    {payment.description || "SoftLaunch subscription"}
                  </p>
                  <p className="text-xs text-brand-text-subtle mt-0.5">
                    {formatDate(payment.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-brand-text">
                    {formatCurrency(payment.amount)}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      payment.status === "succeeded"
                        ? "bg-emerald-500/10 text-brand-success"
                        : "bg-brand-error/10 text-brand-error"
                    }`}
                  >
                    {payment.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

async function fetchUser(clerkId: string) {
  return db.user.findUnique({
    where: { clerkId },
    include: {
      subscription: true,
      payments: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  })
}

function BillingError() {
  return (
    <div className="max-w-2xl py-8">
      <div className="sl-panel p-8 text-center">
        <CreditCard className="w-8 h-8 text-brand-text-subtle mx-auto mb-3" />
        <h2 className="font-semibold text-brand-text mb-1">Billing unavailable</h2>
        <p className="text-sm text-brand-text-muted">
          Could not load billing info right now. Please try again in a moment.
        </p>
      </div>
    </div>
  )
}
