// Utilities for the dev-hub mode test pages. Generates plausible "wrong
// guess" sequences so a test panel can drive a mode's localStorage into
// any guess-count / win / fail shape without playing through.

import { HEROES, type Hero } from "@/lib/heroes";
import { ITEMS, type Item } from "@/lib/items";

// Deterministic per-day shuffle so the dev's "set N wrong heroes"
// button produces the same lineup across reloads (matches the daily
// puzzle's stability). Not security-critical — just enough variation
// that two modes don't both pick the alphabetically-first heroes.
function seededShuffle<T>(arr: T[], seed: string): T[] {
  const out = arr.slice();
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 1597334677);
    const j = (h >>> 0) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function wrongHeroKeys(answerKey: string, n: number, salt = ""): string[] {
  const pool: Hero[] = HEROES.filter((h) => h.key !== answerKey);
  return seededShuffle(pool, `deadlockle:dev:heroes:${salt}`)
    .slice(0, Math.max(0, n))
    .map((h) => h.key);
}

export function wrongItemKeys(answerKey: string, n: number, salt = ""): string[] {
  const pool: Item[] = ITEMS.filter((i) => i.key !== answerKey);
  return seededShuffle(pool, `deadlockle:dev:items:${salt}`)
    .slice(0, Math.max(0, n))
    .map((i) => i.key);
}
