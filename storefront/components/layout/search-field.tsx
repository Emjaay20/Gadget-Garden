"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

/**
 * The header search. Submits to /shop rather than filtering live: a search that
 * re-queries on every keystroke would hammer a throttled public endpoint from a
 * mobile connection, and the reference design's search is a submit affordance
 * anyway.
 *
 * A real `<form>` so Enter works and the field is announced as a search landmark
 * without extra ARIA.
 */
export function SearchField({ className }: { className?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("search") ?? "");

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const trimmed = value.trim();
    router.push(trimmed ? `/shop?search=${encodeURIComponent(trimmed)}` : "/shop");
  }

  return (
    <form role="search" onSubmit={onSubmit} className={className}>
      <div className="relative">
        <input
          type="search"
          name="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search laptops, brands, specs…"
          aria-label="Search products"
          className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring h-10 w-full rounded-full border pr-11 pl-4 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />
        <button
          type="submit"
          aria-label="Search"
          className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 grid w-11 place-items-center rounded-full"
        >
          <Search className="size-4" />
        </button>
      </div>
    </form>
  );
}
