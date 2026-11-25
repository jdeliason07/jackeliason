"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { site } from "@/lib/config";
import { isCurrent, nav } from "@/lib/nav";

const items = [{ href: "/", label: "Home", preview: site.name }, ...nav];

/**
 * The site's navigation: a pill fixed at the foot of the screen, always there.
 * Hovering or focusing a link previews where it goes.
 */
export default function FloatingNav() {
  const pathname = usePathname();
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex justify-center px-4"
    >
      <div className="relative">
        <p
          aria-hidden="true"
          className={`pointer-events-none absolute bottom-[calc(100%+0.5rem)] left-1/2 max-w-[calc(100vw-2rem)] -translate-x-1/2 truncate rounded-full bg-white/90 px-3 py-1 text-[0.875rem] whitespace-nowrap text-muted italic shadow-[0_4px_14px_-6px_rgb(42_31_22/0.25)] backdrop-blur transition-opacity duration-200 motion-reduce:transition-none ${
            preview ? "opacity-100" : "opacity-0"
          }`}
        >
          {preview ?? " "}
        </p>
        <ul
          className="smallcaps flex items-center rounded-full bg-white/90 px-2 py-0.5 shadow-[0_10px_30px_-12px_rgb(42_31_22/0.45)] backdrop-blur"
          onMouseLeave={() => setPreview(null)}
        >
          {items.map((item, index) => {
            const current = isCurrent(item.href, pathname);
            return (
              <li key={item.href} className="flex items-center">
                {index > 0 && (
                  <span aria-hidden="true" className="text-rule">
                    ·
                  </span>
                )}
                <Link
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  onMouseEnter={() => setPreview(item.preview)}
                  onFocus={() => setPreview(item.preview)}
                  onBlur={() => setPreview(null)}
                  className={`flex min-h-[44px] items-center rounded-full px-3 transition-colors ${current ? "text-accent" : "text-muted hover:text-ink"}`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
