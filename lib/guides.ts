export type GuideEntry = {
  slug: string;
  label: string;
  index: string;
  /** Guide-flavored one-sentence pitch — frames the card as a guide, not a mode description. */
  pitch: string;
  /** Three short preview points teasing what's inside the full guide. */
  preview: string[];
  intro: string;
  strategy: { title: string; body: string }[];
  tips: string[];
  difficulty: "Quick read" | "Strategic" | "Lore-aware";
};

export const GUIDES: GuideEntry[] = [
  {
    slug: "classic",
    label: "Classic",
    index: "01",
    pitch:
      "A guide to the eight-attribute grid: what each tile reports, how the ↑/↓ arrows work, and when to spend a hint.",
    preview: [
      "What each of the eight tiles compares",
      "How the HP and Speed arrows actually behave",
      "The opt-in hint mechanic at 5 and 10 guesses",
    ],
    difficulty: "Strategic",
    intro:
      "Type any Deadlock hero into the search box. The grid lights up with eight attribute tiles: Class, Role, Gun, Damage, Nature, Gender, HP, and Speed. Six are exact green-or-red matches; HP and Speed return amber when within range and red when outside it. There is no guess limit.",
    strategy: [
      {
        title: "Open with a hero you know well",
        body: "Six of the eight tiles (Class, Role, Gun, Damage, Nature, Gender) come back as exact green/red. The first guess is mostly an elimination probe. Pick a hero whose attributes you can recall confidently.",
      },
      {
        title: "Pivot on what's still red",
        body: "After the first guess greens a few tiles, your next pick should specifically differ on the red ones. Triangulate the unsolved attributes; minor variations on the same hero archetype waste guesses.",
      },
      {
        title: "Cash in hints at 5 and 10 guesses",
        body: "At those thresholds you can opt in to a hint that reveals one random unsolved attribute. Two per puzzle, and it's a confirmation prompt, never accidental.",
      },
    ],
    tips: [
      "No guess limit and no time limit. This is a daily, not a sprint.",
      "Comparisons persist across the day. Refresh, come back later, the board is intact.",
      "On mobile the eight tiles wrap into two rows of four.",
    ],
  },
  {
    slug: "ability",
    label: "Ability",
    index: "02",
    pitch:
      "A guide to the 4×4 tile reveal: how the icon emerges, which slots are eligible, and what the bonus round actually asks.",
    preview: [
      "How the 16-tile shuffled reveal works",
      "Which of the hero's four ability slots is fair game",
      "The bonus round that fires after you win",
    ],
    difficulty: "Quick read",
    intro:
      "A 4×4 tile grid hides the daily ability icon. One tile is exposed before any guess; each wrong guess uncovers one more in a deterministic shuffled order, so the icon emerges piece by piece rather than fading from a blur.",
    strategy: [
      {
        title: "Compose what's emerging",
        body: "Tiles uncover in a shuffled order. You'll see scattered fragments, not a center-out reveal. Track shape, silhouette, and recurring color across the visible tiles.",
      },
      {
        title: "Only the hero counts to win",
        body: "You guess the hero, not an ability+slot. After you win, a bonus round asks which of the four slots was the answer. That's separate from the main puzzle.",
      },
    ],
    tips: [
      "One tile is already visible before your first guess. That's your free read.",
      "Wrong guesses don't surface attribute hints; they just reveal one more icon tile.",
      "All sixteen tiles unlock automatically once you solve the round.",
    ],
  },
  {
    slug: "mugshot",
    label: "Mugshot",
    index: "03",
    pitch:
      "A guide to the cropped portrait: using both the camera pull-back and the Classic-style attribute row each wrong guess hands you.",
    preview: [
      "How the zoom decays from 10× to 1× across nine guesses",
      "The full eight-attribute row that drops with every miss",
      "When to wait for the next zoom step instead of guessing",
    ],
    difficulty: "Quick read",
    intro:
      "A tight portrait crop appears, smartcropped to centre on the character. Each wrong guess zooms the camera out (10× down to 1× over nine misses), but every wrong guess also drops a full Classic-style attribute comparison row beneath it, so the puzzle doubles as a deduction grid.",
    strategy: [
      {
        title: "Every wrong guess hands you a Classic row",
        body: "Class, Role, Gun, Damage, Nature, Gender, HP, Speed: all eight tiles compare your guess to the answer. The tiles often resolve the puzzle before the picture does.",
      },
      {
        title: "Miss intentionally over coin-flipping",
        body: "When two heroes look identical at the current zoom, one more reveal step almost always settles it. Better to guess a low-confidence hero who narrows attributes than to flip a coin between two visual lookalikes.",
      },
    ],
    tips: [
      "The crop is smartcropped on the character, not random.",
      "Nine wrong guesses fully zoom the picture out (1× = original aspect).",
      "Use the attribute row as your primary signal. The picture is a tiebreaker.",
    ],
  },
  {
    slug: "sound",
    label: "Conversation",
    index: "04",
    pitch:
      "A guide to the two-speaker round: when each new line drops, when the audio unlocks, and the attribute tiles each guess hands you.",
    preview: [
      "Why the dialogue advances only on guesses",
      "The Classic-style attribute row each wrong guess produces",
      "The audio cadence: line one at guess 5, then every two more",
    ],
    difficulty: "Lore-aware",
    intro:
      "A pre-match exchange between two Deadlock heroes. The first line is visible immediately; each wrong guess reveals the next line of dialogue. After five misses, the first speaker's voice clip unlocks, then one more line's audio every two guesses (line 2 at 7, line 3 at 9, …). Both speakers are guessed in their own combobox.",
    strategy: [
      {
        title: "Each guess reveals the next line",
        body: "One line is visible at start; sitting and waiting reveals nothing. Even a low-confidence wrong guess pushes dialogue forward and earns you an attribute row, so there's no penalty for advancing.",
      },
      {
        title: "Wrong guesses produce a Classic row too",
        body: "When you guess against Speaker A or B, an eight-attribute comparison drops below your guess just like Classic mode. The round is half deduction, half voice-recognition.",
      },
      {
        title: "Audio is the late-game crutch",
        body: "The first voice clip unlocks at guess 5; every two more guesses unlocks the next line's clip. If you've heard the heroes in-game, the audio usually ends the round in one more guess.",
      },
    ],
    tips: [
      "One line is shown plus two redacted previews so you can see more is coming.",
      "Guesses are scoped to one speaker at a time. A and B are separate fields.",
      "Once you solve the round, every line's play button unlocks for replay.",
    ],
  },
  {
    slug: "item",
    label: "Item",
    index: "05",
    pitch:
      "A guide to the blurred shop icon: reading the slot through the blur, and what hard mode's rotation actually does.",
    preview: [
      "Why slot is the easiest read at heavy blur",
      "How the blur clears across nine reveal levels",
      "What hard mode does, and when to toggle it off",
    ],
    difficulty: "Strategic",
    intro:
      "A shop-item icon, blurred. Each wrong guess sharpens it across nine reveal levels (20 px → 0). The pool is the full Deadlock item shop, split across three slots: Weapon, Vitality, Spirit. Hard mode is on by default and rotates the icon by 90°/180°/270°, deterministic for the day.",
    strategy: [
      {
        title: "Place the slot first",
        body: "Weapon, Vitality, and Spirit have distinct icon styling. Slot is the easiest read at 20 px blur, and it cuts the candidate pool to roughly a third before you even pick an item.",
      },
      {
        title: "Hard mode is a switch, not a commitment",
        body: "Hard mode is on by default and rotates the icon by 90/180/270° per day. The toggle sits right under the icon and you can flip it any time. Flipping doesn't affect your saved score, just the visual.",
      },
    ],
    tips: [
      "Hard mode is session-only: it defaults to ON every time you load the page.",
      "Wrong guesses are stacked with their tier and slot for memory; the answer's slot isn't directly compared.",
      "Eight wrong guesses bring the blur to zero.",
    ],
  },
];
