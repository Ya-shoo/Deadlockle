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
  /** Hidden from public navigation/listings/sitemap; only reachable in dev
   *  builds. Use for archived modes we want to keep around for reference
   *  without surfacing to players. */
  devOnly?: boolean;
};

// True when this build can show dev-only modes. `next dev` exposes them;
// `next build` (production export shipped to Cloudflare Pages) hides them.
export const IS_DEV_BUILD = process.env.NODE_ENV !== "production";

// Canonical play order. Item replaces Map (Deadlock has only one map). New
// modes go here in the position users should encounter them. Changing the
// order changes the suggested-next progression across the entire app.
//
// Quote is archived: Conversation (slug "sound") supersedes it — same
// two-speaker puzzle plus audio. Kept dev-only so the route + game still
// work locally for reference. Do not surface in production listings.
const ALL_MODES: ModeDef[] = [
  {
    slug: "classic",
    label: "Classic",
    blurb: "Type a hero, get attribute match tiles. Eight categories.",
    built: true,
  },
  {
    slug: "quote",
    label: "Quote",
    blurb: "One hero is addressing another. Identify both.",
    built: true,
    devOnly: true,
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
    label: "Conversation",
    blurb:
      "Try to guess which two characters are having a conversation :D More dialogue is revealed as you go.",
    built: true,
  },
  {
    slug: "item",
    label: "Item",
    blurb: "A blurred item icon. Sharpens with each guess.",
    built: true,
  },
];

// Public modes — always excludes devOnly entries. Used everywhere the
// player-facing grid, completion counter, sitemap, and next-mode CTA pull
// from. Archive remains accessible only via the dev-only toggle below.
export const MODES: ModeDef[] = ALL_MODES.filter((m) => !m.devOnly);

// Dev-only archive. Empty in production builds so the JSON literal isn't
// shipped to players and any UI gated on `.length > 0` collapses to nothing.
export const ARCHIVED_MODES: ModeDef[] = IS_DEV_BUILD
  ? ALL_MODES.filter((m) => m.devOnly)
  : [];

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

// First built mode the player hasn't finished yet, in canonical play order.
// `current` is excluded automatically — the caller has just finished it,
// so we never recommend it back to them.
//
// Walking from canonical position 0 (rather than from `current` forward)
// is intentional: if a player jumps ahead and clears a later mode, the
// next CTA pulls them back to the earliest unfinished mode so they still
// experience modes in their designed order. Returns null when every
// built mode is done — that's the cue to show the all-done state.
export function nextUnfinishedMode(
  current: ModeSlug,
  done: ReadonlySet<ModeSlug>,
): ModeDef | null {
  for (const m of MODES) {
    if (!m.built) continue;
    if (m.slug === current) continue;
    if (done.has(m.slug)) continue;
    return m;
  }
  return null;
}
