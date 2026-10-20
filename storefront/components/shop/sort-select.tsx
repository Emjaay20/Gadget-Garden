"use client";

import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toQueryString } from "@/lib/catalogue-query";
import type { CatalogueQuery } from "@/lib/types";

const OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "newest", label: "Newest in" },
] as const;

/**
 * Sort order, like every other filter, lives in the URL — so a sorted view is
 * shareable and survives the back button.
 */
export function SortSelect({ query }: { query: CatalogueQuery }) {
  const router = useRouter();

  return (
    <Select
      value={query.sort ?? "featured"}
      onValueChange={(value) =>
        router.push(
          `/shop${toQueryString({
            ...query,
            sort: value as CatalogueQuery["sort"],
            // Sorting reshuffles everything, so page 3 is meaningless afterwards.
            page: undefined,
          })}`,
        )
      }
    >
      <SelectTrigger size="sm" className="w-[180px]" aria-label="Sort products">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
