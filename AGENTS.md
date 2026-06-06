# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Media pipeline (R2)

Heavy assets — `public/voicelines/<hero>/`, `public/voicelines/conversations/`, `public/banners/heroes/`, `public/portraits/`, `public/splash/`, `public/abilities/`, `public/items/`, `public/mugshots/`, `public/ranks/` — live in Cloudflare R2, served via the custom domain `media.deadlockle.com`. They are **not in the git repo** (gitignored). Data files in `data/` (voicelines.json, sound-conversations.json, banners.json, heroes.json, items.json) keep RELATIVE paths like `/voicelines/infernus/select-01.mp3` — never bake the R2 hostname into stored data.

The R2 bucket `dailydles` is shared with OWdle. The two projects use disjoint key prefixes so they don't collide. OWdle owns `voicelines/quote/`, `banners/{key-art,maps}/`, `skins/`, `sounds/`; Deadlockle owns everything else, including `ranks/` (OWdle's rank art ships git-tracked via Pages, not R2 — the prefix is Deadlockle's alone).

URL resolution at the rendering boundary:

```ts
import { media } from "@/lib/media";
// <img src={media(hero.portrait_url)} />
// <audio src={media(audioUrl)} />
// new Audio(media(audioUrl))
```

In production builds `lib/media.ts` resolves the relative path against `https://media.deadlockle.com` (default fallback). In dev it falls through to a relative URL served from local `public/` if those files exist.

The build pipeline keeps R2 media out of the Pages deploy by staging the eight R2-bound dirs to `.staged-media/` during `next build`, then restoring. The wrapper script is `scripts/build-for-deploy.mjs` and `npm run build:deploy` calls it. The full `npm run deploy:live` chains `sync-to-r2 → build:deploy → wrangler pages deploy → git push`.

To upload new media to R2: `npm run sync-to-r2`. Reads `~/.wrangler/config/default.toml` (or platform equivalent) for the OAuth token, walks the eight R2-bound dirs, HEAD-checks each key against R2 to skip already-uploaded files, then PUTs the rest at 8× concurrency.

# Mac vs PC dev split

Yash develops Deadlockle on a Mac and Windows. Both machines can edit and deploy. The R2 bucket is the canonical store; local `public/` dirs are working state.

For Mac dev to work after a fresh clone, the Mac needs:

1. **Wrangler authenticated**: `npx wrangler login` once.
2. **`.env.local` at the repo root** (gitignored) with:
   ```
   NEXT_PUBLIC_MEDIA_BASE=https://media.deadlockle.com
   ```
   Without this, `next dev` on Mac falls through to relative `/voicelines/...` URLs and can't serve them locally (there are no files in `public/voicelines`). Setting the env var routes dev fetches at R2.

3. **No need to download media locally**. The Mac can run the full app against R2.

# Share-card system (/r/ links)

Link-first sharing, ported from OWdle (its repo at `../OWdle` is the canonical
reference — keep the two implementations in lockstep when fixing bugs in
either). Round results and the daily summary share via `/r/[code]` links that
unfurl into server-rendered 960×960 spray-style cards.

- `lib/shareUrl.ts` — code encode/decode. Daily `<YYMMDD>-<5 slots>-<hints><hard>`
  (slots lockstep with BUILT_MODE_SLUGS order), round `<YYMMDD><letter><result>[modifier]`
  with letters `c/a/m/s/i` (`q` reserved, archived Quote). Classic's modifier is
  hints; Mugshot's is the hard-mode flag. This file is bundled into Pages
  Functions: keep it free of app imports and of anything touching `process`
  (type-only import from lib/modes.ts — its IS_DEV_BUILD reads process.env).
- `functions/r/[code].ts` — unfurl HTML shell (meta-refresh to `/{mode}/?c=`),
  `functions/og/r/[code].tsx` — workers-og card renderer. The renderer's
  hardening (errors never cache, buffered render, headers set
  post-construction, bounded image cache) each guard a shipped incident —
  do not simplify away.
- **Fonts are self-hosted subsets** (`public/og-fonts/*.ttf`, fetched
  same-origin with per-isolate memoization). Launch night (2026-06-05),
  per-render Google Fonts fetches from the edge failed ~50% of the time and
  503'd cold cards; same-origin statics never flake. The glyph coverage is
  pinned in `scripts/fetch-og-fonts.mjs` — if a card ever renders a NEW glyph,
  add it to that script's SUBSET and re-run it, or it draws as tofu.
- The share announcement modal embeds a PRE-BAKED card
  (`public/announce-example.png`) rather than hitting the OG worker.
  Regenerate after card-design changes:
  `curl -s http://localhost:8798/og/r/260606-32432-00 -o public/announce-example.png`
- `components/ShareButton.tsx` / `ShareModal.tsx` — native share on touch
  devices (bare URL, no file attach), Copy-link modal on desktop, prefetch on
  result-mount. `lib/useShareLinkVisit.ts` reports inbound `?c=` visits.
- PostHog event/prop names (`share_clicked`, `share_link_visited`,
  `share_announce`) are OWdle-IDENTICAL — shared DailyDles dashboards span both
  sites, `$host` separates them. Never rename on one side only.
- Mugshot hard mode: persisted as a one-way latch in ModeState (`hardMode`),
  written at each guess — a guess submitted with the toggle off drops the badge
  for the round; toggling to peek between guesses doesn't. Item mode's hard
  mode (rotation) is NOT encoded (decided at port time; slot grammar has room).
- Card art: `public/og-spray-*.png`, git-tracked (NOT in the R2 dirs — same-origin
  fetch for the worker). The set is ONE asset — the Deadlock eye-wheel emblem —
  recolored per mode (classic amber `#d6a05c`, ability spirit-purple `#9d7fc7`,
  mugshot vitality-green `#7fb86c`, sound teal `#5ec5d4`, item weapon-orange
  `#e07a4f`, daily cream `#e8dcc0`). Regenerate any tint with
  `node scripts/tint-og-emblem.mjs scripts/og-emblem-master.png public/og-spray-<slug>.png "#hex"`
  (master is the SteamGridDB full-res emblem, downsampled to 1024²). The
  numeral tint twins live in MODE_NUMERAL inside functions/og/r/[code].tsx —
  keep both in sync when adding a mode. If sourcing NEW raster art ever again:
  re-encode to true PNG first (`sips -s format png`) — fandom CDNs serve WebP
  under .png URLs and Satori silently skips WebP.
- Dev: `scripts/og-dev-server.mjs` runs the functions on :8798 inside
  `npm run dev` (OWdle's stack owns :8799; both run simultaneously).
  `lib/shareLinks.ts` points previews at :8798 in dev — keep the ports in sync.
  Review every card variant at `/labeler/share-preview/`. After swapping a
  static asset, `touch` the functions source — the per-isolate data-URI cache
  survives asset-only changes.
