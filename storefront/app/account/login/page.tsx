"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, ShieldCheck, Tag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginCustomer, registerCustomer } from "@/lib/customer-auth";

export default function CustomerLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (mode === "login") {
        await loginCustomer({ email, password });
      } else {
        await registerCustomer({ name, email, phone, password });
      }
      router.push("/account");
    } catch (err: any) {
      setError(err.message || "Authentication failed.");
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          {mode === "login" ? "Customer sign in" : "Create your account"}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm text-pretty">
          {mode === "login"
            ? "Sign in to track orders, manage deliveries, and view warranties."
            : "Join Gadgets Garden to unlock your welcome voucher and order tracking."}
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-xs">
        {/* Tab switcher */}
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={`rounded-md py-1.5 transition-colors ${
              mode === "login"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
            }}
            className={`rounded-md py-1.5 transition-colors ${
              mode === "register"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Create account
          </button>
        </div>

        {mode === "register" && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
            <Tag className="size-4 shrink-0" />
            <span>New accounts get <strong>₦5,000 off</strong> first laptop purchase with code <strong>WELCOME5K</strong></span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === "register" && (
            <div className="grid gap-2">
              <Label htmlFor="reg-name">Full name</Label>
              <Input
                id="reg-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Adaobi Okafor"
                required
              />
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="auth-email">Email address</Label>
            <Input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
            />
          </div>

          {mode === "register" && (
            <div className="grid gap-2">
              <Label htmlFor="reg-phone">Phone number (WhatsApp)</Label>
              <Input
                id="reg-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0805 694 7271"
                required
              />
            </div>
          )}

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="auth-password">Password</Label>
              {mode === "register" && (
                <span className="text-[11px] text-muted-foreground">Min 8 characters</span>
              )}
            </div>
            <Input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={8}
              required
            />
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" size="lg" className="w-full mt-2 font-semibold" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Please wait…
              </>
            ) : mode === "login" ? (
              "Sign in to account"
            ) : (
              "Create account"
            )}
          </Button>
        </form>

        <div className="mt-6 border-t border-border pt-4">
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-3.5 text-emerald-500 shrink-0" />
              <span>Direct hardware warranty on all laptops</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
              <span>Real-time dispatch & courier tracking</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
