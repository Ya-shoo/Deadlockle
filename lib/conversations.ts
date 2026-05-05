// Hand-curated hero-vs-hero conversations sourced from
// deadlock.wiki/<Hero>/Quotes pages and interleaved into the two-speaker
// dialogue model OWdle uses (alternating speaker indices on each line).
//
// Curation rule: lines must NOT contain the OTHER speaker's name, nickname,
// or unique identifier (Bartender / Sniper / Sandman / sheriff / detective /
// "body back" / "iron body" / etc.) — those would spoil the puzzle.
// Speaker self-identifying lines are fine. Paraphrase or drop any line where
// the spoiler can't be cleanly stripped.

export type ConversationLine = {
  // 0 = first speaker, 1 = second speaker.
  speaker: 0 | 1;
  text: string;
};

export type Conversation = {
  speakers: [string, string]; // hero keys; index matches `speaker` on each line
  context?: string;
  lines: ConversationLine[];
};

export const CONVERSATIONS: Conversation[] = [
  {
    speakers: ["abrams", "infernus"],
    context: "Pre-match",
    lines: [
      { speaker: 0, text: "So when's the last time you went to Ixia?" },
      { speaker: 1, text: "New York born and raised, baby!" },
      {
        speaker: 0,
        text: "Next time you're pouring me drinks, remember all the times I saved your life today.",
      },
      { speaker: 1, text: "You got it, buddy!" },
    ],
  },
  {
    speakers: ["abrams", "wraith"],
    context: "Pre-match",
    lines: [
      { speaker: 0, text: "Missed you at the game." },
      {
        speaker: 1,
        text: "Yeah yeah, wrong hands, blah blah — you're not the chosen one. You're just a guy who was dealt a bad hand.",
      },
      { speaker: 0, text: "Just sell the damn book already." },
    ],
  },
  {
    speakers: ["abrams", "lash"],
    context: "Pre-match",
    lines: [
      {
        speaker: 1,
        text: "Just remember to say thank you when this is all over.",
      },
      { speaker: 0, text: "After we win, I'm gonna punch you in the face!" },
      { speaker: 1, text: "Probably not gonna remember that." },
    ],
  },
  {
    speakers: ["infernus", "wraith"],
    context: "Pre-match",
    lines: [
      { speaker: 0, text: "I don't." },
      { speaker: 1, text: "It's ok, you can say it. That you miss me." },
      {
        speaker: 0,
        text: "Practice that line more so that next time you say it, I might believe you.",
      },
    ],
  },
  {
    speakers: ["lady-geist", "abrams"],
    context: "Pre-match",
    lines: [
      { speaker: 0, text: "You're a rather dour bastard, aren't you?" },
      { speaker: 1, text: "Nice arm." },
      {
        speaker: 0,
        text: "If I thought we were dealing with anyone competent, maybe I'd be worried.",
      },
    ],
  },
  {
    speakers: ["lady-geist", "wraith"],
    context: "Pre-match",
    lines: [
      { speaker: 0, text: "You'll never be accepted in polite society." },
      { speaker: 1, text: "I worked for what I have. It wasn't handed to me." },
      { speaker: 0, text: "I expected more from you." },
    ],
  },
  {
    speakers: ["abrams", "vindicta"],
    context: "Pre-match",
    lines: [
      { speaker: 0, text: "You need me to buy you a pair of shoes?" },
      { speaker: 1, text: "Don't worry, I'll do my part." },
      { speaker: 0, text: "I'm trusting you to help keep me alive." },
    ],
  },
  {
    speakers: ["paradox", "lady-geist"],
    context: "Pre-match",
    lines: [
      { speaker: 1, text: "I want it back." },
      {
        speaker: 0,
        text: "We already robbed you. You're exactly the person to play games with.",
      },
      {
        speaker: 1,
        text: "It was a multi-million exhibition with the emotional depth of a 10th grader.",
      },
    ],
  },
  {
    speakers: ["mcginnis", "lady-geist"],
    context: "Pre-match",
    lines: [
      { speaker: 1, text: "You smell of motor oil and labor." },
      {
        speaker: 0,
        text: "You're dressed practically. Seriously, how do you think you're gonna fight in that?",
      },
      { speaker: 1, text: "Your concerns are as unwanted as they are unneeded." },
    ],
  },
  {
    speakers: ["holliday", "vindicta"],
    context: "Pre-match",
    lines: [
      { speaker: 0, text: "How good are you at hitting moving targets?" },
      {
        speaker: 1,
        text: "When this is over, you are more than welcome to try.",
      },
      { speaker: 0, text: "You know I have to arrest you now?" },
    ],
  },
  {
    speakers: ["holliday", "lady-geist"],
    context: "Pre-match",
    lines: [
      { speaker: 1, text: "Your clothes. They're horrible." },
      { speaker: 0, text: "You're a monster." },
      {
        speaker: 1,
        text: "You've done some horrible things, and one day I intend to find out what.",
      },
    ],
  },
  {
    speakers: ["holliday", "paradox"],
    context: "Pre-match",
    lines: [
      {
        speaker: 0,
        text: "Don't trust the OSIC. Their goals and your goals are not in alignment.",
      },
      { speaker: 1, text: "Welcome to New York!" },
      { speaker: 0, text: "You think I keep this on all the time?" },
    ],
  },
  {
    speakers: ["haze", "holliday"],
    context: "Pre-match",
    lines: [
      { speaker: 1, text: "I have a file?" },
      {
        speaker: 0,
        text: "Don't worry. I think our partnership will be good for everyone.",
      },
      { speaker: 1, text: "You sleep'em, I grab'em, you shoot'em." },
    ],
  },
  {
    speakers: ["yamato", "bebop"],
    context: "Pre-match",
    lines: [
      { speaker: 0, text: "I heard you know how to fight." },
      { speaker: 1, text: "Family is important." },
      { speaker: 0, text: "Don't disappoint me." },
    ],
  },
  {
    speakers: ["dynamo", "holliday"],
    context: "Pre-match",
    lines: [
      {
        speaker: 1,
        text: "Yeah, well I hope local law enforcement feels the same way.",
      },
      {
        speaker: 0,
        text: "I'm glad you're here. The city's gonna need your expertise.",
      },
      { speaker: 1, text: "I'm happy to drag back anyone you miss." },
    ],
  },
  {
    speakers: ["kelvin", "infernus"],
    context: "Pre-match",
    lines: [
      { speaker: 0, text: "I look forward to celebrating with you there." },
      { speaker: 1, text: "I was born in New York. 'Home' is right here." },
      { speaker: 0, text: "Have faith. We won't fail." },
    ],
  },
  {
    speakers: ["kelvin", "mcginnis"],
    context: "Pre-match",
    lines: [
      { speaker: 0, text: "We're gonna do quite well!" },
      {
        speaker: 1,
        text: "Hope your back's strong, because we are gonna be carrying this team.",
      },
      { speaker: 0, text: "I'll keep that in mind." },
    ],
  },
];
