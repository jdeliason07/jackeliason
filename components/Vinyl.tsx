import type { Song } from "@/lib/library";

// In the record's 200-unit drawing:
const LABEL = 42; // the dark brown label
const HOLE = 3; // the spindle hole
const TEXT_RADIUS = 64; // the lettering's baseline; capitals stand outward from it
const CIRCUMFERENCE = 2 * Math.PI * TEXT_RADIUS;
const ADVANCE = 0.84; // a bold capital's width, with tracking, as a share of the font size
const MAX_SIZE = 17;
const MIN_SIZE = 9;

/** Two concentric circles as one path: with the even-odd rule, the inner one is a hole. */
const ring = (outer: number, inner: number) =>
  `M${100 - outer},100 a${outer},${outer} 0 1,0 ${outer * 2},0 a${outer},${outer} 0 1,0 ${-outer * 2},0 Z ` +
  `M${100 - inner},100 a${inner},${inner} 0 1,0 ${inner * 2},0 a${inner},${inner} 0 1,0 ${-inner * 2},0 Z`;

/** Where the grooves part between tracks. */
const TRACK_GAPS = [57.5, 80.5, 90.5];

/**
 * Fine grooves from the run-out by the label to the lead-in at the edge, every 1.15 units,
 * their depth varying a little (deterministically) so the surface reads as cut, not printed.
 */
const GROOVES = (() => {
  const lines: { r: number; opacity: number }[] = [];
  let i = 0;
  for (let r = 47; r <= 97.6; r += 1.15, i++) {
    if (TRACK_GAPS.some((gap) => Math.abs(r - gap) < 1)) continue;
    lines.push({ r: +r.toFixed(2), opacity: +(0.05 + (0.035 * ((i * 37) % 7)) / 6).toFixed(3) });
  }
  return lines;
})();

/**
 * "TITLE · ARTIST ·" once round the circle: as large as fits (capped, so a short title
 * isn't enormous), and spaced evenly to close the circle exactly.
 */
function lettering(song: Song): { text: string; size: number } {
  const text = `${song.title} · ${song.artist} · `.toUpperCase();
  const size = Math.max(MIN_SIZE, Math.min(MAX_SIZE, CIRCUMFERENCE / (text.length * ADVANCE)));
  return { text, size };
}

/**
 * A song as a white record with a dark brown label, its title and artist lettered once
 * round it in bold, and written beneath it as a book's title is. The disc spins slowly under
 * a still sheen (see .record in globals.css).
 */
export default function Vinyl({ song, index }: { song: Song; index: number }) {
  const { text, size } = lettering(song);
  const path = `record-text-${index}`;
  const shade = `record-shade-${index}`;

  return (
    <figure className="record">
      <div className="record-disc">
        <svg viewBox="0 0 200 200" className="record-spin" aria-hidden="true" focusable="false">
          <defs>
            <path
              id={path}
              d={`M${100 - TEXT_RADIUS},100 a${TEXT_RADIUS},${TEXT_RADIUS} 0 1,1 ${TEXT_RADIUS * 2},0 a${TEXT_RADIUS},${TEXT_RADIUS} 0 1,1 ${-TEXT_RADIUS * 2},0`}
            />
            <radialGradient id={shade}>
              <stop offset="0.4" stopColor="#2a1f16" stopOpacity="0" />
              <stop offset="1" stopColor="#2a1f16" stopOpacity="0.06" />
            </radialGradient>
          </defs>

          {/* The white disc, faintly shaded toward the rim */}
          <path d={ring(99.6, HOLE)} fill="#fcffff" fillRule="evenodd" />
          <path d={ring(99.6, LABEL)} fill={`url(#${shade})`} fillRule="evenodd" />

          <g fill="none" stroke="#2a1f16">
            {/* Grooves */}
            {GROOVES.map(({ r, opacity }) => (
              <circle key={r} cx="100" cy="100" r={r} strokeWidth="0.35" strokeOpacity={opacity} />
            ))}
            {/* Track gaps: the grooves part, edged by a slightly deeper line each side */}
            {TRACK_GAPS.flatMap((gap) => [gap - 0.95, gap + 0.95]).map((r) => (
              <circle key={`gap-${r}`} cx="100" cy="100" r={r.toFixed(2)} strokeWidth="0.5" strokeOpacity="0.13" />
            ))}
            {/* Run-out groove by the label, and the lead-in rim at the edge */}
            <circle cx="100" cy="100" r="45" strokeWidth="0.45" strokeOpacity="0.12" />
            <circle cx="100" cy="100" r="98.4" strokeWidth="0.5" strokeOpacity="0.12" />
            <circle cx="100" cy="100" r="99.4" strokeWidth="0.6" strokeOpacity="0.2" />
          </g>

          {/* The lettering, outlined in the disc's white so no groove crosses a letter */}
          <text className="record-text" fontSize={size.toFixed(2)}>
            <textPath href={`#${path}`} textLength={(CIRCUMFERENCE - 0.5).toFixed(2)} lengthAdjust="spacing">
              {text}
            </textPath>
          </text>

          {/* The label */}
          <path d={ring(LABEL, HOLE)} fill="#513825" fillRule="evenodd" />
          <g fill="none" stroke="#fcffff">
            <circle cx="100" cy="100" r={LABEL - 1.6} strokeWidth="0.5" strokeOpacity="0.16" />
            <circle cx="100" cy="100" r="22" strokeWidth="0.4" strokeOpacity="0.1" />
            <circle cx="100" cy="100" r={HOLE + 2.2} strokeWidth="0.4" strokeOpacity="0.12" />
          </g>
        </svg>
      </div>
      <figcaption className="item-caption">
        <span className="item-title">{song.title}</span>
        <span className="item-sub">{song.artist}</span>
      </figcaption>
    </figure>
  );
}
