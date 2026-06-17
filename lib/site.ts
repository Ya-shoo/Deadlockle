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
