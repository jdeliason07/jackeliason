"use client";

import { useState } from "react";
import { BATTLE_REWARDS } from "@/lib/meros/config";
import { CATEGORY_LABEL, SCENARIOS_BY_ID, TUTORIAL_SCENARIO_ID } from "@/lib/meros/content/battles";
import { TAG_LABEL } from "@/lib/meros/domain/battle";
import { STAT_LABEL } from "@/lib/meros/domain/stats";
import type { BattleView } from "@/lib/meros/service/view";
import RiseArrow from "../art/RiseArrow";
import { useAction, useGame } from "../GameProvider";
import { Icon, Note, ProgressBar } from "../ui";

export default function Ventures() {
  const game = useGame();
  const v = game.view!;
  const [finished, setFinished] = useState<BattleView | null>(null);
  const active = v.ventures.active;

  if (finished) return <Battle battle={finished} onFinished={setFinished} onBack={() => setFinished(null)} />;
  if (active) return <Battle battle={active} onFinished={setFinished} onBack={() => undefined} />;
  return <VentureList />;
}

function VentureList() {
  const game = useGame();
  const v = game.view!;
  const start = useAction<{ battleId: string }>();
  const [practice, setPractice] = useState(false);
  const outcomeLabel = { victory: "Victory", partial: "Partial", defeat: "Short" } as Record<string, string>;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-semibold">Ventures</h1>
      <section className="card flex flex-col gap-3 p-4" aria-label="Tickets">
        <div className="flex items-center justify-between">
          <p className="font-display text-lg font-semibold">
            <Icon name="ticket" className="mr-1 inline h-5 w-5" />
            {v.ventures.tickets}/{v.ventures.maxStored} tickets
          </p>
          <span className="text-sm font-bold text-muted">
            {v.ventures.earnedToday}/{v.ventures.maxPerDay} earned today
          </span>
        </div>
        <p className="hint">
          Each verified minimum earns one ticket (up to {v.ventures.maxPerDay} a day). A rewarded venture pays {BATTLE_REWARDS.completion} Estate Credits, +{BATTLE_REWARDS.victoryBonus} for a victory. Ventures never grant XP. Rivals are fictional characters.
        </p>
        <div role="radiogroup" aria-label="Venture mode" className="grid grid-cols-2 gap-2">
          <button role="radio" aria-checked={!practice} className={`btn ${!practice ? "btn-primary" : "btn-secondary"}`} onClick={() => setPractice(false)}>
            Rewarded
          </button>
          <button role="radio" aria-checked={practice} className={`btn ${practice ? "btn-primary" : "btn-secondary"}`} onClick={() => setPractice(true)}>
            Practice
          </button>
        </div>
        {practice && <p className="hint">Practice: no ticket, no rewards. The Harbor Lease includes a tutorial.</p>}
        {!practice && v.ventures.tickets === 0 && <Note tone="info">No tickets yet. Complete a quest’s minimum to earn one, or play Practice.</Note>}
      </section>
      {start.error && <Note tone="error">{start.error.message}</Note>}
      <ul className="flex flex-col gap-3">
        {v.ventures.scenarios.map((s) => {
          const scenario = SCENARIOS_BY_ID.get(s.id)!;
          const disabled = start.pending || (!practice && v.ventures.tickets === 0);
          return (
            <li key={s.id} className="card flex items-center gap-3 p-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl font-display text-xl font-semibold text-white" style={{ background: scenario.opponent.color }} aria-hidden="true">
                {scenario.opponent.name[0]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.8125rem] font-extrabold text-muted">{s.category}</p>
                <p className="font-display text-base leading-tight font-semibold">{s.title}</p>
                <p className="hint truncate">{s.objective}</p>
              </div>
              <button
                className="btn btn-primary min-h-11 shrink-0 px-4"
                disabled={disabled}
                aria-label={`${practice ? "Practice" : "Start"} ${s.title}`}
                onClick={() => void start.execute({ type: "startBattle", scenarioId: s.id, mode: practice ? "practice" : "rewarded" })}
              >
                {practice ? "Practice" : "Play"}
              </button>
            </li>
          );
        })}
      </ul>
      {v.ventures.recent.length > 0 && (
        <section className="card p-4">
          <h2 className="font-display text-lg font-semibold">Recent ventures</h2>
          <ul className="mt-2 flex flex-col divide-y divide-line">
            {v.ventures.recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2 text-[0.9375rem]">
                <span>{SCENARIOS_BY_ID.get(r.scenarioId)?.title}</span>
                <span className="font-bold text-muted">
                  {r.outcome ? outcomeLabel[r.outcome] : "Forfeited"}
                  {r.mode === "practice" ? " · practice" : r.rewardCredits ? ` · +${r.rewardCredits}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Battle({ battle, onFinished, onBack }: { battle: BattleView; onFinished: (b: BattleView) => void; onBack: () => void }) {
  const game = useGame();
  const choose = useAction<{ battle: BattleView }>();
  const forfeit = useAction();
  const scenario = SCENARIOS_BY_ID.get(battle.scenarioId)!;
  const round = scenario.rounds[Math.min(battle.round, 3) - 1];
  const last = battle.turns.at(-1);
  const done = battle.status !== "active";
  const tutorial = battle.mode === "practice" && battle.scenarioId === TUTORIAL_SCENARIO_ID;
  const score = battle.meter + battle.capital;

  async function pick(choiceId: string) {
    const res = await choose.execute({ type: "chooseBattle", battleId: battle.id, round: battle.round, choiceId });
    if (res?.battle.status === "finished") {
      onFinished(res.battle);
      game.sound(res.battle.outcome === "victory" ? "victory" : "soft");
    } else if (res) game.sound("tap");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl font-display text-xl font-semibold text-white" style={{ background: scenario.opponent.color }} aria-hidden="true">
          {scenario.opponent.name[0]}
        </span>
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-extrabold text-muted">
            {CATEGORY_LABEL[scenario.category]} · {battle.mode === "practice" ? "Practice (no rewards)" : "Rewarded"}
          </p>
          <h1 className="font-display text-xl leading-tight font-semibold">{scenario.title}</h1>
          <p className="hint">
            vs. {scenario.opponent.name}, {scenario.opponent.role}: {scenario.opponent.style}
          </p>
        </div>
      </div>

      <section className="card flex flex-col gap-2 p-4" aria-label="Scoreboard">
        <p className="text-[0.9375rem]">
          <strong>Objective:</strong> {scenario.objective}
        </p>
        <div className="flex items-center justify-between text-sm font-extrabold">
          <span>
            {scenario.meterLabel}: {battle.meter} + {battle.capital} Capital = {score}
          </span>
          <span className="text-muted">Goal {battle.target}{battle.targetBonus ? ` (+${battle.targetBonus} for your strength)` : ""}</span>
        </div>
        <ProgressBar value={score} max={battle.target} color={score >= battle.target ? "var(--color-bone)" : "var(--color-blood-bright)"} label={`${scenario.meterLabel} toward goal`} />
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="chip bg-blood-soft">
            <Icon name="coin" className="h-4 w-4" /> {battle.capital} Capital
          </span>
          <span className="chip bg-raised">Round {Math.min(battle.round, 3)}/3</span>
          {(["insight", "execution", "influence"] as const).map((s) => (
            <span key={s} className="chip bg-raised">
              {STAT_LABEL[s]} {battle.loadout.stats[s]}
            </span>
          ))}
          {battle.loadout.vitalityModifier < 1 && <span className="chip bg-danger-soft">Vitality ×{battle.loadout.vitalityModifier.toFixed(2)}</span>}
        </div>
        <details>
          <summary className="min-h-10 cursor-pointer content-center text-sm font-extrabold">Conditions</summary>
          <ul className="hint list-disc pl-5">
            {scenario.conditions.map((c) => (
              <li key={c}>{c}</li>
            ))}
            <li>Unspent Capital counts toward your final score.</li>
          </ul>
        </details>
      </section>

      {last && (
        <section className="meros-rise rounded-3xl bg-raised p-4" aria-live="polite">
          <p className="font-extrabold">
            Round {last.round}: net {last.delta >= 0 ? "+" : ""}
            {last.delta}
          </p>
          {last.lines.map((l, i) => (
            <p key={i} className="text-[0.9375rem] text-fg-soft">
              {l}
            </p>
          ))}
        </section>
      )}

      {!done && (
        <section className="flex flex-col gap-3" aria-label={`Round ${battle.round}`}>
          <div className="card p-4">
            <h2 className="font-display text-lg font-semibold">{round.title}</h2>
            <p className="text-[0.9375rem]">{round.situation}</p>
            <p className="mt-2 rounded-2xl bg-blood-soft px-3 py-2 text-[0.9375rem]">
              <strong>Signal:</strong> {round.signal}
            </p>
            {battle.revealedIntent ? (
              <p className="mt-2 rounded-2xl bg-success-soft px-3 py-2 text-[0.9375rem]">
                <strong>Scouted:</strong> {battle.revealedIntent.label}. {battle.revealedIntent.detail} Countered by {battle.revealedIntent.weakTo.map((t) => TAG_LABEL[t as keyof typeof TAG_LABEL]).join(" or ")}.
              </p>
            ) : (
              <p className="hint mt-2">Their move is hidden. Research reveals the next one.</p>
            )}
            {battle.weaknessKnown && <p className="mt-2 text-[0.9375rem]"><strong>Weakness:</strong> {scenario.weakness}</p>}
            {tutorial && (
              <Note tone="info">
                Tutorial: each option shows what you can count on (base + your stat + estate bonus). If its tactic counters the opponent’s move, you also gain +{scenario.counterBonus} and halve their pressure. Research costs a little now but reveals the next move.
              </Note>
            )}
          </div>
          {choose.error && <Note tone="error">{choose.error.message}</Note>}
          <ul className="flex flex-col gap-2">
            {battle.choices.map((c) => {
              const disabled = !c.affordable || c.locked || choose.pending;
              return (
                <li key={c.id}>
                  <button
                    className={`card flex w-full flex-col items-start gap-1 p-4 text-left transition-transform active:scale-[0.99] ${disabled ? "opacity-60" : "hover:ring-2 hover:ring-blood"}`}
                    disabled={disabled}
                    onClick={() => void pick(c.id)}
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="font-display text-base font-semibold">{c.label}</span>
                      <span className="chip shrink-0 bg-blood-soft">{c.cost === 0 ? "Free" : `${c.cost} Capital`}</span>
                    </span>
                    <span className="text-[0.9375rem] text-fg-soft">{c.detail}</span>
                    <span className="flex flex-wrap gap-1.5 text-[0.8125rem] font-bold">
                      <span className="chip bg-raised">{TAG_LABEL[c.tag]}</span>
                      <span className="chip bg-raised">{STAT_LABEL[c.stat]}</span>
                      <span className="chip border border-line bg-bg">≈ +{c.estimate}</span>
                      {c.defense ? <span className="chip bg-success-soft">Blocks {c.defense}</span> : null}
                      {c.reveals ? <span className="chip bg-bone-soft text-bone">Reveals next move</span> : null}
                      {c.exploits ? <span className="chip bg-bone-soft text-bone">{c.locked ? "Needs research" : "Uses weakness"}</span> : null}
                      {c.yield ? <span className="chip bg-blood-soft">Returns {c.yield}</span> : null}
                      {!c.affordable && <span className="chip bg-danger-soft">Not enough Capital</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button className="btn btn-ghost w-full" disabled={forfeit.pending} onClick={() => void forfeit.execute({ type: "forfeitBattle", battleId: battle.id })}>
            Forfeit{battle.mode === "rewarded" ? " (ticket is not returned)" : ""}
          </button>
        </section>
      )}

      {done && battle.summary && (
        <section className={`meros-pop relative flex flex-col gap-3 overflow-hidden rounded-2xl p-5 ${battle.outcome === "victory" ? "red-surface" : "card"}`} aria-label="Summary">
          {battle.outcome === "victory" && <RiseArrow opacity={0.9} />}
          <p className={`relative font-display text-[4.25rem] leading-[0.85] ${battle.outcome === "victory" ? "text-bone" : battle.outcome === "partial" ? "outline-type" : "text-muted"}`}>
            {battle.outcome === "victory" ? "Victory" : battle.outcome === "partial" ? "Partial" : "Defeat"}
          </p>
          <p className="relative">{battle.summary.headline}</p>
          <ul className="relative flex flex-col gap-1.5">
            {battle.summary.notes.map((n, i) => (
              <li key={i} className={`text-[0.9375rem] ${battle.outcome === "victory" ? "text-bone/85" : "text-fg-soft"}`}>
                {n}
              </li>
            ))}
          </ul>
          <p className="relative font-extrabold">{battle.mode === "rewarded" ? `+${battle.rewardCredits} Estate Credits` : "Practice: no rewards"}</p>
          <button className={`btn relative w-full ${battle.outcome === "victory" ? "btn-go" : "btn-primary"}`} onClick={onBack}>
            Back to Ventures
          </button>
        </section>
      )}
    </div>
  );
}
