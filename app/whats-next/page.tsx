import type { Metadata } from "next";
import Link from "next/link";
import { RequestNextGame } from "@/components/RequestNextGame";
import { SITE_URL } from "@/lib/site";

// The roadmap vote used to sit on the homepage next to the tip jar, where
// "which game should I work on next?" read as the loudest "portfolio
// operator" signal. It now lives here on its own opt-in page, reachable only
// from a quiet "What's next?" link under the homepage's sister-site cards.
// Mirrors OWdle's /whats-next. (Deadlockle's FAQ lives on /how-to-play, so
// unlike OWdle this page carries the vote alone.)
const TITLE = "What's next?";
const DESCRIPTION =
  "Vote on which game gets the daily guessing-game treatment next. The top picks are what the maker looks at when deciding what to build after Deadlockle.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/whats-next/" },
  openGraph: {
    title: `${TITLE} · Deadlockle`,
    description: DESCRIPTION,
    url: "/whats-next/",
    type: "website",
    siteName: "Deadlockle",
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} · Deadlockle`,
    description: DESCRIPTION,
  },
};

const PAGE_URL = `${SITE_URL}/whats-next/`;

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "@id": `${PAGE_URL}#breadcrumbs`,
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Deadlockle", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "What's next?", item: PAGE_URL },
  ],
};

export default function WhatsNextPage() {
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
            Roadmap · Community vote
          </p>
          <h1 className="mt-4 font-display text-4xl leading-[0.95] text-ink sm:text-5xl">
            What&rsquo;s next?
          </h1>
          <p className="mt-5 text-base leading-relaxed text-ink-soft">
            Deadlockle is one of a handful of daily guessing games I build in my
            spare time. If there&rsquo;s a game you want to see get the same
            treatment, put it forward below. The top picks are what I actually
            look at when I decide what to make next.
          </p>

          <div className="mt-8 rounded-(--radius-card) border border-line bg-muted p-6 sm:p-8">
            <RequestNextGame />
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
