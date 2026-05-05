import type { Metadata } from "next";
import { QuoteGame } from "@/components/QuoteGame";

const TITLE = "Quote — Guess the Deadlock Speakers";
const DESCRIPTION =
  "Daily Deadlock quote quiz. One hero is talking — guess both the speaker and the hero being addressed. New conversation every day.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/quote/" },
  openGraph: {
    title: `${TITLE} · Deadlockle`,
    description: DESCRIPTION,
    url: "/quote/",
    type: "website",
    siteName: "Deadlockle",
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} · Deadlockle`,
    description: DESCRIPTION,
  },
};

export default function QuotePage() {
  return <QuoteGame />;
}
