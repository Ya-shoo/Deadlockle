// Sister-site cross-promo. Lives on Deadlockle's home page (in the two-card
// sister row) and, in its compact form, at the end of the daily-complete
// flow (NextModeCTA). UTM params let us track the click traffic in analytics
// later.
//
// Keep in lockstep with TryWuWadleCard (identical shape, different
// destination accent) and with the sibling sites' cards: a given destination
// is always its own accent-on-dark, on every site — "Play OWdle" is always
// Overwatch orange-on-dark, here and on wuwadle.app.
//
// Two variants:
//   - default — small, centered branded card: "Play OWdle" + a one-line
//     descriptor. The whole card is the link, so there's no eyebrow, blurb,
//     or button. Sits side-by-side with the WuWadle card in the home sister
//     row. Sharp corners + flat-at-rest to match Deadlockle's editorial
//     chrome; the accent border carries the edge.
//   - compact — legacy slim layout used by NextModeCTA on the daily-complete
//     panel, where the surrounding card is ~max-w-md and the default sizing
//     would overflow.
const OWDLE_URL =
  "https://playowdle.com/?utm_source=deadlockle&utm_medium=sister-site";

export function TryOWdleCard({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <a
        href={OWDLE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Try OWdle, the daily Overwatch quiz (opens in a new tab)"
        className="group relative block cursor-pointer overflow-hidden border border-line bg-surface p-4 transition-colors hover:bg-muted focus-visible:bg-muted active:bg-muted"
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
        <div className="relative flex flex-col gap-3">
          <div className="flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-info">
              Sister site · Deadlockle recommends
            </p>
            <h3 className="mt-2 font-display text-xl text-ink">
              Play <span style={{ color: "#ff8847" }}>OWdle</span>
            </h3>
            <p className="mt-1 text-xs text-ink-soft">
              Same daily format, different roster.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 self-start border border-line bg-canvas px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink transition-colors group-hover:border-edge group-hover:text-accent-soft">
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

  return (
    <a
      href={OWDLE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Try OWdle, the daily Overwatch quiz (opens in a new tab)"
      className="group relative flex w-full max-w-xs flex-col items-center gap-1 rounded-(--radius-card) border border-[#37486b] bg-[#1e2a45] p-5 text-center transition-[background-color,border-color,box-shadow] hover:border-[#4a5c82] hover:bg-[#25335a] hover:shadow-[0_2px_10px_-4px_rgba(242,101,34,0.4)] focus-visible:border-[#4a5c82] active:bg-[#25335a] sm:p-6"
      style={{ touchAction: "manipulation", WebkitTapHighlightColor: "rgba(242,101,34,0.14)" }}
    >
      <h3
        className="text-xl font-bold sm:text-2xl"
        style={{
          fontFamily: "var(--font-bricolage), ui-sans-serif, system-ui, sans-serif",
          color: "#f5efe6",
        }}
      >
        Play <span style={{ color: "#ff8a45" }}>OWdle</span>
      </h3>
      <p
        className="text-xs font-medium"
        style={{
          fontFamily: "var(--font-bricolage), ui-sans-serif, system-ui, sans-serif",
          color: "#b1a99d",
        }}
      >
        The daily Overwatch quiz
      </p>
    </a>
  );
}
