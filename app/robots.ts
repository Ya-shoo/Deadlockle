import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The /archive/ HUB stays crawlable (real landing page, in the
      // sitemap). Only the per-mode replay routes beneath it are blocked —
      // they're client-only game surfaces that serve a crawler an empty
      // shell. Add each new /archive/<mode>/ here as it ships; never
      // disallow the bare "/archive/" prefix (it would re-block the hub).
      disallow: ["/archive/classic/", "/archive/mugshot/", "/archive/sound/"],
    },
    sitemap: "https://deadlockle.com/sitemap.xml",
    host: "https://deadlockle.com",
  };
}
