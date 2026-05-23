// Hub-index landing for Deadlockle's local dev hub. Every internal
// tool shows up here so a developer never has to remember a URL — one
// bookmark (`/labeler/`) covers it all. Tool inventory lives in
// `lib/dev/tools.ts`; both this page and the persistent top nav read
// from it.
//
// Adding a new tool? Append it to the relevant group in
// `lib/dev/tools.ts` and put the page under
// `app/labeler/<tool>/page.tsx`. The layout's prod gate already covers
// the route — no extra wiring needed.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TOOL_GROUPS } from "@/lib/dev/tools";

const IS_DEV = process.env.NODE_ENV !== "production";

export const metadata: Metadata = IS_DEV
  ? {
      title: "Dev hub — Deadlockle",
      robots: { index: false, follow: false },
    }
  : {};

export default function DevHub() {
  if (!IS_DEV) notFound();
  return (
    <main className="text-ink">
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <header className="mb-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-info">
            Deadlockle Dev
          </p>
          <h1 className="mt-1 font-display text-4xl text-ink sm:text-5xl">
            Local dev hub
          </h1>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
            every dev tool + every live mode · localhost only
          </p>
        </header>

        <div className="flex flex-col gap-10">
          {TOOL_GROUPS.map((group) => (
            <section key={group.title}>
              <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-line pb-2">
                <h2 className="font-display text-2xl text-ink">{group.title}</h2>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                  {group.tools.length} tool{group.tools.length === 1 ? "" : "s"}
                </p>
              </div>
              <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
                {group.blurb}
              </p>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.tools.map((tool) => (
                  <li key={tool.href}>
                    <Link
                      href={tool.href}
                      className="block h-full rounded-(--radius-card) border border-line bg-inset/40 p-4 transition-colors hover:border-accent hover:bg-inset/70"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
                          {tool.label}
                        </p>
                        <span
                          aria-hidden
                          className="font-mono text-[10px] text-ink-faint"
                        >
                          →
                        </span>
                      </div>
                      <p className="mt-2 font-mono text-[10px] leading-relaxed tracking-[0.12em] text-ink-soft">
                        {tool.description}
                      </p>
                      <div className="mt-3 flex items-baseline justify-between gap-2">
                        <p className="truncate font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint/70">
                          {tool.href}
                        </p>
                        {tool.helper && (
                          <p className="shrink-0 font-mono text-[9px] uppercase tracking-[0.16em] text-info/70">
                            helper: {tool.helper}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <footer className="mt-12 border-t border-line pt-4 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-faint">
          run <code className="text-ink-soft">npm run dev</code> if the server
          isn&apos;t already up. ports default to 3000.
        </footer>
      </div>
    </main>
  );
}
