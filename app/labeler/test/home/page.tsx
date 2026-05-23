"use client";

// Home-page preview panel. Embeds the live `HomeContent` underneath a
// compact controls bar that lets the dev seed any wonCount/failCount
// shape across all five built modes — so the daily-complete hero,
// CompleteBadge wins/N, and sweep-vs-mixed copy can be eyeballed
// without playing through five puzzles.
//
// Why this is its own page: ModeTestShell is per-mode (one cap, one
// game component, one set of "Force win/fail" buttons). The home
// surface is a different shape — five modes at once, no cap input —
// so it gets its own thin shell here.
//
// State writes use the same seed helpers as the per-mode panels, so
// the per-mode `loadModeState` calls return saves that look exactly
// like the ones a real player would have at the end of the day.

import { useCallback, useEffect, useState } from "react";
import {
  dayString,
  getAbilityForDay,
  getHeroForDay,
  getItemForDay,
  getMugshotForDay,
  getSoundForDay,
} from "@/lib/daily";
import {
  loadConversationState,
  loadModeState,
  saveConversationState,
  saveModeState,
  type ConversationGuess,
  type ConversationState,
  type ModeState,
} from "@/lib/storage";
import { wrongHeroKeys, wrongItemKeys } from "@/lib/dev/seed";
import { BUILT_MODE_SLUGS } from "@/lib/modes";
import { HomeContent } from "@/components/HomeContent";

const MODE_CAPS = {
  classic: 10,
  ability: 12,
  mugshot: 5,
  item: 8,
  sound: 8,
} as const;

// Per-mode win/fail save factory. Wins use a moderate guess count
// (looks plausible in the per-mode pill list); fails use the full cap
// so the failed flag actually corresponds to a cap-out save the live
// game would produce.
function seedMode(
  slug: (typeof BUILT_MODE_SLUGS)[number],
  outcome: "won" | "failed" | "open",
  day: string,
) {
  if (outcome === "open") {
    if (slug === "sound") {
      saveConversationState(slug, { day, guesses: [], won: false });
    } else {
      saveModeState(slug, { day, guesses: [], won: false });
    }
    return;
  }
  if (slug === "classic") {
    const ans = getHeroForDay(day);
    if (outcome === "won") {
      const wrong = wrongHeroKeys(ans.key, 4, `home-${slug}-win`);
      saveModeState(slug, { day, guesses: [...wrong, ans.key], won: true });
    } else {
      const wrong = wrongHeroKeys(ans.key, MODE_CAPS.classic, `home-${slug}-fail`);
      saveModeState(slug, {
        day,
        guesses: wrong,
        won: false,
        ...({ failed: true } as Partial<ModeState>),
      });
    }
    return;
  }
  if (slug === "ability") {
    const { hero } = getAbilityForDay(day);
    if (outcome === "won") {
      const wrong = wrongHeroKeys(hero.key, 5, `home-${slug}-win`);
      saveModeState(slug, { day, guesses: [...wrong, hero.key], won: true });
    } else {
      const wrong = wrongHeroKeys(hero.key, MODE_CAPS.ability, `home-${slug}-fail`);
      saveModeState(slug, {
        day,
        guesses: wrong,
        won: false,
        ...({ failed: true } as Partial<ModeState>),
      });
    }
    return;
  }
  if (slug === "mugshot") {
    const { hero } = getMugshotForDay(day);
    if (outcome === "won") {
      const wrong = wrongHeroKeys(hero.key, 2, `home-${slug}-win`);
      saveModeState(slug, { day, guesses: [...wrong, hero.key], won: true });
    } else {
      const wrong = wrongHeroKeys(hero.key, MODE_CAPS.mugshot, `home-${slug}-fail`);
      saveModeState(slug, {
        day,
        guesses: wrong,
        won: false,
        ...({ failed: true } as Partial<ModeState>),
      });
    }
    return;
  }
  if (slug === "item") {
    const { item } = getItemForDay(day);
    if (outcome === "won") {
      const wrong = wrongItemKeys(item.key, 3, `home-${slug}-win`);
      saveModeState(slug, { day, guesses: [...wrong, item.key], won: true });
    } else {
      const wrong = wrongItemKeys(item.key, MODE_CAPS.item, `home-${slug}-fail`);
      saveModeState(slug, {
        day,
        guesses: wrong,
        won: false,
        ...({ failed: true } as Partial<ModeState>),
      });
    }
    return;
  }
  if (slug === "sound") {
    const { speakers } = getSoundForDay(day);
    const [a, b] = speakers;
    const pair: [string, string] = [a.key, b.key];
    if (outcome === "won") {
      const lead: ConversationGuess[] = wrongHeroKeys(a.key, 2, `home-${slug}-win`).map(
        (k) => ({ heroKey: k, target: 0 as const }),
      );
      const moreLead: ConversationGuess[] = wrongHeroKeys(b.key, 1, `home-${slug}-win-b`).map(
        (k) => ({ heroKey: k, target: 1 as const }),
      );
      saveConversationState(slug, {
        day,
        speakers: pair,
        guesses: [
          ...lead,
          ...moreLead,
          { heroKey: a.key, target: 0 },
          { heroKey: b.key, target: 1 },
        ],
        won: true,
      });
    } else {
      const wrongA: ConversationGuess[] = wrongHeroKeys(a.key, MODE_CAPS.sound, `home-${slug}-fail-a`).map(
        (k) => ({ heroKey: k, target: 0 as const }),
      );
      const wrongB: ConversationGuess[] = wrongHeroKeys(b.key, MODE_CAPS.sound, `home-${slug}-fail-b`).map(
        (k) => ({ heroKey: k, target: 1 as const }),
      );
      const interleaved: ConversationGuess[] = [];
      for (let i = 0; i < MODE_CAPS.sound; i++) {
        const src = i % 2 === 0 ? wrongA : wrongB;
        const item = src[Math.floor(i / 2)];
        if (item) interleaved.push(item);
      }
      saveConversationState(slug, {
        day,
        speakers: pair,
        guesses: interleaved,
        won: false,
        ...({ failed: true } as Partial<ConversationState>),
      });
    }
  }
}

type Preset = "sweep" | "mostly-won" | "mixed" | "mostly-failed" | "wipe";

const PRESETS: Record<Preset, { wins: number; label: string }> = {
  sweep: { wins: 5, label: "Sweep (5 / 5)" },
  "mostly-won": { wins: 4, label: "Mostly won (4 / 5)" },
  mixed: { wins: 3, label: "Mixed (3 / 5)" },
  "mostly-failed": { wins: 1, label: "Mostly failed (1 / 5)" },
  wipe: { wins: 0, label: "Wipe (0 / 5)" },
};

export default function HomeTestPage() {
  const [bump, setBump] = useState(0);
  const [snapshot, setSnapshot] = useState<{
    wonCount: number;
    failedCount: number;
    openCount: number;
  } | null>(null);

  const refresh = useCallback(() => {
    const day = dayString();
    let won = 0;
    let failed = 0;
    let open = 0;
    for (const slug of BUILT_MODE_SLUGS) {
      const raw =
        slug === "sound"
          ? loadConversationState(slug, day)
          : loadModeState(slug, day);
      if (raw.won) won++;
      else if (
        (raw as ModeState).failed === true ||
        (raw as ModeState).gaveUp === true
      )
        failed++;
      else open++;
    }
    setSnapshot({ wonCount: won, failedCount: failed, openCount: open });
    setBump((n) => n + 1);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const applyAll = (outcome: "won" | "failed" | "open") => {
    const day = dayString();
    for (const slug of BUILT_MODE_SLUGS) seedMode(slug, outcome, day);
    refresh();
  };

  const applyPreset = (preset: Preset) => {
    const day = dayString();
    const targetWins = PRESETS[preset].wins;
    BUILT_MODE_SLUGS.forEach((slug, idx) => {
      seedMode(slug, idx < targetWins ? "won" : "failed", day);
    });
    refresh();
  };

  return (
    <div className="flex flex-col">
      {/* Sticky dev toolbar — pinned below the global Header so the
          controls stay accessible while scrolling the home preview. */}
      <div className="sticky top-[62px] z-30 border-b border-accent/40 bg-canvas/95 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent">
              Dev · home
            </p>
            {snapshot && (
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                {snapshot.wonCount} won · {snapshot.failedCount} missed ·{" "}
                {snapshot.openCount} open
              </p>
            )}
            <p className="hidden font-mono text-[9px] leading-relaxed tracking-[0.14em] text-ink-soft sm:block sm:flex-1">
              Seeds all five modes at once so the daily-complete hero,
              CompleteBadge wins/N, mode-grid tags, and sweep vs mixed copy
              can be reviewed without playing through.
            </p>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {(Object.keys(PRESETS) as Preset[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => applyPreset(p)}
                className="rounded-(--radius-card) border border-line px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft transition-colors hover:border-edge hover:text-ink"
              >
                {PRESETS[p].label}
              </button>
            ))}
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => applyAll("open")}
              className="rounded-(--radius-card) border border-line px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft transition-colors hover:border-edge hover:text-ink"
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={refresh}
              className="rounded-(--radius-card) border border-line px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft transition-colors hover:border-edge hover:text-ink"
              title={`Re-read #${bump}`}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Embed HomeContent with a key bumped on every state write so the
          home page's own useEffect re-reads localStorage and the hero +
          mode grid pick up the new outcomes immediately. */}
      <div key={bump} className="contents">
        <HomeContent />
      </div>
    </div>
  );
}
