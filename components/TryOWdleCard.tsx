// Sister-site cross-promo. Lives on Deadlockle's home page (after the modes
// grid) and at the end of the daily-complete flow. UTM params let us track
// the click traffic in analytics later.
const OWDLE_URL = "https://playowdle.com/?utm_source=deadlockle&utm_medium=sister-site";

export function TryOWdleCard() {
  return (
    <a
      href={OWDLE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Try OWdle, the daily Overwatch quiz (opens in a new tab)"
      className="group relative block cursor-pointer overflow-hidden border border-line bg-surface p-6 transition-colors hover:bg-muted focus-visible:bg-muted active:bg-muted sm:p-7"
      style={{ touchAction: "manipulation", WebkitTapHighlightColor: "rgba(214,160,92,0.18)" }}
    >
      {/* Faint corner ornament — hint of OW orange so the visual swap reads */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
        style={{
          background:
            "linear-gradient(110deg, transparent 0%, rgba(242,101,34,0.06) 70%, rgba(242,101,34,0.16) 100%)",
        }}
      />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-info">
            Sister site · Deadlockle recommends
          </p>
          <h3 className="mt-2 font-display text-2xl text-ink sm:text-3xl">
            Play <span style={{ color: "#ff8847" }}>OWdle</span>
          </h3>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
            The daily Overwatch quiz
          </p>
          <p className="mt-3 max-w-lg text-sm text-ink-soft">
            Same daily puzzle format, different roster. Five game modes,
            dozens of heroes. Resets at 2:15am Pacific.
          </p>
        </div>

        <span className="inline-flex items-center gap-2 self-start border border-line bg-canvas px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink transition-colors group-hover:border-edge group-hover:text-accent-soft sm:self-auto">
          Try OWdle
          <svg
            aria-hidden
            width="14"
            height="10"
            viewBox="0 0 14 10"
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          >
            <path
              d="M0 5 L12 5 M8 1 L13 5 L8 9"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="square"
            />
          </svg>
        </span>
      </div>
    </a>
  );
}
