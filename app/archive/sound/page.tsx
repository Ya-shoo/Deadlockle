import { Suspense } from "react";
import type { Metadata } from "next";
import { ArchiveSound } from "@/components/ArchiveSound";

// Private, client-only retention surface — noindex/nofollow (also disallowed
// in robots + absent from the sitemap).
export const metadata: Metadata = {
  title: "Conversation Archive",
  description: "Replay the past week of daily Conversation puzzles.",
  robots: { index: false, follow: false },
};

export default function SoundArchivePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:py-16">
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-ink-faint">
            Loading…
          </div>
        </main>
      }
    >
      <ArchiveSound />
    </Suspense>
  );
}
