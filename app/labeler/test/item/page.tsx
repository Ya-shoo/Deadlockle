"use client";

// Item mode test panel. Item already has a `gaveUp` flag wired up to
// the "Show answer" button — the lives PR converts that to a real
// auto-fail at the cap. This panel writes the future `failed` flag
// for forward-compatibility.

import { useState } from "react";
import { dayString, getItemForDay } from "@/lib/daily";
import {
  loadModeState,
  saveModeState,
  type ModeState,
} from "@/lib/storage";
import { wrongItemKeys } from "@/lib/dev/seed";
import { ModeTestShell } from "@/components/dev/ModeTestShell";
import { ItemGame } from "@/components/ItemGame";

const MODE = "item";
const CAP = 8;

export default function ItemTestPage() {
  const [n, setN] = useState(4);

  const apply = (kind: "miss" | "win" | "fail") => {
    const day = dayString();
    const { item: answer } = getItemForDay(day);
    let next: ModeState;
    if (kind === "miss") {
      next = { day, guesses: wrongItemKeys(answer.key, n, "item-miss"), won: false };
    } else if (kind === "win") {
      const wrong = wrongItemKeys(answer.key, Math.max(0, n - 1), "item-win");
      next = { day, guesses: [...wrong, answer.key], won: true };
    } else {
      next = {
        day,
        guesses: wrongItemKeys(answer.key, CAP, "item-fail"),
        won: false,
        ...({ failed: true } as Partial<ModeState>),
      };
    }
    saveModeState(MODE, next);
  };

  return (
    <ModeTestShell
      modeTitle="Item"
      modeSlug="item"
      cap={CAP}
      rules="Blurred item icon, sharpens per guess. 8-guess cap, blur=0 reached at guess 7. Hard-mode rotation (90 / 180 / 270°) is session-only."
      readState={() => loadModeState(MODE, dayString())}
      resetState={() =>
        saveModeState(MODE, { day: dayString(), guesses: [], won: false })
      }
      game={<ItemGame />}
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
