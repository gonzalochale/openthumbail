export type VideoData = {
  videoId: string;
  title: string;
  thumbnailUrl: string;
};

export type ChannelThumbnail = {
  videoId: string;
  url: string;
  title: string;
};

export type ChannelReference = {
  handle: string;
  thumbnails: ChannelThumbnail[];
};

export type VideoChip =
  | { stage: "loading"; videoId: string; originalUrl: string }
  | { stage: "found"; videoId: string; title: string; originalUrl: string }
  | { stage: "error"; videoId: string; originalUrl: string };

export type ChannelWidget =
  | { stage: "loading"; handle: string }
  | { stage: "found"; ref: ChannelReference }
  | { stage: "empty"; handle: string }
  | { stage: "error"; handle: string };

export function ytThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function truncateTitle(title: string, maxLength: number): string {
  return title.length > maxLength
    ? title.slice(0, maxLength - 1) + "…"
    : title;
}

export const YOUTUBE_URL_RE =
  /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?(?:\S*?&)?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})[^\s]*/;

export function youtubeRe() {
  return new RegExp(YOUTUBE_URL_RE.source, "g");
}

export function stripVideoChips(text: string, chips: VideoChip[]): string {
  let out = text;
  for (const chip of chips) {
    if (chip.stage === "found") out = out.replace(chip.title, "");
  }
  return out
    .replace(youtubeRe(), "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function extractYouTubeMatches(
  text: string,
): Array<{ videoId: string; matchedUrl: string }> {
  const matches: Array<{ videoId: string; matchedUrl: string }> = [];
  const re = youtubeRe();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (!matches.some((x) => x.videoId === m![1]))
      matches.push({ videoId: m[1], matchedUrl: m[0] });
  }
  return matches;
}

export function countChannelThumbnails(
  widgets: Map<string, ChannelWidget>,
): number {
  return [...widgets.values()].reduce(
    (sum, w) => sum + (w.stage === "found" ? w.ref.thumbnails.length : 0),
    0,
  );
}
