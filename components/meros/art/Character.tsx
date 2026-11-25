"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Appearance } from "@/lib/meros/content/appearance";
import { characterSrc, faceBox, itemSrc, onPhotoError, STREET_SRC } from "@/lib/meros/content/art";
import { itemById } from "@/lib/meros/content/items";
import type { EnergyBand } from "@/lib/meros/domain/momentum";
import { Sparks } from "../motion";

/**
 * The owner's character: a cut-out photograph (skin tone × hair style × outfit; see
 * lib/meros/content/art.ts) standing on the street, or on whatever scene the caller provides.
 *
 * - Idle: a slow breath from the feet and a small classic bob (`animate`).
 * - Change: when the look changes, the old one turns away into a flash and the new one turns in,
 *   with a ring of sparks.
 * - Equipped items sit beside the figure as small photos; they aren't worn in the picture.
 * - Low energy reads as a slightly cooler, quieter photo, never anything harsher.
 *
 * `backdrop="none"` draws just the figure (for the home interior and the dressing room);
 * `crop="face"` zooms to the head for small round avatars.
 */
interface Props {
  appearance: Appearance;
  equipped?: string[];
  level: number;
  energy?: EnergyBand;
  className?: string;
  title?: string;
  animate?: boolean;
  crop?: "full" | "face";
  backdrop?: "street" | "none";
}

const MOOD: Record<EnergyBand, string> = {
  radiant: "",
  steady: "",
  tired: "saturate-[0.8]",
  drained: "saturate-[0.55] brightness-95",
};

/** Remembers the previous image for one change, so both are on screen while it turns. */
function useChange(src: string) {
  const [state, setState] = useState({ current: src, previous: null as string | null, n: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  if (state.current !== src) setState((s) => ({ current: src, previous: s.current, n: s.n + 1 }));
  useEffect(() => {
    if (!state.previous) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState((s) => ({ ...s, previous: null })), 520);
    return () => clearTimeout(timer.current);
  }, [state.previous, state.n]);
  return state;
}

export default function Character({ appearance, equipped = [], energy = "steady", className = "", title, animate = false, crop = "full", backdrop = "street" }: Props) {
  const src = characterSrc(appearance.skin, appearance.hairStyle, appearance.baseOutfit);
  const change = useChange(src);
  const items = crop === "full" ? equipped.map((id) => itemById(id)).filter((i) => i?.kind === "cosmetic").slice(0, 4) : [];
  const alt = title ?? "Your character";

  if (crop === "face") {
    // Frame the measured face in a square ~1.8× its size, centred (the container is square).
    const [cx, cy, size] = faceBox(src);
    const frame = size * 1.8;
    return (
      <span className={`relative block overflow-hidden ${className}`}>
        <Image
          src={src}
          alt={alt}
          width={480}
          height={640}
          unoptimized
          onError={onPhotoError}
          className={`absolute max-w-none ${MOOD[energy]}`}
          style={{ width: `${(480 / frame) * 100}%`, height: "auto", left: `${50 - (cx / frame) * 100}%`, top: `${50 - (cy / frame) * 100}%` }}
        />
      </span>
    );
  }

  return (
    <span className={`relative block overflow-hidden ${backdrop === "street" ? "rounded-2xl" : ""} ${className}`}>
      {backdrop === "street" && (
        <Image src={STREET_SRC} alt="" width={600} height={800} unoptimized onError={onPhotoError} className={`absolute inset-0 h-full w-full object-cover ${animate ? "m-drift" : ""}`} />
      )}
      {/* A soft contact shadow, so he stands on the ground rather than floating over it. */}
      <span aria-hidden="true" className="absolute bottom-[3%] left-1/2 h-[4%] w-[46%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgb(0_0_0/0.35),transparent)]" />
      <span className={`absolute inset-0 ${animate ? "m-idle" : ""}`}>
        <span className={`absolute inset-0 ${animate ? "m-breath" : ""}`}>
          {change.previous && (
            <Image src={change.previous} alt="" width={480} height={640} unoptimized className={`m-turn-out absolute inset-0 h-full w-full object-contain object-bottom ${MOOD[energy]}`} />
          )}
          <Image
            key={change.current}
            src={change.current}
            alt={alt}
            width={480}
            height={640}
            unoptimized
            onError={onPhotoError}
            className={`absolute inset-0 h-full w-full object-contain object-bottom ${change.n ? "m-turn-in" : "m-fade"} ${MOOD[energy]}`}
          />
        </span>
      </span>
      {change.previous && (
        <span key={`fx-${change.n}`} aria-hidden="true" className="pointer-events-none absolute inset-0">
          <span className="m-flash absolute inset-0 bg-[radial-gradient(closest-side,white,transparent)]" />
          <Sparks count={14} distance={90} delay={140} />
        </span>
      )}
      {items.length > 0 && (
        <span className="absolute right-1.5 bottom-1.5 flex flex-col gap-1">
          {items.map((item) => (
            <Image
              key={item!.id}
              src={itemSrc(item!.id)}
              alt={item!.name}
              title={item!.name}
              width={360}
              height={360}
              unoptimized
              onError={onPhotoError}
              className="m-pop size-7 rounded-full border-[1.5px] border-white object-cover"
            />
          ))}
        </span>
      )}
    </span>
  );
}
