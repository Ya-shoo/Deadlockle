"use client";

import Link from "next/link";

// Self-contained entry point to the past-week Archive, rendered centered
// under the home modes grid. A core retention hook (replay a missed day,
// redeem a red day to green), so it gets a real button rather than a quiet
// text link.
//
// SOLID surfaces only: an opaque bg-surface body (the same panel token the
// home cards sit on) with a solid accent chip — no translucent washes. The
// button reads off its solid fill, border, shadow, and hover motion (lift +
// icon spin + arrow). `subline`/`className` let each host tune copy +
// alignment.
export function ArchiveCta({
  subline = "Replay past days",
  className = "",
}: {
  subline?: string;
  className?: string;
}) {
  return (
    <Link
      href="/archive/"
      aria-label="Open the archive to replay past days"
      className={
        "group inline-flex items-center gap-3 rounded-(--radius-card) border border-line bg-surface px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.45),0_4px_10px_-6px_rgba(0,0,0,0.55)] transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-edge hover:shadow-[0_14px_28px_-10px_rgba(0,0,0,0.75),0_8px_22px_-12px_rgba(214,160,92,0.32)] active:translate-y-0 " +
        className
      }
    >
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-(--radius-card) bg-accent text-on-accent transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-rotate-[160deg]"
      >
        ↺
      </span>
      <span className="flex flex-col text-left">
        <span className="font-display text-base font-bold uppercase leading-none tracking-wide text-ink">
          Archive
        </span>
        <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          {subline}
        </span>
      </span>
      <span
        aria-hidden
        className="ml-1 shrink-0 font-display text-lg text-accent transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5"
      >
        →
      </span>
    </Link>
  );
}
