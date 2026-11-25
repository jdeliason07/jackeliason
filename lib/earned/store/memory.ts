import { SCHEMA, type TableName, type Tables, TABLE_NAMES } from "../db/schema";
import { type Filter, type FindOptions, ImmutableRowError, isOps, type Store, type Tx, UniqueViolation } from "./types";

/**
 * In-memory store with real transaction semantics: commands run one at a time (an async mutex) and
 * a failed command rolls back to the snapshot taken when it began. Unique keys (including partial
 * ones) and ledger immutability mirror the SQL schema. Used by the demo (persisted to
 * localStorage) and by fast domain tests.
 */

type Data = { [T in TableName]: Record<string, Tables[T]> };

function emptyData(): Data {
  return Object.fromEntries(TABLE_NAMES.map((t) => [t, {}])) as unknown as Data;
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  return (a as number | string) < (b as number | string) ? -1 : 1;
}

export function matches<R>(row: R, filter: Filter<R>): boolean {
  for (const [key, cond] of Object.entries(filter)) {
    const value = (row as Record<string, unknown>)[key];
    if (isOps(cond)) {
      if (cond.$in !== undefined && !cond.$in.includes(value)) return false;
      if ("$ne" in cond && value === cond.$ne) return false;
      if (cond.$lt !== undefined && !(value !== null && compare(value, cond.$lt) < 0)) return false;
      if (cond.$lte !== undefined && !(value !== null && compare(value, cond.$lte) <= 0)) return false;
      if (cond.$gt !== undefined && !(value !== null && compare(value, cond.$gt) > 0)) return false;
      if (cond.$gte !== undefined && !(value !== null && compare(value, cond.$gte) >= 0)) return false;
      if (cond.$null !== undefined && (value === null) !== cond.$null) return false;
    } else if (value !== cond) {
      return false;
    }
  }
  return true;
}

export class MemoryStore implements Store {
  private data: Data;
  private queue: Promise<unknown> = Promise.resolve();
  /** Called after every committed transaction (the demo persists here). */
  onCommit?: (data: Data) => void;

  constructor(initial?: unknown) {
    this.data = emptyData();
    if (initial && typeof initial === "object") {
      for (const t of TABLE_NAMES) {
        const rows = (initial as Record<string, unknown>)[t];
        if (rows && typeof rows === "object") (this.data as Record<string, unknown>)[t] = structuredClone(rows);
      }
    }
  }

  export(): Data {
    return structuredClone(this.data);
  }

  transaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R> {
    const run = async () => {
      const snapshot = structuredClone(this.data);
      try {
        const result = await fn(this.tx());
        this.onCommit?.(this.data);
        return result;
      } catch (error) {
        this.data = snapshot;
        throw error;
      }
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private checkUniques<T extends TableName>(table: T, row: Tables[T], selfId?: string) {
    const spec = SCHEMA[table];
    const rows = Object.values(this.data[table]) as Tables[T][];
    for (const unique of spec.uniques) {
      const where = unique.where as ((r: Tables[T]) => boolean) | undefined;
      if (where && !where(row)) continue;
      const cols = unique.columns as (keyof Tables[T])[];
      if (cols.some((c) => row[c] === null)) continue; // SQL: NULLs are distinct
      const clash = rows.find(
        (other) =>
          (other as { id: string }).id !== selfId &&
          (!where || where(other)) &&
          cols.every((c) => other[c] === row[c]),
      );
      if (clash) throw new UniqueViolation(unique.name);
    }
  }

  private tx(): Tx {
    // Arrow functions keep `this` bound to the store (each call reads the current, possibly rolled-back data).
    return {
      get: async (table, id) => {
        const row = this.data[table][id];
        return row ? structuredClone(row) : null;
      },
      find: async (table, filter, options?: FindOptions<Tables[keyof Tables]>) => {
        let rows = Object.values(this.data[table]).filter((r) => matches(r, filter as Filter<typeof r>));
        if (options?.orderBy) {
          const order = options.orderBy;
          rows = rows.sort((a, b) => {
            for (const [col, dir] of order) {
              const c = compare((a as unknown as Record<string, unknown>)[col], (b as unknown as Record<string, unknown>)[col]);
              if (c !== 0) return dir === "asc" ? c : -c;
            }
            return 0;
          });
        }
        if (options?.limit !== undefined) rows = rows.slice(0, options.limit);
        return structuredClone(rows) as never;
      },
      insert: async (table, row) => {
        const id = (row as { id: string }).id;
        if (!id) throw new Error(`${table}: id is required`);
        if (this.data[table][id]) throw new UniqueViolation(`${table}_pkey`);
        this.checkUniques(table, row);
        (this.data[table] as Record<string, unknown>)[id] = structuredClone(row);
        return structuredClone(row);
      },
      update: async (table, id, patch) => {
        if (SCHEMA[table].immutable) throw new ImmutableRowError(table);
        const current = this.data[table][id];
        if (!current) throw new Error(`${table} ${id} not found`);
        const next = { ...current, ...structuredClone(patch), id } as Tables[typeof table];
        this.checkUniques(table, next, id);
        (this.data[table] as Record<string, unknown>)[id] = next;
        return structuredClone(next);
      },
      lockOwner: async () => {
        // The mutex already serializes every transaction.
      },
    };
  }
}
