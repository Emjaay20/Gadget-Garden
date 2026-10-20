import { redirect } from "next/navigation";

import { api } from "@/lib/server/api";
import { getToken } from "@/lib/server/session";

/** The backoffice root redirects to /inventory if logged in, otherwise /login. */
export default async function Home() {
  const token = await getToken();
  let hasValidSession = false;

  if (token) {
    try {
      await api("/me");
      hasValidSession = true;
    } catch {
      hasValidSession = false;
    }
  }

  if (hasValidSession) {
    redirect("/inventory");
  }

  redirect("/login");
}
