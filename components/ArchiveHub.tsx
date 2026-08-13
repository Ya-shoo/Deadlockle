"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MODES, type ModeDef } from "@/lib/modes";
import { dayString } from "@/lib/daily";
import { archiveFillStatus, archiveWindow } from "@/lib/archive";
import type { ArchiveModeSlug } from "./ArchiveGrid";

// The archive front door. One card per canonical daily mode: modes with a
// live archive (Classic, Mugshot, Conversation) link to their week grid
// with a solved-count teaser; the rest are greyed "Soon" teasers — the same
// treatment the home page gives an unbuilt mode. Reuses the .mode-card
// visual language so the hub reads as part of the site.

// Canonical modes whose archive route is live. Widen as each ships.
const ACTIVE_ARCHIVE_MODES = new Set<string>(["classic", "mugshot", "sound"]);

const ARCHIVE_BLURBS: Record<string, string> = {
  classic: "Replay the past week of attribute puzzles.",
  mugshot: "Past cropped-portrait pull-backs to retry.",
  sound: "Re-guess past two-speaker conversations.",
  ability: "Past ability-icon reveals to retry.",
  item: "Past blurred-item icons to sharpen.",
};

// Solved-this-week tally for one mode, computed client-side (localStorage).
// Mounted-gated so the static-export prerender doesn't fight hydration. The
// denominator is the ACTUAL window length (clamped near the bag cutover),
// matching the grid rather than assuming a fixed 7.
function useModeWeek(
  mode: ArchiveModeSlug,
): { won: number; total: number } | null {
  const [week, setWeek] = useState<{ won: number; total: number } | null>(
    null,
  );
  useEffect(() => {
    const win = archiveWindow(dayString());
    const won = win.filter(
      (d) => archiveFillStatus(mode, d).outcome === "won",
    ).length;
    setWeek({ won, total: win.length });
  }, [mode]);
  return week;
}

export function ArchiveHub() {
  // Fixed-count hook calls (one per active archive mode) so the tally stays
  // Rules-of-Hooks-safe as more modes light up.
  const classicWeek = useModeWeek("classic");
  const mugshotWeek = useModeWeek("mugshot");
  const soundWeek = useModeWeek("sound");
  const weekByMode: Record<string, { won: number; total: number } | null> = {
    classic: classicWeek,
    mugshot: mugshotWeek,
    sound: soundWeek,
  };

  return (
    <div>
      <header className="mb-10">
        <h1 className="font-display display-headline text-4xl text-ink sm:text-6xl">
          Archive
        </h1>
        <p className="mt-4 max-w-lg text-ink-soft">
          Replay past daily puzzles. Catch up on a day you missed, or turn a
          loss into a win. Archive play is just for you; it never touches your
          streak.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        {MODES.map((mode) =>
          ACTIVE_ARCHIVE_MODES.has(mode.slug) ? (
            <ActiveCard
              key={mode.slug}
              label={mode.label}
              blurb={ARCHIVE_BLURBS[mode.slug] ?? mode.blurb}
              href={`/archive/${mode.slug}/`}
              week={weekByMode[mode.slug] ?? null}
            />
          ) : (
            <SoonCard
              key={mode.slug}
              label={mode.label}
              blurb={ARCHIVE_BLURBS[mode.slug] ?? mode.blurb}
            />
          ),
        )}
      </div>
    </div>
  );
}

function ActiveCard({
  label,
  blurb,
  href,
  week,
}: {
  label: string;
  blurb: string;
  href: string;
  week: { won: number; total: number } | null;
}) {
  return (
    <Link href={href} className="mode-card group relative flex h-full flex-col p-5">
      <span aria-hidden className="mode-card__corner mode-card__corner--tl" />
      <span aria-hidden className="mode-card__corner mode-card__corner--br" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl leading-tight text-ink">
            {label}
          </h2>
          {week && week.won > 0 ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-correct">
              {week.won}/{week.total} this week
            </span>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent-soft">
              Open →
            </span>
          )}
        </div>
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ink-soft">
          {blurb}
        </p>
        <span aria-hidden className="mode-card__arrow font-mono text-base">
          →
        </span>
      </div>
    </Link>
  );
}

function SoonCard({ label, blurb }: { label: string; blurb: string }) {
  return (
    <div
      className="mode-card mode-card--disabled relative flex h-full flex-col p-5"
      aria-disabled="true"
    >
      <div className="relative flex h-full flex-col">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl leading-tight text-ink-soft">
            {label}
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-info">
            Soon
          </span>
        </div>
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ink-faint">
          {blurb}
        </p>
      </div>
    </div>
  );
}
