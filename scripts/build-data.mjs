// One-shot HERO pipeline: fetch Deadlock hero data from
// assets.deadlock-api.com, merge with hand-curated overlay
// (gender / nature / damage_style), smartcrop hero card art into self-hosted
// 1:1 JPEGs, and write data/heroes.json.
//
// This script intentionally does NOT write data/items.json — the item
// catalogue is owned by scripts/build-items-wiki.mjs, which sources from
// deadlock.wiki (the assets.deadlock-api.com item list drifted out of sync
// with live patches). It still fetches /v2/items, but only to resolve hero
// ability metadata by class_name.
//
// Run once and commit the output. Re-run when the roster changes.

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import sharp from "sharp";
import smartcrop from "smartcrop-sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HEROES_OUT = resolve(__dirname, "..", "data", "heroes.json");
const SPLASH_OUT = resolve(__dirname, "..", "public", "splash");
const PORTRAIT_OUT = resolve(__dirname, "..", "public", "portraits");
const ABILITY_OUT = resolve(__dirname, "..", "public", "abilities");

const API = "https://assets.deadlock-api.com";

const SPLASH_SIZE = 800;
const SPLASH_QUALITY = 80;

// Hand-curated overlay keyed by hero `key` (lowercased name with hyphens).
// Fields the API doesn't expose, plus fallbacks for fields Valve hasn't
// filled in upstream yet (newer heroes often have null hero_type / gun_tag /
// role / specific ability descriptions in the API response).
//   gender:         "male" | "female" | "non-binary" | "neutral"
//   nature:         "human" | "undead" | "spirit" | "beast" | "robot" | "mystical" | "ixian"
//   damage_style:   "hitscan" | "projectile" | "hybrid" | "melee"  -- delivery
//   sub_role:       "sniper" | "carry" | "skirmisher" | "diver" | "bruiser" | "tank" | "mage" | "support" | "assassin"
//                   "assassin" carries over Valve's hero_type bucket of the
//                   same name; used when the diver/skirmisher labels don't
//                   capture the hero's identity well enough.
//                   our refinement of Valve's 4-bucket hero_type
//   damage_source:  "weapon" | "spirit" | "hybrid"  -- where damage comes from in team fights
//   role:                fallback for the API tagline (`description.role`)
//   hero_type, gun_tag:  fallback for Valve's 4-bucket archetype + weapon tag
//   ability_overrides:   { [abilityName]: description } fallback for null ability text
const OVERLAY = {
  "infernus":     { gender: "male",       nature: "ixian",     damage_style: "hitscan",    sub_role: "skirmisher", damage_source: "weapon"  },
  "seven":        { gender: "male",       nature: "undead",    damage_style: "hitscan",    sub_role: "mage",       damage_source: "spirit"  },
  "vindicta":     { gender: "female",     nature: "spirit",    damage_style: "hitscan",    sub_role: "sniper",     damage_source: "weapon"  },
  "lady-geist":   { gender: "female",     nature: "human",     damage_style: "hitscan",    sub_role: "mage",       damage_source: "spirit"  },
  "abrams":       { gender: "male",       nature: "ixian",     damage_style: "hitscan",    sub_role: "tank",       damage_source: "weapon"  },
  "wraith":       { gender: "female",     nature: "mystical",  damage_style: "hitscan",    sub_role: "carry",      damage_source: "weapon"  },
  "mcginnis":     { gender: "female",     nature: "human",     damage_style: "hitscan",    sub_role: "support",    damage_source: "weapon"  },
  "paradox":      { gender: "female",     nature: "human",     damage_style: "hitscan",    sub_role: "skirmisher", damage_source: "hybrid"  },
  "dynamo":       { gender: "male",       nature: "spirit",    damage_style: "hitscan",    sub_role: "support",    damage_source: "spirit"  },
  "kelvin":       { gender: "male",       nature: "undead",    damage_style: "projectile", sub_role: "tank",       damage_source: "hybrid"  },
  "haze":         { gender: "female",     nature: "human",     damage_style: "hitscan",    sub_role: "carry",      damage_source: "weapon"  },
  "holliday":     { gender: "female",     nature: "human",     damage_style: "hitscan",    sub_role: "skirmisher", damage_source: "weapon"  },
  "bebop":        { gender: "neutral",    nature: "robot",     damage_style: "hybrid",     sub_role: "bruiser",    damage_source: "spirit"  },
  "calico":       { gender: "female",     nature: "human",     damage_style: "hitscan",    sub_role: "diver",      damage_source: "weapon"  },
  "grey-talon":   { gender: "male",       nature: "human",     damage_style: "projectile", sub_role: "sniper",     damage_source: "weapon"  },
  "mo-krill":     { gender: "male",       nature: "beast",     damage_style: "hitscan",    sub_role: "bruiser",    damage_source: "spirit"  },
  "shiv":         {
    gender: "male", nature: "human", damage_style: "hitscan", sub_role: "assassin", damage_source: "spirit",
    ability_overrides: {
      "Killing Blow": "Leap forward, dealing spirit damage to the first enemy hero hit; if they are below the kill threshold, execute them outright.",
    },
  },
  "ivy":          { gender: "female",     nature: "mystical",  damage_style: "hitscan",    sub_role: "support",    damage_source: "weapon"  },
  "warden":       { gender: "male",       nature: "human",     damage_style: "hitscan",    sub_role: "bruiser",    damage_source: "weapon"  },
  "yamato":       { gender: "female",     nature: "human",     damage_style: "hitscan",    sub_role: "diver",      damage_source: "spirit"  },
  "lash":         { gender: "male",       nature: "human",     damage_style: "hitscan",    sub_role: "diver",      damage_source: "spirit"  },
  "viscous":      { gender: "neutral",    nature: "mystical",  damage_style: "projectile", sub_role: "bruiser",    damage_source: "spirit"  },
  "pocket":       { gender: "non-binary", nature: "human",     damage_style: "hitscan",    sub_role: "mage",       damage_source: "spirit"  },
  "mirage":       { gender: "male",       nature: "human",     damage_style: "hitscan",    sub_role: "skirmisher", damage_source: "hybrid"  },
  "vyper":        { gender: "female",     nature: "beast",     damage_style: "hitscan",    sub_role: "diver",      damage_source: "weapon"  },
  "sinclair":     { gender: "male",       nature: "spirit",    damage_style: "hitscan",    sub_role: "mage",       damage_source: "spirit"  },
  "mina":         {
    gender: "female", nature: "undead", damage_style: "hitscan", sub_role: "assassin", damage_source: "spirit",
    role: "Drains life at mid-range and slips away as a swarm of bats",
  },
  "drifter":      {
    gender: "male", nature: "undead", damage_style: "hitscan", sub_role: "skirmisher", damage_source: "weapon",
    role: "Stalks isolated prey and feeds on the blood of the lonely",
    ability_overrides: {
      "Bloodscent": "Isolated heroes leave a blood trail and emit an audible heartbeat, letting you deal amplified damage to them and gain permanent weapon damage when they die nearby.",
    },
  },
  "venator":      {
    gender: "male", nature: "human", damage_style: "projectile", sub_role: "sniper", damage_source: "weapon",
    role: "Hunts the supernatural with crossbow bolts and blessed traps",
  },
  "victor":       {
    gender: "male", nature: "undead", damage_style: "hitscan", sub_role: "bruiser", damage_source: "weapon",
    role: "Channels his own pain into shocking, undying retribution",
  },
  "paige":        {
    gender: "female", nature: "human", damage_style: "projectile", sub_role: "support", damage_source: "spirit",
    role: "Weaves stories into spells that shield her allies and bind her foes",
  },
  "the-doorman":  {
    gender: "male", nature: "spirit", damage_style: "hitscan", sub_role: "mage", damage_source: "spirit",
    role: "Opens uncanny doors to displace enemies and reroute the battlefield",
  },
  "billy":        {
    gender: "male", nature: "beast", damage_style: "hybrid", sub_role: "tank", damage_source: "hybrid",
    role: "Charges headfirst into the mosh pit and refuses to back down",
  },
  "graves":       {
    gender: "female", nature: "human", damage_style: "hitscan", sub_role: "carry", damage_source: "spirit",
    hero_type: "brawler",
    role: "Raises the dead to overrun lanes and crush her foes' resolve",
    ability_overrides: {
      "Borrowed Decree": "Place a gravestone that summons shambling ghouls; they march toward enemies and explode for spirit damage, slowing any hero or objective they reach.",
    },
  },
  "apollo":       {
    gender: "male", nature: "ixian", damage_style: "hybrid", sub_role: "skirmisher", damage_source: "spirit",
    role: "A dueling prince who parries every blow and ends fights in a flash",
  },
  "rem":          {
    gender: "male", nature: "mystical", damage_style: "melee", sub_role: "mage", damage_source: "spirit",
    hero_type: "mystic",
    gun_tag: "Long Range",
    role: "Tucks enemies in for a nap while his lil helpers tend the team",
  },
  "silver":       {
    gender: "female", nature: "beast", damage_style: "hitscan", sub_role: "skirmisher", damage_source: "weapon",
    hero_type: "brawler",
    gun_tag: "Spreadshot",
    role: "A bounty hunter who answers the moon and unleashes her inner wolf",
    ability_overrides: {
      "Boot Kick": "Dash forward and kick the first enemy hit, dealing melee damage and marking them so your next shot detonates the mark for bonus spirit damage.",
    },
  },
  "celeste":      {
    gender: "female", nature: "mystical", damage_style: "hitscan", sub_role: "mage", damage_source: "hybrid",
    role: "Dazzles the battlefield with prismatic light and bouncing arcane orbs",
  },
};

// Convert display name to URL-safe key. Mirrors OW kebab-case.
function toKey(name) {
  return name
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Deadlock ability descriptions embed inline SVG icons + HTML markup. Strip
// to plain prose and keep only the first 1-2 sentences (the rest covers
// detailed mechanics that read like patch notes).
function cleanDescription(s) {
  if (!s || typeof s !== "string") return null;
  let out = s.replace(/<svg[\s\S]*?<\/svg>/gi, "");
  out = out.replace(/<\/?span[^>]*>/gi, "");
  out = out.replace(/<[^>]+>/g, "");
  out = out.replace(/\s+/g, " ").trim();
  if (!out) return null;
  const sentences = out.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (sentences && sentences.length > 2) {
    out = sentences.slice(0, 2).join("").trim();
  }
  return out;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return res.json();
}

// Smartcrop + resize an image URL to a 1:1 JPEG. Returns saved path or null
// if anything fails. Used for hero splash backgrounds — saliency picks the
// most "interesting" square, which is virtually always the character.
async function smartcropToJpg(srcUrl, outDir, key, size = SPLASH_SIZE) {
  try {
    const res = await fetch(srcUrl);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).metadata();
    if (!meta.width || !meta.height) return null;

    const result = await smartcrop.crop(buf, { width: 1, height: 1 });
    if (!result?.topCrop) return null;
    const c = result.topCrop;

    await sharp(buf)
      .extract({
        left: Math.max(0, Math.round(c.x)),
        top: Math.max(0, Math.round(c.y)),
        width: Math.min(meta.width - Math.round(c.x), Math.round(c.width)),
        height: Math.min(meta.height - Math.round(c.y), Math.round(c.height)),
      })
      .resize(size, size, { fit: "cover" })
      .jpeg({ quality: SPLASH_QUALITY })
      .toFile(resolve(outDir, `${key}.jpg`));
    return `/${outDir.split("/").slice(-1)[0]}/${key}.jpg`;
  } catch (e) {
    console.log(`[crop failed for ${key}: ${e.message}]`);
    return null;
  }
}

// Plain pass-through download to local PNG (no smartcrop). Used for ability
// + item icons — they're already cropped square by the source.
async function downloadIcon(srcUrl, outDir, key) {
  try {
    const res = await fetch(srcUrl);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    await sharp(buf)
      .resize(256, 256, { fit: "inside" })
      .png({ compressionLevel: 9 })
      .toFile(resolve(outDir, `${key}.png`));
    return `/${outDir.split("/").slice(-1)[0]}/${key}.png`;
  } catch (e) {
    console.log(`[icon failed for ${key}: ${e.message}]`);
    return null;
  }
}

async function main() {
  await mkdir(SPLASH_OUT, { recursive: true });
  await mkdir(PORTRAIT_OUT, { recursive: true });
  await mkdir(ABILITY_OUT, { recursive: true });
  await mkdir(resolve(__dirname, "..", "data"), { recursive: true });

  console.log("Fetching heroes...");
  const allHeroes = await fetchJson(`${API}/v2/heroes`);
  const heroes = allHeroes.filter(
    (h) => h.player_selectable && !h.disabled && !h.in_development,
  );
  console.log(`  ${heroes.length} playable / ${allHeroes.length} total`);

  console.log("Fetching items...");
  const allItems = await fetchJson(`${API}/v2/items`);
  console.log(`  ${allItems.length} items total`);

  // Index items by class_name for hero ability resolution.
  const itemsByClass = new Map(allItems.map((i) => [i.class_name, i]));

  // ---------- HEROES ----------
  console.log("\nProcessing heroes...");
  const heroesOut = [];
  const missingOverlay = [];

  for (const h of heroes) {
    const key = toKey(h.name);
    process.stdout.write(`  ${key.padEnd(15)} `);

    const overlay = OVERLAY[key];
    if (!overlay) missingOverlay.push(key);

    // Resolve the four signature abilities via class_name lookup.
    const abilityKeys = ["signature1", "signature2", "signature3", "signature4"];
    const abilities = [];
    for (const slot of abilityKeys) {
      const className = h.items?.[slot];
      if (!className) continue;
      const item = itemsByClass.get(className);
      if (!item || !item.name) continue;

      let iconUrl = null;
      if (item.image) {
        const abKey = `${key}-${slot}`;
        process.stdout.write("ab ");
        iconUrl = await downloadIcon(item.image, ABILITY_OUT, abKey);
      }

      const rawDesc =
        typeof item.description === "object"
          ? item.description?.desc ?? null
          : item.description ?? null;
      abilities.push({
        name: item.name,
        description:
          cleanDescription(rawDesc) ??
          overlay?.ability_overrides?.[item.name] ??
          null,
        icon: iconUrl,
        sourceImage: item.image ?? null,
      });
    }

    // Splash: hero_card_critical is the hero-focused art, perfect for the
    // smartcrop-then-zoom mode. Falls back to background_image.
    let splashUrl = null;
    const splashSrc =
      h.images?.hero_card_critical_webp ||
      h.images?.hero_card_critical ||
      h.images?.background_image_webp ||
      h.images?.background_image ||
      null;
    if (splashSrc) {
      process.stdout.write("splash ");
      splashUrl = await smartcropToJpg(splashSrc, SPLASH_OUT, key);
    }

    // Portrait: small icon for autocomplete dropdown. icon_image_small is
    // already a tight crop from Valve, just download + resize.
    let portraitUrl = null;
    const portraitSrc =
      h.images?.icon_image_small_webp ||
      h.images?.icon_image_small ||
      h.images?.icon_hero_card_webp ||
      h.images?.icon_hero_card ||
      null;
    if (portraitSrc) {
      process.stdout.write("p ");
      portraitUrl = await downloadIcon(portraitSrc, PORTRAIT_OUT, key);
    }

    const stats = h.starting_stats || {};
    const num = (s) =>
      typeof stats[s]?.value === "number" ? stats[s].value : null;

    const apiRole =
      typeof h.description === "object" ? h.description?.role ?? null : null;
    heroesOut.push({
      key,
      id: h.id,
      class_name: h.class_name,
      name: h.name,
      hero_type: h.hero_type ?? overlay?.hero_type ?? null,
      gun_tag: h.gun_tag ?? overlay?.gun_tag ?? null,
      tags: Array.isArray(h.tags) ? h.tags : [],
      complexity: typeof h.complexity === "number" ? h.complexity : null,
      hp: num("max_health"),
      move_speed: num("max_move_speed"),
      stamina: num("stamina"),
      lore:
        typeof h.description === "object" ? h.description?.lore ?? null : null,
      role: apiRole ?? overlay?.role ?? null,
      gender: overlay?.gender ?? null,
      nature: overlay?.nature ?? null,
      damage_style: overlay?.damage_style ?? null,
      sub_role: overlay?.sub_role ?? null,
      damage_source: overlay?.damage_source ?? null,
      abilities,
      portrait_url: portraitUrl,
      splash_url: splashUrl,
    });

    console.log("ok");
    await new Promise((r) => setTimeout(r, 60));
  }

  await writeFile(HEROES_OUT, JSON.stringify(heroesOut, null, 2));
  console.log(`\nWrote ${heroesOut.length} heroes → data/heroes.json`);
  console.log(
    `  with full overlay: ${heroesOut.filter((h) => h.gender && h.nature && h.damage_style && h.sub_role && h.damage_source).length}`,
  );
  console.log(
    `  with splash crop:  ${heroesOut.filter((h) => h.splash_url).length}`,
  );
  console.log(
    `  with all 4 abilities: ${heroesOut.filter((h) => h.abilities.length === 4).length}`,
  );
  if (missingOverlay.length) {
    console.log(`\nMissing overlay for ${missingOverlay.length}:`);
    console.log("  " + missingOverlay.join(", "));
  }

  // Item catalogue is intentionally NOT written here — see header comment.
  // Run `node scripts/build-items-wiki.mjs` to refresh data/items.json.
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
