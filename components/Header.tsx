import Link from "next/link";
import { site } from "@/lib/config";
import { nav } from "@/lib/nav";

/** The masthead: name, then the contents. The floating nav takes over once it scrolls away. */
export default function Header() {
  return (
    <header className="pt-12 pb-16 text-center sm:pt-16 sm:pb-24">
      <Link href="/" className="font-display text-[1.875rem] tracking-[0.02em] sm:text-[2.25rem]">
        {site.name}
      </Link>
      <nav aria-label="Primary" className="mt-3">
        <ul className="smallcaps flex items-baseline justify-center text-muted">
          {nav.map((item, index) => (
            <li key={item.href}>
              {index > 0 && (
                <span aria-hidden="true" className="px-3">
                  ·
                </span>
              )}
              <Link href={item.href} className="hover:text-ink">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
