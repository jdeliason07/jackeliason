import { site } from "@/lib/config";
import { getEssays, renderEssay } from "@/lib/content";

/** Generated once at build time and served as a static file. */
export const dynamic = "force-static";

const escape = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const cdata = (text: string) => `<![CDATA[${text.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;

/** "2026-11-23" as an RFC 822 date at midnight UTC, independent of the server's timezone. */
const rfc822 = (date: string) => new Date(`${date}T00:00:00Z`).toUTCString();

export async function GET() {
  const essays = getEssays().filter((essay) => !essay.draft);
  const items = await Promise.all(
    essays.map(async (essay) => {
      const url = `${site.url}/essays/${essay.slug}`;
      const html = await renderEssay(essay, site.url);
      return [
        "    <item>",
        `      <title>${escape(essay.title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <pubDate>${rfc822(essay.date)}</pubDate>`,
        `      <dc:creator>${escape(site.name)}</dc:creator>`,
        `      <description>${escape(essay.summary)}</description>`,
        `      <content:encoded>${cdata(html)}</content:encoded>`,
        "    </item>",
      ].join("\n");
    }),
  );

  // The newest publication or revision date, so the feed only changes when content does.
  const latest = essays.map((essay) => essay.updated ?? essay.date).sort().at(-1);

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    "  <channel>",
    `    <title>${escape(site.name)}</title>`,
    `    <link>${site.url}</link>`,
    `    <description>${escape(site.description)}</description>`,
    "    <language>en-us</language>",
    `    <atom:link href="${site.url}/rss.xml" rel="self" type="application/rss+xml"/>`,
    ...(latest ? [`    <lastBuildDate>${rfc822(latest)}</lastBuildDate>`] : []),
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
