"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { APP_BASE_PATH } from "@/lib/meros/config";
import { areaSrc, CHEST_SRC, estateLoopSrc, estateSrc, estateStage, onPhotoError } from "@/lib/meros/content/art";
import { AREAS, type AreaId } from "@/lib/meros/content/estate";
import { PLACE_LABEL, TASK_PLACES } from "@/lib/meros/content/places";
import type { DueView, GameView } from "@/lib/meros/service/view";
import ChestSheet from "../ChestSheet";
import { useGame } from "../GameProvider";
import MoneySheet from "../MoneySheet";
import { Count, prefersReducedMotion } from "../motion";
import PlaceSheet from "../PlaceSheet";
import { focalPlace, placeStatus } from "../places";
import RatingSheet from "../RatingSheet";
import { CATEGORY_ICON, Icon, ProgressBar } from "../ui";
import VerifySheet from "../VerifySheet";

/** Where each building sits in the aerial photographs, in percent of the frame. */
const HOTSPOTS: Record<AreaId, { x: number; y: number }> = {
  residence: { x: 40, y: 63 },
  gardens: { x: 54, y: 39 },
  office: { x: 22, y: 25 },
  library: { x: 74, y: 33 },
  gym: { x: 17, y: 74 },
  workshop: { x: 82, y: 78 },
};

/** From level 15 the river replaces the lower-left corner, so the gym moves onto the buildings on the left edge. */
const HOTSPOT_OVERRIDES: Partial<Record<number, Partial<Record<AreaId, { x: number; y: number }>>>> = {
  15: { gym: { x: 12, y: 52 } },
  20: { gym: { x: 12, y: 52 } },
};

function Aerial({ level }: { level: number }) {
  const [still, setStill] = useState(true);
  return (
    <>
      <Image src={estateSrc(level)} alt="Your block from above" fill priority unoptimized sizes="32rem" onError={onPhotoError} className="object-cover" />
      <video
        key={estateLoopSrc(level)}
        src={estateLoopSrc(level)}
        poster={estateSrc(level)}
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
        aria-hidden="true"
        onCanPlay={(e) => {
          if (prefersReducedMotion()) return e.currentTarget.pause();
          setStill(false);
        }}
        onError={() => setStill(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${still ? "opacity-0" : "opacity-100"}`}
      />
    </>
  );
}

/**
 * Home: your block from above. Each building holds its tasks (the gym your fitness, the office
 * your work, the library your learning) and shows a bubble with what's still due today. The
 * building with the next open task pulses, and the big button under the map goes straight there.
 */
export default function Home() {
  const game = useGame();
  const v = game.view!;
  const p = v.profile;
  const [place, setPlace] = useState<AreaId | null>(null);
  const [verifying, setVerifying] = useState<DueView | null>(null);
  const [rating, setRating] = useState<DueView | null>(null);
  const [chest, setChest] = useState<GameView["chests"]["unopened"][number] | null>(null);
  const [moneyOpen, setMoneyOpen] = useState(false);
  const focal = focalPlace(v, TASK_PLACES);
  const next = focal ? placeStatus(v, focal).due.find((d) => d.status === "open" && d.phase === "open") : null;
  const unopened = v.chests.unopened[0];
  const stage = estateStage(p.progress.level);

  return (
    <div className="flex flex-col gap-4">
      {/* You, in three numbers: level, real money, the next chest. */}
      <section aria-label="You" className="flex items-center gap-3">
        <Link href={`${APP_BASE_PATH}/progress`} className="min-w-0 flex-1 rounded-lg" aria-label={`Level ${p.progress.level}`}>
          <span className="flex items-baseline justify-between font-display text-lg leading-none">
            <span>
              LV <Count value={p.progress.level} />
            </span>
            {p.vitality < 100 && (
              <span className="inline-flex items-center gap-0.5 text-sm" aria-label={`Vitality ${p.vitality}`}>
                <Icon name="heart" className="h-4 w-4" /> {p.vitality}
              </span>
            )}
          </span>
          <ProgressBar value={p.progress.intoLevel} max={p.progress.levelSpan || 1} label={`Progress to level ${p.progress.level + 1}`} className="mt-1.5" />
        </Link>
        <button type="button" onClick={() => setMoneyOpen(true)} className="chip min-h-11 gap-1.5 px-3 font-display text-lg" aria-label={`Money this month: ${Math.round(v.money.monthCents / 100)} dollars`}>
          <Icon name="wallet" className="h-5 w-5" />$<Count value={Math.round(v.money.monthCents / 100)} />
        </button>
        <button
          type="button"
          onClick={() => unopened && setChest(unopened)}
          disabled={!unopened}
          className="relative grid h-12 w-12 shrink-0 place-items-center disabled:opacity-100"
          aria-label={unopened ? `${v.chests.unopened.length} chest ready` : `Next chest: ${v.chests.progress} of ${v.chests.perChest}`}
        >
          <Image src={CHEST_SRC} alt="" width={560} height={560} unoptimized className={`h-12 w-12 object-contain ${unopened ? "m-breathe" : "opacity-40 grayscale"}`} />
          {unopened ? (
            <span className="m-badge absolute -top-1 -right-1">{v.chests.unopened.length}</span>
          ) : (
            <span className="m-badge m-badge-quiet absolute -right-1 -bottom-1 text-[0.6875rem]">
              {v.chests.progress}/{v.chests.perChest}
            </span>
          )}
        </button>
      </section>

      <section aria-label="Your block" className="relative isolate aspect-[9/16] max-h-[calc(100dvh-18.5rem)] min-h-80 w-full overflow-hidden rounded-2xl">
        <Aerial level={p.progress.level} />
        {AREAS.map((a) => {
          const id = a.id as AreaId;
          const spot = HOTSPOT_OVERRIDES[stage]?.[id] ?? HOTSPOTS[id];
          const s = placeStatus(v, id);
          const isFocal = id === focal;
          const small = id === "workshop";
          const tier = v.estate.tiers[id] ?? 0;
          const ready = v.estate.areas.find((x) => x.id === id)?.canUpgrade;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setPlace(id)}
              aria-label={`${PLACE_LABEL[id]}${s.remaining ? `: ${s.remaining} to do` : ""}${ready ? ", upgrade ready" : ""}`}
              className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 transition-transform duration-300 ease-spring active:scale-90"
              style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
            >
              <span className="relative grid place-items-center">
                {isFocal && <span aria-hidden="true" className="m-pulse-ring absolute h-full w-full rounded-full border-[3px] border-white" />}
                <span
                  className={`relative block overflow-hidden rounded-full border-[3px] shadow-[0_6px_14px_rgb(0_0_0/0.35)] ${isFocal ? "h-[4.5rem] w-[4.5rem] border-blood" : small ? "h-11 w-11 border-white" : "h-14 w-14 border-white"}`}
                >
                  <Image src={areaSrc(id, tier)} alt="" fill unoptimized sizes="72px" onError={onPhotoError} className="object-cover" />
                </span>
                {s.remaining > 0 && <span key={s.remaining} className={`m-badge absolute -top-1 -right-1 ${s.openNow ? "" : "m-badge-quiet"}`}>{s.remaining}</span>}
                {!s.remaining && ready && (
                  <span className="m-badge absolute -top-1 -right-1 px-1" aria-hidden="true">
                    <Icon name="coin" className="h-3.5 w-3.5" />
                  </span>
                )}
              </span>
              <span className={`chip chip-solid border-white whitespace-nowrap ${small ? "text-xs" : ""}`}>{PLACE_LABEL[id]}</span>
            </button>
          );
        })}
      </section>

      {/* The one most likely next tap. */}
      {next && focal ? (
        <button className="btn btn-hero w-full justify-start gap-3 px-4 normal-case tracking-normal" onClick={() => setPlace(focal)}>
          <Icon name={CATEGORY_ICON[next.category] ?? "quests"} className="h-6 w-6 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-left">{next.title}</span>
          <Icon name="chevron" className="h-5 w-5 shrink-0" />
        </button>
      ) : unopened ? (
        <button className="btn btn-hero w-full" onClick={() => setChest(unopened)}>
          <Icon name="chest" /> Open chest
        </button>
      ) : v.quests.every((q) => q.status !== "active") ? (
        <Link href={`${APP_BASE_PATH}/tasks/new?start=1`} className="btn btn-hero w-full">
          <Icon name="plus" /> Add tasks
        </Link>
      ) : null}

      {place && !verifying && !rating && <PlaceSheet area={place} onClose={() => setPlace(null)} onVerify={setVerifying} onRate={setRating} />}
      {verifying && <VerifySheet due={verifying} onClose={() => setVerifying(null)} />}
      {rating?.sessionId && <RatingSheet sessionId={rating.sessionId} title={rating.title} maxXp={rating.maxXp} onClose={() => setRating(null)} />}
      {chest && <ChestSheet chest={chest} onClose={() => setChest(null)} />}
      {moneyOpen && <MoneySheet onClose={() => setMoneyOpen(false)} />}
    </div>
  );
}
