"use client";

// Sound mode is the audio-augmented sibling of Quote mode. Same two-speaker
// conversation puzzle (each speaker guessed in their own combobox, dialogue
// reveals one line per guess), but each line in the conversation card can
// expose a Play button as a late-stage hint. The first audio hint unlocks
// after FIRST_HINT_AT wrong guesses; subsequent hints unlock every
// HINT_INTERVAL guesses, in line order. Played audio is the speaker's
// "select" voice clip from data/voicelines.json — players hear that hero's
// voice (a hint to recognize them) without us cutting per-line audio.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { HEROES, HEROES_BY_KEY, type Hero } from "@/lib/heroes";
import { dayString, getSoundForDay, prettyDay } from "@/lib/daily";
import type { Conversation } from "@/lib/conversations";
import type { VoiceClip } from "@/lib/voicelines";
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
import { NextModeCTA } from "./NextModeCTA";
import { ScoreBadge } from "./ScoreBadge";
import clsx from "clsx";

const MODE = "sound";

// Hint cadence: the first audio play-button appears after this many
// total guesses; each subsequent line unlocks every HINT_INTERVAL more.
// Tuned per Yash's spec: 5 → line 1, 7 → line 2, 9 → line 3, …
const FIRST_HINT_AT = 5;
const HINT_INTERVAL = 2;

// Returns how many of the conversation's lines have an unlocked audio
// hint at the given guess count, capped at conv length.
function hintsUnlockedAt(guessCount: number, totalLines: number): number {
  if (guessCount < FIRST_HINT_AT) return 0;
  return Math.min(
    1 + Math.floor((guessCount - FIRST_HINT_AT) / HINT_INTERVAL),
    totalLines,
  );
}

// Smallest guess count that would unlock the next hint past `currentUnlocked`.
function nextHintAtGuess(currentUnlocked: number): number {
  if (currentUnlocked === 0) return FIRST_HINT_AT;
  return FIRST_HINT_AT + currentUnlocked * HINT_INTERVAL;
}

export function SoundGame() {
  const [day, setDay] = useState<string | null>(null);
  const [state, setState] = useState<ConversationState | null>(null);

  useEffect(() => {
    const d = dayString();
    setDay(d);
    const loaded = loadConversationState(MODE, d);
    const { speakers: today } = getSoundForDay(d);
    const todayPair: [string, string] = [today[0].key, today[1].key];
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
      saveConversationState(MODE, fresh);
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

  const { conversation, speakers, clips } = getSoundForDay(day);
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

  // Audio hint unlocks (independent of dialogue text reveal).
  const unlocked = won
    ? conversation.lines.length
    : hintsUnlockedAt(state.guesses.length, conversation.lines.length);
  const allHintsUnlocked = unlocked >= conversation.lines.length;
  const guessesUntilNextHint = allHintsUnlocked
    ? null
    : nextHintAtGuess(unlocked) - state.guesses.length;

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
            Sound
          </h1>
          <p className="mt-3 max-w-md text-ink-soft">
            A pre-match exchange between two heroes. Dialogue reveals as you
            guess; voice samples unlock if you get stuck.
          </p>
        </div>
        <div className="hidden flex-col items-end font-mono text-xs uppercase tracking-[0.2em] text-ink-faint sm:flex">
          <Brand size="sm" />
          <span className="mt-1 text-info">sound mode</span>
        </div>
      </header>

      <div className="mb-8 flex flex-col items-center">
        <ConversationCard
          conversation={conversation}
          speakers={[speakerA, speakerB]}
          aRevealed={aRevealed}
          bRevealed={bRevealed}
          visibleLines={visibleLines}
          renderedLines={renderedLines}
          unlocked={unlocked}
          clips={clips}
          frozen={won}
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
          {!allHintsUnlocked && guessesUntilNextHint != null && (
            <span className="text-accent-soft">
              · sound hint in {guessesUntilNextHint}{" "}
              {guessesUntilNextHint === 1 ? "guess" : "guesses"}
            </span>
          )}
          {allHintsUnlocked && unlocked > 0 && (
            <span className="text-accent-soft">· all hints unlocked</span>
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
                    src={speakerA.portrait_url}
                    alt=""
                    className="h-16 w-16 rounded-(--radius-card) bg-muted object-cover ring-2 ring-canvas sm:h-20 sm:w-20"
                  />
                )}
                {speakerB.portrait_url && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={speakerB.portrait_url}
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
              <ConversationShareButton
                day={day}
                guesses={state.guesses}
                speakers={[speakerA, speakerB]}
              />
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
            Pick a hero in either field. Each guess reveals more dialogue —
            and after {FIRST_HINT_AT} wrong guesses, voice samples start
            unlocking.
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
              src={speakerHero.portrait_url}
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
  unlocked,
  clips,
  frozen,
}: {
  conversation: Conversation;
  speakers: [Hero, Hero];
  aRevealed: boolean;
  bRevealed: boolean;
  visibleLines: number;
  renderedLines: number;
  unlocked: number;
  clips: (VoiceClip | null)[];
  frozen: boolean;
}) {
  return (
    <motion.figure
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="tile-shape relative w-full max-w-2xl border border-line bg-muted/40 px-7 py-10 shadow-2xl shadow-black/40 sm:px-12 sm:py-14"
    >
      {conversation.context && (
        <p className="mb-7 font-mono text-[10px] uppercase tracking-[0.24em] text-info">
          {conversation.context}
        </p>
      )}

      <div className="space-y-7">
        {conversation.lines.slice(0, renderedLines).map((line, i) => {
          const isA = line.speaker === 0;
          const speakerHero = isA ? speakers[0] : speakers[1];
          const revealed = isA ? aRevealed : bRevealed;
          const visible = i < visibleLines;
          const audioUnlocked = i < unlocked;

          return (
            <ConversationLineRow
              key={i}
              isA={isA}
              speakerHero={speakerHero}
              speakerLabel={`Speaker ${isA ? "A" : "B"}`}
              revealed={revealed}
              visible={visible}
              text={line.text}
              clip={clips[i]}
              audioUnlocked={audioUnlocked}
              frozen={frozen}
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
  clip,
  audioUnlocked,
  frozen,
}: {
  isA: boolean;
  speakerHero: Hero;
  speakerLabel: string;
  revealed: boolean;
  visible: boolean;
  text: string;
  clip: VoiceClip | null;
  audioUnlocked: boolean;
  frozen: boolean;
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
        {clip && (
          <AudioHintButton
            clip={clip}
            unlocked={audioUnlocked}
            tone={isA ? "info" : "accent-soft"}
            frozen={frozen}
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

// Renders the per-line voice hint button. Locked state shows a count of
// guesses remaining; unlocked toggles play/stop on a single shared Audio
// instance scoped to the row. We don't autoplay — browser audio policy
// requires a user gesture, and unprompted audio would surprise players.
function AudioHintButton({
  clip,
  unlocked,
  tone,
  frozen,
}: {
  clip: VoiceClip;
  unlocked: boolean;
  tone: "info" | "accent-soft";
  frozen: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const toggle = () => {
    if (!unlocked) return;
    if (!audioRef.current) {
      const a = new Audio(clip.url);
      a.addEventListener("ended", () => setPlaying(false));
      audioRef.current = a;
    }
    if (playing) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
  };

  if (!unlocked) {
    return (
      <span
        className={clsx(
          "inline-flex items-center gap-1.5 rounded-(--radius-pill) border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.18em]",
          "border-line/60 bg-inset/40 text-ink-faint",
        )}
        title="Voice sample unlocks once you've made enough wrong guesses"
      >
        <LockIcon />
        Locked
      </span>
    );
  }

  const toneClass =
    tone === "info"
      ? "border-info/40 bg-info/10 text-info hover:bg-info/15"
      : "border-accent-soft/50 bg-accent-soft/10 text-accent-soft hover:bg-accent-soft/15";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        playing
          ? "Stop voice sample"
          : `Play a voice sample of this speaker${frozen ? "" : " as a hint"}`
      }
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-(--radius-pill) border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.18em] transition-colors",
        toneClass,
      )}
    >
      {playing ? <StopIcon /> : <PlayIcon />}
      {playing ? "Playing" : "Voice"}
    </button>
  );
}

function PlayIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      width="9"
      height="9"
      aria-hidden
      className="shrink-0"
    >
      <path d="M3 2 L3 10 L10 6 Z" fill="currentColor" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      width="9"
      height="9"
      aria-hidden
      className="shrink-0"
    >
      <rect x="3" y="3" width="6" height="6" fill="currentColor" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      width="9"
      height="9"
      aria-hidden
      className="shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <rect x="2.5" y="5.5" width="7" height="5" rx="0.5" />
      <path d="M4 5.5 V4 a2 2 0 0 1 4 0 V5.5" />
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
            src={guess.portrait_url}
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
            {guess.hero_type ?? "—"} · {guess.gun_tag ?? "—"}
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

      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8 sm:gap-2">
        {results.map((r, i) => (
          <AttributeTile key={r.attr} result={r} index={i} />
        ))}
      </div>
    </motion.div>
  );
}

function ConversationShareButton({
  day,
  guesses,
  speakers,
}: {
  day: string;
  guesses: ConversationGuess[];
  speakers: [Hero, Hero];
}) {
  const [copied, setCopied] = useState(false);

  const buildText = () => {
    const [a, b] = speakers;
    const lines: string[] = [];
    lines.push(`Deadlockle Sound · ${day}`);
    lines.push(`${a.name} & ${b.name} in ${guesses.length}`);
    lines.push("");
    for (const g of guesses) {
      const hero = HEROES_BY_KEY[g.heroKey];
      if (!hero) continue;
      const speaker = g.target === 0 ? a : b;
      const row = compareHero(hero, speaker)
        .map((r) => emojiFor(r.status))
        .join("");
      const targetTag = g.target === 0 ? "🅐" : "🅑";
      lines.push(`${targetTag} ${row}`);
    }
    return lines.join("\n");
  };

  const onClick = () => {
    if (!navigator.clipboard) return;
    navigator.clipboard
      .writeText(buildText())
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => {});
  };

  return (
    <button
      onClick={onClick}
      className="rounded-(--radius-pill) bg-accent px-5 py-2.5 font-mono text-xs uppercase tracking-[0.18em] text-on-accent transition-opacity hover:opacity-90"
    >
      {copied ? "Copied" : "Share"}
    </button>
  );
}

function emojiFor(status: string): string {
  if (status === "correct") return "🟩";
  if (status === "partial") return "🟨";
  if (status === "far") return "🟥";
  return "⬛";
}
