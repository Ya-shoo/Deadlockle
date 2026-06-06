"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import { createPortal } from "react-dom";
import { media } from "@/lib/media";
import {
  STREAK_TIER_ACCENT,
  STREAK_TIER_LABEL,
  STREAK_TIER_PERCENTILE_MAX,
  type StreakTier,
} from "@/lib/streakRank";

// On-promotion celebration. Auto-opened by StreakRankBadge the first time a
// player reaches a new, higher streak tier; also re-openable by tapping the
// header pill. Mirrors ShareModal's overlay mechanics (portal to body, Esc
// to close, scroll lock, backdrop-click close) with a celebratory spring.
// Pure celebration — no share card for streak ranks for now (OWdle has
// one; revisit if rank shares earn their keep there).

type Props = {
  tier: StreakTier;
  streak: number;
  onClose: () => void;
};

export function StreakRankModal({ tier, streak, onClose }: Props) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const accent = STREAK_TIER_ACCENT[tier];
  const label = STREAK_TIER_LABEL[tier];
  const pct = STREAK_TIER_PERCENTILE_MAX[tier];

  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`New streak rank: ${label}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        padding: 16,
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="relative w-full max-w-[420px] overflow-hidden rounded-(--radius-card) border text-ink"
        style={{
          // Minimal flat tier identity — no gradients, no top strip. The
          // card carries the rank color through a tier-tinted solid
          // surface and a tier border alone.
          borderColor: hexA(accent, 0.5),
          background: `color-mix(in srgb, var(--color-surface) 88%, ${accent} 12%)`,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-2.5 z-10 px-2 py-1 font-mono text-base leading-none text-ink-soft transition-colors hover:text-ink"
        >
          ×
        </button>

        <div className="relative flex flex-col items-center gap-3 px-6 pb-6 pt-7 text-center">
          <span
            className="font-mono text-[10px] uppercase tracking-[0.28em]"
            style={{ color: accent }}
          >
            New streak rank
          </span>

          {/* Badge pop. Deadlock badges are wide (906×584) — the box is
              landscape, not square. */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 14, delay: 0.08 }}
            className="relative my-1"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={media(`/ranks/${tier}.png`)}
              alt={label}
              width={210}
              height={135}
              style={{ width: 210, height: 135 }}
              className="relative object-contain"
            />
          </motion.div>

          <h2 className="font-display text-2xl text-ink">
            The Patrons notice you.
          </h2>

          <p className="font-sans text-lg font-semibold leading-snug text-ink">
            You stand <span style={{ color: accent }}>{label}</span> among
            Deadlockle streak holders.
          </p>

          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
            <span className="tabular-nums text-accent">{streak}</span>-day streak
            {" · "}top{" "}
            <span className="tabular-nums text-accent-soft">{pct}</span>%
          </p>

          {/* Solid tier-accent CTA — dark canvas ink on the accent fill,
              same hover treatment as the site's other solid CTAs. */}
          <button
            type="button"
            onClick={onClose}
            className="mt-3 rounded-(--radius-pill) px-7 py-3 font-mono text-[13px] font-semibold uppercase tracking-[0.18em] transition-all hover:brightness-110 active:scale-[0.99]"
            style={{ background: accent, color: "#0c1820" }}
          >
            Keep it going :D
          </button>
        </div>
      </motion.div>
    </div>
  );

  return createPortal(overlay, document.body);
}

function hexA(hex: string, a: number): string {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${a})`;
}
