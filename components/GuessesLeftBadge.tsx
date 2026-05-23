import clsx from "clsx";

// Minimal-but-prominent guesses-remaining counter rendered above the guess
// input in every mode. A pip strip (one per cap slot, filled while
// available) plus a tabular number. Tone escalates with pressure so the
// player feels the cap tightening:
//   remaining > 50% of cap   → info (teal, neutral)
//   1 < remaining ≤ 50%       → partial (amber)
//   remaining ≤ 1             → far (red)
//
// `used` and `cap` are taken explicitly rather than computed internally so
// the caller can pass the effective used count — Classic adds hint slots,
// Sound counts skips, etc. Single source of truth on the cap stays in the
// per-mode component.
export function GuessesLeftBadge({
  used,
  cap,
  className,
}: {
  used: number;
  cap: number;
  className?: string;
}) {
  const remaining = Math.max(0, cap - used);
  const ratio = remaining / cap;
  const tone: "info" | "partial" | "far" =
    remaining <= 1 ? "far" : ratio <= 0.5 ? "partial" : "info";

  const toneText = {
    info: "text-info",
    partial: "text-partial",
    far: "text-far",
  }[tone];
  const toneFill = {
    info: "bg-info",
    partial: "bg-partial",
    far: "bg-far",
  }[tone];
  const toneRing = {
    info: "border-info/60",
    partial: "border-partial/70",
    far: "border-far/70",
  }[tone];

  return (
    <div
      className={clsx("inline-flex items-center gap-3", toneText, className)}
      aria-label={`${remaining} of ${cap} guesses left`}
    >
      <span className="flex items-center gap-1.5">
        {Array.from({ length: cap }).map((_, i) => {
          const filled = i < remaining;
          return (
            <span
              key={i}
              aria-hidden
              className={clsx(
                "inline-block h-2.5 w-2.5 rounded-full border transition-colors",
                filled
                  ? `${toneFill} ${toneRing}`
                  : "border-line bg-transparent",
              )}
            />
          );
        })}
      </span>
      <span className="inline-flex items-baseline gap-1.5">
        <span className="font-display text-2xl font-bold leading-none tabular-nums sm:text-3xl">
          {remaining}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] opacity-70">
          left
        </span>
      </span>
    </div>
  );
}
