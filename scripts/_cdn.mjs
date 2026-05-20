// Single source of truth for the public R2 URL all build scripts emit
// into data manifests. Bucket: "dailydles" in account
// 39d218945b878ada3713713946146c08 — shared with OWdle (Overwatch quiz);
// the two projects use disjoint key prefixes so they don't collide.
// Big static assets (voicelines, banners, portraits, splash, abilities,
// items, mugshots) live there.
//
// CDN_BASE is fixed rather than env-driven so build output is
// reproducible from a clean checkout — no developer needs to remember to
// set an env var before regenerating a manifest. Change here when the
// bucket or pub URL changes; commit alongside re-emitted manifests.

export const CDN_BASE = "https://pub-12c86ce9cfb04c0e8fdd49b26ef4daaa.r2.dev";

// Helper for "join base with a leading-slash path" with a guard against
// accidentally double-prefixing if the path is already an absolute URL.
export function cdn(path) {
  if (/^https?:\/\//i.test(path)) return path;
  if (!path.startsWith("/")) return `${CDN_BASE}/${path}`;
  return `${CDN_BASE}${path}`;
}
