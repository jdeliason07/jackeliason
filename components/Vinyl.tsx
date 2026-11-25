import type { Song } from "@/lib/library";

const TEXT_RADIUS = 62; // in the record's 200-unit drawing
const CIRCUMFERENCE = 2 * Math.PI * TEXT_RADIUS;
const ADVANCE = 0.78; // a capital's width, with tracking, as a share of the font size

/** Two concentric circles as one path: with the even-odd rule, the inner one is a hole. */
const ring = (outer: number, inner: number) =>
  `M${100 - outer},100 a${outer},${outer} 0 1,0 ${outer * 2},0 a${outer},${outer} 0 1,0 ${-outer * 2},0 Z ` +
  `M${100 - inner},100 a${inner},${inner} 0 1,0 ${inner * 2},0 a${inner},${inner} 0 1,0 ${-inner * 2},0 Z`;

const GROOVES = Array.from({ length: 17 }, (_, i) => 35 + i * 3.6);
/** Two darker grooves, the gaps between tracks (chosen by index: float radii never compare equal reliably). */
const GAPS = new Set([4, 11]);

/**
 * A song as a white record with a dark brown label. "TITLE · ARTIST ·" runs around it,
 * repeated to fill the circle and fitted exactly, so the seam is invisible. The disc spins
 * slowly under a still sheen (see .record in globals.css).
 */
export default function Vinyl({ song, index }: { song: Song; index: number }) {
  const phrase = `${song.title} · ${song.artist} · `.toUpperCase();
  const fontSize = 10;
  const fits = Math.max(1, Math.round(CIRCUMFERENCE / (phrase.length * fontSize * ADVANCE)));
  // A phrase too long to go round once at full size is set smaller instead.
  const size = Math.min(fontSize, CIRCUMFERENCE / (phrase.length * ADVANCE));
  const path = `record-text-${index}`;

  return (
    <figure className="record">
      <div className="record-disc">
        <svg viewBox="0 0 200 200" className="record-spin" aria-hidden="true" focusable="false">
          <defs>
            <path id={path} d={`M${100 - TEXT_RADIUS},100 a${TEXT_RADIUS},${TEXT_RADIUS} 0 1,1 ${TEXT_RADIUS * 2},0 a${TEXT_RADIUS},${TEXT_RADIUS} 0 1,1 ${-TEXT_RADIUS * 2},0`} />
          </defs>
          <path d={ring(99.5, 2.6)} fill="#fcffff" fillRule="evenodd" />
          <g fill="none" stroke="#2a1f16" strokeWidth="0.45">
            {GROOVES.map((r, i) => (
              <circle key={i} cx="100" cy="100" r={r.toFixed(1)} strokeOpacity={GAPS.has(i) ? 0.1 : 0.045} />
            ))}
            <circle cx="100" cy="100" r="99.2" strokeOpacity="0.14" />
          </g>
          <text className="record-text" fontSize={size.toFixed(2)}>
            <textPath href={`#${path}`} textLength={(CIRCUMFERENCE - 0.5).toFixed(2)} lengthAdjust="spacing">
              {phrase.repeat(fits)}
            </textPath>
          </text>
          <path d={ring(30, 2.6)} fill="#513825" fillRule="evenodd" />
          <circle cx="100" cy="100" r="26.5" fill="none" stroke="#fcffff" strokeOpacity="0.14" strokeWidth="0.5" />
        </svg>
      </div>
      <figcaption className="sr-only">
        {song.title}, {song.artist}
      </figcaption>
    </figure>
  );
}
