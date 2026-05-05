// One-shot pipeline for Sound mode audio. For each hero in data/heroes.json:
//   1. Fetch deadlock.wiki/<Hero>/Quotes via the MediaWiki parse API
//   2. Auto-detect that hero's audio file prefix (some heroes use class
//      codenames — Infernus → "Inferno", Seven → "Gigawatt", Lady Geist →
//      "Geist", Grey Talon → "Orion", The Doorman → "Doorman", Mo & Krill →
//      "Krill", etc). We discover this by reading the Select-section File:
//      refs and picking the most common prefix.
//   3. Extract the rows of `== Select ==` (file ref + transcript)
//   4. Spoiler-scrub: drop any clip whose transcript names another hero by
//      first name, full name, or known nickname (mirrors the curation rule
//      already used for Quote-mode conversations.ts).
//   5. Download up to MAX_PER_HERO clean clips to public/voicelines/<key>/
//   6. Write data/voicelines.json — { [heroKey]: { prefix, clips: [...] } }
//
// Re-run when the wiki adds new VO passes or new heroes ship.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HEROES_IN = resolve(__dirname, "..", "data", "heroes.json");
const OUT_MANIFEST = resolve(__dirname, "..", "data", "voicelines.json");
const OUT_DIR = resolve(__dirname, "..", "public", "voicelines");

const WIKI = "https://deadlock.wiki";
const UA = "deadlockle-voicelines/0.1 (yashpa0326@gmail.com)";

// How many clean Select clips to keep per hero. Five gives us enough
// rotation that the same daily seed doesn't pick the same clip twice in
// a week, without ballooning bundle size.
const MAX_PER_HERO = 5;

// Page title overrides where the wiki page name differs from the hero
// display name (e.g., URL-encoding for "&"). Most heroes resolve via
// `Hero Name`.replace(' ', '_').
const PAGE_TITLE_OVERRIDES = {
  "mo-krill": "Mo_%26_Krill",
};

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return res.json();
}

async function fetchBuffer(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function pageTitleFor(hero) {
  if (PAGE_TITLE_OVERRIDES[hero.key]) return PAGE_TITLE_OVERRIDES[hero.key];
  return hero.name.replace(/\s+/g, "_");
}

// Pull the wikitext for a single page. Returns "" on 404 / missing.
async function getQuotesWikitext(hero) {
  const title = pageTitleFor(hero);
  const url = `${WIKI}/api.php?action=parse&format=json&page=${title}/Quotes&prop=wikitext&redirects=1`;
  try {
    const j = await fetchJson(url);
    return j?.parse?.wikitext?.["*"] ?? "";
  } catch (e) {
    console.log(`  [no Quotes page for ${hero.name}: ${e.message}]`);
    return "";
  }
}

// Slice the `== Select ==` section from raw wikitext (until the next
// `== Heading ==` or end-of-doc).
function extractSection(wikitext, heading) {
  const re = new RegExp(`==\\s*${heading}\\s*==([\\s\\S]*?)(?:\\n==[^=]|$)`, "i");
  const m = wikitext.match(re);
  return m ? m[1] : "";
}

// Parse a section like the Select table into [{file, transcript}, ...].
// Wikitable rows look like:
//   |-
//   |[[File:Inferno select 01.mp3]]
//   |What'll it be today?
function parseSelectRows(section) {
  if (!section) return [];
  const out = [];
  const re = /\[\[File:([A-Za-z][^|\]]*\.mp3)\]\]\s*\|\s*([^\n|]+?)(?=\n[|}!])/g;
  let m;
  while ((m = re.exec(section)) !== null) {
    const file = m[1].trim().replace(/\s+/g, "_");
    let transcript = m[2].trim();
    // Strip remaining wiki markup that snuck through.
    transcript = transcript.replace(/'''/g, "").replace(/''/g, "");
    transcript = transcript.replace(/\[\[[^|\]]*\|([^\]]+)\]\]/g, "$1");
    transcript = transcript.replace(/\[\[([^\]]+)\]\]/g, "$1");
    transcript = transcript.replace(/<[^>]+>/g, "");
    transcript = transcript.replace(/\s+/g, " ").trim();
    if (file && transcript) out.push({ file, transcript });
  }
  return out;
}

// Most common A-Z prefix of "<Prefix> select NN.mp3" filenames in the
// section. This is the audio-file class code (e.g., "Inferno" for
// Infernus, "Orion" for Grey Talon).
function detectPrefix(rows) {
  const counts = new Map();
  for (const r of rows) {
    const m = r.file.match(/^([A-Za-z]+)[ _]select[ _]\d+\.mp3$/i);
    if (!m) continue;
    counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
  }
  let best = null;
  let bestN = 0;
  for (const [p, n] of counts) {
    if (n > bestN) {
      best = p;
      bestN = n;
    }
  }
  return best;
}

// Build the spoiler-scrub vocabulary. For a given hero, returns a Set of
// lowercase tokens that — if any appears in a transcript — would name
// some OTHER hero and ruin the puzzle. Each entry is a whole-word match.
//
// Inclusions per hero: display name, nickname slugs from the existing
// curation work, and audio-prefix codenames (Inferno, Atlas, Orion…).
function buildForbiddenTokens(allHeroes, prefixByKey, selfHero) {
  const banned = new Set();
  for (const h of allHeroes) {
    if (h.key === selfHero.key) continue;
    // Display name and any short alias.
    for (const part of h.name.split(/\s+/)) {
      if (part.length >= 3) banned.add(part.toLowerCase());
    }
    banned.add(h.name.toLowerCase());
    const px = prefixByKey.get(h.key);
    if (px) banned.add(px.toLowerCase());
  }
  // Domain-specific aliases worth blocking globally — these reliably
  // identify a specific hero. Kept small; expand if a clip slips through.
  for (const t of [
    "bartender",
    "fern", // Infernus nickname
    "sheriff", // Holliday
    "sandman",
    "iron body",
    "four arms", // Mo & Krill
    "tommy gun",
    "cook", // Pocket cooks
    "briefcase",
    "shotgun lady",
    "viper", // alternative for Vyper
  ]) {
    banned.add(t);
  }
  return banned;
}

// Returns true if transcript is safe (mentions no other hero / nickname).
function isSpoilerSafe(transcript, banned) {
  const lower = transcript.toLowerCase();
  for (const tok of banned) {
    // Word-boundary match so "haze" doesn't match "hazel". Nicknames
    // with spaces are matched as a substring (no boundary on space).
    const isPhrase = tok.includes(" ");
    const re = isPhrase
      ? new RegExp(escapeRe(tok), "i")
      : new RegExp(`\\b${escapeRe(tok)}\\b`, "i");
    if (re.test(lower)) return false;
  }
  return true;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Resolve File:<name> → CDN URL via the MediaWiki imageinfo API.
async function resolveFileUrl(filename) {
  const title = `File:${filename.replace(/_/g, " ")}`;
  const url = `${WIKI}/api.php?action=query&format=json&prop=imageinfo&iiprop=url&titles=${encodeURIComponent(title)}`;
  const j = await fetchJson(url);
  const pages = j?.query?.pages ?? {};
  for (const k of Object.keys(pages)) {
    const ii = pages[k]?.imageinfo;
    if (ii && ii[0]?.url) return ii[0].url;
  }
  return null;
}

async function downloadClip(srcUrl, outPath) {
  const buf = await fetchBuffer(srcUrl);
  await writeFile(outPath, buf);
  return buf.length;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const heroes = JSON.parse(await readFile(HEROES_IN, "utf-8"));

  // Pass 1: discover prefix for every hero (needed for spoiler vocab).
  console.log("Pass 1: discovering audio prefixes...");
  const prefixByKey = new Map();
  const sectionByKey = new Map();
  for (const h of heroes) {
    const wikitext = await getQuotesWikitext(h);
    if (!wikitext) {
      console.log(`  ${h.key.padEnd(15)} (no Quotes page — skipping)`);
      continue;
    }
    const section = extractSection(wikitext, "Select");
    const rows = parseSelectRows(section);
    const prefix = detectPrefix(rows);
    if (!prefix) {
      console.log(`  ${h.key.padEnd(15)} (no Select section — skipping)`);
      continue;
    }
    prefixByKey.set(h.key, prefix);
    sectionByKey.set(h.key, rows);
    console.log(
      `  ${h.key.padEnd(15)} prefix=${prefix.padEnd(12)} ${rows.length} rows`,
    );
    await new Promise((r) => setTimeout(r, 80));
  }

  // Pass 2: scrub + download, per hero.
  console.log("\nPass 2: scrubbing & downloading...");
  const manifest = {};
  for (const h of heroes) {
    const rows = sectionByKey.get(h.key);
    const prefix = prefixByKey.get(h.key);
    if (!rows || !prefix) continue;

    const banned = buildForbiddenTokens(heroes, prefixByKey, h);
    const clean = rows.filter((r) => isSpoilerSafe(r.transcript, banned));
    const picked = clean.slice(0, MAX_PER_HERO);

    if (picked.length === 0) {
      console.log(`  ${h.key.padEnd(15)} 0 clean clips — skipping`);
      continue;
    }

    const heroDir = resolve(OUT_DIR, h.key);
    await mkdir(heroDir, { recursive: true });

    const clips = [];
    for (let i = 0; i < picked.length; i++) {
      const { file, transcript } = picked[i];
      const idx = String(i + 1).padStart(2, "0");
      const outName = `select-${idx}.mp3`;
      const outPath = resolve(heroDir, outName);
      try {
        const url = await resolveFileUrl(file);
        if (!url) {
          console.log(`    ${h.key} ${file}: no URL`);
          continue;
        }
        const bytes = await downloadClip(url, outPath);
        clips.push({
          file: outName,
          url: `/voicelines/${h.key}/${outName}`,
          transcript,
          bytes,
        });
      } catch (e) {
        console.log(`    ${h.key} ${file}: ${e.message}`);
      }
      await new Promise((r) => setTimeout(r, 60));
    }

    manifest[h.key] = { prefix, clips };
    console.log(
      `  ${h.key.padEnd(15)} ${clips.length}/${picked.length} clips · scrubbed ${rows.length - clean.length}`,
    );
  }

  await writeFile(OUT_MANIFEST, JSON.stringify(manifest, null, 2));
  const totalClips = Object.values(manifest).reduce(
    (n, v) => n + v.clips.length,
    0,
  );
  const totalBytes = Object.values(manifest).reduce(
    (n, v) => n + v.clips.reduce((m, c) => m + c.bytes, 0),
    0,
  );
  console.log(
    `\nWrote ${Object.keys(manifest).length} heroes / ${totalClips} clips / ${(
      totalBytes /
      1024 /
      1024
    ).toFixed(1)}MB → data/voicelines.json`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
