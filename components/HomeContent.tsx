"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { dayString, prettyDay } from "@/lib/daily";
import { loadModeState } from "@/lib/storage";
import {
  BUILT_MODE_SLUGS,
  MODES,
  type ModeDef,
  type ModeSlug,
} from "@/lib/modes";
import { Brand } from "./Brand";
import { HomeBanner } from "./HomeBanner";
import { NextResetCountdown } from "./NextResetCountdown";
import { RequestNextGame } from "./RequestNextGame";
import { SupportLinks } from "./SupportLinks";
import { TryOWdleCard } from "./TryOWdleCard";

type Status = { won: boolean; guesses: number };
type StatusMap = Partial<Record<ModeSlug, Status>>;

export function HomeContent() {
  const [day, setDay] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<StatusMap>({});

  useEffect(() => {
    const d = dayString();
    setDay(d);
    const map: StatusMap = {};
    for (const slug of BUILT_MODE_SLUGS) {
      const st = loadModeState(slug, d);
      map[slug] = { won: st.won, guesses: st.guesses.length };
    }
    setStatuses(map);
  }, []);

  const allDone =
    day != null && BUILT_MODE_SLUGS.every((s) => statuses[s]?.won);
  const completedCount = BUILT_MODE_SLUGS.filter((s) => statuses[s]?.won)
    .length;
  const totalGuesses = BUILT_MODE_SLUGS.reduce(
    (sum, s) => sum + (statuses[s]?.guesses ?? 0),
    0,
  );

  return (
    <main className="flex-1">
      <section className="relative isolate flex min-h-[min(72vh,720px)] items-end overflow-hidden">
        <HomeBanner />
        <div className="relative mx-auto w-full max-w-6xl px-6 pb-14 pt-24 sm:pb-20 sm:pt-32">
          {allDone ? (
            <DailyCompleteHero
              day={day}
              count={BUILT_MODE_SLUGS.length}
              totalGuesses={totalGuesses}
            />
          ) : (
            <DefaultHero day={day} />
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pt-16 pb-12 sm:pt-20">
        <div className="mb-6 flex items-baseline justify-between border-b border-line pb-3">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-info">
            Modes
          </h2>
          <span className="font-mono text-xs text-ink-faint">
            {day
              ? `${completedCount} / ${BUILT_MODE_SLUGS.length} done`
              : `${BUILT_MODE_SLUGS.length} live`}
          </span>
        </div>

        <ul className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
          {MODES.map((mode) => (
            <li key={mode.slug} className="bg-canvas">
              <ModeCard
                mode={mode}
                status={mode.built ? statuses[mode.slug] : undefined}
              />
            </li>
          ))}
        </ul>
      </section>

      {/* About section — keyword-rich intro for new visitors and search
          crawlers. Sits below the modes grid so it doesn't gate the daily
          play loop for returning players. */}
      <section className="mx-auto max-w-3xl px-6 pb-12 pt-4">
        <div className="border-l-2 border-accent/40 pl-6">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-info">
            About
          </h2>
          <h3 className="mt-3 font-display text-2xl text-ink">
            What is Deadlockle?
          </h3>
          <p className="mt-3 text-base leading-relaxed text-ink-soft">
            <strong className="text-ink">Deadlockle</strong> (also known as{" "}
            <em>Deadlock dle</em> or <em>Deadlockdle</em>) is a free daily
            Wordle-style hero-guessing game for Valve's{" "}
            <a
              href="https://store.steampowered.com/app/1422450/Deadlock/"
              className="text-accent underline-offset-2 hover:underline"
            >
              Deadlock
            </a>
            . Six modes, one hero per day. Classic uses an attribute grid;
            Quote, Ability, Item, and Mugshot progressively reveal the answer
            with each wrong guess. Sound is coming soon. New puzzles drop at
            midnight UTC, no signup, no ads, progress saved locally.
          </p>
          <p className="mt-4 text-base leading-relaxed text-ink-soft">
            <Link
              href="/how-to-play/"
              className="text-accent underline-offset-2 hover:underline"
            >
              Read the full how-to-play guide →
            </Link>
          </p>
        </div>
      </section>

      {/* Sister-site card — sits between modes grid and engagement strip */}
      <section className="mx-auto max-w-6xl px-6 pb-12 pt-4">
        <TryOWdleCard />
      </section>

      {/* Engagement strip: vote on next game + tip jar in one row.
          60/40 split (3:2 grid) — vote gets a touch more horizontal room
          since it's the more interactive ask. Single vertical hairline
          divider between the two columns. */}
      <section className="mx-auto max-w-6xl border-t border-line px-6 pt-12 pb-20 sm:pt-14">
        <div className="grid gap-y-14 md:grid-cols-5 md:gap-y-0 md:divide-x md:divide-line">
          <div className="md:col-span-3 md:pr-10 lg:pr-14">
            <RequestNextGame />
          </div>
          <div className="md:col-span-2 md:pl-10 lg:pl-14">
            <SupportLinks />
          </div>
        </div>
      </section>

      <footer className="border-t border-line bg-inset/40">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 font-mono text-xs text-ink-faint sm:flex-row sm:items-center sm:justify-between">
          <p>
            Hero & item data:{" "}
            <a
              className="underline-offset-2 hover:underline"
              href="https://deadlock-api.com"
            >
              deadlock-api.com
            </a>
            . Deadlock is a trademark of Valve Corporation. Deadlockle is an
            unofficial fan project.
          </p>
          <Link
            href="/how-to-play/"
            className="underline-offset-2 hover:underline"
          >
            How to play →
          </Link>
        </div>
      </footer>
    </main>
  );
}

function DefaultHero({ day }: { day: string | null }) {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-info">
        <span suppressHydrationWarning>
          {day ? prettyDay(day) : "Today"}
        </span>
        <span className="text-ink-faint"> · daily</span>
        <span className="text-ink-faint"> · </span>
        <NextResetCountdown />
      </p>
      <Brand as="h1" size="2xl" className="mt-6 leading-[0.95]" />
      <p className="mt-6 max-w-xl text-lg text-ink-soft">
        Your daily Deadlock quiz. Six modes, one hero.
      </p>
      <div className="mt-8">
        <BeginButton />
      </div>
    </div>
  );
}

// Primary call-to-action. Dark-on-amber deco panel — feels like a brass
// nameplate, fits Deadlock's parlour aesthetic.
function BeginButton() {
  return (
    <Link
      href="/classic/"
      className="group relative inline-flex"
      aria-label="Begin with Classic mode"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-2 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "rgba(214, 160, 92, 0.32)" }}
      />

      <span className="relative inline-flex items-center gap-4 border border-edge bg-muted px-8 py-4 font-display text-base font-bold uppercase tracking-[0.16em] shadow-xl shadow-black/50 transition-transform duration-200 group-hover:-translate-y-0.5 group-active:translate-y-0">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-1 border border-hairline"
        />
        <svg
          aria-hidden
          width="10"
          height="12"
          viewBox="0 0 10 12"
          className="relative shrink-0 text-accent-soft"
        >
          <polygon points="0,0 10,6 0,12" fill="currentColor" />
        </svg>

        <span className="relative">
          <span className="text-ink-soft">Begin with </span>
          <span className="text-accent-soft">Classic</span>
        </span>

        <svg
          aria-hidden
          width="18"
          height="12"
          viewBox="0 0 18 12"
          className="relative shrink-0 text-accent-soft transition-transform duration-200 group-hover:translate-x-1"
        >
          <path
            d="M0 6 L16 6 M11 1 L17 6 L11 11"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        </svg>
      </span>
    </Link>
  );
}

function DailyCompleteHero({
  day,
  count,
  totalGuesses,
}: {
  day: string;
  count: number;
  totalGuesses: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center gap-10 sm:flex-row sm:items-center sm:gap-14"
    >
      <CompleteBadge count={count} totalGuesses={totalGuesses} />
      <div className="flex-1 text-center sm:text-left">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-correct">
          <span aria-hidden>✓</span> Daily complete · {prettyDay(day)}
          <span className="text-ink-faint"> · </span>
          <NextResetCountdown />
        </p>
        <Brand as="h1" size="2xl" className="mt-4 leading-[0.95]" />
        <p className="mt-6 max-w-md text-lg text-ink-soft">
          You finished all <span className="text-ink">{count}</span> available
          modes today in{" "}
          <span className="text-ink">{totalGuesses}</span> total guesses. New
          puzzles arrive at <span className="text-ink">midnight UTC</span>.
        </p>
      </div>
    </motion.div>
  );
}

function CompleteBadge({
  count,
  totalGuesses,
}: {
  count: number;
  totalGuesses: number;
}) {
  return (
    <motion.div
      initial={{ scale: 0.78, opacity: 0, rotate: -8 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      transition={{
        duration: 0.7,
        delay: 0.1,
        ease: [0.34, 1.56, 0.64, 1],
      }}
      className="relative shrink-0"
      style={{ width: 220, height: 252 }}
    >
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          inset: -32,
          background:
            "radial-gradient(ellipse at center, rgba(127,184,108,0.32), transparent 65%)",
          filter: "blur(14px)",
        }}
      />

      <svg
        viewBox="0 0 220 252"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <defs>
          <linearGradient id="badge-fill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(127,184,108,0.22)" />
            <stop offset="100%" stopColor="rgba(127,184,108,0.04)" />
          </linearGradient>
          <filter id="badge-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>
        </defs>
        <polygon
          points="110,4 215,63 215,189 110,248 5,189 5,63"
          fill="none"
          stroke="rgba(127,184,108,0.65)"
          strokeWidth="3"
          filter="url(#badge-glow)"
        />
        <polygon
          points="110,4 215,63 215,189 110,248 5,189 5,63"
          fill="url(#badge-fill)"
          stroke="var(--tile-correct)"
          strokeWidth="1.75"
        />
        <polygon
          points="110,16 203,68 203,184 110,236 17,184 17,68"
          fill="none"
          stroke="rgba(127,184,108,0.35)"
          strokeWidth="0.9"
        />
      </svg>

      <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ scale: 0, rotate: -120 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            duration: 0.55,
            delay: 0.5,
            ease: [0.34, 1.56, 0.64, 1],
          }}
          aria-hidden
        >
          <svg width="56" height="56" viewBox="0 0 56 56" className="text-correct">
            <path
              d="M10 28 L24 42 L46 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              strokeLinecap="square"
              strokeLinejoin="miter"
            />
          </svg>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.7 }}
          className="mt-4 font-display display-headline text-[11px] text-ink"
        >
          Daily complete
        </motion.div>
        <div className="mt-3 h-px w-10 bg-correct/45" />
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.78 }}
          className="mt-3 font-display text-4xl leading-none text-correct"
        >
          {count}
          <span className="text-ink-soft">/</span>
          {count}
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.86 }}
          className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-info"
        >
          {totalGuesses} guesses
        </motion.div>
      </div>
    </motion.div>
  );
}

function ModeCard({
  mode,
  status,
}: {
  mode: ModeDef;
  status: Status | undefined;
}) {
  if (!mode.built) {
    return (
      <div className="block h-full p-6 opacity-50">
        <ModeCardInner label={mode.label} blurb={mode.blurb}>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-info">
            Soon
          </span>
        </ModeCardInner>
      </div>
    );
  }

  let tag: React.ReactNode;
  if (status?.won) {
    tag = (
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-correct">
        <span aria-hidden>✓</span> in {status.guesses}
      </span>
    );
  } else if (status && status.guesses > 0) {
    tag = (
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-info">
        {status.guesses} {status.guesses === 1 ? "guess" : "guesses"} ·
        Resume →
      </span>
    );
  } else {
    tag = (
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
        Play →
      </span>
    );
  }

  return (
    <Link
      href={`/${mode.slug}/`}
      className="group block h-full p-6 transition-colors hover:bg-muted focus-visible:bg-muted"
    >
      <ModeCardInner label={mode.label} blurb={mode.blurb}>
        {tag}
      </ModeCardInner>
    </Link>
  );
}

function ModeCardInner({
  label,
  blurb,
  children,
}: {
  label: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-2xl text-ink">{label}</h3>
        {children}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">{blurb}</p>
    </div>
  );
}
