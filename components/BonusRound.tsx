"use client";

import { motion, AnimatePresence } from "motion/react";
import clsx from "clsx";
import type { Hero } from "@/lib/heroes";

// Ability-mode bonus: after winning the main hero guess, the player gets a
// chance to identify WHICH of that hero's four abilities the icon belonged
// to. Options show keybind (1-4) + ability name only — the icon is hidden
// because seeing it again would defeat the puzzle.
//
// Persists via ModeState.bonus on the storage layer.
export function BonusRound({
  hero,
  correctIndex,
  saved,
  onSelect,
}: {
  hero: Hero;
  correctIndex: number;
  saved: { selected: number; correct: boolean | null } | undefined;
  onSelect: (selectedIndex: number, correct: boolean) => void;
}) {
  const answered = saved != null;
  const selectedIndex = saved?.selected ?? null;

  const handlePick = (i: number) => {
    if (answered) return;
    onSelect(i, i === correctIndex);
  };

  const eyebrowText = answered
    ? saved!.correct
      ? "Bonus · Correct"
      : "Bonus · Missed"
    : "Bonus round";

  const eyebrowColor = answered
    ? saved!.correct
      ? "text-correct"
      : "text-far"
    : "text-accent-soft";

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="rounded-(--radius-card) border border-line bg-inset/40 p-5 sm:p-6"
    >
      <div className="mb-4 flex items-baseline justify-between">
        <p
          className={clsx(
            "font-mono text-[10px] uppercase tracking-[0.24em]",
            eyebrowColor,
          )}
        >
          {eyebrowText}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          {answered ? "Answer revealed" : "Pick the ability"}
        </p>
      </div>

      <p className="mb-5 max-w-md font-display text-base leading-snug text-ink sm:text-lg">
        {answered
          ? saved!.correct
            ? `Yep, that was ${hero.name}'s ${hero.abilities[correctIndex].name}.`
            : `Not quite. The icon was ${hero.name}'s ${hero.abilities[correctIndex].name}.`
          : `Which of ${hero.name}'s abilities was the icon?`}
      </p>

      <div className="grid gap-3 sm:grid-cols-4 sm:gap-3">
        {hero.abilities.map((ability, i) => {
          const isPicked = selectedIndex === i;
          const isCorrect = correctIndex === i;
          const showAsRight = answered && isCorrect;
          const showAsWrong = answered && isPicked && !saved!.correct;

          return (
            <button
              key={i}
              type="button"
              onClick={() => handlePick(i)}
              disabled={answered}
              aria-pressed={isPicked}
              className={clsx(
                "tile-shape group relative flex flex-col items-stretch gap-2 p-4 text-left transition-all",
                showAsRight
                  ? "border-2 border-correct bg-correct/15 shadow-[inset_0_0_0_1px_var(--tile-correct)]"
                  : showAsWrong
                    ? "border-2 border-far bg-far/15"
                    : isPicked
                      ? "border border-accent bg-accent/10"
                      : "border border-line bg-muted/40 hover:border-accent/60 hover:bg-accent/5",
                answered && !isPicked && !isCorrect && "opacity-40",
                answered && "cursor-default",
              )}
            >
              <div className="flex items-center gap-2">
                {/* Keybind badge — chunky monospace, matches the deco-trim
                    aesthetic of the rest of the card. The 1-4 numbers are
                    the actual default keybinds in Deadlock. */}
                <span
                  className={clsx(
                    "tile-shape inline-flex h-7 w-7 items-center justify-center font-mono text-sm font-semibold",
                    showAsRight
                      ? "bg-correct text-on-correct"
                      : showAsWrong
                        ? "bg-far text-on-far"
                        : isPicked
                          ? "bg-accent text-on-accent"
                          : "bg-canvas text-info border border-line",
                  )}
                  aria-hidden
                >
                  {i + 1}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                  Ability {i + 1}
                </span>
                {showAsRight && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      duration: 0.4,
                      ease: [0.34, 1.56, 0.64, 1],
                    }}
                    className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-correct text-[10px] font-bold text-on-correct"
                    aria-hidden
                  >
                    ✓
                  </motion.span>
                )}
                {showAsWrong && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      duration: 0.4,
                      ease: [0.34, 1.56, 0.64, 1],
                    }}
                    className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-far text-[10px] font-bold text-on-far"
                    aria-hidden
                  >
                    ✗
                  </motion.span>
                )}
              </div>
              <div
                className={clsx(
                  "font-display text-base leading-tight transition-colors",
                  showAsRight
                    ? "text-correct"
                    : showAsWrong
                      ? "text-far"
                      : "text-ink",
                )}
              >
                {ability.name}
              </div>
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {answered && hero.abilities[selectedIndex!].description && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <p className="mt-4 max-w-md text-sm text-ink-soft">
              {hero.abilities[selectedIndex!].description}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
