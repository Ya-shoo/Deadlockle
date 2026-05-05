import { HEROES_BY_KEY, type Hero } from "./heroes";
import { compareHero } from "./compare";

export function buildShareText(opts: {
  modeLabel: string;
  day: string;
  guesses: string[];
  answer: Hero;
  headline?: string;
  hintsUsed?: number;
}): string {
  const lines: string[] = [];
  lines.push(`Deadlockle ${opts.modeLabel} · ${opts.day}`);
  const hintSuffix =
    opts.hintsUsed && opts.hintsUsed > 0
      ? ` (+${opts.hintsUsed} hint${opts.hintsUsed === 1 ? "" : "s"})`
      : "";
  lines.push(
    opts.headline
      ? `${opts.headline} in ${opts.guesses.length}${hintSuffix}`
      : `Solved in ${opts.guesses.length}${hintSuffix}`,
  );
  lines.push("");
  for (const key of opts.guesses) {
    const hero = HEROES_BY_KEY[key];
    if (!hero) continue;
    const results = compareHero(hero, opts.answer);
    const row = results
      .map((r) => {
        if (r.status === "correct") return "🟩";
        if (r.status === "partial") return "🟨";
        if (r.status === "far") return "🟥";
        return "⬛";
      })
      .join("");
    lines.push(row);
  }
  return lines.join("\n");
}
