"use client";

// Ability mode test panel. Same shape as Classic — set N wrong, force
// a win, or force a cap-out fail. Ability also has a bonus round
// after winning; that field is preserved as-is here.

import { useState } from "react";
import { dayString, getAbilityForDay } from "@/lib/daily";
import {
  loadModeState,
  saveModeState,
  type ModeState,
} from "@/lib/storage";
import { wrongHeroKeys } from "@/lib/dev/seed";
import { ModeTestShell } from "@/components/dev/ModeTestShell";
import { AbilityGame } from "@/components/AbilityGame";

const MODE = "ability";
const CAP = 12;

export default function AbilityTestPage() {
  const [n, setN] = useState(6);

  const apply = (kind: "miss" | "win" | "fail") => {
    const day = dayString();
    const { hero: answer } = getAbilityForDay(day);
    let next: ModeState;
    if (kind === "miss") {
      next = { day, guesses: wrongHeroKeys(answer.key, n, "ability-miss"), won: false };
    } else if (kind === "win") {
      const wrong = wrongHeroKeys(answer.key, Math.max(0, n - 1), "ability-win");
      next = { day, guesses: [...wrong, answer.key], won: true };
    } else {
      next = {
        day,
        guesses: wrongHeroKeys(answer.key, CAP, "ability-fail"),
        won: false,
        ...({ failed: true } as Partial<ModeState>),
      };
    }
    saveModeState(MODE, next);
  };

  return (
    <ModeTestShell
      modeTitle="Ability"
      modeSlug="ability"
      cap={CAP}
      rules="16-tile ability icon reveal. 12-guess cap. Tile count is 1 + guesses placed."
      readState={() => loadModeState(MODE, dayString())}
      resetState={() =>
        saveModeState(MODE, { day: dayString(), guesses: [], won: false })
      }
      game={<AbilityGame />}
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
