// Daily-completion streak. A "complete day" is any Pacific puzzle day on
// which the player has won (or given up on) every built mode — the same
// definition HomeContent and NextModeCTA already use for the all-done state.
//
// State lives in a single localStorage key. On first read after this feature
// shipped, we backfill from existing per-mode localStorage so an established
// daily player doesn't get reset to 0 just because the streak key didn't
// exist yet. The same scan also seeds `longest` from history.

import { dayString } from "./daily";
import { BUILT_MODE_SLUGS } from "./modes";

const STREAK_KEY = "deadlockle.streak";
const MODE_KEY_RE = /^deadlockle\.[a-z]+\.(\d{4}-\d{2}-\d{2})$/;
// Safety bound for the backfill walk — well past any plausible play history.
const MAX_BACKFILL_DAYS = 730;

export type StreakState = {
  current: number;
  longest: number;
  /** YYYY-MM-DD of the last Pacific puzzle day all modes were completed. */
  lastCompletedDay: string | null;
};

const EMPTY: StreakState = { current: 0, longest: 0, lastCompletedDay: null };

function readRaw(): StreakState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STREAK_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p !== "object" || p === null) return null;
    return {
      current: Number.isFinite(p.current) ? Math.max(0, Math.floor(p.current)) : 0,
      longest: Number.isFinite(p.longest) ? Math.max(0, Math.floor(p.longest)) : 0,
      lastCompletedDay:
        typeof p.lastCompletedDay === "string" ? p.lastCompletedDay : null,
    };
  } catch {
    return null;
  }
}

function writeRaw(s: StreakState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STREAK_KEY, JSON.stringify(s));
  } catch {
    // ignore quota / private-mode errors
  }
}

function prevDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

// A day counts as complete if every built mode's stored state has won=true
// or gaveUp=true. Mirrors HomeContent's allDone derivation so the streak
// stays in lockstep with what the UI already calls a finished day.
function isDayComplete(day: string): boolean {
  if (typeof window === "undefined") return false;
  for (const slug of BUILT_MODE_SLUGS) {
    try {
      const raw = window.localStorage.getItem(`deadlockle.${slug}.${day}`);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!(parsed?.won === true || parsed?.gaveUp === true)) return false;
    } catch {
      return false;
    }
  }
  return true;
}

function consecutiveEndingAt(day: string): { count: number; lastDay: string | null } {
  let count = 0;
  let cursor = day;
  let lastDay: string | null = null;
  while (isDayComplete(cursor)) {
    count++;
    lastDay = cursor;
    cursor = prevDay(cursor);
    if (count >= MAX_BACKFILL_DAYS) break;
  }
  return { count, lastDay };
}

// Longest contiguous run of completed days anywhere in this browser's
// history. We pull candidate days from every `deadlockle.<mode>.<day>` key
// rather than walking the full calendar — keeps the scan O(keys) regardless
// of how far back the player started.
function longestRunInHistory(): number {
  if (typeof window === "undefined") return 0;
  const days = new Set<string>();
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (!k) continue;
    const m = MODE_KEY_RE.exec(k);
    if (m) days.add(m[1]);
  }
  const completeSorted = Array.from(days).filter(isDayComplete).sort();
  let longest = 0;
  let run = 0;
  let last: string | null = null;
  for (const d of completeSorted) {
    run = last != null && prevDay(d) === last ? run + 1 : 1;
    if (run > longest) longest = run;
    last = d;
  }
  return longest;
}

// Seed initial state from history. If today is complete the streak ends at
// today; otherwise it ends at the most recent complete day, which is
// usually yesterday for a returning daily player.
function backfillFromHistory(today: string): StreakState {
  const todayComplete = isDayComplete(today);
  const seed = todayComplete ? today : prevDay(today);
  const { count, lastDay } = consecutiveEndingAt(seed);
  const longest = Math.max(longestRunInHistory(), count);
  return {
    current: count,
    longest,
    lastCompletedDay: lastDay,
  };
}

// Idempotent. Reads the persisted state (running backfill the first time),
// then bumps if today just became complete and we haven't already recorded
// it. Safe to call from multiple consumers on the same render — only the
// first call observes the transition.
export function bumpStreakIfNeeded(): StreakState {
  if (typeof window === "undefined") return EMPTY;
  const today = dayString();
  let state = readRaw();
  if (state == null) {
    state = backfillFromHistory(today);
    writeRaw(state);
  }
  if (state.lastCompletedDay === today) return state;
  if (!isDayComplete(today)) return state;
  const continuing = state.lastCompletedDay === prevDay(today);
  const current = continuing ? state.current + 1 : 1;
  const longest = Math.max(state.longest, current);
  const next: StreakState = { current, longest, lastCompletedDay: today };
  writeRaw(next);
  return next;
}
