import type { Metadata } from "next";
import { ClassicGame } from "@/components/ClassicGame";

const TITLE = "Classic: Guess the Deadlock Hero";
const DESCRIPTION =
  "Daily Deadlock hero quiz. Guess the hero by matching attributes: class, role, gun, damage type, HP, nature. New puzzle every day. Free, no signup.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/classic/" },
  openGraph: {
    title: `${TITLE} · Deadlockle`,
    description: DESCRIPTION,
    url: "/classic/",
    type: "website",
    siteName: "Deadlockle",
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} · Deadlockle`,
    description: DESCRIPTION,
  },
};

export default function ClassicPage() {
  return <ClassicGame />;
}
