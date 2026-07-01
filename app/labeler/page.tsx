// The DailyDles dev hub is now unified and hosted by OWdle
// (http://localhost:3000/labeler/). This page just points there so /labeler/
// on the Deadlockle app doesn't dead-end. The Deadlockle tool PAGES
// (/labeler/test/*, /labeler/polls/, /labeler/avatar-preview/, …) still live
// here and are linked from the unified hub with a "DL ↗" badge.

import type { Metadata } from "next";
import { notFound } from "next/navigation";

const IS_DEV = process.env.NODE_ENV !== "production";
const HUB = "http://localhost:3000/labeler/";

export const metadata: Metadata = IS_DEV
  ? { title: "Dev hub → OWdle", robots: { index: false, follow: false } }
  : {};

export default function DevHubPointer() {
  if (!IS_DEV) notFound();
  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-ink">
      <div className="max-w-md text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-info">
          DailyDles Dev
        </p>
        <h1 className="mt-2 font-display text-3xl text-ink sm:text-4xl">
          Unified dev hub
        </h1>
        <p className="mt-3 font-mono text-[10px] uppercase leading-relaxed tracking-[0.16em] text-ink-soft">
          The dev hub now lives in one place (hosted by OWdle) and links to both
          sites&apos; tools — including Deadlockle&apos;s, which still run here on
          :3001.
        </p>
        <a
          href={HUB}
          className="mt-6 inline-block rounded-full bg-ink px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-canvas transition-transform hover:scale-[1.03]"
        >
          → Open the dev hub (:3000)
        </a>
        <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">
          make sure OWdle&apos;s stack is running
        </p>
      </div>
    </main>
  );
}
