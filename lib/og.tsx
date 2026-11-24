import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { site } from "./config";

/**
 * The one preview-image template, used by every opengraph-image route.
 * Fonts load from assets/fonts (Satori reads TTF, OTF, or WOFF; not WOFF2).
 */

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";
export const ogAlt = site.name;

const fontFile = (name: string) => readFile(path.join(process.cwd(), "assets/fonts", name));

/** Smaller type for longer titles; anything longer still wraps and is clamped. */
function titleSize(title: string): number {
  if (title.length <= 20) return 96;
  if (title.length <= 45) return 80;
  if (title.length <= 80) return 64;
  return 54;
}

export async function ogImage({
  title,
  date,
  byline = true,
}: {
  title: string;
  date?: string;
  /** "Jack Eliason · jackeliason.com" along the bottom edge. */
  byline?: boolean;
}) {
  const [newsreader, inter] = await Promise.all([
    fontFile("Newsreader-Regular.woff"),
    fontFile("Inter-Regular.woff"),
  ]);
  const domain = new URL(site.url).host;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "88px 96px",
          backgroundColor: "#FAFAFA",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          {date && (
            <div style={{ fontFamily: "Inter", fontSize: 28, color: "#666666", marginBottom: 28 }}>
              {date}
            </div>
          )}
          <div
            style={{
              display: "block",
              fontFamily: "Newsreader",
              fontSize: titleSize(title),
              lineHeight: 1.12,
              letterSpacing: "-0.01em",
              color: "#111111",
              maxHeight: date ? 340 : 390,
              overflow: "hidden",
              lineClamp: date ? 5 : 6,
            }}
          >
            {title}
          </div>
        </div>
        {byline && (
          <div style={{ fontFamily: "Inter", fontSize: 28, color: "#666666" }}>
            {`${site.name} · ${domain}`}
          </div>
        )}
      </div>
    ),
    {
      ...ogSize,
      fonts: [
        { name: "Newsreader", data: newsreader, weight: 400, style: "normal" },
        { name: "Inter", data: inter, weight: 400, style: "normal" },
      ],
    },
  );
}
