import { ANSWER_POOL, HEROES_BY_KEY, type Ability, type Hero } from "./heroes";
import { ITEM_ANSWER_POOL, type Item } from "./items";
import { CONVERSATIONS, type Conversation } from "./conversations";
import {
  SOUND_CONVERSATIONS,
  type SoundConversation,
} from "./sound-conversations";
import {
  usesBag,
  bagClassicHero,
  bagAbilityPick,
  bagMugshotHero,
  bagItemPick,
  bagSoundConversation,
} from "./dailyBag";

// Daily puzzles roll over at 2:15am Pacific Time (America/Los_Angeles).
// DST-aware: the actual UTC moment shifts between 10:15 UTC in winter (PST,
// UTC-8) and 09:15 UTC in summer (PDT, UTC-7). All day strings and seeds
// downstream of dayString() are therefore "Pacific puzzle days," not UTC
// calendar days.
const RESET_HOUR_PT = 2;
const RESET_MIN_PT = 15;
const RESET_TZ = "America/Los_Angeles";

// Returns the Pacific puzzle-day string YYYY-MM-DD for a given Date
// (default: now). The puzzle day rolls over at 2:15am Pacific, so the
// hours between Pacific midnight and 2:15am still belong to the previous
// puzzle day.
export function dayString(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: RESET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "0";
  const y = parseInt(get("year"), 10);
  const mo = parseInt(get("month"), 10);
  const da = parseInt(get("day"), 10);
  const h = parseInt(get("hour"), 10);
  const mi = parseInt(get("minute"), 10);

  const beforeReset =
    h < RESET_HOUR_PT || (h === RESET_HOUR_PT && mi < RESET_MIN_PT);
  const dayShift = beforeReset ? -1 : 0;
  return new Date(Date.UTC(y, mo - 1, da + dayShift))
    .toISOString()
    .slice(0, 10);
}

// FNV-1a 32-bit string hash. Deterministic, fast, well-distributed enough
// to seed a daily index.
function fnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

// Manual rotation knob — bump the counter for a given Pacific puzzle day
// to advance every mode's pick to the next deterministic answer for that
// day. Used when a daily answer needs to change after the fact (e.g.
// duplicate from a recent day, accidental spoiler).
const DAY_ROTATION: Record<string, number> = {
  "2026-05-08": 1,
};

function salt(day: string): string {
  const r = DAY_ROTATION[day] ?? 0;
  return r > 0 ? `:r${r}` : "";
}

// Bag path is taken when both:
//   - day is at or after BAG_CUTOVER_DAY (handled by usesBag)
//   - no manual DAY_ROTATION entry for this day (rotation > 0 means a
//     human-intervened re-roll, so fall back to the salted legacy hash)
function shouldUseBag(day: string): boolean {
  return usesBag(day) && !(DAY_ROTATION[day] ?? 0);
}

export function getHeroForDay(day: string): Hero {
  if (ANSWER_POOL.length === 0) {
    throw new Error("ANSWER_POOL is empty — check data/heroes.json");
  }
  if (shouldUseBag(day)) return bagClassicHero(day);
  const idx = fnv1a(`deadlockle:classic:${day}${salt(day)}`) % ANSWER_POOL.length;
  return ANSWER_POOL[idx];
}

export function todaysHero(): Hero {
  return getHeroForDay(dayString());
}

const ABILITY_POOL: Hero[] = ANSWER_POOL.filter(
  (h) => h.abilities.filter((a) => a.icon).length > 0,
);
// Mugshot mode pool — heroes with a smartcropped hero portrait. Field is
// still named `splash_url` in the data because it predates the mode rename;
// the underlying art is the same hero card crop either way.
const MUGSHOT_POOL: Hero[] = ANSWER_POOL.filter((h) => h.splash_url != null);

export function getAbilityForDay(day: string): {
  hero: Hero;
  ability: Ability;
  abilityIndex: number;
} {
  if (ABILITY_POOL.length === 0) {
    throw new Error("ABILITY_POOL is empty");
  }
  if (shouldUseBag(day)) {
    const { hero, abilityIndex } = bagAbilityPick(day);
    return { hero, ability: hero.abilities[abilityIndex], abilityIndex };
  }
  const heroIdx = fnv1a(`deadlockle:ability:${day}${salt(day)}`) % ABILITY_POOL.length;
  const hero = ABILITY_POOL[heroIdx];
  const eligible = hero.abilities.filter((a) => a.icon);
  const abIdx = fnv1a(`deadlockle:ability:${day}${salt(day)}:idx`) % eligible.length;
  const ability = eligible[abIdx];
  return {
    hero,
    ability,
    abilityIndex: hero.abilities.indexOf(ability),
  };
}

export function getMugshotForDay(day: string): {
  hero: Hero;
  imageUrl: string;
} {
  if (MUGSHOT_POOL.length === 0) {
    throw new Error("MUGSHOT_POOL is empty");
  }
  if (shouldUseBag(day)) {
    const hero = bagMugshotHero(day);
    return { hero, imageUrl: hero.splash_url! };
  }
  const heroIdx = fnv1a(`deadlockle:mugshot:${day}${salt(day)}`) % MUGSHOT_POOL.length;
  const hero = MUGSHOT_POOL[heroIdx];
  return { hero, imageUrl: hero.splash_url! };
}

export function getItemForDay(day: string): { item: Item; iconUrl: string } {
  if (ITEM_ANSWER_POOL.length === 0) {
    throw new Error("ITEM_ANSWER_POOL is empty");
  }
  if (shouldUseBag(day)) {
    const item = bagItemPick(day);
    return { item, iconUrl: item.icon! };
  }
  const idx = fnv1a(`deadlockle:item:${day}${salt(day)}`) % ITEM_ANSWER_POOL.length;
  const item = ITEM_ANSWER_POOL[idx];
  return { item, iconUrl: item.icon! };
}

// Conversations whose BOTH heroes are in the answer pool — guarantees the
// hero combobox can produce both as guesses.
const CONVERSATION_POOL: Conversation[] = CONVERSATIONS.filter((c) => {
  const a = HEROES_BY_KEY[c.speakers[0]];
  const b = HEROES_BY_KEY[c.speakers[1]];
  return !!a && !!b && ANSWER_POOL.includes(a) && ANSWER_POOL.includes(b);
});

export function getConversationForDay(day: string): {
  conversation: Conversation;
  speakers: [Hero, Hero];
} {
  if (CONVERSATION_POOL.length === 0) {
    throw new Error("CONVERSATION_POOL is empty");
  }
  const idx = fnv1a(`deadlockle:quote:${day}${salt(day)}`) % CONVERSATION_POOL.length;
  const conv = CONVERSATION_POOL[idx];
  return {
    conversation: conv,
    speakers: [
      HEROES_BY_KEY[conv.speakers[0]]!,
      HEROES_BY_KEY[conv.speakers[1]]!,
    ],
  };
}

// Conversation mode pool — wiki-sourced exchanges with matching audio.
// Filtered to ensure both speakers are also in the Classic answer pool
// so the hero combobox can produce both as guesses.
const SOUND_CONVERSATION_POOL: SoundConversation[] = SOUND_CONVERSATIONS.filter(
  (c) => {
    const a = HEROES_BY_KEY[c.speakers[0]];
    const b = HEROES_BY_KEY[c.speakers[1]];
    return !!a && !!b && ANSWER_POOL.includes(a) && ANSWER_POOL.includes(b);
  },
);

export function getSoundForDay(day: string): {
  conversation: SoundConversation;
  speakers: [Hero, Hero];
} {
  if (SOUND_CONVERSATION_POOL.length === 0) {
    throw new Error("SOUND_CONVERSATION_POOL is empty");
  }
  if (shouldUseBag(day)) {
    const conv = bagSoundConversation(day);
    return {
      conversation: conv,
      speakers: [
        HEROES_BY_KEY[conv.speakers[0]]!,
        HEROES_BY_KEY[conv.speakers[1]]!,
      ],
    };
  }

  const idx = fnv1a(`deadlockle:sound:${day}${salt(day)}`) % SOUND_CONVERSATION_POOL.length;
  return getSoundByIndex(idx);
}

// Direct-index access into the conversation pool. Only used by the dev-only
// `?conv=N` rotation toolbar in SoundGame for QA — exposed here so the
// pool stays a single source of truth.
export function getSoundByIndex(idx: number): {
  conversation: SoundConversation;
  speakers: [Hero, Hero];
} {
  const wrapped =
    ((idx % SOUND_CONVERSATION_POOL.length) + SOUND_CONVERSATION_POOL.length) %
    SOUND_CONVERSATION_POOL.length;
  const conv = SOUND_CONVERSATION_POOL[wrapped];
  const speakers: [Hero, Hero] = [
    HEROES_BY_KEY[conv.speakers[0]]!,
    HEROES_BY_KEY[conv.speakers[1]]!,
  ];
  return { conversation: conv, speakers };
}

export const SOUND_POOL_SIZE = SOUND_CONVERSATION_POOL.length;

// Re-exported for symmetry with OWdle. Keeps lookups by key cheap.
export { HEROES_BY_KEY };

// Deterministic permutation of [0, total). Same `seed` always produces
// the same shuffle. Used by Ability mode to pick a per-day reveal order.
export function shuffleOrder(seed: string, total: number): number[] {
  const out = Array.from({ length: total }, (_, i) => i);
  let s = fnv1a(seed) || 1;
  for (let i = total - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Human-readable date for display in UI.
export function prettyDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
