"use client";

import { useEffect, useRef } from "react";

/** How quickly the wood-brown mass catches up with the page, in seconds: it settles about a second after scrolling stops. */
const CATCH_UP = 0.26;
/** How far behind it trails, as a share of the scroll it's lagging, and the most it may drift (share of the screen's height). */
const TRAIL = 0.4;
const MAX_DRIFT = 0.22;

/**
 * The page's backdrop (see .backdrop in globals.css). The wood-brown mass has a little
 * inertia: scrolling carries it along, and it floats back to rest about a second after
 * the page stops. The loop runs only while it's settling, and only moves its own GPU
 * layer (no repaints). Reduced motion: it stays put.
 */
export default function Backdrop() {
  const warm = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mass = warm.current;
    if (!mass || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let follow = window.scrollY;
    let frame = 0;
    let last = 0;

    const tick = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      const target = window.scrollY;
      follow += (target - follow) * (1 - Math.exp(-dt / CATCH_UP));
      const limit = window.innerHeight * MAX_DRIFT;
      // Behind the page: carried up while scrolling down, then floating back down to rest.
      const drift = Math.max(-limit, Math.min(limit, (follow - target) * TRAIL));
      if (Math.abs(target - follow) > 0.5) {
        mass.style.translate = `-50% calc(-50% + ${drift.toFixed(1)}px)`;
        frame = requestAnimationFrame(tick);
      } else {
        follow = target;
        frame = 0;
        last = 0;
        mass.style.translate = "";
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div aria-hidden="true" className="backdrop">
      <div ref={warm} className="backdrop-warm" />
    </div>
  );
}
