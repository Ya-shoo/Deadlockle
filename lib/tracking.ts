// PostHog analytics wrappers for daily-quiz modes. The same event names
// and prop names are used in the OWdle repo so the shared DailyDles
// PostHog project can build one set of dashboards across both sites —
// the `site` super-property (registered in instrumentation-client.ts)
// is what splits Deadlockle and OWdle events when querying.
//
// Idempotency: the mode_started, mode_completed, and daily_completed
// helpers guard against duplicate fires within the same Pacific puzzle
// day by stashing a marker in localStorage. guess_submitted and
// hint_used fire from user-interaction handlers (not effects) so they
// don't need the same protection.

import posthog from "posthog-js";

// Built modes only — `quote` is `devOnly` in lib/modes.ts and never
// played by real users, so it's intentionally excluded from the tracker
// type. Add it here if it ever ships to production.
export type Mode = "classic" | "ability" | "mugshot" | "sound" | "item";

// Returns true if the event has already fired for this day; otherwise
// records the marker and returns false. Markers are per Pacific puzzle
// day so re-mounts within a day don't double-fire while a new day
// always re-fires once. SSR returns true to short-circuit safely.
function alreadyFired(eventKey: string): boolean {
  if (typeof window === "undefined") return true;
  const k = `deadlockle.tracked.${eventKey}`;
  try {
    if (window.localStorage.getItem(k) === "1") return true;
    window.localStorage.setItem(k, "1");
    return false;
  } catch {
    // If localStorage is unavailable we err on the side of firing — a
    // duplicate event is better than a missed one for these dashboards.
    return false;
  }
}

export function trackModeStarted(opts: {
  mode: Mode;
  dailyId: string;
  answerId: string;
}): void {
  if (alreadyFired(`mode_started.${opts.mode}.${opts.dailyId}`)) return;
  posthog.capture("mode_started", {
    mode: opts.mode,
    daily_id: opts.dailyId,
    answer_id: opts.answerId,
  });
}

export function trackGuessSubmitted(opts: {
  mode: Mode;
  dailyId: string;
  guessNumber: number;
  isCorrect: boolean;
  guessId: string;
  answerId: string;
}): void {
  posthog.capture("guess_submitted", {
    mode: opts.mode,
    daily_id: opts.dailyId,
    guess_number: opts.guessNumber,
    is_correct: opts.isCorrect,
    guess_id: opts.guessId,
    answer_id: opts.answerId,
  });
}

export function trackModeCompleted(opts: {
  mode: Mode;
  dailyId: string;
  // Kept as the OWdle vocabulary so the cross-site dashboards line up.
  // Internally Deadlockle calls this `failed`, but the event uses `lost`.
  outcome: "won" | "lost" | "gaveUp";
  totalGuesses: number;
  cap: number;
  hintsUsed?: number;
  answerId: string;
  // Mode-specific extras. Null when not applicable to this mode.
  abilityIndex?: number | null;
  conversationId?: string | null;
}): void {
  if (alreadyFired(`mode_completed.${opts.mode}.${opts.dailyId}`)) return;
  posthog.capture("mode_completed", {
    mode: opts.mode,
    daily_id: opts.dailyId,
    outcome: opts.outcome,
    total_guesses: opts.totalGuesses,
    cap: opts.cap,
    hints_used: opts.hintsUsed ?? 0,
    answer_id: opts.answerId,
    ability_index: opts.abilityIndex ?? null,
    conversation_id: opts.conversationId ?? null,
  });
}

export function trackHintUsed(opts: {
  mode: Mode;
  dailyId: string;
  hintIndex: number;
  atGuessNumber: number;
  attributeRevealed: string;
}): void {
  posthog.capture("hint_used", {
    mode: opts.mode,
    daily_id: opts.dailyId,
    hint_index: opts.hintIndex,
    at_guess_number: opts.atGuessNumber,
    attribute_revealed: opts.attributeRevealed,
  });
}

// Fired when the feedback dialog opens. Doubles as a PostHog session-
// recording trigger (configured in project settings on the shared
// DailyDles project): the moment this event fires, the recorder is
// force-started for that session so the reviewer can see what the user
// does inside the dialog even if they hadn't started a mode. Also
// returns the current session_id so the caller can ship it along with
// the feedback POST.
export function trackFeedbackOpened(): string | null {
  posthog.capture("feedback_opened");
  try {
    return posthog.get_session_id() ?? null;
  } catch {
    return null;
  }
}

export function trackDailyCompleted(opts: {
  dailyId: string;
  wonCount: number;
  lostCount: number;
  totalGuesses: number;
  streakCurrent: number;
  streakLongest: number;
}): void {
  if (alreadyFired(`daily_completed.${opts.dailyId}`)) return;
  posthog.capture("daily_completed", {
    daily_id: opts.dailyId,
    won_count: opts.wonCount,
    lost_count: opts.lostCount,
    total_guesses: opts.totalGuesses,
    streak_current: opts.streakCurrent,
    streak_longest: opts.streakLongest,
    // sweep = won every built mode. We only call this when the day is
    // complete (so wonCount + lostCount === N built modes), making
    // lostCount === 0 a sufficient sweep signal.
    sweep: opts.lostCount === 0,
  });
}
