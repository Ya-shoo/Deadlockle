// Speaker diarization for Deadlockle Conversation mode.
//
// Given a conversation MP3 and the two heroes who appear in it, decode the
// audio, compute MFCC features per frame, and classify each frame as
// speaker A or speaker B by comparing to per-hero MFCC centroids built
// from that hero's existing voiceline clips. Transitions between speakers
// are then snapped to the nearest detected silence to produce
// physically-sensible line boundaries — even when the speaker takes a
// dramatic mid-line beat (the failure mode silence-only splitting can't
// distinguish from a real handoff).
//
// All math runs on raw PCM via ffmpeg → meyda. No external models.

import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import ffmpegPath from "ffmpeg-static";
import Meyda from "meyda";

// Speech-recognition standard. 16kHz captures ~8kHz of frequency content,
// well above the spectral envelope used by MFCC.
const SAMPLE_RATE = 16000;
// 32ms frames with 10ms hop. 512 samples at 16kHz = 32ms, slightly longer
// than the textbook 25ms but required because meyda's FFT needs a
// power-of-2 buffer size. The hop doesn't need to be a power of 2 — it's
// just frame stepping — so we keep the standard 10ms.
const FRAME_SIZE = 512;
const HOP_SIZE = 160;
// 13 MFCC coefficients is the conventional dimensionality. We drop coef
// 0 (overall energy) before distance computation since it tracks
// recording level, not speaker identity.
const MFCC_COEFS = 13;

// Pipe ffmpeg-decoded PCM into a Float32Array. Mono, 16kHz, signed 16-bit
// little-endian. We then convert int16 → float in [-1, 1].
export function decodePcm(audioPath) {
  return new Promise((resolve, reject) => {
    const args = [
      "-loglevel", "error",
      "-i", audioPath,
      "-ac", "1",
      "-ar", String(SAMPLE_RATE),
      "-f", "s16le",
      "pipe:1",
    ];
    const proc = spawn(ffmpegPath, args);
    const chunks = [];
    proc.stdout.on("data", (chunk) => chunks.push(chunk));
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg decode exit ${code}: ${stderr.slice(0, 200)}`));
        return;
      }
      const buf = Buffer.concat(chunks);
      // s16le → Float32 in [-1, 1]
      const samples = new Float32Array(buf.length / 2);
      for (let i = 0; i < samples.length; i++) {
        const s = buf.readInt16LE(i * 2);
        samples[i] = s / 32768;
      }
      resolve(samples);
    });
  });
}

// Walk the PCM array in 25ms frames with 10ms hop. For each frame, compute
// 13 MFCC coefficients via meyda. Returns an array of [13]-length
// Float64Arrays plus the matching frame-time array.
export function computeMfccFrames(pcm) {
  Meyda.bufferSize = FRAME_SIZE;
  Meyda.sampleRate = SAMPLE_RATE;
  Meyda.numberOfMFCCCoefficients = MFCC_COEFS;

  const frames = [];
  const times = [];
  for (let i = 0; i + FRAME_SIZE <= pcm.length; i += HOP_SIZE) {
    const slice = pcm.subarray(i, i + FRAME_SIZE);
    // meyda needs a regular Array or typed array of length === bufferSize.
    const mfcc = Meyda.extract("mfcc", slice);
    if (!mfcc || mfcc.length !== MFCC_COEFS) continue;
    frames.push(mfcc);
    times.push(i / SAMPLE_RATE);
  }
  return { frames, times };
}

// Fast root-mean-square energy per frame. Used to skip silent frames when
// we classify — silence has no speaker identity and would only add noise
// to per-frame MFCC distances.
export function computeFrameEnergies(pcm) {
  const energies = [];
  for (let i = 0; i + FRAME_SIZE <= pcm.length; i += HOP_SIZE) {
    let sum = 0;
    for (let j = 0; j < FRAME_SIZE; j++) {
      const s = pcm[i + j];
      sum += s * s;
    }
    energies.push(Math.sqrt(sum / FRAME_SIZE));
  }
  return energies;
}

// Mean across MFCC frames, ignoring coef 0. Returns a Float64Array of
// length MFCC_COEFS - 1 (i.e., coefs 1..12).
export function computeCentroid(frames) {
  if (frames.length === 0) return null;
  const dim = MFCC_COEFS - 1;
  const sum = new Float64Array(dim);
  for (const f of frames) {
    for (let i = 0; i < dim; i++) sum[i] += f[i + 1];
  }
  for (let i = 0; i < dim; i++) sum[i] /= frames.length;
  return sum;
}

// Compute a global standardization (mean + std per coef) across a pool of
// frames. Standardizing makes every MFCC coefficient contribute to the
// distance equally — without this, coef 1 (~order of magnitude 30)
// dominates and the smaller speaker-discriminative coefs (~1-12) get
// drowned out.
//
// Coef 0 is dropped before stats are computed so the output is in the
// same 12-dim space the centroids live in.
export function computeStandardization(frames) {
  if (frames.length === 0) return null;
  const dim = MFCC_COEFS - 1;
  const mean = new Float64Array(dim);
  const sqSum = new Float64Array(dim);
  for (const f of frames) {
    for (let i = 0; i < dim; i++) {
      const v = f[i + 1];
      mean[i] += v;
      sqSum[i] += v * v;
    }
  }
  for (let i = 0; i < dim; i++) mean[i] /= frames.length;
  const std = new Float64Array(dim);
  for (let i = 0; i < dim; i++) {
    const v = sqSum[i] / frames.length - mean[i] * mean[i];
    std[i] = Math.sqrt(Math.max(v, 1e-9));
  }
  return { mean, std };
}

// Apply (frame[1..] - mean) / std for a single frame. Returns a 12-dim
// standardized vector.
export function standardizeFrame(frame, stats) {
  const dim = MFCC_COEFS - 1;
  const out = new Float64Array(dim);
  for (let i = 0; i < dim; i++) {
    out[i] = (frame[i + 1] - stats.mean[i]) / stats.std[i];
  }
  return out;
}

// Cosine similarity between two equal-length vectors. Returns a value in
// [-1, 1]; higher = more similar.
function cosine(a, b) {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

// Squared Euclidean distance — used on standardized features. Cheaper
// than computing the actual Euclidean since we only need ordering, not
// the absolute value.
function sqDist(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return s;
}

// Per-frame classification using two-cluster k-means initialized from the
// pre-computed hero centroids. Why k-means instead of nearest-centroid
// directly?
//
// Pre-computed hero centroids are built from the heroes' "select" voice
// lines, recorded in different conditions than the conversation. Per-frame
// nearest-centroid classification on raw conversation MFCCs ends up
// heavily biased — both speakers may be closer to one hero's centroid
// than the other in absolute terms, even though they're more distinct
// from each other within the conversation. Running k-means on the
// conversation's own speech frames adapts the cluster centres to the
// conversation's acoustic conditions; the pre-computed hero centroids
// serve only as the initialization (so cluster 0 stays "the speaker who
// sounds more like hero A") and as the post-hoc labelling step.
//
// Centroids and frames must already be standardized into the same
// z-score space.
export function classifyFrames(standardizedFrames, energies, centroidA, centroidB) {
  if (!centroidA || !centroidB) return null;
  const sortedE = [...energies].sort((a, b) => a - b);
  const energyFloor = sortedE[Math.floor(sortedE.length * 0.2)];

  // Speech-only frames + their original indices — k-means runs on these.
  const speechFrames = [];
  const speechIndices = [];
  for (let i = 0; i < standardizedFrames.length; i++) {
    if (energies[i] < energyFloor) continue;
    speechFrames.push(standardizedFrames[i]);
    speechIndices.push(i);
  }
  if (speechFrames.length < 50) return null;

  // Run k-means initialized from hero centroids. Cluster 0 starts near
  // hero A, cluster 1 near hero B; they migrate toward the conversation's
  // own per-speaker MFCC means but should stay roughly assigned that way.
  const dim = centroidA.length;
  let cA = Float64Array.from(centroidA);
  let cB = Float64Array.from(centroidB);
  for (let iter = 0; iter < 20; iter++) {
    const sumA = new Float64Array(dim);
    const sumB = new Float64Array(dim);
    let nA = 0,
      nB = 0;
    for (const f of speechFrames) {
      if (sqDist(f, cA) <= sqDist(f, cB)) {
        for (let k = 0; k < dim; k++) sumA[k] += f[k];
        nA++;
      } else {
        for (let k = 0; k < dim; k++) sumB[k] += f[k];
        nB++;
      }
    }
    // Degenerate split — bail rather than divide by zero. The hero
    // centroids must be too close in feature space for separation.
    if (nA === 0 || nB === 0) return null;
    const newA = new Float64Array(dim);
    const newB = new Float64Array(dim);
    for (let k = 0; k < dim; k++) {
      newA[k] = sumA[k] / nA;
      newB[k] = sumB[k] / nB;
    }
    // Convergence check.
    let shift = 0;
    for (let k = 0; k < dim; k++) {
      shift += (newA[k] - cA[k]) ** 2 + (newB[k] - cB[k]) ** 2;
    }
    cA = newA;
    cB = newB;
    if (shift < 1e-4) break;
  }

  // Re-label clusters against the original hero centroids — k-means may
  // have migrated; the cluster nearer to hero A is "speaker 0".
  const dAA = sqDist(cA, centroidA);
  const dAB = sqDist(cA, centroidB);
  const swap = dAA > dAB; // cluster 0 is actually closer to B
  const labelForCluster0 = swap ? 1 : 0;
  const labelForCluster1 = swap ? 0 : 1;

  const labels = new Array(standardizedFrames.length).fill(null);
  const margins = new Array(standardizedFrames.length).fill(0);
  for (let j = 0; j < speechFrames.length; j++) {
    const i = speechIndices[j];
    const f = speechFrames[j];
    const d0 = sqDist(f, cA);
    const d1 = sqDist(f, cB);
    labels[i] = d0 <= d1 ? labelForCluster0 : labelForCluster1;
    const total = d0 + d1;
    margins[i] = total > 0 ? Math.abs(d0 - d1) / total : 0;
  }
  return { labels, margins };
}

// Smooth a per-frame label sequence by majority vote over a window of
// ~250ms (25 frames at 10ms hop). Null (silent) frames are skipped from
// the vote. Helps mid-frame MFCC noise from blowing up into spurious
// transitions.
export function smoothLabels(labels, window = 25) {
  const half = Math.floor(window / 2);
  const out = new Array(labels.length).fill(null);
  for (let i = 0; i < labels.length; i++) {
    let a = 0,
      b = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(labels.length - 1, i + half); j++) {
      if (labels[j] === 0) a++;
      else if (labels[j] === 1) b++;
    }
    if (a + b === 0) out[i] = null;
    else out[i] = a >= b ? 0 : 1;
  }
  return out;
}

// Forward-fill nulls (speech-poor frames) so we never have a hole between
// two same-speaker runs. We only want transitions to register when the
// speaker actually changes.
export function fillGaps(labels) {
  const out = labels.slice();
  let last = null;
  for (let i = 0; i < out.length; i++) {
    if (out[i] === null) out[i] = last;
    else last = out[i];
  }
  // Backfill leading nulls
  let first = null;
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== null) {
      first = out[i];
      break;
    }
  }
  for (let i = 0; i < out.length && out[i] === null; i++) out[i] = first;
  return out;
}

// Detect runs of identical labels. Returns [{label, startFrame, endFrame},
// ...]. A "transition" between line N and line N+1 is the boundary
// between consecutive runs of opposite labels.
export function findRuns(labels) {
  const runs = [];
  let i = 0;
  while (i < labels.length) {
    const lbl = labels[i];
    let j = i;
    while (j < labels.length && labels[j] === lbl) j++;
    runs.push({ label: lbl, startFrame: i, endFrame: j - 1 });
    i = j;
  }
  return runs;
}

// Given the runs from a smoothed label stream, find the (expectedTransitions)
// most stable transitions — i.e., the ones where both adjacent runs are
// long. If there are exactly the expected number, return all of them.
// Otherwise, prefer transitions where the surrounding runs are longest
// (these are the most confident speaker handoffs).
export function pickTransitions(runs, expectedTransitions) {
  // Convert into transition points: each adjacent run-pair where label
  // changes. A transition point is the frame index of the start of the
  // second run.
  const transitions = [];
  for (let i = 1; i < runs.length; i++) {
    const prev = runs[i - 1];
    const cur = runs[i];
    if (prev.label === cur.label) continue;
    if (prev.label == null || cur.label == null) continue;
    const prevLen = prev.endFrame - prev.startFrame + 1;
    const curLen = cur.endFrame - cur.startFrame + 1;
    // Confidence proxy: harmonic mean of adjacent run lengths. Penalises
    // a long run against a 1-frame blip more than arithmetic mean would.
    const confidence = (2 * prevLen * curLen) / (prevLen + curLen);
    transitions.push({ frame: cur.startFrame, label: cur.label, confidence });
  }
  if (transitions.length <= expectedTransitions) return transitions;
  // Too many transitions — keep the most confident ones, then re-sort by
  // time so the boundary order is preserved.
  return transitions
    .slice()
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, expectedTransitions)
    .sort((a, b) => a.frame - b.frame);
}

// Round to 3 decimal places (matches the existing manifest's precision).
export function round3(n) {
  return Math.round(n * 1000) / 1000;
}

// Main entry: given a decoded conversation, the line transcript, the two
// hero centroids, and the silences detected in the conversation, return
// per-line {start, duration} ranges or null on failure.
//
// `silences` is an array of {start, end} in seconds (from ffmpeg
// silencedetect). `headSilenceEnd` and `tailSilenceStart` are where speech
// actually starts and ends (so we don't include lead-in / fade-out).
export async function diarizeAndSplit({
  audioPath,
  lines,
  centroidA,
  centroidB,
  stats,
  silences,
  headSilenceEnd = 0,
  tailSilenceStart = null,
}) {
  if (!centroidA || !centroidB) return { ok: false, reason: "no_centroids" };
  if (!stats) return { ok: false, reason: "no_stats" };
  const lineCount = lines.length;
  if (lineCount < 2) return { ok: false, reason: "single_line" };

  // Speakers should strictly alternate for current Deadlockle dialogue
  // pool — but stay general: count actual transitions in the line list.
  let expectedTransitions = 0;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].speaker !== lines[i - 1].speaker) expectedTransitions++;
  }
  // For now we only handle all-alternating (the fingerprint signal can't
  // tell us where to split two same-speaker lines without falling back
  // to silence — caller should detect this and route elsewhere).
  if (expectedTransitions !== lineCount - 1) {
    return { ok: false, reason: "consecutive_same_speaker" };
  }

  const pcm = await decodePcm(audioPath);
  const totalDuration = pcm.length / SAMPLE_RATE;
  if (tailSilenceStart == null) tailSilenceStart = totalDuration;

  const { frames, times } = computeMfccFrames(pcm);
  if (frames.length < 50) return { ok: false, reason: "too_few_frames" };

  const energies = computeFrameEnergies(pcm);
  const standardized = frames.map((f) => standardizeFrame(f, stats));
  const cls = classifyFrames(standardized, energies, centroidA, centroidB);
  if (!cls) return { ok: false, reason: "classify_failed" };

  // 1-second majority-vote smoothing. Speech sounds within a single
  // speaker's utterance can land on either side of the cluster boundary
  // (vowel timbre vs consonant noise vs onset transient), so per-frame
  // classification is fundamentally jittery. Lines are typically 1-3s,
  // so a 1s smoothing window suppresses sub-second noise without
  // erasing real handoffs.
  const smoothed = smoothLabels(cls.labels, 100);
  const filled = fillGaps(smoothed);
  const runs = findRuns(filled);
  const transitions = pickTransitions(runs, expectedTransitions);

  if (transitions.length !== expectedTransitions) {
    return {
      ok: false,
      reason: `wrong_transition_count (${transitions.length} vs ${expectedTransitions})`,
    };
  }

  // Sanity: consecutive transitions must alternate labels for an
  // alternating sequence. If they don't, the diarization disagrees with
  // the transcript — bail.
  let expectedLabel = lines[1].speaker;
  for (const t of transitions) {
    if (t.label !== expectedLabel) {
      return { ok: false, reason: "label_sequence_mismatch" };
    }
    expectedLabel = expectedLabel === 0 ? 1 : 0;
  }

  // Snap each transition to the nearest silence (within 0.6s window).
  // Boundary should fall during an inter-line silence so playback excludes
  // the pause and starts on speech. If no nearby silence, use the
  // transition time directly — better than nothing, even if a bit blunt.
  const SNAP_WINDOW = 0.6;
  const boundaries = [];
  for (const t of transitions) {
    const tSec = times[t.frame];
    let chosen = null;
    let chosenDist = Infinity;
    for (const s of silences) {
      // Use silence midpoint as the reference; a transition near that
      // midpoint will pick it up regardless of which end is closer.
      const mid = (s.start + s.end) / 2;
      const d = Math.abs(mid - tSec);
      if (d < chosenDist && d <= SNAP_WINDOW) {
        chosen = s;
        chosenDist = d;
      }
    }
    if (chosen) {
      boundaries.push({ silenceStart: chosen.start, silenceEnd: chosen.end });
    } else {
      // Fall back to the transition time itself, with a synthetic 0-len
      // silence so range building still works.
      boundaries.push({ silenceStart: tSec, silenceEnd: tSec });
    }
  }

  // Build ranges. line[i] = (prevSilenceEnd, nextSilenceStart).
  const ranges = [];
  let prevEnd = headSilenceEnd;
  for (const b of boundaries) {
    const start = prevEnd;
    const end = b.silenceStart;
    if (end - start <= 0.15) {
      return { ok: false, reason: "segment_too_short" };
    }
    ranges.push({ start: round3(start), duration: round3(end - start) });
    prevEnd = b.silenceEnd;
  }
  const finalDur = tailSilenceStart - prevEnd;
  if (finalDur <= 0.15) {
    return { ok: false, reason: "trailing_segment_too_short" };
  }
  ranges.push({ start: round3(prevEnd), duration: round3(finalDur) });
  return { ok: true, ranges };
}

// ---------- voiceprint cache ----------
//
// Building a centroid for each hero requires decoding all of their
// voicelines + computing MFCC over every frame. That work is independent
// of conversation processing and shouldn't be repeated each run. Persist
// the centroids to data/voiceprints.json.

// Decode a hero's voiceline clips and return the speech-only MFCC frames
// (raw, unstandardized). Voiceprint construction is split into two passes
// — gather frames first (so we can compute global standardization stats
// across all heroes), then standardize and average per hero. A single
// hero may contribute hundreds of speech frames.
export async function gatherHeroFrames(heroKey, clipPaths) {
  const collected = [];
  for (const p of clipPaths) {
    try {
      const pcm = await decodePcm(p);
      const energies = computeFrameEnergies(pcm);
      const sortedE = [...energies].sort((a, b) => a - b);
      const energyFloor = sortedE[Math.floor(sortedE.length * 0.3)];
      const { frames } = computeMfccFrames(pcm);
      for (let i = 0; i < frames.length; i++) {
        if (energies[i] < energyFloor) continue;
        collected.push(frames[i]);
      }
    } catch (e) {
      console.log(`    [skip ${heroKey} clip ${p.split("/").pop()}: ${e.message}]`);
    }
  }
  return collected;
}

// Given a hero's speech-only MFCC frames AND the global standardization
// stats (computed across the union of all heroes' frames), return that
// hero's standardized centroid. Returns null if too few frames.
export function buildStandardizedCentroid(rawFrames, stats) {
  if (rawFrames.length < 50) return null;
  const dim = MFCC_COEFS - 1;
  const sum = new Float64Array(dim);
  for (const f of rawFrames) {
    const z = standardizeFrame(f, stats);
    for (let k = 0; k < dim; k++) sum[k] += z[k];
  }
  const centroid = new Float64Array(dim);
  for (let k = 0; k < dim; k++) centroid[k] = sum[k] / rawFrames.length;
  return centroid;
}

// Voiceprint cache stores both the global standardization (mean + std
// across all heroes' speech frames) AND each hero's standardized centroid.
// Standardization MUST be the same at build time and classify time —
// shipping it alongside the centroids guarantees that.
export async function loadVoiceprintCache(path) {
  try {
    const raw = await readFile(path, "utf-8");
    const data = JSON.parse(raw);
    const centroids = new Map();
    if (data.centroids) {
      for (const k of Object.keys(data.centroids)) {
        centroids.set(k, Float64Array.from(data.centroids[k]));
      }
    }
    const stats = data.stats
      ? {
          mean: Float64Array.from(data.stats.mean),
          std: Float64Array.from(data.stats.std),
        }
      : null;
    return { centroids, stats };
  } catch {
    return { centroids: new Map(), stats: null };
  }
}

export async function saveVoiceprintCache(path, centroids, stats) {
  const obj = {
    stats: stats
      ? { mean: Array.from(stats.mean), std: Array.from(stats.std) }
      : null,
    centroids: {},
  };
  for (const [k, v] of centroids.entries()) {
    obj.centroids[k] = Array.from(v);
  }
  await writeFile(path, JSON.stringify(obj, null, 2));
}
