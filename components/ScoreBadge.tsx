"use client";

import { motion } from "motion/react";

// Compact hex score badge for inline use in per-mode win panels.
// Mirrors the home-page CompleteBadge's deco hex frame at a smaller scale
// so the visual language stays consistent across the all-modes-done state
// and individual wins.
export function ScoreBadge({ count }: { count: number }) {
  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      transition={{ duration: 0.5, delay: 0.15, ease: [0.34, 1.56, 0.64, 1] }}
      className="relative shrink-0"
      style={{ width: 84, height: 96 }}
      aria-label={`Solved in ${count} ${count === 1 ? "guess" : "guesses"}`}
    >
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          inset: -10,
          background:
            "radial-gradient(ellipse at center, rgba(127,184,108,0.32), transparent 65%)",
          filter: "blur(8px)",
        }}
      />

      <svg
        viewBox="0 0 84 96"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <defs>
          <linearGradient
            id="score-badge-fill"
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop offset="0%" stopColor="rgba(127,184,108,0.22)" />
            <stop offset="100%" stopColor="rgba(127,184,108,0.04)" />
          </linearGradient>
        </defs>
        <polygon
          points="42,2 82,24 82,72 42,94 2,72 2,24"
          fill="url(#score-badge-fill)"
          stroke="var(--tile-correct)"
          strokeWidth="1.5"
        />
        <polygon
          points="42,8 76,28 76,68 42,88 8,68 8,28"
          fill="none"
          stroke="rgba(127,184,108,0.35)"
          strokeWidth="0.7"
        />
      </svg>

      <div className="relative flex h-full flex-col items-center justify-center px-2 text-center">
        <svg
          width="20"
          height="20"
          viewBox="0 0 56 56"
          className="text-correct"
          aria-hidden
        >
          <path
            d="M10 28 L24 42 L46 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        </svg>
        <div className="mt-1 font-display text-2xl leading-none text-correct">
          {count}
        </div>
        <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.22em] text-info">
          {count === 1 ? "guess" : "guesses"}
        </div>
      </div>
    </motion.div>
  );
}
