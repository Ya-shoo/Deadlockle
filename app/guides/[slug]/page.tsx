import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GUIDES, type GuideEntry } from "@/lib/guides";

// Statically generate one page per guide at build time. With output:"export"
// these are emitted as fully prerendered HTML — no runtime fallback.
export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

// Reject any slug that isn't in GUIDES — prevents accidental empty pages
// if a stale link points at a removed mode.
export const dynamicParams = false;

type Props = { params: Promise<{ slug: string }> };

function getGuide(slug: string): GuideEntry | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

const SITE = "https://deadlockle.com";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};

  const title = `${guide.label} Mode Guide · Deadlockle Strategy & Tips`;
  const description = guide.pitch;

  return {
    title,
    description,
    alternates: { canonical: `/guides/${guide.slug}/` },
    openGraph: {
      title,
      description,
      url: `/guides/${guide.slug}/`,
      type: "article",
      siteName: "Deadlockle",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function GuideDetailPage({ params }: Props) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const otherGuides = GUIDES.filter((g) => g.slug !== guide.slug);

  // Breadcrumb schema — surfaces the Home → Guides → {Mode} hierarchy in
  // SERPs, lifting CTR on rich results.
  const breadcrumbStructuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Deadlockle",
        item: `${SITE}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Guides",
        item: `${SITE}/guides/`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: `${guide.label} guide`,
        item: `${SITE}/guides/${guide.slug}/`,
      },
    ],
  };

  // HowTo schema — Google occasionally surfaces step-by-step strategy
  // results, and even when it doesn't the structured data still gives
  // crawlers a clean parse of the strategy section.
  const howToStructuredData = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `How to win Deadlockle ${guide.label}`,
    description: guide.pitch,
    step: guide.strategy.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.title,
      text: s.body,
    })),
  };

  return (
    <main className="flex-1">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbStructuredData),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(howToStructuredData),
        }}
      />

      <article className="mx-auto max-w-3xl px-6 pt-16 pb-24 sm:pt-20">
        <nav
          aria-label="Breadcrumb"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint"
        >
          <Link
            href="/"
            className="underline-offset-4 transition-colors hover:text-accent-soft hover:underline"
          >
            Home
          </Link>
          <span aria-hidden> · </span>
          <Link
            href="/guides/"
            className="underline-offset-4 transition-colors hover:text-accent-soft hover:underline"
          >
            Guides
          </Link>
          <span aria-hidden> · </span>
          <span className="text-ink-soft">{guide.label}</span>
        </nav>

        <p className="mt-8 font-mono text-xs uppercase tracking-[0.2em] text-info">
          Mode {guide.index} guide · {guide.difficulty}
        </p>
        <h1 className="mt-3 font-display text-4xl leading-[1.05] text-ink sm:text-5xl">
          Deadlockle {guide.label} guide
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-ink-soft">
          {guide.pitch}
        </p>

        <hr className="my-12 border-line" />

        <section>
          <h2 className="font-display text-2xl text-ink sm:text-3xl">
            How {guide.label} mode works
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-soft">
            {guide.intro}
          </p>
        </section>

        <hr className="my-12 border-line" />

        <section>
          <h2 className="font-display text-2xl text-ink sm:text-3xl">
            Strategy
          </h2>
          <ol className="mt-7 space-y-7">
            {guide.strategy.map((step, i) => (
              <li key={step.title} className="flex gap-5">
                <span className="pt-[5px] font-mono text-[11px] tracking-[0.1em] text-accent-soft tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex-1">
                  <h3 className="font-display text-xl text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-base leading-relaxed text-ink-soft">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <hr className="my-12 border-line" />

        <section>
          <h2 className="font-display text-2xl text-ink sm:text-3xl">Tips</h2>
          <ul className="mt-6 space-y-3">
            {guide.tips.map((tip) => (
              <li
                key={tip}
                className="flex gap-4 text-base leading-relaxed text-ink-soft"
              >
                <span aria-hidden className="mt-1 font-mono text-accent-soft">
                  ·
                </span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>

        <hr className="my-12 border-line" />

        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/guides/"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent underline-offset-4 hover:underline"
          >
            ← All guides
          </Link>
          <Link
            href={`/${guide.slug}/`}
            className="inline-flex items-center gap-3 border border-edge bg-muted px-6 py-3 font-display text-sm font-bold uppercase tracking-[0.16em] text-ink transition-colors hover:bg-inset"
          >
            Play {guide.label} <span aria-hidden>→</span>
          </Link>
        </div>

        <section className="mt-16 border-t border-line pt-10">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-info">
            Other guides
          </h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {otherGuides.map((g) => (
              <li key={g.slug}>
                <Link
                  href={`/guides/${g.slug}/`}
                  className="group flex items-baseline justify-between gap-4 border-b border-line/60 py-3 transition-colors hover:border-accent-soft/60"
                >
                  <span className="font-display text-base text-ink transition-colors group-hover:text-accent-soft">
                    {g.label}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                    {g.difficulty}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </main>
  );
}
