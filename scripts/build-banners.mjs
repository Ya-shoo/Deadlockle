// Banner asset pipeline. Sources hero scene backgrounds from
// assets.deadlock-api.com (38 entries — one per playable hero) — these are
// the cinematic backdrops Valve renders behind each hero card and read as
// atmospheric banner art at full size.
//
// Each source image is downloaded once, resized to 2000×900 (~2.22:1) using
// sharp's attention strategy so the salient region (character / focal
// point) stays in the crop. Output JPEGs are written to
// public/banners/heroes/{key}.jpg and a manifest at data/banners.json
// describes every entry for the runtime to pick from.

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import sharp from "sharp";
import { cdn } from "./_cdn.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BANNERS_OUT = resolve(__dirname, "..", "public", "banners");
const OUT_JSON = resolve(__dirname, "..", "data", "banners.json");
const API = "https://assets.deadlock-api.com";

const TARGET_W = 2000;
const TARGET_H = 900;
const QUALITY = 78;
const USER_AGENT =
  "Deadlockle/0.1 (daily Deadlock quiz; contact yashpa0326@gmail.com)";

function toKey(name) {
  return name
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return res.json();
}

async function downloadAndResize(url, outPath) {
  let buf;
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      buf = Buffer.from(await res.arrayBuffer());
      break;
    } catch (e) {
      lastErr = e;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }
  if (!buf) throw new Error(`download ${lastErr?.message ?? "unknown"}`);

  await sharp(buf)
    .resize(TARGET_W, TARGET_H, {
      fit: "cover",
      position: sharp.strategy.attention,
    })
    .jpeg({ quality: QUALITY, progressive: true })
    .toFile(outPath);
}

async function main() {
  const heroDir = resolve(BANNERS_OUT, "heroes");
  await mkdir(heroDir, { recursive: true });
  await mkdir(resolve(__dirname, "..", "data"), { recursive: true });

  console.log("Fetching heroes...");
  const all = await fetchJson(`${API}/v2/heroes`);
  const heroes = all.filter(
    (h) => h.player_selectable && !h.disabled && !h.in_development,
  );
  console.log(`  ${heroes.length} playable heroes`);

  const heroBanners = [];
  for (const h of heroes) {
    const key = toKey(h.name);
    const src =
      h.images?.background_image_webp ||
      h.images?.background_image ||
      h.images?.hero_card_critical_webp ||
      h.images?.hero_card_critical ||
      null;
    if (!src) {
      console.log(`  ${key.padEnd(15)} no background, skip`);
      continue;
    }
    process.stdout.write(`  ${key.padEnd(15)} `);
    const out = resolve(heroDir, `${key}.jpg`);
    try {
      await downloadAndResize(src, out);
      heroBanners.push({
        type: "hero",
        key,
        label: h.name,
        sublabel: "Hero scene",
        file: cdn(`/banners/heroes/${key}.jpg`),
      });
      console.log("ok");
    } catch (e) {
      console.log(`fail (${e.message})`);
    }
    await new Promise((r) => setTimeout(r, 80));
  }

  const manifest = {
    heroes: heroBanners,
  };
  await writeFile(OUT_JSON, JSON.stringify(manifest, null, 2));
  console.log(`\nWrote ${heroBanners.length} banners → data/banners.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
