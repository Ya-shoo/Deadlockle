"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BUILT_MODE_SLUGS,
  nextUnfinishedMode,
  type ModeDef,
  type ModeSlug,
} from "@/lib/modes";
import { dayString } from "@/lib/daily";
import { loadModeState } from "@/lib/storage";
import { NextResetCountdown } from "./NextResetCountdown";

// Renders inline in a game's win state. Walks canonical play order, skips
// modes the player has already won, and recommends the first remaining one
// — so a player who jumps around (Classic → Item → Conversation) still gets
// pulled back to the earliest unfinished mode and ends up seeing every
// mode exactly once. When every built mode is done, the CTA flips to a
// full "Daily Complete" panel with countdown to the next reset.
//
// Reads localStorage synchronously in the initial state. Safe because the
// parent only mounts NextModeCTA after its own effect has hydrated state,
// so we are guaranteed to be client-side here — the static prerender omits
// this component entirely.
export function NextModeCTA({ current }: { current: ModeSlug }) {
  const [data] = useState<{
    next: ModeDef | null;
    totalGuesses: number;
  }>(() => {
    const day = dayString();
    const done = new Set<ModeSlug>();
    let totalGuesses = 0;
    for (const slug of BUILT_MODE_SLUGS) {
      const st = loadModeState(slug, day);
      if (st.won) done.add(slug);
      // ConversationState (Quote/Sound) shares the same on-disk shape — its
      // `guesses` is an array of objects, but `.length` still gives the
      // count we want for a total.
      totalGuesses += Array.isArray(st.guesses) ? st.guesses.length : 0;
    }
    // Defensive: ensure the just-won mode is treated as done even if its
    // localStorage write hasn't been observed yet by this read.
    done.add(current);
    return {
      next: nextUnfinishedMode(current, done),
      totalGuesses,
    };
  });

  if (data.next === null) {
    return (
      <DailyCompletePanel
        modeCount={BUILT_MODE_SLUGS.length}
        totalGuesses={data.totalGuesses}
      />
    );
  }

  return (
    <Link
      href={`/${data.next.slug}/`}
      className="group relative inline-flex"
      aria-label={`Continue to ${data.next.label} mode`}
    >
      {/* warm hover halo */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-2 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "rgba(214,160,92,0.32)" }}
      />

      {/* button body — accent-bordered deco panel with double hairline.
          Stands out clearly while keeping the parlour-room aesthetic. */}
      <span className="relative inline-flex items-center gap-3 border border-edge bg-muted px-5 py-3 font-display text-sm font-bold uppercase tracking-[0.16em] shadow-lg shadow-black/40 transition-transform duration-200 group-hover:-translate-y-0.5 group-active:translate-y-0">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-1 border border-hairline"
        />

        <span className="relative font-mono text-[10px] tracking-[0.22em] text-info">
          NEXT
        </span>

        <span className="relative h-3 w-px bg-line" aria-hidden />

        <span className="relative">
          <span className="text-accent-soft">{data.next.label}</span>
          <span className="text-ink-soft"> mode</span>
        </span>

        <svg
          aria-hidden
          width="16"
          height="10"
          viewBox="0 0 16 10"
          className="relative shrink-0 text-accent-soft transition-transform duration-200 group-hover:translate-x-1"
        >
          <path
            d="M0 5 L14 5 M9 1 L15 5 L9 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        </svg>
      </span>
    </Link>
  );
}

// Shown when this was the last unfinished mode of the day. The same panel
// renders inside every mode's win banner, so the daily-complete screen
// looks identical regardless of which mode the player finished on. The
// countdown to UTC midnight is the visual focal point — players don't need
// to navigate home to find out when puzzles refresh.
function DailyCompletePanel({
  modeCount,
  totalGuesses,
}: {
  modeCount: number;
  totalGuesses: number;
}) {
  return (
    <div className="relative flex w-full max-w-xl flex-col border border-correct/55 bg-canvas/50 p-5 shadow-lg shadow-black/40 sm:p-6">
      {/* Inner deco hairline echoes the parlour-room frame style used by
          the in-app deco cards. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-1 border border-correct/15"
      />

      {/* Header row: completion tag on the left, summary stats on the right
          so the countdown below isn't competing with prose. */}
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-correct">
          <span aria-hidden>✓</span>
          Daily Complete
        </div>
        <div className="text-right font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          <span className="text-ink">{modeCount}</span> modes ·{" "}
          <span className="text-ink">{totalGuesses}</span>{" "}
          {totalGuesses === 1 ? "guess" : "guesses"}
        </div>
      </div>

      {/* Countdown is the hero — top/bottom hairlines isolate it as a
          dedicated band, the live pulse dot signals the timer is ticking,
          and the display itself reads at a glance even from a phone tab
          preview. tabular-nums prevents digit jitter as seconds tick. */}
      <div className="relative mt-5 flex flex-col items-center gap-2 border-y border-correct/20 py-5">
        <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-info">
          Next puzzle in
        </span>
        <div className="flex items-center gap-3">
          <LiveDot />
          <NextResetCountdown
            label=""
            className="font-display text-4xl tabular-nums leading-none text-accent-soft sm:text-5xl"
          />
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-ink-faint">
          Refreshes at midnight UTC
        </span>
      </div>

      {/* Back to home centered so it reads as a deliberate next action,
          not a throwaway link tucked into a corner. */}
      <div className="relative mt-4 flex justify-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-info underline-offset-4 hover:underline"
        >
          ← Back to home
        </Link>
      </div>
    </div>
  );
}

// Pulsing dot that visually anchors the countdown as something live.
// Outer ping ring fades on a 1.6s loop; inner solid dot is steady.
function LiveDot() {
  return (
    <span
      className="relative inline-flex h-2.5 w-2.5 shrink-0"
      aria-hidden
    >
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-correct opacity-70" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-correct" />
    </span>
  );
}
