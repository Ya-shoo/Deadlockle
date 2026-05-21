"use client";

// Conversation mode (slug "sound") is the audio-augmented sibling of Quote
// mode. Same two-speaker exchange puzzle: each guess reveals the next line
// of dialogue. After FIRST_HINT_AT wrong guesses, the Play button on line 1
// unlocks; every HINT_INTERVAL guesses past that, the next line's button
// unlocks (5 → line 1, 7 → line 2, 9 → line 3, …). Every clip is a slice
// of the actual wiki recording — players hear the heroes saying that exact
// line. The slices come from build-conversation-audio.mjs (silence-detected
// per-line ranges within a single MP3 per conversation).

import { useCallback, useEffect, useRef, useState } from "react";
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
import { NextModeCTA } from "./NextModeCTA";
import { ScoreBadge } from "./ScoreBadge";
import clsx from "clsx";

const MODE = "sound";

// Hint cadence: line 1's audio unlocks after FIRST_HINT_AT wrong guesses;
// each subsequent line unlocks every HINT_INTERVAL more (5 → line 1,
// 7 → line 2, 9 → line 3, …).
const FIRST_HINT_AT = 5;
const HINT_INTERVAL = 2;

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

export function SoundGame() {
  const [day, setDay] = useState<string | null>(null);
  const [state, setState] = useState<ConversationState | null>(null);
  // Dev-only override: `/sound/?conv=N` pins the conversation to pool
  // index N so the diarization splits can be QA'd across many clips
  // without waiting for the daily seed to roll over. Null in production
  // and on first paint; populated from URL on mount.
  const [devConvIdx, setDevConvIdx] = useState<number | null>(null);

  useEffect(() => {
    const d = dayString();
    setDay(d);

    // Read ?conv=N from URL (dev only). Treat anything outside [0, pool)
    // as null so a stray query string doesn't break the regular flow.
    let convIdx: number | null = null;
    if (IS_DEV_BUILD && typeof window !== "undefined") {
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
    const loaded = loadConversationState(MODE, d);
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
      if (convIdx == null) saveConversationState(MODE, fresh);
    } else {
      setState({ ...loaded, speakers: todayPair });
    }
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

  const { conversation, speakers } =
    devConvIdx != null ? getSoundByIndex(devConvIdx) : getSoundForDay(day);
  const [speakerA, speakerB] = speakers;

  const aRevealed = state.guesses.some(
    (g) => g.target === 0 && g.heroKey === speakerA.key,
  );
  const bRevealed = state.guesses.some(
    (g) => g.target === 1 && g.heroKey === speakerB.key,
  );
  const won = aRevealed && bRevealed;

  const excludedA = new Set(
    state.guesses.filter((g) => g.target === 0).map((g) => g.heroKey),
  );
  const excludedB = new Set(
    state.guesses.filter((g) => g.target === 1).map((g) => g.heroKey),
  );

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

  // Per-line audio unlocks. Once won, all line buttons are playable so
  // the player can replay any line. In dev builds, every line unlocks
  // immediately — this turns Conversation mode into a manual QA console
  // for the diarization splits without forcing the tester to grind
  // through five wrong guesses on every conversation they want to
  // audition.
  const audioUnlockedCount =
    won || IS_DEV_BUILD
      ? conversation.lines.length
      : hintsUnlockedAt(state.guesses.length, conversation.lines.length);
  const allAudioUnlocked = audioUnlockedCount >= conversation.lines.length;
  const guessesUntilNextAudio = allAudioUnlocked
    ? null
    : nextHintAtGuess(audioUnlockedCount) - state.guesses.length;

  const handleGuess = (hero: Hero, target: 0 | 1) => {
    if (won) return;
    const newGuess: ConversationGuess = { heroKey: hero.key, target };
    const newGuesses = [...state.guesses, newGuess];
    const newARevealed = newGuesses.some(
      (g) => g.target === 0 && g.heroKey === speakerA.key,
    );
    const newBRevealed = newGuesses.some(
      (g) => g.target === 1 && g.heroKey === speakerB.key,
    );
    const next: ConversationState = {
      day,
      speakers: [speakerA.key, speakerB.key],
      guesses: newGuesses,
      won: newARevealed && newBRevealed,
    };
    setState(next);
    saveConversationState(MODE, next);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-16">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-info">
            <span suppressHydrationWarning>{prettyDay(day)}</span>
          </p>
          <h1 className="mt-3 font-display display-headline text-5xl text-ink sm:text-6xl">
            Conversation
          </h1>
          <p className="mt-3 max-w-md text-ink-soft">
            A pre-match exchange between two heroes. Dialogue reveals as you
            guess; the actual voice clip unlocks if you get stuck.
          </p>
        </div>
        <div className="hidden flex-col items-end font-mono text-xs uppercase tracking-[0.2em] text-ink-faint sm:flex">
          <Brand size="sm" />
          <span className="mt-1 text-info">conversation mode</span>
        </div>
      </header>

      {IS_DEV_BUILD && (
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
          aRevealed={aRevealed}
          bRevealed={bRevealed}
          visibleLines={visibleLines}
          renderedLines={renderedLines}
          audioUrl={conversation.audio}
          audioUnlockedCount={audioUnlockedCount}
        />
      </div>

      {!won && (
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <SpeakerField
            label="Speaker A"
            tone="info"
            revealed={aRevealed}
            speakerHero={speakerA}
            excluded={excludedA}
            onGuess={(hero) => handleGuess(hero, 0)}
          />
          <SpeakerField
            label="Speaker B"
            tone="accent-soft"
            revealed={bRevealed}
            speakerHero={speakerB}
            excluded={excludedB}
            onGuess={(hero) => handleGuess(hero, 1)}
          />
        </div>
      )}

      {!won && (
        <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs uppercase tracking-[0.18em] text-info">
          <span>
            {state.guesses.length}{" "}
            {state.guesses.length === 1 ? "guess" : "guesses"}
          </span>
          <span className="text-ink-faint">
            · {(aRevealed ? 1 : 0) + (bRevealed ? 1 : 0)} / 2 found
          </span>
          {!allAudioUnlocked && guessesUntilNextAudio != null && (
            <span className="text-accent-soft">
              · audio hint in {guessesUntilNextAudio}{" "}
              {guessesUntilNextAudio === 1 ? "guess" : "guesses"}
            </span>
          )}
          {allAudioUnlocked && audioUnlockedCount > 0 && !won && (
            <span className="text-accent-soft">· all audio unlocked</span>
          )}
        </p>
      )}

      <AnimatePresence>
        {won && (
          <motion.div
            key="win"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="mb-8 rounded-(--radius-card) border border-correct/40 bg-correct/10 p-5 sm:p-6"
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
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-info">
                  Solved
                </div>
                <div className="mt-1 font-display text-2xl text-ink sm:text-3xl">
                  {speakerA.name} & {speakerB.name}
                </div>
                <div className="mt-3">
                  <NextModeCTA current="sound" />
                </div>
              </div>
              <ScoreBadge count={state.guesses.length} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

function SpeakerField({
  label,
  tone,
  revealed,
  speakerHero,
  excluded,
  onGuess,
}: {
  label: string;
  tone: "info" | "accent-soft";
  revealed: boolean;
  speakerHero: Hero;
  excluded: Set<string>;
  onGuess: (hero: Hero) => void;
}) {
  const toneClass = tone === "info" ? "text-info" : "text-accent-soft";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.24em]">
        <span className={revealed ? "text-correct" : toneClass}>
          {revealed ? `✓ ${speakerHero.name}` : label}
        </span>
        <span className="text-ink-faint">
          {revealed ? "Solved" : "Guessing"}
        </span>
      </div>
      {revealed ? (
        <div className="flex items-center gap-3 rounded-(--radius-card) border border-correct/40 bg-correct/10 p-3">
          {speakerHero.portrait_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={media(speakerHero.portrait_url)}
              alt=""
              className="h-10 w-10 rounded-(--radius-card) bg-muted object-cover"
            />
          )}
          <div className="font-display text-base text-ink">
            {speakerHero.name}
          </div>
        </div>
      ) : (
        <HeroCombobox
          heroes={HEROES}
          excludeKeys={excluded}
          onSelect={onGuess}
          placeholder="Enter a hero…"
        />
      )}
    </div>
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
      className="tile-shape relative w-full max-w-2xl border border-line bg-muted/40 px-7 py-10 shadow-2xl shadow-black/40 sm:px-12 sm:py-14"
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
            className="font-display text-xl leading-snug text-ink sm:text-2xl"
          >
            “{text}”
          </motion.p>
        ) : (
          <motion.p
            key="hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="font-display text-xl leading-snug text-ink-faint sm:text-2xl select-none"
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
      {playing ? <StopIcon /> : <PlayIcon />}
    </button>
  );
}

function PlayIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden
      className="h-2.5 w-2.5 shrink-0 sm:h-3.5 sm:w-3.5"
    >
      <path d="M3 2 L3 10 L10 6 Z" fill="currentColor" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden
      className="h-2.5 w-2.5 shrink-0 sm:h-3.5 sm:w-3.5"
    >
      <rect x="3" y="3" width="6" height="6" fill="currentColor" />
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
  const targetColor = target === 0 ? "text-info" : "text-accent-soft";
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
            "shrink-0 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] border",
            isCorrect
              ? "border-correct/50 bg-correct/15 text-correct"
              : `border-line bg-muted/50 ${targetColor}`,
          )}
        >
          {isCorrect ? "✓" : "for"} Speaker {targetLabel}
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
