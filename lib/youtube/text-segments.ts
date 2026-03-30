import { type ChannelWidget, type VideoChip, youtubeRe } from "./utils";

export type TextSegment =
  | { type: "plain"; text: string }
  | { type: "active"; text: string; handle: string }
  | {
      handle: any;
      type: "duplicate-channel";
      text: string;
    }
  | { type: "youtube-url"; text: string; videoId: string }
  | { type: "cameo"; text: string };

const CAMEO_RE = /#(me|cameo)\b/gi;

const MENTION_RE = /@([\w.-]*)/g;

export function getTextSegments(
  text: string,
  channelWidgets: Map<string, ChannelWidget>,
  chips: VideoChip[],
): TextSegment[] {
  type RawMatch = { start: number; end: number; segment: TextSegment };
  const matches: RawMatch[] = [];

  let m: RegExpExecArray | null;

  const cameoRe = new RegExp(CAMEO_RE.source, "gi");
  while ((m = cameoRe.exec(text)) !== null) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      segment: { type: "cameo", text: m[0] },
    });
  }

  const mentionRe = new RegExp(MENTION_RE.source, "g");
  const seenHandles = new Set<string>();
  while ((m = mentionRe.exec(text)) !== null) {
    const mentionText = m[0];
    const handle = m[1];
    if (!channelWidgets.has(handle)) continue;
    if (seenHandles.has(handle)) {
      matches.push({
        start: m.index,
        end: m.index + mentionText.length,
        segment: { type: "duplicate-channel", text: mentionText, handle },
      });
      continue;
    }
    seenHandles.add(handle);
    matches.push({
      start: m.index,
      end: m.index + mentionText.length,
      segment: { type: "active", text: mentionText, handle },
    });
  }

  const ytRe = youtubeRe();
  while ((m = ytRe.exec(text)) !== null) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      segment: { type: "youtube-url", text: m[0], videoId: m[1] },
    });
  }

  for (const chip of chips) {
    if (chip.stage !== "found") continue;
    const idx = text.indexOf(chip.title);
    if (idx === -1) continue;
    matches.push({
      start: idx,
      end: idx + chip.title.length,
      segment: { type: "youtube-url", text: chip.title, videoId: chip.videoId },
    });
  }

  matches.sort((a, b) => a.start - b.start);

  const segments: TextSegment[] = [];
  let last = 0;
  for (const { start, end, segment } of matches) {
    if (start < last) continue;
    if (start > last)
      segments.push({ type: "plain", text: text.slice(last, start) });
    segments.push(segment);
    last = end;
  }
  if (last < text.length)
    segments.push({ type: "plain", text: text.slice(last) });
  return segments;
}
