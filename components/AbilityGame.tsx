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
import { media } from "@/lib/media";
import {
  trackGuessSubmitted,
  trackModeCompleted,
  trackModeStarted,
} from "@/lib/tracking";
import { HeroCombobox } from "./HeroCombobox";
import { Brand } from "./Brand";
import { NextModeCTA } from "./NextModeCTA";
import { BonusRound } from "./BonusRound";
import { GuessesLeftBadge } from "./GuessesLeftBadge";
import { LossReveal } from "./LossReveal";
import { ModeStatsLine } from "./ModeStatsLine";
import { ShareButton } from "./ShareButton";
import { roundShareLinks } from "@/lib/shareLinks";
import { useShareLinkVisit } from "@/lib/useShareLinkVisit";

const MODE = "ability";

const GRID_DIM = 4;
const TOTAL_CELLS = GRID_DIM * GRID_DIM;
const INITIAL_REVEALS = 1;

// Hard ceiling. Twelve wrong guesses and the puzzle auto-fails. Loose by
// design — the 4×4 reveal grid keeps the icon ambiguous enough that 12
// still feels tight. Tune downward if analytics show too many wins are
// landing near the cap.
const MAX_GUESSES = 12;

export function AbilityGame() {
  const [day, setDay] = useState<string | null>(null);
  const [state, setState] = useState<ModeState | null>(null);
  // Inbound share-link attribution (?c= from /r/[code] redirects).
  useShareLinkVisit("ability");

  useEffect(() => {
    const d = dayString();
    setDay(d);
    let st = loadModeState(MODE, d);
    if (
      !st.won &&
      !st.failed &&
      !st.gaveUp &&
      st.guesses.length >= MAX_GUESSES
    ) {
      st = { ...st, failed: true };
      saveModeState(MODE, st);
    }
    setState(st);
  }, []);

  // mode_started — fires once per day on first mount.
  useEffect(() => {
    if (!day) return;
    const { hero, abilityIndex } = getAbilityForDay(day);
    trackModeStarted({ mode: "ability", dailyId: day, answerId: hero.key });
    // ESLint won't notice abilityIndex usage from inside this callback;
    // referencing it here makes the intent explicit and silences any
    // future linter that demands the dependency be listed.
    void abilityIndex;
  }, [day]);

  // mode_completed — fires when the puzzle transitions to a terminal
  // state. Dedup via tracker's localStorage marker.
  const stateWon = state?.won === true;
  const stateFailed = state?.failed === true || state?.gaveUp === true;
  useEffect(() => {
    if (!day) return;
    if (!stateWon && !stateFailed) return;
    const { hero, abilityIndex } = getAbilityForDay(day);
    trackModeCompleted({
      mode: "ability",
      dailyId: day,
      outcome: stateWon ? "won" : state?.gaveUp === true ? "gaveUp" : "lost",
      totalGuesses: state?.guesses.length ?? 0,
      cap: MAX_GUESSES,
      answerId: hero.key,
      abilityIndex,
    });
  }, [day, stateWon, stateFailed, state?.guesses.length, state?.gaveUp]);

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

  const failed = state.failed === true || state.gaveUp === true;
  const ended = state.won || failed;

  const handleGuess = (hero: Hero) => {
    if (ended) return;
    const newGuesses = [...state.guesses, hero.key];
    const won = hero.key === answer.key;
    const justFailed = !won && newGuesses.length >= MAX_GUESSES;
    trackGuessSubmitted({
      mode: "ability",
      dailyId: day,
      guessNumber: newGuesses.length,
      isCorrect: won,
      guessId: hero.key,
      answerId: answer.key,
    });
    const next: ModeState = {
      ...state,
      guesses: newGuesses,
      won,
      failed: justFailed ? true : state.failed,
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

  // Once the puzzle ends — win or fail — reveal the entire icon so the
  // player can see what they were looking at. Mid-game the grid uncovers
  // one tile per wrong guess on top of the initial freebie.
  const cellsRevealed = ended
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
          revealedHero={ended ? answer : null}
          nameRevealed={(state.won && state.bonus != null) || failed}
          day={day}
          cellsRevealed={cellsRevealed}
        />
      </div>

      {!ended && (
        <div className="mb-6">
          <HeroCombobox
            heroes={HEROES}
            excludeKeys={excludeKeys}
            onSelect={handleGuess}
          />
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <GuessesLeftBadge
              used={state.guesses.length}
              cap={MAX_GUESSES}
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
              {cellsRevealed} / {TOTAL_CELLS} tiles
            </span>
          </div>
        </div>
      )}

      {/* Bonus round is rendered FIRST in the post-win stack — above both
          the result/Next-mode card and the wrong-guess list — so a player
          conditioned to click "Next mode" the instant a puzzle resolves
          hits the bonus tiles before they ever reach the Next button. The
          ability NAME at the top of AbilityArtCard is still gated on bonus
          completion so the bonus stays a real puzzle: you see the icon and
          four named options, you pick which one matched. */}
      {state.won && (
        <div className="mb-6">
          <BonusRound
            hero={answer}
            correctIndex={abilityIndex}
            saved={state.bonus}
            onSelect={handleBonus}
          />
        </div>
      )}

      <AnimatePresence>
        {state.won && (
          <motion.div
            key="win"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mb-8 w-full max-w-md rounded-(--radius-card) border border-correct/40 bg-correct/10 p-4 sm:p-5"
          >
            <div className="flex flex-col gap-5">
              <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
                {answer.portrait_url && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={media(answer.portrait_url)}
                    alt=""
                    className="h-16 w-16 rounded-(--radius-card) bg-muted object-cover sm:h-20 sm:w-20"
                  />
                )}
                <div className="flex-1">
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-info">
                    Solved · Hero
                  </div>
                  <div className="mt-1 font-display text-2xl text-ink sm:text-3xl">
                    {answer.name}{" "}
                    <span className="text-ink-soft">
                      in {state.guesses.length}
                    </span>
                  </div>
                  <ModeStatsLine mode="ability" />
                </div>
              </div>
              <div className="flex justify-center sm:justify-start">
                <NextModeCTA current="ability" />
              </div>
              {/* Share closes the card — single bottom-anchored
                  affordance, consistent across every mode. */}
              <div className="flex items-center justify-center gap-3">
                <ShareButton
                  {...roundShareLinks({
                    day,
                    slug: "ability",
                    outcome: "won",
                    guesses: state.guesses.length,
                  })}
                  filename={`deadlockle-ability-${day}.png`}
                  surface="round_result"
                  mode="ability"
                  dailyId={day}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {failed && !state.won && (
        <LossReveal
          current="ability"
          share={
            <ShareButton
              {...roundShareLinks({
                day,
                slug: "ability",
                outcome: "lost",
                guesses: state.guesses.length,
              })}
              filename={`deadlockle-ability-${day}.png`}
              surface="round_result"
              mode="ability"
              dailyId={day}
            />
          }
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {answer.portrait_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={media(answer.portrait_url)}
                alt=""
                className="h-16 w-16 rounded-(--radius-card) bg-muted object-cover sm:h-20 sm:w-20"
              />
            )}
            <div className="flex-1">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-far">
                Answer
              </div>
              <div className="mt-1 font-display text-2xl text-ink sm:text-3xl">
                {answer.name}
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                {ability.name}
              </div>
              <ModeStatsLine mode="ability" />
            </div>
          </div>
        </LossReveal>
      )}

      <div className="space-y-2.5">
        <AnimatePresence initial={false}>
          {[...guessedHeroes].reverse().map((hero, revIdx) => {
            const originalIdx = guessedHeroes.length - 1 - revIdx;
            const isLatest = originalIdx === guessedHeroes.length - 1;
            return (
              <GuessCard
                key={hero.key}
                hero={hero}
                isLatest={isLatest}
                isCorrect={hero.key === answer.key}
              />
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

function GuessCard({
  hero,
  isLatest,
  isCorrect,
}: {
  hero: Hero;
  isLatest: boolean;
  isCorrect: boolean;
}) {
  return (
    <motion.div
      layout
      initial={isLatest ? { opacity: 0, y: -10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`tile-shape mx-auto flex w-full max-w-xs flex-col items-center justify-center gap-3 border px-5 py-6 ${
        isCorrect
          ? "border-correct/40 bg-correct/15"
          : "border-far/40 bg-far/15"
      }`}
    >
      {hero.portrait_url && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={media(hero.portrait_url)}
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
              src={media(ability.icon)}
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
