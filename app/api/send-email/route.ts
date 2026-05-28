import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { Resend } from "resend"
import { z } from "zod"

const resend = new Resend(process.env.RESEND_API_KEY)

const emailSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  subject: z.string().min(1).max(200),
  html: z.string().min(1),
  replyTo: z.string().email().optional(),
})

/**
 * POST /api/send-email
 * Authenticated transactional email via Resend.
 * Body: { to, subject, html, replyTo? }
 */
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!process.env.RESEND_API_KEY) {
    console.error("[send-email] RESEND_API_KEY is not set")
    return NextResponse.json({ error: "Email service is not configured" }, { status: 503 })
  }

  let parsed: z.infer<typeof emailSchema>
  try {
    const body = await req.json()
    parsed = emailSchema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const fromEmail = process.env.FROM_EMAIL || "onboarding@resend.dev"
  const toAddresses = Array.isArray(parsed.to) ? parsed.to : [parsed.to]

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: toAddresses,
      subject: parsed.subject,
      html: parsed.html,
      ...(parsed.replyTo ? { replyTo: parsed.replyTo } : {}),
    })

    if (error) {
      console.error("[send-email] Resend error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data?.id })
  } catch (error: any) {
    console.error("[send-email] Unexpected error:", error)
    return NextResponse.json({ error: "Failed to send email. Please try again." }, { status: 500 })
  }
}
