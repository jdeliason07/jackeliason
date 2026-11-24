import Link from "next/link";
import { site } from "@/lib/config";
import Logo from "./Logo";

/**
 * The logo, centred at the foot of every page: the mark on its own reeded sky tile, as in the
 * artwork (and the favicon), so it reads over any part of the backdrop. The email link sits
 * beneath it once lib/config.ts has an address.
 */
export default function Footer() {
  return (
    <footer className="mt-24 flex flex-col items-center gap-6 sm:mt-32">
      <Link href="/" aria-label={`${site.name}, home`} className="logo-tile">
        <Logo className="h-[64%] w-auto" />
      </Link>
      {site.email && (
        <a href={`mailto:${site.email}`} className="smallcaps draw">
          Email
        </a>
      )}
    </footer>
  );
}
