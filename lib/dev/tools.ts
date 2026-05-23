// Single source of truth for Deadlockle's dev-hub tool inventory. The
// hub-index landing page (`/labeler/`) reads `TOOL_GROUPS` for its
// grouped card layout. The "← Dev hub" chip in the global Header
// (components/DevHubHeader.tsx) is the only persistent nav surface —
// it links back to /labeler/, so there is no per-tool pill row.

export type DevTool = {
  href: string;
  label: string;
  description: string;
  /** Optional helper-server port. Surfaces as a footnote so the dev
   *  remembers which `node scripts/*-server.mjs` (or `concurrently`
   *  task) needs to be running for the tool to work end-to-end. */
  helper?: string;
};

export type DevToolGroup = {
  title: string;
  blurb: string;
  tools: DevTool[];
};

export const TOOL_GROUPS: DevToolGroup[] = [
  {
    title: "Mode tests",
    blurb:
      "Drive each game mode into a specific state — wrong-guess counts, force-win, force-fail — without playing through.",
    tools: [
      {
        href: "/labeler/test/home/",
        label: "Home",
        description:
          "Preview the daily-complete hero, CompleteBadge wins/N, mode-grid tags, and sweep vs mixed copy. Seeds all five modes at once.",
      },
      {
        href: "/labeler/test/classic/",
        label: "Classic",
        description:
          "Hero attribute match. 10-guess cap; hints at 4 / 7 (each costs 1 guess).",
      },
      {
        href: "/labeler/test/ability/",
        label: "Ability",
        description: "Ability-icon reveal grid. 12-guess cap.",
      },
      {
        href: "/labeler/test/mugshot/",
        label: "Mugshot",
        description: "Cropped portrait, zoom pulls back. 5-guess cap.",
      },
      {
        href: "/labeler/test/sound/",
        label: "Conversation",
        description: "Two speakers; audio unlocks at 4 / 7. 8-guess cap.",
      },
      {
        href: "/labeler/test/item/",
        label: "Item",
        description: "Blurred item icon. 8-guess cap (blur=0 at 7).",
      },
    ],
  },
  {
    title: "Play",
    blurb: "Jump straight into a live mode — handy for sanity-checks.",
    tools: [
      { href: "/", label: "Home", description: "Daily-progress dashboard." },
      { href: "/classic/", label: "Classic", description: "Attribute Wordle." },
      { href: "/ability/", label: "Ability", description: "Ability-icon puzzle." },
      { href: "/mugshot/", label: "Mugshot", description: "Cropped portrait." },
      {
        href: "/sound/",
        label: "Conversation",
        description: "Two-speaker dialogue + audio.",
      },
      { href: "/item/", label: "Item", description: "Blurred item icon." },
    ],
  },
];

