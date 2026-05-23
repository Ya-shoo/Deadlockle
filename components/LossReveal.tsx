"use client";

import { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { ModeSlug } from "@/lib/modes";
import { NextModeCTA } from "./NextModeCTA";

// Shared "out of guesses" card. Muted red wash + "Better luck tomorrow"
// eyebrow + caller-supplied answer slot + the standard NextModeCTA. Each
// mode renders its own reveal markup as children so the wrapper doesn't
// need to know about per-mode answer shape (Item has slot + tier, Ability
// has name + description, Sound has two speakers, etc.).
//
// Tokens: `far` is Deadlockle's red (`wrong` is slate). Border opacity
// kept low so the card reads as muted, not alarming.
export function LossReveal({
  current,
  children,
}: {
  current: ModeSlug;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      <motion.div
        key="loss"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto mb-8 w-full max-w-md rounded-(--radius-card) border border-far/35 bg-far/10 p-4 sm:p-5"
      >
        <div className="flex flex-col gap-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-far">
            Better luck tomorrow
          </div>
          {children}
          <div className="flex justify-center sm:justify-start">
            <NextModeCTA current={current} />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
