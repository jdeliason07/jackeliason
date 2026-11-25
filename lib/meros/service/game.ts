import { z } from "zod";
import type { Tx } from "../store/types";
import { completeMinimum } from "./awards";
import { type GameDeps, GameError } from "./context";
import { Ledger } from "./ledger";
import {
  appearanceSchema,
  archiveQuest,
  archiveReward,
  claimReward,
  createQuest,
  deleteEvidence,
  expireEvidence,
  onboard,
  pauseQuest,
  policyPatchSchema,
  resumeQuest,
  rewardSchema,
  saveReward,
  setBudget,
  updatePolicy,
  updateProfile,
  updateQuest,
} from "./manage";
import { catchUp } from "./occurrences";
import {
  chooseBattle,
  declineOptional,
  finishOptional,
  forfeitBattle,
  openChest,
  setEquipped,
  startBattle,
  startOptional,
  upgradeBuilding,
} from "./play";
import {
  attemptForRetry,
  beginPhotoAttempt,
  issueChallenge,
  type PhotoSubmission,
  type ResolveInput,
  resolveAttempt,
  submitGps,
} from "./verification";
import { battleView, buildView, type GameView } from "./view";
import type { Appearance } from "../content/appearance";

/**
 * Every mutation the client can request, validated at the trust boundary. The browser sends intent
 * (e.g. "open this chest"); the server decides outcomes. Photo upload has its own route because it
 * carries bytes, but it calls the same service.
 */
const id = z.string().uuid();
const focus = z.enum(["insight", "execution", "influence"]);

export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("onboard"), displayName: z.string().max(40), timezone: z.string().max(64), focus, appearance: appearanceSchema.optional() }),
  z.object({
    type: z.literal("updateProfile"),
    displayName: z.string().max(40).optional(),
    timezone: z.string().max(64).optional(),
    focus: focus.optional(),
    appearance: appearanceSchema.optional(),
  }),
  z.object({ type: z.literal("updatePolicy"), patch: policyPatchSchema }),
  z.object({ type: z.literal("createQuest"), templateId: z.string().max(60).nullable(), definition: z.unknown(), confirmDistinct: z.boolean().optional() }),
  z.object({ type: z.literal("updateQuest"), questId: id, definition: z.unknown() }),
  z.object({ type: z.literal("pauseQuest"), questId: id }),
  z.object({ type: z.literal("resumeQuest"), questId: id }),
  z.object({ type: z.literal("archiveQuest"), questId: id }),
  z.object({ type: z.literal("issueChallenge"), occurrenceId: id }),
  z.object({
    type: z.literal("submitGps"),
    occurrenceId: id,
    reading: z.object({ lat: z.number(), lng: z.number(), accuracyM: z.number(), timestamp: z.number() }),
  }),
  z.object({ type: z.literal("startOptional"), occurrenceId: id }),
  z.object({ type: z.literal("finishOptional"), sessionId: id, rating: z.number().int().min(1).max(10).nullable() }),
  z.object({ type: z.literal("declineOptional"), occurrenceId: id }),
  z.object({ type: z.literal("openChest"), entitlementId: id }),
  z.object({ type: z.literal("setEquipped"), itemId: z.string().max(60), equipped: z.boolean() }),
  z.object({ type: z.literal("upgradeBuilding"), area: z.string().max(20) }),
  z.object({ type: z.literal("startBattle"), scenarioId: z.string().max(60), mode: z.enum(["practice", "rewarded"]) }),
  z.object({ type: z.literal("chooseBattle"), battleId: id, round: z.number().int().min(1).max(3), choiceId: z.string().max(60) }),
  z.object({ type: z.literal("forfeitBattle"), battleId: id }),
  z.object({ type: z.literal("saveReward"), reward: rewardSchema }),
  z.object({ type: z.literal("archiveReward"), rewardId: id }),
  z.object({ type: z.literal("claimReward"), rewardId: id, note: z.string().max(280).default("") }),
  z.object({ type: z.literal("setBudget"), cents: z.number().int().min(0).max(10_000_000).nullable() }),
  z.object({ type: z.literal("deleteEvidence"), attemptId: id }),
  z.object({ type: z.literal("catchUp") }),
]);

export type Command = z.infer<typeof commandSchema>;

export const idempotencyKeySchema = z.string().min(8).max(100).regex(/^[A-Za-z0-9_-]+$/);

export interface CommandResponse {
  result: unknown;
  replayed: boolean;
}

export function parseCommand(input: unknown): Command {
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success) {
    throw new GameError("invalid_input", parsed.error.issues[0]?.message ?? "Invalid request.", 400, { issues: parsed.error.issues });
  }
  return parsed.data;
}

async function dispatch(tx: Tx, deps: GameDeps, owner: string, cmd: Command, key: string, ledger: Ledger | null): Promise<unknown> {
  const L = () => {
    if (!ledger) throw new GameError("not_onboarded", "Finish setup first.", 409);
    return ledger;
  };
  switch (cmd.type) {
    case "onboard":
      await onboard(tx, deps, owner, { ...cmd, appearance: cmd.appearance as Appearance | undefined });
      return { onboarded: true };
    case "updateProfile":
      await updateProfile(tx, deps, owner, { ...cmd, appearance: cmd.appearance as Appearance | undefined });
      return { updated: true };
    case "updatePolicy":
      await updatePolicy(tx, deps, L(), cmd.patch);
      return { updated: true };
    case "createQuest":
      return createQuest(tx, deps, owner, cmd);
    case "updateQuest":
      return updateQuest(tx, deps, owner, cmd.questId, cmd.definition);
    case "pauseQuest":
      return pauseQuest(tx, deps, owner, cmd.questId);
    case "resumeQuest":
      return resumeQuest(tx, deps, owner, cmd.questId);
    case "archiveQuest":
      return archiveQuest(tx, deps, owner, cmd.questId);
    case "issueChallenge":
      return issueChallenge(tx, deps, owner, cmd.occurrenceId);
    case "submitGps":
      return submitGps(tx, deps, L(), { occurrenceId: cmd.occurrenceId, reading: cmd.reading, idempotencyKey: key });
    case "startOptional": {
      const s = await startOptional(tx, deps, owner, cmd.occurrenceId);
      return { sessionId: s.id };
    }
    case "finishOptional": {
      const r = await finishOptional(tx, deps, L(), cmd.sessionId, cmd.rating);
      return { status: r.session.status, bonusXp: r.bonusXp, levelsGained: r.levelsGained };
    }
    case "declineOptional":
      return declineOptional(tx, deps, owner, cmd.occurrenceId);
    case "openChest": {
      const r = await openChest(tx, deps, L(), cmd.entitlementId);
      return { ...r.opening, replay: r.replay };
    }
    case "setEquipped": {
      const r = await setEquipped(tx, deps, owner, cmd.itemId, cmd.equipped);
      return { itemId: r.item_id, equipped: r.equipped };
    }
    case "upgradeBuilding":
      return upgradeBuilding(tx, deps, L(), cmd.area);
    case "startBattle": {
      const r = await startBattle(tx, deps, L(), cmd.scenarioId, cmd.mode);
      return { battleId: r.battle.id, resumed: r.resumed };
    }
    case "chooseBattle": {
      const r = await chooseBattle(tx, deps, L(), cmd.battleId, cmd.round, cmd.choiceId);
      return { battle: battleView(r.battle), replay: r.replay };
    }
    case "forfeitBattle":
      await forfeitBattle(tx, deps, owner, cmd.battleId);
      return { forfeited: true };
    case "saveReward": {
      const r = await saveReward(tx, deps, L(), cmd.reward);
      return { rewardId: r.id };
    }
    case "archiveReward":
      await archiveReward(tx, deps, owner, cmd.rewardId);
      return { archived: true };
    case "claimReward": {
      const c = await claimReward(tx, deps, L(), cmd.rewardId, cmd.note);
      return { claimId: c.id, budgeted: c.budgeted, amountCents: c.amount_cents };
    }
    case "setBudget":
      await setBudget(tx, deps, owner, cmd.cents);
      return { cents: cmd.cents };
    case "deleteEvidence":
      return deleteEvidence(tx, deps, owner, cmd.attemptId);
    case "catchUp":
      return { ok: true };
  }
}

export interface Game {
  deps: GameDeps;
  view(owner: string): Promise<GameView | null>;
  command(owner: string, cmd: Command, idempotencyKey: string): Promise<CommandResponse>;
  beginPhoto(owner: string, submission: PhotoSubmission): ReturnType<typeof beginPhotoAttempt>;
  resolvePhoto(owner: string, attemptId: string, input: ResolveInput): ReturnType<typeof resolveAttempt>;
  photoForRetry(owner: string, attemptId: string): ReturnType<typeof attemptForRetry>;
  maintenance(owner: string): Promise<{ expiredEvidencePaths: string[] }>;
  /** Test/demo helper: accept a verified minimum directly (never exposed over HTTP). */
  _completeForTest?: (owner: string, occurrenceId: string) => Promise<unknown>;
}

export function createGame(deps: GameDeps): Game {
  const { store } = deps;

  return {
    deps,

    async view(owner) {
      return store.transaction(async (tx) => {
        await tx.lockOwner(owner);
        const profile = await tx.get("profiles", owner);
        if (!profile?.onboarded_at) return null;
        const ledger = await Ledger.open(tx, deps, owner);
        await catchUp(tx, deps, ledger, deps.now()); // idempotent catch-up on every app entry
        await ledger.flush();
        return buildView(tx, deps, owner);
      });
    },

    async command(owner, cmd, idempotencyKey) {
      const key = idempotencyKeySchema.safeParse(idempotencyKey);
      if (!key.success) throw new GameError("invalid_input", "A valid idempotency key is required.");
      return store.transaction(async (tx) => {
        await tx.lockOwner(owner);
        const receipt = await tx.find("command_receipts", { owner_id: owner, idempotency_key: key.data });
        if (receipt[0]) {
          if (receipt[0].command !== cmd.type) throw new GameError("conflict", "That request key was already used for something else.", 409);
          return { result: receipt[0].response, replayed: true };
        }
        let ledger: Ledger | null = null;
        if (cmd.type !== "onboard") {
          ledger = await Ledger.open(tx, deps, owner);
          await catchUp(tx, deps, ledger, deps.now());
        }
        const result = await dispatch(tx, deps, owner, cmd, key.data, ledger);
        if (ledger) await ledger.flush();
        const response = JSON.parse(JSON.stringify(result ?? null));
        await tx.insert("command_receipts", {
          id: deps.uuid(),
          owner_id: owner,
          idempotency_key: key.data,
          command: cmd.type,
          response,
          created_at: deps.now().toISOString(),
        });
        return { result: response, replayed: false };
      });
    },

    beginPhoto(owner, submission) {
      return store.transaction(async (tx) => {
        await tx.lockOwner(owner);
        const ledger = await Ledger.open(tx, deps, owner);
        await catchUp(tx, deps, ledger, deps.now());
        await ledger.flush();
        return beginPhotoAttempt(tx, deps, owner, submission);
      });
    },

    resolvePhoto(owner, attemptId, input) {
      return store.transaction(async (tx) => {
        await tx.lockOwner(owner);
        const ledger = await Ledger.open(tx, deps, owner);
        const result = await resolveAttempt(tx, deps, ledger, attemptId, input);
        await ledger.flush();
        return result;
      });
    },

    photoForRetry(owner, attemptId) {
      return store.transaction(async (tx) => {
        await tx.lockOwner(owner);
        return attemptForRetry(tx, deps, owner, attemptId);
      });
    },

    async maintenance(owner) {
      return store.transaction(async (tx) => {
        await tx.lockOwner(owner);
        const profile = await tx.get("profiles", owner);
        if (!profile?.onboarded_at) return { expiredEvidencePaths: [] };
        const ledger = await Ledger.open(tx, deps, owner);
        await catchUp(tx, deps, ledger, deps.now());
        await ledger.flush();
        return { expiredEvidencePaths: await expireEvidence(tx, deps, owner) };
      });
    },
  };
}

/** Used by tests and the demo seeder only: completes a minimum as if verification accepted it. */
export async function completeWithSyntheticAcceptance(game: Game, owner: string, occurrenceId: string, demoOnly = true) {
  if (demoOnly && game.deps.mode !== "demo") throw new Error("synthetic acceptance is demo/test only");
  return game.deps.store.transaction(async (tx) => {
    await tx.lockOwner(owner);
    const ledger = await Ledger.open(tx, game.deps, owner);
    await catchUp(tx, game.deps, ledger, game.deps.now());
    const occ = await tx.get("quest_occurrences", occurrenceId);
    if (!occ) throw new Error("occurrence not found");
    const attempt = await tx.insert("verification_attempts", {
      id: game.deps.uuid(),
      owner_id: owner,
      occurrence_id: occ.id,
      challenge_id: null,
      idempotency_key: `synthetic-${occ.id}`,
      mode: (occ.snapshot as { verification: { mode: "photo" | "gps" } }).verification.mode,
      status: "accepted",
      reason: "Synthetic acceptance (demo/test).",
      guidance: null,
      provider: "synthetic",
      model: "synthetic",
      rubric: {},
      image_path: null,
      image_sha256: null,
      image_dhash: null,
      reuse_of: null,
      similar_to: null,
      image_deleted_at: null,
      distance_m: null,
      accuracy_m: null,
      reading_at: null,
      evaluations: 1,
      demo: game.deps.mode === "demo",
      submitted_at: game.deps.now().toISOString(),
      decided_at: game.deps.now().toISOString(),
    });
    const award = await completeMinimum(tx, game.deps, ledger, occ, attempt);
    await ledger.flush();
    return award;
  });
}
