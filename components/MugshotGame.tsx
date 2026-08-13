"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { HEROES, HEROES_BY_KEY, type Hero } from "@/lib/heroes";
import { dayString, getMugshotForDay, prettyDay } from "@/lib/daily";
import { loadModeState, saveModeState, type ModeState } from "@/lib/storage";
import { archiveMode } from "@/lib/archive";
import { HeroCombobox } from "./HeroCombobox";
import { GuessRow } from "./GuessRow";
import { Brand } from "./Brand";
import { media } from "@/lib/media";
import {
  trackArchiveRoundCompleted,
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
import {
  ArchiveBanner,
  ArchiveOutcomeActions,
  ArchiveResultCard,
} from "./ArchivePlayChrome";

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

export function MugshotGame({ archiveDay }: { archiveDay?: string } = {}) {
  // Archive mode: replay a past day. All archive behavior is gated on this
  // flag; when it's absent the daily code path is unchanged. State persists
  // under the streak-neutral `archive.mugshot` namespace (see lib/archive).
  const archive = archiveDay != null;
  const storageMode = archive ? archiveMode(MODE) : MODE;

  const [day, setDay] = useState<string | null>(null);
  const [state, setState] = useState<ModeState | null>(null);
  const [hardMode, setHardMode] = useState(true);
  // Inbound share-link attribution (?c= from /r/[code] redirects). A no-op
  // on archive pages (they carry ?d=, never ?c=), so it's safe to always run
  // and keeps the hook order stable.
  useShareLinkVisit("mugshot");

  useEffect(() => {
    const d = archiveDay ?? dayString();
    setDay(d);
    let st = loadModeState(storageMode, d);
    if (
      !st.won &&
      !st.failed &&
      !st.gaveUp &&
      st.guesses.length >= MAX_GUESSES
    ) {
      st = { ...st, failed: true };
      saveModeState(storageMode, st);
    }
    setState(st);
    // Restore the toggle for an in-flight round that already dropped the
    // hard-mode latch — otherwise a reload would show the switch ON while
    // the round can no longer earn the badge.
    if (st.guesses.length > 0 && st.hardMode === false) {
      setHardMode(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archiveDay]);

  // mode_started — once per day. Tracker dedupes via localStorage. NEVER
  // fires from archive: the daily funnel stays pristine.
  useEffect(() => {
    if (!day || archive) return;
    const { hero } = getMugshotForDay(day);
    trackModeStarted({ mode: "mugshot", dailyId: day, answerId: hero.key });
  }, [day, archive]);

  const stateWon = state?.won === true;
  const stateFailed = state?.failed === true || state?.gaveUp === true;
  useEffect(() => {
    if (!day || archive) return;
    if (!stateWon && !stateFailed) return;
    const { hero } = getMugshotForDay(day);
    trackModeCompleted({
      mode: "mugshot",
      dailyId: day,
      outcome: stateWon ? "won" : state?.gaveUp === true ? "gaveUp" : "lost",
      totalGuesses: state?.guesses.length ?? 0,
      cap: MAX_GUESSES,
      answerId: hero.key,
      guessIds: state?.guesses ?? [],
    });
  }, [day, archive, stateWon, stateFailed, state?.guesses, state?.gaveUp]);

  if (!day || !state) {
    return (
      <main className={`mx-auto ${archive ? "max-w-2xl" : "max-w-6xl"} px-6 py-16`}>
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

  // Redemption: this past day was LOST when played live, and the player has
  // now won it in the archive — the grid cell flips red → green. Only ever
  // read in archive mode.
  const redeemedLiveLoss =
    archive &&
    state.won &&
    (() => {
      const live = loadModeState(MODE, day);
      return live.failed === true || live.gaveUp === true;
    })();

  const wrongCount = ended ? ZOOM_BY_GUESS.length - 1 : state.guesses.length;
  const zoomIdx = Math.min(wrongCount, ZOOM_BY_GUESS.length - 1);
  const zoom = ended ? 1 : ZOOM_BY_GUESS[zoomIdx];

  const handleGuess = (hero: Hero) => {
    if (ended) return;
    const newGuesses = [...state.guesses, hero.key];
    const won = hero.key === answer.key;
    const justFailed = !won && newGuesses.length >= MAX_GUESSES;
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
    saveModeState(storageMode, next);
    // Archive-only completion event, fired from the terminating action so a
    // resume/reload never re-counts. Daily funnel events never fire here.
    if (archive && (won || justFailed)) {
      trackArchiveRoundCompleted({
        mode: "mugshot",
        day,
        outcome: won ? "won" : "lost",
        guesses: newGuesses.length,
        hints: 0,
      });
    }
  };

  // Archive "Play again" — wipe the round back to empty in the archive
  // namespace only. Unused by the daily.
  const resetRound = () => {
    const fresh: ModeState = { day, guesses: [], won: false };
    setHardMode(true);
    setState(fresh);
    saveModeState(storageMode, fresh);
  };

  return (
    <main className={`mx-auto ${archive ? "max-w-2xl" : "max-w-6xl"} px-4 py-10 sm:px-6 lg:py-16`}>
      {archive ? (
        <>
          <ArchiveBanner />
          <header className="mb-8">
            <Link
              href="/archive/mugshot/"
              className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint transition-colors hover:text-accent"
            >
              <span aria-hidden>←</span> Archive
            </Link>
            <p className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-info">
              {prettyDay(day)}
            </p>
            <h1 className="mt-2 font-display display-headline text-4xl text-ink sm:text-5xl">
              Mugshot
            </h1>
            <p className="mt-2 max-w-md text-ink-soft">
              Replaying a past puzzle. Identify the suspect as the camera pulls
              back.
            </p>
          </header>
        </>
      ) : (
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
      )}

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

      {archive ? (
        <>
          <AnimatePresence>
            {state.won && (
              <ArchiveResultCard key="win" tone="won">
                {answer.portrait_url && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={media(answer.portrait_url)}
                    alt=""
                    className="h-16 w-16 rounded-(--radius-card) bg-surface object-cover sm:h-20 sm:w-20"
                  />
                )}
                <div className="flex-1">
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-info">
                    {redeemedLiveLoss ? "Redeemed" : "Solved"}
                  </div>
                  <div className="mt-1 font-display text-2xl text-ink sm:text-3xl">
                    {answer.name}{" "}
                    <span className="text-ink-soft">
                      in {state.guesses.length}
                    </span>
                  </div>
                  {redeemedLiveLoss && (
                    <div className="mt-1 text-sm text-correct">
                      Turned a red day green. Your record for this day now
                      shows a win.
                    </div>
                  )}
                </div>
              </ArchiveResultCard>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {failed && !state.won && (
              <ArchiveResultCard key="loss" tone="lost">
                {answer.portrait_url && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={media(answer.portrait_url)}
                    alt=""
                    className="h-16 w-16 rounded-(--radius-card) bg-surface object-cover sm:h-20 sm:w-20"
                  />
                )}
                <div className="flex-1">
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-far">
                    Missed
                  </div>
                  <div className="mt-1 font-display text-2xl text-ink sm:text-3xl">
                    {answer.name}
                  </div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                    {state.guesses.length}{" "}
                    {state.guesses.length === 1 ? "guess" : "guesses"}
                  </div>
                </div>
              </ArchiveResultCard>
            )}
          </AnimatePresence>

          {ended && (
            <ArchiveOutcomeActions
              mode="mugshot"
              day={day}
              onReplay={resetRound}
            />
          )}
        </>
      ) : (
        <>
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
        </>
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
          className="puzzle-art block h-full w-full object-cover transition-[transform,filter] duration-700 ease-out"
          draggable={false}
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
