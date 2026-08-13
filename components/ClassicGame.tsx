"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import { archiveMode } from "@/lib/archive";
import { media } from "@/lib/media";
import {
  trackArchiveRoundCompleted,
  trackHintUsed,
  trackModeCompleted,
  trackModeStarted,
} from "@/lib/tracking";
import { HeroCombobox } from "./HeroCombobox";
import { GuessRow } from "./GuessRow";
import { Brand } from "./Brand";
import { NextModeCTA } from "./NextModeCTA";
import { GuessesLeftBadge } from "./GuessesLeftBadge";
import { LossReveal } from "./LossReveal";
import { ModeStatsLine } from "./ModeStatsLine";
import { TextShareBlock } from "./TextShareBlock";
import { buildClassicShareText } from "@/lib/share";
import { ShareButton } from "./ShareButton";
import { roundShareLinks } from "@/lib/shareLinks";
import { useShareLinkVisit } from "@/lib/useShareLinkVisit";
import {
  ArchiveBanner,
  ArchiveOutcomeActions,
  ArchiveResultCard,
} from "./ArchivePlayChrome";

// Hard ceiling on slots. Hints count toward this — `effectiveUsed` is
// `guesses.length + hintsUsed.length`. Tenth slot hit without a correct
// guess auto-fails the puzzle.
const MAX_GUESSES = 10;

// Hint unlock thresholds, in wrong-guess count. The Nth hint becomes
// available once the player has made HINT_UNLOCK_AT[N-1] wrong guesses.
// Each hint also consumes one slot from the pool, so a player who burns
// both hints has 8 actual guesses to find the hero.
const HINT_UNLOCK_AT = [4, 7] as const;
const MAX_HINTS = HINT_UNLOCK_AT.length;

const ATTR_KEY_SET = new Set<AttrKey>(ATTRIBUTES.map((a) => a.key));

function isAttrKey(v: unknown): v is AttrKey {
  return typeof v === "string" && ATTR_KEY_SET.has(v as AttrKey);
}

export function ClassicGame({ archiveDay }: { archiveDay?: string } = {}) {
  // Archive mode: replay a past day. All archive behavior is gated on this
  // flag; when it's absent the daily code path is unchanged. State persists
  // under the streak-neutral `archive.classic` namespace (see lib/archive).
  const archive = archiveDay != null;
  const storageMode = archive ? archiveMode("classic") : "classic";

  const [day, setDay] = useState<string | null>(null);
  const [state, setState] = useState<ModeState | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Inbound share-link attribution (?c= from /r/[code] redirects). A no-op
  // on archive pages (they carry ?d=, never ?c=).
  useShareLinkVisit("classic");

  useEffect(() => {
    const d = archiveDay ?? dayString();
    setDay(d);
    let st = loadModeState(storageMode, d);
    const hintsLen = (st.hintsUsed ?? []).length;
    if (
      !st.won &&
      !st.failed &&
      !st.gaveUp &&
      st.guesses.length + hintsLen >= MAX_GUESSES
    ) {
      st = { ...st, failed: true };
      saveModeState(storageMode, st);
    }
    setState(st);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archiveDay]);

  // Sticky answer in archive: prefer the hero stamped into the stored state
  // so a replayed day stays pinned even if the daily bag reshuffles later.
  // A fresh, never-played archive day (and the live daily) falls back to the
  // deterministic day derivation.
  const answer = useMemo(() => {
    if (!day) return null;
    if (archive) {
      const pinned = state?.answerKey ? HEROES_BY_KEY[state.answerKey] : null;
      if (pinned) return pinned;
    }
    return getHeroForDay(day);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, archive, state?.answerKey]);

  // mode_started — fires once per day on first mount (the tracker
  // dedupes via localStorage marker, so this is safe to re-run across
  // remounts). NEVER fires from archive: the daily funnel stays pristine.
  useEffect(() => {
    if (!day || !answer || archive) return;
    trackModeStarted({ mode: "classic", dailyId: day, answerId: answer.key });
  }, [day, answer, archive]);

  // mode_completed — fires once when the puzzle transitions to a
  // terminal state (won or failed). Tracker dedupes; the effect just
  // re-runs cheaply when the terminal flags or counts change. NEVER fires
  // from archive (archive uses trackArchiveRoundCompleted instead).
  const stateWon = state?.won === true;
  const stateFailed =
    state?.failed === true || state?.gaveUp === true;
  useEffect(() => {
    if (!day || !answer || archive) return;
    if (!stateWon && !stateFailed) return;
    const guessesLen = state?.guesses.length ?? 0;
    const hintsLen = state?.hintsUsed?.length ?? 0;
    trackModeCompleted({
      mode: "classic",
      dailyId: day,
      outcome: stateWon ? "won" : state?.gaveUp === true ? "gaveUp" : "lost",
      totalGuesses: guessesLen,
      cap: MAX_GUESSES,
      hintsUsed: hintsLen,
      answerId: answer.key,
      guessIds: state?.guesses ?? [],
    });
  }, [
    day,
    answer,
    archive,
    stateWon,
    stateFailed,
    state?.guesses,
    state?.hintsUsed?.length,
    state?.gaveUp,
  ]);

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
      <main className={`mx-auto ${archive ? "max-w-2xl" : "max-w-6xl"} px-6 py-16`}>
        <div className="font-mono text-xs uppercase tracking-[0.2em] text-ink-faint">
          Loading…
        </div>
      </main>
    );
  }

  const excludeKeys = new Set(state.guesses);

  const failed = state.failed === true || state.gaveUp === true;
  const ended = state.won || failed;
  const effectiveUsed = state.guesses.length + hintsUsed.length;
  const effectiveRemaining = Math.max(0, MAX_GUESSES - effectiveUsed);

  // Redemption: this past day was LOST when played live, and the player has
  // now won it in the archive — the grid cell flips red → green. Only ever
  // read in archive mode.
  const redeemedLiveLoss =
    archive &&
    state.won &&
    (() => {
      const live = loadModeState("classic", day);
      return live.failed === true || live.gaveUp === true;
    })();

  // Archive-only: stamp the resolved answer key so a replayed day stays
  // pinned to this hero even if the daily bag reshuffles later.
  const withAnswerKey = (st: ModeState): ModeState =>
    archive ? { ...st, answerKey: answer.key } : st;

  const handleGuess = (hero: Hero) => {
    if (ended) return;
    const newGuesses = [...state.guesses, hero.key];
    const won = hero.key === answer.key;
    const newEffective = newGuesses.length + hintsUsed.length;
    const justFailed = !won && newEffective >= MAX_GUESSES;
    const next: ModeState = withAnswerKey({
      ...state,
      guesses: newGuesses,
      won,
      failed: justFailed ? true : state.failed,
    });
    setState(next);
    saveModeState(storageMode, next);
    if (archive && (won || justFailed)) {
      trackArchiveRoundCompleted({
        mode: "classic",
        day,
        outcome: won ? "won" : "lost",
        guesses: newGuesses.length,
        hints: hintsUsed.length,
      });
    }
  };

  // Archive "Play again" — wipe the round back to empty in the archive
  // namespace only, re-stamping the pinned answer. Unused by the daily.
  const resetRound = () => {
    const fresh = withAnswerKey({ day, guesses: [], hintsUsed: [], won: false });
    setConfirmOpen(false);
    setState(fresh);
    saveModeState(storageMode, fresh);
  };

  // Hint gates:
  //   (1) hints remain (under MAX_HINTS)
  //   (2) at least 2 effective slots remain — burning a hint with only
  //       1 slot left would auto-fail the puzzle without giving the player
  //       a chance to act on the reveal, so we hard-lock there.
  //   (3) the natural threshold is hit OR the player is on their
  //       2nd-to-last slot (safety rescue rule — keeps the next hint
  //       available even if the threshold hasn't been met yet).
  const nextHintIndex = hintsUsed.length;
  const hintsRemaining = MAX_HINTS - nextHintIndex;
  const tooFewSlots = effectiveRemaining <= 1;
  const thresholdMet =
    nextHintIndex < MAX_HINTS &&
    state.guesses.length >= HINT_UNLOCK_AT[nextHintIndex];
  const safetyMet = effectiveRemaining === 2;

  const eligibleForHint = Array.from(unsolvedAttrs).filter(
    (k) => !hintsUsed.includes(k),
  );
  const canUseHint =
    !ended &&
    hintsRemaining > 0 &&
    !tooFewSlots &&
    (thresholdMet || safetyMet) &&
    eligibleForHint.length > 0;

  const nextThreshold = HINT_UNLOCK_AT.find(
    (t) => state.guesses.length < t,
  ) ?? null;
  const guessesUntilNext =
    nextThreshold != null && hintsUsed.length < MAX_HINTS && !safetyMet
      ? nextThreshold - state.guesses.length
      : null;

  const confirmHint = () => {
    if (!canUseHint) {
      setConfirmOpen(false);
      return;
    }
    const pick =
      eligibleForHint[Math.floor(Math.random() * eligibleForHint.length)];
    const newHints = [...hintsUsed, pick];
    const newEffective = state.guesses.length + newHints.length;
    const justFailed = !state.won && newEffective >= MAX_GUESSES;
    // hint_used is a daily analytics event — never fire it from archive.
    if (!archive) {
      trackHintUsed({
        mode: "classic",
        dailyId: day,
        hintIndex: hintsUsed.length,
        atGuessNumber: state.guesses.length,
        attributeRevealed: pick,
      });
    }
    const next: ModeState = withAnswerKey({
      ...state,
      hintsUsed: newHints,
      failed: justFailed ? true : state.failed,
    });
    setState(next);
    saveModeState(storageMode, next);
    setConfirmOpen(false);
    // A hint can burn the last slot and end the round — count it in archive.
    if (archive && justFailed) {
      trackArchiveRoundCompleted({
        mode: "classic",
        day,
        outcome: "lost",
        guesses: state.guesses.length,
        hints: newHints.length,
      });
    }
  };

  return (
    <main className={`mx-auto ${archive ? "max-w-2xl" : "max-w-6xl"} px-4 py-10 sm:px-6 lg:py-16`}>
      {archive ? (
        <>
          <ArchiveBanner />
          <header className="mb-10">
            <Link
              href="/archive/classic/"
              className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint transition-colors hover:text-accent"
            >
              <span aria-hidden>←</span> Archive
            </Link>
            <p className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-info">
              {prettyDay(day)}
            </p>
            <h1 className="mt-2 font-display display-headline text-4xl text-ink sm:text-5xl">
              Classic
            </h1>
            <p className="mt-2 max-w-md text-ink-soft">
              Replaying a past puzzle. Match the seven attributes.
            </p>
          </header>
        </>
      ) : (
        <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-info">
              <span suppressHydrationWarning>{prettyDay(day)}</span>
            </p>
            <h1 className="mt-3 font-display display-headline text-5xl text-ink sm:text-6xl">
              Classic
            </h1>
            <p className="mt-3 max-w-md text-ink-soft">
              Type a hero. Match the seven attributes. New puzzle daily.
            </p>
          </div>
          <div className="hidden flex-col items-end font-mono text-xs uppercase tracking-[0.2em] text-ink-faint sm:flex">
            <Brand size="sm" />
            <span className="mt-1 text-info">classic mode</span>
          </div>
        </header>
      )}

      {!ended && (
        <div className="mb-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <GuessesLeftBadge used={effectiveUsed} cap={MAX_GUESSES} />
            <HintControls
              canUseHint={canUseHint}
              hintsRemaining={hintsRemaining}
              hintsUsed={hintsUsed.length}
              tooFewSlots={tooFewSlots}
              guessesUntilNext={guessesUntilNext}
              onOpen={() => setConfirmOpen(true)}
            />
          </div>
          <HeroCombobox
            heroes={HEROES}
            excludeKeys={excludeKeys}
            onSelect={handleGuess}
          />
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
                A random unsolved attribute will be revealed. Each hint costs
                one of your remaining guesses (max {MAX_HINTS} per puzzle).
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
                  {hintsUsed.length > 0 && (
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-accent-soft">
                      💡 {hintsUsed.length}{" "}
                      {hintsUsed.length === 1 ? "hint" : "hints"}
                    </div>
                  )}
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
                    {hintsUsed.length > 0 &&
                      ` · ${hintsUsed.length} hint${hintsUsed.length === 1 ? "" : "s"}`}
                  </div>
                </div>
              </ArchiveResultCard>
            )}
          </AnimatePresence>

          {ended && (
            <ArchiveOutcomeActions
              mode="classic"
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
                exit={{ opacity: 0, y: -12 }}
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
                      <ModeStatsLine mode="classic" />
                    </div>
                  </div>
                  <div className="flex justify-center sm:justify-start">
                    <NextModeCTA current="classic" />
                  </div>
                  {/* Emoji-grid text share — the guess path as 🟩🟨🟥 rows
                      (latest first, capped), ported from OWdle Classic.
                      Zero-friction copy/paste into Discord / group chats.
                      The embedded URL is the personalized /r/<code> link,
                      so even the text share unfurls the result card where
                      chats render previews. The link-first ShareButton
                      rides in the block's action row — ONE share affordance
                      per card, at the bottom. */}
                  <TextShareBlock
                    text={buildClassicShareText({
                      guesses: state.guesses,
                      answer,
                      won: true,
                      hints: hintsUsed.length,
                      url: roundShareLinks({
                        day,
                        slug: "classic",
                        outcome: "won",
                        guesses: state.guesses.length,
                        hints: hintsUsed.length,
                      }).url,
                    })}
                    surface="round_result"
                    mode="classic"
                    dailyId={day}
                    share={
                      <ShareButton
                        {...roundShareLinks({
                          day,
                          slug: "classic",
                          outcome: "won",
                          guesses: state.guesses.length,
                          hints: hintsUsed.length,
                        })}
                        filename={`deadlockle-classic-${day}.png`}
                        surface="round_result"
                        mode="classic"
                        dailyId={day}
                      />
                    }
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {failed && !state.won && (
            <LossReveal
              current="classic"
              share={
                <ShareButton
                  {...roundShareLinks({
                    day,
                    slug: "classic",
                    outcome: "lost",
                    guesses: state.guesses.length,
                    hints: hintsUsed.length,
                  })}
                  filename={`deadlockle-classic-${day}.png`}
                  surface="round_result"
                  mode="classic"
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
                    {state.guesses.length}{" "}
                    {state.guesses.length === 1 ? "guess" : "guesses"}
                    {hintsUsed.length > 0 &&
                      ` · ${hintsUsed.length} hint${hintsUsed.length === 1 ? "" : "s"}`}
                  </div>
                  <ModeStatsLine mode="classic" />
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
            Start by typing a hero name above.
          </p>
        </div>
      )}
    </main>
  );
}

// Hint button + supporting microcopy. Three visible states:
//   - Available: amber pill, opens the confirm modal on click. Tagline
//     `Hint ×N · costs a guess` so the player knows the trade-off without
//     having to read the modal.
//   - Locked (too few slots): muted pill, non-interactive. Surfaces a
//     short "1 guess left — use it" line so the player understands why
//     the button stopped responding.
//   - Locked (threshold not met): countdown microcopy showing how many
//     more wrong guesses unlock the next hint.
function HintControls({
  canUseHint,
  hintsRemaining,
  hintsUsed,
  tooFewSlots,
  guessesUntilNext,
  onOpen,
}: {
  canUseHint: boolean;
  hintsRemaining: number;
  hintsUsed: number;
  tooFewSlots: boolean;
  guessesUntilNext: number | null;
  onOpen: () => void;
}) {
  if (canUseHint) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex items-center gap-2 rounded-(--radius-pill) border border-accent/60 bg-accent/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-accent transition hover:bg-accent/20"
      >
        <span>Hint ×{hintsRemaining}</span>
        <span className="text-ink-faint">· costs a guess</span>
      </button>
    );
  }
  if (tooFewSlots && hintsRemaining > 0) {
    return (
      <span className="inline-flex items-center gap-2 rounded-(--radius-pill) border border-line bg-muted/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
        Hint locked · 1 guess left
      </span>
    );
  }
  if (hintsRemaining > 0 && guessesUntilNext != null) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
        Next hint in {guessesUntilNext}{" "}
        {guessesUntilNext === 1 ? "guess" : "guesses"}
      </span>
    );
  }
  if (hintsUsed >= MAX_HINTS) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
        Hints used
      </span>
    );
  }
  return null;
}
