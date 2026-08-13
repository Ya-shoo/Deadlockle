// localStorage-backed game state per mode + day. A finished puzzle persists
// across reloads but resets at 2:15am Pacific when the day key changes.

export type ModeState = {
  day: string;
  guesses: string[]; // hero keys (or item keys for Item mode), in order
  won: boolean;
  // Set when the player hit the per-mode guess cap without solving. The UI
  // auto-reveals the answer in a muted red card. Treated as "done" by every
  // consumer that walks the daily progress (streak, header dots, NextModeCTA,
  // feedback popup, home-page mode grid), so a failed mode still advances the
  // player.
  failed?: boolean;
  // Legacy. Set when the player tapped the Item-mode "Show answer" mercy-kill
  // (removed in the lives PR). Still honored on read for back-compat with
  // existing localStorage; new failures write `failed` instead.
  gaveUp?: boolean;
  // Classic-mode hint system: attribute keys whose answer values have been
  // revealed. Capped at 2 by the UI; persisted so reveals survive reloads.
  hintsUsed?: string[];
  // Archive-only: the resolved answer key, stamped into every saved archive
  // state so a replayed past day stays pinned to the hero it was played
  // against even if the daily bag reshuffles later (e.g. a new hero ships).
  // The live daily never writes this — today's answer is stable intraday —
  // so the stored shape of live rounds is unchanged.
  answerKey?: string;
  // Mugshot-mode hard-mode latch, written at each guess submission:
  // initialized from the grayscale toggle on the FIRST guess, then ANDed
  // with the toggle on every subsequent one — a single guess submitted
  // with hard mode off drops it for the round permanently (peeking at
  // color between guesses costs nothing). Drives the HARD MODE badge on
  // share cards; undefined (pre-feature rounds) never claims the badge.
  hardMode?: boolean;
  bonus?: {
    selected: number;
    correct: boolean | null;
  };
};

function key(mode: string, day: string): string {
  return `deadlockle.${mode}.${day}`;
}

export function loadModeState(mode: string, day: string): ModeState {
  if (typeof window === "undefined") return { day, guesses: [], won: false };
  try {
    const raw = window.localStorage.getItem(key(mode, day));
    if (!raw) return { day, guesses: [], won: false };
    const parsed = JSON.parse(raw) as ModeState;
    if (parsed.day !== day) return { day, guesses: [], won: false };
    return parsed;
  } catch {
    return { day, guesses: [], won: false };
  }
}

export function saveModeState(mode: string, state: ModeState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(mode, state.day), JSON.stringify(state));
  } catch {
    // ignore quota / serialization errors
  }
}

// --- Conversation mode (Quote): each guess targets a specific speaker ---

export type ConversationGuess = {
  heroKey: string;
  target: 0 | 1;
};

export type ConversationState = {
  day: string;
  // Saved alongside guesses so we can detect a stale state where the daily
  // pick rotated (e.g., the conversation pool grew or the seed namespace
  // changed) and the previous guesses no longer apply.
  speakers?: [string, string];
  guesses: ConversationGuess[];
  won: boolean;
  failed?: boolean;
};

function isValidConversationGuess(g: unknown): g is ConversationGuess {
  return (
    typeof g === "object" &&
    g !== null &&
    typeof (g as ConversationGuess).heroKey === "string" &&
    ((g as ConversationGuess).target === 0 ||
      (g as ConversationGuess).target === 1)
  );
}

// Quote and Sound both use a two-speaker conversation puzzle, so they
// share the same state shape — but each gets its own localStorage key
// (passed as `mode`) so progress doesn't bleed across the two modes.
export function loadConversationState(
  mode: string,
  day: string,
): ConversationState {
  if (typeof window === "undefined") return { day, guesses: [], won: false };
  try {
    const raw = window.localStorage.getItem(key(mode, day));
    if (!raw) return { day, guesses: [], won: false };
    const parsed = JSON.parse(raw);
    if (parsed.day !== day) return { day, guesses: [], won: false };
    if (!Array.isArray(parsed.guesses))
      return { day, guesses: [], won: false };
    if (!parsed.guesses.every(isValidConversationGuess))
      return { day, guesses: [], won: false };
    return parsed as ConversationState;
  } catch {
    return { day, guesses: [], won: false };
  }
}

export function saveConversationState(
  mode: string,
  state: ConversationState,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      key(mode, state.day),
      JSON.stringify(state),
    );
  } catch {
    // ignore
  }
}
