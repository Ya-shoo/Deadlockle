"use client";

import { useEffect, useState } from "react";
import { dayString } from "@/lib/daily";
import { loadModeState } from "@/lib/storage";
import { BUILT_MODE_SLUGS } from "@/lib/modes";
import { StreakBadge } from "./StreakBadge";

type ModeStatus = "won" | "failed" | "open";

// Daily-progress indicator on the right side of the header. One dot per
// built mode — green when won, muted red when the player capped out
// (failed), neutral line when not yet finished. Compact `N / 5` wins
// counter sits beside the dots so the player sees their score at-a-glance
// from anywhere in the app.
//
// Re-reads localStorage on the same `feedback:refresh` signal NextModeCTA
// dispatches on every win/loss, so the dots stay in lockstep with the
// completion banner the player just dismissed — no navigation home
// required to see the count tick up.
export function HeaderProgress() {
  const [statuses, setStatuses] = useState<ModeStatus[] | null>(null);

  useEffect(() => {
    const refresh = () => {
      const day = dayString();
      setStatuses(
        BUILT_MODE_SLUGS.map((slug) => {
          const st = loadModeState(slug, day);
          if (st.won) return "won";
          // Legacy Item-mode `gaveUp` saves keep their place beside new
          // `failed` saves — both render as the muted-red failed dot.
          if (st.failed === true || st.gaveUp === true) return "failed";
          return "open";
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

  const wonCount = statuses.filter((s) => s === "won").length;
  const failedCount = statuses.filter((s) => s === "failed").length;
  const total = statuses.length;

  if (total === 0) return null;

  const title = `${wonCount} won · ${failedCount} missed · ${total - wonCount - failedCount} left`;

  return (
    <div className="flex items-center gap-3" title={title} aria-label={title}>
      <StreakBadge variant="header" />
      <div className="flex items-center gap-2.5">
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-info sm:inline">
          {wonCount} / {total}
        </span>
        <div className="flex items-center gap-1.5">
          {statuses.map((status, i) => (
            <span
              key={i}
              className={
                status === "won"
                  ? "h-1.5 w-1.5 rounded-full bg-correct"
                  : status === "failed"
                    ? "h-1.5 w-1.5 rounded-full bg-far/70"
                    : "h-1.5 w-1.5 rounded-full bg-line"
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
