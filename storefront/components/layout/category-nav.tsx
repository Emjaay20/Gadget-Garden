"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The category row beneath the header.
 *
 * The active link carries a gradient underline — one of the few places the brand
 * gradient is allowed to appear (DESIGN.md §2). It is drawn as a sibling span
 * rather than a `border-bottom` so it can be the full gradient rather than a
 * single colour.
 */
export function CategoryNav({ categories }: { categories: Category[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get("category");

  if (categories.length === 0) {
    return null;
  }

  const onShop = pathname === "/shop";

  return (
    <nav
      aria-label="Product categories"
      className="scrollbar-none -mx-4 flex h-11 items-center gap-6 overflow-x-auto px-4 sm:mx-0 sm:px-0"
    >
      <CategoryLink href="/shop" isActive={onShop && !activeCategory}>
        All
      </CategoryLink>

      {categories.map((category) => (
        <CategoryLink
          key={category.id}
          href={`/shop?category=${category.slug}`}
          isActive={onShop && activeCategory === category.slug}
        >
          {category.name}
        </CategoryLink>
      ))}
    </nav>
  );
}

function CategoryLink({
  href,
  isActive,
  children,
}: {
  href: string;
  isActive: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "relative shrink-0 py-3 text-sm whitespace-nowrap transition-colors",
        "focus-visible:ring-ring rounded-sm focus-visible:ring-2 focus-visible:outline-none",
        isActive
          ? "text-foreground font-medium"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      {isActive && (
        <span
          aria-hidden
          className="absolute inset-x-0 -bottom-px h-0.5 rounded-full"
          style={{ background: "var(--gg-gradient)" }}
        />
      )}
    </Link>
  );
}
