import type { Metadata } from "next";
import { SoundGame } from "@/components/SoundGame";

const TITLE = "Conversation — Guess the Deadlock Speakers by Voice";
const DESCRIPTION =
  "Daily Deadlock conversation quiz. A pre-match exchange between two heroes — guess both speakers. The actual voice clip unlocks as a hint if you get stuck.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/sound/" },
  openGraph: {
    title: `${TITLE} · Deadlockle`,
    description: DESCRIPTION,
    url: "/sound/",
    type: "website",
    siteName: "Deadlockle",
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} · Deadlockle`,
    description: DESCRIPTION,
  },
};

export default function SoundPage() {
  return <SoundGame />;
}
