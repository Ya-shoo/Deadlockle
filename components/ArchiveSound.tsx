"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { dayString } from "@/lib/daily";
import { archiveWindow } from "@/lib/archive";
import { ArchiveGrid } from "./ArchiveGrid";
import { ArchiveModeSwitcher } from "./ArchiveModeSwitcher";
import { SoundGame } from "./SoundGame";

// Param-switched archive surface for Conversation (slug "sound"). Mirrors
// ArchiveClassic: ?d=<YYYY-MM-DD> renders that day's replay (the SoundGame
// engine in archive mode); anything else renders the week grid. Strict
// membership validation against the rolling window rejects malformed /
// out-of-range / future dates and today.
export function ArchiveSound() {
  const params = useSearchParams();
  const d = params.get("d");
  const today = dayString();
  const isReplayable = !!d && d !== today && archiveWindow(today).includes(d);

  if (isReplayable) {
    return <SoundGame archiveDay={d} />;
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:py-16">
      <header className="mb-8">
        <Link
          href="/archive/"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint transition-colors hover:text-accent"
        >
          <span aria-hidden>←</span> All archives
        </Link>
        <h1 className="mt-4 font-display display-headline text-4xl text-ink sm:text-5xl">
          Conversation archive
        </h1>
        <p className="mt-3 max-w-md text-ink-soft">
          Replay any of the past week&apos;s conversations. Missed a day, or
          lost one? Fill it in. It won&apos;t touch today&apos;s streak.
        </p>
      </header>

      <ArchiveGrid mode="sound" />
      <ArchiveModeSwitcher current="sound" />
    </main>
  );
}
