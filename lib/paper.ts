import type { CSSProperties } from "react";

/**
 * The torn outline of the page: a clip-path polygon plus the pale, fibrous rims
 * that real torn paper shows along a tear. Generated from a fixed seed, so the
 * tears are identical on every build. Change SEED to tear the page differently.
 *
 * Coordinates mix percentages and pixels so the tears keep their size on pages
 * of any height: a tear near the top is measured from the top, the ragged
 * bottom edge from the bottom.
 */

const SEED = 1874;

function random(seed: number) {
  let state = seed >>> 0;
  return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32;
}
const rnd = random(SEED);

type Point = [number, number];

/** A jagged line from a to b: points jittered perpendicular to the line. */
function jag(a: Point, b: Point, steps: number, amplitude: number): Point[] {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const length = Math.hypot(dx, dy) || 1;
  const [nx, ny] = [-dy / length, dx / length];
  const points: Point[] = [];
  for (let i = 1; i < steps; i++) {
    const t = i / steps + (rnd() - 0.5) * (0.6 / steps);
    const offset = (rnd() - 0.5) * 2 * amplitude;
    points.push([a[0] + dx * t + nx * offset, a[1] + dy * t + ny * offset]);
  }
  return [a, ...points, b];
}

/** A V-shaped tear: in from the edge to a tip, and back out to the edge. */
function notch(start: Point, tip: Point, end: Point): Point[] {
  return [...jag(start, tip, 7, 2.2), ...jag(tip, end, 7, 2.2).slice(1)];
}

const px = (n: number) => `${Math.round(n * 10) / 10}px`;
const fromRight = (n: number) => `calc(100% - ${px(n)})`;
const fromBottom = fromRight;

/** Top-right corner, torn away. Local box: 58 × 46, anchored top right. */
const CORNER = { width: 58, height: 46 };
const corner = [
  ...jag([4, 0], [26, 22], 5, 2.5),
  ...jag([26, 22], [CORNER.width, CORNER.height - 4], 5, 2.5).slice(1),
];

/** A tear into the right edge. Local box: 32 × 104, anchored right, TEAR_TOP from the top. */
const TEAR_TOP = 236;
const SIDE = { width: 32, height: 104 };
const side = notch([SIDE.width, 0], [SIDE.width - 21, 58], [SIDE.width, SIDE.height]);

/** A rip running up from the bottom edge. Local box: 30 × 60, centred on RIP_AT. */
const RIP_AT = 23; // percent from the left
const RIP = { width: 30, height: 60 };
const rip = notch([RIP.width - 3, RIP.height - 2], [RIP.width / 2 - 1, 6], [3, RIP.height - 3]);

/** The ragged bottom edge: a random walk of depths (px up from the bottom), right to left. */
const EDGE_DEPTH = 11;
const bottom: Point[] = [];
{
  let depth = 3;
  for (let x = 100; x >= 0; x -= 1.1 + rnd() * 0.9) {
    depth = Math.min(EDGE_DEPTH, Math.max(0, depth + (rnd() - 0.5) * 4.5));
    bottom.push([x, depth]);
  }
  bottom.push([0, depth]);
}
// Leave the bottom edge clear of the rip, even on a phone-width page (3.5% of 375px ≈ 13px).
const ripHalf = 3.5;
const bottomRight = bottom.filter(([x]) => x > RIP_AT + ripHalf);
const bottomLeft = bottom.filter(([x]) => x < RIP_AT - ripHalf);

const polygon: string[] = [
  "0 0",
  ...corner.map(([x, y]) => `${fromRight(CORNER.width - x)} ${px(y)}`),
  ...side.map(([x, y]) => `${fromRight(SIDE.width - x)} ${px(TEAR_TOP + y)}`),
  ...bottomRight.map(([x, d]) => `${x.toFixed(2)}% ${fromBottom(d)}`),
  ...rip.map(([x, y]) => `calc(${RIP_AT}% + ${px(x - RIP.width / 2)}) ${fromBottom(RIP.height - y)}`),
  ...bottomLeft.map(([x, d]) => `${x.toFixed(2)}% ${fromBottom(d)}`),
];

export const sheetClipPath = `polygon(${polygon.join(", ")})`;

export type Rim = {
  style: CSSProperties;
  viewBox: string;
  /** Stretch horizontally with the page (the bottom edge) instead of keeping its shape. */
  stretch?: boolean;
  lines: string[];
};

const points = (list: Point[]) => list.map(([x, y]) => `${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`).join(" ");

export const rims: Rim[] = [
  {
    style: { top: 0, right: 0, width: CORNER.width, height: CORNER.height },
    viewBox: `0 0 ${CORNER.width} ${CORNER.height}`,
    lines: [points(corner)],
  },
  {
    style: { top: TEAR_TOP, right: 0, width: SIDE.width, height: SIDE.height },
    viewBox: `0 0 ${SIDE.width} ${SIDE.height}`,
    lines: [points(side)],
  },
  {
    style: { bottom: 0, left: `calc(${RIP_AT}% - ${RIP.width / 2}px)`, width: RIP.width, height: RIP.height },
    viewBox: `0 0 ${RIP.width} ${RIP.height}`,
    lines: [points(rip)],
  },
  {
    style: { bottom: 0, left: 0, width: "100%", height: EDGE_DEPTH + 2 },
    viewBox: `0 0 100 ${EDGE_DEPTH + 2}`,
    stretch: true,
    lines: [bottomRight, bottomLeft].map((part) => points(part.map(([x, d]) => [x, EDGE_DEPTH + 2 - d]))),
  },
];
