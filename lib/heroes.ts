import heroesData from "@/data/heroes.json";

// Deadlock hero archetype as exposed by the API. Used as a clean categorical
// attribute in Classic mode (4 buckets — perfect tile granularity).
export type HeroType = "marksman" | "mystic" | "brawler" | "assassin";

// Hand-curated overlay fields (not in the API).
export type Gender = "male" | "female" | "non-binary" | "male & female";
export type Nature = "human" | "undead" | "spirit" | "beast" | "robot" | "mystical" | "ixian";
export type DamageStyle = "hitscan" | "projectile" | "hybrid" | "melee";
// Refinement of Valve's 4-bucket hero_type — Deadlockle-authored.
export type SubRole =
  | "sniper"
  | "carry"
  | "skirmisher"
  | "diver"
  | "bruiser"
  | "tank"
  | "mage"
  | "support";
// Where a hero's damage comes from in team fights.
export type DamageSource = "weapon" | "spirit" | "hybrid";

export type Ability = {
  name: string;
  description: string | null;
  // Self-hosted PNG path under /public, or null if the source had no image.
  icon: string | null;
  sourceImage: string | null;
};

export type Hero = {
  key: string;
  id: number;
  class_name: string;
  name: string;
  hero_type: HeroType | null;
  gun_tag: string | null;
  tags: string[];
  complexity: number | null;
  hp: number | null;
  move_speed: number | null;
  stamina: number | null;
  lore: string | null;
  role: string | null;
  // overlay
  gender: Gender | null;
  nature: Nature | null;
  damage_style: DamageStyle | null;
  sub_role: SubRole | null;
  damage_source: DamageSource | null;
  // assets
  abilities: Ability[];
  portrait_url: string | null;
  // Mugshot art. `splash_url` is the legacy critical-health crop (kept for
  // back-compat and as the fallback). `splash_variants` holds the three
  // Deadlock hero-card states so Mugshot can rotate which one it shows per
  // day; `critical` reuses the `splash_url` file. Null on heroes with no crop.
  splash_url: string | null;
  splash_variants: {
    normal: string | null;
    critical: string | null;
    gloat: string | null;
  } | null;
};

export const HEROES: Hero[] = heroesData as Hero[];

export const HEROES_BY_KEY: Record<string, Hero> = Object.fromEntries(
  HEROES.map((h) => [h.key, h]),
);

// Heroes with complete attribute data — eligible to be the daily answer for
// any mode that compares attributes. Heroes missing overlay still appear in
// autocomplete so they can be guessed.
export const ANSWER_POOL: Hero[] = HEROES.filter(
  (h) =>
    h.hero_type != null &&
    h.gun_tag != null &&
    h.hp != null &&
    h.move_speed != null &&
    h.stamina != null &&
    h.gender != null &&
    h.nature != null &&
    h.sub_role != null &&
    h.damage_source != null,
);
