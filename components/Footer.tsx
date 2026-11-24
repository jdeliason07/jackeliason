import { site } from "@/lib/config";

export default function Footer() {
  const links = [
    ...(site.email ? [{ href: `mailto:${site.email}`, label: "Email" }] : []),
    { href: "/rss.xml", label: "RSS" },
  ];

  return (
    <footer className="mt-24 pt-8 pb-12 text-[0.9375rem] text-muted sm:mt-32">
      <ul className="flex items-baseline">
        {links.map((link, index) => (
          <li key={link.href}>
            {index > 0 && (
              <span aria-hidden="true" className="px-2">
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
