import "server-only";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { cryptoRng, randomSeed } from "../domain/random";
import { createGame, type Game } from "../service/game";
import { PostgresStore, type SqlDriver } from "../store/postgres";
import { serverEnv } from "./env";

/**
 * The production database connection: postgres.js over Supabase's pooler (transaction mode, so no
 * prepared statements). One small pool per server instance. Each game command is one transaction
 * holding a per-owner advisory lock.
 */

let sql: ReturnType<typeof postgres> | null = null;

function client() {
  const url = serverEnv().databaseUrl;
  if (!url) throw new Error("EARNED_DATABASE_URL is not set");
  if (!sql) {
    sql = postgres(url, { prepare: false, max: 3, idle_timeout: 20, connect_timeout: 10, ssl: url.includes("localhost") ? false : "require" });
  }
  return sql;
}

export function postgresDriver(): SqlDriver {
  return {
    begin: async (fn) => {
      const result = await client().begin(async (tx) =>
        fn({
          query: async (text, params) => ({
            rows: (await tx.unsafe(text, params as postgres.ParameterOrJSON<never>[])) as unknown as Record<string, unknown>[],
          }),
        }),
      );
      return result as Awaited<ReturnType<typeof fn>>;
    },
  };
}

let game: Game | null = null;

export function liveGame(): Game {
  if (!game) {
    game = createGame({
      store: new PostgresStore(postgresDriver()),
      now: () => new Date(),
      rng: cryptoRng(),
      seed: randomSeed,
      uuid: randomUUID,
      mode: "live",
    });
  }
  return game;
}

/** Keeps the database allowlist (used by RLS) in step with EARNED_OWNER_EMAILS. */
export async function ensureAllowlisted(email: string): Promise<void> {
  await client()`insert into earned.owner_allowlist (email) values (${email.toLowerCase()}) on conflict (email) do nothing`;
}

export async function allOwnerIds(): Promise<string[]> {
  const rows = await client()`select id from earned.profiles where onboarded_at is not null`;
  return rows.map((r) => r.id as string);
}
