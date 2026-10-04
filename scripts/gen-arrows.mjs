// Writes public/arrows-{light,dark}.svg, the Adventure's arrow tiles:
// one arrow in the logo's style per slot of a 4 × 8 grid over 1280 × 2560, each
// varied in radius, turn, sweep and direction, then fitted into its cell with a
// jitter. The seed fixes the draw; change it to reshuffle.
//
//   node --permission --allow-fs-read=. --allow-fs-write=./public scripts/gen-arrows.mjs [seed]

import { writeFileSync } from "node:fs";

let seed = Number(process.argv[2] ?? 7);
const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const between = (lo, hi) => lo + rand() * (hi - lo);
const rad = (degrees) => (degrees * Math.PI) / 180;

const COLUMNS = 4;
const ROWS = 8;
const SLOT = 320;
/** Room kept around each arc for its stroke, dot and head. */
const MARGIN = 50;
const SAMPLES = 20;

let body = "";
for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLUMNS; col++) {
    const r = between(100, 150);
    const a0 = between(0, 360);
    const sweep = between(75, 105);
    const clockwise = rand() < 0.5 ? 1 : 0;
    const a1 = clockwise ? a0 + sweep : a0 - sweep;
    // The arc around a center at the origin, sampled for its bounds.
    const points = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const a = a0 + ((a1 - a0) * i) / SAMPLES;
      points.push([r * Math.cos(rad(a)), r * Math.sin(rad(a))]);
    }
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const slackX = SLOT - 2 * MARGIN - (Math.max(...xs) - minX);
    const slackY = SLOT - 2 * MARGIN - (Math.max(...ys) - minY);
    const dx = col * SLOT + MARGIN - minX + between(0, Math.max(0, slackX));
    const dy = row * SLOT + MARGIN - minY + between(0, Math.max(0, slackY));
    const place = ([x, y]) => [+(x + dx).toFixed(1), +(y + dy).toFixed(1)];
    const [x0, y0] = place(points[0]);
    const [x1, y1] = place(points[SAMPLES]);
    const radius = r.toFixed(1);
    body += `    <path d="M${x0},${y0} A${radius},${radius} 0 0,${clockwise} ${x1},${y1}" fill="none" stroke-width="30" stroke-linecap="round" marker-end="url(#head)"/>\n`;
    body += `    <circle cx="${x0}" cy="${y0}" r="34" stroke="none"/>\n`;
  }
}

/** Faded as one group, so overlaps stay even. */
const OPACITY = 0.05;

/** Each theme's --text, from src/styles/theme.css. */
const THEMES = {
  light: "#1a1a2e",
  dark: "#e4e5e9",
};

for (const [theme, color] of Object.entries(THEMES)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 2560" width="1280" height="2560">
  <!-- The Adventure arrow tile for the ${theme} theme, from
       scripts/gen-arrows.mjs: one arrow in the logo style per slot
       of a ${COLUMNS} × ${ROWS} grid, each varied in size, turn and bend, so the tile
       repeats too seldom to notice. Every arrow keeps inside its cell, so the
       tiles meet without seams. -->
  <defs>
    <marker id="head" viewBox="0 0 10 10" refX="3" refY="5" markerWidth="2.2" markerHeight="2.2" orient="auto">
      <path d="M0,0 L10,5 L0,10 z" fill="${color}"/>
    </marker>
  </defs>
  <g stroke="${color}" fill="${color}" opacity="${OPACITY}">
${body}  </g>
</svg>
`;
  writeFileSync(new URL(`../public/arrows-${theme}.svg`, import.meta.url), svg);
}
