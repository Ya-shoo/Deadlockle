"use client";

import Link from "next/link";
import { nextBuiltMode, type ModeSlug } from "@/lib/modes";

// Renders inline in a game's win state. A prominent deco-style button
// pointing at the next built mode in canonical order, or — when the player
// is caught up — a smaller "all done · home" link that doesn't compete with
// the daily-complete celebration on the home page.
export function NextModeCTA({ current }: { current: ModeSlug }) {
  const next = nextBuiltMode(current);

  if (!next) {
    return (
      <Link
        href="/"
        className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-correct transition-opacity hover:opacity-80"
      >
        <span aria-hidden>✓</span>
        Daily complete · home →
      </Link>
    );
  }

  return (
    <Link
      href={`/${next.slug}/`}
      className="group relative inline-flex"
      aria-label={`Continue to ${next.label} mode`}
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
          <span className="text-accent-soft">{next.label}</span>
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
