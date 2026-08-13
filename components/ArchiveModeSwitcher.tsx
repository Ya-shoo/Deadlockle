"use client";

import Link from "next/link";
import { MODES } from "@/lib/modes";
import type { ArchiveModeSlug } from "./ArchiveGrid";

// Row of mode tabs shown under a mode's week grid so a player can jump
// straight to another mode's archive without detouring through the hub.
// Lists only the modes with a live archive route; the current one renders
// as a non-link active chip. Solid surfaces + colored state on the border,
// per Deadlockle's design rule.
const ACTIVE_ARCHIVE_MODES: ArchiveModeSlug[] = ["classic", "mugshot", "sound"];

function labelOf(slug: string): string {
  return MODES.find((m) => m.slug === slug)?.label ?? slug;
}

export function ArchiveModeSwitcher({
  current,
}: {
  current: ArchiveModeSlug;
}) {
  return (
    <div className="mt-12 flex flex-col items-center gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
        Switch archive
      </span>
      <nav
        aria-label="Switch archive mode"
        className="flex flex-wrap items-center justify-center gap-2"
      >
        {ACTIVE_ARCHIVE_MODES.map((slug) =>
          slug === current ? (
            <span
              key={slug}
              aria-current="page"
              className="border border-edge bg-muted px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink"
            >
              {labelOf(slug)}
            </span>
          ) : (
            <Link
              key={slug}
              href={`/archive/${slug}/`}
              className="border border-line bg-surface px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft transition-colors hover:border-edge hover:text-ink"
            >
              {labelOf(slug)}
            </Link>
          ),
        )}
      </nav>
    </div>
  );
}
