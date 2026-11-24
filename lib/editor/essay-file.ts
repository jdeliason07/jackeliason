import matter from "gray-matter";
import { type EssayFields, validateEssay } from "@/lib/essay-rules";

/**
 * An essay file: YAML frontmatter, then the Markdown body. Strings are written
 * as JSON, which is valid YAML, so quotes, colons, and line breaks can never
 * break the frontmatter.
 */
export function toEssayFile(fields: EssayFields, body: string): string {
  const lines = [
    `title: ${JSON.stringify(fields.title)}`,
    `date: ${JSON.stringify(fields.date)}`,
    `summary: ${JSON.stringify(fields.summary)}`,
    ...(fields.updated ? [`updated: ${JSON.stringify(fields.updated)}`] : []),
    ...(fields.draft ? ["draft: true"] : []),
  ];
  return `---\n${lines.join("\n")}\n---\n\n${body.replace(/\r\n?/g, "\n").trim()}\n`;
}

/** Reads an essay file back, checked by the same rules the build applies. */
export function fromEssayFile(text: string): { fields?: EssayFields; body: string; problems: string[] } {
  try {
    const { data, content } = matter(text);
    const { fields, problems } = validateEssay(data as Record<string, unknown>, content);
    return { fields, body: content.replace(/^\n+/, ""), problems };
  } catch (error) {
    return { body: "", problems: [`the frontmatter is not valid YAML. ${(error as Error).message}`] };
  }
}
