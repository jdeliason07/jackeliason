import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { renderMarkdown } from "./markdown";

/**
 * Content loading for every page. Essays are Markdown files in content/essays;
 * the filename is the slug. Frontmatter is validated when the site builds, and
 * any problem fails the build with a message naming the file and the field.
 *
 * Dates are kept as "YYYY-MM-DD" strings end to end, so ordering and display
 * never depend on the server's timezone.
 */

const CONTENT_DIR = path.join(process.cwd(), "content");
const ESSAYS_DIR = path.join(CONTENT_DIR, "essays");

/** Drafts are listed and rendered, with a "Draft" label, only in `next dev`. */
export const showDrafts = process.env.NODE_ENV === "development";

export type Essay = {
  slug: string;
  title: string;
  summary: string;
  /** Publication date, YYYY-MM-DD. */
  date: string;
  /** Last substantive revision, YYYY-MM-DD. */
  updated?: string;
  draft: boolean;
  /** Markdown body, without frontmatter. */
  body: string;
  /** Repository path, for error messages. */
  source: string;
};

export type Page = {
  updated?: string;
  body: string;
  source: string;
};

const ESSAY_FIELDS = ["title", "date", "summary", "updated", "draft"];
const PAGE_FIELDS = ["updated"];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

let essayCache: Essay[] | undefined;

/** Published essays, newest first. In `next dev`, drafts are included. */
export function getEssays(): Essay[] {
  // Read from disk on every request in development; once per build otherwise.
  const essays = showDrafts ? loadEssays() : (essayCache ??= loadEssays());
  return showDrafts ? essays : essays.filter((essay) => !essay.draft);
}

export function getEssay(slug: string): Essay | undefined {
  return getEssays().find((essay) => essay.slug === slug);
}

/** Essay body as HTML. Pass baseUrl for absolute links (RSS). */
export function renderEssay(essay: Essay, baseUrl?: string): Promise<string> {
  return renderMarkdown(essay.body, {
    source: essay.source,
    assetBase: `/essays/${essay.slug}`,
    baseUrl,
  });
}

/** A standalone Markdown page: content/now.md or content/canon.md. */
export function getPage(name: "now" | "canon"): Page {
  const source = `content/${name}.md`;
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(path.join(CONTENT_DIR, `${name}.md`), source);
  } catch (error) {
    throw contentError([(error as Error).message]);
  }
  const { data, content } = parsed;
  const problems = unknownFields(data, PAGE_FIELDS);
  const updated = optionalDate(data, "updated", problems);
  if (name === "now" && !updated) {
    problems.push(`"updated" is required, e.g. updated: "2026-11-24"`);
  }
  if (problems.length) throw contentError([report(source, problems)]);
  return { updated, body: content, source };
}

export function renderPage(page: Page): Promise<string> {
  return renderMarkdown(page.body, { source: page.source });
}

function loadEssays(): Essay[] {
  if (!fs.existsSync(ESSAYS_DIR)) return [];

  const files = fs
    .readdirSync(ESSAYS_DIR)
    .filter((file) => file.toLowerCase().endsWith(".md"))
    .sort();
  const essays: Essay[] = [];
  const errors: string[] = [];
  const sources = new Map<string, string>();

  for (const file of files) {
    const source = `content/essays/${file}`;
    const slug = file.slice(0, -".md".length);
    const problems: string[] = [];

    if (!SLUG.test(slug)) {
      problems.push(
        `the filename becomes the URL, so use lowercase letters, numbers, and single hyphens, e.g. "on-simplicity.md"`,
      );
    }
    const key = slug.toLowerCase();
    const duplicate = sources.get(key);
    if (duplicate) problems.push(`duplicate slug "${key}": also used by ${duplicate}`);
    else sources.set(key, source);

    let data: Record<string, unknown>;
    let body: string;
    try {
      ({ data, content: body } = parse(path.join(ESSAYS_DIR, file), source));
    } catch (error) {
      errors.push((error as Error).message);
      continue;
    }

    problems.push(...unknownFields(data, ESSAY_FIELDS));
    const title = requiredString(data, "title", problems);
    const summary = requiredString(data, "summary", problems);
    const date = requiredDate(data, "date", problems);
    const updated = optionalDate(data, "updated", problems);
    if (date && updated && updated < date) {
      problems.push(`"updated" (${updated}) is earlier than "date" (${date})`);
    }
    if (data.draft !== undefined && typeof data.draft !== "boolean") {
      problems.push(
        `"draft" must be true or false, without quotes (got ${JSON.stringify(data.draft)})`,
      );
    }
    if (!body.trim()) problems.push("the essay has no body");

    if (problems.length || !title || !summary || !date) {
      errors.push(report(source, problems));
      continue;
    }
    essays.push({
      slug,
      title,
      summary,
      date,
      updated,
      draft: data.draft === true,
      body,
      source,
    });
  }

  if (errors.length) throw contentError(errors);
  return essays.sort(newestFirst);
}

/** Newest first; essays sharing a date fall back to slug order. */
function newestFirst(a: Essay, b: Essay): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return a.slug < b.slug ? -1 : 1;
}

function parse(file: string, source: string) {
  if (!fs.existsSync(file)) throw new Error(`${source}: file not found`);
  try {
    const { data, content } = matter(fs.readFileSync(file, "utf8"));
    return { data: data as Record<string, unknown>, content };
  } catch (error) {
    throw new Error(`${source}: the frontmatter is not valid YAML. ${(error as Error).message}`);
  }
}

function unknownFields(data: Record<string, unknown>, allowed: string[]): string[] {
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

function optionalDate(
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

function report(source: string, problems: string[]): string {
  return `${source}\n${problems.map((problem) => `  - ${problem}`).join("\n")}`;
}

function contentError(reports: string[]): Error {
  return new Error(`Invalid content. Fix the following and rebuild:\n\n${reports.join("\n\n")}\n`);
}
