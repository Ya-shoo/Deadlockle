import type { Metadata } from "next";
import { SoundGame } from "@/components/SoundGame";

const TITLE = "Sound — Guess the Deadlock Speakers by Voice";
const DESCRIPTION =
  "Daily Deadlock sound quiz. A pre-match conversation between two heroes — guess both speakers. Voice samples unlock as hints if you get stuck.";

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
