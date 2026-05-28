# SoftLaunch

> Curated accountability cohorts for driven professionals in Charlotte, NC.

SoftLaunch matches ambitious people into tight-knit groups of 4, powered by AI-driven compatibility scoring and a 4-week structured program.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + custom design system |
| Auth | Clerk |
| Database | Supabase (PostgreSQL) |
| ORM | Prisma |
| AI | OpenAI (GPT-4o-mini) — BUZZ companion |
| Payments | Stripe |
| Email | Resend |
| Deployment | Vercel |

---

## Features

- **BUZZ AI** — personalized accountability companion, learns from your drive profile
- **Cohort Matching** — multi-dimensional compatibility scoring (ambition, discipline, openness, growth, community)
- **1-on-1 Matching** — high-compatibility peer pairing with admin review
- **Admin Panel** — founder dashboard for cohort management, matching, and user oversight
- **Dark / Cream theme** — full theme system with OS-preference awareness
- **Waitlist + onboarding** — assessment flow that generates a Drive Profile and reveals your archetype

---

## Local Development

### Prerequisites

- Node.js 18+
- npm or pnpm
- A Supabase project (PostgreSQL)
- Clerk account
- Stripe account
- Resend account
- OpenAI API key

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/SoftLaunchhq/softlaunch-app.git
cd softlaunch-app

# 2. Install dependencies
npm install

# 3. Copy and fill in environment variables
cp .env.example .env.local
# Edit .env.local with your real values

# 4. Push the schema to your database
#    Use a direct connection (not transaction pooler) for prisma db push:
DATABASE_URL="postgresql://postgres:<password>@db.<project>.supabase.co:5432/postgres" npx prisma db push

# 5. Generate Prisma client
npx prisma generate

# 6. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in all values. See `.env.example` for descriptions of each variable.

Key variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase transaction pooler URL (port 6543) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend key |
| `CLERK_SECRET_KEY` | Clerk backend key |
| `CLERK_WEBHOOK_SECRET` | For Clerk user lifecycle webhooks |
| `OPENAI_API_KEY` | Powers BUZZ AI |
| `STRIPE_SECRET_KEY` | Payments |
| `RESEND_API_KEY` | Transactional email |
| `ADMIN_EMAILS` | Comma-separated list of admin emails |

---

## Deployment (Vercel)

1. Connect the GitHub repo to Vercel
2. Set all environment variables in Vercel dashboard (copy from `.env.example`)
3. For `DATABASE_URL` on Vercel, use the **session pooler** URL (port 5432 — accessible from Vercel cloud IPs)
4. For `DIRECT_URL`, also use the session pooler URL without `?pgbouncer=true`
5. Vercel auto-runs `npm run build` which includes `prisma generate`

> **Note:** Add `npx prisma generate` to your Vercel build command if not already present:
> `npx prisma generate && next build`

---

## Project Structure

```
softlaunch-app/
├── app/
│   ├── (admin)/          # Admin panel routes
│   ├── (auth)/           # Sign-in / sign-up
│   ├── (dashboard)/      # Member dashboard + BUZZ + 1-on-1
│   ├── (onboarding)/     # Assessment + profile reveal flow
│   ├── api/              # API routes (webhooks, AI, billing, matching)
│   ├── faq/
│   ├── pricing/
│   ├── story/
│   └── page.tsx          # Landing page
├── components/
│   ├── admin/
│   ├── buzz/
│   ├── dashboard/
│   ├── landing/
│   ├── onboarding/
│   └── ui/
├── lib/
│   ├── db.ts             # Prisma client singleton
│   ├── matching.ts       # Cohort matching engine
│   └── matching-one-on-one.ts
├── prisma/
│   └── schema.prisma
├── public/
├── .env.example
└── next.config.mjs
```

---

## Admin Access

Add founder/admin emails to the `ADMIN_EMAILS` environment variable (comma-separated, no spaces):

```
ADMIN_EMAILS=founder@example.com,admin@example.com
```

Admin users bypass onboarding and get access to `/admin`.

---

## License

Private — SoftLaunch © 2025. All rights reserved.
