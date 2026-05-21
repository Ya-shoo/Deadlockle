// localStorage-backed game state per mode + day. A finished puzzle persists
// across reloads but resets at 2:15am Pacific when the day key changes.

export type ModeState = {
  day: string;
  guesses: string[]; // hero keys (or item keys for Item mode), in order
  won: boolean;
  // Classic-mode hint system: attribute keys whose answer values have been
  // revealed. Capped at 2 by the UI; persisted so reveals survive reloads.
  hintsUsed?: string[];
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
