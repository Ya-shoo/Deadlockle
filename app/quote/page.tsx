import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuoteGame } from "@/components/QuoteGame";
import { IS_DEV_BUILD } from "@/lib/modes";

const TITLE = "Quote: Guess the Deadlock Speakers";
const DESCRIPTION =
  "Daily Deadlock quote quiz. One hero is talking. Guess both the speaker and the hero being addressed. New conversation every day.";

// Quote is archived in favor of Conversation mode. The page is kept for
// dev-only reference; production builds emit a 404 here so search engines
// and players won't find it.
export const metadata: Metadata = IS_DEV_BUILD
  ? {
      title: TITLE,
      description: DESCRIPTION,
      alternates: { canonical: "/quote/" },
      robots: { index: false, follow: false },
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
    }
  : { robots: { index: false, follow: false } };

export default function QuotePage() {
  if (!IS_DEV_BUILD) notFound();
  return <QuoteGame />;
}
