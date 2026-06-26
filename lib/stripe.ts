import Stripe from "stripe"

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set in .env.local")
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
  typescript: true,
})

/**
 * Get the Stripe price ID from env.
 * STRIPE_PRICE_ID_30 must be a price ID (starts with price_), not a product ID (prod_).
 * Get it from: Stripe Dashboard → Products → SoftLaunch Pro → Pricing → copy the price ID.
 */
function getStripePriceId(): string {
  const priceId = process.env.STRIPE_PRICE_ID_30

  if (!priceId) {
    throw new Error(
      "STRIPE_PRICE_ID_30 is not set in .env.local. " +
      "Get it from Stripe Dashboard → Products → your product → copy the Price ID (starts with price_)"
    )
  }

  // Guard against the common mistake of pasting the product ID instead of price ID
  if (priceId.startsWith("prod_")) {
    throw new Error(
      `STRIPE_PRICE_ID_30 is set to a product ID (${priceId}). ` +
      "You need the PRICE ID, not the product ID. " +
      "Go to Stripe Dashboard → Products → SoftLaunch Pro → click the price → copy the ID starting with price_"
    )
  }

  return priceId
}

/**
 * Create or retrieve a Stripe customer for a user.
 */
export async function getOrCreateStripeCustomer({
  userId,
  email,
  name,
}: {
  userId: string
  email: string
  name: string
}): Promise<string> {
  const { db } = await import("./db")

  // Try to find existing customer ID
  try {
    const subscription = await db.subscription.findUnique({
      where: { userId },
      select: { stripeCustomerId: true },
    })

    if (subscription?.stripeCustomerId) {
      return subscription.stripeCustomerId
    }
  } catch {
    // DB unavailable — create customer without storing it
    // (it will be stored when the webhook fires after checkout)
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { userId },
  })

  // Store customer ID if DB is available
  try {
    const { db } = await import("./db")
    await db.subscription.upsert({
      where: { userId },
      create: {
        userId,
        stripeCustomerId: customer.id,
        status: "FREE",
      },
      update: {
        stripeCustomerId: customer.id,
      },
    })
  } catch {
    // DB unavailable — customer created in Stripe, webhook will sync later
  }

  return customer.id
}

/**
 * Create a Stripe Checkout session for the SoftLaunch Pro subscription.
 * Uses STRIPE_PRICE_ID_30 — must be a price_ ID, not a prod_ ID.
 */
export async function createCheckoutSession({
  userId,
  email,
  name,
  cohortId,
  returnUrl,
}: {
  userId: string
  email: string
  name: string
  cohortId?: string | null
  returnUrl: string
}): Promise<string> {
  const priceId = getStripePriceId()
  const customerId = await getOrCreateStripeCustomer({ userId, email, name })

  const metadata: Record<string, string> = { userId }
  if (cohortId) metadata.cohortId = cohortId

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    subscription_data: {
      metadata,
    },
    success_url: `${returnUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${returnUrl}?payment=canceled`,
    metadata,
    allow_promotion_codes: true,
  })

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL")
  }

  return session.url
}

/**
 * Create a Stripe Customer Portal session (for billing management / cancel).
 */
export async function createBillingPortalSession({
  stripeCustomerId,
  returnUrl,
}: {
  stripeCustomerId: string
  returnUrl: string
}): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  })
  return session.url
}

/**
 * Get current subscription status for a user.
 */
export async function getSubscriptionStatus(userId: string): Promise<{
  status: string
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
} | null> {
  try {
    const { db } = await import("./db")
    return await db.subscription.findUnique({
      where: { userId },
      select: { status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
    })
  } catch {
    return null
  }
}

/**
 * Check if a user has an active paid subscription.
 */
export async function hasActiveAccess(userId: string): Promise<boolean> {
  const sub = await getSubscriptionStatus(userId)
  return sub?.status === "ACTIVE"
}

/**
 * Handle incoming Stripe webhook events.
 * Called from /api/webhooks/stripe
 */
export async function handleStripeWebhook(event: Stripe.Event): Promise<void> {
  let db: any
  try {
    const dbModule = await import("./db")
    db = dbModule.db
  } catch {
    console.error("[stripe webhook] DB unavailable — cannot process event", event.type)
    return
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.userId
      if (!userId) {
        console.error("[stripe webhook] checkout.session.completed missing userId in metadata")
        break
      }

      const subId = session.subscription as string
      const sub = await stripe.subscriptions.retrieve(subId)

      await db.subscription.upsert({
        where: { userId },
        create: {
          userId,
          stripeCustomerId: session.customer as string,
          stripeSubId: subId,
          stripePriceId: sub.items.data[0].price.id,
          status: "ACTIVE",
          currentPeriodStart: new Date((sub as any).current_period_start * 1000),
          currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
          amount: sub.items.data[0].price.unit_amount ?? 0,
        },
        update: {
          stripeSubId: subId,
          stripePriceId: sub.items.data[0].price.id,
          status: "ACTIVE",
          currentPeriodStart: new Date((sub as any).current_period_start * 1000),
          currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
          amount: sub.items.data[0].price.unit_amount ?? 0,
        },
      })

      // Unlock all 4 weeks for the user's cohort
      const cohortId = session.metadata?.cohortId
      if (cohortId) {
        await db.cohortMembership.updateMany({
          where: { userId, cohortId },
          data: { weekAccessLevel: 4, status: "ACTIVE" },
        })
      }

      // Record payment
      await db.payment.create({
        data: {
          userId,
          stripePaymentId: session.payment_intent as string | null,
          amount: sub.items.data[0].price.unit_amount ?? 0,
          status: "succeeded",
          cohortId: cohortId ?? null,
          description: "SoftLaunch Pro subscription. Week 2 unlock.",
        },
      })

      console.log(`✅ Subscription activated for userId: ${userId}`)
      break
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string

      const sub = await db.subscription.findUnique({
        where: { stripeCustomerId: customerId },
      })
      if (!sub) break

      await db.subscription.update({
        where: { stripeCustomerId: customerId },
        data: { status: "PAST_DUE" },
      })

      await db.payment.create({
        data: {
          userId: sub.userId,
          stripeInvoiceId: invoice.id,
          amount: invoice.amount_due,
          status: "failed",
          description: "Failed subscription payment",
        },
      })
      break
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription
      await db.subscription.updateMany({
        where: { stripeSubId: subscription.id },
        data: { status: "CANCELED", canceledAt: new Date() },
      })
      break
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription
      await db.subscription.updateMany({
        where: { stripeSubId: subscription.id },
        data: {
          status: subscription.status === "active" ? "ACTIVE" : "PAST_DUE",
          currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
      })
      break
    }

    default:
      // Unhandled event type — safe to ignore
      break
  }
}
