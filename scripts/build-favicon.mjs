// One-shot generator for the site icon. Crops the "D" from Deadlock's
// official wordmark (deadlock.wiki/Special:FilePath/Deadlock_Logo.png),
// pads to square on the site's deep-teal canvas, and writes:
//   - app/icon.png         (512×512, modern HD favicon via Next.js convention)
//   - app/apple-icon.png   (180×180, iOS home screen)
//   - app/favicon.ico      (multi-res 16/32/48 PNG-in-ICO for legacy)
//
// Re-run only if the source logo changes or the canvas color shifts.

import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..", "app");

// Source: Deadlock's official wordmark on the wiki. Wordmark is at the
// bottom of the canvas; the spoked-wheel mark is at the top. We want the
// stencil "D" character only.
const SOURCE_URL = "https://deadlock.wiki/Special:FilePath/Deadlock_Logo.png";

// Site's deep-teal canvas. Matches --color-canvas in globals.css so the
// favicon blends with the page bg in tabbar previews.
const BG = "#0c1820";
const ACCENT_RGBA = { r: 0xd6, g: 0xa0, b: 0x5c, alpha: 0.55 }; // amber gold hairline

// D-letter crop in the source image (625×324). The wordmark runs roughly
// y=180–305 and the "D" is the leftmost ~80px. Box the D tightly enough
// that the next letter (E) doesn't bleed in; alpha-isolation + trim then
// auto-centers the glyph regardless of small errors.
const CROP = { left: 14, top: 182, width: 82, height: 122 };

// Pad the cropped D into a square canvas with this much padding around
// the glyph. Higher = more breathing room, smaller D in the final icon.
const SQUARE_PADDING = 28; // pixels at the master 512×512 size

async function fetchBuffer(url) {
  const res = await fetch(url, { headers: { "User-Agent": "deadlockle-favicon-builder" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// Render the master 512×512 mark: dark canvas + a thin amber hairline
// frame echoing the in-app deco trim + the white stencil D centered.
async function renderMaster() {
  const src = await fetchBuffer(SOURCE_URL);

  // 1. Crop the D from the source wordmark.
  const cropped = await sharp(src).extract(CROP).png().toBuffer();

  // 2. Source has a solid dark-gray bg (not transparent). Re-derive an
  // alpha channel from luminance so the D floats cleanly: bright pixels
  // become opaque white, dark pixels become transparent. Soft threshold
  // preserves the stencil's distressed edge anti-aliasing.
  const { data, info } = await sharp(cropped).removeAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const px = info.width * info.height;
  const rgba = Buffer.alloc(px * 4);
  for (let i = 0; i < px; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    // Soft ramp: pixels brighter than ~90/255 start contributing alpha,
    // saturating around ~190. Avoids both a halo and a clipped edge.
    const alpha = Math.max(0, Math.min(255, Math.round((lum - 90) * 2.6)));
    rgba[i * 4] = 255;
    rgba[i * 4 + 1] = 255;
    rgba[i * 4 + 2] = 255;
    rgba[i * 4 + 3] = alpha;
  }
  const isolated = await sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ threshold: 5 }) // drop fully-transparent border
    .png()
    .toBuffer();

  // 3. Resize the isolated D to fit inside the 512×512 canvas with padding.
  const target = 512 - SQUARE_PADDING * 2;
  const dResized = await sharp(isolated)
    .resize(target, target, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // 3. Build the canvas with hairline deco border + composite the D.
  const frame = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
    <rect x="0" y="0" width="512" height="512" fill="${BG}"/>
    <rect x="22" y="22" width="468" height="468" fill="none"
          stroke="rgba(${ACCENT_RGBA.r},${ACCENT_RGBA.g},${ACCENT_RGBA.b},${ACCENT_RGBA.alpha})"
          stroke-width="2"/>
    <rect x="34" y="34" width="444" height="444" fill="none"
          stroke="rgba(${ACCENT_RGBA.r},${ACCENT_RGBA.g},${ACCENT_RGBA.b},0.25)"
          stroke-width="1"/>
  </svg>`;

  const master = await sharp(Buffer.from(frame))
    .composite([{ input: dResized, gravity: "center" }])
    .png()
    .toBuffer();

  return master;
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
      buf: await sharp(master).resize(size, size).png({ compressionLevel: 9 }).toBuffer(),
    })),
  );
  await writeFile(resolve(APP_DIR, "favicon.ico"), buildIco(icoImages));

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
