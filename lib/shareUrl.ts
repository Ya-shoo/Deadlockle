// Compact URL encoders for the /r/[code] share namespace. Two formats
// live side by side, distinguished purely by shape:
//
// DAILY (15 chars, dash-separated):
//
//   <YYMMDD>-<5 mode results>-<hints><hard>
//
// Each segment is base36 (0-9, then a-z). Counts up to 34 fit in a
// single char; "z" is the sentinel for "missed" / "lost" so the encoded
// segment width stays predictable. Daily-complete shares only fire
// when every built mode is finished, so "pending" is impossible.
//
// The two counter chars are Classic hints used and the Mugshot
// hard-mode flag (0/1). OWdle's grammar puts skips in the second slot;
// Deadlockle has no skip mechanic anywhere, so the slot carries the
// hard-mode brag instead — same width, same decoder shape.
//
// Example: 2026-06-05, results [3, 2, 1, 3, 4], 2 hints, hard mode
//   → "260605-32134-21"
//
// ROUND (8-9 chars, no dashes):
//
//   <YYMMDD><mode letter><result>[modifier]
//
// One mode's single result. The result char reuses the daily alphabet
// ("z" = missed); the optional trailing modifier char is base36 hints
// (Classic) or the hard-mode flag (Mugshot) and is omitted when zero.
// Example: 2026-06-05, Mugshot solved in 3 on hard → "260605m31".
//
// The mode letter is matched case-insensitively (mirrors OWdle, where
// uppercase once meant an answer-revealing variant that was since
// consolidated away — every card is spoiler-free).
//
// The dash positions make the two formats impossible to confuse, so
// decoders try daily first and fall through to round — encoded links in
// the wild keep decoding forever.
//
// NOTE: this file is bundled into the Pages Functions (functions/r/,
// functions/og/r/), which run on workerd without Node globals. It must
// stay free of app imports AND of anything touching `process` — which
// is why ModeSlug comes in as a type-only import and the daily slot
// order is a local const instead of importing BUILT_MODE_SLUGS from
// lib/modes.ts (whose IS_DEV_BUILD reads process.env at module scope).

import type { ModeSlug } from "./modes";

// Daily slot order — MUST stay lockstep with BUILT_MODE_SLUGS in
// lib/modes.ts (canonical play order, quote excluded as archived).
// If a mode is added/removed there, old encoded links would decode with
// the wrong slot-to-mode mapping — accepted limitation, the links are
// inherently dated (the date prefix already says the link refers to a
// past puzzle that may have used a different mode set).
const DAILY_SLOT_SLUGS = [
  "classic",
  "ability",
  "mugshot",
  "sound",
  "item",
] as const satisfies readonly ModeSlug[];

const MISSED_CHAR = "z";

export type EncodedResults = {
  // The single path segment after /r/ — pass straight into the share URL.
  code: string;
};

export type DecodedResults = {
  // ISO date string YYYY-MM-DD reconstructed from the encoded YYMMDD.
  date: string;
  // One outcome per mode, in DAILY_SLOT_SLUGS order.
  results: { slug: ModeSlug; outcome: "won" | "lost"; guesses: number }[];
  hints: number;
  hardMode: boolean;
};

// Encode a single mode result to a base36 character. Won counts > 34
// clamp to "y" (34) so the encoder never produces an ambiguous char
// vs. the missed sentinel. In practice no mode caps higher than 10.
function encodeOne(outcome: "won" | "lost", guesses: number): string {
  if (outcome === "lost") return MISSED_CHAR;
  const n = Math.max(0, Math.min(34, guesses));
  return n.toString(36);
}

function decodeOne(ch: string): { outcome: "won" | "lost"; guesses: number } {
  if (ch === MISSED_CHAR) return { outcome: "lost", guesses: 0 };
  const n = parseInt(ch, 36);
  if (Number.isNaN(n)) return { outcome: "lost", guesses: 0 };
  return { outcome: "won", guesses: n };
}

// Two-digit YYMMDD encoding. Dates outside 2000-2099 clamp to year 99
// — acceptable since the share links are inherently puzzle-day-scoped
// and the puzzle isn't shipping outside that century.
function encodeDate(day: string): string {
  const [y, m, d] = day.split("-");
  const yy = (parseInt(y, 10) % 100).toString().padStart(2, "0");
  const mm = m.padStart(2, "0");
  const dd = d.padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

function decodeDate(code: string): string | null {
  if (code.length !== 6) return null;
  const yy = parseInt(code.slice(0, 2), 10);
  const mm = parseInt(code.slice(2, 4), 10);
  const dd = parseInt(code.slice(4, 6), 10);
  if (Number.isNaN(yy) || Number.isNaN(mm) || Number.isNaN(dd)) return null;
  const year = 2000 + yy;
  return `${year}-${mm.toString().padStart(2, "0")}-${dd.toString().padStart(2, "0")}`;
}

// Cap hints at 35 (single base36 char "z") since real games can't
// exceed their per-mode caps. Defensive only.
function clampToChar(n: number): string {
  return Math.max(0, Math.min(35, n)).toString(36);
}

export function encodeResults(opts: {
  day: string;
  results: { slug: ModeSlug; outcome: "won" | "lost"; guesses: number }[];
  hints: number;
  hardMode: boolean;
}): EncodedResults {
  const date = encodeDate(opts.day);
  // Reindex caller results by slug so the output order is canonical.
  const bySlug = new Map(opts.results.map((r) => [r.slug, r]));
  const modeChars = DAILY_SLOT_SLUGS.map((slug) => {
    const r = bySlug.get(slug);
    if (!r) return MISSED_CHAR;
    return encodeOne(r.outcome, r.guesses);
  }).join("");
  const counters = `${clampToChar(opts.hints)}${opts.hardMode ? "1" : "0"}`;
  return { code: `${date}-${modeChars}-${counters}` };
}

export function decodeResults(code: string): DecodedResults | null {
  // Strip any trailing slash from the path segment defensively.
  const trimmed = code.replace(/\/+$/, "");
  const parts = trimmed.split("-");
  if (parts.length !== 3) return null;
  const [datePart, modePart, counterPart] = parts;
  const date = decodeDate(datePart);
  if (date === null) return null;
  if (modePart.length !== DAILY_SLOT_SLUGS.length) return null;
  if (counterPart.length !== 2) return null;
  const results = DAILY_SLOT_SLUGS.map((slug, i) => ({
    slug: slug as ModeSlug,
    ...decodeOne(modePart[i]),
  }));
  const hints = parseInt(counterPart[0], 36);
  const hard = parseInt(counterPart[1], 36);
  if (Number.isNaN(hints) || Number.isNaN(hard)) return null;
  return { date, results, hints, hardMode: hard > 0 };
}

// ---------------------------------------------------------------------------
// Round codes — one mode's single result.

// Stable one-letter mode tags. These are URL surface area: once a code
// is in the wild its letter can never be reassigned. "q" is reserved
// for the archived Quote mode (dev-only, never gets a Share button) so
// no future mode can take it and collide with any dev-crafted code.
const ROUND_MODE_CHAR: Record<string, string> = {
  classic: "c",
  ability: "a",
  mugshot: "m",
  sound: "s",
  item: "i",
};

const CHAR_TO_MODE: Record<string, ModeSlug> = Object.fromEntries(
  Object.entries(ROUND_MODE_CHAR).map(([slug, ch]) => [ch, slug as ModeSlug]),
);

export type DecodedRound = {
  // ISO date string YYYY-MM-DD reconstructed from the encoded YYMMDD.
  date: string;
  slug: ModeSlug;
  outcome: "won" | "lost";
  guesses: number;
  // Modifier turns spent — keyed by mode: Classic spends hints, Mugshot
  // carries the hard-mode flag, others have neither.
  hints: number;
  hardMode: boolean;
};

export function encodeRoundResult(opts: {
  day: string;
  slug: ModeSlug;
  outcome: "won" | "lost";
  guesses: number;
  hints?: number;
  hardMode?: boolean;
}): EncodedResults {
  const date = encodeDate(opts.day);
  const modeChar = ROUND_MODE_CHAR[opts.slug] ?? "x";
  const result = encodeOne(opts.outcome, opts.guesses);
  // The modifier slot's meaning is mode-determined, so the char doesn't
  // need its own tag — just whichever counter this mode can spend.
  const modifierCount =
    opts.slug === "classic"
      ? (opts.hints ?? 0)
      : opts.slug === "mugshot"
        ? (opts.hardMode ? 1 : 0)
        : 0;
  const modifier = modifierCount > 0 ? clampToChar(modifierCount) : "";
  return { code: `${date}${modeChar}${result}${modifier}` };
}

export function decodeRoundResult(code: string): DecodedRound | null {
  const trimmed = code.replace(/\/+$/, "");
  // 6 date digits + mode letter (case-insensitive, see header note) +
  // result char + optional modifier char. Anchored and dash-free, so
  // daily codes can never match.
  const m = /^(\d{6})([a-zA-Z])([0-9a-z])([0-9a-z])?$/.exec(trimmed);
  if (!m) return null;
  const date = decodeDate(m[1]);
  if (date === null) return null;
  const slug = CHAR_TO_MODE[m[2].toLowerCase()];
  if (!slug) return null;
  const { outcome, guesses } = decodeOne(m[3]);
  const modifierCount = m[4] ? parseInt(m[4], 36) : 0;
  if (Number.isNaN(modifierCount)) return null;
  return {
    date,
    slug,
    outcome,
    guesses,
    hints: slug === "classic" ? modifierCount : 0,
    hardMode: slug === "mugshot" && modifierCount > 0,
  };
}
