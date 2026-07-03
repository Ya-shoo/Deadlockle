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
// AdSense asks you to add to <head>. One AdSense account spans all 3 DailyDles
// sites, so the pub-id matches OWdle's. Matching ads.txt line lives in
// public/ads.txt:
//   google.com, pub-2123726970271006, DIRECT, f08c47fec0942fa0
// Typed `string` (not the literal) so `ADSENSE_CLIENT !== ""` gating in
// lib/adUnits.ts stays a real runtime check, not a no-overlap TS error.
export const ADSENSE_CLIENT: string = "ca-pub-2123726970271006";

// Approval gate — the master switch for whether real ad UNITS may render.
// MUST stay false until AdSense actually approves the site to serve ads.
//
// Why this exists: setting ADSENSE_CLIENT (loader) + a slotId per unit is NOT
// enough to safely go live. During the review window Google has nothing
// approved to serve, so every <ins> reserves its box and paints an empty white
// frame; the collapse-on-unfilled net in AdSlot.tsx only clears it if Google
// cleanly reports data-ad-status="unfilled", which it does NOT do reliably
// pre-approval (requests hang, or blanks come back stamped "filled") — leaving
// stuck empty rails/anchor on the live page. So slotIds alone must never arm a
// unit.
//
// The loader script (GoogleAdsense.tsx) is gated on ADSENSE_CLIENT ONLY, not on
// this flag, so it keeps shipping for the review crawler while every unit stays
// dark. On approval: flip this to true and redeploy — rails + anchor light up,
// nothing else changes.
//
// Typed `boolean` (not the `false` literal) for the same reason ADSENSE_CLIENT
// is typed `string`: it keeps ADSENSE_ENABLED a real boolean so the gated
// branches don't narrow to dead code, and flipping to true stays a clean edit.
// Ships in lockstep with OWdle (the canonical source).
export const ADSENSE_APPROVED: boolean = false;
