import { redirect } from "next/navigation";

import { api } from "@/lib/server/api";
import { getToken } from "@/lib/server/session";

/** The backoffice root redirects to /inventory if logged in, otherwise /login. */
export default async function Home() {
  const token = await getToken();
  if (token) {
    try {
      await api("/me");
      redirect("/inventory");
    } catch {
      // Invalid token
    }
  }

  redirect("/login");
}
