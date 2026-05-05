// Pulls Deadlock conversation audio + transcripts from the wiki for use by
// Conversation mode (slug "sound"). For each hero in data/heroes.json:
//   1. Fetch deadlock.wiki/<Hero>/Quotes wikitext via parse API.
//   2. Slice the `== Conversations ==` section.
//   3. For each row, pull the audio File ref and the transcript, which
//      includes speaker-labeled lines like `'''Abrams:''' …`.
//   4. Resolve speaker labels to hero keys via heroes.json (display-name
//      match). Drop any row that doesn't resolve to exactly 2 known heroes
//      (skips 3-way conversations and lines about characters not in our
//      hero pool).
//   5. Spoiler-scrub: drop the row if the transcript text mentions either
//      hero by name/nickname (would give the puzzle away). Display tokens
//      like `Speaker A`/`Speaker B` are unaffected since the speaker
//      labels are stripped before scrubbing.
//   6. Deduplicate by audio file (some conversations are linked from
//      multiple hero pages with the same File ref).
//   7. Download each clean audio file to public/voicelines/conversations/
//      and write data/sound-conversations.json.
//
// The output JSON is the source of truth for Conversation mode — text and
// audio are guaranteed to match because both come from the same wiki row.

import { readFile, writeFile, mkdir, unlink, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HEROES_IN = resolve(__dirname, "..", "data", "heroes.json");
const OUT_MANIFEST = resolve(__dirname, "..", "data", "sound-conversations.json");
const OUT_DIR = resolve(__dirname, "..", "public", "voicelines", "conversations");

const WIKI = "https://deadlock.wiki";
const UA = "deadlockle-conversation-audio/0.1 (yashpa0326@gmail.com)";

// Page title overrides where the wiki page name differs from the hero
// display name (matches build-voicelines.mjs).
const PAGE_TITLE_OVERRIDES = {
  "mo-krill": "Mo_%26_Krill",
};

// Speaker labels that don't follow the "<Display Name>:" convention. Map
// each to its hero key. Only heroes with eccentric attribution patterns
// need an entry here.
const SPEAKER_LABEL_OVERRIDES = {
  // Mo & Krill voices the same character — wiki sometimes labels lines
  // "Mo:" or "Krill:" individually.
  Mo: "mo-krill",
  Krill: "mo-krill",
  "Mo & Krill": "mo-krill",
};

// Domain-specific aliases that reliably identify a specific hero. Matches
// the spoiler vocabulary used by build-voicelines.mjs.
const NICKNAMES = {
  infernus: ["Fern", "Bartender"],
  holliday: ["Sheriff"],
  bebop: ["Sandman", "Tommy gun"],
  "mo-krill": ["Iron body", "Four arms"],
  pocket: ["Cook"],
  vyper: ["Viper"],
};

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return res.json();
}

async function fetchBuffer(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function pageTitleFor(hero) {
  if (PAGE_TITLE_OVERRIDES[hero.key]) return PAGE_TITLE_OVERRIDES[hero.key];
  return hero.name.replace(/\s+/g, "_");
}

async function getQuotesWikitext(hero) {
  const title = pageTitleFor(hero);
  const url = `${WIKI}/api.php?action=parse&format=json&page=${title}/Quotes&prop=wikitext&redirects=1`;
  try {
    const j = await fetchJson(url);
    return j?.parse?.wikitext?.["*"] ?? "";
  } catch (e) {
    console.log(`  [no Quotes page for ${hero.name}: ${e.message}]`);
    return "";
  }
}

// Slice `== Conversations ==` section. Stops at the next H2 or end of doc.
function extractConversationsSection(wikitext) {
  const re = /==\s*Conversations\s*==([\s\S]*?)(?:\n==[^=]|$)/i;
  const m = wikitext.match(re);
  return m ? m[1] : "";
}

// Strip wiki markup we don't care about. Preserves speaker prefixes and
// line breaks; everything else is normalized to plain text.
function cleanWikiText(text) {
  return text
    .replace(/\[\[[^|\]]*\|([^\]]+)\]\]/g, "$1") // [[Link|Text]] → Text
    .replace(/\[\[([^\]]+)\]\]/g, "$1") // [[Link]] → Link
    .replace(/<[^>]+>/g, "") // strip HTML
    .replace(/\{\{[^}]+\}\}/g, "") // strip templates
    // Speaker prefixes are wrapped in `'''Label:'''`. Don't collapse the
    // triples — apostrophes in dialogue text ("when's") would clash with
    // single-quote markers and break turn-splitting.
    .replace(/ /g, " ")
    .trim();
}

// Walk the Conversations section row by row. Each row is delimited by
// |- markers (or implicit start of section). A row may span multiple
// |columns; we treat the FIRST File: ref as the audio for the row, and
// the FIRST cell after that containing 'Speaker:' lines as the transcript.
function parseConversationRows(section) {
  if (!section) return [];
  const out = [];
  // Split on row delimiters. A row is delimited by lines starting with |-.
  const rows = section.split(/\n\|-\s*\n/);
  for (const raw of rows) {
    // Find audio File ref(s). Take the first one in the row.
    const fileMatch = raw.match(/\[\[File:([^\]|]+\.mp3)\]\]/);
    if (!fileMatch) continue;
    const file = fileMatch[1].trim().replace(/\s+/g, "_");

    // Transcript lives in a cell that contains '''SpeakerName:''' lines.
    // Extract everything in the row that follows the audio File line, then
    // pick out lines that start with a quoted speaker tag.
    const afterFile = raw.slice(fileMatch.index + fileMatch[0].length);
    // Cells are separated by `\n|`. We want the first cell that has a
    // speaker prefix.
    const cells = afterFile.split(/\n\|/);
    let transcript = null;
    for (const cell of cells) {
      if (/'''[A-Za-z][^']{0,30}:'''/.test(cell)) {
        transcript = cell;
        break;
      }
    }
    if (!transcript) continue;
    out.push({ file, transcriptRaw: transcript });
  }
  return out;
}

// Parse the multi-speaker transcript into an ordered list of
// { speakerLabel, text } turns. Wiki encodes a speaker turn as
//   '''Speaker Label:''' the spoken text
// The text continues until the next `'''Speaker:'''` or end of cell.
function parseTurns(transcriptRaw) {
  const cleaned = cleanWikiText(transcriptRaw);
  const turns = [];
  // Match `'''Label:'''` then capture text up to the next `'''Label:'''`.
  // Triple-quote boundary disambiguates from apostrophes inside dialogue.
  const re = /'''([A-Za-z][^':]{0,30}):'''\s*([\s\S]*?)(?='''[A-Za-z][^':]{0,30}:'''|$)/g;
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    const label = m[1].trim();
    // Strip stray italic markers (`''text''`) and collapse whitespace.
    const text = m[2].replace(/''+/g, "").replace(/\s+/g, " ").trim();
    if (text) turns.push({ label, text });
  }
  return turns;
}

// Map speaker label → hero key using a lookup built from heroes.json.
// Returns null if no known hero matches.
function resolveSpeaker(label, byDisplayName) {
  if (SPEAKER_LABEL_OVERRIDES[label]) return SPEAKER_LABEL_OVERRIDES[label];
  const direct = byDisplayName.get(label.toLowerCase());
  if (direct) return direct;
  return null;
}

// Stopwords / generic articles that occasionally appear in hero display
// names ("The Doorman") but are useless as spoiler markers and would
// nuke perfectly clean conversations the moment anyone says "the".
const NAME_PART_STOPWORDS = new Set([
  "the", "and", "of", "a", "an",
  // Honorifics that aren't unique to one hero.
  "lady", "lord", "sir", "mr", "mrs", "ms",
]);

// Build the spoiler vocabulary across EVERY hero (including the two
// speakers). The conversation card hides who's speaking — if Speaker A
// addresses the other as "Hey Bebop…", that spoils the puzzle. Same goes
// for self-identification ("I'm Abrams") since both speakers are guessed
// independently.
function buildForbiddenTokens(allHeroes, voicelinePrefixes) {
  const banned = new Set();
  for (const h of allHeroes) {
    banned.add(h.name.toLowerCase());
    for (const part of h.name.split(/\s+/)) {
      const p = part.toLowerCase();
      if (p.length < 4) continue;
      if (NAME_PART_STOPWORDS.has(p)) continue;
      banned.add(p);
    }
    const prefix = voicelinePrefixes[h.key];
    if (prefix) banned.add(prefix.toLowerCase());
    for (const n of NICKNAMES[h.key] ?? []) banned.add(n.toLowerCase());
  }
  return banned;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isSpoilerSafe(text, banned) {
  const lower = text.toLowerCase();
  for (const tok of banned) {
    const isPhrase = tok.includes(" ");
    const re = isPhrase
      ? new RegExp(escapeRe(tok), "i")
      : new RegExp(`\\b${escapeRe(tok)}\\b`, "i");
    if (re.test(lower)) return false;
  }
  return true;
}

// Re-encode the wiki MP3 to mono 64kbps. Wiki source is 192kbps stereo —
// for spoken dialogue that's vastly oversized. Mono 64kbps is transparent
// to ear and brings the on-disk pool from ~90MB to ~30MB.
function transcodeToMono64k(srcPath, outPath) {
  return new Promise((resolveFn, rejectFn) => {
    const args = [
      "-y",
      "-loglevel", "error",
      "-i", srcPath,
      "-ac", "1",
      "-b:a", "64k",
      "-map_metadata", "-1",
      outPath,
    ];
    const proc = spawn(ffmpegPath, args);
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("error", rejectFn);
    proc.on("exit", (code) => {
      if (code === 0) resolveFn();
      else rejectFn(new Error(`ffmpeg exit ${code}: ${stderr.slice(0, 200)}`));
    });
  });
}

// Run ffmpeg silencedetect on a file and capture the stderr output that
// the filter writes its findings to. Returns the raw stderr text.
function runSilenceDetect(audioPath, threshold = "-25dB", minDur = "0.15") {
  return new Promise((resolveFn, rejectFn) => {
    const args = [
      "-i", audioPath,
      "-af", `silencedetect=n=${threshold}:d=${minDur}`,
      "-f", "null", "-",
    ];
    const proc = spawn(ffmpegPath, args);
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("error", rejectFn);
    proc.on("exit", (code) => {
      if (code === 0) resolveFn(stderr);
      else rejectFn(new Error(`ffmpeg exit ${code}`));
    });
  });
}

// Probe a file's duration via ffmpeg's stderr "Duration:" line.
function getDurationSeconds(audioPath) {
  return new Promise((resolveFn, rejectFn) => {
    const proc = spawn(ffmpegPath, ["-i", audioPath]);
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("error", rejectFn);
    proc.on("exit", () => {
      const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
      if (!m) return rejectFn(new Error("no duration"));
      const h = +m[1], min = +m[2], s = +m[3];
      resolveFn(h * 3600 + min * 60 + s);
    });
  });
}

// Compute per-line {start, duration} ranges for the conversation audio
// using silence detection. Returns null when we can't reliably split
// into the expected number of segments — caller should drop the
// conversation in that case.
//
// Strategy:
//  1. Detect silences with a generous threshold.
//  2. Strip the leading and trailing silences (head/tail dead air).
//  3. From the remaining internal silences, pick the (lineCount-1)
//     longest as the line boundaries.
//  4. Each line's audio runs from the previous boundary's silence_end
//     to the next boundary's silence_start, so playback excludes the
//     pause and starts crisply on speech.
async function computeLineRanges(audioPath, lineCount) {
  if (lineCount < 1) return null;
  const stderr = await runSilenceDetect(audioPath);
  const duration = await getDurationSeconds(audioPath);

  const matches = [
    ...stderr.matchAll(/silence_(start|end):\s*(-?\d+(?:\.\d+)?)/g),
  ];
  const silences = [];
  let cur = null;
  for (const m of matches) {
    const t = parseFloat(m[2]);
    if (m[1] === "start") {
      cur = { start: Math.max(0, t) };
    } else if (cur) {
      cur.end = Math.min(duration, t);
      cur.duration = cur.end - cur.start;
      if (cur.duration > 0) silences.push(cur);
      cur = null;
    }
  }

  // Single-line conversations: just play the whole file.
  if (lineCount === 1) {
    return [{ start: 0, duration }];
  }

  // Strip lead-in and trailing silence — they aren't real boundaries.
  const HEAD_TOL = 0.2;
  const TAIL_TOL = 0.2;
  let leadInEnd = 0;
  let trailingStart = duration;
  if (silences.length && silences[0].start <= HEAD_TOL) {
    leadInEnd = silences[0].end;
    silences.shift();
  }
  if (
    silences.length &&
    silences[silences.length - 1].end >= duration - TAIL_TOL
  ) {
    trailingStart = silences[silences.length - 1].start;
    silences.pop();
  }

  if (silences.length < lineCount - 1) return null;

  // Pick the longest (lineCount - 1) silences and re-sort by time.
  const picked = [...silences]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, lineCount - 1)
    .sort((a, b) => a.start - b.start);

  const ranges = [];
  let prevEnd = leadInEnd;
  for (const s of picked) {
    const start = prevEnd;
    const end = s.start;
    if (end - start <= 0.1) return null; // implausibly short
    ranges.push({ start: round3(start), duration: round3(end - start) });
    prevEnd = s.end;
  }
  const finalStart = prevEnd;
  const finalEnd = trailingStart;
  if (finalEnd - finalStart <= 0.1) return null;
  ranges.push({
    start: round3(finalStart),
    duration: round3(finalEnd - finalStart),
  });
  return ranges;
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

async function resolveFileUrl(filename) {
  const title = `File:${filename.replace(/_/g, " ")}`;
  const url = `${WIKI}/api.php?action=query&format=json&prop=imageinfo&iiprop=url&titles=${encodeURIComponent(title)}`;
  const j = await fetchJson(url);
  const pages = j?.query?.pages ?? {};
  for (const k of Object.keys(pages)) {
    const ii = pages[k]?.imageinfo;
    if (ii && ii[0]?.url) return ii[0].url;
  }
  return null;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const heroes = JSON.parse(await readFile(HEROES_IN, "utf-8"));

  // Reuse the audio prefixes already discovered for Select-section voice
  // clips (build-voicelines.mjs). These prefixes (Atlas, Geist, Krill,
  // Astro, etc.) are common informal handles that count as spoilers when
  // a hero's name doesn't already cover them.
  const voicelinesPath = resolve(__dirname, "..", "data", "voicelines.json");
  let voicelinePrefixes = {};
  try {
    const v = JSON.parse(await readFile(voicelinesPath, "utf-8"));
    for (const k of Object.keys(v)) {
      if (v[k]?.prefix) voicelinePrefixes[k] = v[k].prefix;
    }
  } catch {
    console.log("  (no data/voicelines.json — proceeding without prefixes)");
  }

  // Display name → key lookup. Lowercase everything for tolerant matching.
  const byDisplayName = new Map();
  for (const h of heroes) {
    byDisplayName.set(h.name.toLowerCase(), h.key);
  }

  // Pass 1: walk every hero's Quotes page, collect raw rows.
  console.log(`Pass 1: scanning ${heroes.length} heroes for Conversations sections...`);
  const allRows = [];
  for (const h of heroes) {
    const wikitext = await getQuotesWikitext(h);
    if (!wikitext) continue;
    const section = extractConversationsSection(wikitext);
    if (!section) {
      console.log(`  ${h.key.padEnd(15)} (no Conversations section)`);
      continue;
    }
    const rows = parseConversationRows(section);
    console.log(`  ${h.key.padEnd(15)} ${rows.length} rows`);
    for (const r of rows) allRows.push(r);
    await new Promise((r) => setTimeout(r, 80));
  }

  // Pass 2: dedupe by file, parse turns, filter to 2-speaker known-hero
  // rows, spoiler-scrub.
  console.log(`\nPass 2: parsing ${allRows.length} raw rows...`);
  const banned = buildForbiddenTokens(heroes, voicelinePrefixes);
  const seenFiles = new Set();
  const conversations = [];
  let droppedUnknownSpeaker = 0;
  let droppedNot2 = 0;
  let droppedSpoiler = 0;
  for (const row of allRows) {
    if (seenFiles.has(row.file)) continue;
    seenFiles.add(row.file);

    const turns = parseTurns(row.transcriptRaw);
    if (turns.length < 2) continue;

    // Identify the unique hero keys involved.
    const labels = [...new Set(turns.map((t) => t.label))];
    const keys = labels.map((l) => resolveSpeaker(l, byDisplayName));
    if (keys.some((k) => !k)) {
      droppedUnknownSpeaker++;
      continue;
    }
    const uniqueKeys = [...new Set(keys)];
    if (uniqueKeys.length !== 2) {
      droppedNot2++;
      continue;
    }

    // Order speakers by who spoke first in this turn list.
    const labelToKey = new Map();
    labels.forEach((l, i) => labelToKey.set(l, keys[i]));
    const firstKey = labelToKey.get(turns[0].label);
    const otherKey = uniqueKeys.find((k) => k !== firstKey);
    const speakers = [firstKey, otherKey];

    // Spoiler-scrub the dialogue text only (NOT the labels, since those
    // are display-time hidden behind "Speaker A" / "Speaker B").
    const dialogueText = turns.map((t) => t.text).join(" ");
    if (!isSpoilerSafe(dialogueText, banned)) {
      droppedSpoiler++;
      continue;
    }

    const lines = turns.map((t) => ({
      speaker: labelToKey.get(t.label) === speakers[0] ? 0 : 1,
      text: t.text,
    }));

    conversations.push({ file: row.file, speakers, lines });
  }
  console.log(
    `  → ${conversations.length} clean conversations (dropped ${droppedUnknownSpeaker} unknown speaker, ${droppedNot2} not-2-speaker, ${droppedSpoiler} spoilers)`,
  );

  // Pass 3: download, transcode, and silence-split each conversation. Per
  // line we store {start, duration} into the manifest so the frontend can
  // play just that line's slice of the shared MP3 (no per-line files).
  // Conversations whose silence detection doesn't produce clean
  // (lineCount - 1) boundaries are dropped — better to ship a smaller
  // pool of accurately-split clips than gamble on misaligned audio.
  console.log(`\nPass 3: downloading, transcoding, splitting audio...`);
  const manifest = [];
  let droppedNoSplit = 0;
  for (const c of conversations) {
    const localName = c.file.replace(/[^A-Za-z0-9._-]/g, "_").toLowerCase();
    const outPath = resolve(OUT_DIR, localName);
    const tmpPath = outPath + ".raw";
    try {
      const url = await resolveFileUrl(c.file);
      if (!url) {
        console.log(`    ${c.file}: no URL resolved — skipping`);
        continue;
      }
      const buf = await fetchBuffer(url);
      await writeFile(tmpPath, buf);
      await transcodeToMono64k(tmpPath, outPath);
      await unlink(tmpPath).catch(() => {});

      const ranges = await computeLineRanges(outPath, c.lines.length);
      if (!ranges) {
        droppedNoSplit++;
        await unlink(outPath).catch(() => {});
        continue;
      }

      const finalSize = (await stat(outPath)).size;
      const linesWithAudio = c.lines.map((line, i) => ({
        speaker: line.speaker,
        text: line.text,
        audioStart: ranges[i].start,
        audioDuration: ranges[i].duration,
      }));
      manifest.push({
        speakers: c.speakers,
        audio: `/voicelines/conversations/${localName}`,
        bytes: finalSize,
        lines: linesWithAudio,
      });
      await new Promise((r) => setTimeout(r, 60));
    } catch (e) {
      await unlink(tmpPath).catch(() => {});
      console.log(`    ${c.file}: ${e.message}`);
    }
  }
  if (droppedNoSplit) {
    console.log(`  → dropped ${droppedNoSplit} conversations (couldn't split into expected line count)`);
  }

  await writeFile(OUT_MANIFEST, JSON.stringify(manifest, null, 2));
  const totalBytes = manifest.reduce((n, c) => n + c.bytes, 0);
  console.log(
    `\nWrote ${manifest.length} conversations / ${(totalBytes / 1024 / 1024).toFixed(1)}MB → data/sound-conversations.json`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
