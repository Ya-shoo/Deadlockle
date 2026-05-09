// Item data pipeline — sources from deadlock.wiki/Items, which is community-
// maintained and current. Replaces the older assets.deadlock-api.com pull
// (whose item names + icons drifted out of sync with live game patches).
//
// Pipeline:
//   1. Fetch the items index HTML
//   2. Slice the "Complete List of Items" section (between two h2 anchors)
//   3. Determine slot boundaries (Weapon → Vitality → Spirit) by locating
//      the slot icon clusters that mark the start of each subsection
//   4. Walk every <div class="HeroCard2"> within the slice, extracting
//      name + thumbnail URL + cost. Tier derives from cost (800/1600/3200/
//      6400 → T1-4); higher costs are Street Brawl legendaries (T5).
//   5. Download each icon to /public/items/ (200×200 from the wiki's 100px
//      `2x` srcset variant).
//   6. Optionally fetch intro extracts via the MediaWiki API in 50-title
//      batches and attach as item descriptions.
//   7. Write data/items.json.
//
// Re-run when item names, icons, or descriptions change with a balance patch.

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ITEMS_OUT = resolve(__dirname, "..", "data", "items.json");
const ICON_OUT = resolve(__dirname, "..", "public", "items");

const WIKI = "https://deadlock.wiki";
const USER_AGENT =
  "Deadlockle/0.1 (daily Deadlock quiz; contact yashpa0326@gmail.com)";

// Item names appear in the wiki HTML with HTML-entity-encoded
// apostrophes ("Hunter&#39;s Aura"). Decode the small set of entities
// MediaWiki actually emits in attribute text.
function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function toKey(name) {
  return name
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Tier → soul cost. The wiki listing no longer surfaces per-item cost,
// but tier pricing is stable across patches; if Valve ever shifts the
// economy, update here in one place.
const TIER_COST = { 1: 800, 2: 1600, 3: 3200, 4: 6400 };

// In-game tab names. The wiki encodes slot in the card-frame filename
// using the older internal label ("Armor" / "Tech") rather than the
// shop tab name ("Vitality" / "Spirit"); translate to the tab name we
// surface in the UI.
const SLOT_MAP = { Weapon: "weapon", Armor: "vitality", Tech: "spirit" };

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return res.text();
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return res.json();
}

async function downloadIcon(srcUrl, outDir, key) {
  try {
    const res = await fetch(srcUrl, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    await sharp(buf)
      .resize(256, 256, { fit: "inside" })
      .webp({ quality: 85, effort: 5 })
      .toFile(resolve(outDir, `${key}.webp`));
    return `/items/${key}.webp`;
  } catch (e) {
    console.log(`[icon failed for ${key}: ${e.message}]`);
    return null;
  }
}

// Anchor offsets in the items page HTML.
function findSection(html, anchorId) {
  // Match the actual h2 element (not the ToC reference).
  const re = new RegExp(`<h2[^>]*id="${anchorId}"`);
  const m = re.exec(html);
  if (!m) throw new Error(`section anchor not found: ${anchorId}`);
  return m.index;
}

function parseItems(html) {
  const start = findSection(html, "Complete_List_of_Items");
  const end = findSection(html, "Active_Items");
  const section = html.substring(start, end);

  // Each item card is a `<div class="HeroCard2">…</table></div>` block.
  // The card encodes everything we need:
  //   - data-item-name="…"          → display name
  //   - <Weapon|Armor|Tech>_Card_T<n>.png → slot + tier (the card frame)
  //   - <span class="item-card-icon">…<img src="/images/thumb/…/96px-…">
  //                                 → item icon
  const cardRe = /<div class="HeroCard2"[\s\S]*?<\/table><\/div>/g;
  const tierFrameRe = /(Weapon|Armor|Tech)_Card_T([1-4])\.png/;
  const iconScopeRe = /<span class="item-card-icon"[\s\S]*?<\/span>/;
  const iconSrcRe =
    /src="(\/images\/thumb\/[a-f0-9]\/[a-f0-9]{2}\/[^/]+\.png)\/96px-[^"]+\.png"/;

  const items = [];
  const seen = new Set();
  let cardMatch;
  while ((cardMatch = cardRe.exec(section)) !== null) {
    const card = cardMatch[0];

    const nameM = card.match(/data-item-name="([^"]+)"/);
    if (!nameM) continue;
    const name = decodeEntities(nameM[1]).trim();
    const wikiTitle = name.replace(/ /g, "_");

    const tierM = card.match(tierFrameRe);
    if (!tierM) continue;
    const slot = SLOT_MAP[tierM[1]];
    const tier = parseInt(tierM[2], 10);
    const cost = TIER_COST[tier] ?? null;

    // Scope icon search to the item-card-icon span so we don't pick up
    // the card frame, paper textures, or paper-wear overlays. Then
    // upgrade the captured 96px thumb to the 192px (2x) variant for a
    // sharper local resize.
    const iconBlock = card.match(iconScopeRe);
    if (!iconBlock) continue;
    const iconM = iconBlock[0].match(iconSrcRe);
    if (!iconM) continue;
    const filename = iconM[1].split("/").pop();
    const iconUrl = `${WIKI}${iconM[1]}/192px-${filename}`;

    const key = toKey(name);
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({
      key,
      name,
      slot,
      tier,
      cost,
      iconSrc: iconUrl,
      wikiTitle,
    });
  }
  return items;
}

// Batch-fetch intro extracts via MediaWiki API. Cap batch size at 20 —
// the TextExtracts extension caps `exlimit` at 20 per query, and any
// titles past that limit silently come back without an `extract` field.
async function fetchDescriptions(titles) {
  const out = new Map();
  const batches = [];
  for (let i = 0; i < titles.length; i += 20) {
    batches.push(titles.slice(i, i + 20));
  }
  for (const batch of batches) {
    const url = new URL(`${WIKI}/api.php`);
    url.searchParams.set("action", "query");
    url.searchParams.set("prop", "extracts");
    url.searchParams.set("exintro", "true");
    url.searchParams.set("explaintext", "true");
    url.searchParams.set("exlimit", "max");
    url.searchParams.set("titles", batch.join("|"));
    url.searchParams.set("format", "json");
    url.searchParams.set("formatversion", "2");
    try {
      const j = await fetchJson(url.toString());
      const pages = j.query?.pages ?? [];
      for (const p of pages) {
        if (p.title && p.extract) {
          out.set(p.title, p.extract.split(/\n/)[0].trim());
        }
      }
      // gentle rate limit
      await new Promise((r) => setTimeout(r, 300));
    } catch (e) {
      console.log(`[desc batch failed: ${e.message}]`);
    }
  }
  return out;
}

async function main() {
  await mkdir(ICON_OUT, { recursive: true });
  await mkdir(resolve(__dirname, "..", "data"), { recursive: true });

  console.log("Fetching wiki Items page...");
  const html = await fetchText(`${WIKI}/Items`);

  console.log("Parsing item cards...");
  const items = parseItems(html);
  console.log(`  parsed ${items.length} standard items`);

  console.log("Fetching descriptions...");
  const titles = items.map((i) => decodeURIComponent(i.wikiTitle));
  const descMap = await fetchDescriptions(titles);
  console.log(`  got ${descMap.size} descriptions`);

  console.log("Downloading icons...");
  let dlOk = 0;
  for (const it of items) {
    process.stdout.write(`  ${it.key.padEnd(32)} `);
    const path = await downloadIcon(it.iconSrc, ICON_OUT, it.key);
    if (path) dlOk++;
    it.icon = path;
    delete it.iconSrc;
    // descMap is keyed by the title we passed to the API (apostrophe
    // intact, spaces left as-is in the URL we built).
    const desc = descMap.get(it.name);
    it.description = desc ?? null;
    // MediaWiki canonical URL form: spaces → underscores, apostrophes
    // percent-encoded. Other punctuation is rare in item names and
    // works without encoding in practice.
    it.wikiUrl = `${WIKI}/${it.wikiTitle.replace(/'/g, "%27")}`;
    delete it.wikiTitle;
    console.log(path ? "ok" : "skip");
    await new Promise((r) => setTimeout(r, 60));
  }
  console.log(`  downloaded ${dlOk}/${items.length} icons`);

  await writeFile(ITEMS_OUT, JSON.stringify(items, null, 2));
  console.log(`\nWrote ${items.length} items → data/items.json`);

  const slots = {};
  const tiers = {};
  for (const it of items) {
    slots[it.slot] = (slots[it.slot] || 0) + 1;
    tiers[it.tier] = (tiers[it.tier] || 0) + 1;
  }
  console.log("  by slot:", slots);
  console.log("  by tier:", tiers);
  console.log(
    `  with description: ${items.filter((i) => i.description).length}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
