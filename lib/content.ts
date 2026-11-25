import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { isSlug, optionalDate, unknownFields, validateEssay } from "./essay-rules";
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

const PAGE_FIELDS = ["updated"];

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

/** A standalone Markdown page: content/now.md. */
export function getPage(name: "now"): Page {
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

    if (!isSlug(slug)) {
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

    const { fields, problems: fieldProblems } = validateEssay(data, body);
    problems.push(...fieldProblems);
    if (problems.length || !fields) {
      errors.push(report(source, problems));
      continue;
    }
    essays.push({ slug, ...fields, body, source });
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

function report(source: string, problems: string[]): string {
  return `${source}\n${problems.map((problem) => `  - ${problem}`).join("\n")}`;
}

function contentError(reports: string[]): Error {
  return new Error(`Invalid content. Fix the following and rebuild:\n\n${reports.join("\n\n")}\n`);
}
