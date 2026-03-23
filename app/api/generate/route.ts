import { generateImage, generateText, Output } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { whitePng } from "@/lib/white-png";
import { auth } from "@/lib/auth";
import { deductCredit, refundCredit } from "@/lib/credits";
import { headers } from "next/headers";
import {
  CREATE_IMAGES,
  IMAGE_MODEL,
  MAX_FILES,
  MAX_PROMPT_LENGTH,
  SAFETY_MODEL,
  THUMBNAIL_SYSTEM_PROMPT,
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

interface ChannelRef {
  urls: string[];
  handle: string;
}

interface VideoRef {
  url: string;
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { prompt, previousVersion, referenceImages, channelRefs, videoRefs } =
    body as {
      prompt: string;
      previousVersion?: PreviousVersion;
      referenceImages?: ReferenceImage[];
      channelRefs?: ChannelRef[];
      videoRefs?: VideoRef[];
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

  const [channelImageGroups, videoImageGroups] = await Promise.all([
    Promise.all((channelRefs ?? []).map((ch) => fetchImages(ch.urls))),
    Promise.all((videoRefs ?? []).map((vr) => fetchImages([vr.url]))),
  ]);
  const allReferenceImages = [
    ...(referenceImages ?? []),
    ...channelImageGroups.flat(),
    ...videoImageGroups.flat(),
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
    const hasPreviousVersion = !!previousVersion;

    const imageGuide: string[] = [];
    let enriched = safePrompt;
    let imgIdx = hasPreviousVersion ? 2 : 1;

    const userRefCount = (referenceImages ?? []).length;
    if (userRefCount > 0) {
      const end = imgIdx + userRefCount - 1;
      const range =
        userRefCount === 1 ? `Image ${imgIdx}` : `Images ${imgIdx}–${end}`;
      imageGuide.push(
        `${range}: User-provided visual reference(s) (branding, style, colors, composition).`,
      );
      imgIdx += userRefCount;
    }

    for (const [i, ch] of (channelRefs ?? []).entries()) {
      const fetchedCount = channelImageGroups[i]?.length ?? 0;
      if (fetchedCount === 0) continue;
      const end = imgIdx + fetchedCount - 1;
      const range =
        fetchedCount === 1 ? `Image ${imgIdx}` : `Images ${imgIdx}–${end}`;
      const instruction = `${range}: Thumbnails from @${ch.handle} — use for STYLE ONLY (colors, composition, typography; do NOT copy faces or specific objects).`;
      imageGuide.push(instruction);
      const pat = new RegExp(
        `@${ch.handle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
        "gi",
      );
      const hint =
        fetchedCount === 1
          ? `@${ch.handle} (image ${imgIdx})`
          : `@${ch.handle} (images ${imgIdx}–${end})`;
      enriched = enriched.replace(pat, hint);
      imgIdx += fetchedCount;
    }

    for (const [i] of (videoRefs ?? []).entries()) {
      const fetchedCount = videoImageGroups[i]?.length ?? 0;
      if (fetchedCount === 0) continue;
      const instruction = `Image ${imgIdx}: Video thumbnail — use for STYLE ONLY (colors, composition, typography; do NOT copy faces or specific objects).`;
      imageGuide.push(instruction);
      imgIdx++;
    }

    let imagePromptText = enriched;

    if (hasPreviousVersion) {
      const prevLine = hasReferenceImages
        ? `Image 1: Previously generated thumbnail — use as the base to edit.`
        : null;
      const guide = [prevLine, ...imageGuide].filter(Boolean).join("\n");
      imagePromptText = guide
        ? `${guide}\n\nInstruction: ${imagePromptText}`
        : `The attached image is the previously generated thumbnail. Edit and improve it based on this instruction: ${imagePromptText}`;
    } else if (hasReferenceImages) {
      const guide = imageGuide.join("\n");
      imagePromptText =
        `${guide}\n\n` +
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
