"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { HEROES, HEROES_BY_KEY, type Hero } from "@/lib/heroes";
import { dayString, getHeroForDay, prettyDay } from "@/lib/daily";
import {
  ATTRIBUTES,
  type AttrKey,
  compareHero,
  getUnsolvedAttrs,
} from "@/lib/compare";
import { loadModeState, saveModeState, type ModeState } from "@/lib/storage";
import { HeroCombobox } from "./HeroCombobox";
import { GuessRow } from "./GuessRow";
import { Brand } from "./Brand";
import { ShareButton } from "./ShareButton";
import { NextModeCTA } from "./NextModeCTA";
import { ScoreBadge } from "./ScoreBadge";

const HINT_THRESHOLDS = [5, 10] as const;
const MAX_HINTS = HINT_THRESHOLDS.length;

const ATTR_KEY_SET = new Set<AttrKey>(ATTRIBUTES.map((a) => a.key));

function isAttrKey(v: unknown): v is AttrKey {
  return typeof v === "string" && ATTR_KEY_SET.has(v as AttrKey);
}

export function ClassicGame() {
  const [day, setDay] = useState<string | null>(null);
  const [state, setState] = useState<ModeState | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    const d = dayString();
    setDay(d);
    setState(loadModeState("classic", d));
  }, []);

  const answer = useMemo(() => (day ? getHeroForDay(day) : null), [day]);

  const guessedHeroes = useMemo(
    () =>
      state
        ? state.guesses.map((k) => HEROES_BY_KEY[k]).filter(Boolean)
        : [],
    [state],
  );

  const hintsUsed = useMemo<AttrKey[]>(
    () => (state?.hintsUsed ?? []).filter(isAttrKey),
    [state],
  );

  const unsolvedAttrs = useMemo(
    () =>
      answer ? getUnsolvedAttrs(guessedHeroes, answer) : new Set<AttrKey>(),
    [guessedHeroes, answer],
  );

  // Display values for the answer, keyed by attribute. Reused by the reveal
  // panel — we run compareHero(answer, answer) so we get the same formatted
  // strings the tiles use, with no manual fmt duplication.
  const answerDisplay = useMemo(() => {
    if (!answer) return new Map<AttrKey, { label: string; display: string }>();
    return new Map<AttrKey, { label: string; display: string }>(
      compareHero(answer, answer).map((r) => [
        r.attr,
        { label: r.label, display: r.display },
      ]),
    );
  }, [answer]);

  if (!day || !state || !answer) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="font-mono text-xs uppercase tracking-[0.2em] text-ink-faint">
          Loading…
        </div>
      </main>
    );
  }

  const excludeKeys = new Set(state.guesses);

  const handleGuess = (hero: Hero) => {
    if (state.won) return;
    const newGuesses = [...state.guesses, hero.key];
    const won = hero.key === answer.key;
    const next: ModeState = { ...state, guesses: newGuesses, won };
    setState(next);
    saveModeState("classic", next);
  };

  const guessCount = state.guesses.length;
  const hintsUnlocked = HINT_THRESHOLDS.filter((t) => guessCount >= t).length;
  const hintsRemaining = Math.max(0, hintsUnlocked - hintsUsed.length);

  const eligibleForHint = Array.from(unsolvedAttrs).filter(
    (k) => !hintsUsed.includes(k),
  );
  const canUseHint =
    !state.won && hintsRemaining > 0 && eligibleForHint.length > 0;

  const nextThreshold = HINT_THRESHOLDS.find((t) => guessCount < t) ?? null;
  const guessesUntilNext =
    nextThreshold != null && hintsUsed.length < MAX_HINTS
      ? nextThreshold - guessCount
      : null;

  const confirmHint = () => {
    if (!canUseHint) {
      setConfirmOpen(false);
      return;
    }
    const pick =
      eligibleForHint[Math.floor(Math.random() * eligibleForHint.length)];
    const next: ModeState = {
      ...state,
      hintsUsed: [...hintsUsed, pick],
    };
    setState(next);
    saveModeState("classic", next);
    setConfirmOpen(false);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-16">
      <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-info">
            <span suppressHydrationWarning>{prettyDay(day)}</span>
          </p>
          <h1 className="mt-3 font-display display-headline text-5xl text-ink sm:text-6xl">
            Classic
          </h1>
          <p className="mt-3 max-w-md text-ink-soft">
            Type a hero. Match the eight attributes. New puzzle daily.
          </p>
        </div>
        <div className="hidden flex-col items-end font-mono text-xs uppercase tracking-[0.2em] text-ink-faint sm:flex">
          <Brand size="sm" />
          <span className="mt-1 text-info">classic mode</span>
        </div>
      </header>

      {!state.won && (
        <div className="mb-6">
          <HeroCombobox
            heroes={HEROES}
            excludeKeys={excludeKeys}
            onSelect={handleGuess}
          />
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="font-mono text-xs uppercase tracking-[0.18em] text-info">
              {guessCount} {guessCount === 1 ? "guess" : "guesses"}
            </span>
            {canUseHint && (
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="rounded-(--radius-pill) border border-accent/60 bg-accent/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-accent transition hover:bg-accent/20"
              >
                Use hint
                {hintsRemaining > 1 ? ` (${hintsRemaining} left)` : ""}
              </button>
            )}
            {!canUseHint &&
              guessesUntilNext != null &&
              hintsUsed.length < MAX_HINTS && (
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                  Unlock a hint in {guessesUntilNext}{" "}
                  {guessesUntilNext === 1 ? "guess" : "guesses"}
                </span>
              )}
          </div>
        </div>
      )}

      {hintsUsed.length > 0 && (
        <div className="mb-6 rounded-(--radius-card) border border-accent/30 bg-accent/5 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
            Revealed {hintsUsed.length === 1 ? "hint" : "hints"}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {hintsUsed.map((attr) => {
              const entry = answerDisplay.get(attr);
              if (!entry) return null;
              return (
                <span
                  key={attr}
                  className="rounded-(--radius-pill) bg-accent/15 px-3 py-1 font-mono text-[11px] tracking-[0.05em] text-ink"
                >
                  <span className="uppercase tracking-[0.18em] text-ink-faint">
                    {entry.label}
                  </span>
                  <span className="mx-1.5 text-ink-faint">·</span>
                  <span className="font-display text-sm text-ink">
                    {entry.display}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            key="confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
            onClick={() => setConfirmOpen(false)}
          >
            <motion.div
              key="confirm-dialog"
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-sm rounded-(--radius-card) border border-line bg-surface p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="font-display text-xl text-ink">
                Are you sure you want to use a hint?
              </div>
              <p className="mt-2 text-sm text-ink-soft">
                A random unsolved attribute will be revealed. You have a maximum
                of {MAX_HINTS} hints per puzzle.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  className="rounded-(--radius-pill) border border-line px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-ink-soft transition hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmHint}
                  className="rounded-(--radius-pill) bg-accent px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-on-accent transition-opacity hover:opacity-90"
                >
                  Reveal hint
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {state.won && (
          <motion.div
            key="win"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="mb-8 rounded-(--radius-card) border border-correct/40 bg-correct/10 p-5 sm:p-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              {answer.portrait_url && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={answer.portrait_url}
                  alt=""
                  className="h-16 w-16 rounded-(--radius-card) bg-muted object-cover sm:h-20 sm:w-20"
                />
              )}
              <div className="flex-1">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-info">
                  Solved
                </div>
                <div className="mt-1 font-display text-3xl text-ink">
                  {answer.name}
                </div>
                <div className="mt-3">
                  <NextModeCTA current="classic" />
                </div>
              </div>
              <ScoreBadge count={state.guesses.length} />
              <ShareButton
                modeLabel="Classic"
                answer={answer}
                guesses={state.guesses}
                day={day}
                hintsUsed={hintsUsed.length}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {[...guessedHeroes].reverse().map((hero, revIdx) => {
            const originalIdx = guessedHeroes.length - 1 - revIdx;
            const isLatest = originalIdx === guessedHeroes.length - 1;
            return (
              <GuessRow
                key={hero.key}
                guess={hero}
                answer={answer}
                isLatest={isLatest}
              />
            );
          })}
        </AnimatePresence>
      </div>

      {state.guesses.length === 0 && (
        <div className="mt-10 rounded-(--radius-card) border border-dashed border-line bg-inset/40 p-8 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-faint">
            Start by typing a hero name above.
          </p>
        </div>
      )}
    </main>
  );
}
