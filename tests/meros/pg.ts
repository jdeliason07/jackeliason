import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PostgresStore, type SqlDriver } from "@/lib/meros/store/postgres";

const root = path.resolve(import.meta.dirname, "../..");

/** A fresh in-process Postgres with the Supabase shim, every migration, and the seed applied. */
export async function freshDatabase() {
  const db = new PGlite();
  await db.exec(readFileSync(path.join(root, "tests/meros/supabase-shim.sql"), "utf8"));
  const dir = path.join(root, "supabase/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(path.join(dir, file), "utf8"));
  }
  await db.exec(readFileSync(path.join(root, "supabase/seed.sql"), "utf8"));
  return db;
}

export function pgliteDriver(db: PGlite): SqlDriver {
  return {
    begin: (fn) =>
      db.transaction(async (tx) =>
        fn({ query: async (text, params) => ({ rows: (await tx.query(text, params)).rows as Record<string, unknown>[] }) }),
      ),
  };
}

export async function pgStore() {
  const db = await freshDatabase();
  return { db, store: new PostgresStore(pgliteDriver(db)) };
}

/** Adds an auth user and allowlists their email. */
export async function addOwner(db: PGlite, id: string, email: string) {
  await db.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
  await db.query("insert into meros.owner_allowlist (email) values ($1)", [email.toLowerCase()]);
}

/** Runs `sql` as a signed-in client (role authenticated with JWT claims), inside a rolled-back transaction. */
export async function asClient<T>(db: PGlite, sub: string | null, fn: (q: (sql: string, params?: unknown[]) => Promise<T[]>) => Promise<void>) {
  await db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(sub ? { sub, role: "authenticated" } : { role: "anon" })]);
    await tx.query(`set local role ${sub ? "authenticated" : "anon"}`);
    await fn(async (sql, params) => (await tx.query(sql, params ?? [])).rows as T[]);
    await tx.rollback();
  }).catch((e: unknown) => {
    if (e instanceof Error && /rollback/i.test(e.message)) return;
    throw e;
  });
}
