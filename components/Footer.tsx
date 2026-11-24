import Link from "next/link";
import { site } from "@/lib/config";
import Logo from "./Logo";

/** The mark, centred at the foot of every page; the email link beneath it once lib/config.ts has an address. */
export default function Footer() {
  return (
    <footer className="mt-24 flex flex-col items-center gap-6 sm:mt-32">
      <Link href="/" aria-label={`${site.name}, home`} className="transition-opacity hover:opacity-85">
        <Logo className="h-16 w-auto drop-shadow-[0_2px_6px_rgb(42_31_22/0.35)]" />
      </Link>
      {site.email && (
        <a href={`mailto:${site.email}`} className="smallcaps draw">
          Email
        </a>
      )}
    </footer>
  );
}
