"use client";

import { useEffect, useRef } from "react";

/** True when the OS asks for reduced motion or the in-app setting is on (html[data-motion="reduce"]). */
export function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  return document.documentElement.dataset.motion === "reduce" || matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * A number that rolls to its new value (320ms, expo ease-out) and lands with a small spring bump.
 * React owns the text node; the roll only rewrites that node's value between renders, so no state
 * churns and the server-rendered text always matches. Nothing counts up from zero on load.
 * Reduced motion: it simply changes.
 */
export function Count({ value, className = "", duration = 320 }: { value: number; className?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(value);

  useEffect(() => {
    const el = ref.current;
    const node = el?.firstChild;
    const start = from.current;
    from.current = value;
    if (!el || !node || start === value || prefersReducedMotion()) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      node.nodeValue = String(Math.round(start + (value - start) * easeOutExpo(t)));
      if (t < 1) raf = requestAnimationFrame(tick);
      else el.animate([{ transform: "scale(1)" }, { transform: "scale(1.14)" }, { transform: "scale(1)" }], { duration: 260, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" });
    };
    node.nodeValue = String(start);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      node.nodeValue = String(value);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={`inline-block tabular-nums ${className}`}>
      {value}
    </span>
  );
}

const MAGNETIC = ".btn-primary, [data-magnetic]";
const PULL = 0.18;
const MAX = 6;

/**
 * Primary actions lean toward a fine pointer (up to 6px) and spring back when it leaves. One
 * delegated listener for the whole app; it moves only the `translate` property, so the CSS press
 * and hover transforms still compose on top. Off for touch, coarse pointers, and reduced motion.
 */
export function useMagnetic() {
  useEffect(() => {
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let current: HTMLElement | null = null;
    let raf = 0;
    const release = () => {
      if (current) current.style.translate = "";
      current = null;
    };
    const onMove = (e: PointerEvent) => {
      if (prefersReducedMotion()) return release();
      const target = (e.target as Element | null)?.closest<HTMLElement>(MAGNETIC) ?? null;
      if (target !== current) release();
      if (!target || (target as HTMLButtonElement).disabled) return;
      current = target;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = target.getBoundingClientRect();
        const clamp = (n: number) => Math.max(-MAX, Math.min(MAX, n));
        const dx = clamp((e.clientX - (r.left + r.width / 2)) * PULL);
        const dy = clamp((e.clientY - (r.top + r.height / 2)) * PULL * 1.4);
        target.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
      });
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", release);
    return () => {
      cancelAnimationFrame(raf);
      release();
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", release);
    };
  }, []);
}

/** Splits a word into letters that spring up one after another (decorative; the word stays readable to AT). */
export function Letters({ text, step = 35 }: { text: string; step?: number }) {
  return (
    <span>
      <span className="sr-only">{text}</span>
      {Array.from(text).map((ch, i) => (
        <span key={i} aria-hidden="true" className="m-letter" style={{ animationDelay: `${i * step}ms` }}>
          {ch === " " ? " " : ch}
        </span>
      ))}
    </span>
  );
}
