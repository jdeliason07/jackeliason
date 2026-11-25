"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { site } from "@/lib/config";

/**
 * The masthead: the name, linking home. Not on the homepage, whose headline already says
 * who this is. Navigation lives in the floating nav at the foot of the screen.
 */
export default function Header() {
  if (usePathname() === "/") return null;
  return (
    <header className="pt-12 pb-16 text-center sm:pt-16 sm:pb-24">
      <Link href="/" className="font-display text-[1.875rem] tracking-[0.02em] sm:text-[2.25rem]">
        {site.name}
      </Link>
    </header>
  );
}
