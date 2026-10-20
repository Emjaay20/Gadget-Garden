import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { getToken } from "@/lib/server/session";

export const metadata: Metadata = {
  title: "Sign in · Gadgets Garden",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  // Already signed in — no reason to show a login form.
  if (await getToken()) {
    redirect("/orders");
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
