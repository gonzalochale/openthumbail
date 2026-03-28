import {
  CHANNEL_STYLE_INSTRUCTION,
  DEFAULT_POSTAMBLE,
  NO_TEXT_RULE,
  PHOTOREALISM_PREAMBLE,
  REFERENCE_IMAGES_WARNING,
  VIDEO_STYLE_INSTRUCTION,
} from "@/lib/constants";
import type {
  ChannelRef,
  PreviousVersion,
  ReferenceImage,
  VideoRef,
} from "@/lib/generation-types";

export type { ChannelRef, PreviousVersion, ReferenceImage, VideoRef };

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
}: {
  safePrompt: string;
  userPrompt?: string;
  channelRefs?: ChannelRef[];
  channelImageGroups: ReferenceImage[][];
  videoRefs?: VideoRef[];
  videoImageGroups: ReferenceImage[][];
  previousVersion?: PreviousVersion;
  excludePreviousImage?: boolean;
}): { text: string; images: ReferenceImage[] } {
  const allReferenceImages = [
    ...channelImageGroups.flat(),
    ...videoImageGroups.flat(),
  ];
  const hasReferenceImages = allReferenceImages.length > 0;
  const hasPreviousVersion = !!previousVersion;

  const imageGuide: string[] = [];
  let enriched = safePrompt;
  let imgIdx = hasPreviousVersion ? 2 : 1;

  for (const [i, ch] of channelRefs.entries()) {
    const fetchedCount = channelImageGroups[i]?.length ?? 0;
    if (fetchedCount === 0) continue;
    const end = imgIdx + fetchedCount - 1;
    const range =
      fetchedCount === 1 ? `Image ${imgIdx}` : `Images ${imgIdx}–${end}`;
    imageGuide.push(
      `${range}: Thumbnails from @${ch.handle} — ${CHANNEL_STYLE_INSTRUCTION}`,
    );
    const pat = new RegExp(
      `@${ch.handle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
      "gi",
    );
    const replacement =
      fetchedCount === 1
        ? `the visual style from Image ${imgIdx}`
        : `the visual style from Images ${imgIdx}–${end}`;
    enriched = enriched.replace(pat, replacement);
    imgIdx += fetchedCount;
  }

  const videoEntries: { imgIdx: number; title?: string }[] = [];
  for (const [i, vr] of videoRefs.entries()) {
    const fetchedCount = videoImageGroups[i]?.length ?? 0;
    if (fetchedCount === 0) continue;
    videoEntries.push({ imgIdx, title: vr.title });
    imgIdx++;
  }
  if (videoEntries.length === 1) {
    const { imgIdx: idx, title } = videoEntries[0];
    const titleContext = title ? ` (video: "${title}")` : "";
    imageGuide.push(
      `Image ${idx}: Video thumbnail${titleContext} — ${VIDEO_STYLE_INSTRUCTION}`,
    );
  } else if (videoEntries.length > 1) {
    const first = videoEntries[0].imgIdx;
    const last = videoEntries[videoEntries.length - 1].imgIdx;
    const titles = videoEntries
      .filter((e) => e.title)
      .map((e) => `"${e.title}"`)
      .join(", ");
    const titleContext = titles ? ` (videos: ${titles})` : "";
    imageGuide.push(
      `Images ${first}–${last}: Video thumbnails${titleContext} — ${VIDEO_STYLE_INSTRUCTION} Do not over-index on any single video's style; treat these as a combined aesthetic reference.`,
    );
  }

  let imagePromptText = enriched;

  if (hasPreviousVersion) {
    const isUploadedStartingImage = previousVersion.enhancedPrompt === null;
    const prevLine = isUploadedStartingImage
      ? `Image 1: Starting image provided by the user. Use its content as the primary subject. If it contains people, reproduce their faces, appearance, and clothing EXACTLY as shown — do not alter, idealize, or replace them with generic faces. If it contains objects, scenery, or animals, preserve them faithfully as the main visual elements. Compose a professional YouTube thumbnail around this content.`
      : `Image 1: Previously generated thumbnail — use as the base for editing.`;
    const postamble = isUploadedStartingImage
      ? `The result should look like a professional YouTube thumbnail: bold composition, high contrast, strong visual hierarchy, and immediately eye-catching. The content of Image 1 is the main subject — reproduce it faithfully. If it contains people, their faces and appearance must be identical to Image 1. If it contains objects or scenery, preserve them accurately. ${NO_TEXT_RULE}`
      : `Apply the user's edit precisely. Remove only what is explicitly mentioned. Add only what is explicitly requested. Keep all other elements from Image 1 exactly as they appear: composition, lighting, people, colors, and background. ${NO_TEXT_RULE}`;
    const guide = [prevLine, ...imageGuide].join("\n");
    imagePromptText = isUploadedStartingImage
      ? `${guide}\n\nInstruction: ${imagePromptText}\n\n${postamble}`
      : `${guide}\n\nUser's edit request: ${userPrompt ?? imagePromptText}\nTarget state: ${imagePromptText}\n\n${postamble}`;
  } else if (hasReferenceImages) {
    imagePromptText =
      `${PHOTOREALISM_PREAMBLE}\n\n` +
      `${REFERENCE_IMAGES_WARNING}\n\n` +
      `${imageGuide.join("\n")}\n\n` +
      `Generate a new original YouTube thumbnail.\n\n` +
      `Instruction: ${imagePromptText}\n\n` +
      DEFAULT_POSTAMBLE;
  } else {
    imagePromptText =
      `${PHOTOREALISM_PREAMBLE}\n\n` +
      `Instruction: ${imagePromptText}\n\n` +
      DEFAULT_POSTAMBLE;
  }

  const allImages: ReferenceImage[] = [
    ...(hasPreviousVersion && !excludePreviousImage
      ? [{ imageBase64: previousVersion.imageBase64, mimeType: previousVersion.mimeType }]
      : []),
    ...(hasReferenceImages ? allReferenceImages : []),
  ];

  return { text: imagePromptText, images: allImages };
}
