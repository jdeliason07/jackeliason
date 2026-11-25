import { describe, expect, it } from "vitest";
import { postgresTx } from "@/lib/meros/store/postgres";
import { makeGame, onboard, OWNER } from "./helpers";
import { addOwner, pgStore } from "./pg";

/**
 * postgres.js (production) re-serializes parameters by the type the server reports for them, so a
 * pre-encoded JSON string bound straight to `$1::jsonb` was stored as a jsonb *string*. That broke the
 * live app right after onboarding (appearance came back as text). PGlite doesn't behave this way, so
 * these tests pin the SQL shape and the read-side repair instead.
 */
describe("postgres parameters", () => {
  it("binds every parameter as text before casting", async () => {
    const sql: string[] = [];
    const tx = postgresTx({
      query: async (text) => {
        sql.push(text);
        return { rows: [{ r: { id: OWNER } }] };
      },
    });
    await tx.get("profiles", OWNER);
    await tx.find("quests", { owner_id: OWNER, status: { $in: ["active"] }, created_at: { $gte: "2026-01-01T00:00:00Z" } });
    await tx.update("profiles", OWNER, { appearance: { skin: "#000" } as never, credits: 3 });
    await tx.insert("owner_allowlist", { id: OWNER, email: "a@example.com", created_at: "2026-01-01T00:00:00Z" });
    const casts = sql.flatMap((s) => [...s.matchAll(/\$\d+::([a-z]+)/g)].map((m) => m[1]));
    expect(casts.length).toBeGreaterThan(5);
    expect(new Set(casts)).toEqual(new Set(["text"]));
  });

  it("reads rows that were written double-encoded", async () => {
    const { db, store } = await pgStore();
    await addOwner(db, OWNER, "owner@example.com");
    const { game, run } = makeGame("2026-03-02T15:00:00Z", { store, mode: "live" });
    await onboard(run);
    // Reproduce what the old code stored in production: the object as a jsonb string.
    await db.query("update meros.profiles set appearance = to_jsonb(appearance::text), policy = to_jsonb(policy::text) where id = $1", [OWNER]);
    const typeofs = await db.query<{ a: string }>("select jsonb_typeof(appearance) a from meros.profiles where id = $1", [OWNER]);
    expect(typeofs.rows[0].a).toBe("string");
    const view = (await game.view(OWNER))!;
    expect(typeof view.profile.appearance).toBe("object");
    expect(view.profile.appearance.skin).toMatch(/^#/);
  });
});
