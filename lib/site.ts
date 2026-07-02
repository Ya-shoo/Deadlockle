// Canonical site origin — single source of truth for app metadata
// (app/layout.tsx) and share-text URLs. Mirrors OWdle's lib/site.ts;
// the share-card port (SHARE_CARDS_PLAN.md) expects SITE_URL here when
// lib/shareLinks.ts comes over.
export const SITE_URL = "https://deadlockle.com";

// Google Analytics 4 measurement ID for deadlockle.com. Non-secret — it ships
// in the page source on the live site — so it's a constant here rather than an
// env var, which avoids GA silently failing to load if a deploy machine's
// .env drifts (Yash deploys from both Mac and Windows). Consumed by
// components/GoogleAnalytics.tsx, which only loads gtag in production builds.
// GA exists purely to satisfy Monumetric's traffic verification for ad
// onboarding; PostHog (instrumentation-client.ts) remains primary analytics.
// Mirrors OWdle's setup — keep the two GA integrations in lockstep.
export const GA_MEASUREMENT_ID = "G-QVQ8H6H38X";

// Google AdSense publisher id. Non-secret — it ships in the page source and in
// public/ads.txt — so, like GA_MEASUREMENT_ID above, it's a constant here rather
// than an env var (a drifted .env on the Mac or Windows deploy box would
// otherwise silently disable ads). Setting it makes components/GoogleAdsense.tsx
// load the AdSense library in production — this IS the verification <script>
// AdSense asks you to add to <head>. Individual ad units still stay dark until
// each gets a real slotId in lib/adUnits.ts (provisioned after the site is
// approved), so arming the client is safe during review: the loader ships and
// zero ads render. One AdSense account spans all 3 DailyDles sites, so the
// pub-id matches OWdle's. Matching ads.txt line lives in public/ads.txt:
//   google.com, pub-2123726970271006, DIRECT, f08c47fec0942fa0
// Typed `string` (not the literal) so `ADSENSE_CLIENT !== ""` gating in
// lib/adUnits.ts stays a real runtime check, not a no-overlap TS error.
export const ADSENSE_CLIENT: string = "ca-pub-2123726970271006";
