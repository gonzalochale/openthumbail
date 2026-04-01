import {
  CAMEO_INSTRUCTION,
  CAMEO_POSTAMBLE,
  CHANNEL_STYLE_INSTRUCTION,
  DEFAULT_POSTAMBLE,
  MAX_TOTAL_IMAGES,
  NO_TEXT_RULE,
  PHOTOREALISM_PREAMBLE,
  REFERENCE_IMAGES_WARNING,
  REFERENCE_APPLICATION_RULES,
  THUMBNAIL_COMPOSITION_PRIORITIES,
  VIDEO_STYLE_INSTRUCTION,
} from "@/lib/constants";
import type {
  ChannelRef,
  PreviousVersion,
  ReferenceImage,
  VideoRef,
} from "@/lib/generation/types";

export type { ChannelRef, PreviousVersion, ReferenceImage, VideoRef };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceVideoTitleMentions({
  input,
  title,
  replacement,
}: {
  input: string;
  title?: string;
  replacement: string;
}): string {
  if (!title) return input;
  const normalizedTitle = title.trim();
  if (!normalizedTitle) return input;

  const escaped = escapeRegExp(normalizedTitle);
  const patterns = [
    new RegExp(`\"${escaped}\"`, "gi"),
    new RegExp(`'${escaped}'`, "gi"),
    new RegExp(`(^|[^\\w])${escaped}([^\\w]|$)`, "gi"),
  ];

  let out = input;
  for (const pattern of patterns) {
    out = out.replace(pattern, (full, pre, post) => {
      if (typeof pre === "string" && typeof post === "string") {
        return `${pre}${replacement}${post}`;
      }
      return replacement;
    });
  }

  return out;
}

export async function fetchImages(urls: string[]): Promise<ReferenceImage[]> {
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Failed to fetch image: ${url}`);
      const buf = await r.arrayBuffer();
      return {
        imageBase64: Buffer.from(buf).toString("base64"),
        mimeType: "image/jpeg",
      } satisfies ReferenceImage;
    }),
  );
  return results
    .filter(
      (r): r is PromiseFulfilledResult<ReferenceImage> =>
        r.status === "fulfilled",
    )
    .map((r) => r.value);
}

export function buildImagePrompt({
  safePrompt,
  userPrompt,
  channelRefs = [],
  channelImageGroups,
  videoRefs = [],
  videoImageGroups,
  previousVersion,
  excludePreviousImage = false,
  cameoImages,
}: {
  safePrompt: string;
  userPrompt?: string;
  channelRefs?: ChannelRef[];
  channelImageGroups: ReferenceImage[][];
  videoRefs?: VideoRef[];
  videoImageGroups: ReferenceImage[][];
  previousVersion?: PreviousVersion;
  excludePreviousImage?: boolean;
  cameoImages?: ReferenceImage[];
}): { text: string; images: ReferenceImage[] } {
  const hasCameo = cameoImages && cameoImages.length > 0;
  const allReferenceImages = [
    ...(hasCameo ? cameoImages : []),
    ...channelImageGroups.flat(),
    ...videoImageGroups.flat(),
  ];
  const hasReferenceImages = allReferenceImages.length > 0;
  const hasPreviousVersion = !!previousVersion;

  const imageGuide: string[] = [];
  let enriched = safePrompt;
  let imgIdx = hasPreviousVersion ? 2 : 1;
  const usedChannelHandles: string[] = [];

  if (hasCameo) {
    imageGuide.push(CAMEO_INSTRUCTION(imgIdx));
    imgIdx += 1;
  }

  for (const [i, ch] of channelRefs.entries()) {
    const fetchedCount = channelImageGroups[i]?.length ?? 0;
    if (fetchedCount === 0) continue;
    usedChannelHandles.push(ch.handle);
    const end = imgIdx + fetchedCount - 1;
    const range =
      fetchedCount === 1 ? `Image ${imgIdx}` : `Images ${imgIdx}–${end}`;
    imageGuide.push(
      `${range}: Thumbnails from @${ch.handle} — ${CHANNEL_STYLE_INSTRUCTION} Match the packaging language of this channel: focal framing, emotional intensity, color hierarchy, and thumbnail "readability" at small sizes.`,
    );
    const pat = new RegExp(`@${escapeRegExp(ch.handle)}`, "gi");
    const replacement =
      fetchedCount === 1
        ? `the packaging style from Image ${imgIdx}`
        : `the packaging style blended from Images ${imgIdx}–${end}`;
    enriched = enriched.replace(pat, replacement);
    imgIdx += fetchedCount;
  }

  if (usedChannelHandles.length > 1) {
    imageGuide.push(
      `When multiple channel references are present (${usedChannelHandles.map((h) => `@${h}`).join(", ")}), blend only their shared visual principles instead of cloning any single source. Prioritize clarity, contrast, and clickability.`,
    );
  }

  const videoEntries: { startIdx: number; endIdx: number; title?: string }[] =
    [];
  for (const [i, vr] of videoRefs.entries()) {
    const fetchedCount = videoImageGroups[i]?.length ?? 0;
    if (fetchedCount === 0) continue;
    const startIdx = imgIdx;
    const endIdx = imgIdx + fetchedCount - 1;
    videoEntries.push({ startIdx, endIdx, title: vr.title });

    const titleReplacement =
      fetchedCount === 1
        ? `topic and style cues from Image ${startIdx}`
        : `topic and style cues from Images ${startIdx}–${endIdx}`;
    enriched = replaceVideoTitleMentions({
      input: enriched,
      title: vr.title,
      replacement: titleReplacement,
    });

    imgIdx += fetchedCount;
  }
  if (videoEntries.length === 1) {
    const { startIdx, endIdx, title } = videoEntries[0];
    const range =
      startIdx === endIdx
        ? `Image ${startIdx}`
        : `Images ${startIdx}–${endIdx}`;
    const titleContext = title ? ` (video: "${title}")` : "";
    imageGuide.push(
      `${range}: Video thumbnail${titleContext} — ${VIDEO_STYLE_INSTRUCTION} Extract storytelling cues from this reference (subject choice, mood, and visual hook), but keep every asset original.`,
    );
  } else if (videoEntries.length > 1) {
    const first = videoEntries[0].startIdx;
    const last = videoEntries[videoEntries.length - 1].endIdx;
    const titles = videoEntries
      .filter((e) => e.title)
      .map((e) => `"${e.title}"`)
      .join(", ");
    const titleContext = titles ? ` (videos: ${titles})` : "";
    imageGuide.push(
      `Images ${first}–${last}: Video thumbnails${titleContext} — ${VIDEO_STYLE_INSTRUCTION} Treat this set as a multi-reference board: combine recurring motifs and avoid over-indexing on any single video.`,
    );
  }

  if (videoEntries.length > 0) {
    imageGuide.push(
      `Use video references primarily to infer topical motifs and emotional angle. Use channel references primarily for packaging style (layout rhythm, emphasis, and contrast strategy).`,
    );
  }

  let imagePromptText = enriched;

  const globalGuideLines = [THUMBNAIL_COMPOSITION_PRIORITIES];

  if (hasReferenceImages) {
    globalGuideLines.push(REFERENCE_APPLICATION_RULES);
  }

  if (hasPreviousVersion) {
    const isUploadedStartingImage = previousVersion.enhancedPrompt === null;
    const prevLine = isUploadedStartingImage
      ? `Image 1: Starting image provided by the user. Use its content as the primary subject. If it contains people, reproduce their faces, appearance, and clothing EXACTLY as shown — do not alter, idealize, or replace them with generic faces. If it contains objects, scenery, or animals, preserve them faithfully as the main visual elements. Compose a professional YouTube thumbnail around this content.`
      : `Image 1: Previously generated thumbnail — use as the base for editing.`;
    const postamble = isUploadedStartingImage
      ? `The result should look like a professional YouTube thumbnail: bold composition, high contrast, strong visual hierarchy, and immediately eye-catching. The content of Image 1 is the main subject — reproduce it faithfully. If it contains people, their faces and appearance must be identical to Image 1. If it contains objects or scenery, preserve them accurately. ${NO_TEXT_RULE}`
      : `Apply the user's edit precisely. Remove only what is explicitly mentioned. Add only what is explicitly requested. Keep all other elements from Image 1 exactly as they appear: composition, lighting, people, colors, and background. ${NO_TEXT_RULE}`;
    const guide = [prevLine, ...globalGuideLines, ...imageGuide].join("\n");
    imagePromptText = isUploadedStartingImage
      ? `${guide}\n\nInstruction: ${imagePromptText}\n\n${postamble}`
      : `${guide}\n\nUser's edit request: ${userPrompt ?? imagePromptText}\nTarget state: ${imagePromptText}\n\n${postamble}`;
  } else if (hasReferenceImages) {
    const postamble = hasCameo ? CAMEO_POSTAMBLE : DEFAULT_POSTAMBLE;
    const warning = hasCameo ? "" : `${REFERENCE_IMAGES_WARNING}\n\n`;
    imagePromptText =
      `${PHOTOREALISM_PREAMBLE}\n\n` +
      warning +
      `${globalGuideLines.join("\n")}\n\n` +
      `${imageGuide.join("\n")}\n\n` +
      `Generate a new original YouTube thumbnail.\n\n` +
      `Instruction: ${imagePromptText}\n\n` +
      postamble;
  } else {
    imagePromptText =
      `${PHOTOREALISM_PREAMBLE}\n\n` +
      `${globalGuideLines.join("\n")}\n\n` +
      `Instruction: ${imagePromptText}\n\n` +
      DEFAULT_POSTAMBLE;
  }

  const allImages: ReferenceImage[] = [
    ...(hasPreviousVersion && !excludePreviousImage
      ? [
          {
            imageBase64: previousVersion.imageBase64,
            mimeType: previousVersion.mimeType,
          },
        ]
      : []),
    ...(hasReferenceImages ? allReferenceImages : []),
  ];

  return {
    text: imagePromptText,
    images: allImages.slice(0, MAX_TOTAL_IMAGES),
  };
}
