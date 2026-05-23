#!/usr/bin/env node
// Standalone verifier for lib/dailyBag.ts. Re-implements the same FNV-1a +
// seeded Park-Miller LCG + greedy epoch-list builder and runs constraint
// checks against real pool sizes pulled from data/. Run with:
//   node scripts/verify-daily-bag.mjs
import fs from "node:fs";

const heroes = JSON.parse(fs.readFileSync("data/heroes.json", "utf8"));
const items = JSON.parse(fs.readFileSync("data/items.json", "utf8"));
const soundConvs = JSON.parse(
  fs.readFileSync("data/sound-conversations.json", "utf8"),
);

const EPOCH_SIZE = 38;
const CONSTRAINED_COOLDOWN = 3;
const CUTOVER_BOOTSTRAP_DAYS = 5;

const BAG_CUTOVER_DAY = "2026-06-02";
function dayStringToIndex(day) {
  const [y, m, d] = day.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}
function indexToDayString(idx) {
  return new Date(idx * 86400000).toISOString().slice(0, 10);
}
const BAG_CUTOVER_INDEX = dayStringToIndex(BAG_CUTOVER_DAY);

const answerHeroes = heroes.filter((h) => h && h.key);
const heroesByKey = Object.fromEntries(answerHeroes.map((h) => [h.key, h]));

const abilityPool = answerHeroes.filter(
  (h) => Array.isArray(h.abilities) && h.abilities.filter((a) => a.icon).length > 0,
);
const mugshotPool = answerHeroes.filter((h) => h.splash_url != null);
const itemPool = items.filter((i) => i.icon != null);
const soundPool = soundConvs.filter((c) => {
  const a = heroesByKey[c.speakers[0]];
  const b = heroesByKey[c.speakers[1]];
  return !!a && !!b;
});

const CLASSIC_COOLDOWN = Math.max(0, answerHeroes.length - 1);
const MUGSHOT_COOLDOWN = Math.max(0, mugshotPool.length - 1);
const ITEM_COOLDOWN = Math.max(0, itemPool.length - 1);

function fnv1a(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

function seededShuffle(seed, items) {
  const out = items.slice();
  let s = fnv1a(seed) || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buildEpochList({
  seed,
  epoch,
  pool,
  epochSize,
  cooldownDays,
  getHeroKeys,
  crossModeKeysPerSlot,
  priorHistory = [],
}) {
  if (pool.length === 0) return [];
  const shuffled = seededShuffle(`${seed}:e${epoch}`, pool);
  const result = [];
  const placedKeys = [];
  let cursor = 0;
  for (let slot = 0; slot < epochSize; slot++) {
    const blockedRecent = new Set();
    const effectiveSlot = priorHistory.length + slot;
    const cooldownStart = Math.max(0, effectiveSlot - cooldownDays);
    for (let effI = cooldownStart; effI < effectiveSlot; effI++) {
      const src =
        effI < priorHistory.length
          ? priorHistory[effI]
          : placedKeys[effI - priorHistory.length];
      for (const k of src) blockedRecent.add(k);
    }
    const blockedCross = crossModeKeysPerSlot[slot] ?? new Set();
    const passes = [
      (keys) => keys.some((k) => blockedRecent.has(k) || blockedCross.has(k)),
      (keys) => keys.some((k) => blockedRecent.has(k)),
      () => false,
    ];
    let picked = null;
    for (const isBlocked of passes) {
      for (let step = 0; step < shuffled.length; step++) {
        const idx = (cursor + step) % shuffled.length;
        const cand = shuffled[idx];
        if (!isBlocked(getHeroKeys(cand))) {
          picked = cand;
          cursor = (idx + 1) % shuffled.length;
          break;
        }
      }
      if (picked) break;
    }
    if (!picked) {
      picked = shuffled[cursor];
      cursor = (cursor + 1) % shuffled.length;
    }
    result.push(picked);
    placedKeys.push(new Set(getHeroKeys(picked)));
  }
  return result;
}

const heroKey = (h) => [h.key];
const itemKey = (i) => [i.key];

function legacyClassicKey(day) {
  return answerHeroes[fnv1a(`deadlockle:classic:${day}`) % answerHeroes.length]
    .key;
}
function legacyAbilityKey(day) {
  return abilityPool[fnv1a(`deadlockle:ability:${day}`) % abilityPool.length]
    .key;
}
function legacyMugshotKey(day) {
  return mugshotPool[fnv1a(`deadlockle:mugshot:${day}`) % mugshotPool.length]
    .key;
}
function legacyItemKey(day) {
  return itemPool[fnv1a(`deadlockle:item:${day}`) % itemPool.length].key;
}
function legacySoundKeys(day) {
  if (soundPool.length === 0) return null;
  const c = soundPool[fnv1a(`deadlockle:sound:${day}`) % soundPool.length];
  return [c.speakers[0], c.speakers[1]];
}

function buildCutoverBootstrap(getKeys) {
  const out = [];
  for (let d = CUTOVER_BOOTSTRAP_DAYS; d >= 1; d--) {
    const day = indexToDayString(BAG_CUTOVER_INDEX - d);
    const keys = getKeys(day);
    out.push(new Set(keys ?? []));
  }
  return out;
}

function runEpoch(epoch) {
  const bootstrap = epoch === 0;
  const classic = buildEpochList({
    seed: "deadlockle:classic:bag",
    epoch,
    pool: answerHeroes,
    epochSize: EPOCH_SIZE,
    cooldownDays: CLASSIC_COOLDOWN,
    getHeroKeys: heroKey,
    crossModeKeysPerSlot: [],
    priorHistory: bootstrap
      ? buildCutoverBootstrap((d) => [legacyClassicKey(d)])
      : [],
  });
  const ability = buildEpochList({
    seed: "deadlockle:ability:bag",
    epoch,
    pool: abilityPool,
    epochSize: EPOCH_SIZE,
    cooldownDays: CONSTRAINED_COOLDOWN,
    getHeroKeys: heroKey,
    crossModeKeysPerSlot: classic.map((h) => new Set([h.key])),
    priorHistory: bootstrap
      ? buildCutoverBootstrap((d) => [legacyAbilityKey(d)])
      : [],
  });
  const mugshot = buildEpochList({
    seed: "deadlockle:mugshot:bag",
    epoch,
    pool: mugshotPool,
    epochSize: EPOCH_SIZE,
    cooldownDays: MUGSHOT_COOLDOWN,
    getHeroKeys: heroKey,
    crossModeKeysPerSlot: classic.map(
      (h, i) => new Set([h.key, ability[i].key]),
    ),
    priorHistory: bootstrap
      ? buildCutoverBootstrap((d) => [legacyMugshotKey(d)])
      : [],
  });
  const sound = buildEpochList({
    seed: "deadlockle:sound:bag",
    epoch,
    pool: soundPool,
    epochSize: EPOCH_SIZE,
    cooldownDays: CONSTRAINED_COOLDOWN,
    getHeroKeys: (c) => [c.speakers[0], c.speakers[1]],
    crossModeKeysPerSlot: classic.map(
      (h, i) => new Set([h.key, ability[i].key, mugshot[i].key]),
    ),
    priorHistory: bootstrap
      ? buildCutoverBootstrap((d) => legacySoundKeys(d))
      : [],
  });
  const itemList = buildEpochList({
    seed: "deadlockle:item:bag",
    epoch,
    pool: itemPool,
    epochSize: EPOCH_SIZE,
    cooldownDays: ITEM_COOLDOWN,
    getHeroKeys: itemKey,
    crossModeKeysPerSlot: [],
    priorHistory: bootstrap
      ? buildCutoverBootstrap((d) => [legacyItemKey(d)])
      : [],
  });
  return { classic, ability, mugshot, sound, item: itemList };
}

function checkWithinModeCooldown(list, cooldown, label, keyOf) {
  const violations = [];
  for (let i = 0; i < list.length; i++) {
    const here = keyOf(list[i]);
    for (let j = Math.max(0, i - cooldown); j < i; j++) {
      const there = keyOf(list[j]);
      if (here.some((k) => there.includes(k))) {
        violations.push({ slotA: j, slotB: i, keys: here });
      }
    }
  }
  return { label, violations };
}

function checkCrossMode(classic, ability, mugshot, sound) {
  const violations = [];
  for (let i = 0; i < classic.length; i++) {
    const c = classic[i].key;
    const a = ability[i].key;
    const m = mugshot[i].key;
    const sKeys = [sound[i].speakers[0], sound[i].speakers[1]];
    if (a === c) violations.push({ slot: i, pair: "ability/classic" });
    if (m === c) violations.push({ slot: i, pair: "mugshot/classic" });
    if (m === a) violations.push({ slot: i, pair: "mugshot/ability" });
    if (sKeys.includes(c))
      violations.push({ slot: i, pair: "sound/classic" });
    if (sKeys.includes(a))
      violations.push({ slot: i, pair: "sound/ability" });
    if (sKeys.includes(m))
      violations.push({ slot: i, pair: "sound/mugshot" });
  }
  return violations;
}

function checkFullCoverage(list, poolSize, label, keyOf) {
  const seen = new Set();
  for (const item of list) for (const k of keyOf(item)) seen.add(k);
  return { label, unique: seen.size, total: list.length, poolSize };
}

function checkBootstrapRespected(list, getKey, legacyFn, cooldown, label) {
  const legacyTail = [];
  for (let d = CUTOVER_BOOTSTRAP_DAYS; d >= 1; d--) {
    const day = indexToDayString(BAG_CUTOVER_INDEX - d);
    const k = legacyFn(day);
    if (k != null) legacyTail.push(Array.isArray(k) ? k : [k]);
  }
  const violations = [];
  for (let slot = 0; slot < CUTOVER_BOOTSTRAP_DAYS; slot++) {
    const lookback = Math.max(
      0,
      Math.min(CUTOVER_BOOTSTRAP_DAYS, cooldown - slot),
    );
    if (lookback === 0) continue;
    const start = legacyTail.length - lookback;
    const blocked = new Set();
    for (let i = start; i < legacyTail.length; i++) {
      for (const k of legacyTail[i]) blocked.add(k);
    }
    const here = getKey(list[slot]);
    for (const k of Array.isArray(here) ? here : [here]) {
      if (blocked.has(k)) violations.push({ slot, k });
    }
  }
  return { label, violations };
}

function checkAbilityRotation(epoch, ability) {
  const violations = [];
  const lastByHero = new Map();
  const appearances = new Map();
  for (let i = 0; i < ability.length; i++) {
    const hero = ability[i];
    const eligible = hero.abilities.filter((a) => a.icon);
    if (eligible.length <= 1) continue;
    const count = (appearances.get(hero.key) ?? 0) + 1;
    appearances.set(hero.key, count);
    const order = seededShuffle(
      `deadlockle:ability:sub:e${epoch}:${hero.key}`,
      Array.from({ length: eligible.length }, (_, j) => j),
    );
    const idx = order[(count - 1) % order.length];
    const prev = lastByHero.get(hero.key);
    if (prev != null && prev === idx) {
      violations.push({ slot: i, hero: hero.key });
    }
    lastByHero.set(hero.key, idx);
  }
  return violations;
}

console.log(
  `Pools: classic=${answerHeroes.length} ability=${abilityPool.length} mugshot=${mugshotPool.length} sound=${soundPool.length} item=${itemPool.length}`,
);
console.log(
  `Cooldowns: classic=${CLASSIC_COOLDOWN}, mugshot=${MUGSHOT_COOLDOWN}, item=${ITEM_COOLDOWN}, constrained=${CONSTRAINED_COOLDOWN}, epoch=${EPOCH_SIZE}`,
);
console.log("");

let allClean = true;

for (let epoch = 0; epoch < 4; epoch++) {
  const { classic, ability, mugshot, sound, item } = runEpoch(epoch);

  const cClassic = checkWithinModeCooldown(
    classic,
    CLASSIC_COOLDOWN,
    "classic",
    (h) => [h.key],
  );
  const cAbility = checkWithinModeCooldown(
    ability,
    CONSTRAINED_COOLDOWN,
    "ability",
    (h) => [h.key],
  );
  const cMugshot = checkWithinModeCooldown(
    mugshot,
    MUGSHOT_COOLDOWN,
    "mugshot",
    (h) => [h.key],
  );
  const cSound = checkWithinModeCooldown(
    sound,
    CONSTRAINED_COOLDOWN,
    "sound",
    (c) => [c.speakers[0], c.speakers[1]],
  );
  const cItem = checkWithinModeCooldown(
    item,
    ITEM_COOLDOWN,
    "item",
    (i) => [i.key],
  );

  const crossViolations = checkCrossMode(classic, ability, mugshot, sound);
  const classicCov = checkFullCoverage(
    classic,
    answerHeroes.length,
    "classic",
    (h) => [h.key],
  );
  const mugshotCov = checkFullCoverage(
    mugshot,
    mugshotPool.length,
    "mugshot",
    (h) => [h.key],
  );
  const itemCov = checkFullCoverage(item, itemPool.length, "item", (i) => [
    i.key,
  ]);
  const abilityRot = checkAbilityRotation(epoch, ability);

  const lines = [
    `epoch ${epoch}:`,
    `  classic cooldown=${CLASSIC_COOLDOWN}: ${cClassic.violations.length === 0 ? "OK" : "FAIL " + cClassic.violations.length}`,
    `  ability cooldown=3: ${cAbility.violations.length === 0 ? "OK" : "FAIL " + cAbility.violations.length}`,
    `  mugshot cooldown=${MUGSHOT_COOLDOWN}: ${cMugshot.violations.length === 0 ? "OK" : "FAIL " + cMugshot.violations.length}`,
    `  sound   cooldown=3 (either speaker): ${cSound.violations.length === 0 ? "OK" : "FAIL " + cSound.violations.length}`,
    `  item    cooldown=${ITEM_COOLDOWN}: ${cItem.violations.length === 0 ? "OK" : "FAIL " + cItem.violations.length}`,
    `  cross-mode dedup (Classic/Ability/Mugshot/Sound): ${crossViolations.length === 0 ? "OK" : "FAIL " + crossViolations.length}`,
    `  classic coverage: ${classicCov.unique}/${classicCov.poolSize} heroes in ${EPOCH_SIZE} slots`,
    `  mugshot coverage: ${mugshotCov.unique}/${mugshotCov.poolSize} heroes in ${EPOCH_SIZE} slots`,
    `  item coverage:    ${itemCov.unique}/${itemCov.poolSize} items in ${EPOCH_SIZE} slots`,
    `  ability rotation (no back-to-back same ability): ${abilityRot.length === 0 ? "OK" : "FAIL " + abilityRot.length}`,
  ];

  if (epoch === 0) {
    const bootstrapChecks = [
      checkBootstrapRespected(
        classic,
        (h) => h.key,
        legacyClassicKey,
        CLASSIC_COOLDOWN,
        "classic",
      ),
      checkBootstrapRespected(
        ability,
        (h) => h.key,
        legacyAbilityKey,
        CONSTRAINED_COOLDOWN,
        "ability",
      ),
      checkBootstrapRespected(
        mugshot,
        (h) => h.key,
        legacyMugshotKey,
        MUGSHOT_COOLDOWN,
        "mugshot",
      ),
      checkBootstrapRespected(
        sound,
        (c) => [c.speakers[0], c.speakers[1]],
        legacySoundKeys,
        CONSTRAINED_COOLDOWN,
        "sound",
      ),
      checkBootstrapRespected(
        item,
        (i) => i.key,
        legacyItemKey,
        ITEM_COOLDOWN,
        "item",
      ),
    ];
    for (const b of bootstrapChecks) {
      lines.push(
        `  bootstrap (${b.label}, last ${CUTOVER_BOOTSTRAP_DAYS} legacy days respected): ${b.violations.length === 0 ? "OK" : "FAIL " + b.violations.length}`,
      );
      if (b.violations.length > 0) allClean = false;
    }
  }

  console.log(lines.join("\n"));

  if (
    cClassic.violations.length +
      cAbility.violations.length +
      cMugshot.violations.length +
      cSound.violations.length +
      cItem.violations.length +
      crossViolations.length +
      abilityRot.length >
    0
  )
    allClean = false;
}

console.log(allClean ? "\nALL CONSTRAINTS OK" : "\nVIOLATIONS DETECTED");
process.exit(allClean ? 0 : 1);
