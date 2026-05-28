// Permanent redirect — billing now lives at /dashboard/billing
import { redirect } from "next/navigation"
export default function BillingRedirect() {
  redirect("/dashboard/billing")
}
