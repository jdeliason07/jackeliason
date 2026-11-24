"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { site } from "@/lib/config";

/** The masthead's name, linking home. Left off the homepage, whose headline already says who this is. */
export default function MastheadName() {
  if (usePathname() === "/") return null;
  return (
    <Link href="/" className="mb-3 inline-block font-display text-[1.875rem] tracking-[0.02em] sm:text-[2.25rem]">
      {site.name}
    </Link>
  );
}
