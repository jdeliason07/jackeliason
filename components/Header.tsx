import Link from "next/link";
import MastheadName from "./MastheadName";
import { nav } from "@/lib/nav";

/** The masthead: name, then the contents. The floating nav takes over once it scrolls away. */
export default function Header() {
  return (
    <header className="pt-12 pb-16 text-center sm:pt-16 sm:pb-24">
      <MastheadName />
      <nav aria-label="Primary">
        <ul className="smallcaps flex items-baseline justify-center">
          {nav.map((item, index) => (
            <li key={item.href}>
              {index > 0 && (
                <span aria-hidden="true" className="px-3">
                  ·
                </span>
              )}
              <Link href={item.href} className="draw">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
