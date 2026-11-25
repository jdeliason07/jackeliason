import type { BattleTag } from "../content/estate";
import type { Stat } from "../content/items";
import { deriveSeed, seededRng, weightedPick } from "./random";

/**
 * Ventures: short, turn-based business challenges. Three rounds, explicit state machine:
 *
 *   round 1 ──choose──▶ round 2 ──choose──▶ round 3 ──choose──▶ finished(victory | partial | defeat)
 *
 * At the start of each round the fictional opponent's move ("intent") is decided from the battle's
 * stored seed, the round number, and the tactics you've used so far (opponents adapt). The decision
 * is stored with the battle, so a reload shows the same move: nothing rerolls. The round's signal
 * hints at the move; research reveals the next move exactly and exposes a weakness.
 *
 * A choice's result = power + your stat + estate tactic bonus (+ counter bonus if its tactic is the
 * opponent move's weakness) (+ exploit bonus once the weakness is known), minus the move's pressure
 * (halved by a counter, reduced by defense). Leftover Capital counts toward the final score, so
 * preserving resources is a real option. No live AI, no hidden rolls after the intent is fixed.
 */

export interface IntentDef {
  id: string;
  label: string;
  /** Shown once revealed. */
  detail: string;
  weight: number;
  pressure: number;
  /** Tactics that counter this move. */
  weakTo: BattleTag[];
  /** Opponents adapt: each prior use of `tag` adds `delta` to this move's weight. */
  adapts?: { tag: BattleTag; delta: number }[];
}

export interface ChoiceDef {
  id: string;
  label: string;
  detail: string;
  tag: BattleTag;
  stat: Stat;
  cost: number;
  power: number;
  /** Flat reduction of the opponent's pressure this round. */
  defense?: number;
  /** Capital returned after the round (e.g. a partner pays a fee). */
  yield?: number;
  /** Research: reveals the next round's opponent move and the opponent's weakness. */
  reveals?: boolean;
  /** Gains the scenario's exploit bonus once the weakness is known. */
  exploits?: boolean;
  /** Only selectable once the weakness is known. */
  requiresWeakness?: boolean;
}

export interface RoundDef {
  title: string;
  situation: string;
  signal: string;
  intents: IntentDef[];
  choices: ChoiceDef[];
}

export type ScenarioCategory = "negotiation" | "market_entry" | "product_launch" | "operations" | "competitive_bid";

export interface Scenario {
  id: string;
  version: number;
  title: string;
  category: ScenarioCategory;
  opponent: { name: string; role: string; style: string; color: string };
  objective: string;
  meterLabel: string;
  startMeter: number;
  target: number;
  capital: number;
  conditions: string[];
  weakness: string;
  exploitBonus: number;
  counterBonus: number;
  rounds: [RoundDef, RoundDef, RoundDef];
}

export interface BattleLoadout {
  stats: Record<Stat, number>;
  tactic: Record<BattleTag, number>;
  startingCapital: number;
  vitalityModifier: number;
}

export type BattleStatus = "active" | "finished";
export type BattleOutcome = "victory" | "partial" | "defeat";

export interface TurnResult {
  round: number;
  choiceId: string;
  intentId: string;
  countered: boolean;
  exploited: boolean;
  gain: number;
  pressure: number;
  delta: number;
  capitalSpent: number;
  capitalReturned: number;
  meterAfter: number;
  capitalAfter: number;
  revealed: boolean;
  lines: string[];
}

export interface BattleState {
  scenarioId: string;
  scenarioVersion: number;
  seed: number;
  status: BattleStatus;
  /** 1..3 while active; 3 after the last turn. */
  round: number;
  meter: number;
  capital: number;
  /** Opponent moves decided so far, by round (index 0 = round 1). Never rerolled. */
  intents: string[];
  /** Rounds whose opponent move the player has revealed. */
  revealedRounds: number[];
  weaknessKnown: boolean;
  tagsUsed: BattleTag[];
  turns: TurnResult[];
  outcome: BattleOutcome | null;
  finalScore: number | null;
  /** The objective for this battle: the scenario's target plus a visible scaling for your strength. */
  target: number;
  /** How much the target was raised for your build (shown to the player). */
  targetBonus: number;
}

export class BattleRuleError extends Error {
  constructor(
    public code: "finished" | "wrong_round" | "unknown_choice" | "unaffordable" | "locked",
    message: string,
  ) {
    super(message);
  }
}

const TAG_LABEL: Record<BattleTag, string> = {
  research: "Research",
  execute: "Delivery",
  negotiate: "Negotiation",
  defend: "Defense",
  invest: "Investment",
};
export { TAG_LABEL };

const STAT_LABEL: Record<Stat, string> = { insight: "Insight", execution: "Execution", influence: "Influence" };

export function decideIntent(scenario: Scenario, roundIndex: number, seed: number, tagsUsed: BattleTag[]): IntentDef {
  const round = scenario.rounds[roundIndex];
  const weighted = round.intents.map((intent) => {
    let weight = intent.weight;
    for (const a of intent.adapts ?? []) weight += a.delta * tagsUsed.filter((t) => t === a.tag).length;
    return { intent, weight: Math.max(1, weight) };
  });
  return weightedPick(weighted, seededRng(deriveSeed(seed, roundIndex + 1))).intent;
}

/**
 * Rivals scale with you, transparently: the goal rises by about 90% of the extra power your stats
 * and estate bonuses add over a starting build, so stronger builds still feel stronger but every
 * battle remains a decision. Shown in the UI as "goal +N for your strength".
 */
export function targetBonusFor(loadout: BattleLoadout): number {
  const avgStat = (loadout.stats.insight + loadout.stats.execution + loadout.stats.influence) / 3;
  const tactic = Object.values(loadout.tactic).reduce((s, v) => s + v, 0) / 5;
  const extraPerRound = Math.max(0, avgStat - 11 / 3) + tactic;
  return Math.round(extraPerRound * 3 * 0.9 + loadout.startingCapital * 0.9);
}

export function startBattle(scenario: Scenario, loadout: BattleLoadout, seed: number): BattleState {
  const first = decideIntent(scenario, 0, seed >>> 0, []);
  const targetBonus = targetBonusFor(loadout);
  return {
    scenarioId: scenario.id,
    scenarioVersion: scenario.version,
    seed: seed >>> 0,
    status: "active",
    round: 1,
    meter: scenario.startMeter,
    capital: scenario.capital + loadout.startingCapital,
    intents: [first.id],
    revealedRounds: [],
    weaknessKnown: false,
    tagsUsed: [],
    turns: [],
    outcome: null,
    finalScore: null,
    target: scenario.target + targetBonus,
    targetBonus,
  };
}

export function currentRound(scenario: Scenario, state: BattleState): RoundDef {
  return scenario.rounds[state.round - 1];
}

export function currentIntent(scenario: Scenario, state: BattleState): IntentDef {
  const round = currentRound(scenario, state);
  return round.intents.find((i) => i.id === state.intents[state.round - 1]) ?? round.intents[0];
}

export interface ChoiceView extends ChoiceDef {
  affordable: boolean;
  locked: boolean;
  /** What the player can know in advance: power + stat + tactic bonus (+ exploit if known). */
  estimate: number;
}

export function choiceEstimate(scenario: Scenario, state: BattleState, loadout: BattleLoadout, choice: ChoiceDef): number {
  return Math.round(
    choice.power +
      loadout.stats[choice.stat] +
      (loadout.tactic[choice.tag] ?? 0) +
      (choice.exploits && state.weaknessKnown ? scenario.exploitBonus : 0),
  );
}

export function choicesFor(scenario: Scenario, state: BattleState, loadout: BattleLoadout): ChoiceView[] {
  if (state.status !== "active") return [];
  return currentRound(scenario, state).choices.map((choice) => ({
    ...choice,
    affordable: choice.cost <= state.capital,
    locked: Boolean(choice.requiresWeakness && !state.weaknessKnown),
    estimate: choiceEstimate(scenario, state, loadout, choice),
  }));
}

export function applyChoice(
  scenario: Scenario,
  state: BattleState,
  loadout: BattleLoadout,
  round: number,
  choiceId: string,
): { state: BattleState; turn: TurnResult } {
  if (state.status !== "active") throw new BattleRuleError("finished", "This venture is already decided.");
  if (round !== state.round) throw new BattleRuleError("wrong_round", `It's round ${state.round}, not round ${round}.`);
  const roundDef = currentRound(scenario, state);
  const choice = roundDef.choices.find((c) => c.id === choiceId);
  if (!choice) throw new BattleRuleError("unknown_choice", "That option isn't available this round.");
  if (choice.requiresWeakness && !state.weaknessKnown) {
    throw new BattleRuleError("locked", "You need research to reveal the opponent's weakness first.");
  }
  if (choice.cost > state.capital) throw new BattleRuleError("unaffordable", `Needs ${choice.cost} Capital; you have ${state.capital}.`);

  const intent = currentIntent(scenario, state);
  const countered = intent.weakTo.includes(choice.tag);
  const exploited = Boolean(choice.exploits && state.weaknessKnown);
  const stat = loadout.stats[choice.stat];
  const tacticBonus = loadout.tactic[choice.tag] ?? 0;
  const gain = Math.round(
    choice.power + stat + tacticBonus + (countered ? scenario.counterBonus : 0) + (exploited ? scenario.exploitBonus : 0),
  );
  let pressure = intent.pressure;
  if (countered) pressure = Math.floor(pressure / 2);
  pressure = Math.max(0, pressure - (choice.defense ?? 0));
  const delta = gain - pressure;
  const meterAfter = Math.max(0, state.meter + delta);
  const capitalReturned = choice.yield ?? 0;
  const capitalAfter = state.capital - choice.cost + capitalReturned;

  const lines: string[] = [];
  lines.push(
    `${choice.label}: ${choice.power} base + ${stat} ${STAT_LABEL[choice.stat]}${tacticBonus ? ` + ${tacticBonus} estate` : ""}${
      countered ? ` + ${scenario.counterBonus} counter` : ""
    }${exploited ? ` + ${scenario.exploitBonus} weakness` : ""} = +${gain}.`,
  );
  lines.push(
    `${scenario.opponent.name}: ${intent.label} (−${intent.pressure})${
      countered ? `, countered by ${TAG_LABEL[choice.tag].toLowerCase()}: halved` : ""
    }${choice.defense ? `, ${choice.defense} absorbed by your defense` : ""}. Net pressure −${pressure}.`,
  );
  if (choice.reveals) lines.push("Your research reveals their next move and a weakness you can exploit.");
  if (capitalReturned) lines.push(`+${capitalReturned} Capital returned.`);

  const turn: TurnResult = {
    round: state.round,
    choiceId: choice.id,
    intentId: intent.id,
    countered,
    exploited,
    gain,
    pressure,
    delta,
    capitalSpent: choice.cost,
    capitalReturned,
    meterAfter,
    capitalAfter,
    revealed: Boolean(choice.reveals),
    lines,
  };

  const tagsUsed = [...state.tagsUsed, choice.tag];
  const next: BattleState = {
    ...state,
    meter: meterAfter,
    capital: capitalAfter,
    tagsUsed,
    turns: [...state.turns, turn],
    weaknessKnown: state.weaknessKnown || Boolean(choice.reveals),
    revealedRounds:
      choice.reveals && state.round < 3 ? [...new Set([...state.revealedRounds, state.round + 1])] : state.revealedRounds,
  };

  if (state.round >= 3) {
    const finalScore = meterAfter + capitalAfter;
    next.status = "finished";
    next.finalScore = finalScore;
    next.outcome = outcomeFor(state.target ?? scenario.target, finalScore);
  } else {
    next.round = state.round + 1;
    const intentNext = decideIntent(scenario, state.round, state.seed, tagsUsed);
    next.intents = [...state.intents, intentNext.id];
  }
  return { state: next, turn };
}

export function outcomeFor(target: number, finalScore: number): BattleOutcome {
  if (finalScore >= target) return "victory";
  if (finalScore >= Math.ceil(target * 0.8)) return "partial";
  return "defeat";
}

/** Which decisions mattered most: biggest swings first, with plain-language notes. */
export function battleSummary(scenario: Scenario, state: BattleState): { headline: string; notes: string[] } {
  const notes: string[] = [];
  for (const turn of state.turns) {
    const round = scenario.rounds[turn.round - 1];
    const choice = round.choices.find((c) => c.id === turn.choiceId);
    const intent = round.intents.find((i) => i.id === turn.intentId);
    const known = state.revealedRounds.includes(turn.round);
    let note = `Round ${turn.round}: ${choice?.label} into ${intent?.label}: net ${turn.delta >= 0 ? "+" : ""}${turn.delta}.`;
    if (turn.countered) note += ` It countered their move${known ? " you had scouted" : ""}.`;
    else if (intent && intent.weakTo.length) {
      note += ` ${intent.weakTo.map((t) => TAG_LABEL[t]).join(" or ")} would have countered it.`;
    }
    if (turn.exploited) note += " Exploiting the weakness added extra.";
    if (turn.revealed) note += " The research paid off later.";
    notes.push(note);
  }
  const leftover = state.capital;
  if (leftover > 0) notes.push(`${leftover} unspent Capital counted toward the final score.`);
  const target = state.target ?? scenario.target;
  const headline =
    state.outcome === "victory"
      ? `Objective met: ${state.finalScore} of ${target}.`
      : state.outcome === "partial"
        ? `Close: ${state.finalScore} of ${target}. A partial result.`
        : `Short of the objective: ${state.finalScore} of ${target}.`;
  return { headline, notes };
}
