/**
 * The rules every essay's frontmatter must meet. Shared by the build (lib/content.ts),
 * which fails on a broken essay, and the in-site editor (app/api/editor), which refuses
 * to save one, so the editor can never commit an essay that would break a deploy.
 * Pure functions only: no filesystem, safe to import anywhere on the server.
 */

export const ESSAY_FIELDS = ["title", "date", "summary", "updated", "draft"];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Lowercase letters, numbers, and single hyphens: the filename, and so the URL. */
export function isSlug(value: string): boolean {
  return SLUG.test(value);
}

export type EssayFields = {
  title: string;
  summary: string;
  /** YYYY-MM-DD */
  date: string;
  /** YYYY-MM-DD */
  updated?: string;
  draft: boolean;
};

/** Validates an essay's frontmatter and body; returns the clean fields, or the problems. */
export function validateEssay(
  data: Record<string, unknown>,
  body: string,
): { fields?: EssayFields; problems: string[] } {
  const problems = unknownFields(data, ESSAY_FIELDS);
  const title = requiredString(data, "title", problems);
  const summary = requiredString(data, "summary", problems);
  const date = requiredDate(data, "date", problems);
  const updated = optionalDate(data, "updated", problems);
  if (date && updated && updated < date) {
    problems.push(`"updated" (${updated}) is earlier than "date" (${date})`);
  }
  if (data.draft !== undefined && typeof data.draft !== "boolean") {
    problems.push(`"draft" must be true or false, without quotes (got ${JSON.stringify(data.draft)})`);
  }
  if (!body.trim()) problems.push("the essay has no body");
  if (problems.length || !title || !summary || !date) return { problems };
  return { problems, fields: { title, summary, date, updated, draft: data.draft === true } };
}

export function unknownFields(data: Record<string, unknown>, allowed: string[]): string[] {
  return Object.keys(data)
    .filter((key) => !allowed.includes(key))
    .map((key) => `unknown field "${key}" (allowed: ${allowed.join(", ")})`);
}

function requiredString(
  data: Record<string, unknown>,
  key: string,
  problems: string[],
): string | undefined {
  const value = data[key];
  if (value === undefined || value === null || value === "") {
    problems.push(`"${key}" is required`);
  } else if (typeof value !== "string") {
    problems.push(`"${key}" must be text; wrap it in quotes (got ${JSON.stringify(value)})`);
  } else if (!value.trim()) {
    problems.push(`"${key}" is empty`);
  } else {
    return value.trim();
  }
}

function requiredDate(
  data: Record<string, unknown>,
  key: string,
  problems: string[],
): string | undefined {
  if (data[key] === undefined || data[key] === null || data[key] === "") {
    problems.push(`"${key}" is required, in YYYY-MM-DD format`);
    return;
  }
  return optionalDate(data, key, problems);
}

export function optionalDate(
  data: Record<string, unknown>,
  key: string,
  problems: string[],
): string | undefined {
  const value = data[key];
  if (value === undefined || value === null) return;

  // YAML turns an unquoted 2026-11-23 into a Date at UTC midnight.
  if (value instanceof Date) {
    const iso = Number.isNaN(value.getTime()) ? "" : value.toISOString();
    if (iso.endsWith("T00:00:00.000Z")) return iso.slice(0, 10);
    problems.push(`"${key}" must be a calendar date in YYYY-MM-DD format, without a time`);
    return;
  }

  const match = typeof value === "string" ? ISO_DATE.exec(value) : null;
  if (!match) {
    problems.push(`"${key}" must be a date in YYYY-MM-DD format (got ${JSON.stringify(value)})`);
    return;
  }
  const [year, month, day] = match.slice(1).map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    problems.push(`"${key}" is not a real calendar date (got "${value}")`);
    return;
  }
  return value as string;
}
