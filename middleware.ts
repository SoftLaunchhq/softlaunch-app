import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

const isPublicRoute = createRouteMatcher([
  // Root
  "/",
  // Auth
  "/sign-in(.*)",
  "/sign-up(.*)",
  // Webhooks & public APIs
  "/api/webhooks(.*)",
  "/api/waitlist(.*)",
  // Marketing pages — all publicly accessible (no auth required to browse)
  "/how-it-works(.*)",
  "/story(.*)",
  "/pricing(.*)",
  "/faq(.*)",
  "/waitlist(.*)",
  // Legal
  "/about(.*)",
  "/privacy(.*)",
  "/terms(.*)",
])

export default clerkMiddleware(async (auth, req) => {
  // Public routes pass through without authentication
  if (isPublicRoute(req)) return

  // All other routes require authentication.
  // Admin authorization is handled per-layout via DB role check
  // (more reliable than Clerk session claims).
  const { userId } = await auth()

  if (!userId) {
    const signInUrl = new URL("/sign-in", req.url)
    signInUrl.searchParams.set("redirect_url", req.url)
    return Response.redirect(signInUrl)
  }
})

export const config = {
  matcher: [
    // Run middleware on all routes except Next.js internals and static assets
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
