import type { Metadata } from "next";
import { ItemGame } from "@/components/ItemGame";

const TITLE = "Item: Guess the Deadlock Item Icon";
const DESCRIPTION =
  "Daily Deadlock item quiz. Guess the item from a heavily blurred shop icon that sharpens with each guess. Hard mode rotates the icon. New puzzle every day.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/item/" },
  openGraph: {
    title: `${TITLE} · Deadlockle`,
    description: DESCRIPTION,
    url: "/item/",
    type: "website",
    siteName: "Deadlockle",
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} · Deadlockle`,
    description: DESCRIPTION,
  },
};

export default function ItemPage() {
  return <ItemGame />;
}
