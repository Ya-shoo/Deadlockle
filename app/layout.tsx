import type { Metadata } from "next";
import { Cinzel, Source_Sans_3, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { FeedbackButton } from "@/components/FeedbackButton";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
});

const SITE_URL = "https://deadlockle.com";
const SITE_NAME = "Deadlockle";
const DEFAULT_TITLE = "Deadlockle · Daily Deadlock Quiz · Guess the Hero";
const DEFAULT_DESCRIPTION =
  "Deadlockle is the daily Deadlock Wordle — a free hero quiz game for Valve's Deadlock. Guess the hero by attributes, ability icon, item, voice line conversation, or cropped mugshot. New puzzle every day, no signup.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: DEFAULT_TITLE, template: "%s · Deadlockle" },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "deadlockle",
    "deadlock dle",
    "deadlockdle",
    "deadlock wordle",
    "deadlock daily quiz",
    "deadlock quiz game",
    "daily deadlock quiz",
    "deadlock guessing game",
    "guess the deadlock hero",
    "deadlock hero quiz",
    "deadlock daily puzzle",
    "deadlock ability quiz",
    "deadlock item quiz",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  robots: { index: true, follow: true },
  verification: {
    google: "DzESs1e7eNYKs1XoW8tbLjK4Hk2GNBlrIu-DNIkFDO4",
  },
};

// Two-node graph so Google reads "Deadlockle" as a distinct brand entity
// (WebSite) AND a playable web app (WebApplication). The WebSite node is
// the one Google's Knowledge Graph uses for entity recognition — without
// it, brand-name searches risk being auto-corrected to similar competitor
// brands like Deadlockdle. alternateName lists genuine alternate spellings
// of THIS brand only; competitor names are deliberately excluded so we
// don't tell Google the brands are interchangeable.
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      alternateName: [
        "Deadlock dle",
        "Deadlock Wordle",
        "Daily Deadlock Quiz",
      ],
      url: SITE_URL,
      description: DEFAULT_DESCRIPTION,
      inLanguage: "en",
      publisher: { "@id": `${SITE_URL}/#publisher` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#publisher`,
      name: SITE_NAME,
      url: SITE_URL,
      sameAs: ["https://ko-fi.com/yushoo"],
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#webapp`,
      name: SITE_NAME,
      alternateName: ["Deadlock dle", "Deadlock Wordle"],
      url: SITE_URL,
      description: DEFAULT_DESCRIPTION,
      applicationCategory: "GameApplication",
      genre: ["Puzzle", "Trivia", "Word Game"],
      operatingSystem: "Web",
      browserRequirements: "Requires JavaScript and HTML5.",
      inLanguage: "en",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: {
        "@type": "VideoGame",
        name: "Deadlock",
        publisher: { "@type": "Organization", name: "Valve Corporation" },
        gamePlatform: "PC",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${cinzel.variable} ${sourceSans.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
        />
        <Header />
        {children}
        <FeedbackButton />
      </body>
    </html>
  );
}
