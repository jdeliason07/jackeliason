import fs from "node:fs";
import path from "node:path";
import { isPlaceholder, site } from "./config";

/**
 * Everything that still needs your input: template text in lib/config.ts,
 * empty optional settings, and content files containing a "TODO:" marker.
 * Production builds print this list as a warning; they do not fail.
 */
export function findPlaceholders(): string[] {
  const found: string[] = [];

  const visit = (value: unknown, key: string) => {
    if (typeof value === "string" && isPlaceholder(value)) {
      found.push(`lib/config.ts  ${key} is still placeholder text`);
    } else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) visit(v, key ? `${key}.${k}` : k);
    }
  };
  visit(site, "");

  if (!site.email) found.push("lib/config.ts  email is empty, so the footer omits it");
  if (!site.podcast) found.push("lib/config.ts  podcast is empty, so the Podcast link is hidden");
  if (!site.newsletter.formAction || !site.newsletter.emailFieldName) {
    found.push(
      "lib/config.ts  newsletter.formAction and newsletter.emailFieldName are not both set, so the subscribe form is hidden",
    );
  }

  const contentDir = path.join(process.cwd(), "content");
  const files = fs.existsSync(contentDir)
    ? fs.readdirSync(contentDir, { recursive: true, encoding: "utf8" })
    : [];
  for (const file of files.filter((f) => f.endsWith(".md")).sort()) {
    const text = fs.readFileSync(path.join(contentDir, file), "utf8");
    if (text.includes("TODO:")) {
      found.push(`content/${file.split(path.sep).join("/")}  contains placeholder content (marked "TODO:")`);
    }
  }

  return found;
}

export function warnAboutPlaceholders(): void {
  const found = findPlaceholders();
  if (!found.length) return;
  const yellow = (text: string) => (process.stdout.isTTY ? `\x1b[33m${text}\x1b[0m` : text);
  console.warn(
    [
      "",
      yellow(`⚠ ${found.length} placeholder${found.length === 1 ? "" : "s"} not yet replaced:`),
      ...found.map((item) => `  - ${item}`),
      "  Search the project for \"TODO:\" to find each one. (This is a warning; the build continues.)",
      "",
    ].join("\n"),
  );
}
