"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ITEMS, ITEMS_BY_KEY, type Item } from "@/lib/items";
import {
  dayString,
  getItemForDay,
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
import { ItemCombobox } from "./ItemCombobox";
import { Brand } from "./Brand";
import { NextModeCTA } from "./NextModeCTA";
import { GuessesLeftBadge } from "./GuessesLeftBadge";
import { LossReveal } from "./LossReveal";
import { ModeStatsLine } from "./ModeStatsLine";
import { ShareButton } from "./ShareButton";
import { roundShareLinks } from "@/lib/shareLinks";
import { useShareLinkVisit } from "@/lib/useShareLinkVisit";

const MODE = "item";

// Hard ceiling on guesses. Eighth wrong guess auto-fails the puzzle and
// reveals the answer in a muted red card. Curve below is calibrated so the
// final available guess (index 7) lands on blur=0 — the player always has
// a fully crisp icon for their last shot, so a miss never feels like the
// blur cheated them.
const MAX_GUESSES = 8;

// Blur reveal: each guess sharpens the icon. Index 0 = before any guess.
// A win locks the final crisp state. Starting blur is moderate so the
// silhouette and palette of the icon are partially readable — the icon set
// is large enough that being unfair on guess #1 isn't satisfying.
const BLUR_BY_GUESS = [20, 16, 12, 8, 5, 3, 1.5, 0];

// Hard mode rotates the icon by a deterministic per-day amount. Toggle is
// session-only — flipping it doesn't affect saved state, just the visual.
const HARD_MODE_ROTATIONS = [90, 180, 270];

const SLOT_TINT: Record<Item["slot"], { fg: string; bg: string }> = {
  weapon: { fg: "text-[#e07a4f]", bg: "bg-[#e07a4f]/10" },
  vitality: { fg: "text-[#7fb86c]", bg: "bg-[#7fb86c]/10" },
  spirit: { fg: "text-[#9d7fc7]", bg: "bg-[#9d7fc7]/10" },
};

export function ItemGame() {
  const [day, setDay] = useState<string | null>(null);
  const [state, setState] = useState<ModeState | null>(null);
  // Hard mode defaults to ON — the icon catalogue is tightly themed so a
  // straight blur fades to a recognizable shape too easily; rotation is the
  // real differentiator. Players who want a softer puzzle can toggle off.
  const [hardMode, setHardMode] = useState(true);
  // Inbound share-link attribution (?c= from /r/[code] redirects).
  useShareLinkVisit("item");

  useEffect(() => {
    const d = dayString();
    setDay(d);
    let st = loadModeState(MODE, d);
    // Self-heal stale saves from before the cap shipped (or shrank). If
    // the player has already passed the current cap without winning,
    // commit the failed flag so downstream consumers see it.
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

  // mode_started — once per day. Tracker dedupes via localStorage.
  useEffect(() => {
    if (!day) return;
    const { item } = getItemForDay(day);
    trackModeStarted({ mode: "item", dailyId: day, answerId: item.key });
  }, [day]);

  const stateWon = state?.won === true;
  const stateFailed = state?.failed === true || state?.gaveUp === true;
  useEffect(() => {
    if (!day) return;
    if (!stateWon && !stateFailed) return;
    const { item } = getItemForDay(day);
    trackModeCompleted({
      mode: "item",
      dailyId: day,
      outcome: stateWon ? "won" : state?.gaveUp === true ? "gaveUp" : "lost",
      totalGuesses: state?.guesses.length ?? 0,
      cap: MAX_GUESSES,
      answerId: item.key,
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

  const { item: answer, iconUrl } = getItemForDay(day);
  const guessedItems = state.guesses
    .map((k) => ITEMS_BY_KEY[k])
    .filter(Boolean);
  const excludeKeys = new Set(state.guesses);

  const failed = state.failed === true || state.gaveUp === true;
  const ended = state.won || failed;

  const wrongCount = ended ? BLUR_BY_GUESS.length - 1 : state.guesses.length;
  const blurIdx = Math.min(wrongCount, BLUR_BY_GUESS.length - 1);
  const blur = ended ? 0 : BLUR_BY_GUESS[blurIdx];

  // Per-day rotation seed — same item, same day always rotates the same way
  // when hard mode is on, so the share text is comparable across players.
  const rotationIdx = shuffleOrder(`deadlockle:item:rotate:${day}`, 3)[0];
  const rotationDeg =
    hardMode && !ended ? HARD_MODE_ROTATIONS[rotationIdx] : 0;

  const handleGuess = (item: Item) => {
    if (ended) return;
    const newGuesses = [...state.guesses, item.key];
    const won = item.key === answer.key;
    const justFailed = !won && newGuesses.length >= MAX_GUESSES;
    trackGuessSubmitted({
      mode: "item",
      dailyId: day,
      guessNumber: newGuesses.length,
      isCorrect: won,
      guessId: item.key,
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-16">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-info">
            <span suppressHydrationWarning>{prettyDay(day)}</span>
          </p>
          <h1 className="mt-3 font-display display-headline text-5xl text-ink sm:text-6xl">
            Item
          </h1>
          <p className="mt-3 max-w-md text-ink-soft">
            Which Deadlock item is this? Each guess sharpens the icon.
          </p>
        </div>
        <div className="hidden flex-col items-end font-mono text-xs uppercase tracking-[0.2em] text-ink-faint sm:flex">
          <Brand size="sm" />
          <span className="mt-1 text-info">item mode</span>
        </div>
      </header>

      <div className="mb-8 flex flex-col items-center gap-4">
        <ItemBlurCard
          iconUrl={iconUrl}
          blur={blur}
          rotation={rotationDeg}
          revealed={ended}
          item={answer}
        />
        {!ended && (
          <HardModeToggle on={hardMode} onChange={setHardMode} />
        )}
      </div>

      {!ended && (
        <div className="mb-6">
          <ItemCombobox
            items={ITEMS}
            excludeKeys={excludeKeys}
            onSelect={handleGuess}
          />
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <GuessesLeftBadge
              used={state.guesses.length}
              cap={MAX_GUESSES}
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
              blur {blur.toFixed(1)}px
            </span>
          </div>
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
                {answer.icon && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={media(answer.icon)}
                    alt=""
                    className="h-16 w-16 rounded-(--radius-card) bg-muted object-contain p-2 sm:h-20 sm:w-20"
                  />
                )}
                <div className="flex-1">
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-info">
                    Solved
                  </div>
                  <div className="mt-1 font-display text-2xl text-ink sm:text-3xl">
                    {answer.name}{" "}
                    <span className="text-ink-soft">
                      in {state.guesses.length}
                    </span>
                  </div>
                  <ModeStatsLine mode="item" />
                </div>
              </div>
              <div className="flex justify-center sm:justify-start">
                <NextModeCTA current="item" />
              </div>
              {/* Share closes the card — single bottom-anchored
                  affordance, consistent across every mode. */}
              <div className="flex items-center justify-center gap-3">
                <ShareButton
                  {...roundShareLinks({
                    day,
                    slug: "item",
                    outcome: "won",
                    guesses: state.guesses.length,
                  })}
                  filename={`deadlockle-item-${day}.png`}
                  surface="round_result"
                  mode="item"
                  dailyId={day}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {failed && !state.won && (
        <LossReveal
          current="item"
          share={
            <ShareButton
              {...roundShareLinks({
                day,
                slug: "item",
                outcome: "lost",
                guesses: state.guesses.length,
              })}
              filename={`deadlockle-item-${day}.png`}
              surface="round_result"
              mode="item"
              dailyId={day}
            />
          }
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {answer.icon && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={media(answer.icon)}
                alt=""
                className="h-16 w-16 rounded-(--radius-card) bg-muted object-contain p-2 sm:h-20 sm:w-20"
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
                T{answer.tier ?? "?"} · {answer.slot}
                {answer.cost != null && ` · ${answer.cost.toLocaleString()} souls`}
              </div>
              <ModeStatsLine mode="item" />
            </div>
          </div>
        </LossReveal>
      )}

      {/* Guess history — items only, since item attribute comparison would
          give away the slot/tier on the first guess. Just stack the guessed
          icons + names in reverse order. */}
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {[...guessedItems].reverse().map((it) => {
            const tint = SLOT_TINT[it.slot];
            return (
              <motion.li
                key={it.key}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className={`flex items-center gap-3 border border-line ${tint.bg} rounded-(--radius-card) p-3`}
              >
                {it.icon && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={media(it.icon)}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-sm bg-muted object-contain"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-base text-ink">
                    {it.name}
                  </div>
                  <div
                    className={`truncate font-mono text-[10px] uppercase tracking-[0.18em] ${tint.fg}`}
                  >
                    T{it.tier ?? "?"} · {it.slot}
                  </div>
                </div>
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-far">
                  Miss
                </span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      {state.guesses.length === 0 && (
        <div className="mt-10 rounded-(--radius-card) border border-dashed border-line bg-inset/40 p-8 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-faint">
            The icon is blurred. Type an item name to start sharpening it.
          </p>
        </div>
      )}
    </main>
  );
}

function ItemBlurCard({
  iconUrl,
  blur,
  rotation,
  revealed,
  item,
}: {
  iconUrl: string;
  blur: number;
  rotation: number;
  revealed: boolean;
  item: Item;
}) {
  return (
    <div className="flex flex-col items-center gap-5">
      <div
        className="relative tile-shape overflow-hidden border border-line bg-muted/40 shadow-2xl shadow-black/40"
        style={{ width: 240, height: 240 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={media(iconUrl)}
          alt={revealed ? item.name : "Mystery item"}
          className="puzzle-art h-full w-full object-contain p-6 transition-[filter,transform] duration-700 ease-out"
          draggable={false}
          style={{
            filter: `blur(${blur}px)`,
            transform: `rotate(${rotation}deg)`,
          }}
          loading="eager"
          decoding="async"
        />
      </div>
      {revealed && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="text-center"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-info">
            T{item.tier ?? "?"} · {item.slot}
          </p>
          <p className="mt-1 font-display text-2xl text-ink">{item.name}</p>
          {item.cost != null && (
            <p className="mt-1 font-mono text-xs text-ink-soft">
              {item.cost.toLocaleString()} souls
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}

function HardModeToggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`group flex items-center gap-2.5 border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${
        on
          ? "border-edge bg-accent/10 text-accent-soft"
          : "border-line text-ink-faint hover:border-edge hover:text-ink-soft"
      }`}
    >
      <span
        className={`relative inline-flex h-4 w-7 items-center border transition-colors ${
          on ? "border-edge bg-accent/20" : "border-line bg-canvas"
        }`}
      >
        <span
          aria-hidden
          className={`absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 transition-all ${
            on ? "left-[calc(100%-13px)] bg-accent" : "left-[2px] bg-line"
          }`}
        />
      </span>
      <span>Hard mode</span>
      <span
        className={`text-[9px] tracking-[0.18em] ${
          on ? "text-accent-soft" : "text-ink-faint"
        }`}
      >
        {on ? "rotated" : "off"}
      </span>
    </button>
  );
}

