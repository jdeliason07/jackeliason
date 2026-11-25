import type { TableName, Tables } from "../db/schema";

/**
 * The persistence boundary. The game service (lib/meros/service) speaks only this interface, so the
 * same rules run against Postgres in production (lib/meros/store/postgres.ts) and against an
 * in-memory store for the demo and fast tests (lib/meros/store/memory.ts).
 *
 * Every command runs inside `transaction`, which also takes a per-owner lock, so concurrent
 * requests for one owner are serialized and unique constraints act as a final backstop.
 */

export type Scalar = string | number | boolean | null;

export interface Ops<V> {
  $in?: V[];
  $ne?: V;
  $lt?: V;
  $lte?: V;
  $gt?: V;
  $gte?: V;
  $null?: boolean;
}

export type Filter<R> = { [K in keyof R]?: R[K] | Ops<R[K]> };

export interface FindOptions<R> {
  orderBy?: [keyof R & string, "asc" | "desc"][];
  limit?: number;
}

export interface Tx {
  get<T extends TableName>(table: T, id: string): Promise<Tables[T] | null>;
  find<T extends TableName>(table: T, filter: Filter<Tables[T]>, options?: FindOptions<Tables[T]>): Promise<Tables[T][]>;
  insert<T extends TableName>(table: T, row: Tables[T]): Promise<Tables[T]>;
  update<T extends TableName>(table: T, id: string, patch: Partial<Tables[T]>): Promise<Tables[T]>;
  /** Serializes all of one owner's mutations (Postgres: transaction-scoped advisory lock). */
  lockOwner(ownerId: string): Promise<void>;
}

export interface Store {
  transaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R>;
}

export class UniqueViolation extends Error {
  constructor(public constraint: string) {
    super(`unique violation: ${constraint}`);
    this.name = "UniqueViolation";
  }
}

export class ImmutableRowError extends Error {
  constructor(table: string) {
    super(`${table} rows are immutable`);
    this.name = "ImmutableRowError";
  }
}

export function isOps(value: unknown): value is Ops<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0 &&
    Object.keys(value).every((k) => k.startsWith("$"))
  );
}
