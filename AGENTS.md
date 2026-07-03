# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Deadlockle — daily Deadlock guessing game (deadlockle.com)

One daily hero, guessed across several modes. **Next.js 16.2.4 / React 19**, static export (`output: "export"` → `out/`) deployed to **Cloudflare Pages**; dynamic bits are **Pages Functions** (`functions/`). Shared infra with the siblings: R2 bucket `dailydles`, D1 `owdle-votes`, one PostHog project. Dev runs on **:3001** (OWdle owns :3000).

Sibling repos (same architecture — keep shared machinery in lockstep): **`../OWdle` is the canonical reference** (this repo was ported from it); `../WuWadle` is the third site. **For anything cross-site — the shared engine model, the R2/D1/PostHog conventions, or procedures like "add a mode" / "update media" / "deploy" — use the `dailydles` skill.**

## Where things live
- `app/` — App Router routes: home + one dir per mode (`/classic`, `/ability`, `/mugshot`, `/sound`, `/item`) plus `/guides`, `/how-to-play`, `/privacy`, `robots.ts`, `sitemap.ts`. Dev hub `app/labeler/` redirects to OWdle's (`:3000/labeler/`).
- `components/` — ~50 components: the per-mode `*Game.tsx` engines, comboboxes (`HeroCombobox`/`ItemCombobox`), share stack (`ShareButton`/`ShareModal`/`ShareAnnounceModal`), `NextModeCTA`, `TryOWdleCard`, streak/greeter/ad UI.
- `lib/` — the game engine (see next section).
- `data/` — committed JSON: `heroes.json` (38), `items.json` (155), `sound-conversations.json` (408 exchanges), `voicelines.json`, `voiceprints.json` (build-time diarization fingerprints), `banners.json`. **Relative media paths only — never bake the R2 host into data.**
- `db/` — D1 schema + migrations (`owdle-votes`, shared; tables `votes`, `feedback` + greeter polls).
- `functions/` — Pages Functions: `og/r/[code].tsx` (OG render → R2 cache), `r/[code].ts` (unfurl shell), `ingest/[[path]].ts` (PostHog proxy), `api/*` (vote, feedback, greeter, stats, …).
- `scripts/` — data/build pipeline (`build-data`, `build-voicelines`, `build-conversation-audio` + `scripts/lib/{diarize,whisper-align}`, `sync-to-r2`, `build-for-deploy`, OG tooling) + `og-dev-server.mjs` (:8798).
- `public/` — Pages-served static (`og-spray-*.png`, `og-fonts/`, `ranks/`, `announce-example.png`, `ads.txt`). Heavy media dirs (voicelines, portraits, abilities, items, mugshots) are gitignored → R2 (see `docs/media-and-r2.md`).

## The engine — how a "mode" works
A mode is an entry in `ALL_MODES` (`lib/modes.ts`), typed `ModeDef {slug,label,blurb,built,devOnly?}`; `MODES` filters out `devOnly`; `BUILT_MODE_SLUGS` is the canonical play order + share-code slot order. Each mode has a thin server route `app/<slug>/page.tsx` (metadata + schema + `<XGame/>`); the client engine is `components/XGame.tsx`. It derives the **date-seeded** answer via `getXForDay(dayString())` in `lib/daily.ts` (FNV-1a seed, or the shuffle-bag in `lib/dailyBag.ts` after `BAG_CUTOVER_DAY = "2026-06-02"`), hydrates/persists `ModeState` via `lib/storage.ts` (key `deadlockle.<mode>.<day>`), scores guesses (Classic via `compareHero` in `lib/compare.ts`, 7 attributes), fires `lib/tracking.ts` events, and on completion renders `NextModeCTA` + `ShareButton`. Day rolls **2:15am America/Los_Angeles**.

Key engine files: `lib/modes.ts` · `lib/daily.ts` + `lib/dailyBag.ts` · `lib/storage.ts` (`ModeState` incl. `hardMode` latch + `ConversationState`) · `lib/compare.ts` · `lib/heroes.ts` / `lib/items.ts` · `lib/shareUrl.ts` · `lib/media.ts`.

## Modes
| mode | route | component | cap | hard mode |
|---|---|---|---|---|
| classic | `/classic` | `ClassicGame.tsx` | 10 (+2 hints) | — |
| ability | `/ability` | `AbilityGame.tsx` | 12 | — |
| mugshot | `/mugshot` | `MugshotGame.tsx` | 5 | grayscale latch — **encoded** in share code |
| sound (Conversation) | `/sound` | `SoundGame.tsx` | — | two-speaker (`ConversationState`), audio reveal |
| item | `/item` | `ItemGame.tsx` | 8 | icon rotation — **not** encoded |
| quote | `/quote` | `QuoteGame.tsx` | — | **archived** (`devOnly`; superseded by sound, letter `q` reserved) |

## Commands
- `npm run dev` — `concurrently`: `next dev -p 3001` + `og-dev-server.mjs` (:8798). `npm run dev:next` = Next alone.
- `npm run build` / `npm run build:deploy` — `build:deploy` (`scripts/build-for-deploy.mjs`) stages R2 media out of the Pages upload.
- `npm run deploy:live` — `sync-to-r2 → build:deploy → wrangler pages deploy --branch=main → git push`. ("deploy" = deploy + commit + push; confirm with Yash first.)
- `npm run sync-to-r2` — upload media to R2 (HEAD-diff, 8× concurrency).

## Deep dives — read only when working in these areas
- Media / R2 pipeline + Mac↔PC dev setup → `docs/media-and-r2.md`
- Share cards & the OG renderer (incident-hardened — do not simplify away) → `docs/share-cards.md`
- Cross-site architecture, registries & procedures → the **`dailydles` skill**

## Conventions
- Media URLs resolve at the render boundary — always `media(path)` from `lib/media.ts`, never a bare R2 host in stored data.
- PostHog event/prop names are **network-identical across all three sites** (`$host`/`site` splits them; here `"deadlockle"`). Never rename on one side only.
- Keep the ported/mirrored files in lockstep with OWdle: `lib/{shareUrl,streakRank,streakStats,dailyShareText,adblock,site,banners}.ts` and the share components. Bump `RENDER_REV` in `functions/og/r/[code].tsx` on any card-design change.
