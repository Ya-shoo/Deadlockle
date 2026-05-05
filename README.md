# Deadlockle

Daily Deadlock quiz. Sister site to [OWdle](https://owdle-c2k.pages.dev).

Six modes: Classic, Quote, Ability, Splash, Sound, Item.

## Stack

- Next.js 16 (static export)
- Tailwind v4
- Motion
- Cloudflare Pages

## Data

Hero & item data is fetched once via `scripts/build-data.mjs` from
[deadlock-api.com](https://deadlock-api.com) and committed to `data/`.
