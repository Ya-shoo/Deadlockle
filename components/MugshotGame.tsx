"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { HEROES, HEROES_BY_KEY, type Hero } from "@/lib/heroes";
import { dayString, getMugshotForDay, prettyDay } from "@/lib/daily";
import { loadModeState, saveModeState, type ModeState } from "@/lib/storage";
import { HeroCombobox } from "./HeroCombobox";
import { GuessRow } from "./GuessRow";
import { Brand } from "./Brand";
import { media } from "@/lib/media";
import {
  trackGuessSubmitted,
  trackModeCompleted,
  trackModeStarted,
} from "@/lib/tracking";
import { NextModeCTA } from "./NextModeCTA";
import { GuessesLeftBadge } from "./GuessesLeftBadge";
import { LossReveal } from "./LossReveal";
import { ModeStatsLine } from "./ModeStatsLine";
import { ShareButton } from "./ShareButton";
import { roundShareLinks } from "@/lib/shareLinks";
import { useShareLinkVisit } from "@/lib/useShareLinkVisit";

const MODE = "mugshot";

// Hard ceiling. Five wrong guesses and the camera locks. Tightest cap of
// the lineup — the curve below is deliberately steep so the cropped
// portrait still feels like a real challenge under the cap.
const MAX_GUESSES = 5;

// Crop window zoom level by guess count. Higher = more zoomed in. Index 0
// is before any guess; each wrong guess advances the index. The curve
// extends past the player-visible window (indices 5–7) so the math stays
// well-defined if the cap is ever raised, but under MAX_GUESSES=5 the
// player only ever sees indices 0–4. The plateau at index 7 (zoom=1)
// reserves a fully-revealed frame for the future loss card without a
// cliff-edge jump.
const ZOOM_BY_GUESS = [10, 7.5, 5.5, 4, 3, 2.2, 1.5, 1];

export function MugshotGame() {
  const [day, setDay] = useState<string | null>(null);
  const [state, setState] = useState<ModeState | null>(null);
  const [hardMode, setHardMode] = useState(true);
  // Inbound share-link attribution (?c= from /r/[code] redirects).
  useShareLinkVisit("mugshot");

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
    // Restore the toggle for an in-flight round that already dropped the
    // hard-mode latch — otherwise a reload would show the switch ON while
    // the round can no longer earn the badge.
    if (st.guesses.length > 0 && st.hardMode === false) {
      setHardMode(false);
    }
  }, []);

  // mode_started — once per day. Tracker dedupes via localStorage.
  useEffect(() => {
    if (!day) return;
    const { hero } = getMugshotForDay(day);
    trackModeStarted({ mode: "mugshot", dailyId: day, answerId: hero.key });
  }, [day]);

  const stateWon = state?.won === true;
  const stateFailed = state?.failed === true || state?.gaveUp === true;
  useEffect(() => {
    if (!day) return;
    if (!stateWon && !stateFailed) return;
    const { hero } = getMugshotForDay(day);
    trackModeCompleted({
      mode: "mugshot",
      dailyId: day,
      outcome: stateWon ? "won" : state?.gaveUp === true ? "gaveUp" : "lost",
      totalGuesses: state?.guesses.length ?? 0,
      cap: MAX_GUESSES,
      answerId: hero.key,
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

  const { hero: answer, imageUrl } = getMugshotForDay(day);
  const guessedHeroes = state.guesses
    .map((k) => HEROES_BY_KEY[k])
    .filter(Boolean);
  const excludeKeys = new Set(state.guesses);

  const failed = state.failed === true || state.gaveUp === true;
  const ended = state.won || failed;

  const wrongCount = ended ? ZOOM_BY_GUESS.length - 1 : state.guesses.length;
  const zoomIdx = Math.min(wrongCount, ZOOM_BY_GUESS.length - 1);
  const zoom = ended ? 1 : ZOOM_BY_GUESS[zoomIdx];

  const handleGuess = (hero: Hero) => {
    if (ended) return;
    const newGuesses = [...state.guesses, hero.key];
    const won = hero.key === answer.key;
    const justFailed = !won && newGuesses.length >= MAX_GUESSES;
    trackGuessSubmitted({
      mode: "mugshot",
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
      // Hard-mode latch (drives the share-card badge): the first guess
      // initializes it from the toggle; afterwards it only ratchets
      // DOWN — any guess submitted with hard mode off drops it for the
      // round. Toggling off to peek between guesses doesn't count;
      // pre-feature rounds (no stored field, guesses already made) can
      // never claim it.
      hardMode:
        state.guesses.length === 0
          ? hardMode
          : state.hardMode === true && hardMode,
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
            Mugshot
          </h1>
          <p className="mt-3 max-w-md text-ink-soft">
            Identify the suspect from a cropped portrait. Each wrong guess
            pulls the camera back.
          </p>
        </div>
        <div className="hidden flex-col items-end font-mono text-xs uppercase tracking-[0.2em] text-ink-faint sm:flex">
          <Brand size="sm" />
          <span className="mt-1 text-info">mugshot mode</span>
        </div>
      </header>

      <div className="mb-8 flex flex-col items-center gap-4">
        <MugshotFrame
          imageUrl={imageUrl}
          zoom={zoom}
          revealed={ended}
          heroName={answer.name}
          grayscale={hardMode && !ended}
        />
        {!ended && (
          <HardModeToggle on={hardMode} onChange={setHardMode} />
        )}
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
              zoom {zoom.toFixed(zoom < 2 ? 2 : 1)}×
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
                    Solved
                  </div>
                  <div className="mt-1 font-display text-2xl text-ink sm:text-3xl">
                    {answer.name}{" "}
                    <span className="text-ink-soft">
                      in {state.guesses.length}
                    </span>
                  </div>
                  <ModeStatsLine mode="mugshot" />
                </div>
              </div>
              <div className="flex justify-center sm:justify-start">
                <NextModeCTA current="mugshot" />
              </div>
              {/* Share closes the card — single bottom-anchored
                  affordance, consistent across every mode. */}
              <div className="flex items-center justify-center gap-3">
                <ShareButton
                  {...roundShareLinks({
                    day,
                    slug: "mugshot",
                    outcome: "won",
                    guesses: state.guesses.length,
                    hardMode: state.hardMode === true,
                  })}
                  filename={`deadlockle-mugshot-${day}.png`}
                  surface="round_result"
                  mode="mugshot"
                  dailyId={day}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {failed && !state.won && (
        <LossReveal
          current="mugshot"
          share={
            <ShareButton
              {...roundShareLinks({
                day,
                slug: "mugshot",
                outcome: "lost",
                guesses: state.guesses.length,
                hardMode: state.hardMode === true,
              })}
              filename={`deadlockle-mugshot-${day}.png`}
              surface="round_result"
              mode="mugshot"
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
              <ModeStatsLine mode="mugshot" />
            </div>
          </div>
        </LossReveal>
      )}

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
            Look closely. Then start guessing above.
          </p>
        </div>
      )}
    </main>
  );
}

function MugshotFrame({
  imageUrl,
  zoom,
  revealed,
  heroName,
  grayscale,
}: {
  imageUrl: string;
  zoom: number;
  revealed: boolean;
  heroName: string;
  grayscale: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="tile-shape relative w-full overflow-hidden border border-line bg-muted shadow-2xl shadow-black/40"
        style={{ aspectRatio: "1 / 1", maxWidth: "min(80vw, 540px)" }}
        role="img"
        aria-label={
          revealed ? `Mugshot of ${heroName}` : "Cropped hero portrait"
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={media(imageUrl)}
          alt=""
          className="block h-full w-full object-cover transition-[transform,filter] duration-700 ease-out"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "50% 50%",
            filter: grayscale ? "grayscale(1)" : "grayscale(0)",
          }}
          loading="eager"
          decoding="async"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.45) 100%)",
          }}
        />
      </div>
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
        {on ? "on" : "off"}
      </span>
    </button>
  );
}
