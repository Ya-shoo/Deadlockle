#!/usr/bin/env node
// Bulk uploader for the static-asset directories that live in R2.
// Walks public/{voicelines,banners,portraits,splash,abilities,items,
// mugshots} (or whichever subset is passed on the CLI) and uploads each
// file via `wrangler r2 object put` against the dailydles bucket.
// Before uploading, HEADs the public pub URL and skips files already
// present at the matching byte size — so re-runs across machines are
// cheap and only push the delta.
//
// Usage:
//   node scripts/upload-to-r2.mjs              # all default directories
//   node scripts/upload-to-r2.mjs voicelines   # one directory
//   node scripts/upload-to-r2.mjs voicelines banners # subset
//   node scripts/upload-to-r2.mjs --force      # re-upload even if present
//
// Concurrency is bounded with a tiny pool — wrangler spawns its own Node
// per call, so the bottleneck is process startup at low parallelism and
// R2 bandwidth at high parallelism. 16 parallel workers strikes a balance
// on residential upstream without nicheing into rate limits.
//
// Bucket is shared with OWdle; Deadlockle's key prefixes (voicelines/<hero>,
// banners/heroes, portraits, splash, abilities, items, mugshots) are
// disjoint from OWdle's (voicelines/quote, banners/{key-art,maps},
// skins, sounds) — no key collisions.

import { readdir, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { CDN_BASE } from "./_cdn.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const BUCKET = "dailydles";
const DEFAULT_DIRS = [
  "voicelines",
  "banners",
  "portraits",
  "splash",
  "abilities",
  "items",
  "mugshots",
];
const CONCURRENCY = Number(process.env.R2_UPLOAD_CONCURRENCY ?? 16);
const HEAD_CONCURRENCY = Number(process.env.R2_HEAD_CONCURRENCY ?? 32);

const flags = process.argv.slice(2).filter((a) => a.startsWith("--"));
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const FORCE = flags.includes("--force");
const dirs = args.length > 0 ? args : DEFAULT_DIRS;

async function walk(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const p = resolve(root, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.isFile() && !e.name.startsWith(".")) out.push(p);
  }
  return out;
}

// Pick a content-type from the filename. Wrangler defaults to
// application/octet-stream, which makes browsers download instead of
// playing/displaying. Limited to extensions we actually ship; falls back
// to octet-stream for anything else.
const MIME = {
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  ogg: "audio/ogg",
  webm: "video/webm",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  json: "application/json",
};
function mimeFor(name) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return MIME[ext] ?? "application/octet-stream";
}

function runWrangler(args, options = {}) {
  return new Promise((res, rej) => {
    const proc = spawn("npx", ["wrangler", ...args], {
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("exit", (code) => {
      if (code === 0) res({ stdout, stderr });
      else rej(new Error(`wrangler exit ${code}: ${stderr || stdout}`));
    });
    proc.on("error", rej);
  });
}

// HEAD probe against the public pub URL — returns the Content-Length of
// the existing object, or null if it 404s. Cheaper than re-uploading
// when re-running across machines that share the same bucket.
async function r2Size(key) {
  const url = `${CDN_BASE}/${encodeURI(key)}`;
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const len = res.headers.get("content-length");
    return len == null ? null : Number(len);
  } catch {
    return null;
  }
}

async function uploadOne(localPath, key) {
  const mime = mimeFor(key);
  // Transient DNS / TLS / API timeouts happen often enough on residential
  // links that a single attempt would dribble out failures across a large
  // run. Three tries with exponential backoff catches almost everything
  // without slowing down the happy path.
  const maxAttempts = 3;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await runWrangler([
        "r2",
        "object",
        "put",
        `${BUCKET}/${key}`,
        `--file=${localPath}`,
        `--content-type=${mime}`,
        "--remote",
      ]);
      return;
    } catch (e) {
      lastErr = e;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
      }
    }
  }
  throw lastErr;
}

async function pool(items, worker) {
  const queue = items.slice();
  let done = 0;
  let failed = 0;
  const start = Date.now();
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (!item) break;
      try {
        await worker(item);
        done++;
      } catch (e) {
        failed++;
        process.stderr.write(`\n  ✗ ${item.key} — ${e.message}\n`);
      }
      const total = items.length;
      const pct = ((done + failed) / total) * 100;
      const elapsed = (Date.now() - start) / 1000;
      const rate = (done + failed) / Math.max(elapsed, 0.001);
      const eta =
        rate > 0 ? Math.round((total - done - failed) / rate) : null;
      process.stdout.write(
        `\r  ${done + failed}/${total} (${pct.toFixed(1)}%) · ${rate.toFixed(1)}/s` +
          (eta != null ? ` · eta ${eta}s` : "") +
          (failed > 0 ? ` · ${failed} failed` : ""),
      );
    }
  });
  await Promise.all(workers);
  process.stdout.write("\n");
  return { done, failed };
}

async function main() {
  for (const dir of dirs) {
    const root = resolve(REPO_ROOT, "public", dir);
    let files;
    try {
      files = await walk(root);
    } catch (e) {
      if (e.code === "ENOENT") {
        console.log(`\n${dir}: SKIP — not found locally (${root})`);
        continue;
      }
      throw e;
    }
    if (files.length === 0) {
      console.log(`\n${dir}: empty`);
      continue;
    }
    let totalBytes = 0;
    const items = await Promise.all(
      files.map(async (f) => {
        const s = await stat(f);
        totalBytes += s.size;
        return {
          local: f,
          key: `${dir}/${relative(root, f).replace(/\\/g, "/")}`,
          size: s.size,
        };
      }),
    );
    const mb = (totalBytes / 1024 / 1024).toFixed(1);
    console.log(`\n${dir}: ${items.length} files, ${mb} MB`);

    let toUpload = items;
    if (!FORCE) {
      process.stdout.write(`  probing R2 for existing objects...\n`);
      const probed = await probePool(items, async (item) => {
        const remoteSize = await r2Size(item.key);
        item.remoteSize = remoteSize;
        return item;
      });
      toUpload = probed.filter(
        (i) => i.remoteSize == null || i.remoteSize !== i.size,
      );
      const skipped = probed.length - toUpload.length;
      const skippedMb = (
        probed
          .filter((i) => !toUpload.includes(i))
          .reduce((a, i) => a + i.size, 0) /
        1024 /
        1024
      ).toFixed(1);
      const newMb = (
        toUpload.reduce((a, i) => a + i.size, 0) /
        1024 /
        1024
      ).toFixed(1);
      console.log(
        `  ${skipped} already on R2 (${skippedMb} MB skipped), ${toUpload.length} to upload (${newMb} MB)`,
      );
      if (toUpload.length === 0) {
        console.log(`  ${dir} done: nothing to upload`);
        continue;
      }
    }

    const { done, failed } = await pool(toUpload, ({ local, key }) =>
      uploadOne(local, key),
    );
    console.log(`  ${dir} done: ${done} uploaded, ${failed} failed`);
    if (failed > 0) process.exitCode = 1;
  }
}

// Lightweight probe pool — same shape as `pool` but with its own
// concurrency knob (HEAD is much cheaper than wrangler put, so a wider
// fan-out is fine) and a quieter progress line.
async function probePool(items, worker) {
  const queue = items.slice();
  let done = 0;
  const start = Date.now();
  const out = new Array(items.length);
  let writeIdx = 0;
  const workers = Array.from({ length: HEAD_CONCURRENCY }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (!item) break;
      const res = await worker(item);
      out[writeIdx++] = res;
      done++;
      const total = items.length;
      const pct = (done / total) * 100;
      const elapsed = (Date.now() - start) / 1000;
      const rate = done / Math.max(elapsed, 0.001);
      const eta = rate > 0 ? Math.round((total - done) / rate) : null;
      process.stdout.write(
        `\r  probe ${done}/${total} (${pct.toFixed(1)}%) · ${rate.toFixed(0)}/s` +
          (eta != null ? ` · eta ${eta}s` : ""),
      );
    }
  });
  await Promise.all(workers);
  process.stdout.write("\n");
  return out.filter(Boolean);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
