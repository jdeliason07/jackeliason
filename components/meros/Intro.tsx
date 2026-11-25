"use client";

import { useEffect, useRef, useState } from "react";
import { APP_TAGLINE } from "@/lib/meros/config";
import { characterSrc, estateSrc, STREET_SRC } from "@/lib/meros/content/art";
import Wordmark from "./art/Wordmark";
import { useBrowserValue } from "./useBrowserValue";
import { useGame } from "./GameProvider";

const SEEN = "meros-intro";

/**
 * The loading intro, once per app session (a cold open of the installed app, or a new tab):
 *
 *   0 → 72% in the first 2 seconds, 72 → 99% over the next 3, then it holds at 99% until at least
 *   7 seconds have passed AND the game has loaded AND the first pictures (your character, the street,
 *   the estate) are in. Then 100%, and it lifts away.
 *
 * Returning within the same session skips it; the root layout's inline script marks the page before
 * first paint, so it never flashes.
 */
export default function Intro() {
  const game = useGame();
  const [gone, setGone] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [pct, setPct] = useState(0);
  const [imagesReady, setImagesReady] = useState(false);
  const start = useRef(0);
  const seenBefore = useBrowserValue(() => {
    try {
      return Boolean(sessionStorage.getItem(SEEN));
    } catch {
      return false;
    }
  }, false);

  // Warm the cache with the pictures the first screen needs (with a safety timeout).
  const v = game.view;
  const wanted = v ? [characterSrc(v.profile.appearance.skin, v.profile.appearance.hairStyle, v.profile.appearance.baseOutfit), STREET_SRC, estateSrc(v.profile.progress.level)] : null;
  const key = wanted?.join("|") ?? (game.status === "loading" ? "" : "none");
  const loaded = game.status !== "loading" && (imagesReady || key === "none");
  useEffect(() => {
    if (!key || key === "none") return;
    let left = wanted!.length;
    const done = () => --left <= 0 && setImagesReady(true);
    wanted!.forEach((src) => {
      const img = new Image();
      img.onload = img.onerror = done;
      img.src = src;
    });
    const t = setTimeout(() => setImagesReady(true), 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (gone || leaving || seenBefore) return;
    let raf = 0;
    const tick = (now: number) => {
      start.current ||= now;
      const t = now - start.current;
      const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
      const p = t < 2000 ? 72 * ease(t / 2000) : t < 5000 ? 72 + 27 * ease((t - 2000) / 3000) : 99;
      if (t >= 7000 && loaded) {
        setPct(100);
        setTimeout(() => setLeaving(true), 350);
        setTimeout(() => {
          try {
            sessionStorage.setItem(SEEN, "1");
          } catch {}
          setGone(true);
        }, 950);
        return;
      }
      setPct(p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [gone, leaving, loaded, seenBefore]);

  if (gone || seenBefore) return null;
  const line = pct < 72 ? "Waking the city…" : pct < 99 ? "Opening your estate…" : pct < 100 ? "Finding your desk…" : "Ready.";
  return (
    <div
      role="progressbar"
      aria-label="Loading Meros"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={`m-intro fixed inset-0 z-[60] flex flex-col items-center justify-center gap-10 bg-white px-10 transition-[opacity,transform] duration-500 ease-out ${leaving ? "pointer-events-none -translate-y-4 opacity-0" : ""}`}
    >
      <div className="flex flex-col items-center gap-4">
        <span className="m-slam">
          <Wordmark stroke className="text-[5.5rem]" />
        </span>
        <p className="eyebrow m-rise [animation-delay:500ms]">{APP_TAGLINE}</p>
      </div>
      <div className="m-rise flex w-full max-w-xs flex-col gap-2 [animation-delay:700ms]">
        <div className="m-bar w-full">
          <div className="m-bar-fill !animate-none !transition-none" style={{ transform: `scaleX(${pct / 100})` }} />
        </div>
        <div className="flex justify-between text-sm font-bold">
          <span>{line}</span>
          <span className="tabular-nums">{Math.floor(pct)}%</span>
        </div>
      </div>
    </div>
  );
}
