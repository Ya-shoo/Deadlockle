# Media pipeline (R2) & Mac↔PC dev setup

> Deep dive referenced from `AGENTS.md`. Read when touching media assets, `lib/media.ts`, the sync/deploy scripts, or setting up a fresh clone. The general cross-site pipeline + the full shared-bucket prefix registry live in the `dailydles` skill; this file is Deadlockle's specifics.

## Media pipeline (R2)

Heavy assets — `public/voicelines/<hero>/`, `public/voicelines/conversations/`, `public/banners/heroes/`, `public/portraits/`, `public/splash/`, `public/abilities/`, `public/items/`, `public/mugshots/`, `public/ranks/` — live in Cloudflare R2, served via the custom domain `media.deadlockle.com`. They are **not in the git repo** (gitignored). Data files in `data/` (voicelines.json, sound-conversations.json, banners.json, heroes.json, items.json) keep RELATIVE paths like `/voicelines/infernus/select-01.mp3` — never bake the R2 hostname into stored data.

The R2 bucket `dailydles` is shared with OWdle. The two projects use disjoint key prefixes so they don't collide. OWdle owns `voicelines/quote/`, `banners/{key-art,maps}/`, `skins/`, `sounds/`; Deadlockle owns everything else, including `ranks/` (OWdle's rank art ships git-tracked via Pages, not R2 — the prefix is Deadlockle's alone). See the `dailydles` skill for the full three-site prefix registry.

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

## Mac vs PC dev split

Yash develops Deadlockle on a Mac and Windows. Both machines can edit and deploy. The R2 bucket is the canonical store; local `public/` dirs are working state.

For Mac dev to work after a fresh clone, the Mac needs:

1. **Wrangler authenticated**: `npx wrangler login` once.
2. **`.env.local` at the repo root** (gitignored) with:
   ```
   NEXT_PUBLIC_MEDIA_BASE=https://media.deadlockle.com
   ```
   Without this, `next dev` on Mac falls through to relative `/voicelines/...` URLs and can't serve them locally (there are no files in `public/voicelines`). Setting the env var routes dev fetches at R2.
3. **No need to download media locally**. The Mac can run the full app against R2.
