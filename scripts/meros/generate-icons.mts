import { readFileSync, writeFileSync } from "node:fs";
import { createElement as h } from "react";
import { ImageResponse } from "next/og";
import sharp from "sharp";

/**
 * Renders the Meros app icons: the lowercase "m" from the wordmark (Exo 2 ExtraBold Italic, OFL,
 * assets/fonts) in bone on the brand red, over a tone-on-tone rising arrow, with the speed-stroke
 * underline from the splash screen.
 */
const font = readFileSync("assets/fonts/Exo2-ExtraBoldItalic.woff");
const out = "public/meros/icons";

/** The rising zigzag arrow motif (tone-on-tone), in a 512 box. */
const arrow = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M-40 470 L150 300 L230 360 L430 140 L380 120 L520 40 L500 200 L460 160 L240 410 L160 350 L-10 520 Z" fill="#8a1316" opacity="0.55"/><path d="M-40 520 L170 350 L250 410 L470 170 L520 210 L520 520 Z" fill="#420003" opacity="0.55"/></svg>`;

async function icon(size: number, safe: number) {
  const scale = size / 512;
  const res = new ImageResponse(
    h(
      "div",
      {
        style: {
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #861415 0%, #761011 45%, #4a0507 100%)",
          position: "relative",
        },
      },
      h("img", { src: `data:image/svg+xml;base64,${Buffer.from(arrow).toString("base64")}`, width: size, height: size, style: { position: "absolute", top: 0, left: 0 } }),
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", alignItems: "center", transform: `scale(${(512 - safe * 2) / 512})` } },
        h("div", { style: { fontFamily: "Exo2", fontSize: 330 * scale, color: "#e4e3dd", lineHeight: 1, marginTop: -40 * scale, letterSpacing: -6 * scale } }, "m"),
        h("div", {
          style: {
            width: 250 * scale,
            height: 14 * scale,
            marginTop: 6 * scale,
            background: "linear-gradient(90deg, rgba(228,227,221,0) 0%, #e4e3dd 30%, #e4e3dd 70%, rgba(228,227,221,0.15) 100%)",
            transform: "skewX(-20deg)",
          },
        }),
      ),
    ),
    { width: size, height: size, fonts: [{ name: "Exo2", data: font, weight: 800, style: "italic" }] },
  );
  return Buffer.from(await res.arrayBuffer());
}

writeFileSync(`${out}/icon-192.png`, await icon(192, 0));
writeFileSync(`${out}/icon-512.png`, await icon(512, 0));
writeFileSync(`${out}/icon-maskable-512.png`, await icon(512, 72));
writeFileSync(`${out}/apple-touch-icon.png`, await sharp(await icon(180, 0)).flatten({ background: "#761011" }).png().toBuffer());
console.log("Wrote icons to", out);
