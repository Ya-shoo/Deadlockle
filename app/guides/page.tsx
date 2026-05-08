import type { Metadata } from "next";
import Link from "next/link";
import { GuidesGrid } from "@/components/GuidesGrid";
import { GUIDES } from "@/lib/guides";
import { Brand } from "@/components/Brand";

const TITLE = "Guides — Deadlockle Strategy & Tips";
const DESCRIPTION =
  "Strategy guides for every Deadlockle mode — Classic attribute deduction, Ability icon reads, Mugshot recognition, Conversation audio, and Item shop tips. Each card has the full walkthrough and a direct link to play.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/guides/" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/guides/",
    type: "article",
    siteName: "Deadlockle",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const articleStructuredData = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: TITLE,
  description: DESCRIPTION,
  url: "https://deadlockle.com/guides/",
  inLanguage: "en",
  author: { "@type": "Organization", name: "Deadlockle" },
  publisher: { "@type": "Organization", name: "Deadlockle" },
  about: GUIDES.map((g) => ({
    "@type": "Thing",
    name: `${g.label} mode`,
    description: g.pitch,
    url: `https://deadlockle.com/${g.slug}/`,
  })),
};

const itemListStructuredData = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Deadlockle modes",
  itemListElement: GUIDES.map((g, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: `${g.label} — ${g.pitch}`,
    url: `https://deadlockle.com/${g.slug}/`,
  })),
};

export default function GuidesPage() {
  return (
    <main className="flex-1">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleStructuredData),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(itemListStructuredData),
        }}
      />

      <section className="mx-auto max-w-6xl px-6 pt-16 pb-10 sm:pt-20">
        <h1 className="font-display text-4xl leading-[1.05] text-ink sm:text-5xl">
          <Brand
            as="span"
            size="md"
            className="!text-4xl sm:!text-5xl !tracking-[0.04em]"
          />{" "}
          guides
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
          Strategy walkthroughs for every Deadlockle mode — Classic attribute
          deduction, Ability icon reads, Mugshot recognition, Conversation
          audio, and Item shop tips. Each card outlines the strategy at a
          glance; click into a mode for the full guide with tips, mechanics,
          and worked-through approaches.
        </p>
        <div className="mt-7">
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent underline-offset-4 hover:underline"
          >
            ← Back to today&apos;s puzzle
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-6 border-b border-line pb-3">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-info">
            Modes
          </h2>
        </div>
        <GuidesGrid />
      </section>
    </main>
  );
}
