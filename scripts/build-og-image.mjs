// Generates Open Graph share preview images.
// Renders the brand-level 1200x630 PNG plus per-mode variants so each route
// has its own share preview. Re-run when the wordmark, mode list, or palette
// changes.

import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP = resolve(__dirname, "..", "app");

const W = 1200;
const H = 630;
const BG = "#0c1820";
const SURFACE = "#132532";
const FG = "#f3e8d3";
const MUTED = "#b6a98e";
const ACCENT = "#d6a05c";

// Brand-level home page card. Big DEADLOCKLE wordmark + mode list.
function brandSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${BG}"/>
      <stop offset="100%" stop-color="${SURFACE}"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bgGrad)"/>
  <rect x="40" y="40" width="${W - 80}" height="${H - 80}" fill="none" stroke="${ACCENT}" stroke-width="1" opacity="0.45"/>
  <rect x="56" y="56" width="${W - 112}" height="${H - 112}" fill="none" stroke="${ACCENT}" stroke-width="0.5" opacity="0.25"/>

  <text x="${W / 2}" y="200" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="600" font-size="26" fill="${MUTED}" letter-spacing="8">DAILY  DEADLOCK  QUIZ</text>

  <text x="${W / 2}" y="360" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="120" fill="${FG}" letter-spacing="4">DEADLOCK<tspan fill="${ACCENT}">LE</tspan></text>

  <line x1="${W / 2 - 200}" y1="395" x2="${W / 2 + 200}" y2="395" stroke="${ACCENT}" stroke-width="1.2" opacity="0.7"/>

  <text x="${W / 2}" y="475" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="400" font-size="26" fill="${MUTED}" letter-spacing="5">CLASSIC · ABILITY · ITEM · QUOTE · MUGSHOT · SOUND</text>

  <text x="${W / 2}" y="555" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="500" font-size="22" fill="${ACCENT}" letter-spacing="4">deadlockle.com  ·  new puzzle every day</text>
</svg>`;
}

// Per-mode card. Small DEADLOCKLE wordmark up top + huge mode label centered
// + mode-specific tagline. Visual rhythm matches the brand card so a Twitter
// timeline of mixed-mode shares still reads as one product.
function modeSvg({ label, tagline, ornament }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${BG}"/>
      <stop offset="100%" stop-color="${SURFACE}"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bgGrad)"/>
  <rect x="40" y="40" width="${W - 80}" height="${H - 80}" fill="none" stroke="${ACCENT}" stroke-width="1" opacity="0.45"/>
  <rect x="56" y="56" width="${W - 112}" height="${H - 112}" fill="none" stroke="${ACCENT}" stroke-width="0.5" opacity="0.25"/>

  <!-- brand strip up top -->
  <text x="${W / 2}" y="135" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="38" fill="${FG}" letter-spacing="3">DEADLOCK<tspan fill="${ACCENT}">LE</tspan></text>
  <line x1="${W / 2 - 90}" y1="158" x2="${W / 2 + 90}" y2="158" stroke="${ACCENT}" stroke-width="0.8" opacity="0.5"/>

  <!-- mode eyebrow -->
  <text x="${W / 2}" y="225" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="500" font-size="22" fill="${MUTED}" letter-spacing="9">DAILY  MODE</text>

  <!-- ornament (mode-specific symbol/glyph) -->
  ${ornament ?? ""}

  <!-- huge mode title -->
  <text x="${W / 2}" y="385" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="130" fill="${FG}" letter-spacing="6">${label}</text>

  <line x1="${W / 2 - 180}" y1="420" x2="${W / 2 + 180}" y2="420" stroke="${ACCENT}" stroke-width="1.2" opacity="0.7"/>

  <!-- tagline -->
  <text x="${W / 2}" y="490" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="400" font-size="28" fill="${MUTED}" letter-spacing="3">${tagline}</text>

  <!-- domain footer -->
  <text x="${W / 2}" y="560" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="500" font-size="20" fill="${ACCENT}" letter-spacing="4">deadlockle.com</text>
</svg>`;
}

// SVG ornaments per mode — small visual cue distinguishing the cards in
// social-feed previews where the mode title alone could blur together.
const ORN = {
  // Classic: 5 attribute tiles (green/amber/red/wrong) — Wordle DNA
  classic: (() => {
    const cx = W / 2;
    const tiles = [
      { dx: -120, fill: "#7fb86c" },
      { dx: -60, fill: "#d6a05c" },
      { dx: 0, fill: "#c75a4a" },
      { dx: 60, fill: "#1c3243", stroke: "#284258" },
      { dx: 120, fill: "#7fb86c" },
    ];
    return tiles
      .map(
        (t) =>
          `<rect x="${cx + t.dx - 18}" y="262" width="36" height="36" fill="${t.fill}" ${t.stroke ? `stroke="${t.stroke}" stroke-width="1"` : ""}/>`,
      )
      .join("");
  })(),
  // Quote: a giant amber opening quotation mark
  quote: `<text x="${W / 2}" y="305" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="100" fill="${ACCENT}" opacity="0.55">&#8220;&#8221;</text>`,
  // Ability: 3 concentric rings (the unblur reveal motif)
  ability: `<g transform="translate(${W / 2} 280)" fill="none" stroke="${ACCENT}" stroke-width="1.5"><circle r="34" opacity="0.85"/><circle r="22" opacity="0.55"/><circle r="11" opacity="0.3"/></g>`,
  // Item: a 3x3 dotted grid (pixel-blur motif)
  item: (() => {
    const cx = W / 2;
    const cy = 280;
    const dots = [];
    for (let r = -1; r <= 1; r++) {
      for (let c = -1; c <= 1; c++) {
        dots.push(
          `<circle cx="${cx + c * 24}" cy="${cy + r * 24}" r="5" fill="${ACCENT}" opacity="${0.85 - Math.abs(r * c) * 0.3}"/>`,
        );
      }
    }
    return dots.join("");
  })(),
  // Mugshot: 3 horizontal reveal bands (the camera-pull-back motif)
  mugshot: `<g transform="translate(${W / 2} 280)"><rect x="-90" y="-22" width="180" height="14" fill="${ACCENT}" opacity="0.3"/><rect x="-90" y="-4" width="180" height="14" fill="${ACCENT}" opacity="0.55"/><rect x="-90" y="14" width="180" height="14" fill="${ACCENT}" opacity="0.85"/></g>`,
};

const MODES = [
  {
    slug: "classic",
    label: "CLASSIC",
    tagline: "Match the attributes  ·  guess the hero",
    ornament: ORN.classic,
  },
  {
    slug: "quote",
    label: "QUOTE",
    tagline: "Two heroes  ·  one line  ·  guess both",
    ornament: ORN.quote,
  },
  {
    slug: "ability",
    label: "ABILITY",
    tagline: "Whose Deadlock ability is this?",
    ornament: ORN.ability,
  },
  {
    slug: "item",
    label: "ITEM",
    tagline: "Guess the item from a blurred icon",
    ornament: ORN.item,
  },
  {
    slug: "mugshot",
    label: "MUGSHOT",
    tagline: "Identify the hero from a cropped portrait",
    ornament: ORN.mugshot,
  },
];

async function render(svg, outPath) {
  await mkdir(dirname(outPath), { recursive: true });
  await sharp(Buffer.from(svg)).png({ quality: 90 }).toFile(outPath);
  console.log(`wrote ${outPath}`);
}

await render(brandSvg(), resolve(APP, "opengraph-image.png"));
for (const m of MODES) {
  await render(modeSvg(m), resolve(APP, m.slug, "opengraph-image.png"));
}
