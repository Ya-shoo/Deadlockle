// Visual frame for a per-mode test page in the dev hub. Renders a
// compact controls bar at the top and the actual game underneath, so
// pressing "Force fail" immediately shows the new LossReveal land in
// the real game UI — no second navigation, no "what page am I on"
// confusion.
//
// Why a shell rather than a fully generic component: each mode has
// different state-mutation primitives (Sound has speaker targets,
// Classic has hints, etc.). The shared parts are the framing strip,
// the JSON readout, and the embed-the-game pattern.

"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

type Props = {
  modeTitle: string;
  modeSlug: string;
  cap: number;
  rules: string;
  /** Function that reads the current state from localStorage. Called
   *  on mount and after each control click via `refresh()`. */
  readState: () => unknown;
  /** Function that resets this mode's state to empty. */
  resetState: () => void;
  /** Per-mode control row — the buttons that mutate state. Receives a
   *  `refresh` callback that the controls must call after any state
   *  write so the embedded game remounts to reflect the new state. */
  children: (refresh: () => void) => ReactNode;
  /** The actual mode component (ClassicGame, ItemGame, etc.). Rendered
   *  below the controls with a `key` that bumps on every refresh, so
   *  state changes from the controls immediately re-mount it and the
   *  player sees the new LossReveal / win card / etc. land. */
  game: ReactNode;
};

export function ModeTestShell({
  modeSlug,
  cap,
  rules,
  readState,
  resetState,
  children,
  game,
}: Props) {
  const [state, setState] = useState<unknown>(null);
  const [bumped, setBumped] = useState(0);
  const [showJson, setShowJson] = useState(false);

  const refresh = useCallback(() => {
    setState(readState());
    setBumped((n) => n + 1);
  }, [readState]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleClear = () => {
    resetState();
    refresh();
  };

  return (
    <div className="flex flex-col">
      {/* Sticky dev toolbar — pinned below the global Header so the
          controls stay accessible while the player scrolls through
          the game's guess history. */}
      <div className="sticky top-[62px] z-30 border-b border-accent/40 bg-canvas/95 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent">
              Dev · {modeSlug}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
              cap {cap}
            </p>
            <p className="hidden font-mono text-[9px] leading-relaxed tracking-[0.14em] text-ink-soft sm:block sm:flex-1">
              {rules}
            </p>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {children(refresh)}
            <span className="flex-1" />
            <button
              type="button"
              onClick={handleClear}
              className="rounded-(--radius-card) border border-line px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft transition-colors hover:border-edge hover:text-ink"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setShowJson((s) => !s)}
              className="rounded-(--radius-card) border border-line px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft transition-colors hover:border-edge hover:text-ink"
              aria-expanded={showJson}
              title={`Re-read #${bumped}`}
            >
              {showJson ? "Hide" : "Show"} state
            </button>
          </div>

          {showJson && (
            <pre className="mt-3 max-h-48 overflow-auto rounded-(--radius-card) border border-line bg-inset/60 p-3 font-mono text-[10px] leading-relaxed text-ink-soft">
              {state == null ? "—" : JSON.stringify(state, null, 2)}
            </pre>
          )}
        </div>
      </div>

      {/* Embed the actual game so the dev sees the new lives UI in
          situ. `bumped` is bumped by every state write through
          `refresh`, which forces React to drop the previous mount —
          the game re-reads localStorage on the next mount and the
          new state lands immediately. */}
      <div key={bumped} className="contents">
        {game}
      </div>
    </div>
  );
}

