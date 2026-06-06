# Share-card system port (from OWdle)

Design doc for recreating OWdle's link-first share system on Deadlockle.
The OWdle implementation is the **canonical reference** — shipped, live,
and battle-tested (deployed 2026-06-05). Port it; don't redesign it.
OWdle repo: `../OWdle`. Read this whole doc before writing code — the
Gotchas section is a list of landmines that each cost a real debugging
loop.

## What the user gets (end state)

1. Finish any mode → result card shows a **Share** button.
   - Desktop: opens a slim modal — live preview of the share card, one
     **Copy link** button, a quiet **Download image**.
   - Mobile (touch devices): `navigator.share({ url })` — bare URL, no
     file attach — plus a small companion icon that opens the same
     modal.
2. The copied link is `https://deadlockle.com/r/<code>/` — a compact
   code encoding mode + result. Pasted in Discord/iMessage/X/Slack, it
   **unfurls into a server-rendered result card** (PNG from
   `/og/r/<code>`).
3. Cards are **spray-style chips**: flat dark rounded-corner card with
   true alpha outside the radius, a big piece of per-mode art as the
   centerpiece, stats band below. **Spoiler-free** — never the answer.
4. Complete all built modes → the daily summary card (same chip
   language, per-mode result pills).
5. Clicking a round link lands on that mode's page with `?c=<code>`
   (attribution + future "beat their score" hook); daily links land on
   home the same way.

## Locked product decisions — do NOT relitigate

These were grilled with Yash on OWdle and shipped. The reasoning
transfers wholesale:

- **Bare URL on the clipboard.** Not text+URL: iMessage only unfurls
  messages that are *just* a URL. The card carries the brag.
- **No clipboard image+link.** `ClipboardItem` multi-MIME is a dead
  end — paste targets pick exactly one flavor and silently drop the
  text. This is *why* the system is link-first.
- **No file attach in native share.** iOS targets that accept files
  drop the `url` member. URL-only.
- **Spoiler-free only.** No answer names, no answer art, no toggle.
  (OWdle built a full spoiler variant with server-side answer
  derivation and then deliberately deleted it. Do not resurrect.)
- **No X-intent button.** Pasting the link in X yields the same card.
- **Text-share blocks stay.** Deadlockle's existing emoji-grid text
  share (`lib/share.ts` → its TextShareBlock equivalent) remains
  *alongside* the new Share button, with its embedded URL upgraded to
  the personalized `/r/` link.
- Modal preview = **the actual `/og/r/` image** (never a client-side
  imitation; zero drift by construction). Download saves that same PNG.

## Architecture

```
result card mounts
  └─ ShareButton (prefetches the OG image → warms browser + edge)
      ├─ mobile: navigator.share({ url })
      └─ modal: <img src=/og/r/CODE> preview · Copy link · Download

paste link → unfurler fetches deadlockle.com/r/CODE/
  └─ functions/r/[code].ts   → minimal HTML: og:image + meta-refresh
        ├─ bot UA? → share_link_unfurled (SERVER-side PostHog, fire-and-
        │   forget via ctx.waitUntil — unfurlers never run JS, so this
        │   middle funnel beat is only observable here)
        og:image → functions/og/r/[code].tsx (workers-og / Satori)
        redirect → /{mode}/?c=CODE  (daily: /?c=CODE)

landing page → useShareLinkVisit(mode) → share_link_visited event,
  strips ?c= so reloads don't double-count
```

The full measured funnel: `share_clicked` (sharer, client) →
`share_link_unfurled` (paste, server, platform-classified) →
`share_link_visited` (recipient, client).

Everything is a Cloudflare Pages Function (this repo already has
`functions/`); the OG renderer is Satori via **workers-og** (add to
deps: `npm i workers-og` — OWdle pins `0.0.27`).

## Reference implementation map (OWdle paths)

Copy-adapt these, in this order:

| OWdle file | Role | Port notes |
|---|---|---|
| `lib/shareUrl.ts` | code encode/decode (daily + round) | adapt mode letters + slot count (below) |
| `lib/shareLinks.ts` | URL pair builder, dev OG origin, `ogPreviewSrc` dev cache-buster | change port (below) |
| `functions/r/[code].ts` | unfurl HTML shell + redirects | swap site name/origin, mode labels |
| `functions/og/r/[code].tsx` | the card renderer (daily + round) + hardening | swap labels/sprays/CTA copy; keep ALL hardening |
| `components/ShareButton.tsx` | button + native path + prefetch + companion icon | near-verbatim |
| `components/ShareModal.tsx` | slim modal | near-verbatim |
| `lib/useShareLinkVisit.ts` | inbound attribution hook | verbatim |
| `functions/_lib/posthog.ts` | `captureServerEvent` — fire-and-forget server capture (anonymous `distinct_id`, `$process_person_profile: false`, direct `us.i.posthog.com`, public `phc_` key inline — same shared-project key) | near-verbatim; make sure the `site` prop says `deadlockle` (the client registers it as a super-prop; server events must set it explicitly) |
| `functions/r/[code].ts` → `unfurlPlatform()` + `captureUnfurl()` | UA→platform classifier (discord/imessage/slack/twitter/…/search_crawler/other_bot; humans return null — they're counted client-side, capturing both would double-count) + `share_link_unfurled` emit; localhost logs instead of sending | verbatim — the UA matching encodes ordering traps (e.g. iMessage's `facebot twitterbot` combo must match before twitter/facebook) |
| `lib/tracking.ts` (additions) | `share_clicked` methods, `share_link_visited`, `share_announce` | **keep event/prop names IDENTICAL** — both sites share one PostHog project and dashboards span them |
| `scripts/og-dev-server.mjs` | wrangler-pages-dev helper for `npm run dev` | change port (below) |
| `components/ShareAnnounceModal.tsx` | optional one-time release popup | optional; new expiry date + new localStorage key (`deadlockle.announce.shareLinks`) |

Game-component wiring pattern (see any OWdle `*Game.tsx`):
`{...roundShareLinks({ day, slug, outcome, guesses, hints })}` spread
onto ShareButton, plus `useShareLinkVisit("<mode>")` at component top.
Daily surface: see OWdle `DailyCompleteResultCard.tsx` / `HomeContent`.

## Code format (adapt, same grammar)

```
DAILY: <YYMMDD>-<one base36 char per built mode>-<hints><skips>
ROUND: <YYMMDD><mode letter><result char>[modifier char]
```
- Result char: base36 guess count for a win, `z` = missed (a loss
  encodes NO count — cards must not show a number on losses).
- Modifier char: omitted when 0; meaning is mode-determined.
- Decoder tries daily shape first (dashes), then round (dash-free);
  mode letter decodes case-insensitively; garbage → 404/400.

Deadlockle specifics to resolve at port time (verify against
`lib/modes.ts` — don't trust this doc over the code):
- **Mode letters** (proposal): `c` classic, `a` ability, `m` mugshot,
  `s` sound (Conversation), `i` item; reserve `q` (quote is archived —
  check whether it's still in `BUILT_MODE_SLUGS`; the daily code's slot
  list is **lockstep with BUILT_MODE_SLUGS order**, so its exact
  contents define the daily format from day one).
- **Modifiers**: classic has hints (`hintsUsed` exists in share.ts).
  Audit each mode for a skip/hint analogue; modes without one encode
  nothing.
- **Item mode** answers an item, not a hero — irrelevant to the card
  (spoiler-free), but the share text builder takes different fields.

## Cards (visual spec)

Mirror the OWdle renderer (`functions/og/r/[code].tsx`, post-`a9b2c7d`):

- 960×960 PNG. Flat `#0a0e14`-family base (use Deadlockle's brand
  dark), `borderRadius: 100`, `overflow: hidden`, **no background
  behind the root** → corners are true alpha (verify alpha=0 at all
  four corners; OWdle has a checker script pattern, see Verification).
  No gradient washes.
- Header: wordmark left (Deadlockle brand mark/type), `deadlockle.com`
  + numeric date (`M/D/YYYY`) stacked top-right.
- Centerpiece: per-mode art image (~600px), out-of-flow, centered, its
  base clipped behind the stats band.
- Round stats band (no backing fill): eyebrow `✓ SOLVED` / `✕ MISSED`
  (green `#4ade80` / red `#ef4444`, glyphs as inline SVG — see
  Gotchas); headline row = MODE name big (Bricolage-equivalent 800,
  ~84px — use Deadlockle's display font) left + `N guesses` right
  (label vertically centered on the numeral, NOT baseline-hung); tally
  (`2 HINTS`) tucked right-under the count in an accent color; centered
  CTA `CAN YOU BEAT IT?` / `CAN YOU SOLVE IT?` (mono, tracked —
  remember the optical-centering padding, see Gotchas).
- Daily card: same chip + header; centerpiece art; `✓ DAILY COMPLETE
  n/n` line (green sweep / amber otherwise); big total-guesses row with
  flanking tallies (`1 missed · 2 hints` left, `1 skip` right,
  single-tally promotes right); content-hugging per-mode result pills
  (name + count ~18px apart — never `space-between` in a fixed-width
  chip), centered rows of 3+2 (adjust to built-mode count).
- Fonts: load via `loadGoogleFont` per render with a subset string;
  match Deadlockle's site fonts. OWdle uses Bricolage Grotesque 800/500
  + IBM Plex Mono 500 (+ Saira Condensed on the daily card).

### Centerpiece art

Yash picks the art — **do not choose without him**. He'll supply one
image per mode + one for the daily (OWdle used official Overwatch wiki
sprays; the Deadlock equivalent is his call). Requirements + pipeline:
- ~512², transparency, character/charm over text-heavy.
- **Re-encode everything to true PNG before shipping**: wiki/fandom
  CDNs serve WebP from `.png` URLs and Satori silently skips WebP
  (renders an invisible image, no error). `sips -s format png in.png
  --out out.png`, then verify the magic bytes are `89 50 4E 47`.
- Discord CDN links expire — download immediately, commit the file.
- Ship as `public/og-spray-<slug>.png` + `og-spray-daily.png`
  (git-tracked → same-origin fetch for the worker; check they aren't
  caught by this repo's R2-sync dir list in `scripts/sync-to-r2.mjs`).

## Hardening (non-negotiable — each guards a shipped incident)

1. **Errors must never cache.** Wrap the whole handler; any failure →
   `503` + `cache-control: no-store` + `retry-after`. (A transient
   cold-isolate failure once got edge-cached under the canonical URL
   and served a dead unfurl until expiry.)
2. **Buffer the render** (`await img.arrayBuffer()` → new Response)
   before attaching cache headers — a mid-stream Satori throw must not
   leak a truncated-but-cacheable 200.
3. **Retry font fetches once** (`loadGoogleFont(...).catch(() =>
   loadGoogleFont(...))`).
4. **Set headers post-construction** (`res.headers.set(...)`), never
   via ImageResponse options — workers-og *appends* caller headers to
   its own cache defaults (names differ only by case) producing a
   contradictory combo.
5. **Cache policy**: prod `public, max-age=86400, s-maxage=86400,
   immutable` (deterministic code → deterministic bytes); localhost →
   `no-store`. Also set `access-control-allow-origin: *` (the modal's
   Download fetches the PNG as a blob).
6. Image loads in the worker: data-URI cache per isolate (bounded Map),
   failures return null without caching, card degrades gracefully
   (render without the art rather than failing).

## Satori/workers-og gotchas (every one cost OWdle a debugging loop)

- **`&` in the font subset string silently truncates everything after
  it** (`loadGoogleFont` ships it as a raw `text=` URL param). Keep `&`
  out; put `—` (em dash, used for lost-mode counts) BEFORE any risky
  char; include BOTH cases of every letter you render (textTransform
  doesn't affect subsetting).
- **✓ / ✕ / arbitrary glyphs**: draw as inline SVG paths, not text —
  the loaded fonts don't ship them; text falls back to tofu.
- **Absolute children position from the BORDER box** (browsers: padding
  box). Never put a border on a container that has positioned or
  full-bleed children — draw frames/rings as stacked overlay siblings.
- **`transform: undefined` hard-crashes the render mid-stream.** Use a
  conditional spread, never a ternary-to-undefined style value.
- **Transforms on baseline-aligned flex members drag the row's shared
  baseline** — per-element optical nudges move their siblings. Use
  `alignItems: "center"` rows + per-band nudges instead.
- **Satori's vertical-centering bias ≠ the browser's.** Don't copy
  client-card nudge values; measure on actual output. OWdle's approach:
  a dependency-free Node PNG decoder that locates an element's pixel
  band vs its container and prints the delta (pattern lives in this
  session's history as `/tmp/measure-pill.mjs`; ~120 lines — rebuild it
  if needed: IHDR/IDAT + `zlib.inflateSync` + per-scanline unfilter,
  then color-classify columns).
- **Tracked (letter-spaced) centered text sits ~one tracking-unit left
  of true center** (trailing space). Compensate with `paddingLeft`
  equal to one tracking unit.
- Every div with multiple children needs explicit `display: "flex"`.
- No CSS grid, no clip-path — diagonals/shapes as inline SVG polygons.

## Client-side details that matter

- `prefersNativeShare()`: touch-capability + UA gate (copy verbatim —
  it encodes iPad-vs-Mac edge cases).
- **Prefetch on result-mount** (800ms delay, `saveData` respected,
  session-dedup Set): makes the modal instant AND pre-warms the edge
  for recipients.
- **Dev cache-buster**: modal/prefetch URLs get `?v=dev` in dev via a
  shared `ogPreviewSrc()` — both must use it so cache keys match.
- Modal: per-src load/error bookkeeping, 8s stall guard → "Preview
  unavailable — the link still unfurls when pasted" (never pin
  "Rendering…" forever); placeholder chrome only while loading (a
  visible box behind transparent chip corners looks broken); unmount
  the `<img>` on error (broken-image glyph bleeds through).
- React-compiler lint rules are enforced: no `Date.now()`/impure calls
  in render (module-scope consts are fine), no sync setState in
  effects — use `useSyncExternalStore` snapshots for
  localStorage/capability reads (see ShareButton + ShareAnnounceModal
  for the patterns).

## Dev workflow

1. Add `scripts/og-dev-server.mjs` (port **8798** — OWdle owns 8799 and
   both stacks run simultaneously; remember Deadlockle's next dev is
   `-p 3001`). Wire into the `dev` concurrently line; survive missing
   `out/` (mkdir) and a dead wrangler without killing the stack.
   `lib/shareLinks.ts` dev origin → `http://localhost:8798`.
2. Iterate by URL: `curl localhost:8798/og/r/<code>` → view the PNG.
   Render EVERY variant: each mode win, a loss, with/without modifiers,
   1-guess singular, the daily sweep AND a miss-day (the em-dash bug
   only renders on miss days), long-vs-short mode labels.
3. After swapping a static asset, `touch` the functions source —
   wrangler reloads the isolate; the in-memory data-URI cache survives
   asset-only changes.
4. Verify corner alpha programmatically (alpha=0 at 4 corners, 255 at
   edge midpoints).
5. Real unfurls only work post-deploy. Discord caches embeds per-URL —
   if a paste looks dead, append `?x=1` to re-scrape before assuming a
   server bug (and remember pre-deploy pastes poison their exact URL
   for a while).

## Verification checklist (before asking Yash to deploy)

- [ ] `npx tsc --noEmit` + eslint clean (new files; repo has
      pre-existing warnings — don't add to them)
- [ ] `npm run build` passes
- [ ] All card variants rendered + eyeballed (see matrix above)
- [ ] Corner alpha check passes on round + daily
- [ ] `/r/<code>` HTML: title, og:image absolute URL, 960 dims,
      twitter:card, meta-refresh to `/{mode}/?c=` (trailing slash —
      this repo also uses `trailingSlash`)
- [ ] Old/garbage codes → 404; daily codes decode; case-insensitive
- [ ] Functions bundle size sane (`npx wrangler pages functions build
      --outdir /tmp/x` + gzip — OWdle sits ~730KB compressed; 1MB is
      the free-plan ceiling)
- [ ] PostHog events fire with the OWdle-identical names/props
      (`share_clicked`, `share_link_unfurled` — test with `curl -A
      Discordbot` against the dev /r/ route and look for the localhost
      log line — and `share_link_visited`); server events carry
      `site: deadlockle`
- [ ] **Deploy needs Yash's express consent** (his rule: verify in dev
      first; "deploy" = deploy + commit + push, this repo's
      `deploy:live` does all three)

## Explicit non-goals

- Spoiler/answer-revealing variant (deliberately killed on OWdle).
- Art rotation (future ask — day-seeded hash when it comes).
- Streak-rank-style client-captured cards (OWdle keeps
  `modern-screenshot` only for a legacy no-OG surface; Deadlockle
  should not need it at all — skip the dependency unless a surface
  truly has no OG image).
- Map backdrops / photographic cards / client-capture clipboard flows —
  all explored and rejected on OWdle.
