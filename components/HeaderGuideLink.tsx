"use client";

// Context-aware guides link in the global header. On a mode page, points
// at that mode's deep guide (e.g. /classic/ → /guides/classic/) and uses
// "Classic guide" as anchor text. Everywhere else it points at /guides/
// with "Guides" anchor text. The deep-link variant gives each /guides/<slug>/
// page an additional inbound link from a high-priority route, which helps
// the deep guide pages get crawled and ranked.

import Link from "next/link";
import { usePathname } from "next/navigation";

const MODE_SLUGS = ["classic", "ability", "mugshot", "sound", "item"] as const;
type ModeSlug = (typeof MODE_SLUGS)[number];

const LABEL: Record<ModeSlug, string> = {
  classic: "Classic",
  ability: "Ability",
  mugshot: "Mugshot",
  sound: "Conversation",
  item: "Item",
};

// "sound" is the route slug but the user-facing mode label is "Conversation",
// and the guide deep page is /guides/sound/ — keep them aligned.
function modeFromPath(pathname: string | null): ModeSlug | null {
  if (!pathname) return null;
  const stripped = pathname.replace(/^\/+|\/+$/g, "");
  if (!stripped) return null;
  const first = stripped.split("/")[0];
  return (MODE_SLUGS as readonly string[]).includes(first)
    ? (first as ModeSlug)
    : null;
}

export function HeaderGuideLink() {
  const pathname = usePathname();
  const mode = modeFromPath(pathname);

  const href = mode ? `/guides/${mode}/` : "/guides/";
  const label = mode ? `${LABEL[mode]} guide` : "Guides";

  return (
    <Link
      href={href}
      className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft underline-offset-4 transition-colors hover:text-accent-soft hover:underline"
    >
      {label}
    </Link>
  );
}
