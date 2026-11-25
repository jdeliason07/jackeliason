import { type ColumnType, SCHEMA, type TableName, type Tables } from "../db/schema";
import { type Filter, type FindOptions, isOps, type Store, type Tx, UniqueViolation } from "./types";

/**
 * Postgres implementation of the store. SQL is built only from the schema descriptor's table and
 * column names (never from input) and every value is a bound parameter with an explicit cast.
 * Rows come back via to_jsonb so both drivers (postgres.js in production, PGlite in tests) return
 * identical shapes.
 */

export interface SqlExecutor {
  query(text: string, params: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface SqlDriver {
  begin<R>(fn: (exec: SqlExecutor) => Promise<R>): Promise<R>;
}

const SCHEMA_NAME = "meros";

const CAST: Record<ColumnType, string> = {
  uuid: "uuid",
  text: "text",
  int: "integer",
  bigint: "bigint",
  bool: "boolean",
  timestamptz: "timestamptz",
  date: "date",
  jsonb: "jsonb",
  float: "double precision",
};

function columnType(table: TableName, column: string): ColumnType {
  const type = (SCHEMA[table].columns as Record<string, ColumnType>)[column];
  if (!type) throw new Error(`Unknown column ${table}.${column}`);
  return type;
}

function encode(type: ColumnType, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  switch (type) {
    case "jsonb":
      return JSON.stringify(value);
    case "bool":
      return value ? "true" : "false";
    case "int":
    case "bigint":
    case "float":
      return String(value);
    default:
      return String(value);
  }
}

function decode<T extends TableName>(table: T, raw: unknown): Tables[T] {
  const row = (typeof raw === "string" ? JSON.parse(raw) : raw) as Record<string, unknown>;
  for (const [col, type] of Object.entries(SCHEMA[table].columns as Record<string, ColumnType>)) {
    const v = row[col];
    if (type === "timestamptz" && typeof v === "string") row[col] = new Date(v).toISOString();
    if ((type === "int" || type === "bigint" || type === "float") && typeof v === "string") row[col] = Number(v);
    if (v === undefined) row[col] = null;
  }
  return row as unknown as Tables[T];
}

function mapError(error: unknown): never {
  const e = error as { code?: string; constraint_name?: string; constraint?: string };
  if (e && e.code === "23505") throw new UniqueViolation(e.constraint_name ?? e.constraint ?? "unique");
  throw error;
}

function whereClause<T extends TableName>(table: T, filter: Filter<Tables[T]>, params: unknown[]): string {
  const parts: string[] = [];
  const bind = (col: string, value: unknown) => {
    params.push(encode(columnType(table, col), value));
    return `$${params.length}::${CAST[columnType(table, col)]}`;
  };
  for (const [col, cond] of Object.entries(filter)) {
    columnType(table, col);
    const ident = `t."${col}"`;
    if (isOps(cond)) {
      if (cond.$in !== undefined) {
        if (cond.$in.length === 0) parts.push("false");
        else parts.push(`${ident} in (${cond.$in.map((v) => bind(col, v)).join(", ")})`);
      }
      if ("$ne" in cond) {
        parts.push(cond.$ne === null ? `${ident} is not null` : `${ident} is distinct from ${bind(col, cond.$ne)}`);
      }
      if (cond.$lt !== undefined) parts.push(`${ident} < ${bind(col, cond.$lt)}`);
      if (cond.$lte !== undefined) parts.push(`${ident} <= ${bind(col, cond.$lte)}`);
      if (cond.$gt !== undefined) parts.push(`${ident} > ${bind(col, cond.$gt)}`);
      if (cond.$gte !== undefined) parts.push(`${ident} >= ${bind(col, cond.$gte)}`);
      if (cond.$null !== undefined) parts.push(`${ident} is ${cond.$null ? "" : "not "}null`);
    } else if (cond === null) {
      parts.push(`${ident} is null`);
    } else {
      parts.push(`${ident} = ${bind(col, cond)}`);
    }
  }
  return parts.length ? `where ${parts.join(" and ")}` : "";
}

export function postgresTx(exec: SqlExecutor): Tx {
  const q = async (text: string, params: unknown[]) => {
    try {
      return await exec.query(text, params);
    } catch (error) {
      mapError(error);
    }
  };
  return {
    async get(table, id) {
      const res = await q(
        `select to_jsonb(t.*) as r from ${SCHEMA_NAME}."${table}" t where t.id = $1::${CAST[columnType(table, "id")]}`,
        [id],
      );
      return res.rows[0] ? decode(table, res.rows[0].r) : null;
    },
    async find(table, filter, options?: FindOptions<Tables[typeof table]>) {
      const params: unknown[] = [];
      const where = whereClause(table, filter, params);
      const order = options?.orderBy?.length
        ? `order by ${options.orderBy
            .map(([c, d]) => {
              columnType(table, c);
              return `t."${c}" ${d === "desc" ? "desc" : "asc"}`;
            })
            .join(", ")}`
        : "";
      const limit = options?.limit !== undefined ? `limit ${Math.max(0, Math.floor(options.limit))}` : "";
      const res = await q(`select to_jsonb(t.*) as r from ${SCHEMA_NAME}."${table}" t ${where} ${order} ${limit}`, params);
      return res.rows.map((r) => decode(table, r.r));
    },
    async insert(table, row) {
      const cols = Object.keys(SCHEMA[table].columns);
      const params = cols.map((c) => encode(columnType(table, c), (row as unknown as Record<string, unknown>)[c]));
      const values = cols.map((c, i) => `$${i + 1}::${CAST[columnType(table, c)]}`);
      const res = await q(
        `insert into ${SCHEMA_NAME}."${table}" as t (${cols.map((c) => `"${c}"`).join(", ")}) values (${values.join(", ")}) returning to_jsonb(t.*) as r`,
        params,
      );
      return decode(table, res.rows[0].r);
    },
    async update(table, id, patch) {
      const cols = Object.keys(patch).filter((c) => c !== "id");
      if (cols.length === 0) {
        const current = await this.get(table, id);
        if (!current) throw new Error(`${table} ${id} not found`);
        return current;
      }
      const params = cols.map((c) => encode(columnType(table, c), (patch as Record<string, unknown>)[c]));
      params.push(id);
      const sets = cols.map((c, i) => `"${c}" = $${i + 1}::${CAST[columnType(table, c)]}`);
      const res = await q(
        `update ${SCHEMA_NAME}."${table}" as t set ${sets.join(", ")} where t.id = $${params.length}::${CAST[columnType(table, "id")]} returning to_jsonb(t.*) as r`,
        params,
      );
      if (!res.rows[0]) throw new Error(`${table} ${id} not found`);
      return decode(table, res.rows[0].r);
    },
    async lockOwner(ownerId) {
      await q(`select pg_advisory_xact_lock(hashtextextended($1::text, 7031))`, [ownerId]);
    },
  };
}

export class PostgresStore implements Store {
  constructor(private driver: SqlDriver) {}

  transaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R> {
    return this.driver.begin((exec) => fn(postgresTx(exec)));
  }
}
