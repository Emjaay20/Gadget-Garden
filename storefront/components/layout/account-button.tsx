"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { User } from "lucide-react";

import { getCachedCustomer } from "@/lib/customer-auth";
import type { Customer } from "@/lib/types";

export function AccountButton() {
  const [customer, setCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    setCustomer(getCachedCustomer());

    const onAuthChanged = () => {
      setCustomer(getCachedCustomer());
    };

    window.addEventListener("gg-auth-changed", onAuthChanged);
    return () => {
      window.removeEventListener("gg-auth-changed", onAuthChanged);
    };
  }, []);

  return (
    <Link
      href={customer ? "/account" : "/account/login"}
      className="hover:bg-accent text-foreground flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors"
      title={customer ? `Signed in as ${customer.name}` : "Customer Sign in"}
    >
      <User className="size-4" />
      <span className="hidden sm:inline">
        {customer ? customer.name.split(" ")[0] : "Account"}
      </span>
    </Link>
  );
}
