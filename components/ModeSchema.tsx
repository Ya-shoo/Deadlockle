// Per-mode JSON-LD (invisible to users; read by crawlers). Mirrors OWdle's
// lib/site.ts modeJsonLd: each game mode becomes its own WebApplication
// (GameApplication) node plus a BreadcrumbList, tied to the root #webapp /
// #website graph defined in app/layout.tsx. Gives crawlers a clean per-mode
// entity instead of leaving the mode pages with only the site-wide graph.
const SITE_URL = "https://deadlockle.com";
const SITE_NAME = "Deadlockle";

export function ModeSchema({
  slug,
  label,
  description,
}: {
  slug: string;
  label: string;
  description: string;
}) {
  const fullUrl = `${SITE_URL}/${slug}/`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": `${fullUrl}#mode`,
        name: `${SITE_NAME} ${label}`,
        url: fullUrl,
        description,
        applicationCategory: "GameApplication",
        genre: ["Puzzle", "Trivia", "Word Game"],
        operatingSystem: "Web",
        browserRequirements: "Requires JavaScript and HTML5.",
        inLanguage: "en",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        isPartOf: { "@id": `${SITE_URL}/#webapp` },
        about: {
          "@type": "VideoGame",
          name: "Deadlock",
          publisher: { "@type": "Organization", name: "Valve Corporation" },
          gamePlatform: "PC",
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${fullUrl}#breadcrumbs`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
          { "@type": "ListItem", position: 2, name: label, item: fullUrl },
        ],
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
      }}
    />
  );
}
