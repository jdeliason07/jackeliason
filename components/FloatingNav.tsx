"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { site } from "@/lib/config";
import { isCurrent, nav } from "@/lib/nav";

/** How far the masthead must scroll away before the floating nav appears. */
const SHOW_AFTER = 320;

const items = [{ href: "/", label: "❦", name: "Home", preview: site.name }, ...nav.map((item) => ({ ...item, name: item.label }))];

/**
 * A pill fixed at the bottom of the viewport, shown once the masthead has
 * scrolled away. Hovering or focusing a link previews where it goes.
 */
export default function FloatingNav() {
  const pathname = usePathname();
  const [shown, setShown] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setShown(window.scrollY > SHOW_AFTER);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update); // the page may load already scrolled
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <nav
      aria-label="Floating"
      inert={!shown}
      className={`fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex justify-center px-4 transition-[opacity,transform,visibility] duration-300 ease-out motion-reduce:transition-none ${
        shown ? "visible translate-y-0 opacity-100" : "invisible translate-y-3 opacity-0"
      }`}
    >
      <div className="relative">
        <p
          aria-hidden="true"
          className={`pointer-events-none absolute bottom-[calc(100%+0.5rem)] left-1/2 max-w-[calc(100vw-2rem)] -translate-x-1/2 truncate rounded-full border border-rule bg-paper/90 px-3 py-1 text-[0.875rem] whitespace-nowrap text-muted italic shadow-[0_4px_14px_-6px_rgb(42_31_22/0.25)] backdrop-blur transition-opacity duration-200 motion-reduce:transition-none ${
            preview ? "opacity-100" : "opacity-0"
          }`}
        >
          {preview ?? " "}
        </p>
        <ul
          className="smallcaps flex items-center rounded-full border border-rule bg-paper/90 px-2 py-1.5 shadow-[0_8px_24px_-10px_rgb(42_31_22/0.35)] backdrop-blur"
          onMouseLeave={() => setPreview(null)}
        >
          {items.map((item, index) => {
            const current = isCurrent(item.href, pathname);
            return (
              <li key={item.href} className="flex items-center">
                {index > 1 && (
                  <span aria-hidden="true" className="text-rule">
                    ·
                  </span>
                )}
                <Link
                  href={item.href}
                  aria-label={item.href === "/" ? item.name : undefined}
                  aria-current={current ? "page" : undefined}
                  onMouseEnter={() => setPreview(item.preview)}
                  onFocus={() => setPreview(item.preview)}
                  onBlur={() => setPreview(null)}
                  className={`block rounded-full px-3 py-1 transition-colors ${
                    item.href === "/" ? "font-display text-[1.125rem] leading-none tracking-normal normal-case" : ""
                  } ${current ? "text-accent" : "text-muted hover:text-ink"}`}
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
