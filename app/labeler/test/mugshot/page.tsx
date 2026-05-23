"use client";

// Mugshot mode test panel. With the 5-guess cap (and a curve that
// never reaches full plateau in play) this panel is the fastest way
// to spot-check the new zoom levels at each guess count.

import { useState } from "react";
import { dayString, getMugshotForDay } from "@/lib/daily";
import {
  loadModeState,
  saveModeState,
  type ModeState,
} from "@/lib/storage";
import { wrongHeroKeys } from "@/lib/dev/seed";
import { ModeTestShell } from "@/components/dev/ModeTestShell";
import { MugshotGame } from "@/components/MugshotGame";

const MODE = "mugshot";
const CAP = 5;

export default function MugshotTestPage() {
  const [n, setN] = useState(3);

  const apply = (kind: "miss" | "win" | "fail") => {
    const day = dayString();
    const { hero: answer } = getMugshotForDay(day);
    let next: ModeState;
    if (kind === "miss") {
      next = { day, guesses: wrongHeroKeys(answer.key, n, "mugshot-miss"), won: false };
    } else if (kind === "win") {
      const wrong = wrongHeroKeys(answer.key, Math.max(0, n - 1), "mugshot-win");
      next = { day, guesses: [...wrong, answer.key], won: true };
    } else {
      next = {
        day,
        guesses: wrongHeroKeys(answer.key, CAP, "mugshot-fail"),
        won: false,
        ...({ failed: true } as Partial<ModeState>),
      };
    }
    saveModeState(MODE, next);
  };

  return (
    <ModeTestShell
      modeTitle="Mugshot"
      modeSlug="mugshot"
      cap={CAP}
      rules="Cropped portrait, zoom pulls back per guess. 5-guess cap with a curve that plateaus past guess 7 — player never sees the full image in regular play."
      readState={() => loadModeState(MODE, dayString())}
      resetState={() =>
        saveModeState(MODE, { day: dayString(), guesses: [], won: false })
      }
      game={<MugshotGame />}
    >
      {(refresh) => (
        <SimpleControls n={n} setN={setN} cap={CAP} apply={apply} refresh={refresh} />
      )}
    </ModeTestShell>
  );
}

function SimpleControls({
  n,
  setN,
  cap,
  apply,
  refresh,
}: {
  n: number;
  setN: (n: number) => void;
  cap: number;
  apply: (kind: "miss" | "win" | "fail") => void;
  refresh: () => void;
}) {
  const click = (kind: "miss" | "win" | "fail") => {
    apply(kind);
    refresh();
  };
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <label className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-info">
        Guesses
        <input
          type="number"
          min={0}
          max={cap}
          value={n}
          onChange={(e) =>
            setN(Math.max(0, Math.min(cap, Number(e.target.value) || 0)))
          }
          className="w-16 rounded-(--radius-card) border border-line bg-canvas px-2 py-1.5 text-ink"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Btn label={`Set ${n} wrong`} onClick={() => click("miss")} />
        <Btn label={`Force win at ${n}`} onClick={() => click("win")} tone="ok" />
        <Btn label="Force fail (cap-out)" onClick={() => click("fail")} tone="bad" />
      </div>
    </div>
  );
}

function Btn({
  label,
  onClick,
  tone,
}: {
  label: string;
  onClick: () => void;
  tone?: "ok" | "bad";
}) {
  const cls =
    tone === "ok"
      ? "border-correct/60 bg-correct/10 text-correct hover:bg-correct/20"
      : tone === "bad"
        ? "border-far/60 bg-far/10 text-far hover:bg-far/20"
        : "border-line text-ink-soft hover:border-edge hover:text-ink";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-(--radius-card) border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors ${cls}`}
    >
      {label}
    </button>
  );
}
