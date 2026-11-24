import Link from "next/link";
import { site } from "@/lib/config";

const nav = [
  { href: "/essays", label: "Essays" },
  { href: "/now", label: "Now" },
  { href: "/canon", label: "Canon" },
];

export default function Header() {
  return (
    <header className="flex items-baseline justify-between gap-6 pt-8 pb-16 text-[0.9375rem] sm:pt-12 sm:pb-24">
      <Link href="/" className="font-medium">
        {site.name}
      </Link>
      <nav aria-label="Primary">
        <ul className="flex items-baseline text-muted">
          {nav.map((item, index) => (
            <li key={item.href}>
              {index > 0 && (
                <span aria-hidden="true" className="px-2">
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
