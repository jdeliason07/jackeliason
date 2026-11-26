"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { APP_BASE_PATH } from "@/lib/meros/config";
import { LEVEL_UNLOCKS } from "@/lib/meros/content/appearance";
import { areaSrc, CHEST_SRC, citySrc, onPhotoError } from "@/lib/meros/content/art";
import { CITY_STAGES } from "@/lib/meros/content/home";
import { AREAS, type AreaId } from "@/lib/meros/content/estate";
import { PLACE_LABEL, TASK_PLACES } from "@/lib/meros/content/places";
import type { DueView, GameView } from "@/lib/meros/service/view";
import ChestSheet from "../ChestSheet";
import { useGame } from "../GameProvider";
import MoneySheet from "../MoneySheet";
import { Count } from "../motion";
import PlaceSheet from "../PlaceSheet";
import { focalPlace, placeStatus } from "../places";
import RatingSheet from "../RatingSheet";
import { CATEGORY_ICON, Icon, ProgressBar } from "../ui";
import VerifySheet from "../VerifySheet";

/**
 * Where each building sits in the city photographs (public/meros/art/city), in percent of the
 * IMAGE, not the screen: the map crops the picture to fit the phone, and the buttons ride on an
 * image-sized layer so they stay on their buildings at any crop. Every stage is an edit of the first
 * photo from the same camera, so one set works for all of them. Nudged apart slightly so the
 * buttons don't cover each other.
 */
const SPOTS: Record<AreaId, { x: number; y: number }> = {
  gardens: { x: 46, y: 40.5 },
  library: { x: 66, y: 46 },
  residence: { x: 30, y: 51.5 },
  office: { x: 85, y: 51 },
  gym: { x: 48, y: 60 },
  workshop: { x: 71, y: 64.5 },
};

/**
 * Which part of the photo stays in view where the screen crops it: 0 = top/left, 1 = bottom/right.
 * Phones are taller than the 9:16 photo, so they crop its sides; X leans right because the
 * buildings sit right of centre (30–85%), which keeps the Office button on screen.
 */
const FOCUS_X = 0.65;
const FOCUS_Y = 0.32;

/**
 * Home: your corner of the city from above, filling the whole screen behind everything else (the
 * Shell's header and nav float over it). Mostly open land at first; it fills in as you level.
 * Each building holds its tasks (the gym your fitness, the office
 * your work, the library your learning) and shows a bubble with what's still due today. The
 * building with the next open task pulses, and the big button at the bottom goes straight there.
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
  const nextStage = CITY_STAGES.find((l) => l > p.progress.level);
  const nextCity = nextStage ? LEVEL_UNLOCKS.find((u) => u.level === nextStage && u.estate)?.estate : null;

  return (
    <div className="flex flex-1 flex-col gap-3">
      {/*
       * The city, cover-fit to the screen. The image-sized layer is as wide or as tall as it must be
       * to cover, then shifted so FOCUS_X/FOCUS_Y of the overflow is cropped; the building buttons
       * ride on that layer, so they stay on their buildings at any screen shape.
       */}
      <section aria-label="Your block" className="m-fade fixed inset-0 z-0 mx-auto w-full max-w-lg overflow-hidden [container-type:size]">
        <div
          className="absolute aspect-[9/16]"
          style={{
            width: "max(100cqw, 56.25cqh)",
            left: `calc((100cqw - max(100cqw, 56.25cqh)) * ${FOCUS_X})`,
            top: `calc((100cqh - max(177.78cqw, 100cqh)) * ${FOCUS_Y})`,
          }}
        >
          <Image src={citySrc(p.progress.level)} alt="Your corner of the city from above" fill priority unoptimized sizes="32rem" onError={onPhotoError} className="m-drift object-cover" />
          {AREAS.map((a) => {
            const id = a.id as AreaId;
            const spot = SPOTS[id];
            const s = placeStatus(v, id);
            const isFocal = id === focal;
            const small = id === "workshop";
            const tier = v.estate.tiers[id] ?? 0;
            const ready = v.estate.areas.find((x) => x.id === id)?.canUpgrade || (id === "residence" && v.estate.home.nextFurnish?.canBuy);
            return (
              <button
                key={id}
                type="button"
                onClick={() => setPlace(id)}
                aria-label={`${PLACE_LABEL[id]}${s.remaining ? `: ${s.remaining} to do` : ""}${ready ? ", upgrade ready" : ""}`}
                className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 transition-transform duration-300 ease-spring active:scale-90"
                style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
              >
                <span className="relative grid place-items-center">
                  {isFocal && <span aria-hidden="true" className="m-pulse-ring absolute h-full w-full rounded-full border-[3px] border-white" />}
                  <span
                    className={`relative block overflow-hidden rounded-full border-[3px] shadow-[0_6px_14px_rgb(0_0_0/0.4)] ${isFocal ? "h-16 w-16 border-blood" : small ? "h-10 w-10 border-white" : "h-12 w-12 border-white"}`}
                  >
                    <Image src={areaSrc(id, tier)} alt="" fill unoptimized sizes="64px" onError={onPhotoError} className="object-cover" />
                  </span>
                  {s.remaining > 0 && <span key={s.remaining} className={`m-badge absolute -top-1 -right-1 ${s.openNow ? "" : "m-badge-quiet"}`}>{s.remaining}</span>}
                  {!s.remaining && ready && (
                    <span className="m-badge absolute -top-1 -right-1 px-1" aria-hidden="true">
                      <Icon name="coin" className="h-3.5 w-3.5" />
                    </span>
                  )}
                </span>
                <span className="chip chip-solid border-white px-2 py-0 text-xs whitespace-nowrap">{PLACE_LABEL[id]}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* You, in three numbers: level, real money, the next chest. Each sits on its own white capsule over the photo. */}
      <section aria-label="You" className="relative z-10 flex items-center gap-3">
        <Link href={`${APP_BASE_PATH}/progress`} className="m-hud min-w-0 flex-1 rounded-2xl px-3 py-2" aria-label={`Level ${p.progress.level}`}>
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
        <button type="button" onClick={() => setMoneyOpen(true)} className="chip m-hud min-h-11 gap-1.5 px-3 font-display text-lg" aria-label={`Money this month: ${Math.round(v.money.monthCents / 100)} dollars`}>
          <Icon name="wallet" className="h-5 w-5" />$<Count value={Math.round(v.money.monthCents / 100)} />
        </button>
        <button
          type="button"
          onClick={() => unopened && setChest(unopened)}
          disabled={!unopened}
          className="m-hud relative grid h-12 w-12 shrink-0 place-items-center rounded-full disabled:opacity-100"
          aria-label={unopened ? `${v.chests.unopened.length} chest ready` : `Next chest: ${v.chests.progress} of ${v.chests.perChest}`}
        >
          <Image src={CHEST_SRC} alt="" width={560} height={560} unoptimized className={`h-9 w-9 object-contain ${unopened ? "m-breathe" : "opacity-40 grayscale"}`} />
          {unopened ? (
            <span className="m-badge absolute -top-1 -right-1">{v.chests.unopened.length}</span>
          ) : (
            <span className="m-badge m-badge-quiet absolute -right-1 -bottom-1 text-[0.6875rem]">
              {v.chests.progress}/{v.chests.perChest}
            </span>
          )}
        </button>
      </section>

      {nextCity && nextStage && (
        <Link href={`${APP_BASE_PATH}/progress`} className="m-hud relative z-10 flex max-w-full items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-xs font-bold">
          <Icon name="lock" className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">LV {nextStage}: {nextCity}</span>
        </Link>
      )}

      {/* The one most likely next tap, pinned to the bottom of the screen above the nav. */}
      <div className="relative z-10 mt-auto empty:hidden">
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
      </div>

      {place && !verifying && !rating && <PlaceSheet area={place} onClose={() => setPlace(null)} onVerify={setVerifying} onRate={setRating} />}
      {verifying && <VerifySheet due={verifying} onClose={() => setVerifying(null)} />}
      {rating?.sessionId && <RatingSheet sessionId={rating.sessionId} title={rating.title} maxXp={rating.maxXp} onClose={() => setRating(null)} />}
      {chest && <ChestSheet chest={chest} onClose={() => setChest(null)} />}
      {moneyOpen && <MoneySheet onClose={() => setMoneyOpen(false)} />}
    </div>
  );
}
