// Current-streak → Deadlock ranked-ladder tier mapping. Powers the
// StreakRankBadge in the header and the StreakRankModal celebration.
// Ported from OWdle (its repo at ../OWdle is the canonical reference —
// keep the two implementations in lockstep when tuning either).
//
// The three tiers are the top of Deadlock's real 11-rank ladder
// (Eternus > Ascendant > Phantom), so the prestige order reads
// natively to Deadlock players. Badge art + official tier colors come
// from the deadlock-api.com assets API (cited in the home footer).
//
// A streak tier is earned only when the player clears BOTH gates:
//   1. Percentile  — their current streak is in the top N% of the pool
//      (pool = distinct players who finished a daily in the last 30 days,
//      ranked by current streak; see functions/api/stats/streaks.ts).
//   2. Floor       — their current streak meets an absolute minimum.
// Net requirement per tier = max(percentile cutoff, floor). The floors
// bind while the app is young and top streaks are small (nobody should
// be Eternus at a 6-day streak just because they're #1 of a small
// pool); the percentile takes over once streaks grow past the floors.

// Top → bottom. Order matters: streakTierFor walks this list and returns
// the first (highest) tier the player clears.
export const STREAK_TIERS = ["eternus", "ascendant", "phantom"] as const;

export type StreakTier = (typeof STREAK_TIERS)[number];

// Percentile band per tier (inclusive). eternus = top 1%, ascendant =
// top 5%, phantom = top 10%. Nothing below 10% earns a streak rank.
// Same bands as OWdle's top500/champion/grandmaster.
export const STREAK_TIER_PERCENTILE_MAX: Record<StreakTier, number> = {
  eternus: 1,
  ascendant: 5,
  phantom: 10,
};

// Absolute minimum current streak (days) per tier. Yash spec — identical
// to OWdle's floors (the two sites' streak distributions are nearly the
// same). Prevents an un-prestigious rank when the pool is small or top
// streaks are still low.
export const STREAK_TIER_FLOOR: Record<StreakTier, number> = {
  eternus: 15,
  ascendant: 10,
  phantom: 7,
};

// Display label per tier. Deadlock rank names are self-labeling — copy
// reads "You stand Eternus among Deadlockle streak holders."
export const STREAK_TIER_LABEL: Record<StreakTier, string> = {
  eternus: "Eternus",
  ascendant: "Ascendant",
  phantom: "Phantom",
};

// UI accent per tier — drives the modal card's tint/border, the
// tier-name text, and the CTA fill, so each rank reads with its own
// color identity (emerald / gold / silver). Gold + silver are the
// official assets-API tier colors (Phantom's #7C7C7C nudged lighter
// for dark-bg legibility). Eternus deliberately is NOT its official
// mint (#5CE9A9): mint chrome on the teal site surface read as mud
// (and a violet complement was tried and rejected) — a rich emerald,
// distinctly green rather than teal-leaning, is Yash's pick.
export const STREAK_TIER_ACCENT: Record<StreakTier, string> = {
  eternus: "#2fd36f",
  ascendant: "#c39751",
  phantom: "#b9c2cf",
};

// Streak value at each band's percentile cutoff, computed server-side from
// the pool's current-streak distribution. cutoffs.eternus is the streak at
// the 99th percentile (top-1% threshold), ascendant the 95th, phantom the
// 90th. A player whose current streak ≥ cutoffs.eternus is in the top 1%
// by streak length. Pre-reduced to three cutoffs on the server since
// there are only three bands.
export type StreakCutoffs = {
  eternus: number;
  ascendant: number;
  phantom: number;
};

// Minimum pool size (distinct players active in the trailing 30-day
// window) before streak ranks surface at all. Below this the percentile
// is too noisy to mean anything. The server omits cutoffs below this
// floor; this constant lets the client gate defensively too.
export const MIN_STREAK_POOL = 30;

// Highest streak tier the player qualifies for, or null if none.
// Requires the pool to be large enough, a positive current streak, and —
// per tier, top → down — that current streak clears BOTH the percentile
// cutoff and the absolute floor (i.e. current ≥ max(cutoff, floor)).
export function streakTierFor(
  current: number,
  cutoffs: StreakCutoffs | null | undefined,
  poolN: number,
): StreakTier | null {
  if (!cutoffs) return null;
  if (!Number.isFinite(poolN) || poolN < MIN_STREAK_POOL) return null;
  if (!Number.isFinite(current) || current <= 0) return null;
  for (const tier of STREAK_TIERS) {
    const need = Math.max(cutoffs[tier], STREAK_TIER_FLOOR[tier]);
    if (current >= need) return tier;
  }
  return null;
}

// Index in STREAK_TIERS. Lower = higher rank. Used by the promote-only
// ratchet so the celebration modal fires only when a player reaches a
// strictly higher tier than they've ever held.
export function streakTierRank(tier: StreakTier): number {
  return STREAK_TIERS.indexOf(tier);
}
