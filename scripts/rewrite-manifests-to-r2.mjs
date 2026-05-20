#!/usr/bin/env node
// One-shot migration: walks the JSON data manifests and rewrites every
// path that points into the R2-hosted asset trees (voicelines, banners,
// portraits, splash, abilities, items, mugshots) to be absolute pub-URL
// references. Idempotent — running twice is a no-op because already-
// absolute URLs are left alone.
//
// After this runs, build scripts (which already prepend cdn() going
// forward) and the migrated manifests agree. Subsequent regenerations
// produce the same shape.

import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CDN_BASE } from "./_cdn.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

const MANIFESTS = [
  "data/voicelines.json",
  "data/banners.json",
  "data/heroes.json",
  "data/items.json",
  "data/sound-conversations.json",
];

// Only these roots move to R2. Other path prefixes (e.g., /kofi-avatar.jpg)
// stay public-hosted, so we leave them alone.
const R2_ROOTS = [
  "/voicelines/",
  "/banners/",
  "/portraits/",
  "/splash/",
  "/abilities/",
  "/items/",
  "/mugshots/",
];

function rewriteString(s) {
  if (typeof s !== "string") return s;
  if (s.startsWith(CDN_BASE)) return s;
  for (const root of R2_ROOTS) {
    if (s.startsWith(root)) return CDN_BASE + s;
  }
  return s;
}

// Recursive walk over arbitrary parsed JSON. Strings get rewritten in
// place; arrays/objects recurse. JSON has no cycles, so this is safe
// without a visited set.
function rewrite(node) {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) node[i] = rewrite(node[i]);
    return node;
  }
  if (node && typeof node === "object") {
    for (const k of Object.keys(node)) node[k] = rewrite(node[k]);
    return node;
  }
  return rewriteString(node);
}

let totalChanged = 0;
for (const rel of MANIFESTS) {
  const path = resolve(REPO_ROOT, rel);
  let raw;
  try {
    raw = await readFile(path, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") {
      console.log(`${rel}: SKIP (missing)`);
      continue;
    }
    throw e;
  }
  const before = raw;
  const parsed = JSON.parse(raw);
  rewrite(parsed);
  const next = JSON.stringify(parsed, null, 2) + "\n";
  if (next === before) {
    console.log(`${rel}: no changes`);
    continue;
  }
  await writeFile(path, next, "utf8");
  const beforeHits = (before.match(new RegExp(CDN_BASE, "g")) ?? []).length;
  const afterHits = (next.match(new RegExp(CDN_BASE, "g")) ?? []).length;
  const added = afterHits - beforeHits;
  totalChanged += added;
  console.log(`${rel}: rewrote ${added} URL${added === 1 ? "" : "s"}`);
}
console.log(`\nTotal URLs rewritten: ${totalChanged}`);
