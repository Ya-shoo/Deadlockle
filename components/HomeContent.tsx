"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { dayString, prettyDay } from "@/lib/daily";
import { loadModeState } from "@/lib/storage";
import {
  ARCHIVED_MODES,
  BUILT_MODE_SLUGS,
  IS_DEV_BUILD,
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
import { WelcomeModal } from "./WelcomeModal";

type Status = { won: boolean; guesses: number };
type StatusMap = Partial<Record<ModeSlug, Status>>;

export function HomeContent() {
  const [day, setDay] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<StatusMap>({});
  // Dev-only archive panel. Hidden by default even in dev so the regular
  // play loop isn't cluttered while testing; the toggle below the modes
  // grid reveals archived modes (currently just Quote → superseded by
  // Conversation). Production builds have ARCHIVED_MODES === [], so the
  // toggle never renders.
  const [showArchive, setShowArchive] = useState(false);

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

        <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {MODES.map((mode, idx) => (
            <li key={mode.slug}>
              <ModeCard
                mode={mode}
                index={idx + 1}
                status={mode.built ? statuses[mode.slug] : undefined}
              />
            </li>
          ))}
        </ul>

        {IS_DEV_BUILD && ARCHIVED_MODES.length > 0 && (
          <div className="mt-8 border-t border-dashed border-line/60 pt-5">
            <button
              type="button"
              onClick={() => setShowArchive((s) => !s)}
              aria-expanded={showArchive}
              className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint transition-colors hover:text-info"
            >
              <span className="text-accent-soft">[dev]</span>{" "}
              {showArchive ? "Hide" : "Show"} archive · {ARCHIVED_MODES.length}{" "}
              {ARCHIVED_MODES.length === 1 ? "mode" : "modes"}
            </button>
            {showArchive && (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                {ARCHIVED_MODES.map((mode, idx) => (
                  <li key={mode.slug}>
                    <ModeCard
                      mode={mode}
                      index={MODES.length + idx + 1}
                      status={mode.built ? statuses[mode.slug] : undefined}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
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
            <strong className="text-ink">Deadlockle</strong> is the daily
            Wordle-style quiz for Valve's{" "}
            <a
              href="https://store.steampowered.com/app/1422450/Deadlock/"
              className="text-accent underline-offset-2 hover:underline"
            >
              Deadlock
            </a>
            . Five modes, one hero per day — Deadlockle's Classic mode is the
            eight attribute deduction grid, and Ability, Item, Mugshot, and
            Conversation each reveal the answer in their own way as you guess.
            New puzzles arrive at midnight UTC, and your board waits where you
            left it. Solve a few, come back later, take your time.
          </p>
          <Link
            href="/guides/"
            className="mt-6 inline-flex items-center gap-3 border border-edge bg-muted px-6 py-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent-soft transition-colors hover:bg-inset hover:text-ink"
          >
            Guides
            <span aria-hidden>→</span>
          </Link>
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
            href="/guides/"
            className="underline-offset-2 hover:underline"
          >
            Guides →
          </Link>
        </div>
      </footer>
    </main>
  );
}

function DefaultHero({ day }: { day: string | null }) {
  return (
    <div>
      {/* Date + countdown line sits directly on the panning Ken Burns
          banner, so the shadow handles bright frames (key art with
          warm amber highlights) without dimming on dark frames. */}
      <p
        className="font-mono text-xs uppercase tracking-[0.2em] text-info"
        style={{
          textShadow:
            "0 1px 0 rgba(0,0,0,0.7), 0 0 12px rgba(0,0,0,0.55)",
        }}
      >
        <span suppressHydrationWarning>
          {day ? prettyDay(day) : "Today"}
        </span>
        <span className="text-ink-faint"> · daily</span>
        <span className="text-ink-faint"> · </span>
        <NextResetCountdown />
      </p>
      <Brand as="h1" size="2xl" className="mt-6 leading-[0.95]" />
      <p className="mt-6 max-w-xl text-lg text-ink-soft">
        Your daily Deadlock guessing game. Five modes, fresh every day.
      </p>
      <div className="mt-8">
        <BeginButton />
      </div>
      <div className="mt-5">
        <WelcomeModal />
      </div>
    </div>
  );
}

// Primary call-to-action that anchors first-time visitors to the start
// of the sequential progression. Always points at Classic — the modes
// grid below carries the per-mode entry points for returning users.
// Body is solid amber with dark teal ink. Glow stays contained — dark
// elevation shadow at rest, tight warm rim on hover — so the button
// reads as a weighty nameplate, not a radiating beacon.
function BeginButton() {
  return (
    <Link
      href="/classic/"
      className="begin-cta group relative inline-flex"
      aria-label="Begin"
    >
      {/* hover halo — tight + low opacity so it reads as a warm rim
          (room light catching the edge), not a bloom radiating outward.
          Pulses gently via globals.css .begin-cta. */}
      <span
        aria-hidden
        className="begin-halo pointer-events-none absolute -inset-1 opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
        style={{ background: "rgba(214, 160, 92, 0.32)" }}
      />

      {/* button body — solid brass panel with deco hairline inset. Dark
          drop shadow at rest gives it weight (a real plate sitting on
          the table). On hover it brightens slightly and gains a tight
          downward amber drop. */}
      <span className="relative inline-flex items-center gap-4 bg-accent px-10 py-5 font-display text-lg font-bold uppercase tracking-[0.18em] text-on-accent shadow-md shadow-black/30 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:bg-accent-soft group-hover:shadow-[0_8px_18px_-10px_var(--accent)] group-active:translate-y-0">
        {/* deco hairline inset — engraved-on-brass feel, signature
            parlour detail. Dark teal on amber so it reads cleanly. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-1 border"
          style={{ borderColor: "rgba(12, 24, 32, 0.22)" }}
        />
        <svg
          aria-hidden
          width="10"
          height="12"
          viewBox="0 0 10 12"
          className="relative shrink-0 text-on-accent"
        >
          <polygon points="0,0 10,6 0,12" fill="currentColor" />
        </svg>

        <span className="relative">Begin</span>

        <svg
          aria-hidden
          width="18"
          height="12"
          viewBox="0 0 18 12"
          className="relative shrink-0 text-on-accent transition-transform duration-200 group-hover:translate-x-1"
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
        <p
          className="font-mono text-xs uppercase tracking-[0.2em] text-correct"
          style={{
            textShadow:
              "0 1px 0 rgba(0,0,0,0.7), 0 0 12px rgba(0,0,0,0.55)",
          }}
        >
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
  index,
  status,
}: {
  mode: ModeDef;
  index: number;
  status: Status | undefined;
}) {
  const indexLabel = String(index).padStart(2, "0");

  if (!mode.built) {
    return (
      <div
        className="mode-card mode-card--disabled relative flex h-full flex-col p-5"
        aria-disabled="true"
      >
        <ModeCardInner
          label={mode.label}
          blurb={mode.blurb}
          indexLabel={indexLabel}
          tag={
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-info">
              Soon
            </span>
          }
        />
      </div>
    );
  }

  const state: "won" | "resume" | "fresh" = status?.won
    ? "won"
    : status && status.guesses > 0
      ? "resume"
      : "fresh";

  let tag: React.ReactNode;
  if (state === "won") {
    tag = (
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-correct">
        <span aria-hidden>✓</span> in {status!.guesses}
      </span>
    );
  } else if (state === "resume") {
    tag = (
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-info">
        {status!.guesses} {status!.guesses === 1 ? "guess" : "guesses"} ·
        Resume
      </span>
    );
  } else {
    tag = (
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent-soft">
        Play
      </span>
    );
  }

  return (
    <Link
      href={`/${mode.slug}/`}
      className={`mode-card mode-card--${state} group relative flex h-full flex-col p-5`}
    >
      <span aria-hidden className="mode-card__corner mode-card__corner--tl" />
      <span aria-hidden className="mode-card__corner mode-card__corner--br" />
      <ModeCardInner
        label={mode.label}
        blurb={mode.blurb}
        indexLabel={indexLabel}
        tag={tag}
        showArrow
      />
    </Link>
  );
}

function ModeCardInner({
  label,
  blurb,
  indexLabel,
  tag,
  showArrow = false,
}: {
  label: string;
  blurb: string;
  indexLabel: string;
  tag: React.ReactNode;
  showArrow?: boolean;
}) {
  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          {indexLabel}
        </span>
        {tag}
      </div>
      <h3 className="mt-2 font-display text-xl leading-tight text-ink">
        {label}
      </h3>
      <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ink-soft">
        {blurb}
      </p>
      {showArrow && (
        <span aria-hidden className="mode-card__arrow font-mono text-base">
          →
        </span>
      )}
    </div>
  );
}
