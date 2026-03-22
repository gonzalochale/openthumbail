import { generateImage, generateText, Output } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { whitePng } from "@/lib/white-png";
import { auth } from "@/lib/auth";
import { deductCredit, refundCredit } from "@/lib/credits";
import { headers } from "next/headers";
import {
  CHANNEL_STYLE_INSTRUCTION,
  CREATE_IMAGES,
  IMAGE_MODEL,
  MAX_FILES,
  MAX_PROMPT_LENGTH,
  SAFETY_MODEL,
  THUMBNAIL_SYSTEM_PROMPT,
  VIDEO_STYLE_INSTRUCTION,
} from "@/lib/constants";

interface ReferenceImage {
  imageBase64: string;
  mimeType: string;
}

async function fetchImages(urls: string[]): Promise<ReferenceImage[]> {
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

const safetySchema = z.object({
  blocked: z.boolean(),
  reason: z.string().optional(),
  prompt: z.string().optional(),
});

interface PreviousVersion {
  imageBase64: string;
  mimeType: string;
  enhancedPrompt: string | null;
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    prompt,
    previousVersion,
    referenceImages,
    channelThumbnailUrls,
    channelHandle,
    videoThumbnailUrls,
  } = body as {
    prompt: string;
    previousVersion?: PreviousVersion;
    referenceImages?: ReferenceImage[];
    channelThumbnailUrls?: string[];
    channelHandle?: string;
    videoThumbnailUrls?: string[];
  };

  if (!prompt?.trim()) {
    return Response.json({ error: "Message is required" }, { status: 400 });
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return Response.json(
      {
        error: `Message exceeds maximum length of ${MAX_PROMPT_LENGTH} characters`,
      },
      { status: 400 },
    );
  }

  const [channelImages, videoImages] = await Promise.all([
    channelThumbnailUrls?.length ? fetchImages(channelThumbnailUrls) : [],
    videoThumbnailUrls?.length ? fetchImages(videoThumbnailUrls) : [],
  ]);
  const allReferenceImages = [
    ...(referenceImages ?? []),
    ...channelImages,
    ...videoImages,
  ].slice(0, MAX_FILES);

  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;

  if (!apiKey) {
    console.error("Missing Google AI Studio API key");
    return Response.json({ error: "Error generating image" }, { status: 500 });
  }

  const deducted = await deductCredit(session.user.id);
  if (!deducted) {
    return Response.json(
      { error: "Insufficient credits", code: "NO_CREDITS" },
      { status: 402 },
    );
  }

  try {
    if (!CREATE_IMAGES) {
      await new Promise((r) => setTimeout(r, 5000));
      return Response.json({
        image: whitePng(2560, 1440),
        mimeType: "image/png",
        enhancedPrompt: prompt,
      });
    }

    const google = createGoogleGenerativeAI({ apiKey });

    const { output } = await generateText({
      model: google(SAFETY_MODEL),
      system: THUMBNAIL_SYSTEM_PROMPT,
      prompt,
      output: Output.object({ schema: safetySchema }),
    });

    if (output.blocked) {
      await refundCredit(session.user.id);
      console.warn("Content blocked by safety filter:", output.reason);
      return Response.json(
        {
          error:
            output.reason ?? "Generated content violates safety guidelines",
        },
        { status: 422 },
      );
    }

    const safePrompt = output.prompt;
    if (!safePrompt) {
      await refundCredit(session.user.id);
      return Response.json(
        { error: "Failed to validate prompt" },
        { status: 500 },
      );
    }

    const hasReferenceImages = allReferenceImages.length > 0;
    const hasChannelThumbs =
      channelThumbnailUrls && channelThumbnailUrls.length > 0;
    const hasVideoThumbs = videoThumbnailUrls && videoThumbnailUrls.length > 0;
    const hasPreviousVersion = !!previousVersion;

    let imagePromptText = safePrompt;

    if (hasPreviousVersion && hasReferenceImages) {
      const userRefCount = (referenceImages ?? []).length;
      const channelRefCount = hasChannelThumbs
        ? channelThumbnailUrls.length
        : 0;
      const videoRefCount = hasVideoThumbs ? videoThumbnailUrls.length : 0;
      let refDesc = "";
      if (userRefCount > 0 && (channelRefCount > 0 || videoRefCount > 0)) {
        const styleDesc = [
          channelRefCount > 0
            ? `${channelRefCount} thumbnails from @${channelHandle ?? "unknown"}`
            : null,
          videoRefCount > 0
            ? `${videoRefCount} YouTube video thumbnail(s)`
            : null,
        ]
          .filter(Boolean)
          .join(" and ");
        refDesc =
          `${userRefCount} user-provided visual reference(s), followed by ${styleDesc} ` +
          `used as style-only references (colors, composition, typography — no faces or specific elements).`;
      } else if (channelRefCount > 0 && videoRefCount > 0) {
        refDesc = `${channelRefCount} thumbnails from @${channelHandle ?? "unknown"} and ${videoRefCount} YouTube video thumbnail(s) used as style-only references. ${CHANNEL_STYLE_INSTRUCTION}`;
      } else if (channelRefCount > 0) {
        refDesc = `${channelRefCount} thumbnails from @${channelHandle ?? "unknown"} used as style-only references. ${CHANNEL_STYLE_INSTRUCTION}`;
      } else if (videoRefCount > 0) {
        refDesc = `${videoRefCount} YouTube video thumbnail(s) used as style-only references. ${VIDEO_STYLE_INSTRUCTION}`;
      } else {
        refDesc = `${userRefCount} visual reference image(s) provided by the user.`;
      }
      imagePromptText =
        `The FIRST image is the previously generated thumbnail — use it as the base to edit based on the instruction below.\n` +
        `The remaining images are ${refDesc}\n\n` +
        `Instruction: ${imagePromptText}`;
    } else if (hasPreviousVersion) {
      imagePromptText = `The attached image is the previously generated thumbnail. Edit and improve it based on this instruction: ${imagePromptText}`;
    } else if (hasReferenceImages) {
      const channelRefCount = hasChannelThumbs
        ? channelThumbnailUrls.length
        : 0;
      const videoRefCount = hasVideoThumbs ? videoThumbnailUrls.length : 0;
      const userRefCount =
        allReferenceImages.length - channelRefCount - videoRefCount;
      let refDesc = "";
      if (userRefCount > 0 && (channelRefCount > 0 || videoRefCount > 0)) {
        const styleDesc = [
          channelRefCount > 0
            ? `${channelRefCount} thumbnail(s) from @${channelHandle ?? "unknown"} — use for style only`
            : null,
          videoRefCount > 0
            ? `${videoRefCount} YouTube video thumbnail(s) — use for style only`
            : null,
        ]
          .filter(Boolean)
          .join("; ");
        refDesc =
          `The first ${userRefCount} image(s) are user-provided visual references. ` +
          `The remaining image(s) are ${styleDesc} (colors, composition, typography). ` +
          `Do NOT copy faces, people, specific objects, or text from them.`;
      } else if (channelRefCount > 0 && videoRefCount > 0) {
        refDesc =
          `The first ${channelRefCount} image(s) are thumbnails from @${channelHandle ?? "unknown"}. ` +
          `The remaining ${videoRefCount} image(s) are YouTube video thumbnails. ${CHANNEL_STYLE_INSTRUCTION}`;
      } else if (channelRefCount > 0) {
        refDesc = `The attached images are thumbnails from @${channelHandle ?? "unknown"}. ${CHANNEL_STYLE_INSTRUCTION}`;
      } else if (videoRefCount > 0) {
        refDesc = `The attached image(s) are thumbnails from specific YouTube videos. ${VIDEO_STYLE_INSTRUCTION}`;
      } else {
        refDesc = `The attached image(s) are visual references provided by the user (branding, style, colors, composition).`;
      }
      imagePromptText =
        `${refDesc}\n\n` +
        `Generate a new original YouTube thumbnail.\n\n` +
        `Instruction: ${imagePromptText}`;
    }

    const allImages: Buffer[] = [
      ...(hasPreviousVersion
        ? [Buffer.from(previousVersion.imageBase64, "base64")]
        : []),
      ...(hasReferenceImages
        ? allReferenceImages.map((r) => Buffer.from(r.imageBase64, "base64"))
        : []),
    ];

    const imagePrompt =
      allImages.length > 0
        ? { text: imagePromptText, images: allImages }
        : imagePromptText;

    const { image } = await generateImage({
      model: google.image(IMAGE_MODEL),
      prompt: imagePrompt,
      aspectRatio: "16:9",
      providerOptions: {
        google: {
          imageConfig: {
            aspectRatio: "16:9",
            imageSize: "2K",
          },
        },
      },
    });

    return Response.json({
      image: image.base64,
      mimeType: "image/png",
      enhancedPrompt: safePrompt,
    });
  } catch (err) {
    await refundCredit(session.user.id);
    const message =
      err instanceof Error ? err.message : "Image generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
