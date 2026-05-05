import { ANSWER_POOL, HEROES_BY_KEY, type Ability, type Hero } from "./heroes";
import { ITEM_ANSWER_POOL, type Item } from "./items";
import { CONVERSATIONS, type Conversation } from "./conversations";
import { hasVoiceClips, pickClip, type VoiceClip } from "./voicelines";

// Returns the UTC date string YYYY-MM-DD for a given Date (default: now).
export function dayString(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
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

export function getHeroForDay(day: string): Hero {
  if (ANSWER_POOL.length === 0) {
    throw new Error("ANSWER_POOL is empty — check data/heroes.json");
  }
  const idx = fnv1a(`deadlockle:classic:${day}`) % ANSWER_POOL.length;
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
  const heroIdx = fnv1a(`deadlockle:ability:${day}`) % ABILITY_POOL.length;
  const hero = ABILITY_POOL[heroIdx];
  const eligible = hero.abilities.filter((a) => a.icon);
  const abIdx = fnv1a(`deadlockle:ability:${day}:idx`) % eligible.length;
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
  const heroIdx = fnv1a(`deadlockle:mugshot:${day}`) % MUGSHOT_POOL.length;
  const hero = MUGSHOT_POOL[heroIdx];
  return { hero, imageUrl: hero.splash_url! };
}

export function getItemForDay(day: string): { item: Item; iconUrl: string } {
  if (ITEM_ANSWER_POOL.length === 0) {
    throw new Error("ITEM_ANSWER_POOL is empty");
  }
  const idx = fnv1a(`deadlockle:item:${day}`) % ITEM_ANSWER_POOL.length;
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
  const idx = fnv1a(`deadlockle:quote:${day}`) % CONVERSATION_POOL.length;
  const conv = CONVERSATION_POOL[idx];
  return {
    conversation: conv,
    speakers: [
      HEROES_BY_KEY[conv.speakers[0]]!,
      HEROES_BY_KEY[conv.speakers[1]]!,
    ],
  };
}

// Sound mode reuses the Quote pool (curated two-speaker conversations),
// but only conversations whose BOTH speakers have voice clips on file.
// We skip whichever conversation Quote already picked for today so a
// player won't see the same exchange twice on the same day.
const SOUND_CONVERSATION_POOL: Conversation[] = CONVERSATION_POOL.filter(
  (c) => hasVoiceClips(c.speakers[0]) && hasVoiceClips(c.speakers[1]),
);

export function getSoundForDay(day: string): {
  conversation: Conversation;
  speakers: [Hero, Hero];
  // For each line in conversation.lines, the clip that should play when
  // that line's audio button is unlocked. Indexed by line position.
  clips: (VoiceClip | null)[];
} {
  if (SOUND_CONVERSATION_POOL.length === 0) {
    throw new Error("SOUND_CONVERSATION_POOL is empty");
  }

  // Pick this puzzle's conversation. If our raw pick collides with what
  // Quote mode chose today, slide forward by one — a single offset is
  // enough because the pools differ only by the audio-coverage filter.
  let idx = fnv1a(`deadlockle:sound:${day}`) % SOUND_CONVERSATION_POOL.length;
  const quotePick = CONVERSATION_POOL.length
    ? CONVERSATION_POOL[fnv1a(`deadlockle:quote:${day}`) % CONVERSATION_POOL.length]
    : null;
  if (quotePick && SOUND_CONVERSATION_POOL[idx] === quotePick) {
    idx = (idx + 1) % SOUND_CONVERSATION_POOL.length;
  }

  const conv = SOUND_CONVERSATION_POOL[idx];
  const speakers: [Hero, Hero] = [
    HEROES_BY_KEY[conv.speakers[0]]!,
    HEROES_BY_KEY[conv.speakers[1]]!,
  ];

  // Per-line clip pick: seed by (day, speakerKey, lineIdx) so each play
  // button gets a distinct sample of that speaker's voice. Same daily
  // seed always yields the same clip for the same line.
  const clips = conv.lines.map((line, i) => {
    const speakerKey = conv.speakers[line.speaker];
    const seed = fnv1a(`deadlockle:sound:${day}:${speakerKey}:${i}`);
    return pickClip(speakerKey, seed);
  });

  return { conversation: conv, speakers, clips };
}

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
