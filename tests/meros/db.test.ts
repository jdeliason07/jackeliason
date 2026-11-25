import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { seedSql } from "@/lib/meros/db/seed";
import { SCHEMA, TABLE_NAMES } from "@/lib/meros/db/schema";
import { completeWithSyntheticAcceptance, type Game } from "@/lib/meros/service/game";
import { definitionFrom, makeGame, OTHER, OWNER, template } from "./helpers";
import { addOwner, asClient, pgStore } from "./pg";

let db: PGlite;
let game: Game;
let otherGame: Game;

beforeAll(async () => {
  const pg = await pgStore();
  db = pg.db;
  await addOwner(db, OWNER, "owner@example.com");
  await addOwner(db, OTHER, "other@example.com");
  const a = makeGame("2026-03-02T15:00:00Z", { store: pg.store, mode: "live" });
  game = a.game;
  await a.run({ type: "onboard", displayName: "A", timezone: "America/Denver", focus: "insight" });
  await a.run({ type: "createQuest", templateId: "learn-open-textbook", definition: { ...definitionFrom(template("learn-open-textbook")), schedule: { kind: "daily", window: { start: "00:00", end: "24:00" } } }, confirmDistinct: true });
  await a.run({ type: "createQuest", templateId: "fit-enter-gym", definition: { ...definitionFrom(template("fit-enter-gym")), schedule: { kind: "daily", window: { start: "00:00", end: "24:00" } } }, confirmDistinct: true });
  const v = (await game.view(OWNER))!;
  await completeWithSyntheticAcceptance(game, OWNER, v.today.due[0].occurrenceId, false);
  // A second owner with their own data.
  const b = makeGame("2026-03-02T15:00:00Z", { store: pg.store, mode: "live" });
  otherGame = b.game;
  await b.game.command(OTHER, { type: "onboard", displayName: "B", timezone: "UTC", focus: "execution" }, "other-onboard");
  await b.game.command(OTHER, { type: "createQuest", templateId: "home-make-bed", definition: definitionFrom(template("home-make-bed")), confirmDistinct: true }, "other-quest-1");
});

describe("schema", () => {
  it("matches the TypeScript descriptor column-for-column", async () => {
    for (const table of TABLE_NAMES) {
      const res = await db.query<{ column_name: string }>(
        "select column_name from information_schema.columns where table_schema = 'meros' and table_name = $1",
        [table],
      );
      expect(res.rows.map((r) => r.column_name).sort(), table).toEqual(Object.keys(SCHEMA[table].columns).sort());
    }
  });

  it("ships a seed generated from the current content catalogs", () => {
    expect(readFileSync("supabase/seed.sql", "utf8")).toBe(seedSql());
  });

  it("enables and forces RLS on every table", async () => {
    const res = await db.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      "select relname, relrowsecurity, relforcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'meros' and c.relkind = 'r'",
    );
    expect(res.rows.length).toBe(TABLE_NAMES.length);
    for (const r of res.rows) expect([r.relname, r.relrowsecurity, r.relforcerowsecurity]).toEqual([r.relname, true, true]);
  });

  it("pins search_path on every function in the schema", async () => {
    const res = await db.query<{ proname: string; proconfig: string[] | null }>(
      "select proname, proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'meros'",
    );
    for (const f of res.rows) expect(f.proconfig?.some((c) => c.startsWith("search_path=")), f.proname).toBe(true);
  });
});

describe("row-level security", () => {
  it("lets an owner read only their own rows", async () => {
    await asClient<{ owner_id: string }>(db, OWNER, async (q) => {
      const quests = await q("select owner_id from meros.quests");
      expect(quests.length).toBe(2);
      expect(quests.every((r) => r.owner_id === OWNER)).toBe(true);
      const profiles = await q("select id as owner_id from meros.profiles");
      expect(profiles).toEqual([{ owner_id: OWNER }]);
    });
    await asClient<{ owner_id: string }>(db, OTHER, async (q) => {
      const quests = await q("select owner_id from meros.quests");
      expect(quests.every((r) => r.owner_id === OTHER)).toBe(true);
      expect((await q("select owner_id from meros.xp_events")).length).toBe(0);
    });
  });

  it("gives anonymous clients nothing", async () => {
    await asClient(db, null, async (q) => {
      await expect(q("select * from meros.quests")).rejects.toThrow(/permission denied/);
    });
  });

  it("denies a valid session that isn't allowlisted", async () => {
    const stranger = "00000000-0000-4000-8000-00000000beef";
    await db.query("insert into auth.users (id, email) values ($1, 'stranger@example.com')", [stranger]);
    await asClient(db, stranger, async (q) => {
      expect((await q("select * from meros.quest_templates")).length).toBe(0);
    });
  });

  it("blocks client writes to balances, verification decisions, randomness, and penalties", async () => {
    const attempts = [
      "update meros.profiles set xp_total = 99999",
      "insert into meros.xp_events (id, owner_id, kind, amount, source_id, level_before, level_after, created_at) values (gen_random_uuid(), auth.uid(), 'attendance', 10, 'x', 1, 1, now())",
      "update meros.verification_attempts set status = 'accepted'",
      "insert into meros.chest_openings (id, owner_id, entitlement_id, loot_table_version, rarity, credits, item_id, opened_at) values (gen_random_uuid(), auth.uid(), gen_random_uuid(), 1, 'legendary', 999, 'hand-gavel', now())",
      "delete from meros.consequence_events",
      "insert into meros.wallet_events (id, owner_id, kind, delta, source_id, created_at) values (gen_random_uuid(), auth.uid(), 'chest', 999, 'x', now())",
      "update meros.battle_sessions set seed = 1",
    ];
    for (const sql of attempts) {
      await asClient(db, OWNER, async (q) => {
        await expect(q(sql), sql).rejects.toThrow(/permission denied/);
      });
    }
  });

  it("keeps capture tokens, receipts, and the allowlist server-only", async () => {
    for (const t of ["capture_challenges", "command_receipts", "owner_allowlist"]) {
      await asClient(db, OWNER, async (q) => {
        await expect(q(`select * from meros.${t}`)).rejects.toThrow(/permission denied/);
      });
    }
  });

  it("lets owners read only their own evidence folder in private storage", async () => {
    await db.query("insert into storage.objects (bucket_id, name) values ('meros-evidence', $1), ('meros-evidence', $2)", [
      `${OWNER}/a.jpg`,
      `${OTHER}/b.jpg`,
    ]);
    const bucket = await db.query<{ public: boolean }>("select public from storage.buckets where id = 'meros-evidence'");
    expect(bucket.rows[0].public).toBe(false);
    await asClient<{ name: string }>(db, OWNER, async (q) => {
      expect((await q("select name from storage.objects")).map((r) => r.name)).toEqual([`${OWNER}/a.jpg`]);
      await expect(q("insert into storage.objects (bucket_id, name) values ('meros-evidence', 'x')")).rejects.toThrow(/permission denied|violates/);
    });
  });
});

describe("database guarantees", () => {
  it("makes ledgers append-only for every role", async () => {
    const counts = await db.query<{ xp: number; wallet: number }>("select (select count(*)::int from meros.xp_events) xp, (select count(*)::int from meros.wallet_events) wallet");
    expect(counts.rows[0].xp).toBeGreaterThan(0);
    await expect(db.query("update meros.xp_events set amount = 40")).rejects.toThrow(/append-only/);
    await expect(db.query("delete from meros.xp_events")).rejects.toThrow(/append-only/);
    await expect(db.query("truncate meros.wallet_events")).rejects.toThrow(/append-only/);
    await expect(db.query("delete from meros.ticket_events")).rejects.toThrow(/append-only/);
    await expect(db.query("update meros.quest_versions set version_no = 9")).rejects.toThrow(/append-only/);
  });

  it("rejects XP without a completed occurrence", async () => {
    await expect(
      db.query(
        "insert into meros.xp_events (id, owner_id, kind, amount, source_id, level_before, level_after, created_at) values (gen_random_uuid(), $1, 'attendance', 10, 'forged', 1, 1, now())",
        [OWNER],
      ),
    ).rejects.toThrow(/verified, completed occurrence/);
  });

  it("can never hold demo verification", async () => {
    const occ = await db.query<{ id: string }>("select id from meros.quest_occurrences where owner_id = $1 limit 1", [OWNER]);
    await expect(
      db.query(
        "insert into meros.verification_attempts (id, owner_id, occurrence_id, mode, status, rubric, demo, submitted_at) values (gen_random_uuid(), $1, $2, 'photo', 'accepted', '{}', true, now())",
        [OWNER, occ.rows[0].id],
      ),
    ).rejects.toThrow(/check/);
  });

  it("prevents cross-account references", async () => {
    const otherQuest = await db.query<{ id: string }>("select id from meros.quests where owner_id = $1 limit 1", [OTHER]);
    await expect(
      db.query(
        "insert into meros.quest_pauses (id, owner_id, quest_id, paused_at) values (gen_random_uuid(), $1, $2, now())",
        [OWNER, otherQuest.rows[0].id],
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("reconciles every cached balance with its ledger", async () => {
    for (const owner of [OWNER, OTHER]) {
      const drift = await db.query("select * from meros.ledger_drift($1)", [owner]);
      expect(drift.rows).toEqual([]);
    }
    void otherGame;
  });

  it("refuses another owner's ledger_drift call from a client", async () => {
    await asClient(db, OWNER, async (q) => {
      await expect(q(`select * from meros.ledger_drift('${OTHER}')`)).rejects.toThrow(/not allowed/);
    });
    await asClient(db, OWNER, async (q) => {
      expect(await q(`select * from meros.ledger_drift('${OWNER}')`)).toEqual([]);
    });
  });
});
