import { clsx } from "clsx";

type Props = {
  as?: "span" | "h1" | "h2";
  size?: "sm" | "md" | "lg" | "2xl";
  className?: string;
};

const SIZE: Record<NonNullable<Props["size"]>, string> = {
  sm: "text-xl",
  md: "text-3xl",
  lg: "text-5xl",
  "2xl": "text-[clamp(2.5rem,11.5vw,4.5rem)] sm:text-7xl md:text-8xl",
};

// Wordmark for Deadlockle. "DEADLOCK" in deco capitals + an amber hairline
// underline + small "LE" tail picks up the sister-brand cadence with OWdle.
export function Brand({ as: As = "span", size = "md", className }: Props) {
  return (
    <As
      className={clsx(
        "font-display font-bold uppercase tracking-[0.08em] text-ink",
        SIZE[size],
        className,
      )}
    >
      <span>Deadlock</span>
      <span className="text-accent">le</span>
    </As>
  );
}
