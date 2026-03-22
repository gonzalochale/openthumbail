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
  MAX_PROMPT_LENGTH,
  SAFETY_MODEL,
  THUMBNAIL_SYSTEM_PROMPT,
} from "@/lib/constants";

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

interface ReferenceImage {
  imageBase64: string;
  mimeType: string;
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
  } = body as {
    prompt: string;
    previousVersion?: PreviousVersion;
    referenceImages?: ReferenceImage[];
    channelThumbnailUrls?: string[];
    channelHandle?: string;
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

  let allReferenceImages: ReferenceImage[] = referenceImages ?? [];
  if (channelThumbnailUrls && channelThumbnailUrls.length > 0) {
    const fetched = await Promise.allSettled(
      channelThumbnailUrls.map(async (url) => {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`Failed to fetch thumbnail: ${url}`);
        const buf = await r.arrayBuffer();
        return {
          imageBase64: Buffer.from(buf).toString("base64"),
          mimeType: "image/jpeg",
        } satisfies ReferenceImage;
      }),
    );
    const resolved = fetched
      .filter(
        (r): r is PromiseFulfilledResult<ReferenceImage> =>
          r.status === "fulfilled",
      )
      .map((r) => r.value);
    allReferenceImages = [...allReferenceImages, ...resolved];
  }

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
    const hasPreviousVersion = !!previousVersion;

    let imagePromptText = safePrompt;

    if (hasPreviousVersion && hasReferenceImages) {
      const userRefCount = (referenceImages ?? []).length;
      const channelRefCount = allReferenceImages.length - userRefCount;
      let refDesc = "";
      if (userRefCount > 0 && channelRefCount > 0) {
        refDesc =
          `${userRefCount} user-provided visual reference(s), followed by ${channelRefCount} thumbnails from @${channelHandle ?? "unknown"} ` +
          `used as style-only references (colors, composition, typography — no faces or specific elements).`;
      } else if (channelRefCount > 0) {
        refDesc = `${channelRefCount} thumbnails from @${channelHandle ?? "unknown"} used as style-only references. ${CHANNEL_STYLE_INSTRUCTION}`;
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
      const userRefCount = allReferenceImages.length - channelRefCount;
      let refDesc = "";
      if (userRefCount > 0 && channelRefCount > 0) {
        refDesc =
          `The first ${userRefCount} image(s) are user-provided visual references. ` +
          `The last ${channelRefCount} image(s) are thumbnails from @${channelHandle ?? "unknown"} — use them for style only (colors, composition, typography). ` +
          `Do NOT copy faces, people, specific objects, or text from them.`;
      } else if (channelRefCount > 0) {
        refDesc = `The attached images are thumbnails from @${channelHandle ?? "unknown"}. ${CHANNEL_STYLE_INSTRUCTION}`;
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
