"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Staff sign-in.
 *
 * Posts to this app's own route handler, which calls Laravel and keeps the
 * returned token in an httpOnly cookie. Nothing sensitive comes back here.
 */
export function LoginForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);

    const response = await fetch("/admin/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));

      /*
       | The API returns ONE message for an unknown email, a wrong password and a
       | deactivated account — deliberately, so login cannot be used to work out
       | who works here. Show it as-is rather than trying to be more helpful.
       */
      const errorMessage =
        response.status === 429
          ? "Too many sign-in attempts. Please wait a minute and try again."
          : (body.errors?.email?.[0] ??
            body.message ??
            "Could not sign you in. Please try again.");

      setError(errorMessage);
      setIsSubmitting(false);

      return;
    }

    // `refresh()` before `push()` so the layout re-reads the new session cookie
    // rather than rendering the dashboard from a cached signed-out tree.
    router.refresh();
    router.push("/orders");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="size-4 animate-spin" />}
        Sign in
      </Button>
    </form>
  );
}
