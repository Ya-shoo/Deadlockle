"use client";

// "← Dev hub" pill rendered inline next to the Deadlockle Brand in the
// global header whenever we're on a /labeler/* sub-route. The pill
// links back to /labeler/ so testers playing through the live game
// routes (/classic/, /ability/, /sound/, …) can jump to the hub
// without retyping the URL.
//
// Server-renderable: the only gates are (a) NODE_ENV !== production,
// inlined at build time, and (b) the current pathname. usePathname is
// hydration-safe in Next 16 — same value server-side and client-side
// — so we don't need a useEffect/useState dance, and the chip appears
// immediately on first paint.

import Link from "next/link";
import { usePathname } from "next/navigation";

const IS_DEV = process.env.NODE_ENV !== "production";

export function DevHubHeader() {
  const pathname = usePathname();
  if (!IS_DEV) return null;
  if (!pathname) return null;
  // Hide only on the hub-index itself (no point pointing home from
  // home). Show on every other route in dev — including live game
  // pages so you can jump back after clicking "Open <mode> →".
  if (pathname === "/labeler" || pathname === "/labeler/") return null;

  return (
    <Link
      href="/labeler/"
      className="inline-flex items-center gap-1.5 rounded-(--radius-card) border border-accent bg-accent/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-accent transition-colors hover:bg-accent/20"
    >
      <span aria-hidden>←</span>
      Dev hub
    </Link>
  );
}
