// Conversation mode (slug "sound") data: hero pairs + dialogue lines +
// recorded conversation audio, sourced from deadlock.wiki via
// scripts/build-conversation-audio.mjs. Audio is the actual recording for
// the dialogue shown — when the hint unlocks, players hear those exact
// lines spoken by those exact heroes.

import data from "@/data/sound-conversations.json";

export type SoundLine = {
  // 0 = first speaker, 1 = second speaker. Same convention as Quote mode's
  // hand-curated conversations.ts so guess plumbing is shared.
  speaker: 0 | 1;
  text: string;
  // Time slice within the conversation MP3 that holds just this line.
  // Computed by scripts/build-conversation-audio.mjs via ffmpeg silence
  // detection. Frontend uses these to seek + play per-line audio.
  audioStart: number;
  audioDuration: number;
};

export type SoundConversation = {
  speakers: [string, string]; // hero keys; index matches `speaker` on each line
  audio: string;              // public-relative URL, e.g. /voicelines/conversations/atlas_inferno_2.mp3
  bytes: number;              // size of the transcoded mp3 — exposed for diagnostics only
  lines: SoundLine[];
};

export const SOUND_CONVERSATIONS: SoundConversation[] =
  data as SoundConversation[];
