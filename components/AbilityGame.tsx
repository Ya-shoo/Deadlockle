"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  HEROES,
  HEROES_BY_KEY,
  type Ability,
  type Hero,
} from "@/lib/heroes";
import {
  dayString,
  getAbilityForDay,
  prettyDay,
  shuffleOrder,
} from "@/lib/daily";
import { loadModeState, saveModeState, type ModeState } from "@/lib/storage";
import { HeroCombobox } from "./HeroCombobox";
import { Brand } from "./Brand";
import { NextModeCTA } from "./NextModeCTA";
import { ScoreBadge } from "./ScoreBadge";
import { BonusRound } from "./BonusRound";

const MODE = "ability";

const GRID_DIM = 4;
const TOTAL_CELLS = GRID_DIM * GRID_DIM;
const INITIAL_REVEALS = 1;

export function AbilityGame() {
  const [day, setDay] = useState<string | null>(null);
  const [state, setState] = useState<ModeState | null>(null);

  useEffect(() => {
    const d = dayString();
    setDay(d);
    setState(loadModeState(MODE, d));
  }, []);

  if (!day || !state) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="font-mono text-xs uppercase tracking-[0.2em] text-ink-faint">
          Loading…
        </div>
      </main>
    );
  }

  const { hero: answer, ability, abilityIndex } = getAbilityForDay(day);
  const guessedHeroes = state.guesses
    .map((k) => HEROES_BY_KEY[k])
    .filter(Boolean);
  const excludeKeys = new Set(state.guesses);

  const handleGuess = (hero: Hero) => {
    if (state.won) return;
    const next: ModeState = {
      ...state,
      guesses: [...state.guesses, hero.key],
      won: hero.key === answer.key,
    };
    setState(next);
    saveModeState(MODE, next);
  };

  const handleBonus = (selected: number, correct: boolean) => {
    if (!state.won || state.bonus) return;
    const next: ModeState = {
      ...state,
      bonus: { selected, correct },
    };
    setState(next);
    saveModeState(MODE, next);
  };

  const cellsRevealed = state.won
    ? TOTAL_CELLS
    : Math.min(INITIAL_REVEALS + state.guesses.length, TOTAL_CELLS);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-16">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-info">
            <span suppressHydrationWarning>{prettyDay(day)}</span>
          </p>
          <h1 className="mt-3 font-display display-headline text-5xl text-ink sm:text-6xl">
            Ability
          </h1>
          <p className="mt-3 max-w-md text-ink-soft">
            Whose ability is this? More of the icon reveals with each guess.
          </p>
        </div>
        <div className="hidden flex-col items-end font-mono text-xs uppercase tracking-[0.2em] text-ink-faint sm:flex">
          <Brand size="sm" />
          <span className="mt-1 text-info">ability mode</span>
        </div>
      </header>

      <div className="mb-8 flex flex-col items-center">
        <AbilityArtCard
          ability={ability}
          revealedHero={state.won ? answer : null}
          nameRevealed={state.won && state.bonus != null}
          day={day}
          cellsRevealed={cellsRevealed}
        />
      </div>

      {!state.won && (
        <div className="mb-6">
          <HeroCombobox
            heroes={HEROES}
            excludeKeys={excludeKeys}
            onSelect={handleGuess}
          />
          <p className="mt-3 font-mono text-xs uppercase tracking-[0.18em] text-info">
            {state.guesses.length}{" "}
            {state.guesses.length === 1 ? "guess" : "guesses"}
            <span className="ml-2 text-ink-faint">
              · {cellsRevealed} / {TOTAL_CELLS} tiles
            </span>
          </p>
        </div>
      )}

      <AnimatePresence>
        {state.won && (
          <motion.div
            key="win"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="mb-6 rounded-(--radius-card) border border-correct/40 bg-correct/10 p-5 sm:p-6"
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
                  Solved · Hero
                </div>
                <div className="mt-1 font-display text-2xl text-ink sm:text-3xl">
                  {answer.name}
                </div>
                <div className="mt-3">
                  <NextModeCTA current="ability" />
                </div>
              </div>
              <ScoreBadge count={state.guesses.length} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bonus round — only after the main hero guess resolves. The four
          ability options show keybind 1-4 + name. The ability NAME at the
          top of AbilityArtCard is gated on bonus completion so the bonus
          stays a real puzzle: you see the icon and four named options, you
          pick which one matched. */}
      {state.won && (
        <div className="mb-8">
          <BonusRound
            hero={answer}
            correctIndex={abilityIndex}
            saved={state.bonus}
            onSelect={handleBonus}
          />
        </div>
      )}

      <div className="space-y-2.5">
        <AnimatePresence initial={false}>
          {[...guessedHeroes].reverse().map((hero, revIdx) => {
            const originalIdx = guessedHeroes.length - 1 - revIdx;
            const isLatest = originalIdx === guessedHeroes.length - 1;
            return (
              <WrongGuessCard key={hero.key} hero={hero} isLatest={isLatest} />
            );
          })}
        </AnimatePresence>
      </div>

      {state.guesses.length === 0 && (
        <div className="mt-10 rounded-(--radius-card) border border-dashed border-line bg-inset/40 p-8 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-faint">
            One tile is showing. Type a hero to reveal more.
          </p>
        </div>
      )}
    </main>
  );
}

function WrongGuessCard({ hero, isLatest }: { hero: Hero; isLatest: boolean }) {
  return (
    <motion.div
      layout
      initial={isLatest ? { opacity: 0, y: -10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="tile-shape mx-auto flex w-full max-w-xs flex-col items-center justify-center gap-3 border border-far/40 bg-far/15 px-5 py-6"
    >
      {hero.portrait_url && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={hero.portrait_url}
          alt={hero.name}
          width={112}
          height={112}
          className="h-24 w-24 rounded-(--radius-card) bg-muted object-cover sm:h-28 sm:w-28"
        />
      )}
      <div className="font-display text-2xl uppercase tracking-wide text-ink sm:text-3xl">
        {hero.name}
      </div>
    </motion.div>
  );
}

function AbilityArtCard({
  ability,
  revealedHero,
  nameRevealed,
  day,
  cellsRevealed,
}: {
  ability: Ability;
  revealedHero: Hero | null;
  nameRevealed: boolean;
  day: string;
  cellsRevealed: number;
}) {
  const revealOrder = useMemo(
    () =>
      shuffleOrder(`deadlockle:ability:${day}:${ability.icon}`, TOTAL_CELLS),
    [day, ability.icon],
  );
  const revealedSet = useMemo(
    () => new Set(revealOrder.slice(0, cellsRevealed)),
    [revealOrder, cellsRevealed],
  );

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        className="relative tile-shape border border-line bg-muted/40 p-4 shadow-2xl shadow-black/40 sm:p-5"
        style={{ width: 240, height: 240 }}
      >
        <div className="relative h-full w-full">
          {ability.icon && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={ability.icon}
              alt={nameRevealed ? ability.name : "Mystery ability"}
              className="absolute inset-0 h-full w-full object-contain"
              loading="eager"
              decoding="async"
            />
          )}
          <div
            aria-hidden={!!revealedHero}
            className="absolute inset-0 grid"
            style={{
              gridTemplateColumns: `repeat(${GRID_DIM}, 1fr)`,
              gridTemplateRows: `repeat(${GRID_DIM}, 1fr)`,
            }}
          >
            {Array.from({ length: TOTAL_CELLS }).map((_, i) => {
              const isRevealed = revealedSet.has(i);
              const col = i % GRID_DIM;
              const row = Math.floor(i / GRID_DIM);
              const isLastCol = col === GRID_DIM - 1;
              const isLastRow = row === GRID_DIM - 1;
              return (
                <motion.div
                  key={i}
                  initial={false}
                  animate={{
                    opacity: isRevealed ? 0 : 1,
                    scale: isRevealed ? 1.04 : 1,
                  }}
                  transition={{
                    duration: 0.45,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className={`bg-muted ${
                    !isLastCol ? "border-r border-line/70" : ""
                  } ${!isLastRow ? "border-b border-line/70" : ""}`}
                />
              );
            })}
          </div>
        </div>
      </div>
      {nameRevealed && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="text-center"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-info">
            Ability
          </p>
          <p className="mt-1 font-display text-2xl text-ink">{ability.name}</p>
          {ability.description && (
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
              {ability.description}
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}
