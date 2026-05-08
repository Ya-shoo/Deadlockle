// One-shot generator for the site icon. Pulls Deadlock's official spoked-
// wheel mark (community-curated transparent PNG hosted on SteamGridDB),
// pads it onto a black square canvas, and writes:
//   - app/icon.png         (512×512, modern HD favicon via Next.js convention)
//   - app/apple-icon.png   (180×180, iOS home screen)
//   - app/favicon.ico      (multi-res 16/32/48 PNG-in-ICO for legacy Chrome / IE)
//
// Re-run only if the source logo changes or the canvas color shifts.

import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..", "app");

// Source: SteamGridDB community asset 147360 — the Deadlock wheel mark in
// the iconic mint-green disc treatment, ~3979×3966, transparent edges. The
// dark spokes blend into the black canvas so the green disc reads as the
// foreground shape with negative-space spokes — visually cleaner than the
// cream variant on dark chrome.
const SOURCE_URL =
  "https://cdn2.steamgriddb.com/logo/804a8294a8f33203683b3e6ed46fe092.png";

// Pure black canvas — matches favicon dock chrome on most platforms and
// makes the cream wheel pop without competing with the page bg.
const BG = "#000000";

// Master canvas size. Padding controls how much breathing room sits around
// the wheel — too tight and the spokes touch the tile edge; too loose and
// the icon reads as small at 16×16. 36px on 512 ≈ 86% fill, which keeps
// the wheel visually dominant in tab bars while leaving deco margins.
const MASTER_SIZE = 512;
const SQUARE_PADDING = 36;

async function fetchBuffer(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "deadlockle-favicon-builder" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// Render the master 512×512 mark: black canvas + the wheel logo centered
// with consistent margins on every side.
async function renderMaster() {
  const src = await fetchBuffer(SOURCE_URL);

  // The PNG ships with transparent edges but slight asymmetric whitespace
  // (rough hand-drawn outer ring isn't perfectly centered in the bbox).
  // Trim fully-transparent pixels first so the geometric center we
  // composite at lines up with the visual center of the wheel.
  const trimmed = await sharp(src).trim({ threshold: 1 }).png().toBuffer();

  // Resize-contain into the inner box defined by SQUARE_PADDING. `contain`
  // preserves aspect ratio and pads with transparency, so a near-square
  // logo still sits centered if the trimmed bbox isn't perfectly 1:1.
  const innerSize = MASTER_SIZE - SQUARE_PADDING * 2;
  const sized = await sharp(trimmed)
    .resize(innerSize, innerSize, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  // Composite onto the black master canvas, centered.
  return sharp({
    create: {
      width: MASTER_SIZE,
      height: MASTER_SIZE,
      channels: 4,
      background: BG,
    },
  })
    .composite([{ input: sized, gravity: "center" }])
    .png()
    .toBuffer();
}

// Multi-resolution PNG-in-ICO writer. ICO = 6-byte ICONDIR header +
// 16-byte ICONDIRENTRY per image + concatenated PNG payloads.
function buildIco(images /* [{size, buf}] */) {
  const count = images.length;
  const headerSize = 6 + count * 16;
  const dir = Buffer.alloc(headerSize);
  dir.writeUInt16LE(0, 0); // reserved
  dir.writeUInt16LE(1, 2); // type = ICO
  dir.writeUInt16LE(count, 4);

  let offset = headerSize;
  for (let i = 0; i < count; i++) {
    const { size, buf } = images[i];
    const entry = 6 + i * 16;
    // ICO uses 0 to denote 256. Anything >=256 becomes 0 in this byte.
    dir.writeUInt8(size >= 256 ? 0 : size, entry);
    dir.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    dir.writeUInt8(0, entry + 2); // colorCount (0 for true color)
    dir.writeUInt8(0, entry + 3); // reserved
    dir.writeUInt16LE(1, entry + 4); // color planes
    dir.writeUInt16LE(32, entry + 6); // bits per pixel
    dir.writeUInt32LE(buf.length, entry + 8);
    dir.writeUInt32LE(offset, entry + 12);
    offset += buf.length;
  }
  return Buffer.concat([dir, ...images.map((i) => i.buf)]);
}

async function main() {
  await mkdir(APP_DIR, { recursive: true });

  console.log("Rendering master 512×512 mark...");
  const master = await renderMaster();

  console.log("Writing app/icon.png (512×512)...");
  await writeFile(resolve(APP_DIR, "icon.png"), master);

  console.log("Writing app/apple-icon.png (180×180)...");
  const apple = await sharp(master).resize(180, 180).png().toBuffer();
  await writeFile(resolve(APP_DIR, "apple-icon.png"), apple);

  console.log("Building multi-res favicon.ico (16/32/48)...");
  const icoSizes = [16, 32, 48];
  const icoImages = await Promise.all(
    icoSizes.map(async (size) => ({
      size,
      buf: await sharp(master)
        .resize(size, size)
        .png({ compressionLevel: 9 })
        .toBuffer(),
    })),
  );
  await writeFile(resolve(APP_DIR, "favicon.ico"), buildIco(icoImages));

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
