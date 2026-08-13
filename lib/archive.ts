// Archive mode — a private, client-only replay of recent daily puzzles.
// Retention feature, NOT SEO (per-mode replay routes are noindex). Ported
// from OWdle's lib/archive.ts; Classic, Conversation (slug "sound"), and
// Mugshot ship first, the rest reuse the same pattern later.
//
// STREAK-NEUTRALITY IS LOAD-BEARING. Archive rounds persist under
// `deadlockle.archive.<mode>.<day>` via storage.ts's key() (`deadlockle.
// ${mode}.${day}` with the double-segment mode `archive.<mode>`). That key
// deliberately does NOT match streak.ts's MODE_KEY_RE
// (`/^deadlockle\.[a-z]+\.\d{4}-…/` — a single `[a-z]+` can't span the dot),
// and isDayComplete() only ever reads the literal live `deadlockle.<built
// slug>.<day>` keys — so no archive write is ever seen by the streak or the
// daily-complete logic. Never write a live `deadlockle.<mode>.<day>` key
// from here.

import { dayString } from "./daily";
import { BAG_CUTOVER_DAY } from "./dailyBag";
import {
  loadConversationState,
  loadModeState,
  saveConversationState,
  saveModeState,
  type ConversationState,
  type ModeState,
} from "./storage";

// Rolling window: today + previous 6 Pacific puzzle days.
export const ARCHIVE_WINDOW_DAYS = 7;

// Conversation ("sound") stores its own state shape (ConversationState),
// so fill-status + load/save branch on this. Every other mode uses the
// generic ModeState.
function isConversationMode(mode: string): boolean {
  return mode === "sound";
}

// The storage-mode segment for a mode's archive namespace. Passing this to
// the load/save helpers yields `deadlockle.archive.<mode>.<day>`.
export function archiveMode(mode: string): string {
  return `archive.${mode}`;
}

// --- Generic (Classic, Mugshot) ---
export function loadArchiveState(mode: string, day: string): ModeState {
  return loadModeState(archiveMode(mode), day);
}

export function saveArchiveState(mode: string, state: ModeState): void {
  saveModeState(archiveMode(mode), state);
}

// --- Conversation ("sound") ---
export function loadArchiveConversationState(day: string): ConversationState {
  return loadConversationState(archiveMode("sound"), day);
}

export function saveArchiveConversationState(state: ConversationState): void {
  saveConversationState(archiveMode("sound"), state);
}

export type FillOutcome = "won" | "lost" | "none";

export type DayFill = {
  day: string;
  // Best-outcome union of the live daily key and the archive key. Ranked
  // won > lost > none, so a live LOSS (red) flips to WON (green) the moment
  // the player redeems it by replaying + winning in the archive. A green is
  // never downgraded — this redemption is the feature's core hook.
  outcome: FillOutcome;
  // A resumable, not-yet-terminal round exists (archive round part-played,
  // or — for today — the live daily is mid-round). Drives a subtle "resume"
  // affordance; never overrides a won/lost color.
  inProgress: boolean;
};

// Deadlockle's terminal flags: `failed` is the current out-of-guesses flag,
// `gaveUp` is the honored legacy flag. `won` is the win flag. Both ModeState
// and ConversationState carry these three, so one predicate covers both.
type TerminalLike = { won: boolean; failed?: boolean; gaveUp?: boolean };

function isTerminal(st: TerminalLike): boolean {
  return st.won || st.failed === true || st.gaveUp === true;
}

function hasProgress(mode: string, day: string, archive: boolean): boolean {
  if (isConversationMode(mode)) {
    const st = archive
      ? loadArchiveConversationState(day)
      : loadConversationState(mode, day);
    return st.guesses.length > 0;
  }
  const st = archive ? loadArchiveState(mode, day) : loadModeState(mode, day);
  return (st.guesses?.length ?? 0) > 0 || (st.hintsUsed?.length ?? 0) > 0;
}

// Read the (won, terminal) pair for one namespace of one day, mode-aware.
function outcomeOf(
  mode: string,
  day: string,
  archive: boolean,
): { won: boolean; terminal: boolean } {
  const st: TerminalLike = isConversationMode(mode)
    ? archive
      ? loadArchiveConversationState(day)
      : loadConversationState(mode, day)
    : archive
      ? loadArchiveState(mode, day)
      : loadModeState(mode, day);
  return { won: st.won, terminal: isTerminal(st) };
}

// Fill status for one day, unioning the live daily record with the archive
// record. `mode` is the live mode slug (e.g. "classic"); the archive record
// is read from its sibling `archive.<mode>` namespace.
export function archiveFillStatus(mode: string, day: string): DayFill {
  const live = outcomeOf(mode, day, false);
  const arch = outcomeOf(mode, day, true);

  let outcome: FillOutcome = "none";
  if (live.won || arch.won) {
    outcome = "won";
  } else if (live.terminal || arch.terminal) {
    outcome = "lost";
  }

  const inProgress =
    outcome !== "won" &&
    ((hasProgress(mode, day, true) && !arch.terminal) ||
      (hasProgress(mode, day, false) && !live.terminal));

  return { day, outcome, inProgress };
}

// Shift a YYYY-MM-DD Pacific puzzle-day string by whole days. UTC math on the
// date-only value is safe because puzzle-day strings are already normalized
// (see dayString) — no clock component to drift.
function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

// The rolling window ending today (default: the current Pacific puzzle day),
// oldest → newest. Floor-clamped at BAG_CUTOVER_DAY so it never surfaces a
// day that predates the shuffle-bag era. Lexicographic compare is
// chronological for YYYY-MM-DD.
export function archiveWindow(today: string = dayString()): string[] {
  const days: string[] = [];
  for (let i = ARCHIVE_WINDOW_DAYS - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    if (d < BAG_CUTOVER_DAY) continue;
    days.push(d);
  }
  return days;
}

// The next OTHER past day that isn't already green (won) — an empty or red
// day the player can go fill in. Used by the round-complete CTA to drive an
// all-green week. Searches forward from `after` (EXCLUSIVE of `after`
// itself), then wraps to the start, so it lands on the nearest unfilled day
// and never links back to the day just played. Excludes today (played live)
// and won days. Returns null when every OTHER past day is green — the caller
// decides what to show based on whether `after` itself was won.
export function nextUnfilledDay(
  mode: string,
  after: string,
  today: string = dayString(),
): string | null {
  const past = archiveWindow(today).filter((d) => d < today);
  if (past.length === 0) return null;
  const start = past.findIndex((d) => d === after);
  const ordered =
    start === -1 ? past : [...past.slice(start + 1), ...past.slice(0, start)];
  for (const d of ordered) {
    if (archiveFillStatus(mode, d).outcome !== "won") return d;
  }
  return null;
}
