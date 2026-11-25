import { z } from "zod";
import { CONSEQUENCE_POLICY_V1, TIMING_RULES } from "../config";
import { type Appearance, DEFAULT_APPEARANCE, validateAppearance } from "../content/appearance";
import { TEMPLATES_BY_ID } from "../content/templates";
import type { Quests, Rewards } from "../db/schema";
import { LEVEL_CURVE_V1 } from "../domain/levels";
import { INITIAL_MOMENTUM } from "../domain/momentum";
import { SIMILARITY_THRESHOLD, similarity } from "../domain/similarity";
import { addDays, isValidTimeZone, localDateOf, monthOf } from "../domain/time";
import type { Tx } from "../store/types";
import { type GameDeps, GameError, requireProfile } from "./context";
import type { Ledger } from "./ledger";
import { materializeQuest, versionsOf } from "./occurrences";
import { parseDefinition, type QuestDefinition, sameSchedule } from "./quest-definition";

// ───────────────────────── profile ─────────────────────────

export const appearanceSchema = z.object({
  skin: z.string(),
  hairStyle: z.string(),
  hairColor: z.string(),
  baseOutfit: z.string(),
  outfitColor: z.string(),
  accent: z.string(),
  flair: z.array(z.string()).max(10),
  background: z.string(),
});

export async function onboard(
  tx: Tx,
  deps: GameDeps,
  owner: string,
  input: { displayName: string; timezone: string; focus: "insight" | "execution" | "influence"; appearance?: Appearance },
) {
  const existing = await tx.get("profiles", owner);
  if (existing?.onboarded_at) throw new GameError("already_onboarded", "Already set up.", 409);
  if (!isValidTimeZone(input.timezone)) throw new GameError("invalid_input", "Unknown time zone.");
  const appearance = input.appearance ?? DEFAULT_APPEARANCE;
  const bad = validateAppearance(appearance, 1);
  if (bad) throw new GameError("invalid_input", bad);
  const now = deps.now().toISOString();
  const row = {
    id: owner,
    display_name: input.displayName.trim().slice(0, 40) || "Founder",
    timezone: input.timezone,
    focus: input.focus,
    appearance: appearance as never,
    xp_total: 0,
    level: 1,
    credits: 0,
    vitality: 100,
    tickets: 0,
    minimums_total: 0,
    chests_earned: 0,
    level_config_version: LEVEL_CURVE_V1.version,
    policy: { ...CONSEQUENCE_POLICY_V1 } as never,
    places: (existing?.places ?? {}) as never,
    onboarded_at: now,
    last_catchup_at: now,
    created_at: now,
    updated_at: now,
  };
  if (existing) return tx.update("profiles", owner, row);
  return tx.insert("profiles", row);
}

export async function updateProfile(
  tx: Tx,
  deps: GameDeps,
  owner: string,
  input: { displayName?: string; timezone?: string; focus?: "insight" | "execution" | "influence"; appearance?: Appearance },
) {
  const profile = await requireProfile(tx, owner);
  const patch: Record<string, unknown> = { updated_at: deps.now().toISOString() };
  if (input.displayName !== undefined) patch.display_name = input.displayName.trim().slice(0, 40) || profile.display_name;
  if (input.timezone !== undefined) {
    // Affects future occurrences and day boundaries only; existing occurrences keep their frozen zone.
    if (!isValidTimeZone(input.timezone)) throw new GameError("invalid_input", "Unknown time zone.");
    patch.timezone = input.timezone;
  }
  if (input.focus !== undefined) patch.focus = input.focus;
  if (input.appearance !== undefined) {
    const bad = validateAppearance(input.appearance, profile.level);
    if (bad) throw new GameError("invalid_input", bad);
    patch.appearance = input.appearance;
  }
  return tx.update("profiles", owner, patch);
}

/** Future-only policy changes. Old consequence events keep the policy version they were made with. */
export const policyPatchSchema = z.object({
  deteriorationEnabled: z.boolean().optional(),
  dailyPenaltyCap: z.number().int().min(0).max(CONSEQUENCE_POLICY_V1.dailyPenaltyCap).optional(),
});

export async function updatePolicy(tx: Tx, deps: GameDeps, ledger: Ledger, patch: z.infer<typeof policyPatchSchema>) {
  const current = ledger.policy;
  const next = { ...current, version: current.version + 1 };
  if (patch.deteriorationEnabled !== undefined) {
    next.penaltyByMiss = patch.deteriorationEnabled ? { ...CONSEQUENCE_POLICY_V1.penaltyByMiss } : { 5: 0, 6: 0 };
    next.penaltyBeyond = patch.deteriorationEnabled ? CONSEQUENCE_POLICY_V1.penaltyBeyond : 0;
  }
  if (patch.dailyPenaltyCap !== undefined) next.dailyPenaltyCap = patch.dailyPenaltyCap;
  return tx.update("profiles", ledger.profile.id, { policy: next as never, updated_at: deps.now().toISOString() });
}

// ───────────────────────── quests ─────────────────────────

export interface CreateQuestInput {
  templateId: string | null;
  definition: unknown;
  confirmDistinct?: boolean;
}

async function currentDefinitions(tx: Tx, owner: string) {
  const quests = await tx.find("quests", { owner_id: owner, status: { $in: ["active", "paused"] } });
  const out: { quest: Quests; def: QuestDefinition }[] = [];
  for (const q of quests) {
    const v = q.current_version_id ? await tx.get("quest_versions", q.current_version_id) : null;
    if (v) out.push({ quest: q, def: v.definition as unknown as QuestDefinition });
  }
  return out;
}

export async function createQuest(tx: Tx, deps: GameDeps, owner: string, input: CreateQuestInput) {
  const profile = await requireProfile(tx, owner);
  const def = safeDefinition(input.definition);
  if (input.templateId && !TEMPLATES_BY_ID.has(input.templateId)) throw new GameError("invalid_input", "Unknown template.");
  const habitKey = input.templateId ? `template:${input.templateId}` : `custom:${deps.uuid()}`;
  const others = await currentDefinitions(tx, owner);

  // Template clones share a habit identity: an identical schedule is rejected outright; any clone can
  // score at most once per day (enforced by a unique index).
  for (const o of others) {
    if (o.quest.habit_key === habitKey && sameSchedule(o.def.schedule, def.schedule)) {
      throw new GameError("duplicate_quest", `You already have “${o.def.title}” on this exact schedule.`, 409);
    }
  }
  if (!input.confirmDistinct) {
    const similar = others.filter((o) => similarity(o.def, def) >= SIMILARITY_THRESHOLD).map((o) => o.def.title);
    if (similar.length) {
      throw new GameError(
        "similar_quest",
        `Looks like ${similar.map((s) => `“${s}”`).join(", ")}.`,
        409,
        { similar },
      );
    }
  }
  const now = deps.now();
  const questId = deps.uuid();
  const versionId = deps.uuid();
  const nowIso = now.toISOString();
  const reviewOn = def.reviewOn ?? addDays(localDateOf(now, profile.timezone), def.reviewIntervalDays);
  await tx.insert("quests", {
    id: questId,
    owner_id: owner,
    habit_key: habitKey,
    template_id: input.templateId,
    status: "active",
    current_version_id: versionId,
    momentum: { ...INITIAL_MOMENTUM } as never,
    materialized_through: null,
    created_at: nowIso,
    activated_at: nowIso,
    paused_at: null,
    archived_at: null,
    updated_at: nowIso,
  });
  await tx.insert("quest_versions", {
    id: versionId,
    owner_id: owner,
    quest_id: questId,
    version_no: 1,
    effective_from: nowIso,
    timezone: profile.timezone,
    definition: { ...def, reviewOn } as never,
    created_at: nowIso,
  });
  const quest = (await tx.get("quests", questId))!;
  await materializeQuest(tx, deps, quest, now);
  return { questId };
}

function safeDefinition(input: unknown): QuestDefinition {
  try {
    return parseDefinition(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const first = error.issues[0];
      throw new GameError("invalid_input", first?.message ?? "Check the task details.", 400, { issues: error.issues });
    }
    throw error;
  }
}

async function ownedQuest(tx: Tx, owner: string, questId: string) {
  const quest = await tx.get("quests", questId);
  if (!quest || quest.owner_id !== owner) throw new GameError("not_found", "Task not found.", 404);
  return quest;
}

/** Edits create a new immutable version effective now; existing occurrences keep their snapshot. */
export async function updateQuest(tx: Tx, deps: GameDeps, owner: string, questId: string, definition: unknown) {
  const profile = await requireProfile(tx, owner);
  const quest = await ownedQuest(tx, owner, questId);
  if (quest.status === "archived") throw new GameError("invalid_input", "Archived tasks can't be edited.", 409);
  const def = safeDefinition(definition);
  const others = await currentDefinitions(tx, owner);
  for (const o of others) {
    if (o.quest.id !== quest.id && o.quest.habit_key === quest.habit_key && sameSchedule(o.def.schedule, def.schedule)) {
      throw new GameError("duplicate_quest", `Another copy of this task already uses that exact schedule.`, 409);
    }
  }
  const versions = await versionsOf(tx, quest);
  const nowIso = deps.now().toISOString();
  const versionId = deps.uuid();
  await tx.insert("quest_versions", {
    id: versionId,
    owner_id: owner,
    quest_id: quest.id,
    version_no: (versions.at(-1)?.version_no ?? 0) + 1,
    effective_from: nowIso,
    timezone: profile.timezone,
    definition: def as never,
    created_at: nowIso,
  });
  await tx.update("quests", quest.id, { current_version_id: versionId, updated_at: nowIso });
  return { questId: quest.id, versionNo: (versions.at(-1)?.version_no ?? 0) + 1 };
}

export async function pauseQuest(tx: Tx, deps: GameDeps, owner: string, questId: string) {
  const quest = await ownedQuest(tx, owner, questId);
  if (quest.status !== "active") return { questId, status: quest.status };
  const now = deps.now().toISOString();
  await tx.insert("quest_pauses", { id: deps.uuid(), owner_id: owner, quest_id: quest.id, paused_at: now, resumed_at: null });
  await tx.update("quests", quest.id, { status: "paused", paused_at: now, updated_at: now });
  return { questId, status: "paused" as const };
}

export async function resumeQuest(tx: Tx, deps: GameDeps, owner: string, questId: string) {
  const quest = await ownedQuest(tx, owner, questId);
  if (quest.status !== "paused") return { questId, status: quest.status };
  const now = deps.now().toISOString();
  const open = await tx.find("quest_pauses", { quest_id: quest.id, resumed_at: { $null: true } });
  for (const p of open) await tx.update("quest_pauses", p.id, { resumed_at: now });
  // Days skipped during the pause stay skipped; rescan from today so a window still open now is offered.
  const versions = await versionsOf(tx, quest);
  const tz = versions.at(-1)?.timezone ?? "UTC";
  const yesterday = addDays(localDateOf(deps.now(), tz), -1);
  const cursor = quest.materialized_through && quest.materialized_through > yesterday ? yesterday : quest.materialized_through;
  const updated = await tx.update("quests", quest.id, { status: "active", paused_at: null, materialized_through: cursor, updated_at: now });
  await materializeQuest(tx, deps, updated, deps.now());
  return { questId, status: "active" as const };
}

export async function archiveQuest(tx: Tx, deps: GameDeps, owner: string, questId: string) {
  const quest = await ownedQuest(tx, owner, questId);
  if (quest.status === "archived") return { questId, status: "archived" as const };
  const now = deps.now().toISOString();
  const open = await tx.find("quest_pauses", { quest_id: quest.id, resumed_at: { $null: true } });
  for (const p of open) await tx.update("quest_pauses", p.id, { resumed_at: now });
  // Open occurrences that haven't opened yet are excused; history is kept.
  const future = await tx.find("quest_occurrences", { quest_id: quest.id, status: "open", opens_at: { $gt: now } });
  for (const o of future) await tx.update("quest_occurrences", o.id, { status: "excused", resolution_note: "archived", evaluated_at: now });
  await tx.update("quests", quest.id, { status: "archived", archived_at: now, updated_at: now });
  return { questId, status: "archived" as const };
}

// ───────────────────────── real-world rewards ─────────────────────────

export const rewardSchema = z
  .object({
    id: z.string().uuid().nullable(),
    title: z.string().trim().min(1).max(80),
    kind: z.enum(["money", "gift_card", "experience", "other"]),
    description: z.string().trim().max(500),
    amountCents: z.number().int().min(1).max(10_000_000).nullable(),
    targetLevel: z.number().int().min(2).max(30).nullable(),
    targetMinimums: z.number().int().min(1).max(100_000).nullable(),
    notes: z.string().trim().max(1000),
  })
  .refine((r) => r.targetLevel !== null || r.targetMinimums !== null, { message: "Choose a level or a minimum-count milestone." });

export async function saveReward(tx: Tx, deps: GameDeps, ledger: Ledger, input: z.infer<typeof rewardSchema>) {
  const owner = ledger.profile.id;
  const now = deps.now().toISOString();
  let reward: Rewards;
  if (input.id) {
    const existing = await tx.get("rewards", input.id);
    if (!existing || existing.owner_id !== owner) throw new GameError("not_found", "Reward not found.", 404);
    const claimed = await tx.find("reward_claims", { reward_id: existing.id });
    if (claimed.length) throw new GameError("already_claimed", "Claimed rewards are part of your record and can't be edited.", 409);
    reward = await tx.update("rewards", existing.id, {
      title: input.title,
      kind: input.kind,
      description: input.description,
      amount_cents: input.amountCents,
      target_level: input.targetLevel,
      target_minimums: input.targetMinimums,
      notes: input.notes,
      updated_at: now,
    });
  } else {
    reward = await tx.insert("rewards", {
      id: deps.uuid(),
      owner_id: owner,
      title: input.title,
      kind: input.kind,
      description: input.description,
      amount_cents: input.amountCents,
      target_level: input.targetLevel,
      target_minimums: input.targetMinimums,
      unlocked_at: null,
      archived_at: null,
      notes: input.notes,
      created_at: now,
      updated_at: now,
    });
  }
  // Already past the milestone? Unlock now.
  const levelOk = reward.target_level !== null && ledger.profile.level >= reward.target_level;
  const countOk = reward.target_minimums !== null && ledger.profile.minimums_total >= reward.target_minimums;
  if (!reward.unlocked_at && (levelOk || countOk)) reward = await tx.update("rewards", reward.id, { unlocked_at: now });
  return reward;
}

export async function archiveReward(tx: Tx, deps: GameDeps, owner: string, rewardId: string) {
  const r = await tx.get("rewards", rewardId);
  if (!r || r.owner_id !== owner) throw new GameError("not_found", "Reward not found.", 404);
  return tx.update("rewards", r.id, { archived_at: deps.now().toISOString(), updated_at: deps.now().toISOString() });
}

export function isMonetary(r: Pick<Rewards, "kind" | "amount_cents">) {
  return (r.kind === "money" || r.kind === "gift_card") && r.amount_cents !== null;
}

export async function budgetStatus(tx: Tx, ledger: Ledger, now: Date) {
  const owner = ledger.profile.id;
  const budgets = await tx.find("reward_budgets", { owner_id: owner, effective_at: { $lte: now.toISOString() } }, {
    orderBy: [["effective_at", "desc"]],
    limit: 1,
  });
  const cap = budgets[0]?.cents ?? null;
  const month = monthOf(localDateOf(now, ledger.profile.timezone));
  const claims = await tx.find("reward_claims", { owner_id: owner, month, budgeted: true });
  const used = claims.reduce((s, c) => s + c.amount_cents, 0);
  return { month, capCents: cap, usedCents: used, remainingCents: cap === null ? null : Math.max(0, cap - used) };
}

/**
 * Records a self-funded claim. Never moves money. With a monthly budget set, a monetary claim must fit
 * in what's left this month (checked inside the owner-locked transaction, so concurrent claims can't
 * overspend). Without a budget, monetary claims are recorded as unbudgeted.
 */
export async function claimReward(tx: Tx, deps: GameDeps, ledger: Ledger, rewardId: string, note: string) {
  const owner = ledger.profile.id;
  const reward = await tx.get("rewards", rewardId);
  if (!reward || reward.owner_id !== owner) throw new GameError("not_found", "Reward not found.", 404);
  const prior = await tx.find("reward_claims", { reward_id: reward.id });
  if (prior[0]) return prior[0];
  if (!reward.unlocked_at) throw new GameError("not_unlocked", "This reward unlocks at its milestone.", 409);
  if (reward.archived_at) throw new GameError("not_found", "This reward was archived.", 404);
  const now = deps.now();
  const status = await budgetStatus(tx, ledger, now);
  const monetary = isMonetary(reward);
  const budgeted = monetary && status.capCents !== null;
  if (budgeted && reward.amount_cents! > status.remainingCents!) {
    throw new GameError(
      "budget_exceeded",
      `This month's reward budget has $${(status.remainingCents! / 100).toFixed(2)} left; this claim is $${(reward.amount_cents! / 100).toFixed(2)}. Claim it next month or raise your budget.`,
      409,
      status,
    );
  }
  return tx.insert("reward_claims", {
    id: deps.uuid(),
    owner_id: owner,
    reward_id: reward.id,
    amount_cents: monetary ? reward.amount_cents! : 0,
    month: status.month,
    budgeted,
    claimed_at: now.toISOString(),
    note: note.slice(0, 280),
  });
}

export async function setBudget(tx: Tx, deps: GameDeps, owner: string, cents: number | null) {
  if (cents !== null && (!Number.isInteger(cents) || cents < 0 || cents > 10_000_000)) {
    throw new GameError("invalid_input", "Budget must be between $0 and $100,000.");
  }
  return tx.insert("reward_budgets", { id: deps.uuid(), owner_id: owner, cents, effective_at: deps.now().toISOString() });
}

// ───────────────────────── evidence retention ─────────────────────────

export async function deleteEvidence(tx: Tx, deps: GameDeps, owner: string, attemptId: string) {
  const a = await tx.get("verification_attempts", attemptId);
  if (!a || a.owner_id !== owner) throw new GameError("not_found", "Evidence not found.", 404);
  if (!a.image_path || a.image_deleted_at) return { path: null };
  await tx.update("verification_attempts", a.id, { image_deleted_at: deps.now().toISOString() });
  return { path: a.image_path };
}

/** Evidence images older than the retention window (decision records are kept). */
export async function expireEvidence(tx: Tx, deps: GameDeps, owner: string) {
  const cutoff = new Date(deps.now().getTime() - TIMING_RULES.evidenceRetentionDays * 86_400_000).toISOString();
  const old = await tx.find("verification_attempts", {
    owner_id: owner,
    image_deleted_at: { $null: true },
    image_path: { $ne: null },
    submitted_at: { $lt: cutoff },
  });
  const paths: string[] = [];
  for (const a of old) {
    await tx.update("verification_attempts", a.id, { image_deleted_at: deps.now().toISOString() });
    paths.push(a.image_path!);
  }
  return paths;
}
