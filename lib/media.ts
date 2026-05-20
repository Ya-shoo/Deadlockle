// Resolves a media URL to its serving origin.
//
// In production the heavy assets (hero voicelines, conversation audio,
// portraits, splash, banners, abilities, items, mugshots) live in the
// shared `dailydles` Cloudflare R2 bucket and are served via the
// custom domain `media.deadlockle.com` (the bucket is shared with
// OWdle, which uses `media.playowdle.com`; the two domains both bind
// to the same bucket but the disjoint key prefixes keep the projects
// isolated). In local dev the env var is unset and the helper falls
// through to the relative path — Next.js then serves straight from
// the local `public/` directory.
//
// Data files in `data/*.json` keep relative paths (e.g.
// `/voicelines/infernus/select-01.mp3`). The helper is applied at
// render time at each `<img>` / `<audio>` / `<video>` boundary, so:
//
//   • the on-disk JSON stays portable (no hard-coded R2 hostname)
//   • flipping between local files and R2 is a single env-var change

// Production fallback. The repo deploys to Cloudflare Pages with media
// served from R2 at media.deadlockle.com — if no explicit
// NEXT_PUBLIC_MEDIA_BASE is set at build time, production builds still
// resolve to the canonical R2 origin. Dev builds keep falling through
// to relative paths (served from `public/` by next-dev).
const PROD_DEFAULT = "https://media.deadlockle.com";

function resolveBase(): string {
  if (typeof process === "undefined") return "";
  const explicit = process.env.NEXT_PUBLIC_MEDIA_BASE;
  if (explicit) return explicit;
  if (process.env.NODE_ENV === "production") return PROD_DEFAULT;
  return "";
}

const MEDIA_BASE = resolveBase();

const TRIMMED_BASE = MEDIA_BASE.endsWith("/")
  ? MEDIA_BASE.slice(0, -1)
  : MEDIA_BASE;

export function media(path: string | null | undefined): string {
  if (!path) return "";
  // Pass through anything that already has a scheme. http(s) for
  // external assets, blob: for File-drop object URLs, data: for
  // inline payloads.
  if (
    /^https?:\/\//i.test(path) ||
    path.startsWith("blob:") ||
    path.startsWith("data:")
  ) {
    return path;
  }
  // No base configured — serve from same origin (local dev / pre-R2).
  if (!TRIMMED_BASE) return path;
  const sep = path.startsWith("/") ? "" : "/";
  return TRIMMED_BASE + sep + path;
}

export const MEDIA_IS_REMOTE = TRIMMED_BASE !== "";
export const MEDIA_BASE_RAW = TRIMMED_BASE;
