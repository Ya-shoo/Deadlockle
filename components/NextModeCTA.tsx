"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BUILT_MODE_SLUGS,
  MODES,
  nextUnfinishedMode,
  type ModeDef,
  type ModeSlug,
} from "@/lib/modes";
import { dayString } from "@/lib/daily";
import { loadModeState } from "@/lib/storage";
import { DailyStatsBand } from "./DailyStatsBand";
import { NextResetCountdown } from "./NextResetCountdown";
import { ScoreBadge } from "./ScoreBadge";
import { StreakBadge } from "./StreakBadge";
import { TryOWdleCard } from "./TryOWdleCard";

// Per-mode breakdown row shown as supporting info in DailyCompletePanel.
// Each entry is one of the built modes the player engaged with today; status
// reflects how it ended (win or fail), `count` is the guess count.
type ModeBreakdown = {
  slug: ModeSlug;
  label: string;
  count: number;
  status: "won" | "failed";
};

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
    wonCount: number;
    breakdown: ModeBreakdown[];
  }>(() => {
    const day = dayString();
    const done = new Set<ModeSlug>();
    let wonCount = 0;
    const breakdown: ModeBreakdown[] = [];
    for (const slug of BUILT_MODE_SLUGS) {
      const st = loadModeState(slug, day);
      const isWon = st.won === true;
      const isFailed = st.failed === true || st.gaveUp === true;
      if (isWon || isFailed) done.add(slug);
      if (isWon) wonCount++;
      // ConversationState (Quote/Sound) shares the same on-disk shape: its
      // `guesses` is an array of objects, but `.length` still gives the
      // count we want.
      const count = Array.isArray(st.guesses) ? st.guesses.length : 0;
      if (isWon || isFailed) {
        const mode = MODES.find((m) => m.slug === slug);
        breakdown.push({
          slug,
          label: mode?.label ?? slug,
          count,
          status: isWon ? "won" : "failed",
        });
      }
    }
    // Defensive: ensure the just-completed mode is treated as done even if
    // its localStorage write hasn't been observed yet by this read.
    done.add(current);
    return {
      next: nextUnfinishedMode(current, done),
      wonCount,
      breakdown,
    };
  });

  // Notify the FeedbackButton that a mode was just completed. On desktop
  // it re-scans for all-done amplification; on mobile it surfaces its
  // temporary sticky-footer popup. We dispatch on every NextModeCTA mount
  // (i.e., every win screen) rather than gating on all-done, since the
  // mobile popup is meant to fire after every completion. Same-tab
  // localStorage writes don't trigger the native `storage` event, so
  // this explicit signal is what drives both behaviours.
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("feedback:refresh"));
    }
  }, []);

  if (data.next === null) {
    return (
      <DailyCompletePanel
        modeCount={BUILT_MODE_SLUGS.length}
        wonCount={data.wonCount}
        breakdown={data.breakdown}
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
// countdown to the 2:15am Pacific reset is the visual focal point —
// players don't need to navigate home to find out when puzzles refresh.
function DailyCompletePanel({
  modeCount,
  wonCount,
  breakdown,
}: {
  modeCount: number;
  wonCount: number;
  breakdown: ModeBreakdown[];
}) {
  const sweep = wonCount === modeCount;
  // This panel always renders nested inside a green win card (or red
  // LossReveal), so it doesn't need its own border/background — that
  // would double up the parent's tinted frame. The wins/N hex is the
  // score focal point; per-mode pills are supporting info underneath.
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="relative flex flex-col">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-correct">
          <span aria-hidden>✓</span>
          Daily Complete
        </div>

        {/* Score focal point: hex badge with wins / total. Sweep gets a
            short subtitle so a perfect day feels distinct from a mixed
            one without needing a separate visual treatment. */}
        <div className="mt-3 flex flex-col items-center gap-2 border-y border-correct/25 py-4">
          <ScoreBadge count={wonCount} total={modeCount} />
          <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-ink-faint">
            {sweep ? "Sweep" : `${modeCount - wonCount} missed`}
          </span>
        </div>

        {/* Per-mode pills: label + status glyph + guess count. Lets the
            player see the round-by-round shape of their day without
            another visual heavyweight. */}
        {breakdown.length > 0 && (
          <div className="mt-3">
            <ModePillRow stats={breakdown} />
          </div>
        )}

        {/* Live PostHog-backed stats — hides cleanly when sample size
            is below threshold (cold start, low DAU day) or when the
            stats endpoint serves an empty payload (secrets missing). */}
        <DailyStatsBand />

        {/* Countdown band. The live pulse dot signals the timer is ticking,
            and the display itself reads at a glance from a phone tab. */}
        <div className="mt-3 flex flex-col items-center gap-1.5 border-y border-correct/25 py-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-info">
            Next puzzle in
          </span>
          <div className="flex items-center gap-2.5">
            <LiveDot />
            <NextResetCountdown
              label=""
              className="font-display text-3xl font-semibold tabular-nums leading-none text-accent-soft sm:text-4xl"
            />
          </div>
          <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-ink-faint">
            Refreshes at 2:15am Pacific
          </span>
        </div>

        <div className="mt-3">
          <StreakBadge variant="band" />
        </div>

        <div className="mt-3 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-info underline-offset-4 hover:underline"
          >
            ← Back to home
          </Link>
        </div>
      </div>

      {/* Cross-promo: the player just finished every mode for the day, so
          surfacing the sister site is the natural next-action prompt.
          Compact variant since this lives inside the max-w-md win card. */}
      <TryOWdleCard compact />
    </div>
  );
}

// Per-mode breakdown pills. Won pills use the correct (green) token;
// failed pills use far (red). Compact layout so all five fit inside the
// max-w-md card; wraps to a second row on the narrowest phones.
function ModePillRow({ stats }: { stats: ModeBreakdown[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {stats.map((s) => {
        const cls =
          s.status === "won"
            ? "border-correct/40 bg-correct/10 text-correct"
            : "border-far/40 bg-far/10 text-far";
        return (
          <span
            key={s.slug}
            className={
              "inline-flex items-center gap-1.5 rounded-(--radius-pill) border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] " +
              cls
            }
            aria-label={`${s.label}: ${s.status === "won" ? "won in" : "missed after"} ${s.count} ${s.count === 1 ? "guess" : "guesses"}`}
          >
            <span>{s.label}</span>
            <span aria-hidden>{s.status === "won" ? "✓" : "✕"}</span>
            <span className="tabular-nums text-ink-soft">{s.count}</span>
          </span>
        );
      })}
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
