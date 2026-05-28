import { redirect } from "next/navigation"
export default function WelcomeRedirect() {
  redirect("/onboarding/welcome")
}
