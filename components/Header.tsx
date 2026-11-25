"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { site } from "@/lib/config";

/**
 * The masthead: the name, small, in the page's top-left corner, linking home. Not on the
 * homepage, whose headline already says who this is. The header keeps the space above each
 * page's title; the name is placed against the page itself, not the text column.
 */
export default function Header() {
  if (usePathname() === "/") return null;
  return (
    <header className="h-40 sm:h-36">
      <Link
        href="/"
        className="scrim absolute top-[calc(max(1rem,env(safe-area-inset-top))+3.75rem)] left-1/2 -translate-x-1/2 font-display text-[1.25rem] tracking-[0.02em] whitespace-nowrap sm:top-7 sm:left-8 sm:translate-x-0 sm:text-[1.375rem]"
      >
        {site.name}
      </Link>
    </header>
  );
}
