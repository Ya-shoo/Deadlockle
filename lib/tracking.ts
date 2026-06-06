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

// Fired when a user clicks a share affordance — currently the Classic
// text-share block's Copy / Share actions; the link-share buttons join
// when the share-card system lands (SHARE_CARDS_PLAN.md). Not
// idempotent: every click counts, since the same person may re-share
// or copy-then-tweet. `surface` is where they clicked from; `method`
// is how the share happens. Event + prop names are OWdle-identical
// (shared PostHog dashboards); the surface union here is the subset of
// OWdle's that exists on Deadlockle — extend it as surfaces port over.
export function trackShareClicked(opts: {
  surface: "round_result" | "daily_complete";
  method:
    | "twitter_intent"
    | "clipboard"
    | "native"
    | "clipboard-link"
    | "clipboard-text"
    | "download"
    | "canceled"
    | "error";
  dailyId?: string;
  mode?: string;
}): void {
  posthog.capture("share_clicked", {
    surface: opts.surface,
    method: opts.method,
    daily_id: opts.dailyId ?? null,
    mode: opts.mode ?? null,
  });
}

// Fired when a visitor lands from a shared /r/[code] link — the redirect
// appends ?c=<code> and the destination page reports it here, closing
// the share → visit funnel that share_clicked opens. shared_* props
// describe the SHARER's result (decoded from the code), not the
// visitor's; landing_mode is where the visitor arrived ("home" for
// daily codes). Not idempotent by design — every inbound click counts —
// but the caller strips ?c= from the URL after firing so a reload
// doesn't re-fire. Event + prop names are OWdle-identical (shared
// PostHog dashboards; $host separates the sites).
export function trackShareLinkVisited(opts: {
  landingMode: string;
  code: string;
  sharedDate: string;
  sharedMode?: string;
  sharedOutcome?: "won" | "lost";
}): void {
  posthog.capture("share_link_visited", {
    landing_mode: opts.landingMode,
    code: opts.code,
    shared_date: opts.sharedDate,
    shared_mode: opts.sharedMode ?? null,
    shared_outcome: opts.sharedOutcome ?? null,
  });
}

// One-time "you can share now" release announcement modal. `shown`
// fires when it pops; `dismissed` carries how it was closed so we can
// see whether people actually read it.
export function trackShareAnnounce(opts: {
  action: "shown" | "dismissed";
}): void {
  posthog.capture("share_announce", { action: opts.action });
}

// Fired when a player reaches a new, higher streak rank tier
// (Phantom → Ascendant → Eternus). StreakRankBadge gates this behind a
// persistent localStorage ratchet, so it fires at most once per tier ever
// reached — no per-day dedup needed here. Event + prop names are
// OWdle-identical (shared PostHog dashboards; site splits the two).
export function trackStreakRankPromoted(opts: {
  tier: "eternus" | "ascendant" | "phantom";
  streak: number;
  poolN: number;
}): void {
  posthog.capture("streak_rank_promoted", {
    tier: opts.tier,
    streak: opts.streak,
    pool_n: opts.poolN,
  });
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
