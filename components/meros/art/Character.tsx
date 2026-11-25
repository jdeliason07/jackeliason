"use client";

import Image from "next/image";
import type { Appearance } from "@/lib/meros/content/appearance";
import { characterSrc, itemSrc, onPhotoError } from "@/lib/meros/content/art";
import { itemById } from "@/lib/meros/content/items";
import type { EnergyBand } from "@/lib/meros/domain/momentum";

/**
 * The owner's character: a photograph chosen by skin tone, hair style, and outfit (see
 * lib/meros/content/art.ts). Equipped items sit beside the figure as small photos; they aren't
 * worn in the picture. Low energy reads as a slightly cooler, quieter photo, never anything harsher.
 *
 * `crop="face"` zooms to the head for small round avatars.
 */
interface Props {
  appearance: Appearance;
  equipped?: string[];
  level: number;
  energy?: EnergyBand;
  className?: string;
  title?: string;
  /** A slow ambient drift (still under reduced motion). */
  animate?: boolean;
  crop?: "full" | "face";
}

const MOOD: Record<EnergyBand, string> = {
  radiant: "",
  steady: "",
  tired: "saturate-[0.8]",
  drained: "saturate-[0.55] brightness-95",
};

export default function Character({ appearance, equipped = [], energy = "steady", className = "", title, animate = false, crop = "full" }: Props) {
  const src = characterSrc(appearance.skin, appearance.hairStyle, appearance.baseOutfit);
  const items = crop === "full" ? equipped.map((id) => itemById(id)).filter((i) => i?.kind === "cosmetic").slice(0, 4) : [];
  const alt = title ?? "Your character";

  if (crop === "face") {
    return (
      <span className={`relative block overflow-hidden ${className}`}>
        <Image
          src={src}
          alt={alt}
          width={480}
          height={640}
          unoptimized
          onError={onPhotoError}
          className={`absolute top-1/2 left-1/2 max-w-none ${MOOD[energy]}`}
          style={{ width: "460%", height: "auto", transform: "translate(-50%, -13%)" }}
        />
      </span>
    );
  }

  return (
    <span className={`relative block overflow-hidden rounded-2xl ${className}`}>
      <span key={src} className="m-fade block h-full w-full">
        <Image src={src} alt={alt} width={480} height={640} unoptimized onError={onPhotoError} className={`h-full w-full object-cover ${MOOD[energy]} ${animate ? "m-drift" : ""}`} />
      </span>
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
