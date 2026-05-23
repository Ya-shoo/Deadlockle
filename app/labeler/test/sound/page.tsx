"use client";

// Conversation mode test panel. Uses ConversationState — guesses are
// {heroKey, target: 0|1}. "Win" needs both speakers correctly tagged.
// Wrong guesses get distributed roughly evenly across the two speaker
// targets so the targeting UI is exercised.

import { useState } from "react";
import { dayString, getSoundByIndex, getSoundForDay, SOUND_POOL_SIZE } from "@/lib/daily";
import {
  loadConversationState,
  saveConversationState,
  type ConversationGuess,
  type ConversationState,
} from "@/lib/storage";
import { wrongHeroKeys } from "@/lib/dev/seed";
import { ModeTestShell } from "@/components/dev/ModeTestShell";
import { SoundGame } from "@/components/SoundGame";

const MODE = "sound";
const CAP = 8;

export default function SoundTestPage() {
  const [n, setN] = useState(5);
  const [convIdx, setConvIdx] = useState<number | "">("");

  const resolveAnswer = (day: string) => {
    if (convIdx === "" || Number.isNaN(Number(convIdx))) {
      return getSoundForDay(day);
    }
    return getSoundByIndex(Math.max(0, Math.min(SOUND_POOL_SIZE - 1, Number(convIdx))));
  };

  const apply = (kind: "miss" | "win" | "fail") => {
    const day = dayString();
    const { speakers } = resolveAnswer(day);
    const a = speakers[0];
    const b = speakers[1];
    const pair: [string, string] = [a.key, b.key];

    const wrongTargetedA: ConversationGuess[] = wrongHeroKeys(a.key, n, "sound-A").map((k) => ({
      heroKey: k,
      target: 0 as const,
    }));
    const wrongTargetedB: ConversationGuess[] = wrongHeroKeys(b.key, n, "sound-B").map((k) => ({
      heroKey: k,
      target: 1 as const,
    }));
    const interleaved: ConversationGuess[] = [];
    for (let i = 0; i < n; i++) {
      const src = i % 2 === 0 ? wrongTargetedA : wrongTargetedB;
      const item = src[Math.floor(i / 2)];
      if (item) interleaved.push(item);
    }

    let next: ConversationState;
    if (kind === "miss") {
      next = { day, speakers: pair, guesses: interleaved, won: false };
    } else if (kind === "win") {
      const lead = interleaved.slice(0, Math.max(0, n - 2));
      next = {
        day,
        speakers: pair,
        guesses: [
          ...lead,
          { heroKey: a.key, target: 0 },
          { heroKey: b.key, target: 1 },
        ],
        won: true,
      };
    } else {
      const cap: ConversationGuess[] = [];
      for (let i = 0; i < CAP; i++) {
        const src = i % 2 === 0 ? wrongTargetedA : wrongTargetedB;
        const item = src[Math.floor(i / 2)];
        if (item) cap.push(item);
      }
      next = {
        day,
        speakers: pair,
        guesses: cap,
        won: false,
        ...({ failed: true } as Partial<ConversationState>),
      };
    }
    saveConversationState(MODE, next);
  };

  return (
    <ModeTestShell
      modeTitle="Conversation"
      modeSlug="sound"
      cap={CAP}
      rules="Two speakers, audio unlocks at guess 5 and 7. 8-guess cap. Wrong guesses are split between target A and target B."
      readState={() => loadConversationState(MODE, dayString())}
      resetState={() =>
        saveConversationState(MODE, {
          day: dayString(),
          guesses: [],
          won: false,
        })
      }
      game={<SoundGame />}
    >
      {(refresh) => (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-info">
              Guesses
              <input
                type="number"
                min={0}
                max={CAP}
                value={n}
                onChange={(e) =>
                  setN(Math.max(0, Math.min(CAP, Number(e.target.value) || 0)))
                }
                className="w-16 rounded-(--radius-card) border border-line bg-canvas px-2 py-1.5 text-ink"
              />
            </label>
            <label className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-info">
              Conv #
              <input
                type="number"
                min={0}
                max={SOUND_POOL_SIZE - 1}
                placeholder="today"
                value={convIdx}
                onChange={(e) =>
                  setConvIdx(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="w-20 rounded-(--radius-card) border border-line bg-canvas px-2 py-1.5 text-ink"
              />
              <span className="text-ink-faint">/ {SOUND_POOL_SIZE - 1}</span>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn
              label={`Set ${n} wrong`}
              onClick={() => {
                apply("miss");
                refresh();
              }}
            />
            <Btn
              label={`Force win (~${n} guesses)`}
              tone="ok"
              onClick={() => {
                apply("win");
                refresh();
              }}
            />
            <Btn
              label="Force fail (cap-out)"
              tone="bad"
              onClick={() => {
                apply("fail");
                refresh();
              }}
            />
          </div>
          <p className="font-mono text-[10px] tracking-[0.14em] text-ink-faint">
            Conv # leaves the daily seed in place — only affects which speaker
            pair this panel writes. The live mode reads <code>?conv=N</code>
            from its own URL.
          </p>
        </div>
      )}
    </ModeTestShell>
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
