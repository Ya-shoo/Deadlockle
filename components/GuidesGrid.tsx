import Link from "next/link";
import { GUIDES, type GuideEntry } from "@/lib/guides";

export function GuidesGrid() {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 sm:gap-6">
      {GUIDES.map((guide) => (
        <GuideCard key={guide.slug} guide={guide} />
      ))}
    </ul>
  );
}

function GuideCard({ guide }: { guide: GuideEntry }) {
  return (
    <li className="guide-card group relative flex h-full flex-col p-7 sm:p-9">
      <span aria-hidden className="guide-card__hairline" />
      <span aria-hidden className="guide-card__anchor guide-card__anchor--tr" />
      <span aria-hidden className="guide-card__anchor guide-card__anchor--bl" />

      <div className="relative flex h-full flex-col">
        <h2 className="font-display text-[26px] leading-[1.1] text-ink sm:text-[30px]">
          <Link
            href={`/guides/${guide.slug}/`}
            className="transition-colors hover:text-accent-soft"
          >
            {guide.label}
          </Link>
        </h2>

        <p className="mt-7 font-mono text-[10px] uppercase tracking-[0.24em] text-accent">
          Strategy
        </p>
        <ol className="mt-5 space-y-5">
          {guide.strategy.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="font-mono text-[11px] leading-[1.4] tracking-[0.1em] text-accent-soft pt-[3px] tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex-1">
                <p className="font-display text-[15px] leading-[1.3] text-ink">
                  {step.title}
                </p>
                <p className="mt-1.5 text-[13px] leading-[1.65] text-ink-soft">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-auto pt-9">
          <Link
            href={`/${guide.slug}/`}
            className="group/cta relative inline-flex w-full items-center justify-center gap-3 border border-edge bg-muted px-5 py-4 font-display text-xs font-bold uppercase tracking-[0.18em] text-ink transition-all duration-200 hover:bg-inset hover:border-accent-soft"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-1 border border-hairline"
            />
            <span className="relative">
              Play <span className="text-accent-soft">{guide.label}</span>
            </span>
            <span
              aria-hidden
              className="relative transition-transform duration-200 group-hover/cta:translate-x-1"
            >
              →
            </span>
          </Link>
        </div>
      </div>
    </li>
  );
}
