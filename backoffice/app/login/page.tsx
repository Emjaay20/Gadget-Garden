import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { api } from "@/lib/server/api";
import { getToken } from "@/lib/server/session";

export const metadata: Metadata = {
  title: "Sign in · Gadgets Garden",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  // Only redirect if the staff token is present AND still valid in the backend.
  // If the token has expired, been revoked, or is stale, we swallow the error
  // and display the login form so the user can sign in without a redirect loop.
  const token = await getToken();
  if (token) {
    try {
      await api("/me");
      redirect("/inventory");
    } catch {
      // Stale or invalid session — fall through to render the sign-in form.
    }
  }

  return (
    <div className="grid min-h-svh place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Gadgets Garden
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Staff sign-in
          </p>
        </div>

        <LoginForm />
      </div>
    </div>
  );
}
