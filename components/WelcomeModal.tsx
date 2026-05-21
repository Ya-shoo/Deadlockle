"use client";

// First-time-visitor onboarding. Auto-opens once per browser if no prior
// Deadlockle localStorage exists, and exposes a "First time?" trigger so
// returning players can re-read the rules from the home page hero.
//
// Mirrors KofiModal's native <dialog> + showModal() pattern so dismiss
// behaviours (Esc, backdrop click, close button) all flow through the
// same state path and consistently mark the visitor as onboarded.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const SEEN_KEY = "deadlockle.welcome.seen";
const STATE_PREFIX = "deadlockle.";

// Treat any prior Deadlockle storage key as "already onboarded" so
// shipping this modal doesn't pop in front of established players.
function shouldAutoOpen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem(SEEN_KEY) === "1") return false;
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(STATE_PREFIX) && k !== SEEN_KEY) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function markSeen() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // ignore quota errors
  }
}

export function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    // localStorage isn't available during SSR, so we have to defer the
    // first-visit check until after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (shouldAutoOpen()) setOpen(true);
  }, []);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    else if (!open && dlg.open) dlg.close();
  }, [open]);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  const close = () => {
    setOpen(false);
    markSeen();
  };

  const onBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) close();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint underline-offset-4 transition-colors hover:text-accent-soft hover:underline"
        style={{
          textShadow:
            "0 1px 0 rgba(0,0,0,0.7), 0 0 12px rgba(0,0,0,0.55)",
        }}
      >
        First time?
      </button>

      <dialog
        ref={dialogRef}
        onClose={close}
        onClick={onBackdropClick}
        aria-labelledby="welcome-title"
        className="m-auto w-[min(440px,92vw)] max-w-[92vw] border border-line bg-surface p-0 text-ink backdrop:bg-black/75 backdrop:backdrop-blur-sm"
      >
        <div className="relative">
          {/* Inset hairline frame — picks up the deco brass-panel detail
              used on the Begin button + guides cards. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-2 border border-hairline"
          />

          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-info">
              New here?
            </p>
            <button
              type="button"
              onClick={close}
              className="-mr-1 px-2 py-1 font-mono text-base leading-none text-ink-soft transition-colors hover:text-ink"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="px-7 pb-7 pt-6">
            <h2
              id="welcome-title"
              className="font-display text-2xl uppercase tracking-[0.04em] text-ink"
            >
              Welcome to <span className="text-accent">Deadlockle</span>
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              A daily Wordle-style quiz for Valve&apos;s Deadlock. Five
              modes, one hero. New puzzles arrive at 2:15am Pacific.
            </p>

            <div className="mt-6 border-t border-line pt-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent-soft">
                Mode 1 · Classic
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                Guess the daily hero. Each guess lights up seven attribute
                tiles:{" "}
                <span className="text-correct">green</span> matches,{" "}
                <span className="text-partial">amber</span> close,{" "}
                <span className="text-far">red</span> off. Use the
                comparisons to triangulate the answer.
              </p>
            </div>

            <div className="mt-7 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={close}
                className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint transition-colors hover:text-ink"
              >
                Skip
              </button>
              <Link
                href="/classic/"
                onClick={close}
                className="inline-flex items-center gap-3 bg-accent px-5 py-3 font-display text-xs font-bold uppercase tracking-[0.18em] text-on-accent transition-colors hover:bg-accent-soft"
              >
                Play Classic <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
