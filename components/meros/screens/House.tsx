"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { APP_BASE_PATH } from "@/lib/meros/config";
import { homeExteriorSrc, homeInteriorSrc, onPhotoError, QUEST_DESK_SRC } from "@/lib/meros/content/art";
import { FURNISH_STEPS } from "@/lib/meros/content/home";
import Character from "../art/Character";
import { useAction, useGame } from "../GameProvider";
import { Sparks } from "../motion";
import { Hotspot, Icon, Note } from "../ui";

/**
 * Inside where you live. You start in a bare basement room; credits buy furniture (three steps per
 * home) and, once your level allows, a move up the ladder to a bigger place that starts empty again.
 * Tap yourself to change your look, the desk for your tasks.
 */
export default function House() {
  const game = useGame();
  const v = game.view!;
  const p = v.profile;
  const h = v.estate.home;
  const active = v.quests.filter((q) => q.status === "active").length;
  const furnish = useAction<{ name: string }>();
  const move = useAction<{ name: string }>();
  const [confirmMove, setConfirmMove] = useState(false);
  const [bump, setBump] = useState(0);
  const heroMove = Boolean(h.nextHome?.canMove);
  const heroFurnish = !heroMove && Boolean(h.nextFurnish?.canBuy);

  async function buyFurniture() {
    const r = await furnish.execute({ type: "furnishHome" });
    if (r) {
      setBump((n) => n + 1);
      game.celebrate({ kind: "victory", title: `${r.name}: done`, lines: [h.name] }, "victory");
    }
  }

  async function moveUp() {
    const r = await move.execute({ type: "upgradeBuilding", area: "residence" });
    setConfirmMove(false);
    if (r) {
      setBump((n) => n + 1);
      game.celebrate({ kind: "victory", title: "Moved in!", lines: [r.name] }, "victory");
    }
  }

  const error = furnish.error ?? move.error;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Link href={APP_BASE_PATH} className="btn btn-ghost -ml-2 px-2">
          <Icon name="back" /> Home
        </Link>
        <div className="min-w-0 text-right">
          <p className="eyebrow truncate">{h.name}</p>
          <span className="mt-1 flex justify-end gap-1" aria-label={`Furnished ${h.furnished} of ${FURNISH_STEPS.length}`}>
            {FURNISH_STEPS.map((s, i) => (
              <span key={s} className={`h-2 w-5 rounded-full border border-blood ${i < h.furnished ? "bg-blood" : "bg-white"}`} />
            ))}
          </span>
        </div>
      </div>

      <section aria-label="Your home" className="relative isolate aspect-[9/16] max-h-[calc(100dvh-23rem)] min-h-72 w-full overflow-hidden rounded-2xl">
        <Image
          key={`${h.tier}-${h.furnished}`}
          src={homeInteriorSrc(h.tier, h.furnished)}
          alt={`Inside your ${h.name.toLowerCase()}`}
          fill
          priority
          unoptimized
          sizes="32rem"
          onError={onPhotoError}
          className={`object-cover ${bump ? "m-build" : "m-drift"}`}
        />
        {bump > 0 && <Sparks key={bump} count={18} distance={140} delay={450} />}

        {/* His canvas is mostly transparent around him, so it may sit behind the desk; the desk link comes later and stays on top. */}
        <Link href={`${APP_BASE_PATH}/dress`} aria-label="Dress your character" className="group absolute bottom-[1%] left-[-14%] aspect-[3/4] h-[96%]">
          <Character appearance={p.appearance} level={p.progress.level} energy={p.energy} backdrop="none" animate className="h-full w-full transition-transform duration-300 ease-spring group-active:scale-95" />
          <Hotspot label="Dress" className="top-[6%] left-1/2 -translate-x-1/2" />
        </Link>

        <Link href={`${APP_BASE_PATH}/tasks`} aria-label={`Tasks (${active} active)`} className="group absolute right-[2%] bottom-[6%] w-[44%]">
          <span className="m-breathe block transition-transform duration-300 ease-spring group-active:scale-95">
            <Image src={QUEST_DESK_SRC} alt="" width={560} height={560} unoptimized onError={onPhotoError} className="h-auto w-full drop-shadow-[0_10px_14px_rgb(0_0_0/0.35)]" />
          </span>
          <Hotspot label={`Tasks · ${active}`} className="-top-3 left-1/2 -translate-x-1/2" />
        </Link>
      </section>

      {/* Furnish this place. */}
      {h.nextFurnish ? (
        <button
          className={`btn w-full justify-between px-4 ${heroFurnish ? "btn-hero" : "btn-secondary"}`}
          disabled={!h.nextFurnish.canBuy || furnish.pending}
          onClick={() => void buyFurniture()}
          aria-label={`Furnish: ${h.nextFurnish.name} for ${h.nextFurnish.cost} credits`}
        >
          <span className="flex items-center gap-2">
            <Icon name="home" /> {h.nextFurnish.name}
          </span>
          <span className="flex items-center gap-1">
            <Icon name="coin" /> {h.nextFurnish.cost}
          </span>
        </button>
      ) : (
        <p className="flex items-center justify-center gap-2 font-display text-lg">
          <Icon name="check" /> Fully furnished
        </p>
      )}

      {/* The next place on the ladder. */}
      {h.nextHome && (
        <div className={`flex items-center gap-3 rounded-2xl border-[1.5px] border-blood p-2 pr-3 ${h.nextHome.canMove ? "" : "opacity-80"}`}>
          <Image src={homeExteriorSrc(h.nextHome.tier)} alt="" width={96} height={72} unoptimized onError={onPhotoError} className="h-14 w-[4.5rem] shrink-0 rounded-lg object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg leading-tight">{h.nextHome.name}</p>
            <p className="flex items-center gap-2 text-sm font-bold">
              <span className="inline-flex items-center gap-0.5">
                {p.progress.level < h.nextHome.minLevel && <Icon name="lock" className="h-3.5 w-3.5" />} LV {h.nextHome.minLevel}
              </span>
              <span className="inline-flex items-center gap-0.5">
                <Icon name="coin" className="h-3.5 w-3.5" /> {h.nextHome.cost}
              </span>
            </p>
          </div>
          {confirmMove ? (
            <button className="btn btn-hero shrink-0 px-4" disabled={move.pending} onClick={() => void moveUp()}>
              Move
            </button>
          ) : (
            <button
              className={`btn shrink-0 px-4 ${heroMove ? "btn-hero" : "btn-secondary"}`}
              disabled={!h.nextHome.canMove}
              onClick={() => setConfirmMove(true)}
              aria-label={`Move to ${h.nextHome.name} for ${h.nextHome.cost} credits`}
            >
              <Icon name="chevron" />
            </button>
          )}
        </div>
      )}
      {confirmMove && <Note tone="info">New place, empty rooms. You’ll furnish it again.</Note>}
      {error && <Note tone="error">{error.message}</Note>}
    </div>
  );
}
