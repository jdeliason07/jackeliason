import sharp from "sharp";

/** Renders the Meros app icon (the M mark: bone on blood red, gold underline) to PNGs. */
function svg(size: number, padding: number) {
  const s = 512;
  const k = (s - padding * 2) / 64;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${padding ? 0 : 96}" fill="#8a0f1a"/>
  <g transform="translate(${padding} ${padding}) scale(${k})">
    <path d="M13 47V15h9l10 15 10-15h9v32h-8.5V30.5L32 43 21.5 30.5V47Z" fill="#f2efea"/>
    <rect x="13" y="51" width="38" height="3" fill="#d1aa55"/>
  </g>
</svg>`;
}

const out = "public/meros/icons";
await sharp(Buffer.from(svg(192, 0))).png().toFile(`${out}/icon-192.png`);
await sharp(Buffer.from(svg(512, 0))).png().toFile(`${out}/icon-512.png`);
await sharp(Buffer.from(svg(512, 64))).png().toFile(`${out}/icon-maskable-512.png`);
await sharp(Buffer.from(svg(180, 0))).flatten({ background: "#8a0f1a" }).png().toFile(`${out}/apple-touch-icon.png`);
console.log("Wrote icons to", out);
