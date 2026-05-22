"use client";

import { useEffect, useState } from "react";
import { dayString } from "@/lib/daily";
import { loadModeState } from "@/lib/storage";
import { BUILT_MODE_SLUGS } from "@/lib/modes";
import { StreakBadge } from "./StreakBadge";

// Daily-progress indicator on the right side of the header. One dot per
// built mode: filled when that mode has been won today.
export function HeaderProgress() {
  const [statuses, setStatuses] = useState<boolean[] | null>(null);

  // Re-read on `feedback:refresh` (dispatched by NextModeCTA on every win)
  // so the dots stay correct after a mode completes without requiring a
  // navigation back to the home page.
  useEffect(() => {
    const refresh = () => {
      const day = dayString();
      setStatuses(
        BUILT_MODE_SLUGS.map((slug) => {
          const st = loadModeState(slug, day);
          return st.won || st.gaveUp === true;
        }),
      );
    };
    refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("feedback:refresh", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("feedback:refresh", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  if (!statuses) {
    return (
      <div
        aria-hidden
        className="flex items-center gap-1.5 opacity-0"
        style={{ minWidth: BUILT_MODE_SLUGS.length * 14 }}
      />
    );
  }

  const wonCount = statuses.filter(Boolean).length;
  const total = statuses.length;

  if (total === 0) return null;

  return (
    <div className="flex items-center gap-3">
      <StreakBadge variant="header" />
      <div
        className="flex items-center gap-2.5"
        title={`${wonCount} of ${total} modes complete today`}
        aria-label={`${wonCount} of ${total} modes complete today`}
      >
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-info sm:inline">
          {wonCount} / {total}
        </span>
        <div className="flex items-center gap-1.5">
          {statuses.map((won, i) => (
            <span
              key={i}
              className={
                won
                  ? "h-1.5 w-1.5 rounded-full bg-correct"
                  : "h-1.5 w-1.5 rounded-full bg-line"
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
