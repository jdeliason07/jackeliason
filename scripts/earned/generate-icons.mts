import sharp from "sharp";

/** Renders Earned's original app icon (a star over a little house on a sun tile) to PNGs. */
function svg(size: number, padding: number) {
  const s = 512;
  const inner = s - padding * 2;
  const k = inner / 512;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${padding ? 0 : 112}" fill="#FFB703"/>
  <g transform="translate(${padding} ${padding}) scale(${k})">
    <circle cx="256" cy="256" r="196" fill="#FFC93C"/>
    <path d="M136 300 L256 204 L376 300 L376 404 L136 404 Z" fill="#FFFDF7" stroke="#2B2540" stroke-width="18" stroke-linejoin="round"/>
    <path d="M112 312 L256 196 L400 312" fill="none" stroke="#2D3A8C" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="228" y="330" width="56" height="74" rx="20" fill="#06D6A0" stroke="#2B2540" stroke-width="14"/>
    <path d="M256 66 L282 122 L342 128 L297 168 L310 228 L256 198 L202 228 L215 168 L170 128 L230 122 Z" fill="#FFFDF7" stroke="#2B2540" stroke-width="14" stroke-linejoin="round"/>
  </g>
</svg>`;
}

const out = "public/earned/icons";
await sharp(Buffer.from(svg(192, 0))).png().toFile(`${out}/icon-192.png`);
await sharp(Buffer.from(svg(512, 0))).png().toFile(`${out}/icon-512.png`);
await sharp(Buffer.from(svg(512, 64))).png().toFile(`${out}/icon-maskable-512.png`);
await sharp(Buffer.from(svg(180, 0))).flatten({ background: "#FFB703" }).png().toFile(`${out}/apple-touch-icon.png`);
console.log("Wrote icons to", out);
