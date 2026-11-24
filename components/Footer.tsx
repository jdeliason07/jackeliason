import { site } from "@/lib/config";
import Ornament from "./Ornament";

export default function Footer() {
  const links = [
    ...(site.email ? [{ href: `mailto:${site.email}`, label: "Email" }] : []),
    { href: "/rss.xml", label: "RSS" },
  ];

  return (
    <footer className="mt-20 pb-16 text-center text-muted sm:mt-28">
      <Ornament />
      <ul className="smallcaps mt-6 flex items-baseline justify-center">
        {links.map((link, index) => (
          <li key={link.href}>
            {index > 0 && (
              <span aria-hidden="true" className="px-3">
                ·
              </span>
            )}
            <a href={link.href} className="hover:text-ink">
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </footer>
  );
}
