import type { Metadata } from "next";
import { AbilityGame } from "@/components/AbilityGame";
import { ModeSchema } from "@/components/ModeSchema";

const TITLE = "Ability: Whose Deadlock Ability Is This?";
const DESCRIPTION =
  "Daily Deadlock ability quiz. Identify the hero from their ability icon. Each wrong guess unblurs the icon a little more. Fresh puzzle every day.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/ability/" },
  openGraph: {
    title: `${TITLE} · Deadlockle`,
    description: DESCRIPTION,
    url: "/ability/",
    type: "website",
    siteName: "Deadlockle",
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} · Deadlockle`,
    description: DESCRIPTION,
  },
};

export default function AbilityPage() {
  return (
    <>
      <ModeSchema slug="ability" label="Ability" description={DESCRIPTION} />
      <AbilityGame />
    </>
  );
}
