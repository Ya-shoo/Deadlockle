import type { Metadata } from "next";
import { Cinzel, Source_Sans_3, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";

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
const DEFAULT_TITLE = "Deadlockle — Daily Deadlock Quiz · Guess the Hero";
const DEFAULT_DESCRIPTION =
  "Deadlockle is the daily Wordle-style quiz for Valve's Deadlock. Guess the hero by attributes, ability icon, item, quote, or cropped mugshot. New puzzle every day, free, no signup.";

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

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  alternateName: ["Deadlock dle", "Deadlockdle", "Daily Deadlock Quiz"],
  url: SITE_URL,
  description: DEFAULT_DESCRIPTION,
  applicationCategory: "Game",
  genre: "Puzzle",
  operatingSystem: "Any",
  inLanguage: "en",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <Header />
        {children}
      </body>
    </html>
  );
}
