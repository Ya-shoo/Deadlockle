import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/site";

// The keyword-rich "What is Deadlockle?" intro used to sit on the homepage
// below the modes grid; it moved here to its own page so the homepage runs
// straight from the play loop into the support / network strip.
const TITLE = "About";
const DESCRIPTION =
  "About Deadlockle, the daily Wordle-style hero quiz for Valve's Deadlock: how the modes work, when puzzles refresh, and where the data comes from.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/about/" },
  openGraph: {
    title: `${TITLE} · Deadlockle`,
    description: DESCRIPTION,
    url: "/about/",
    type: "website",
    siteName: "Deadlockle",
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} · Deadlockle`,
    description: DESCRIPTION,
  },
};

const PAGE_URL = `${SITE_URL}/about/`;

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "@id": `${PAGE_URL}#breadcrumbs`,
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Deadlockle", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "About", item: PAGE_URL },
  ],
};

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <main className="flex-1">
        <section className="mx-auto max-w-2xl px-6 pb-16 pt-12 sm:pt-16">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-info">
            About
          </p>
          <h1 className="mt-4 font-display text-3xl leading-tight text-ink sm:text-4xl">
            What is Deadlockle?
          </h1>
          <p className="mt-5 text-base leading-relaxed text-ink-soft">
            <strong className="text-ink">Deadlockle</strong> is the daily
            Wordle-style quiz for Valve&rsquo;s{" "}
            <a
              href="https://store.steampowered.com/app/1422450/Deadlock/"
              className="text-accent underline-offset-2 hover:underline"
            >
              Deadlock
            </a>
            . Five modes, one hero per day — Deadlockle&rsquo;s Classic mode is
            the seven attribute deduction grid, and Ability, Item, Mugshot, and
            Conversation each reveal the answer in their own way as you guess.
            New puzzles arrive at 2:15am Pacific, and your board waits where you
            left it. Solve a few, come back later, take your time.
          </p>
          <div className="mt-7">
            <Link
              href="/guides/"
              className="inline-flex items-center gap-3 border border-edge bg-muted px-6 py-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent-soft transition-colors hover:bg-inset hover:text-ink"
            >
              Guides
              <span aria-hidden>→</span>
            </Link>
          </div>

          <div className="mt-10">
            <Link
              href="/"
              className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint transition-colors hover:text-info"
            >
              <svg
                aria-hidden
                width="14"
                height="10"
                viewBox="0 0 14 10"
                className="rotate-180"
              >
                <path
                  d="M0 5 L12 5 M8 1 L13 5 L8 9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="square"
                />
              </svg>
              Back to today&rsquo;s puzzles
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
