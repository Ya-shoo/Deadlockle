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

function toKey(name) {
  return name
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Map a soul cost to a tier number. Items at 9999 are Street Brawl
// legendaries; tiers 5+ are mode-specific so we filter them out by default.
function costToTier(cost) {
  if (cost === 800) return 1;
  if (cost === 1600) return 2;
  if (cost === 3200) return 3;
  if (cost === 6400) return 4;
  return null;
}

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

// Slot icon clusters mark the start of each slot subsection.
function findFirst(html, pattern, fromIndex = 0) {
  const idx = html.indexOf(pattern, fromIndex);
  if (idx < 0) throw new Error(`pattern not found after ${fromIndex}: ${pattern}`);
  return idx;
}

function parseItems(html) {
  const start = findSection(html, "Complete_List_of_Items");
  const end = findSection(html, "Active_Items");
  const section = html.substring(start, end);

  // Slot boundaries: find first occurrence of each slot icon AFTER the
  // section start. Items within [weaponStart, vitalityStart) are weapons,
  // etc. Offsets are page-relative (from `start`).
  const weaponStart = findFirst(section, "Weapon_Icon.png");
  const vitalityStart = findFirst(section, "Vitality_Icon.png");
  const spiritStart = findFirst(section, "Spirit_icon.png");

  function slotAt(offset) {
    if (offset >= spiritStart) return "spirit";
    if (offset >= vitalityStart) return "vitality";
    if (offset >= weaponStart) return "weapon";
    return null;
  }

  // Each item card is a `<div class="HeroCard2">…</table></div>` block.
  const cardRe = /<div class="HeroCard2"[\s\S]*?<\/table><\/div>/g;
  const items = [];
  const seen = new Set();
  let cardMatch;
  while ((cardMatch = cardRe.exec(section)) !== null) {
    const card = cardMatch[0];
    const offset = cardMatch.index;

    // Cost: first <b>NUMBER</b> inside the card. Skip legendaries (9999+).
    const costM = card.match(/<b>([\d,]+)<\/b>/);
    if (!costM) continue;
    const cost = parseInt(costM[1].replace(/,/g, ""), 10);
    const tier = costToTier(cost);
    if (tier == null) continue;

    // Item icon: the wiki renders item thumbnails at exactly 50px in this
    // section. Source URL is `/images/thumb/<x>/<xx>/<File>.png/50px-<File>.png`
    // — we extract <File> to derive the wiki page title (replace _ → space)
    // and rebuild the URL at 100px so the download is crisp at 2x. Note we
    // must NOT use the first title-attribute in the card, because that's the
    // Souls icon link that prefixes every cost cell.
    const iconM = card.match(
      /src="(\/images\/thumb\/[a-f0-9]\/[a-f0-9]{2}\/([^/]+)\.png\/50px-[^"]+\.png)"/,
    );
    if (!iconM) continue;
    const wikiTitle = iconM[2]; // e.g., "Close_Quarters"
    // Skip non-item icons that somehow pass the size filter (Star.png etc.)
    if (
      wikiTitle === "Souls" ||
      wikiTitle === "Star" ||
      wikiTitle === "Weapon_Icon" ||
      wikiTitle === "Vitality_Icon" ||
      wikiTitle === "Spirit_icon"
    ) {
      continue;
    }
    const name = wikiTitle.replace(/_/g, " ");
    const iconUrl = `${WIKI}${iconM[1].replace("/50px-", "/100px-")}`;

    const slot = slotAt(offset);
    if (!slot) continue;

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

// Batch-fetch intro extracts via MediaWiki API. Up to 50 titles per call.
async function fetchDescriptions(titles) {
  const out = new Map();
  const batches = [];
  for (let i = 0; i < titles.length; i += 50) {
    batches.push(titles.slice(i, i + 50));
  }
  for (const batch of batches) {
    const url = new URL(`${WIKI}/api.php`);
    url.searchParams.set("action", "query");
    url.searchParams.set("prop", "extracts");
    url.searchParams.set("exintro", "true");
    url.searchParams.set("explaintext", "true");
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
    const desc = descMap.get(decodeURIComponent(it.wikiTitle));
    it.description = desc ?? null;
    it.wikiUrl = `${WIKI}/${it.wikiTitle}`;
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
