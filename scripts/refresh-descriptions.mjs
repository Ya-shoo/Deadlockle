// Text-only refresh of ability descriptions in data/heroes.json.
//
// Re-fetches hero + item metadata from assets.deadlock-api.com and rewrites
// ONLY `abilities[].description` in place, reusing build-data.mjs's
// cleanDescription + OVERLAY so the two stay in lockstep. Deliberately does
// NOT touch images, art crops, stats, or any other field — so a patch that
// only changed ability text produces a clean, description-only diff without
// re-running the heavy build-data.mjs image pipeline.
//
// Matches abilities by name within each existing hero; anything unmatched is
// left untouched and reported. Run when a patch changes ability text, then
// review the printed before/after diff and commit.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { cleanDescription, OVERLAY } from "./build-data.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HEROES_FILE = resolve(__dirname, "..", "data", "heroes.json");
const API = "https://assets.deadlock-api.com";

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return res.json();
}

// Mirror build-data.mjs toKey so we can align API heroes to committed `key`.
function toKey(name) {
  return name
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const heroesJson = JSON.parse(await readFile(HEROES_FILE, "utf8"));

console.log("Fetching heroes + items...");
const [apiHeroes, items] = await Promise.all([
  fetchJson(`${API}/v2/heroes`),
  fetchJson(`${API}/v2/items`),
]);
const itemsByClass = new Map(items.map((i) => [i.class_name, i]));
const apiByKey = new Map(apiHeroes.map((h) => [toKey(h.name), h]));

const diffs = [];
const unmatched = [];

for (const hero of heroesJson) {
  const apiH = apiByKey.get(hero.key);
  if (!apiH) {
    unmatched.push(`${hero.key} (hero not in API)`);
    continue;
  }

  // Re-derive the four signature ability descriptions, keyed by ability name.
  // Precedence mirrors build-data.mjs: fresh cleaned API text, else the curated
  // ability_overrides fallback for abilities the API leaves null.
  const overrides = OVERLAY[hero.key]?.ability_overrides ?? {};
  const nextByName = new Map();
  for (const slot of ["signature1", "signature2", "signature3", "signature4"]) {
    const className = apiH.items?.[slot];
    const item = className && itemsByClass.get(className);
    if (!item || !item.name) continue;
    const raw =
      typeof item.description === "object"
        ? item.description?.desc ?? null
        : item.description ?? null;
    const desc = cleanDescription(raw) ?? overrides[item.name] ?? null;
    if (desc) nextByName.set(item.name, desc);
  }

  for (const ab of hero.abilities ?? []) {
    const next = nextByName.get(ab.name);
    if (next === undefined) {
      unmatched.push(`${hero.key}: "${ab.name}"`);
      continue;
    }
    if (next !== ab.description) {
      diffs.push({ hero: hero.name, ability: ab.name, from: ab.description, to: next });
      ab.description = next;
    }
  }
}

await writeFile(HEROES_FILE, JSON.stringify(heroesJson, null, 2) + "\n");

console.log(`\nUpdated ${diffs.length} description(s) in data/heroes.json`);
for (const d of diffs) {
  console.log(`\n[${d.hero}] ${d.ability}`);
  console.log(`  - ${JSON.stringify(d.from)}`);
  console.log(`  + ${JSON.stringify(d.to)}`);
}
if (unmatched.length) {
  console.log(`\nUnmatched abilities (left unchanged): ${unmatched.length}`);
  for (const u of unmatched) console.log(`  ${u}`);
}
