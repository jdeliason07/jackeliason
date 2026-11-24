import fs from "node:fs";
import path from "node:path";
import { imageSize } from "image-size";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import type { Element, Root } from "hast";

const PUBLIC_DIR = path.join(process.cwd(), "public");

/**
 * remark-rehype already prefixes footnote ids with "user-content-". The
 * sanitizer's default schema would prefix the ids a second time but leave the
 * matching href fragments alone, breaking footnote links and back-links.
 * Raw HTML is never rendered, so footnotes are the only source of ids.
 */
const schema = { ...defaultSchema, clobberPrefix: "" };

export type RenderOptions = {
  /** Where the Markdown came from, for error messages. */
  source: string;
  /** Public folder that relative image paths resolve to, e.g. "/essays/on-simplicity". */
  assetBase?: string;
  /** Rewrite root-relative URLs as absolute ones (for RSS readers). */
  baseUrl?: string;
};

/**
 * Markdown to sanitized HTML: GFM (footnotes, tables, strikethrough), no raw
 * HTML. Local images are checked at build time and given their intrinsic size
 * so they never shift the layout.
 */
export async function renderMarkdown(
  markdown: string,
  options: RenderOptions,
): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { footnoteBackContent: "↩︎" }) // ↩ as text, not emoji
    .use(rehypeSanitize, schema)
    .use(rehypeLocalImages, options)
    .use(rehypeAbsoluteUrls, options.baseUrl)
    .use(rehypeStringify)
    .process(markdown);
  return String(file);
}

function visitElements(node: Root | Element, fn: (el: Element) => void) {
  for (const child of node.children) {
    if (child.type === "element") {
      fn(child);
      visitElements(child, fn);
    }
  }
}

const hasScheme = /^[a-z][a-z\d+.-]*:/i;

function rehypeLocalImages({ source, assetBase }: RenderOptions) {
  return (tree: Root) => {
    visitElements(tree, (el) => {
      if (el.tagName !== "img") return;
      let src = el.properties.src;
      if (typeof src !== "string" || hasScheme.test(src) || src.startsWith("//")) {
        return;
      }
      if (!src.startsWith("/")) {
        if (!assetBase) {
          throw new Error(`${source}: use an absolute image path, e.g. "/images/${src}".`);
        }
        src = `${assetBase}/${src.replace(/^\.\//, "")}`;
        el.properties.src = src;
      }
      const pathname = decodeURIComponent(src.split(/[?#]/)[0]);
      const filePath = path.join(PUBLIC_DIR, pathname);
      if (!filePath.startsWith(PUBLIC_DIR + path.sep) || !fs.existsSync(filePath)) {
        throw new Error(`${source}: image "${src}" not found. Expected it at public${pathname}`);
      }
      const { width, height } = imageSize(fs.readFileSync(filePath));
      el.properties.width = width;
      el.properties.height = height;
      el.properties.loading = "lazy";
      el.properties.decoding = "async";
    });
  };
}

function rehypeAbsoluteUrls(baseUrl?: string) {
  return (tree: Root) => {
    if (!baseUrl) return;
    visitElements(tree, (el) => {
      for (const key of ["href", "src"] as const) {
        const value = el.properties[key];
        if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) {
          el.properties[key] = baseUrl + value;
        }
      }
    });
  };
}
