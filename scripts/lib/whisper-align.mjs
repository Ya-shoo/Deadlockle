// Forced-alignment helper for Deadlockle Conversation mode.
//
// Run whisper.cpp (tiny.en) over a conversation MP3 to get word-level
// timestamps, then sequence-align Whisper's transcribed words to the
// known transcript via Needleman-Wunsch. The known transcript carves
// the alignment into per-line spans; for each line we read off the
// audio start time of its first matched word and the end time of its
// last matched word.
//
// This is the gold-standard approach: we know what was said (wiki has
// transcripts), Whisper tells us when each word was said, and the
// alignment bridges small ASR errors (e.g., Whisper hearing "war red"
// for "ward"). No model training, no API calls — runs entirely on
// CPU using the whisper-cli binary installed via Homebrew.

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_BINARY = "/opt/homebrew/bin/whisper-cli";
// base.en strikes the right balance: roughly 3x more precise on word-boundary
// timestamps than tiny.en (~50-100ms error vs ~50-150ms), in exchange for
// ~3x runtime. tiny.en's timestamp jitter was leaving audible residue from
// the previous speaker / clipping the next speaker's onset; base.en plus
// silence-snapping eliminates that.
const DEFAULT_MODEL = resolve(
  __dirname,
  "..",
  "whisper-models",
  "ggml-base.en.bin",
);

// Run whisper-cli on the given audio file and return per-word timestamps.
// Whisper-cli with `--max-len 1` and JSON output produces one segment per
// word (or per punctuation mark, which we filter out).
//
// Returns [{ text, start, end }] in seconds, sorted by start time.
export async function runWhisper(audioPath, opts = {}) {
  const binary = opts.binary ?? DEFAULT_BINARY;
  const model = opts.model ?? DEFAULT_MODEL;
  const dir = await mkdtemp(join(tmpdir(), "deadlockle-whisper-"));
  const outBase = join(dir, "out");
  try {
    await new Promise((resolveFn, rejectFn) => {
      const args = [
        "-m", model,
        "-f", audioPath,
        "--output-json",
        "--max-len", "1",
        "--output-file", outBase,
        // Quieter logging — we don't need progress noise.
        "--no-prints",
      ];
      const proc = spawn(binary, args);
      let stderr = "";
      proc.stderr.on("data", (d) => (stderr += d.toString()));
      proc.on("error", rejectFn);
      proc.on("exit", (code) => {
        if (code === 0) resolveFn();
        else rejectFn(new Error(`whisper-cli exit ${code}: ${stderr.slice(0, 300)}`));
      });
    });
    const raw = await readFile(`${outBase}.json`, "utf-8");
    const data = JSON.parse(raw);
    const segs = data.transcription ?? [];
    const words = [];
    for (const s of segs) {
      const text = (s.text ?? "").trim();
      // Skip pure punctuation tokens — they don't carry timing info we
      // can act on (and they're often emitted with start === end).
      if (!text || /^[\W_]+$/.test(text)) continue;
      const start = (s.offsets?.from ?? 0) / 1000;
      const end = (s.offsets?.to ?? 0) / 1000;
      if (end <= start) continue;
      words.push({ text, start, end });
    }
    words.sort((a, b) => a.start - b.start);
    return words;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// Lowercase, strip punctuation/quotes, split on whitespace. Used to
// normalize tokens before alignment so apostrophe / quote / em-dash
// differences between transcript and Whisper output don't break matches.
export function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// Needleman-Wunsch sequence alignment over two token arrays. Returns
// pairs [aIdx | null, bIdx | null] in alignment order — null on the
// `a` side means a gap (Whisper hallucinated / inserted), null on the
// `b` side means a gap (Whisper deleted / missed a transcript word).
//
// Scoring favours exact matches; we treat near-match (string distance
// ≤ 1) as a half-credit match so a single-letter ASR slip still aligns
// rather than blowing into a substitution + insertion pair.
export function alignTokens(a, b) {
  const n = a.length;
  const m = b.length;
  const GAP = -1;

  function score(x, y) {
    if (x === y) return 2;
    // Cheap edit-distance proxy: same length and ≤1 char different →
    // probably the same word with an ASR slip ("ward" vs "wart").
    if (x.length === y.length) {
      let diff = 0;
      for (let i = 0; i < x.length && diff < 2; i++) {
        if (x[i] !== y[i]) diff++;
      }
      if (diff <= 1) return 1;
    }
    // One-char insertion/deletion difference.
    if (Math.abs(x.length - y.length) === 1) {
      const [sh, lo] = x.length < y.length ? [x, y] : [y, x];
      let i = 0,
        j = 0,
        edits = 0;
      while (i < sh.length && j < lo.length && edits < 2) {
        if (sh[i] === lo[j]) {
          i++;
          j++;
        } else {
          j++;
          edits++;
        }
      }
      if (edits + (lo.length - j) <= 1) return 1;
    }
    return -2;
  }

  // dp[i][j] = best alignment score for a[0..i] vs b[0..j]
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = 1; i <= n; i++) dp[i][0] = i * GAP;
  for (let j = 1; j <= m; j++) dp[0][j] = j * GAP;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sub = dp[i - 1][j - 1] + score(a[i - 1], b[j - 1]);
      const del = dp[i - 1][j] + GAP;
      const ins = dp[i][j - 1] + GAP;
      dp[i][j] = Math.max(sub, del, ins);
    }
  }
  // Traceback
  const out = [];
  let i = n,
    j = m;
  while (i > 0 || j > 0) {
    if (
      i > 0 &&
      j > 0 &&
      dp[i][j] === dp[i - 1][j - 1] + score(a[i - 1], b[j - 1])
    ) {
      out.push([i - 1, j - 1]);
      i--;
      j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + GAP) {
      out.push([i - 1, null]);
      i--;
    } else {
      out.push([null, j - 1]);
      j--;
    }
  }
  out.reverse();
  return out;
}

// Given Whisper's per-word timestamps and the line transcripts (with
// known speaker), return per-line {start, duration} ranges or a failure
// object. For each line we use the first and last aligned Whisper words
// in that line's transcript-token range to read off the audio span.
//
// `silences` (optional): array of {start, end} in seconds from ffmpeg's
// silencedetect. When provided, each internal line boundary is snapped
// to the nearest silence within ±SNAP_WINDOW so playback never starts
// mid-phoneme or carries the previous speaker's tail. Whisper's
// word-boundary timestamps are accurate at the second-level but
// imprecise at the 50-100ms scale — silence-snap fixes that by deferring
// to the audio's actual quiet regions for the physical cut location.
//
// Failure modes:
//  - Whisper produced too few words to match the transcript reliably.
//  - More than 40% of transcript tokens are unmatched (deletions) — the
//    line ranges would be unreliable, fall back to MFCC diarization.
export function alignLinesToWhisper(whisperWords, lines, silences = null) {
  const transcriptTokens = []; // flat
  const lineForToken = []; // which line each transcript token belongs to
  for (let li = 0; li < lines.length; li++) {
    const toks = tokenize(lines[li].text);
    for (const t of toks) {
      transcriptTokens.push(t);
      lineForToken.push(li);
    }
  }
  if (transcriptTokens.length === 0) {
    return { ok: false, reason: "no_transcript_tokens" };
  }
  const whisperTokens = whisperWords.map((w) => tokenize(w.text)[0] ?? "");
  if (whisperTokens.length < Math.max(3, Math.floor(transcriptTokens.length * 0.5))) {
    return {
      ok: false,
      reason: `whisper_too_sparse (${whisperTokens.length} vs ${transcriptTokens.length})`,
    };
  }
  const alignment = alignTokens(whisperTokens, transcriptTokens);

  // For each transcript token, record the matched whisper word index
  // (or null for a deletion).
  const transcriptToWhisper = new Array(transcriptTokens.length).fill(null);
  let matchedCount = 0;
  for (const [ai, bi] of alignment) {
    if (ai != null && bi != null) {
      transcriptToWhisper[bi] = ai;
      matchedCount++;
    }
  }
  if (matchedCount / transcriptTokens.length < 0.6) {
    return {
      ok: false,
      reason: `low_match_rate (${matchedCount}/${transcriptTokens.length})`,
    };
  }

  // For each line, find the first and last matched whisper-word indices
  // that belong to its transcript-token range. Fill gaps from the
  // surrounding context if a line's first/last word didn't get matched.
  const ranges = [];
  for (let li = 0; li < lines.length; li++) {
    const tokenIdxs = [];
    for (let i = 0; i < lineForToken.length; i++) {
      if (lineForToken[i] === li) tokenIdxs.push(i);
    }
    let firstWhisper = null;
    let lastWhisper = null;
    for (const ti of tokenIdxs) {
      const wi = transcriptToWhisper[ti];
      if (wi == null) continue;
      if (firstWhisper == null || wi < firstWhisper) firstWhisper = wi;
      if (lastWhisper == null || wi > lastWhisper) lastWhisper = wi;
    }
    if (firstWhisper == null || lastWhisper == null) {
      return { ok: false, reason: `line_${li}_no_match` };
    }
    const start = whisperWords[firstWhisper].start;
    const end = whisperWords[lastWhisper].end;
    if (end - start <= 0.05) {
      return { ok: false, reason: `line_${li}_zero_length` };
    }
    ranges.push({ start, end });
  }

  // Sanity: lines must be in order. If alignment scrambled them (rare,
  // but possible if Whisper hallucinated repeated phrases), reject.
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i].start < ranges[i - 1].start) {
      return { ok: false, reason: "lines_out_of_order" };
    }
  }

  // Tiny pad on each side so playback doesn't clip the leading consonant
  // or the trailing release. 60ms is below perceptual threshold for
  // "starts in silence" and well below the inter-line gap on normal
  // dialogue.
  const PAD = 0.06;
  const padded = ranges.map((r, i) => {
    let start = Math.max(0, r.start - PAD);
    let end = r.end + PAD;
    // Don't let padding overlap into the next line's start.
    if (i + 1 < ranges.length) {
      end = Math.min(end, ranges[i + 1].start - 0.01);
    }
    return { start: round3(start), duration: round3(end - start) };
  });
  return { ok: true, ranges: padded };
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}
