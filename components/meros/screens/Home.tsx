"use client";

import Image from "next/image";
import Link from "next/link";
import { APP_BASE_PATH } from "@/lib/meros/config";
import { homeSrc, onPhotoError, QUEST_DESK_SRC } from "@/lib/meros/content/art";
import { AREAS_BY_ID } from "@/lib/meros/content/estate";
import Character from "../art/Character";
import { useGame } from "../GameProvider";
import { Hotspot, Icon } from "../ui";

/**
 * Inside the home (the residence at its current tier). Two things to touch: the character, who
 * opens the dressing room, and the desk, which opens the quests. Both pulse gently so they read as
 * places to tap without a word of instruction.
 */
export default function Home() {
  const v = useGame().view!;
  const p = v.profile;
  const tier = v.estate.tiers.residence ?? 0;
  const residence = AREAS_BY_ID.get("residence")!;
  const name = tier === 0 ? residence.baseName : residence.tiers[tier - 1].name;
  const activeQuests = v.quests.filter((q) => q.status === "active").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link href={`${APP_BASE_PATH}/estate`} className="btn btn-ghost -ml-2 px-2">
          <Icon name="back" /> Estate
        </Link>
        <p className="eyebrow">{name}</p>
      </div>

      <section aria-label="Your home" className="relative isolate aspect-[9/16] max-h-[calc(100dvh-13rem)] w-full overflow-hidden rounded-2xl">
        <Image src={homeSrc(tier)} alt={`Inside your ${name.toLowerCase()}`} fill priority unoptimized sizes="32rem" onError={onPhotoError} className="m-drift object-cover" />

        {/* His canvas is mostly transparent around him, so it may sit behind the desk; the desk link comes later and stays on top. */}
        <Link href={`${APP_BASE_PATH}/dress`} aria-label="Dress your character" className="group absolute bottom-[1%] left-[-18%] aspect-[3/4] w-[88%]">
          <Character appearance={p.appearance} level={p.progress.level} energy={p.energy} backdrop="none" animate className="h-full w-full transition-transform duration-300 ease-spring group-active:scale-95" />
          <Hotspot label="Dress" className="top-[6%] left-1/2 -translate-x-1/2" />
        </Link>

        <Link href={`${APP_BASE_PATH}/quests`} aria-label={`Quests (${activeQuests} active)`} className="group absolute right-[2%] bottom-[6%] w-[48%]">
          <span className="m-breathe block transition-transform duration-300 ease-spring group-active:scale-95">
            <Image src={QUEST_DESK_SRC} alt="" width={560} height={560} unoptimized onError={onPhotoError} className="h-auto w-full drop-shadow-[0_10px_14px_rgb(0_0_0/0.35)]" />
          </span>
          <Hotspot label={`Quests · ${activeQuests}`} className="-top-3 left-1/2 -translate-x-1/2" />
        </Link>
      </section>
      <p className="hint text-center">Tap yourself to change your look. Tap the desk for your quests.</p>
    </div>
  );
}
