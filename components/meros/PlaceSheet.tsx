"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { APP_BASE_PATH } from "@/lib/meros/config";
import { areaSrc, onPhotoError } from "@/lib/meros/content/art";
import { AREAS_BY_ID, type AreaId } from "@/lib/meros/content/estate";
import { PLACE_CATEGORIES, PLACE_LABEL, type PlaceLocation } from "@/lib/meros/content/places";
import type { DueView } from "@/lib/meros/service/view";
import { useAction, useGame } from "./GameProvider";
import LocationPicker from "./LocationPicker";
import { isRemaining, placeStatus } from "./places";
import TaskRow from "./TaskRow";
import { Icon, Note, Sheet } from "./ui";

/**
 * A building on the Home map, opened: today's tasks for it with one big button for the next one,
 * where it is in real life, a way to add a task here, and the building's next upgrade.
 */
export default function PlaceSheet({
  area,
  onClose,
  onVerify,
  onRate,
}: {
  area: AreaId;
  onClose: () => void;
  onVerify: (d: DueView) => void;
  onRate: (d: DueView) => void;
}) {
  const game = useGame();
  const v = game.view!;
  const status = placeStatus(v, area);
  const hasTasks = PLACE_CATEGORIES[area].length > 0;
  const focal = status.due.find((d) => isRemaining(d) && d.phase === "open")?.occurrenceId;
  const loc = v.profile.places[area] ?? null;
  const [editingLoc, setEditingLoc] = useState(false);
  const [draft, setDraft] = useState<PlaceLocation | null>(loc);
  const save = useAction<{ moved: number }>();
  const tier = v.estate.tiers[area] ?? 0;
  const anyOther = Object.values(v.profile.places).find(Boolean) ?? null;
  const count = v.quests.filter((q) => q.status === "active" && PLACE_CATEGORIES[area].includes(q.definition.category)).length;

  async function saveLocation() {
    if (!draft) return;
    const r = await save.execute({ type: "setPlace", area, location: draft });
    if (r) {
      setEditingLoc(false);
      game.sound("tap");
      if (r.moved) game.celebrate({ kind: "info", title: `${PLACE_LABEL[area]} moved`, lines: [`${r.moved} task${r.moved > 1 ? "s" : ""} updated`] });
    }
  }

  return (
    <Sheet open onClose={onClose} title={PLACE_LABEL[area]}>
      <div className="flex flex-col gap-5">
        <div className="relative -mx-1 aspect-[16/7] overflow-hidden rounded-2xl">
          <Image src={areaSrc(area, tier)} alt="" fill unoptimized sizes="28rem" onError={onPhotoError} className="object-cover" />
          {hasTasks && (
            <span className="chip chip-solid absolute bottom-2 left-2 border-white">
              <Icon name="quests" className="h-4 w-4" /> {count}
            </span>
          )}
        </div>

        {hasTasks && (
          <section aria-label="Where it is" className="flex flex-col gap-2">
            {!editingLoc ? (
              <button type="button" className="flex min-h-11 items-center gap-2 text-left font-bold" onClick={() => setEditingLoc(true)}>
                <Icon name="pin" />
                <span className="min-w-0 flex-1 truncate">{loc ? loc.label : `Where’s your ${PLACE_LABEL[area].toLowerCase()}?`}</span>
                <span className="chip">{loc ? "Move" : "Set"}</span>
              </button>
            ) : (
              <div className="m-rise flex flex-col gap-3">
                <LocationPicker value={draft} defaultLabel={PLACE_LABEL[area]} near={loc ?? anyOther} onChange={setDraft} />
                {save.error && <Note tone="error">{save.error.message}</Note>}
                <div className="grid grid-cols-[auto_1fr] gap-2">
                  <button type="button" className="btn btn-ghost" onClick={() => (setEditingLoc(false), setDraft(loc))}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-hero" disabled={!draft || save.pending} onClick={() => void saveLocation()}>
                    <Icon name="check" /> Save spot
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {hasTasks && (
          <section aria-label="Today" className="flex flex-col">
            {status.due.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <Icon name="check" className="h-8 w-8" />
                <p className="font-display text-xl">Nothing due here today</p>
              </div>
            ) : (
              <ul className="m-list flex flex-col">
                {status.due.map((d) => (
                  <li key={d.occurrenceId} className="rule">
                    <TaskRow due={d} focal={!editingLoc && d.occurrenceId === focal} timezone={v.profile.timezone} onVerify={() => onVerify(d)} onRate={() => onRate(d)} />
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={`${APP_BASE_PATH}/tasks/new?place=${area}`}
              className={`btn w-full ${status.due.length === 0 && count === 0 ? "btn-hero" : "btn-secondary"} mt-2`}
            >
              <Icon name="plus" /> {PLACE_LABEL[area]} task
            </Link>
          </section>
        )}

        {area === "residence" && (
          <Link href={`${APP_BASE_PATH}/house`} className="btn btn-secondary w-full">
            <Icon name="user" /> Go inside
          </Link>
        )}

        <BuildRow area={area} hero={!hasTasks} />
      </div>
    </Sheet>
  );
}

/** The building's next upgrade, in one row: picture, name, price, one button. */
function BuildRow({ area, hero }: { area: AreaId; hero: boolean }) {
  const game = useGame();
  const v = game.view!;
  const def = AREAS_BY_ID.get(area)!;
  const info = v.estate.areas.find((a) => a.id === area)!;
  const next = def.tiers[info.tier];
  const action = useAction<{ name: string }>();

  async function build() {
    const res = await action.execute({ type: "upgradeBuilding", area });
    if (res) game.celebrate({ kind: "victory", title: `${res.name} built!`, lines: [] }, "victory");
  }

  return (
    <section aria-label="Upgrade" className="rule flex flex-col gap-3 pt-4">
      <div className="flex items-center gap-3">
        {next && <Image src={areaSrc(area, next.tier)} alt={next.name} width={96} height={72} unoptimized onError={onPhotoError} className="h-14 w-[4.5rem] shrink-0 rounded-lg object-cover" />}
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg leading-tight">{next ? next.name : "Fully built"}</p>
          <span className="flex gap-1 pt-1" aria-label={`Tier ${info.tier} of 3`}>
            {[1, 2, 3].map((t) => (
              <span key={t} className={`h-2 w-6 rounded-full border border-blood ${t <= info.tier ? "bg-blood" : "bg-white"}`} />
            ))}
          </span>
        </div>
        {next && (
          <button className={`btn ${info.canUpgrade && hero ? "btn-hero" : "btn-secondary"} shrink-0 px-4`} disabled={!info.canUpgrade || action.pending} aria-label={`Build ${next.name} for ${next.cost} credits`} onClick={() => void build()}>
            <Icon name="coin" /> {next.cost}
          </button>
        )}
      </div>
      {next && !info.canUpgrade && info.reason && <p className="hint">{info.reason}</p>}
      {action.error && <Note tone="error">{action.error.message}</Note>}
    </section>
  );
}
