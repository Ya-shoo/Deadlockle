import type { Hero } from "./heroes";

// Eight attributes for Classic mode. Mix of API-derived (hero_type, gun_tag,
// hp, move_speed) and overlay (sub_role, damage_source, gender, nature).
// Calibrated to the Deadlock value distributions.
export type AttrKey =
  | "hero_type"
  | "sub_role"
  | "gun_tag"
  | "damage_source"
  | "nature"
  | "gender"
  | "hp"
  | "move_speed";

export type TileStatus = "correct" | "partial" | "far" | "wrong";
export type Hint = "higher" | "lower" | null;

export type AttrResult = {
  attr: AttrKey;
  label: string;
  display: string;
  status: TileStatus;
  hint: Hint;
  tooltip?: string;
};

export const ATTRIBUTES: { key: AttrKey; label: string }[] = [
  { key: "hero_type", label: "Class" },
  { key: "sub_role", label: "Role" },
  { key: "gun_tag", label: "Gun" },
  { key: "damage_source", label: "Damage" },
  { key: "nature", label: "Nature" },
  { key: "gender", label: "Gender" },
  { key: "hp", label: "HP" },
  { key: "move_speed", label: "Speed" },
];

const NEAR_THRESHOLDS: Record<"hp" | "move_speed", number> = {
  hp: 50,
  move_speed: 0.4,
};

const TOOLTIPS: Partial<Record<AttrKey, string>> = {
  hero_type: "Valve's in-game hero classification",
  sub_role: "Deadlockle's refinement of Valve's 4-class system",
};

function fmtCategorical(v: string | null): string {
  if (v == null) return "?";
  return v
    .split(" ")
    .map((w) =>
      w
        .split("-")
        .map((p) => p[0]?.toUpperCase() + p.slice(1))
        .join("-"),
    )
    .join(" ");
}

function fmtNumber(v: number | null, opts?: { decimals?: number }): string {
  if (v == null) return "?";
  return opts?.decimals != null ? v.toFixed(opts.decimals) : `${v}`;
}

function categorical(
  guessVal: string | null,
  answerVal: string | null,
): TileStatus {
  if (guessVal == null) return "wrong";
  return guessVal === answerVal ? "correct" : "wrong";
}

function numerical(
  guessVal: number | null,
  answerVal: number | null,
  nearThreshold: number,
): { status: TileStatus; hint: Hint } {
  if (guessVal == null || answerVal == null) {
    return { status: "wrong", hint: null };
  }
  if (guessVal === answerVal) return { status: "correct", hint: null };
  const diff = Math.abs(guessVal - answerVal);
  const status: TileStatus = diff <= nearThreshold ? "partial" : "far";
  const hint: Hint = guessVal < answerVal ? "higher" : "lower";
  return { status, hint };
}

export function compareHero(guess: Hero, answer: Hero): AttrResult[] {
  const out: AttrResult[] = [];

  out.push({
    attr: "hero_type",
    label: "Class",
    display: fmtCategorical(guess.hero_type),
    status: categorical(guess.hero_type, answer.hero_type),
    hint: null,
    tooltip: TOOLTIPS.hero_type,
  });

  out.push({
    attr: "sub_role",
    label: "Role",
    display: fmtCategorical(guess.sub_role),
    status: categorical(guess.sub_role, answer.sub_role),
    hint: null,
    tooltip: TOOLTIPS.sub_role,
  });

  out.push({
    attr: "gun_tag",
    label: "Gun",
    display: fmtCategorical(guess.gun_tag),
    status: categorical(guess.gun_tag, answer.gun_tag),
    hint: null,
  });

  out.push({
    attr: "damage_source",
    label: "Damage",
    display: fmtCategorical(guess.damage_source),
    status: categorical(guess.damage_source, answer.damage_source),
    hint: null,
  });

  out.push({
    attr: "nature",
    label: "Nature",
    display: fmtCategorical(guess.nature),
    status: categorical(guess.nature, answer.nature),
    hint: null,
  });

  out.push({
    attr: "gender",
    label: "Gender",
    display: fmtCategorical(guess.gender),
    status: categorical(guess.gender, answer.gender),
    hint: null,
  });

  const hpR = numerical(guess.hp, answer.hp, NEAR_THRESHOLDS.hp);
  out.push({
    attr: "hp",
    label: "HP",
    display: fmtNumber(guess.hp),
    status: hpR.status,
    hint: hpR.hint,
  });

  const speedR = numerical(
    guess.move_speed,
    answer.move_speed,
    NEAR_THRESHOLDS.move_speed,
  );
  out.push({
    attr: "move_speed",
    label: "Speed",
    display: fmtNumber(guess.move_speed, { decimals: 1 }),
    status: speedR.status,
    hint: speedR.hint,
  });

  return out;
}

export function isWin(results: AttrResult[]): boolean {
  return results.every((r) => r.status === "correct");
}

// Attributes the player has not yet matched green across any guess.
export function getUnsolvedAttrs(
  guesses: Hero[],
  answer: Hero,
): Set<AttrKey> {
  const solved = new Set<AttrKey>();
  for (const g of guesses) {
    for (const r of compareHero(g, answer)) {
      if (r.status === "correct") solved.add(r.attr);
    }
  }
  return new Set<AttrKey>(
    ATTRIBUTES.map((a) => a.key).filter((k) => !solved.has(k)),
  );
}
