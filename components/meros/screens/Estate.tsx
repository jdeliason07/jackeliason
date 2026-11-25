"use client";

import Link from "next/link";
import { useState } from "react";
import { APP_BASE_PATH } from "@/lib/meros/config";
import { AREAS, AREAS_BY_ID, type AreaId } from "@/lib/meros/content/estate";
import EstateScene from "../art/EstateScene";
import { useAction, useGame } from "../GameProvider";
import { Count } from "../motion";
import { Icon, Note, Sheet } from "../ui";

export default function Estate() {
  const game = useGame();
  const v = game.view!;
  const [selected, setSelected] = useState<AreaId | null>(null);
  const totalTiers = Object.values(v.estate.tiers).reduce((s, t) => s + t, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-[2.25rem] leading-none">Estate</h1>
        <span className="font-display text-xl" aria-label={`${totalTiers} of 18 upgrades`}>
          <Count value={totalTiers} />/18
        </span>
      </div>
      <div className="overflow-hidden rounded-2xl">
        <EstateScene
          tiers={v.estate.tiers}
          level={v.profile.progress.level}
          decorations={v.estate.placedDecorations}
          onSelect={setSelected}
          selected={selected}
          className="block h-auto w-full"
        />
      </div>
      <ul className="m-list grid grid-cols-2 gap-3">
        {AREAS.map((a) => {
          const info = v.estate.areas.find((x) => x.id === a.id)!;
          const name = info.tier === 0 ? a.baseName : a.tiers[info.tier - 1].name;
          return (
            <li key={a.id}>
              <button className="card flex h-full w-full flex-col items-start gap-1 p-3 text-left" onClick={() => setSelected(a.id)}>
                <span className="eyebrow">{a.name}</span>
                <span className="font-display text-lg leading-tight">{name}</span>
                <span className="flex gap-1" aria-label={`Tier ${info.tier} of 3`}>
                  {[1, 2, 3].map((t) => (
                    <span key={t} className={`h-2 w-6 rounded-full border border-blood transition-colors duration-300 ${t <= info.tier ? "bg-blood" : "bg-white"}`} />
                  ))}
                </span>
                {info.nextCost !== null && (
                  <span className={`mt-1 inline-flex items-center gap-1 text-sm font-bold whitespace-nowrap ${info.canUpgrade ? "chip chip-solid" : ""}`}>
                    <Icon name="coin" className="h-3.5 w-3.5" />
                    {info.canUpgrade ? `Ready: ${info.nextCost}` : `Next: ${info.nextCost}`}
                    <span className="sr-only"> credits</span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-sm">
        <Link href={`${APP_BASE_PATH}/collection`} className="font-extrabold underline decoration-2 underline-offset-4">
          Place decorations ({v.estate.placedDecorations.length}/{v.estate.bonuses.decorationSlots} slots)
        </Link>
      </p>
      {selected && <AreaSheet area={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function AreaSheet({ area, onClose }: { area: AreaId; onClose: () => void }) {
  const game = useGame();
  const v = game.view!;
  const def = AREAS_BY_ID.get(area)!;
  const info = v.estate.areas.find((a) => a.id === area)!;
  const action = useAction<{ name: string }>();
  const next = def.tiers[info.tier];
  const [preview, setPreview] = useState(false);

  async function upgrade() {
    const res = await action.execute({ type: "upgradeBuilding", area });
    if (res) game.celebrate({ kind: "victory", title: `${res.name} built!`, lines: ["Your estate just grew."] }, "victory");
  }

  return (
    <Sheet open onClose={onClose} title={def.name}>
      <div className="flex flex-col gap-4">
        <div className="overflow-hidden rounded-2xl">
          <EstateScene
            tiers={v.estate.tiers}
            level={v.profile.progress.level}
            decorations={v.estate.placedDecorations}
            preview={preview && next ? { area, tier: next.tier } : null}
            className="block h-auto w-full"
          />
        </div>
        <p className="font-normal">{def.purpose}</p>
        <ol className="m-list flex flex-col">
          {def.tiers.map((t) => {
            const owned = t.tier <= info.tier;
            return (
              <li key={t.tier} className={`rule py-3 ${t.tier === info.tier + 1 ? "border-l-2 border-l-blood pl-3" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-extrabold">
                    Tier {t.tier}: {t.name}
                  </p>
                  {owned ? <span className="chip chip-solid"><Icon name="check" className="h-4 w-4" /> Owned</span> : <span className="chip">{t.cost} credits</span>}
                </div>
                <p className="hint">{t.preview}</p>
                <p className="hint">
                  Needs Level {t.minLevel}
                  {Object.entries(t.requires).map(([req, tier]) => ` · ${AREAS_BY_ID.get(req as AreaId)!.name} tier ${tier}`)}
                </p>
              </li>
            );
          })}
        </ol>
        {next ? (
          <>
            <button className="btn btn-secondary w-full" onClick={() => setPreview((p) => !p)} aria-pressed={preview}>
              {preview ? "Show current" : `Preview ${next.name}`}
            </button>
            {!info.canUpgrade && info.reason && <Note tone="info">{info.reason}</Note>}
            {action.error && <Note tone="error">{action.error.message}</Note>}
            <button className="btn btn-primary w-full text-lg" disabled={!info.canUpgrade || action.pending} onClick={() => void upgrade()}>
              <Icon name="coin" /> Build {next.name} · {next.cost}
            </button>
          </>
        ) : (
          <Note tone="ok">Fully built.</Note>
        )}
      </div>
    </Sheet>
  );
}
