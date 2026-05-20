"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { dayString } from "@/lib/daily";
import { getDailyBanners, STATIC_BANNERS, type Banner } from "@/lib/banners";
import { media } from "@/lib/media";

const ROTATE_MS = 10000;
const FADE_MS = 1400;

// Full-bleed backdrop for the hero section. Crossfades through a date-
// seeded sequence of Deadlock hero scene art with a slow Ken Burns drift on
// each frame for motion. Sits behind the headline; a strong gradient at the
// bottom keeps text legibility intact.
//
// SSR uses STATIC_BANNERS so the first paint already shows an image; once
// the client mounts and `day` is known, we swap to the day-seeded order.
export function HomeBanner() {
  const [day, setDay] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setDay(dayString());
  }, []);

  const sequence = useMemo<Banner[]>(
    () => (day ? getDailyBanners(day) : STATIC_BANNERS),
    [day],
  );

  useEffect(() => {
    if (sequence.length < 2) return;
    const t = setInterval(
      () => setIdx((i) => (i + 1) % sequence.length),
      ROTATE_MS,
    );
    return () => clearInterval(t);
  }, [sequence.length]);

  const current = sequence[idx % Math.max(1, sequence.length)];

  return (
    <div className="absolute inset-0 overflow-hidden bg-canvas">
      {current && (
        <AnimatePresence mode="sync" initial={false}>
          <motion.div
            key={current.file}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: FADE_MS / 1000, ease: "easeOut" }}
            className="absolute inset-0"
          >
            {/* Inner wrapper handles Ken Burns drift independently of the
                crossfade so each new image starts its own zoom from neutral
                rather than inheriting the previous frame's transform. */}
            <motion.div
              initial={{ scale: 1.04 }}
              animate={{ scale: 1.12 }}
              transition={{
                duration: (ROTATE_MS + FADE_MS) / 1000,
                ease: "linear",
              }}
              className="absolute inset-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={media(current.file)}
                alt=""
                className="block h-full w-full object-cover"
                loading="eager"
                decoding="async"
              />
            </motion.div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Top hairline tint and bottom-to-canvas fade keep the headline
          legible and ground the banner against the page background. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(12,24,32,0.55) 0%, rgba(12,24,32,0.10) 28%, rgba(12,24,32,0.55) 70%, var(--bg-base) 100%)",
        }}
      />

      {/* Subtle accent vignette — Deadlock amber from bottom-right and a
          touch of teal from top-left, in keeping with the parlour palette. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 55% at 92% 100%, rgba(214,160,92,0.14), transparent 65%), radial-gradient(ellipse 50% 40% at 8% 0%, rgba(94,197,212,0.08), transparent 65%)",
        }}
      />

      {/* Film grain reuses the body-level grain texture but tightened a bit
          for the banner crop — gives the crossfade an inky, period feel. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 0.92  0 0 0 0 0.78  0 0 0 0.7 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
          opacity: 0.08,
        }}
      />

    </div>
  );
}
