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
import {
  buildImagePrompt,
  fetchImages,
  type ChannelRef,
  type PreviousVersion,
  type VideoRef,
} from "@/lib/build-image-prompt";
import {
  fetchPreviousVersion,
  persistGeneration,
} from "@/lib/generation-service";

const safetySchema = z.object({
  blocked: z.boolean(),
  reason: z.string().optional(),
  prompt: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    prompt,
    uploadedImage,
    channelRefs,
    videoRefs,
    sessionId,
    previousGenerationId,
  } = body as {
    prompt: string;
    uploadedImage?: { imageBase64: string; mimeType: string };
    channelRefs?: ChannelRef[];
    videoRefs?: VideoRef[];
    sessionId?: string;
    previousGenerationId?: string;
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

  const allRefImages = [
    ...channelImageGroups.flat(),
    ...videoImageGroups.flat(),
  ];
  if (allRefImages.length > MAX_FILES) {
    return Response.json(
      { error: `Too many reference images (max ${MAX_FILES})` },
      { status: 400 },
    );
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
    const previousVersion: PreviousVersion | undefined = previousGenerationId
      ? await fetchPreviousVersion(previousGenerationId, session.user.id)
      : uploadedImage
        ? { ...uploadedImage, enhancedPrompt: null }
        : undefined;

    if (!CREATE_IMAGES) {
      await new Promise((r) => setTimeout(r, 5000));
      const generationId = crypto.randomUUID();
      if (sessionId) {
        await persistGeneration({
          generationId,
          sessionId,
          userId: session.user.id,
          prompt,
          enhancedPrompt: prompt,
          base64: whitePng(2560, 1440),
          previousGenerationId,
          channelRefs,
          videoRefs,
        });
      }
      return Response.json({ mimeType: "image/png", enhancedPrompt: prompt, generationId });
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
        { error: output.reason ?? "Generated content violates safety guidelines" },
        { status: 422 },
      );
    }

    const safePrompt = output.prompt;
    if (!safePrompt) {
      await refundCredit(session.user.id);
      return Response.json({ error: "Failed to validate prompt" }, { status: 500 });
    }

    const { text, images } = buildImagePrompt({
      safePrompt,
      channelRefs,
      channelImageGroups,
      videoRefs,
      videoImageGroups,
      previousVersion,
    });

    const { image } = await generateImage({
      model: google.image(IMAGE_MODEL),
      prompt: images.length > 0 ? { text, images } : text,
      aspectRatio: "16:9",
      providerOptions: {
        google: { imageConfig: { aspectRatio: "16:9", imageSize: "2K" } },
      },
    });

    const generationId = crypto.randomUUID();
    if (sessionId) {
      await persistGeneration({
        generationId,
        sessionId,
        userId: session.user.id,
        prompt,
        enhancedPrompt: safePrompt,
        base64: image.base64,
        previousGenerationId,
        channelRefs,
        videoRefs,
      });
    }

    return Response.json({ mimeType: "image/png", enhancedPrompt: safePrompt, generationId });
  } catch (err) {
    await refundCredit(session.user.id);
    const message =
      err instanceof Error ? err.message : "Image generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
