"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, X, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const QUICK_SEARCHES = [
  "MacBook Pro M1",
  "16GB RAM",
  "512GB SSD",
  "ThinkPad",
  "Touchscreen",
  "Gaming",
];

export function ShopSearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.get("search") ?? "";
  const [value, setValue] = useState(currentSearch);
  const [isPending, startTransition] = useTransition();

  function handleSearch(term: string) {
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = term.trim();
    if (trimmed) {
      params.set("search", trimmed);
    } else {
      params.delete("search");
    }
    params.delete("page"); // reset pagination on search
    startTransition(() => {
      router.push(`/shop?${params.toString()}`);
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSearch(value);
  }

  function handleClear() {
    setValue("");
    handleSearch("");
  }

  return (
    <div className="space-y-3 mb-8">
      <form onSubmit={onSubmit} className="relative flex items-center max-w-2xl">
        <Search className="absolute left-3.5 size-4 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          placeholder="Search by laptop model, chip (M1, Core i7), RAM, or storage..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="pl-10 pr-20 h-11 text-sm bg-background border-muted-foreground/30 focus-visible:ring-primary shadow-xs rounded-xl"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-14 text-muted-foreground hover:text-foreground p-1"
            aria-label="Clear search"
          >
            <X className="size-4" />
          </button>
        )}
        <Button
          type="submit"
          size="sm"
          className="absolute right-1.5 h-8 px-3 rounded-lg text-xs"
        >
          Search
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1 font-medium text-foreground">
          <Sparkles className="size-3 text-primary" /> Popular:
        </span>
        {QUICK_SEARCHES.map((term) => (
          <button
            key={term}
            type="button"
            onClick={() => {
              setValue(term);
              handleSearch(term);
            }}
            className="rounded-full border border-border/70 bg-muted/40 hover:bg-accent px-2.5 py-0.5 transition-colors cursor-pointer text-[11px]"
          >
            {term}
          </button>
        ))}
      </div>
    </div>
  );
}
