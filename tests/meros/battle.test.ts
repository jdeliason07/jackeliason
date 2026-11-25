import { describe, expect, it } from "vitest";
import { SCENARIOS } from "@/lib/meros/content/battles";
import {
  applyChoice,
  type BattleLoadout,
  BattleRuleError,
  type BattleState,
  choicesFor,
  currentIntent,
  type Scenario,
  startBattle,
} from "@/lib/meros/domain/battle";

const loadout = (stats: Partial<BattleLoadout["stats"]> = {}): BattleLoadout => ({
  stats: { insight: 5, execution: 3, influence: 3, ...stats },
  tactic: { research: 0, execute: 0, negotiate: 0, defend: 0, invest: 0 },
  startingCapital: 0,
  vitalityModifier: 1,
});

type Policy = (s: Scenario, st: BattleState, l: BattleLoadout) => string;

/** Autopilot: take the biggest advertised number every round, ignoring signals and opponents. */
const greedy: Policy = (s, st, l) => {
  const options = choicesFor(s, st, l).filter((c) => c.affordable && !c.locked);
  return options.sort((a, b) => b.estimate - a.estimate)[0].id;
};

/** Informed: scout in round 1, then play the real counter to the scouted move. */
const informed: Policy = (s, st, l) => {
  const options = choicesFor(s, st, l).filter((c) => c.affordable && !c.locked);
  if (st.revealedRounds.includes(st.round)) {
    const intent = currentIntent(s, st);
    const value = (c: (typeof options)[number]) => {
      const countered = intent.weakTo.includes(c.tag);
      let pressure = countered ? Math.floor(intent.pressure / 2) : intent.pressure;
      pressure = Math.max(0, pressure - (c.defense ?? 0));
      return c.estimate + (countered ? s.counterBonus : 0) - pressure - c.cost + (c.yield ?? 0);
    };
    return options.sort((a, b) => value(b) - value(a))[0].id;
  }
  const scout = options.find((c) => c.reveals);
  if (scout && st.round < 3) return scout.id;
  return options.sort((a, b) => b.estimate - b.cost - (a.estimate - a.cost))[0].id;
};

function play(s: Scenario, l: BattleLoadout, seed: number, policy: Policy): BattleState {
  let st = startBattle(s, l, seed);
  while (st.status === "active") st = applyChoice(s, st, l, st.round, policy(s, st, l)).state;
  return st;
}

describe("Ventures content", () => {
  it("has 12 authored scenarios across all five categories, 3 rounds, ≥3 choices each", () => {
    expect(SCENARIOS).toHaveLength(12);
    expect(new Set(SCENARIOS.map((s) => s.category)).size).toBe(5);
    for (const s of SCENARIOS) {
      expect(s.rounds).toHaveLength(3);
      for (const r of s.rounds) {
        expect(r.choices.length).toBeGreaterThanOrEqual(3);
        expect(r.intents.length).toBeGreaterThanOrEqual(2);
        expect(new Set(r.choices.map((c) => c.id)).size).toBe(r.choices.length);
      }
    }
  });
});

describe("battle state machine", () => {
  const s = SCENARIOS[0];
  const l = loadout();

  it("is deterministic per seed: reloading re-derives the same opponent moves", () => {
    const a = startBattle(s, l, 42);
    const b = startBattle(s, l, 42);
    expect(a.intents).toEqual(b.intents);
    const a2 = applyChoice(s, a, l, 1, s.rounds[0].choices[0].id).state;
    const b2 = applyChoice(s, b, l, 1, s.rounds[0].choices[0].id).state;
    expect(a2).toEqual(b2);
  });

  it("validates round, choice, capital, and locks", () => {
    const st = startBattle(s, l, 1);
    expect(() => applyChoice(s, st, l, 2, s.rounds[1].choices[0].id)).toThrow(BattleRuleError);
    expect(() => applyChoice(s, st, l, 1, "nope")).toThrow(/isn't available/);
    const broke = { ...st, capital: 0 };
    const costly = s.rounds[0].choices.find((c) => c.cost > 0)!;
    expect(() => applyChoice(s, broke, l, 1, costly.id)).toThrow(/Capital/);
    let mid = applyChoice(s, st, l, 1, "hold-open").state;
    mid = applyChoice(s, mid, l, 2, "hold-concessions").state;
    expect(() => applyChoice(s, mid, l, 3, "vacancy-leverage")).toThrow(/research/);
    const done = applyChoice(s, mid, l, 3, "hold-signing").state;
    expect(done.status).toBe("finished");
    expect(() => applyChoice(s, done, l, 3, "hold-signing")).toThrow(/decided/);
  });

  it("explains each round's math in plain language", () => {
    const st = startBattle(s, l, 3);
    const { turn } = applyChoice(s, st, l, 1, "comps");
    expect(turn.lines[0]).toMatch(/base \+ \d+(\.\d)? Insight/);
    expect(turn.lines.some((x) => /reveals/.test(x))).toBe(true);
  });

  it("countering the opponent's move beats the same move uncountered", () => {
    const st = startBattle(s, l, 11);
    const intent = currentIntent(s, st);
    const counter = s.rounds[0].choices.find((c) => intent.weakTo.includes(c.tag))!;
    const other = s.rounds[0].choices.find((c) => !intent.weakTo.includes(c.tag) && c.power >= counter.power - 2)!;
    const a = applyChoice(s, st, l, 1, counter.id).turn;
    const b = applyChoice(s, st, l, 1, other.id).turn;
    expect(a.countered).toBe(true);
    expect(a.delta - (counter.power + l.stats[counter.stat])).toBeGreaterThan(b.delta - (other.power + l.stats[other.stat]));
  });

  it("the best advertised option depends on the build", () => {
    let differs = 0;
    for (const sc of SCENARIOS) {
      for (let r = 0; r < 3; r++) {
        const st = { ...startBattle(sc, loadout(), 1), round: r + 1, capital: 9, weaknessKnown: true };
        const insight = greedy(sc, st, loadout({ insight: 8, execution: 3, influence: 3 }));
        const influence = greedy(sc, st, loadout({ insight: 3, execution: 3, influence: 8 }));
        if (insight !== influence) differs++;
      }
    }
    expect(differs).toBeGreaterThanOrEqual(12);
  });

  it("informed play beats autopilot in every scenario, and neither wins everything", () => {
    let informedWins = 0;
    let greedyWins = 0;
    let games = 0;
    for (const sc of SCENARIOS) {
      let informedTotal = 0;
      let greedyTotal = 0;
      for (let seed = 1; seed <= 60; seed++) {
        const a = play(sc, loadout(), seed, informed);
        const b = play(sc, loadout(), seed, greedy);
        informedTotal += a.finalScore!;
        greedyTotal += b.finalScore!;
        informedWins += a.outcome === "victory" ? 1 : 0;
        greedyWins += b.outcome === "victory" ? 1 : 0;
        games++;
      }
      expect(informedTotal, `${sc.id}: informed should outscore autopilot`).toBeGreaterThan(greedyTotal);
    }
    expect(informedWins / games).toBeGreaterThan(0.5);
    expect(greedyWins / games).toBeLessThan(informedWins / games);
    expect(informedWins).toBeLessThan(games); // not a guaranteed win
  });

  it("rivals scale with a stronger build so decisions keep mattering at high levels", () => {
    const strong: BattleLoadout = {
      stats: { insight: 11, execution: 8, influence: 7 },
      tactic: { research: 2, execute: 2, negotiate: 2, defend: 0, invest: 2 },
      startingCapital: 1,
      vitalityModifier: 1,
    };
    expect(startBattle(SCENARIOS[0], strong, 1).targetBonus).toBeGreaterThan(0);
    let informedWins = 0;
    let greedyWins = 0;
    let games = 0;
    for (const sc of SCENARIOS) {
      for (let seed = 1; seed <= 30; seed++) {
        informedWins += play(sc, strong, seed, informed).outcome === "victory" ? 1 : 0;
        greedyWins += play(sc, strong, seed, greedy).outcome === "victory" ? 1 : 0;
        games++;
      }
    }
    expect(greedyWins / games).toBeLessThan(0.55);
    expect(informedWins / games).toBeGreaterThan(greedyWins / games + 0.25);
  });
});
