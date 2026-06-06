"use client";

import { ogImageUrlForCode } from "@/lib/shareLinks";

// Dev-only card matrix (see app/labeler/share-preview/page.tsx). Codes
// are hand-picked to cover the renderer's full variant space; the date
// is fixed so the images stay byte-stable while iterating.
//
// Every img URL carries a per-page-load buster: Safari's in-session
// memory cache re-serves images on ⌘R even when the response was
// no-store (WebKit quirk — there is no true hard-reload), which made
// the matrix pin renders from minutes-old renderer iterations. A fresh
// module evaluation per load → fresh query param → cache can't match.
// (Module-scope Date read keeps the impure call out of render.)
const RELOAD_BUST = Date.now().toString(36);

type Variant = { code: string; label: string };

const GROUPS: { title: string; variants: Variant[] }[] = [
  {
    title: "Classic",
    variants: [
      { code: "260605c3", label: "win 3" },
      { code: "260605c1", label: "win 1 (singular)" },
      { code: "260605c52", label: "win 5 · 2 hints" },
      { code: "260605cz", label: "loss" },
      { code: "260605cz2", label: "loss · 2 hints" },
    ],
  },
  {
    title: "Ability",
    variants: [
      { code: "260605a4", label: "win 4" },
      { code: "260605az", label: "loss" },
    ],
  },
  {
    title: "Mugshot",
    variants: [
      { code: "260605m3", label: "win 3" },
      { code: "260605m31", label: "win 3 · hard mode" },
      { code: "260605mz", label: "loss" },
      { code: "260605mz1", label: "loss · hard mode" },
    ],
  },
  {
    title: "Conversation (long label)",
    variants: [
      { code: "260605s8", label: "win 8" },
      { code: "260605s1", label: "win 1 (singular)" },
      { code: "260605sz", label: "loss" },
    ],
  },
  {
    title: "Item",
    variants: [
      { code: "260605i2", label: "win 2" },
      { code: "260605iz", label: "loss" },
    ],
  },
  {
    title: "Daily",
    variants: [
      { code: "260605-32432-00", label: "sweep 5/5 · 14 guesses" },
      { code: "260605-3z43z-21", label: "3/5 · 2 hints · hard mode" },
      { code: "260605-32432-01", label: "sweep · hard mode only" },
      { code: "260605-32432-20", label: "sweep · 2 hints only" },
      { code: "260605-1zzzz-00", label: "1/5 · 1 guess (singular)" },
      { code: "260605-zzzzz-00", label: "0/5 all missed (em-dash pills)" },
    ],
  },
];

export function SharePreviewGrid() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-8 border-b border-line pb-4">
        <h1 className="font-display text-3xl text-ink">Share-card preview</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-soft">
          Every OG card variant, rendered live by the og-dev server
          (localhost:8798 — run via{" "}
          <code className="font-mono text-info">npm run dev</code>). Click a
          card to open the raw PNG; the link under each opens the /r/ unfurl
          shell. The dark/light backdrop toggle behind each card is the
          checker — transparent corners should show it through.
        </p>
      </header>
      <div className="flex flex-col gap-10">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-info">
              {g.title}
            </h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {g.variants.map((v) => (
                <Card key={v.code} variant={v} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

function Card({ variant }: { variant: Variant }) {
  const img = `${ogImageUrlForCode(variant.code)}?v=${RELOAD_BUST}`;
  const shell = `http://localhost:8798/r/${variant.code}`;
  return (
    <figure className="flex flex-col gap-2">
      <a
        href={img}
        target="_blank"
        rel="noreferrer"
        // Checkerboard backdrop so the chip's transparent corners are
        // visibly transparent while iterating.
        className="block overflow-hidden rounded-(--radius-card) border border-line"
        style={{
          backgroundImage:
            "linear-gradient(45deg, #2a2a2a 25%, transparent 25%, transparent 75%, #2a2a2a 75%), linear-gradient(45deg, #2a2a2a 25%, #4a4a4a 25%, #4a4a4a 75%, #2a2a2a 75%)",
          backgroundSize: "24px 24px",
          backgroundPosition: "0 0, 12px 12px",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img} alt={variant.label} className="block w-full" />
      </a>
      <figcaption className="flex items-baseline justify-between gap-2 font-mono text-[10px] text-ink-soft">
        <span>{variant.label}</span>
        <a
          href={shell}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-info hover:underline"
        >
          /r/{variant.code}
        </a>
      </figcaption>
    </figure>
  );
}
