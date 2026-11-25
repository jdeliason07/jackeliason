/**
 * Row types and a column descriptor for every table in the `earned` schema.
 *
 * The SQL source of truth is supabase/migrations/*.sql. This file mirrors it for the two store
 * implementations (lib/earned/store/memory.ts and lib/earned/store/postgres.ts); a test applies the
 * migrations to PGlite and fails if the columns here drift from the database
 * (tests/earned/db.test.ts). `npm run earned:types` regenerates lib/earned/db/database.types.ts.
 *
 * Timestamps are ISO strings (UTC, `Z`), dates are "YYYY-MM-DD", money is integer cents.
 */

import type { QuestMomentumState } from "../domain/momentum";

export type ColumnType = "uuid" | "text" | "int" | "bigint" | "bool" | "timestamptz" | "date" | "jsonb" | "float";

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json | undefined };

export interface Profiles {
  id: string;
  display_name: string;
  timezone: string;
  focus: "insight" | "execution" | "influence";
  appearance: Json;
  xp_total: number;
  level: number;
  credits: number;
  vitality: number;
  tickets: number;
  minimums_total: number;
  chests_earned: number;
  level_config_version: number;
  policy: Json;
  onboarded_at: string | null;
  last_catchup_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OwnerAllowlist {
  id: string;
  email: string;
  created_at: string;
}

export interface LevelConfigVersions {
  id: string;
  version: number;
  config: Json;
  created_at: string;
}

export interface QuestTemplates {
  id: string;
  version: number;
  category: string;
  title: string;
  content: Json;
}

export interface ItemDefinitions {
  id: string;
  kind: "cosmetic" | "decoration" | "component";
  slot: string | null;
  rarity: string;
  name: string;
  description: string;
  stats: Json;
  is_unique: boolean;
  art: string;
  color: string;
}

export interface BattleDefinitions {
  id: string;
  version: number;
  category: string;
  title: string;
  content: Json;
}

export type QuestStatus = "active" | "paused" | "archived";

export interface Quests {
  id: string;
  owner_id: string;
  habit_key: string;
  template_id: string | null;
  status: QuestStatus;
  current_version_id: string | null;
  momentum: QuestMomentumState & Json;
  materialized_through: string | null;
  created_at: string;
  activated_at: string;
  paused_at: string | null;
  archived_at: string | null;
  updated_at: string;
}

export interface QuestVersions {
  id: string;
  owner_id: string;
  quest_id: string;
  version_no: number;
  effective_from: string;
  timezone: string;
  definition: Json;
  created_at: string;
}

export interface QuestPauses {
  id: string;
  owner_id: string;
  quest_id: string;
  paused_at: string;
  resumed_at: string | null;
}

export type WeekStatus = "open" | "met" | "missed" | "excused";

export interface QuestWeeks {
  id: string;
  owner_id: string;
  quest_id: string;
  quest_version_id: string;
  week_start: string;
  target: number;
  completed: number;
  opens_at: string;
  closes_at: string;
  timezone: string;
  status: WeekStatus;
  evaluated_at: string | null;
  created_at: string;
}

export type OccurrenceStatus = "open" | "completed" | "missed" | "excused" | "lapsed";
export type OptionalStatus = "none" | "active" | "finished" | "declined" | "expired" | "abandoned";

export interface QuestOccurrences {
  id: string;
  owner_id: string;
  quest_id: string;
  quest_version_id: string;
  habit_key: string;
  kind: "scheduled" | "weekly_slot";
  local_date: string;
  week_id: string | null;
  opens_at: string;
  closes_at: string;
  timezone: string;
  snapshot: Json;
  status: OccurrenceStatus;
  optional_status: OptionalStatus;
  completed_at: string | null;
  verification_attempt_id: string | null;
  evaluated_at: string | null;
  resolution_note: string | null;
  created_at: string;
}

export interface OptionalSessions {
  id: string;
  owner_id: string;
  occurrence_id: string;
  status: "active" | "finished" | "abandoned" | "expired";
  started_at: string;
  ends_at: string;
  finished_at: string | null;
  rating: number | null;
  bonus_xp: number;
  created_at: string;
}

export interface CaptureChallenges {
  id: string;
  owner_id: string;
  occurrence_id: string;
  token_hash: string;
  issued_at: string;
  expires_at: string;
  used_at: string | null;
}

export type AttemptStatus = "pending" | "accepted" | "rejected" | "inconclusive" | "unavailable" | "excused";

export interface VerificationAttempts {
  id: string;
  owner_id: string;
  occurrence_id: string;
  challenge_id: string | null;
  idempotency_key: string | null;
  mode: "photo" | "gps";
  status: AttemptStatus;
  reason: string;
  guidance: string | null;
  provider: string | null;
  model: string | null;
  rubric: Json;
  image_path: string | null;
  image_sha256: string | null;
  image_dhash: string | null;
  reuse_of: string | null;
  similar_to: string | null;
  image_deleted_at: string | null;
  distance_m: number | null;
  accuracy_m: number | null;
  reading_at: string | null;
  evaluations: number;
  demo: boolean;
  submitted_at: string;
  decided_at: string | null;
}

export interface XpEvents {
  id: string;
  owner_id: string;
  kind: "attendance" | "effort_bonus";
  amount: number;
  source_id: string;
  occurrence_id: string | null;
  quest_id: string | null;
  level_before: number;
  level_after: number;
  created_at: string;
}

export type WalletKind = "chest" | "duplicate" | "momentum" | "battle" | "purchase";

export interface WalletEvents {
  id: string;
  owner_id: string;
  kind: WalletKind;
  delta: number;
  source_id: string;
  note: string;
  created_at: string;
}

export interface TicketEvents {
  id: string;
  owner_id: string;
  kind: "earned" | "spent";
  delta: number;
  source_id: string;
  local_date: string;
  created_at: string;
}

export type ConsequenceKind =
  | "miss"
  | "week_missed"
  | "week_met"
  | "momentum_activated"
  | "momentum_suspended"
  | "momentum_restored"
  | "vitality_loss"
  | "vitality_restored"
  | "technical_excuse";

export interface ConsequenceEvents {
  id: string;
  owner_id: string;
  quest_id: string | null;
  kind: ConsequenceKind;
  source_id: string;
  miss_count: number | null;
  vitality_requested: number;
  vitality_delta: number;
  day: string;
  policy_version: number;
  explanation: string;
  created_at: string;
}

export interface ChestEntitlements {
  id: string;
  owner_id: string;
  seq: number;
  source_occurrence_id: string;
  earned_at: string;
  opened_at: string | null;
}

export interface ChestOpenings {
  id: string;
  owner_id: string;
  entitlement_id: string;
  loot_table_version: number;
  rarity: string;
  credits: number;
  item_id: string;
  duplicate_credits: number;
  opened_at: string;
}

export interface Inventory {
  id: string;
  owner_id: string;
  item_id: string;
  kind: "cosmetic" | "decoration" | "component";
  slot: string | null;
  quantity: number;
  equipped: boolean;
  first_acquired_at: string;
  updated_at: string;
}

export interface EstateBuildings {
  id: string;
  owner_id: string;
  area: string;
  tier: number;
  cost: number;
  purchased_at: string;
}

export interface BattleSessions {
  id: string;
  owner_id: string;
  scenario_id: string;
  scenario_version: number;
  mode: "practice" | "rewarded";
  status: "active" | "finished" | "abandoned";
  seed: number;
  state: Json;
  loadout: Json;
  ticket_source_id: string | null;
  reward_credits: number;
  outcome: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface BattleTurns {
  id: string;
  owner_id: string;
  battle_id: string;
  round: number;
  intent_id: string;
  choice_id: string;
  result: Json;
  created_at: string;
}

export interface Rewards {
  id: string;
  owner_id: string;
  title: string;
  kind: "money" | "gift_card" | "experience" | "other";
  description: string;
  amount_cents: number | null;
  target_level: number | null;
  target_minimums: number | null;
  unlocked_at: string | null;
  archived_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface RewardClaims {
  id: string;
  owner_id: string;
  reward_id: string;
  amount_cents: number;
  month: string;
  budgeted: boolean;
  claimed_at: string;
  note: string;
}

export interface RewardBudgets {
  id: string;
  owner_id: string;
  cents: number | null;
  effective_at: string;
}

export interface CommandReceipts {
  id: string;
  owner_id: string;
  idempotency_key: string;
  command: string;
  response: Json;
  created_at: string;
}

export interface Tables {
  profiles: Profiles;
  owner_allowlist: OwnerAllowlist;
  level_config_versions: LevelConfigVersions;
  quest_templates: QuestTemplates;
  item_definitions: ItemDefinitions;
  battle_definitions: BattleDefinitions;
  quests: Quests;
  quest_versions: QuestVersions;
  quest_pauses: QuestPauses;
  quest_weeks: QuestWeeks;
  quest_occurrences: QuestOccurrences;
  optional_sessions: OptionalSessions;
  capture_challenges: CaptureChallenges;
  verification_attempts: VerificationAttempts;
  xp_events: XpEvents;
  wallet_events: WalletEvents;
  ticket_events: TicketEvents;
  consequence_events: ConsequenceEvents;
  chest_entitlements: ChestEntitlements;
  chest_openings: ChestOpenings;
  inventory: Inventory;
  estate_buildings: EstateBuildings;
  battle_sessions: BattleSessions;
  battle_turns: BattleTurns;
  rewards: Rewards;
  reward_claims: RewardClaims;
  reward_budgets: RewardBudgets;
  command_receipts: CommandReceipts;
}

export type TableName = keyof Tables;

export interface UniqueKey<R> {
  name: string;
  columns: (keyof R & string)[];
  /** Partial unique index predicate (mirrors the SQL WHERE clause). */
  where?: (row: R) => boolean;
}

export interface TableSpec<R> {
  columns: Record<keyof R & string, ColumnType>;
  uniques: UniqueKey<R>[];
  /** Ledger tables never update or delete (enforced by triggers in SQL, by the store in memory). */
  immutable?: boolean;
}

type Specs = { [T in TableName]: TableSpec<Tables[T]> };

const ts = "timestamptz" as const;

export const SCHEMA: Specs = {
  profiles: {
    columns: {
      id: "uuid", display_name: "text", timezone: "text", focus: "text", appearance: "jsonb", xp_total: "int", level: "int",
      credits: "int", vitality: "int", tickets: "int", minimums_total: "int", chests_earned: "int", level_config_version: "int",
      policy: "jsonb", onboarded_at: ts, last_catchup_at: ts, created_at: ts, updated_at: ts,
    },
    uniques: [],
  },
  owner_allowlist: { columns: { id: "uuid", email: "text", created_at: ts }, uniques: [{ name: "owner_allowlist_email_key", columns: ["email"] }] },
  level_config_versions: {
    columns: { id: "text", version: "int", config: "jsonb", created_at: ts },
    uniques: [{ name: "level_config_versions_version_key", columns: ["version"] }],
    immutable: true,
  },
  quest_templates: { columns: { id: "text", version: "int", category: "text", title: "text", content: "jsonb" }, uniques: [] },
  item_definitions: {
    columns: {
      id: "text", kind: "text", slot: "text", rarity: "text", name: "text", description: "text", stats: "jsonb", is_unique: "bool",
      art: "text", color: "text",
    },
    uniques: [],
  },
  battle_definitions: { columns: { id: "text", version: "int", category: "text", title: "text", content: "jsonb" }, uniques: [] },
  quests: {
    columns: {
      id: "uuid", owner_id: "uuid", habit_key: "text", template_id: "text", status: "text", current_version_id: "uuid", momentum: "jsonb",
      materialized_through: "date", created_at: ts, activated_at: ts, paused_at: ts, archived_at: ts, updated_at: ts,
    },
    uniques: [],
  },
  quest_versions: {
    columns: {
      id: "uuid", owner_id: "uuid", quest_id: "uuid", version_no: "int", effective_from: ts, timezone: "text", definition: "jsonb",
      created_at: ts,
    },
    uniques: [{ name: "quest_versions_quest_id_version_no_key", columns: ["quest_id", "version_no"] }],
    immutable: true,
  },
  quest_pauses: { columns: { id: "uuid", owner_id: "uuid", quest_id: "uuid", paused_at: ts, resumed_at: ts }, uniques: [] },
  quest_weeks: {
    columns: {
      id: "uuid", owner_id: "uuid", quest_id: "uuid", quest_version_id: "uuid", week_start: "date", target: "int", completed: "int",
      opens_at: ts, closes_at: ts, timezone: "text", status: "text", evaluated_at: ts, created_at: ts,
    },
    uniques: [{ name: "quest_weeks_quest_id_week_start_key", columns: ["quest_id", "week_start"] }],
  },
  quest_occurrences: {
    columns: {
      id: "uuid", owner_id: "uuid", quest_id: "uuid", quest_version_id: "uuid", habit_key: "text", kind: "text", local_date: "date",
      week_id: "uuid", opens_at: ts, closes_at: ts, timezone: "text", snapshot: "jsonb", status: "text", optional_status: "text",
      completed_at: ts, verification_attempt_id: "uuid", evaluated_at: ts, resolution_note: "text", created_at: ts,
    },
    uniques: [
      { name: "quest_occurrences_quest_id_local_date_key", columns: ["quest_id", "local_date"] },
      {
        name: "quest_occurrences_one_completion_per_habit_day",
        columns: ["owner_id", "habit_key", "local_date"],
        where: (r) => r.status === "completed",
      },
    ],
  },
  optional_sessions: {
    columns: {
      id: "uuid", owner_id: "uuid", occurrence_id: "uuid", status: "text", started_at: ts, ends_at: ts, finished_at: ts, rating: "int",
      bonus_xp: "int", created_at: ts,
    },
    uniques: [{ name: "optional_sessions_occurrence_id_key", columns: ["occurrence_id"] }],
  },
  capture_challenges: {
    columns: { id: "uuid", owner_id: "uuid", occurrence_id: "uuid", token_hash: "text", issued_at: ts, expires_at: ts, used_at: ts },
    uniques: [],
  },
  verification_attempts: {
    columns: {
      id: "uuid", owner_id: "uuid", occurrence_id: "uuid", challenge_id: "uuid", idempotency_key: "text", mode: "text", status: "text",
      reason: "text", guidance: "text", provider: "text", model: "text", rubric: "jsonb", image_path: "text", image_sha256: "text",
      image_dhash: "text", reuse_of: "uuid", similar_to: "uuid", image_deleted_at: ts, distance_m: "float", accuracy_m: "float",
      reading_at: ts, evaluations: "int", demo: "bool", submitted_at: ts, decided_at: ts,
    },
    uniques: [
      { name: "verification_attempts_challenge_id_key", columns: ["challenge_id"], where: (r) => r.challenge_id !== null },
      {
        name: "verification_attempts_idempotency_key",
        columns: ["owner_id", "idempotency_key"],
        where: (r) => r.idempotency_key !== null,
      },
      {
        name: "verification_attempts_unique_image",
        columns: ["owner_id", "image_sha256"],
        where: (r) => r.image_sha256 !== null && r.reuse_of === null,
      },
    ],
  },
  xp_events: {
    columns: {
      id: "uuid", owner_id: "uuid", kind: "text", amount: "int", source_id: "text", occurrence_id: "uuid", quest_id: "uuid",
      level_before: "int", level_after: "int", created_at: ts,
    },
    uniques: [{ name: "xp_events_owner_id_kind_source_id_key", columns: ["owner_id", "kind", "source_id"] }],
    immutable: true,
  },
  wallet_events: {
    columns: { id: "uuid", owner_id: "uuid", kind: "text", delta: "int", source_id: "text", note: "text", created_at: ts },
    uniques: [{ name: "wallet_events_owner_id_kind_source_id_key", columns: ["owner_id", "kind", "source_id"] }],
    immutable: true,
  },
  ticket_events: {
    columns: { id: "uuid", owner_id: "uuid", kind: "text", delta: "int", source_id: "text", local_date: "date", created_at: ts },
    uniques: [{ name: "ticket_events_owner_id_kind_source_id_key", columns: ["owner_id", "kind", "source_id"] }],
    immutable: true,
  },
  consequence_events: {
    columns: {
      id: "uuid", owner_id: "uuid", quest_id: "uuid", kind: "text", source_id: "text", miss_count: "int", vitality_requested: "int",
      vitality_delta: "int", day: "date", policy_version: "int", explanation: "text", created_at: ts,
    },
    uniques: [{ name: "consequence_events_owner_id_kind_source_id_key", columns: ["owner_id", "kind", "source_id"] }],
    immutable: true,
  },
  chest_entitlements: {
    columns: { id: "uuid", owner_id: "uuid", seq: "int", source_occurrence_id: "uuid", earned_at: ts, opened_at: ts },
    uniques: [{ name: "chest_entitlements_owner_id_seq_key", columns: ["owner_id", "seq"] }],
  },
  chest_openings: {
    columns: {
      id: "uuid", owner_id: "uuid", entitlement_id: "uuid", loot_table_version: "int", rarity: "text", credits: "int", item_id: "text",
      duplicate_credits: "int", opened_at: ts,
    },
    uniques: [{ name: "chest_openings_entitlement_id_key", columns: ["entitlement_id"] }],
    immutable: true,
  },
  inventory: {
    columns: {
      id: "uuid", owner_id: "uuid", item_id: "text", kind: "text", slot: "text", quantity: "int", equipped: "bool", first_acquired_at: ts,
      updated_at: ts,
    },
    uniques: [
      { name: "inventory_owner_id_item_id_key", columns: ["owner_id", "item_id"] },
      { name: "inventory_one_equipped_per_slot", columns: ["owner_id", "slot"], where: (r) => r.equipped && r.kind === "cosmetic" },
    ],
  },
  estate_buildings: {
    columns: { id: "uuid", owner_id: "uuid", area: "text", tier: "int", cost: "int", purchased_at: ts },
    uniques: [{ name: "estate_buildings_owner_id_area_tier_key", columns: ["owner_id", "area", "tier"] }],
    immutable: true,
  },
  battle_sessions: {
    columns: {
      id: "uuid", owner_id: "uuid", scenario_id: "text", scenario_version: "int", mode: "text", status: "text", seed: "bigint", state: "jsonb",
      loadout: "jsonb", ticket_source_id: "text", reward_credits: "int", outcome: "text", started_at: ts, finished_at: ts,
    },
    uniques: [{ name: "battle_sessions_one_active", columns: ["owner_id"], where: (r) => r.status === "active" }],
  },
  battle_turns: {
    columns: {
      id: "uuid", owner_id: "uuid", battle_id: "uuid", round: "int", intent_id: "text", choice_id: "text", result: "jsonb", created_at: ts,
    },
    uniques: [{ name: "battle_turns_battle_id_round_key", columns: ["battle_id", "round"] }],
    immutable: true,
  },
  rewards: {
    columns: {
      id: "uuid", owner_id: "uuid", title: "text", kind: "text", description: "text", amount_cents: "int", target_level: "int",
      target_minimums: "int", unlocked_at: ts, archived_at: ts, notes: "text", created_at: ts, updated_at: ts,
    },
    uniques: [],
  },
  reward_claims: {
    columns: {
      id: "uuid", owner_id: "uuid", reward_id: "uuid", amount_cents: "int", month: "text", budgeted: "bool", claimed_at: ts, note: "text",
    },
    uniques: [{ name: "reward_claims_reward_id_key", columns: ["reward_id"] }],
    immutable: true,
  },
  reward_budgets: {
    columns: { id: "uuid", owner_id: "uuid", cents: "int", effective_at: ts },
    uniques: [],
    immutable: true,
  },
  command_receipts: {
    columns: { id: "uuid", owner_id: "uuid", idempotency_key: "text", command: "text", response: "jsonb", created_at: ts },
    uniques: [{ name: "command_receipts_owner_id_idempotency_key_key", columns: ["owner_id", "idempotency_key"] }],
    immutable: true,
  },
};

export const TABLE_NAMES = Object.keys(SCHEMA) as TableName[];

/** Tables whose rows belong to one owner (owner_id column). */
export const OWNED_TABLES = TABLE_NAMES.filter((t) => "owner_id" in SCHEMA[t].columns);

// Compile-time guard: these hand-written row types must have exactly the columns of the generated
// database types (lib/earned/db/database.types.ts, from the migrations).
type GeneratedTables = import("./database.types").Database["earned"]["Tables"];
type SameKeys<A, B> = [Exclude<keyof A, keyof B>] extends [never] ? ([Exclude<keyof B, keyof A>] extends [never] ? true : false) : false;
type AllMatch = { [T in TableName]: SameKeys<Tables[T], GeneratedTables[T]["Row"]> }[TableName];
type Assert<T extends true> = T;
export type _SchemaMatchesGeneratedTypes = Assert<false extends AllMatch ? false : true>;
