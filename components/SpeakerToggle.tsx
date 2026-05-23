"use client";

import clsx from "clsx";
import type { Hero } from "@/lib/heroes";
import { media } from "@/lib/media";

// Segmented toggle for picking which speaker to guess in a two-speaker
// puzzle (Quote, Conversation). One row of two tabs replaces the older
// pair of stacked comboboxes — saves vertical space on mobile and makes
// the "which one am I guessing?" decision an explicit click rather than
// implicit field focus. Auto-jumps to the unsolved side once one is
// revealed (handled by the caller via the `activeTarget` it passes in).

export function SpeakerToggle({
  activeTarget,
  aRevealed,
  bRevealed,
  speakerA,
  speakerB,
  onSelect,
}: {
  activeTarget: 0 | 1;
  aRevealed: boolean;
  bRevealed: boolean;
  speakerA: Hero;
  speakerB: Hero;
  onSelect: (target: 0 | 1) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Choose which speaker to guess"
      className="grid grid-cols-2 gap-1 rounded-(--radius-card) border border-line bg-inset/60 p-1"
    >
      <SpeakerSegment
        target={0}
        active={activeTarget === 0}
        revealed={aRevealed}
        speaker={speakerA}
        fallbackLabel="Speaker A"
        tone="info"
        onClick={() => onSelect(0)}
      />
      <SpeakerSegment
        target={1}
        active={activeTarget === 1}
        revealed={bRevealed}
        speaker={speakerB}
        fallbackLabel="Speaker B"
        tone="accent-soft"
        onClick={() => onSelect(1)}
      />
    </div>
  );
}

function SpeakerSegment({
  active,
  revealed,
  speaker,
  fallbackLabel,
  tone,
  onClick,
}: {
  target: 0 | 1;
  active: boolean;
  revealed: boolean;
  speaker: Hero;
  fallbackLabel: string;
  tone: "info" | "accent-soft";
  onClick: () => void;
}) {
  const baseTone = tone === "info" ? "text-info" : "text-accent-soft";
  const activeBg =
    tone === "info"
      ? "bg-info/15 ring-1 ring-info/40"
      : "bg-accent-soft/15 ring-1 ring-accent-soft/40";

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={revealed}
      onClick={onClick}
      className={clsx(
        "flex min-h-[44px] items-center justify-center gap-2 rounded-(--radius-card) px-3 py-2 text-center font-mono text-[11px] uppercase tracking-[0.22em] transition-colors",
        revealed
          ? "bg-correct/15 text-correct ring-1 ring-correct/40 cursor-default"
          : active
            ? clsx(activeBg, baseTone)
            : clsx("bg-transparent text-ink-soft hover:bg-muted/40", baseTone),
      )}
    >
      {revealed ? (
        <>
          {speaker.portrait_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={media(speaker.portrait_url)}
              alt=""
              className="h-6 w-6 shrink-0 rounded-(--radius-pill) bg-muted object-cover"
            />
          )}
          <span className="truncate">✓ {speaker.name}</span>
        </>
      ) : (
        <span className="truncate">{fallbackLabel}</span>
      )}
    </button>
  );
}
