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
    <header className="h-28 sm:h-36">
      <Link
        href="/"
        className="absolute top-5 left-6 font-display text-[1.25rem] tracking-[0.02em] sm:top-7 sm:left-8 sm:text-[1.375rem]"
      >
        {site.name}
      </Link>
    </header>
  );
}
