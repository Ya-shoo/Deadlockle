import type { Metadata } from "next";
import { MugshotGame } from "@/components/MugshotGame";
import { ModeSchema } from "@/components/ModeSchema";

const TITLE = "Mugshot: Guess the Deadlock Hero";
const DESCRIPTION =
  "Daily Deadlock mugshot quiz. Identify the hero from a tightly cropped portrait that pulls back with each guess. New puzzle every day.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/mugshot/" },
  openGraph: {
    title: `${TITLE} · Deadlockle`,
    description: DESCRIPTION,
    url: "/mugshot/",
    type: "website",
    siteName: "Deadlockle",
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} · Deadlockle`,
    description: DESCRIPTION,
  },
};

export default function MugshotPage() {
  return (
    <>
      <ModeSchema slug="mugshot" label="Mugshot" description={DESCRIPTION} />
      <MugshotGame />
    </>
  );
}
