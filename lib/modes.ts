export type ModeSlug =
  | "classic"
  | "quote"
  | "ability"
  | "mugshot"
  | "sound"
  | "item";

export type ModeDef = {
  slug: ModeSlug;
  label: string;
  blurb: string;
  built: boolean;
};

// Canonical play order. Item replaces Map (Deadlock has only one map). New
// modes go here in the position users should encounter them. Changing the
// order changes the suggested-next progression across the entire app.
export const MODES: ModeDef[] = [
  {
    slug: "classic",
    label: "Classic",
    blurb: "Type a hero, get attribute-match tiles. Eight categories.",
    built: true,
  },
  {
    slug: "quote",
    label: "Quote",
    blurb: "One hero is addressing another. Identify both.",
    built: true,
  },
  {
    slug: "ability",
    label: "Ability",
    blurb: "An ability icon, gradually revealed. Which hero?",
    built: true,
  },
  {
    slug: "mugshot",
    label: "Mugshot",
    blurb: "A cropped portrait. The camera pulls back with each guess.",
    built: true,
  },
  {
    slug: "sound",
    label: "Sound",
    blurb:
      "A two-speaker conversation. Voice samples unlock late if you get stuck.",
    built: true,
  },
  {
    slug: "item",
    label: "Item",
    blurb: "A blurred item icon. Sharpens with each guess.",
    built: true,
  },
];

export const BUILT_MODE_SLUGS: ModeSlug[] = MODES.filter((m) => m.built).map(
  (m) => m.slug,
);

export function getMode(slug: string): ModeDef | null {
  return MODES.find((m) => m.slug === slug) ?? null;
}

// Next built mode in canonical order. Returns null when there are no more
// built modes after `current` — that's the cue to show the all-done state.
export function nextBuiltMode(current: ModeSlug): ModeDef | null {
  const idx = MODES.findIndex((m) => m.slug === current);
  if (idx < 0) return null;
  for (let i = idx + 1; i < MODES.length; i++) {
    if (MODES[i].built) return MODES[i];
  }
  return null;
}
