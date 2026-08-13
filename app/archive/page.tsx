import type { Metadata } from "next";
import { ArchiveHub } from "@/components/ArchiveHub";

// The Archive HUB is indexable: a server-rendered landing page that describes
// the replay feature in prose and reveals no puzzle content. The per-mode
// replay routes beneath it (/archive/classic/, /archive/mugshot/,
// /archive/sound/) stay noindex + disallowed — they're client-only game
// surfaces that render an empty shell to a crawler. Keep that split as new
// archive modes land.
const TITLE = "Archive";
const DESCRIPTION =
  "Replay past daily Deadlockle puzzles. Catch up on a day you missed, or turn a loss into a win. Archive rounds never affect your streak.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/archive/" },
  openGraph: {
    title: `${TITLE} · Deadlockle`,
    description: DESCRIPTION,
    url: "/archive/",
    type: "website",
    siteName: "Deadlockle",
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} · Deadlockle`,
    description: DESCRIPTION,
  },
};

export default function ArchivePage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:py-16">
      <ArchiveHub />
    </main>
  );
}
