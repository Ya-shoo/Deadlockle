import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/Brand";

const TITLE = "How to Play: Daily Deadlock Hero Quiz Guide";
const DESCRIPTION =
  "Complete guide to Deadlockle, the daily Wordle-style quiz for Valve's Deadlock. Rules, strategy, and FAQ for every mode: Classic, Ability, Item, Mugshot, and Conversation.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/how-to-play/" },
  openGraph: {
    title: `${TITLE}`,
    description: DESCRIPTION,
    url: "/how-to-play/",
    type: "article",
    siteName: "Deadlockle",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "What is Deadlockle?",
    a: "Deadlockle is a free daily Wordle-style game for Valve's Deadlock. The same daily-puzzle idea as LOLdle for League of Legends, but built around Deadlock heroes, abilities, items, and conversations. Five modes unlock every day at 2:15am Pacific Time.",
  },
  {
    q: "When does the daily puzzle reset?",
    a: "Every day at 2:15am Pacific Time. The home page shows a countdown to the next reset. Once you finish all five modes, the home page switches to a Daily Complete state showing your total guesses.",
  },
  {
    q: "How is Deadlockle different from other daily Deadlock guessing games?",
    a: "Deadlockle is its own game at deadlockle.com — separate from Deadlockdle, Lockle, DLDE, and other Deadlock -dle variants. Deadlockle's Classic mode uses a seven attribute comparison grid (role, gun, damage, nature, gender, HP, move speed) and pairs it with four image and dialogue modes that progressively reveal more of the answer with each wrong guess. The visual style leans into Deadlock's deco-noir aesthetic.",
  },
];

const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

export default function HowToPlayPage() {
  return (
    <main className="flex-1">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqStructuredData).replace(/</g, "\\u003c"),
        }}
      />

      <article className="mx-auto max-w-3xl px-6 pt-16 pb-24 sm:pt-20">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-info">
          Guide · 5 modes
        </p>
        <h1 className="mt-4 font-display text-4xl leading-[1.05] text-ink sm:text-5xl">
          How to play <Brand as="span" size="md" className="!text-4xl sm:!text-5xl !tracking-[0.04em]" />
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-ink-soft">
          <strong className="text-ink">Deadlockle</strong> is a free daily
          Wordle-style game for Valve's Deadlock. Each day at 2:15am Pacific Time,
          five new Deadlockle puzzles unlock, one for each mode. There's no
          signup and no gating. Your progress is saved in your
          browser, so you can solve a few, close the tab, and come back later
          in the day to finish.
        </p>

        <hr className="my-12 border-line" />

        <Section
          eyebrow="Mode 1"
          title="Classic: guess the Deadlock hero by attributes"
          href="/classic/"
        >
          <p>
            Type any Deadlock hero into the search box. The grid lights up
            with seven attribute tiles per guess: <em>role, gun, damage, nature, gender, HP, move speed</em>. Green means a match, amber means close (numerical within range), red means off. Use the comparisons to triangulate the daily hero.
          </p>
          <p className="mt-3">
            <strong className="text-ink">Strategy:</strong> open with a hero
            who covers mid-range stats. Paradox, Vyper, or Pocket give wide
            tile coverage on the first guess. Don't lock onto a single{" "}
            <em>hero type</em> until you've also narrowed <em>nature</em> and{" "}
            <em>damage style</em>; those three together usually pin the answer
            within four guesses.
          </p>
        </Section>

        <Section
          eyebrow="Mode 2"
          title="Ability: whose Deadlock ability is this?"
          href="/ability/"
        >
          <p>
            A heavily blurred ability icon appears. Each wrong guess reveals
            more of the icon. All four signature abilities are in the pool
            for every hero, so a fire-themed icon could be Infernus's Napalm
            or one of Seven's offensive abilities. Narrow on{" "}
            <em>shape and composition</em>, not just color.
          </p>
        </Section>

        <Section
          eyebrow="Mode 3"
          title="Item: guess the Deadlock shop item icon"
          href="/item/"
        >
          <p>
            A blurred shop item icon appears. Each wrong guess sharpens it.
            The pool covers the full Deadlock item shop. <strong className="text-ink">Hard
            mode</strong> rotates the icon by a deterministic 90°, 180°, or
            270° based on the daily seed, useful when normal mode feels too
            silhouette-readable.
          </p>
        </Section>

        <Section
          eyebrow="Mode 4"
          title="Mugshot: identify a Deadlock hero from a portrait crop"
          href="/mugshot/"
        >
          <p>
            A tight crop of a hero's portrait appears: eyes, an earring, a
            collar fragment. Each wrong guess pulls the camera back, revealing
            more of the face. Most players solve it in 2–4 guesses if they
            recognize Deadlock's distinctive 1930s-NYC character design.
          </p>
        </Section>

        <Section
          eyebrow="Mode 5"
          title="Conversation: hear the Deadlock heroes talk"
          href="/sound/"
        >
          <p>
            A pre-match exchange between two heroes, with each speaker guessed
            in their own combobox. Dialogue reveals one line per guess, and
            after a few misses the actual voice clip unlocks. You hear the
            heroes talking, which is usually enough to clinch the answer.
            Once you solve it, every line's voice clip becomes playable so
            you can hear the full conversation back.
          </p>
        </Section>

        <hr className="my-12 border-line" />

        <h2 className="font-display text-3xl text-ink">
          Frequently asked questions
        </h2>
        {/* Collapsed by default (no `open`), matching the home-page FAQ.
            Native <details> keeps every answer in the DOM for crawlers even
            while visually collapsed, so the FAQPage JSON-LD above stays true. */}
        <ul className="mt-8 flex flex-col gap-px border border-line bg-line">
          {FAQ.map((item) => (
            <li key={item.q}>
              <details className="group bg-canvas">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted [&::-webkit-details-marker]:hidden">
                  <h3 className="font-display text-lg font-semibold text-ink">
                    {item.q}
                  </h3>
                  {/* plus → x on open */}
                  <svg
                    aria-hidden
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    className="shrink-0 text-ink-faint transition-transform duration-200 group-open:rotate-45"
                  >
                    <path
                      d="M7 1 V13 M1 7 H13"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="square"
                    />
                  </svg>
                </summary>
                <div className="px-5 pb-5 pt-0">
                  <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">
                    {item.a}
                  </p>
                </div>
              </details>
            </li>
          ))}
        </ul>

        <hr className="my-12 border-line" />

        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-base text-ink-soft">
            Ready? Start with the flagship mode.
          </p>
          <Link
            href="/classic/"
            className="inline-flex items-center gap-3 border border-edge bg-muted px-6 py-3 font-display text-sm font-bold uppercase tracking-[0.16em] text-ink transition-colors hover:bg-inset"
          >
            Play Classic
            <span aria-hidden>→</span>
          </Link>
        </div>
      </article>
    </main>
  );
}

function Section({
  eyebrow,
  title,
  href,
  children,
}: {
  eyebrow: string;
  title: string;
  href: string | null;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 first:mt-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
        {eyebrow}
      </p>
      <h2 className="mt-2 font-display text-2xl leading-tight text-ink sm:text-3xl">
        {title}
      </h2>
      <div className="mt-4 space-y-3 text-base leading-relaxed text-ink-soft">
        {children}
      </div>
      {href ? (
        <Link
          href={href}
          className="mt-5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-accent underline-offset-2 hover:underline"
        >
          Play this mode <span aria-hidden>→</span>
        </Link>
      ) : null}
    </section>
  );
}
