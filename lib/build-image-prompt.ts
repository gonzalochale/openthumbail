import {
  CHANNEL_STYLE_INSTRUCTION,
  VIDEO_STYLE_INSTRUCTION,
} from "@/lib/constants";

export interface ReferenceImage {
  imageBase64: string;
  mimeType: string;
}

export interface ChannelRef {
  urls: string[];
  handle: string;
}

export interface VideoRef {
  url: string;
}

export interface PreviousVersion {
  imageBase64: string;
  mimeType: string;
  enhancedPrompt: string | null;
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
  channelRefs = [],
  channelImageGroups,
  videoRefs = [],
  videoImageGroups,
  previousVersion,
}: {
  safePrompt: string;
  channelRefs?: ChannelRef[];
  channelImageGroups: ReferenceImage[][];
  videoRefs?: VideoRef[];
  videoImageGroups: ReferenceImage[][];
  previousVersion?: PreviousVersion;
}): { text: string; images: Buffer[] } {
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

    enriched = enriched.replace(pat, "the style from the reference images");
    imgIdx += fetchedCount;
  }

  for (const [i] of videoRefs.entries()) {
    const fetchedCount = videoImageGroups[i]?.length ?? 0;
    if (fetchedCount === 0) continue;
    imageGuide.push(
      `Image ${imgIdx}: Video thumbnail — ${VIDEO_STYLE_INSTRUCTION}`,
    );
    imgIdx++;
  }

  const photorealismPreamble = `Generate a high-quality, PHOTOREALISTIC YouTube thumbnail (16:9). Do NOT produce cartoons, illustrations, anime, or drawings unless the prompt explicitly requests that art style.`;
  const thumbnailPostamble = `The result should look like a professional YouTube thumbnail: bold composition, high contrast, strong visual hierarchy, and immediately eye-catching.`;

  let imagePromptText = enriched;

  if (hasPreviousVersion) {
    const prevLine = `Image 1: Previously generated thumbnail — this is the base to edit. Preserve ALL visual elements that are not explicitly changed: composition, colors, style, faces, text overlays, and layout. Apply ONLY the changes described in the instruction below.`;
    const guide = [prevLine, ...imageGuide].filter(Boolean).join("\n");
    imagePromptText =
      `${guide}\n\n` +
      `Instruction: ${imagePromptText}\n\n` +
      thumbnailPostamble;
  } else if (hasReferenceImages) {
    imagePromptText =
      `${photorealismPreamble}\n\n` +
      `${imageGuide.join("\n")}\n\n` +
      `Generate a new original YouTube thumbnail.\n\n` +
      `Instruction: ${imagePromptText}\n\n` +
      thumbnailPostamble;
  } else {
    imagePromptText =
      `${photorealismPreamble}\n\n` +
      `Instruction: ${imagePromptText}\n\n` +
      thumbnailPostamble;
  }

  const allImages: Buffer[] = [
    ...(hasPreviousVersion
      ? [Buffer.from(previousVersion.imageBase64, "base64")]
      : []),
    ...(hasReferenceImages
      ? allReferenceImages.map((r) => Buffer.from(r.imageBase64, "base64"))
      : []),
  ];

  return { text: imagePromptText, images: allImages };
}
