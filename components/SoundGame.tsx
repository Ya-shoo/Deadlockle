"use client";

// Conversation mode (slug "sound") is the audio-augmented sibling of Quote
// mode. Same two-speaker exchange puzzle: each guess reveals the next line
// of dialogue. After FIRST_HINT_AT wrong guesses, the Play button on line 1
// unlocks; every HINT_INTERVAL guesses past that, the next line's button
// unlocks (4 → line 1, 7 → line 2, 10 → line 3 (never fires under cap)).
// Every clip is a slice of the actual wiki recording — players hear the
// heroes saying that exact line. The slices come from
// build-conversation-audio.mjs (silence-detected per-line ranges within a
// single MP3 per conversation).

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { HEROES, HEROES_BY_KEY, type Hero } from "@/lib/heroes";
import {
  dayString,
  getSoundByIndex,
  getSoundForDay,
  prettyDay,
  SOUND_POOL_SIZE,
} from "@/lib/daily";
import { IS_DEV_BUILD } from "@/lib/modes";
import { archiveMode } from "@/lib/archive";
import type { SoundConversation } from "@/lib/sound-conversations";
import { compareHero } from "@/lib/compare";
import {
  loadConversationState,
  saveConversationState,
  type ConversationGuess,
  type ConversationState,
} from "@/lib/storage";
import { HeroCombobox } from "./HeroCombobox";
import { AttributeTile } from "./AttributeTile";
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
import { SpeakerToggle } from "./SpeakerToggle";
import { ShareButton } from "./ShareButton";
import { roundShareLinks } from "@/lib/shareLinks";
import { useShareLinkVisit } from "@/lib/useShareLinkVisit";
import {
  ArchiveBanner,
  ArchiveOutcomeActions,
  ArchiveResultCard,
} from "./ArchivePlayChrome";
import clsx from "clsx";

const MODE = "sound";

// Hard ceiling. Eight wrong guesses across both speakers and the puzzle
// auto-fails. Two-target mode (each guess is for a specific speaker), so
// the cap is shared across both A and B picks.
const MAX_GUESSES = 8;

// Hint cadence: line 1's audio unlocks after FIRST_HINT_AT wrong guesses;
// each subsequent line unlocks every HINT_INTERVAL more (4 → line 1,
// 7 → line 2, 10 → line 3, …). The 10+ thresholds never fire under
// MAX_GUESSES=8, but the formula keeps working if the cap is raised.
const FIRST_HINT_AT = 4;
const HINT_INTERVAL = 3;

function hintsUnlockedAt(guessCount: number, totalLines: number): number {
  if (guessCount < FIRST_HINT_AT) return 0;
  return Math.min(
    1 + Math.floor((guessCount - FIRST_HINT_AT) / HINT_INTERVAL),
    totalLines,
  );
}

function nextHintAtGuess(currentUnlocked: number): number {
  if (currentUnlocked === 0) return FIRST_HINT_AT;
  return FIRST_HINT_AT + currentUnlocked * HINT_INTERVAL;
}

export function SoundGame({ archiveDay }: { archiveDay?: string } = {}) {
  // Archive mode: replay a past day. All archive behavior is gated on this
  // flag; when it's absent the daily code path is unchanged. State persists
  // under the streak-neutral `archive.sound` namespace (see lib/archive).
  const archive = archiveDay != null;
  const storageMode = archive ? archiveMode(MODE) : MODE;

  const [day, setDay] = useState<string | null>(null);
  const [state, setState] = useState<ConversationState | null>(null);
  // Inbound share-link attribution (?c= from /r/[code] redirects). A no-op
  // on archive pages (they carry ?d=, never ?c=).
  useShareLinkVisit("sound");
  // Which speaker the toggle is pointed at when *both* are still unsolved.
  // Once one is solved, the derived `activeTarget` below forces the other.
  const [chosenTarget, setChosenTarget] = useState<0 | 1>(0);
  // Dev-only override: `/sound/?conv=N` pins the conversation to pool
  // index N so the diarization splits can be QA'd across many clips
  // without waiting for the daily seed to roll over. Null in production
  // and on first paint; populated from URL on mount. Never used in archive.
  const [devConvIdx, setDevConvIdx] = useState<number | null>(null);

  useEffect(() => {
    const d = archiveDay ?? dayString();
    setDay(d);

    // Read ?conv=N from URL (dev only). Treat anything outside [0, pool)
    // as null so a stray query string doesn't break the regular flow.
    // Archive replays a fixed past day — never honor the dev override.
    let convIdx: number | null = null;
    if (!archive && IS_DEV_BUILD && typeof window !== "undefined") {
      const param = new URLSearchParams(window.location.search).get("conv");
      const parsed = param == null ? NaN : parseInt(param, 10);
      if (Number.isFinite(parsed) && parsed >= 0 && parsed < SOUND_POOL_SIZE) {
        convIdx = parsed;
      }
    }
    setDevConvIdx(convIdx);

    const { speakers: today } =
      convIdx != null ? getSoundByIndex(convIdx) : getSoundForDay(d);
    const todayPair: [string, string] = [today[0].key, today[1].key];
    const loaded = loadConversationState(storageMode, d);
    const matchesToday =
      loaded.speakers?.[0] === todayPair[0] &&
      loaded.speakers?.[1] === todayPair[1];
    if (loaded.guesses.length > 0 && !matchesToday) {
      const fresh: ConversationState = {
        day: d,
        speakers: todayPair,
        guesses: [],
        won: false,
      };
      setState(fresh);
      // Don't persist dev-override fresh state — it'd clobber the real
      // daily progress. Real flow keeps the original save behaviour.
      if (convIdx == null) saveConversationState(storageMode, fresh);
    } else {
      let next: ConversationState = { ...loaded, speakers: todayPair };
      // Self-heal: if a stale save passed the new cap without finishing,
      // commit the failed flag so streak / header / next-mode all read
      // this day as done.
      if (
        !next.won &&
        !next.failed &&
        next.guesses.length >= MAX_GUESSES &&
        convIdx == null
      ) {
        next = { ...next, failed: true };
        saveConversationState(storageMode, next);
      }
      setState(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archiveDay]);

  // mode_started — fires once per day on first mount. Skips dev
  // overrides (?conv=N) so QA runs don't pollute prod analytics. NEVER
  // fires from archive: the daily funnel stays pristine.
  useEffect(() => {
    if (!day || archive) return;
    if (devConvIdx != null) return;
    const { speakers: today } = getSoundForDay(day);
    trackModeStarted({
      mode: "sound",
      dailyId: day,
      answerId: `${today[0].key}_${today[1].key}`,
    });
  }, [day, archive, devConvIdx]);

  // mode_completed — kept above the loading guard so the hook order is
  // stable across renders (React breaks if hooks are conditional). All
  // state derivation is null-safe so the effect can be a no-op until
  // the day + speakers + state hydrate.
  const todaySpeakers = day && devConvIdx == null
    ? getSoundForDay(day).speakers
    : null;
  const completionWon = !!(
    todaySpeakers &&
    state &&
    state.guesses.some(
      (g) => g.target === 0 && g.heroKey === todaySpeakers[0].key,
    ) &&
    state.guesses.some(
      (g) => g.target === 1 && g.heroKey === todaySpeakers[1].key,
    )
  );
  const completionFailed = !!state?.failed;
  useEffect(() => {
    if (!day || archive || devConvIdx != null) return;
    if (!completionWon && !completionFailed) return;
    if (!state || !todaySpeakers) return;
    const conversation = getSoundForDay(day).conversation;
    trackModeCompleted({
      mode: "sound",
      dailyId: day,
      outcome: completionWon ? "won" : "lost",
      totalGuesses: state.guesses.length,
      cap: MAX_GUESSES,
      answerId: `${todaySpeakers[0].key}_${todaySpeakers[1].key}`,
      conversationId: conversation.audio,
      // "<heroKey>@<target>" — mirrors the retired guess_submitted
      // guess_id encoding so speaker-slot analysis stays possible.
      guessIds: state.guesses.map((g) => `${g.heroKey}@${g.target}`),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, archive, devConvIdx, completionWon, completionFailed, state?.guesses.length]);

  if (!day || !state) {
    return (
      <main className={`mx-auto ${archive ? "max-w-2xl" : "max-w-6xl"} px-6 py-16`}>
        <div className="font-mono text-xs uppercase tracking-[0.2em] text-ink-faint">
          Loading…
        </div>
      </main>
    );
  }

  // Archive replays a fixed past day — always the deterministic daily pick,
  // never the dev ?conv= override.
  const { conversation, speakers } =
    !archive && devConvIdx != null
      ? getSoundByIndex(devConvIdx)
      : getSoundForDay(day);
  const [speakerA, speakerB] = speakers;

  const aRevealed = state.guesses.some(
    (g) => g.target === 0 && g.heroKey === speakerA.key,
  );
  const bRevealed = state.guesses.some(
    (g) => g.target === 1 && g.heroKey === speakerB.key,
  );
  const won = aRevealed && bRevealed;
  const failed = state.failed === true;
  const ended = won || failed;

  // Per-speaker guess tallies. The two speakers are independent sub-puzzles,
  // so first-try-both should read as "1 / 1" (one-shot each) rather than a
  // conflated "2". Each guess is target-tagged and a slot locks once solved,
  // so the per-speaker count is just the number of guesses aimed at it.
  const aGuessCount = state.guesses.filter((g) => g.target === 0).length;
  const bGuessCount = state.guesses.filter((g) => g.target === 1).length;

  const excludedA = new Set(
    state.guesses.filter((g) => g.target === 0).map((g) => g.heroKey),
  );
  const excludedB = new Set(
    state.guesses.filter((g) => g.target === 1).map((g) => g.heroKey),
  );

  // Auto-jump the toggle to the unsolved side once one speaker is locked
  // in. While both are open, honour the player's last tap (`chosenTarget`).
  const activeTarget: 0 | 1 = aRevealed ? 1 : bRevealed ? 0 : chosenTarget;

  // Same dialogue reveal cadence as Quote: 1 visible to start, +1 per guess,
  // and a couple of redacted previews ahead so the player can see there's
  // more dialogue coming.
  const VISIBLE_AT_START = 1;
  const PREVIEW_AHEAD = 2;
  const visibleLines = won
    ? conversation.lines.length
    : Math.min(
        VISIBLE_AT_START + state.guesses.length,
        conversation.lines.length,
      );
  const renderedLines = won
    ? conversation.lines.length
    : Math.min(visibleLines + PREVIEW_AHEAD, conversation.lines.length);

  // Per-line audio unlocks. Once the puzzle ends (win or fail), every
  // line is playable so the player can replay any line — for fails this
  // also doubles as the "what did I miss?" review. Mid-game, lines
  // unlock per the FIRST_HINT_AT / HINT_INTERVAL cadence so testers
  // see the same gating live players do.
  const audioUnlockedCount = ended
    ? conversation.lines.length
    : hintsUnlockedAt(state.guesses.length, conversation.lines.length);
  const allAudioUnlocked = audioUnlockedCount >= conversation.lines.length;
  const guessesUntilNextAudio = allAudioUnlocked
    ? null
    : nextHintAtGuess(audioUnlockedCount) - state.guesses.length;

  // Redemption: this past day was LOST when played live, and the player has
  // now won it in the archive — the grid cell flips red → green. Only ever
  // read in archive mode.
  const redeemedLiveLoss =
    archive &&
    won &&
    loadConversationState(MODE, day).failed === true;

  const handleGuess = (hero: Hero, target: 0 | 1) => {
    if (ended) return;
    const newGuess: ConversationGuess = { heroKey: hero.key, target };
    const newGuesses = [...state.guesses, newGuess];
    const newARevealed = newGuesses.some(
      (g) => g.target === 0 && g.heroKey === speakerA.key,
    );
    const newBRevealed = newGuesses.some(
      (g) => g.target === 1 && g.heroKey === speakerB.key,
    );
    const newWon = newARevealed && newBRevealed;
    const justFailed = !newWon && newGuesses.length >= MAX_GUESSES;
    const next: ConversationState = {
      day,
      speakers: [speakerA.key, speakerB.key],
      guesses: newGuesses,
      won: newWon,
      failed: justFailed ? true : state.failed,
    };
    setState(next);
    saveConversationState(storageMode, next);
    // Archive-only completion event, fired from the terminating action so a
    // resume/reload never re-counts. Conversation has no separate hint/skip
    // count, so hints is always 0.
    if (archive && (newWon || justFailed)) {
      trackArchiveRoundCompleted({
        mode: "sound",
        day,
        outcome: newWon ? "won" : "lost",
        guesses: newGuesses.length,
        hints: 0,
      });
    }
  };

  // Archive "Play again" — wipe the round back to empty in the archive
  // namespace only. Unused by the daily.
  const resetRound = () => {
    const fresh: ConversationState = {
      day,
      speakers: [speakerA.key, speakerB.key],
      guesses: [],
      won: false,
    };
    setChosenTarget(0);
    setState(fresh);
    saveConversationState(storageMode, fresh);
  };

  return (
    <main className={`mx-auto ${archive ? "max-w-2xl" : "max-w-6xl"} px-4 py-10 sm:px-6 lg:py-16`}>
      {archive ? (
        <>
          <ArchiveBanner />
          <header className="mb-8">
            <Link
              href="/archive/sound/"
              className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint transition-colors hover:text-accent"
            >
              <span aria-hidden>←</span> Archive
            </Link>
            <p className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-info">
              {prettyDay(day)}
            </p>
            <h1 className="mt-2 font-display display-headline text-3xl text-ink sm:text-5xl">
              Conversation
            </h1>
            <p className="mt-2 max-w-md text-ink-soft">
              Replaying a past puzzle. Guess which two characters are talking.
            </p>
          </header>
        </>
      ) : (
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-info">
              <span suppressHydrationWarning>{prettyDay(day)}</span>
            </p>
            <h1 className="mt-3 font-display display-headline text-3xl text-ink sm:text-6xl">
              Conversation
            </h1>
            <p className="mt-3 max-w-md text-ink-soft">
              Try to guess which two characters are having a conversation :D
              More dialogue is revealed as you go.
            </p>
          </div>
          <div className="hidden flex-col items-end font-mono text-xs uppercase tracking-[0.2em] text-ink-faint sm:flex">
            <Brand size="sm" />
            <span className="mt-1 text-info">conversation mode</span>
          </div>
        </header>
      )}

      {IS_DEV_BUILD && !archive && (
        <DevConversationRotator
          currentIdx={devConvIdx}
          speakers={[speakerA.name, speakerB.name]}
          audioFile={conversation.audio.split("/").pop() ?? conversation.audio}
        />
      )}

      <div className="mb-8 flex flex-col items-center">
        <ConversationCard
          conversation={conversation}
          speakers={[speakerA, speakerB]}
          aRevealed={aRevealed || ended}
          bRevealed={bRevealed || ended}
          visibleLines={visibleLines}
          renderedLines={renderedLines}
          audioUrl={conversation.audio}
          audioUnlockedCount={audioUnlockedCount}
        />
      </div>

      {!ended && (
        <div className="mb-6 space-y-3">
          <SpeakerToggle
            activeTarget={activeTarget}
            aRevealed={aRevealed}
            bRevealed={bRevealed}
            speakerA={speakerA}
            speakerB={speakerB}
            onSelect={setChosenTarget}
          />
          <HeroCombobox
            heroes={HEROES}
            excludeKeys={activeTarget === 0 ? excludedA : excludedB}
            onSelect={(hero) => handleGuess(hero, activeTarget)}
            placeholder={
              activeTarget === 0
                ? "Guess Speaker A — enter a hero…"
                : "Guess Speaker B — enter a hero…"
            }
          />
        </div>
      )}

      {!ended && (
        <div className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-2">
          <GuessesLeftBadge used={state.guesses.length} cap={MAX_GUESSES} />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
            {(aRevealed ? 1 : 0) + (bRevealed ? 1 : 0)} / 2 found
          </span>
          {!allAudioUnlocked && guessesUntilNextAudio != null && (
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent-soft">
              audio hint in {guessesUntilNextAudio}{" "}
              {guessesUntilNextAudio === 1 ? "guess" : "guesses"}
            </span>
          )}
          {allAudioUnlocked && audioUnlockedCount > 0 && (
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent-soft">
              all audio unlocked
            </span>
          )}
        </div>
      )}

      {archive ? (
        <>
          <AnimatePresence>
            {won && (
              <ArchiveResultCard key="win" tone="won">
                <div className="flex shrink-0 -space-x-3">
                  {speakerA.portrait_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={media(speakerA.portrait_url)}
                      alt=""
                      className="h-16 w-16 rounded-(--radius-card) bg-surface object-cover ring-2 ring-canvas sm:h-20 sm:w-20"
                    />
                  )}
                  {speakerB.portrait_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={media(speakerB.portrait_url)}
                      alt=""
                      className="h-16 w-16 rounded-(--radius-card) bg-surface object-cover ring-2 ring-canvas sm:h-20 sm:w-20"
                    />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-info">
                    {redeemedLiveLoss ? "Redeemed" : "Solved"}
                  </div>
                  <div className="mt-1 font-display text-2xl text-ink sm:text-3xl">
                    {speakerA.name} & {speakerB.name}{" "}
                    <span className="text-ink-soft">
                      in {aGuessCount} - {bGuessCount}
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
            {failed && !won && (
              <ArchiveResultCard key="loss" tone="lost">
                <div className="flex shrink-0 -space-x-3">
                  {speakerA.portrait_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={media(speakerA.portrait_url)}
                      alt=""
                      className="h-16 w-16 rounded-(--radius-card) bg-surface object-cover ring-2 ring-canvas sm:h-20 sm:w-20"
                    />
                  )}
                  {speakerB.portrait_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={media(speakerB.portrait_url)}
                      alt=""
                      className="h-16 w-16 rounded-(--radius-card) bg-surface object-cover ring-2 ring-canvas sm:h-20 sm:w-20"
                    />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-far">
                    Missed
                  </div>
                  <div className="mt-1 font-display text-2xl text-ink sm:text-3xl">
                    {speakerA.name} & {speakerB.name}
                  </div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                    {aRevealed
                      ? "Caught A · missed B"
                      : bRevealed
                        ? "Caught B · missed A"
                        : "Missed both"}
                  </div>
                </div>
              </ArchiveResultCard>
            )}
          </AnimatePresence>

          {ended && (
            <ArchiveOutcomeActions
              mode="sound"
              day={day}
              onReplay={resetRound}
            />
          )}
        </>
      ) : (
        <>
          <AnimatePresence>
            {won && (
              <motion.div
                key="win"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="mx-auto mb-8 w-full max-w-md rounded-(--radius-card) border border-correct/40 bg-correct/10 p-4 sm:p-5"
              >
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
                    <div className="flex shrink-0 -space-x-3">
                      {speakerA.portrait_url && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={media(speakerA.portrait_url)}
                          alt=""
                          className="h-16 w-16 rounded-(--radius-card) bg-muted object-cover ring-2 ring-canvas sm:h-20 sm:w-20"
                        />
                      )}
                      {speakerB.portrait_url && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={media(speakerB.portrait_url)}
                          alt=""
                          className="h-16 w-16 rounded-(--radius-card) bg-muted object-cover ring-2 ring-canvas sm:h-20 sm:w-20"
                        />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-info">
                        Solved
                      </div>
                      <div className="mt-1 font-display text-2xl text-ink sm:text-3xl">
                        {speakerA.name} & {speakerB.name}{" "}
                        <span className="text-ink-soft">
                          in {aGuessCount} - {bGuessCount}
                        </span>
                      </div>
                      <ModeStatsLine mode="sound" />
                    </div>
                  </div>
                  <div className="flex justify-center sm:justify-start">
                    <NextModeCTA current="sound" />
                  </div>
                  {/* Share closes the card — single bottom-anchored
                      affordance, consistent across every mode. */}
                  <div className="flex items-center justify-center gap-3">
                    <ShareButton
                      {...roundShareLinks({
                        day,
                        slug: "sound",
                        outcome: "won",
                        guesses: state.guesses.length,
                      })}
                      filename={`deadlockle-conversation-${day}.png`}
                      surface="round_result"
                      mode="sound"
                      dailyId={day}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {failed && !won && (
            <LossReveal
              current="sound"
              share={
                <ShareButton
                  {...roundShareLinks({
                    day,
                    slug: "sound",
                    outcome: "lost",
                    guesses: state.guesses.length,
                  })}
                  filename={`deadlockle-conversation-${day}.png`}
                  surface="round_result"
                  mode="sound"
                  dailyId={day}
                />
              }
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex shrink-0 -space-x-3">
                  {speakerA.portrait_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={media(speakerA.portrait_url)}
                      alt=""
                      className="h-16 w-16 rounded-(--radius-card) bg-muted object-cover ring-2 ring-canvas sm:h-20 sm:w-20"
                    />
                  )}
                  {speakerB.portrait_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={media(speakerB.portrait_url)}
                      alt=""
                      className="h-16 w-16 rounded-(--radius-card) bg-muted object-cover ring-2 ring-canvas sm:h-20 sm:w-20"
                    />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-far">
                    Speakers
                  </div>
                  <div className="mt-1 font-display text-2xl text-ink sm:text-3xl">
                    {speakerA.name} & {speakerB.name}
                  </div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                    {aRevealed
                      ? bRevealed
                        ? ""
                        : "Caught A · missed B"
                      : bRevealed
                        ? "Caught B · missed A"
                        : "Missed both"}
                  </div>
                  <ModeStatsLine mode="sound" />
                </div>
              </div>
            </LossReveal>
          )}
        </>
      )}

      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {[...state.guesses].reverse().map((g, revIdx) => {
            const hero = HEROES_BY_KEY[g.heroKey];
            if (!hero) return null;
            const speaker = g.target === 0 ? speakerA : speakerB;
            const originalIdx = state.guesses.length - 1 - revIdx;
            const isLatest = originalIdx === state.guesses.length - 1;
            return (
              <ConversationGuessRow
                key={`${originalIdx}-${g.heroKey}-${g.target}`}
                guess={hero}
                target={g.target}
                speaker={speaker}
                isCorrect={hero.key === speaker.key}
                isLatest={isLatest}
              />
            );
          })}
        </AnimatePresence>
      </div>

      {state.guesses.length === 0 && (
        <div className="mt-10 rounded-(--radius-card) border border-dashed border-line bg-inset/40 p-8 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-faint">
            Pick a hero in either field. Each guess reveals more dialogue.
            After {FIRST_HINT_AT} wrong guesses, the first line&apos;s voice
            clip unlocks, then one more every {HINT_INTERVAL} guesses.
          </p>
        </div>
      )}
    </main>
  );
}

function ConversationCard({
  conversation,
  speakers,
  aRevealed,
  bRevealed,
  visibleLines,
  renderedLines,
  audioUrl,
  audioUnlockedCount,
}: {
  conversation: SoundConversation;
  speakers: [Hero, Hero];
  aRevealed: boolean;
  bRevealed: boolean;
  visibleLines: number;
  renderedLines: number;
  audioUrl: string;
  audioUnlockedCount: number;
}) {
  // Single Audio element shared across all line buttons. We seek into it
  // for the requested line's slice rather than juggling N file loads.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopHandlerRef = useRef<(() => void) | null>(null);
  const [playingLine, setPlayingLine] = useState<number | null>(null);

  const stopPlayback = useCallback(() => {
    if (audioRef.current && stopHandlerRef.current) {
      audioRef.current.removeEventListener(
        "timeupdate",
        stopHandlerRef.current,
      );
      stopHandlerRef.current = null;
    }
    if (audioRef.current) audioRef.current.pause();
    setPlayingLine(null);
  }, []);

  // Reset on URL change (day rollover, HMR) and on unmount so audio
  // doesn't outlive the card.
  useEffect(() => {
    return () => {
      stopPlayback();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [stopPlayback]);
  useEffect(() => {
    stopPlayback();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, [audioUrl, stopPlayback]);

  function playLineAudio(lineIdx: number) {
    const line = conversation.lines[lineIdx];
    if (line.audioStart == null || line.audioDuration == null) return;
    stopPlayback();
    if (!audioRef.current) audioRef.current = new Audio(media(audioUrl));
    const audio = audioRef.current;
    const end = line.audioStart + line.audioDuration;
    const handler = () => {
      if (!audioRef.current) return;
      if (audioRef.current.currentTime >= end) {
        stopPlayback();
      }
    };
    try {
      audio.currentTime = line.audioStart;
    } catch {
      /* readyState too low — play() below will still seek once metadata loads */
    }
    audio.addEventListener("timeupdate", handler);
    stopHandlerRef.current = handler;
    audio
      .play()
      .then(() => setPlayingLine(lineIdx))
      .catch(() => stopPlayback());
  }

  function toggleLine(lineIdx: number) {
    if (playingLine === lineIdx) stopPlayback();
    else playLineAudio(lineIdx);
  }

  return (
    <motion.figure
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="tile-shape relative w-full min-w-0 max-w-2xl overflow-hidden border border-line bg-muted/40 px-7 py-10 shadow-2xl shadow-black/40 sm:px-12 sm:py-14"
    >
      <p className="mb-7 font-mono text-[10px] uppercase tracking-[0.24em] text-info">
        Pre-match
      </p>

      <div className="space-y-7">
        {conversation.lines.slice(0, renderedLines).map((line, i) => {
          const isA = line.speaker === 0;
          const speakerHero = isA ? speakers[0] : speakers[1];
          const revealed = isA ? aRevealed : bRevealed;
          const visible = i < visibleLines;
          const audioUnlocked = i < audioUnlockedCount;

          return (
            <ConversationLineRow
              key={i}
              isA={isA}
              speakerHero={speakerHero}
              speakerLabel={`Speaker ${isA ? "A" : "B"}`}
              revealed={revealed}
              visible={visible}
              text={line.text}
              audioUnlocked={audioUnlocked}
              audioPlaying={playingLine === i}
              onToggleAudio={() => toggleLine(i)}
            />
          );
        })}
        {renderedLines < conversation.lines.length && (
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-faint">
            … {conversation.lines.length - renderedLines} more line
            {conversation.lines.length - renderedLines === 1 ? "" : "s"} after
            that
          </p>
        )}
      </div>
    </motion.figure>
  );
}

function ConversationLineRow({
  isA,
  speakerHero,
  speakerLabel,
  revealed,
  visible,
  text,
  audioUnlocked,
  audioPlaying,
  onToggleAudio,
}: {
  isA: boolean;
  speakerHero: Hero;
  speakerLabel: string;
  revealed: boolean;
  visible: boolean;
  text: string;
  audioUnlocked: boolean;
  audioPlaying: boolean;
  onToggleAudio: () => void;
}) {
  return (
    <motion.div layout transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em]">
          {revealed ? (
            <span className="text-correct">{speakerHero.name}</span>
          ) : (
            <span className={isA ? "text-info" : "text-accent-soft"}>
              {speakerLabel}
            </span>
          )}
        </p>
        {audioUnlocked && (
          <LineAudioButton
            playing={audioPlaying}
            tone={isA ? "info" : "accent-soft"}
            onToggle={onToggleAudio}
          />
        )}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {visible ? (
          <motion.p
            key="visible"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="font-display text-xl leading-snug text-ink sm:text-2xl [overflow-wrap:anywhere]"
          >
            “{text}”
          </motion.p>
        ) : (
          <motion.p
            key="hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="font-display text-xl leading-snug text-ink-faint sm:text-2xl select-none [overflow-wrap:anywhere]"
            aria-hidden
          >
            {redactedFor(text)}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Per-line play/stop button. The audio source is owned by the parent
// ConversationCard (one Audio element seeks across lines) — this button
// just toggles via the supplied callback.
function LineAudioButton({
  playing,
  tone,
  onToggle,
}: {
  playing: boolean;
  tone: "info" | "accent-soft";
  onToggle: () => void;
}) {
  const toneClass =
    tone === "info"
      ? "border-info/40 bg-info/10 text-info hover:bg-info/15"
      : "border-accent-soft/50 bg-accent-soft/10 text-accent-soft hover:bg-accent-soft/15";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={playing ? "Stop voice line" : "Play this voice line"}
      className={clsx(
        "inline-flex h-6 w-6 items-center justify-center rounded-(--radius-pill) border transition-colors sm:h-9 sm:w-9",
        toneClass,
      )}
    >
      {playing ? <SpeakerActiveIcon /> : <SpeakerIcon />}
    </button>
  );
}

function SpeakerIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden
      className="h-2.5 w-2.5 shrink-0 sm:h-3.5 sm:w-3.5"
    >
      <path d="M1 4.5 H3.5 L7 1.5 V10.5 L3.5 7.5 H1 Z" fill="currentColor" />
    </svg>
  );
}

function SpeakerActiveIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden
      className="h-2.5 w-2.5 shrink-0 sm:h-3.5 sm:w-3.5"
    >
      <path d="M1 4.5 H3.5 L7 1.5 V10.5 L3.5 7.5 H1 Z" fill="currentColor" />
      <path
        d="M8 4.5 Q9.25 6 8 7.5"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M9.25 3 Q11 6 9.25 9"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function redactedFor(text: string): string {
  const len = Math.min(60, Math.max(18, Math.round(text.length * 0.6)));
  return "█".repeat(len);
}

function ConversationGuessRow({
  guess,
  target,
  speaker,
  isCorrect,
  isLatest,
}: {
  guess: Hero;
  target: 0 | 1;
  speaker: Hero;
  isCorrect: boolean;
  isLatest: boolean;
}) {
  const targetLabel = target === 0 ? "A" : "B";
  const isA = target === 0;
  // Speaker hue is consistent with the dialogue line labels and the toggle
  // (A = info, B = accent-soft). Correctness is shown by intensity (a
  // brighter fill + ✓), never by switching hue — so the colour always
  // answers "which speaker was this guess for?".
  const speakerChip = isCorrect
    ? isA
      ? "bg-info/25 text-info ring-info/70"
      : "bg-accent-soft/25 text-accent-soft ring-accent-soft/70"
    : isA
      ? "bg-info/15 text-info ring-info/45"
      : "bg-accent-soft/15 text-accent-soft ring-accent-soft/45";
  const results = compareHero(guess, speaker);

  return (
    <motion.div
      layout
      initial={isLatest ? { opacity: 0, y: -12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-3"
    >
      <div className="flex items-center gap-3">
        {guess.portrait_url && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={media(guess.portrait_url)}
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 rounded-(--radius-card) bg-muted object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-base font-medium text-ink">
            {guess.name}
          </div>
          <div className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
            {guess.sub_role ?? "—"} · {guess.gun_tag ?? "—"}
          </div>
        </div>
        <span
          className={clsx(
            "shrink-0 px-3 py-1.5 text-xs font-normal uppercase tracking-[0.14em] ring-1",
            speakerChip,
          )}
        >
          {isCorrect ? "✓ " : ""}Speaker {targetLabel}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7 sm:gap-2">
        {results.map((r, i) => (
          <AttributeTile key={r.attr} result={r} index={i} />
        ))}
      </div>
    </motion.div>
  );
}

// Dev-only QA toolbar. Lets the tester step through every conversation
// in the pool to audition diarization splits without waiting for the
// daily seed to roll. Updates `?conv=N` and reloads so all derived state
// (saved progress detection, audio unlocks, etc.) re-initialises cleanly
// from the new index.
function DevConversationRotator({
  currentIdx,
  speakers,
  audioFile,
}: {
  currentIdx: number | null;
  speakers: [string, string];
  audioFile: string;
}) {
  function navigateTo(idx: number) {
    const wrapped = ((idx % SOUND_POOL_SIZE) + SOUND_POOL_SIZE) % SOUND_POOL_SIZE;
    const url = new URL(window.location.href);
    url.searchParams.set("conv", String(wrapped));
    window.location.href = url.toString();
  }
  function clearOverride() {
    const url = new URL(window.location.href);
    url.searchParams.delete("conv");
    window.location.href = url.toString();
  }
  function randomConv() {
    let next = Math.floor(Math.random() * SOUND_POOL_SIZE);
    if (next === currentIdx && SOUND_POOL_SIZE > 1) {
      next = (next + 1) % SOUND_POOL_SIZE;
    }
    navigateTo(next);
  }
  // Effective index for display — null means "today's daily pick".
  const label =
    currentIdx == null
      ? `today's daily`
      : `conv ${currentIdx} / ${SOUND_POOL_SIZE - 1}`;

  return (
    <div className="mx-auto mb-4 flex w-full max-w-2xl flex-wrap items-center gap-2 border border-dashed border-info/40 bg-inset/50 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft">
      <span className="text-info">DEV · rotate</span>
      <span className="text-ink-faint">·</span>
      <span className="text-ink">{label}</span>
      <span className="text-ink-faint">·</span>
      <span className="truncate text-ink-faint normal-case tracking-normal">
        {speakers[0]} × {speakers[1]} ({audioFile})
      </span>
      <span className="grow" />
      <button
        type="button"
        onClick={() => navigateTo((currentIdx ?? 0) - 1)}
        className="border border-line bg-canvas px-2 py-1 text-ink hover:border-accent hover:text-accent"
      >
        ← prev
      </button>
      <button
        type="button"
        onClick={() => navigateTo((currentIdx ?? -1) + 1)}
        className="border border-line bg-canvas px-2 py-1 text-ink hover:border-accent hover:text-accent"
      >
        next →
      </button>
      <button
        type="button"
        onClick={randomConv}
        className="border border-line bg-canvas px-2 py-1 text-ink hover:border-accent hover:text-accent"
      >
        random
      </button>
      {currentIdx != null && (
        <button
          type="button"
          onClick={clearOverride}
          className="border border-line bg-canvas px-2 py-1 text-ink-faint hover:border-info hover:text-info"
        >
          clear
        </button>
      )}
    </div>
  );
}
