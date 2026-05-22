"use client";

import { useCallback, useEffect, useState } from "react";
import { bumpStreakIfNeeded, type StreakState } from "@/lib/streak";

const REFRESH_EVENT = "feedback:refresh";

// Subscribes to the same `feedback:refresh` signal NextModeCTA already
// dispatches on every win. Re-bumps on tab focus and visibility change so
// the badge stays correct after a day rollover or a cross-tab completion.
function useStreak(): StreakState | null {
  const [state, setState] = useState<StreakState | null>(null);

  const refresh = useCallback(() => {
    setState(bumpStreakIfNeeded());
  }, []);

  useEffect(() => {
    refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener(REFRESH_EVENT, refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener(REFRESH_EVENT, refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  return state;
}

function FlameIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
      className="shrink-0"
      fill="currentColor"
    >
      <path d="M13.5 1.5c0 3 1.5 4 3 6s2 4 2 6c0 4-3 7-6.5 7s-6.5-3-6.5-7c0-2 1-3.5 2-4.5 0 2 1 2.5 2 1.5 0-1.5 0-3 1-4.5 1-1.5 2-2.5 3-5z" />
    </svg>
  );
}

type Variant = "header" | "hero" | "band";

export function StreakBadge({ variant }: { variant: Variant }) {
  const streak = useStreak();
  // Hero and band variants only render inside post-completion contexts
  // (DailyCompleteHero / DailyCompletePanel), where bumpStreakIfNeeded has
  // already pushed current to ≥ 1. Hide them otherwise — a "0" badge
  // inside a daily-complete celebration would read as a regression.
  if (!streak && variant !== "header") return null;
  if (streak && streak.current === 0 && variant !== "header") return null;

  // Header treatment: render a faded "0" when there's no active streak so
  // new visitors discover the mechanic before they've earned the first one.
  if (variant === "header") {
    if (!streak) {
      // Hold layout space during hydration so the header doesn't jump.
      return (
        <span
          aria-hidden
          className="inline-flex items-center gap-1 px-1.5 py-0.5 opacity-0"
        >
          <FlameIcon size={10} />
          <span className="font-mono text-[10px] tabular-nums">0</span>
        </span>
      );
    }
    if (streak.current === 0) {
      return (
        <span
          className="inline-flex items-center gap-1 border border-dashed border-line bg-transparent px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint opacity-80 transition-opacity hover:opacity-100"
          title="Complete every mode today to start a streak"
          aria-label="No active streak. Complete every mode today to start one."
        >
          <FlameIcon size={10} />
          <span className="tabular-nums">0</span>
        </span>
      );
    }
    const title = `${streak.current}-day streak${
      streak.longest > streak.current ? ` (best: ${streak.longest})` : ""
    }`;
    return (
      <span
        className="inline-flex items-center gap-1 border border-accent/40 bg-accent/5 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-accent"
        title={title}
        aria-label={title}
      >
        <FlameIcon size={10} />
        <span className="tabular-nums">{streak.current}</span>
      </span>
    );
  }

  // Past the header branch, streak is guaranteed non-null with current > 0.
  if (!streak) return null;
  const title = `${streak.current}-day streak${
    streak.longest > streak.current ? ` (best: ${streak.longest})` : ""
  }`;

  if (variant === "hero") {
    return (
      <div
        className="mt-6 inline-flex items-center gap-3 border border-accent/40 bg-accent/5 px-4 py-2.5 text-accent"
        aria-label={title}
      >
        <FlameIcon size={20} />
        <div className="text-left leading-none">
          <div className="font-display text-lg">
            <span className="tabular-nums">{streak.current}</span>-day streak
          </div>
          {streak.longest > streak.current && (
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
              Best: <span className="tabular-nums">{streak.longest}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // band — matches the rhythm of the "Next puzzle in" band in DailyCompletePanel
  return (
    <div
      className="relative flex flex-col items-center gap-2 border-y border-accent/20 py-4"
      aria-label={title}
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-info">
        Streak
      </span>
      <div className="flex items-baseline gap-3 text-accent">
        <FlameIcon size={26} />
        <span className="font-display text-4xl tabular-nums leading-none">
          {streak.current}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          {streak.current === 1 ? "day" : "days"}
        </span>
      </div>
      {streak.longest > streak.current && (
        <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-ink-faint">
          Best: <span className="tabular-nums">{streak.longest}</span>
        </span>
      )}
    </div>
  );
}
