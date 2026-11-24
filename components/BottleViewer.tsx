"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { BottleScene } from "@/lib/bottle-scene";

type Logo = { src: string; width: number; height: number; displayHeight: number };

/**
 * The 3D bottle's frame. Three.js is fetched only when the frame comes within
 * 200px of the viewport. Until then it shows a placeholder plate; if WebGL is
 * unavailable it shows the vates logo plate instead.
 */
export default function BottleViewer({ name, brand, logo }: { name: string; brand: string; logo: Logo }) {
  const frame = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"waiting" | "ready" | "failed">("waiting");

  useEffect(() => {
    const element = frame.current;
    const canvasHost = host.current;
    if (!element || !canvasHost) return;
    let cancelled = false;
    let bottle: BottleScene | undefined;

    const load = async () => {
      try {
        const { mountBottle } = await import("@/lib/bottle-scene");
        if (cancelled) return;
        const mounted = await mountBottle(canvasHost, {
          track: element.closest("section") ?? element,
          reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          labelSrc: logo.src,
          onContextLost: () => {
            bottle?.dispose();
            bottle = undefined;
            setStatus("failed");
          },
        });
        if (cancelled) return mounted.dispose();
        bottle = mounted;
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("failed");
      }
    };

    let observer: IntersectionObserver | undefined;
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer?.disconnect();
            void load();
          }
        },
        { rootMargin: "200px" },
      );
      observer.observe(element);
    } else {
      void load();
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      bottle?.dispose();
    };
  }, [logo.src]);

  return (
    <div
      ref={frame}
      className="relative mx-auto aspect-[4/5] w-full max-w-[22rem] border-[3px] border-double border-rule"
    >
      <div ref={host} className={`absolute inset-0 ${status === "failed" ? "hidden" : ""}`} />
      {status === "waiting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
          <span className="font-display text-[2.5rem] leading-none">{name}</span>
          <span className="smallcaps text-muted">Loading</span>
        </div>
      )}
      {status === "failed" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Image
            src={logo.src}
            width={logo.width}
            height={logo.height}
            alt={brand}
            unoptimized
            className="plate-logo"
            style={{ maxHeight: logo.displayHeight * 1.6, width: "auto", height: "auto" }}
          />
        </div>
      )}
    </div>
  );
}
