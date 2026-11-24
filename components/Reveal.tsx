"use client";

import { useEffect, useRef } from "react";

/**
 * A chapter that eases into view the first time it scrolls into the viewport.
 *
 * Hiding is opt-in and decided before first paint: the inline script in
 * app/layout.tsx sets data-reveal="ready" on <html> only when the browser has
 * IntersectionObserver and the reader hasn't asked for reduced motion. Without
 * JavaScript, without the API, or with reduced motion, chapters are simply
 * visible. See .reveal in globals.css.
 */
export default function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  /** Stagger, in milliseconds. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    // Tell the layout's failsafe that reveals are running.
    document.documentElement.dataset.revealLive = "";

    if (!("IntersectionObserver" in window)) {
      element.classList.add("is-visible");
      return;
    }
    // Reveal once the chapter's top is 12% into the viewport. A ratio threshold (12% of the
    // chapter visible) can never be met by a chapter taller than about eight screens, which
    // a long chapter on a small phone can be; a margin on the viewport works at any height.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          element.classList.add("is-visible");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}
