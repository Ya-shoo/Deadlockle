import { ANSWER_POOL, HEROES_BY_KEY, type Hero } from "./heroes";
import { ITEM_ANSWER_POOL, type Item } from "./items";
import {
  SOUND_CONVERSATIONS,
  type SoundConversation,
} from "./sound-conversations";

// First Pacific puzzle day that uses the bag-shuffled picker. Days strictly
// before this keep the legacy hash-modulo logic in lib/daily.ts so any
// historical "yesterday's answer" surfaces don't shift retroactively. Days
// flagged in DAY_ROTATION also fall back to legacy (the manual re-roll
// knob still works, just bypasses the bag).
export const BAG_CUTOVER_DAY = "2026-06-02";

// Epoch length = hero pool size so Classic + Mugshot rotate through the
// full roster exactly once per epoch. If the roster grows past 38, revisit
// whether to grow EPOCH_SIZE in lockstep (preserves full-roster semantic)
// or pin it (one hero rotates out per cycle).
const EPOCH_SIZE = 38;
const CONSTRAINED_COOLDOWN = 3;
const CUTOVER_BOOTSTRAP_DAYS = 5;

const ABILITY_POOL: Hero[] = ANSWER_POOL.filter(
  (h) => h.abilities.filter((a) => a.icon).length > 0,
);
const MUGSHOT_POOL: Hero[] = ANSWER_POOL.filter((h) => h.splash_url != null);
const SOUND_POOL: SoundConversation[] = SOUND_CONVERSATIONS.filter((c) => {
  const a = HEROES_BY_KEY[c.speakers[0]];
  const b = HEROES_BY_KEY[c.speakers[1]];
  return !!a && !!b && ANSWER_POOL.includes(a) && ANSWER_POOL.includes(b);
});

// Classic + Mugshot: cooldown = poolSize - 1 forces each hero to appear at
// most once per epoch (full rotation). Item: same shape, but indexed against
// a 155-item pool with cooldown 154 (one full rotation every 155 days).
const CLASSIC_COOLDOWN = Math.max(0, ANSWER_POOL.length - 1);
const MUGSHOT_COOLDOWN = Math.max(0, MUGSHOT_POOL.length - 1);
const ITEM_COOLDOWN = Math.max(0, ITEM_ANSWER_POOL.length - 1);

function dayStringToIndex(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

function indexToDayString(idx: number): string {
  return new Date(idx * 86400000).toISOString().slice(0, 10);
}

const BAG_CUTOVER_INDEX = dayStringToIndex(BAG_CUTOVER_DAY);

export function usesBag(day: string): boolean {
  return dayStringToIndex(day) >= BAG_CUTOVER_INDEX;
}

function getBagPosition(day: string): { epoch: number; slot: number } {
  const idx = dayStringToIndex(day) - BAG_CUTOVER_INDEX;
  if (idx < 0) {
    throw new Error(`day ${day} is before bag cutover ${BAG_CUTOVER_DAY}`);
  }
  return { epoch: Math.floor(idx / EPOCH_SIZE), slot: idx % EPOCH_SIZE };
}

function fnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

function seededShuffle<T>(seed: string, items: readonly T[]): T[] {
  const out = items.slice();
  let s = fnv1a(seed) || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const epochCache = new Map<string, unknown>();
function memoize<T>(key: string, build: () => T): T {
  if (epochCache.has(key)) return epochCache.get(key) as T;
  const val = build();
  epochCache.set(key, val);
  return val;
}

// Greedy epoch-list builder. See lib/dailyBag.ts in OWdle for the original;
// the logic here is identical, parameterized for Deadlockle's pool shapes.
// Three-pass fallback: strict → relax cross-mode → relax everything.
function buildEpochList<T>(opts: {
  seed: string;
  epoch: number;
  pool: readonly T[];
  epochSize: number;
  cooldownDays: number;
  getHeroKeys: (item: T) => string[];
  crossModeKeysPerSlot: ReadonlyArray<ReadonlySet<string>>;
  priorHistory?: ReadonlyArray<ReadonlySet<string>>;
}): T[] {
  const {
    seed,
    epoch,
    pool,
    epochSize,
    cooldownDays,
    getHeroKeys,
    crossModeKeysPerSlot,
  } = opts;
  const priorHistory = opts.priorHistory ?? [];
  if (pool.length === 0) return [];

  const shuffled = seededShuffle(`${seed}:e${epoch}`, pool);
  const result: T[] = [];
  const placedKeys: Set<string>[] = [];
  let cursor = 0;

  for (let slot = 0; slot < epochSize; slot++) {
    const blockedRecent = new Set<string>();
    const effectiveSlot = priorHistory.length + slot;
    const cooldownStart = Math.max(0, effectiveSlot - cooldownDays);
    for (let effI = cooldownStart; effI < effectiveSlot; effI++) {
      const src =
        effI < priorHistory.length
          ? priorHistory[effI]
          : placedKeys[effI - priorHistory.length];
      for (const k of src) blockedRecent.add(k);
    }
    const blockedCross = crossModeKeysPerSlot[slot] ?? new Set<string>();

    const passes: Array<(keys: string[]) => boolean> = [
      (keys) => keys.some((k) => blockedRecent.has(k) || blockedCross.has(k)),
      (keys) => keys.some((k) => blockedRecent.has(k)),
      () => false,
    ];

    let picked: T | null = null;
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

const heroKey = (h: Hero): string[] => [h.key];
const itemKey = (i: Item): string[] => [i.key];

// Legacy hero/item pickers used only at cutover to seed each mode's
// bootstrap priorHistory. Mirror the salted hash-modulo logic in
// lib/daily.ts but skip the salt — DAY_ROTATION on bootstrap days would
// be an unusual edge case and the salt only matters for that day's pick,
// not for what it blocks downstream. Sub-puzzle indices (ability, etc.)
// aren't needed; only the hero identity affects cooldown.
function legacyClassicKey(day: string): string {
  return ANSWER_POOL[fnv1a(`deadlockle:classic:${day}`) % ANSWER_POOL.length]
    .key;
}
function legacyAbilityKey(day: string): string {
  return ABILITY_POOL[fnv1a(`deadlockle:ability:${day}`) % ABILITY_POOL.length]
    .key;
}
function legacyMugshotKey(day: string): string {
  return MUGSHOT_POOL[fnv1a(`deadlockle:mugshot:${day}`) % MUGSHOT_POOL.length]
    .key;
}
function legacyItemKey(day: string): string {
  return ITEM_ANSWER_POOL[
    fnv1a(`deadlockle:item:${day}`) % ITEM_ANSWER_POOL.length
  ].key;
}
function legacySoundKeys(day: string): [string, string] | null {
  if (SOUND_POOL.length === 0) return null;
  const c = SOUND_POOL[fnv1a(`deadlockle:sound:${day}`) % SOUND_POOL.length];
  return [c.speakers[0], c.speakers[1]];
}

function buildCutoverBootstrap(
  getKeysForDay: (day: string) => readonly string[] | null,
): ReadonlySet<string>[] {
  const out: Set<string>[] = [];
  for (let d = CUTOVER_BOOTSTRAP_DAYS; d >= 1; d--) {
    const day = indexToDayString(BAG_CUTOVER_INDEX - d);
    const keys = getKeysForDay(day);
    out.push(new Set(keys ?? []));
  }
  return out;
}

// ─── Per-mode epoch lists ─────────────────────────────────────────────

function classicEpochList(epoch: number): Hero[] {
  return memoize(`classic:${epoch}`, () =>
    buildEpochList({
      seed: "deadlockle:classic:bag",
      epoch,
      pool: ANSWER_POOL,
      epochSize: EPOCH_SIZE,
      cooldownDays: CLASSIC_COOLDOWN,
      getHeroKeys: heroKey,
      crossModeKeysPerSlot: [],
      priorHistory:
        epoch === 0
          ? buildCutoverBootstrap((day) => [legacyClassicKey(day)])
          : undefined,
    }),
  );
}

function abilityEpochList(epoch: number): Hero[] {
  return memoize(`ability:${epoch}`, () => {
    const classic = classicEpochList(epoch);
    const cross = classic.map((h) => new Set([h.key]));
    return buildEpochList({
      seed: "deadlockle:ability:bag",
      epoch,
      pool: ABILITY_POOL,
      epochSize: EPOCH_SIZE,
      cooldownDays: CONSTRAINED_COOLDOWN,
      getHeroKeys: heroKey,
      crossModeKeysPerSlot: cross,
      priorHistory:
        epoch === 0
          ? buildCutoverBootstrap((day) => [legacyAbilityKey(day)])
          : undefined,
    });
  });
}

function mugshotEpochList(epoch: number): Hero[] {
  return memoize(`mugshot:${epoch}`, () => {
    const classic = classicEpochList(epoch);
    const ability = abilityEpochList(epoch);
    const cross = classic.map((h, i) => new Set([h.key, ability[i].key]));
    return buildEpochList({
      seed: "deadlockle:mugshot:bag",
      epoch,
      pool: MUGSHOT_POOL,
      epochSize: EPOCH_SIZE,
      cooldownDays: MUGSHOT_COOLDOWN,
      getHeroKeys: heroKey,
      crossModeKeysPerSlot: cross,
      priorHistory:
        epoch === 0
          ? buildCutoverBootstrap((day) => [legacyMugshotKey(day)])
          : undefined,
    });
  });
}

function soundEpochList(epoch: number): SoundConversation[] {
  return memoize(`sound:${epoch}`, () => {
    const classic = classicEpochList(epoch);
    const ability = abilityEpochList(epoch);
    const mugshot = mugshotEpochList(epoch);
    const cross = classic.map(
      (h, i) => new Set([h.key, ability[i].key, mugshot[i].key]),
    );
    return buildEpochList({
      seed: "deadlockle:sound:bag",
      epoch,
      pool: SOUND_POOL,
      epochSize: EPOCH_SIZE,
      cooldownDays: CONSTRAINED_COOLDOWN,
      getHeroKeys: (c) => [c.speakers[0], c.speakers[1]],
      crossModeKeysPerSlot: cross,
      priorHistory:
        epoch === 0
          ? buildCutoverBootstrap((day) => legacySoundKeys(day))
          : undefined,
    });
  });
}

// Item bag is independent of hero modes (items aren't heroes), so no
// cross-mode dedup chain — just its own 154-day rotation.
function itemEpochList(epoch: number): Item[] {
  return memoize(`item:${epoch}`, () =>
    buildEpochList({
      seed: "deadlockle:item:bag",
      epoch,
      pool: ITEM_ANSWER_POOL,
      epochSize: EPOCH_SIZE,
      cooldownDays: ITEM_COOLDOWN,
      getHeroKeys: itemKey,
      crossModeKeysPerSlot: [],
      priorHistory:
        epoch === 0
          ? buildCutoverBootstrap((day) => [legacyItemKey(day)])
          : undefined,
    }),
  );
}

function appearanceCountInEpoch<T>(
  list: readonly T[],
  slot: number,
  matches: (item: T) => boolean,
): number {
  let count = 0;
  for (let i = 0; i <= slot; i++) {
    if (matches(list[i])) count++;
  }
  return count;
}

function abilitySubPuzzleOrder(epoch: number, hero: Hero): number[] {
  const eligible = hero.abilities.filter((a) => a.icon);
  const n = eligible.length;
  if (n <= 1) return Array.from({ length: n }, (_, i) => i);
  return memoize(`ability:sub:${epoch}:${hero.key}`, () =>
    seededShuffle(
      `deadlockle:ability:sub:e${epoch}:${hero.key}`,
      Array.from({ length: n }, (_, i) => i),
    ),
  );
}

// ─── Per-mode resolvers ────────────────────────────────────────────────

export function bagClassicHero(day: string): Hero {
  const { epoch, slot } = getBagPosition(day);
  return classicEpochList(epoch)[slot];
}

export function bagAbilityPick(day: string): {
  hero: Hero;
  abilityIndex: number;
} {
  const { epoch, slot } = getBagPosition(day);
  const list = abilityEpochList(epoch);
  const hero = list[slot];
  const appearance = appearanceCountInEpoch(
    list,
    slot,
    (h) => h.key === hero.key,
  );
  const order = abilitySubPuzzleOrder(epoch, hero);
  const eligible = hero.abilities.filter((a) => a.icon);
  const eligibleIdx = order[(appearance - 1) % Math.max(1, order.length)];
  const ability = eligible[eligibleIdx];
  return { hero, abilityIndex: hero.abilities.indexOf(ability) };
}

export function bagMugshotHero(day: string): Hero {
  const { epoch, slot } = getBagPosition(day);
  return mugshotEpochList(epoch)[slot];
}

export function bagItemPick(day: string): Item {
  const { epoch, slot } = getBagPosition(day);
  return itemEpochList(epoch)[slot];
}

export function bagSoundConversation(day: string): SoundConversation {
  const { epoch, slot } = getBagPosition(day);
  return soundEpochList(epoch)[slot];
}
