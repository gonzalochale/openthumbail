import { generateText, Output } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { whitePng } from "@/lib/generation/white-png";
import { deductCredit, getCredits, refundCredit } from "@/lib/stripe/credits";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  CREATE_IMAGES,
  MAX_TOTAL_IMAGES,
  MAX_PROMPT_LENGTH,
  SAFETY_MODEL,
  THUMBNAIL_SYSTEM_PROMPT,
} from "@/lib/constants";
import { getCameoImages } from "@/lib/cameo/service";
import {
  buildImagePrompt,
  fetchImages,
  type ChannelRef,
  type PreviousVersion,
  type ReferenceImage,
  type VideoRef,
} from "@/lib/generation/build-prompt";
import {
  fetchPreviousVersion,
  persistGeneration,
} from "@/lib/generation/service";
import { buildGeminiContents, callGeminiImage } from "@/lib/generation/gemini";
import { seedFromUUID } from "@/lib/utils";

function trimImageGroups(
  channelGroups: ReferenceImage[][],
  videoGroups: ReferenceImage[][],
  maxTotal: number,
): [ReferenceImage[][], ReferenceImage[][]] {
  let total =
    channelGroups.reduce((s, g) => s + g.length, 0) +
    videoGroups.reduce((s, g) => s + g.length, 0);
  if (total <= maxTotal) return [channelGroups, videoGroups];

  const trimmedVideos = [...videoGroups];
  while (total > maxTotal && trimmedVideos.length > 0) {
    total -= trimmedVideos.pop()!.length;
  }
  if (total <= maxTotal) return [channelGroups, trimmedVideos];

  const trimmedChannels = channelGroups.map((g) => [...g]);
  for (let i = trimmedChannels.length - 1; i >= 0 && total > maxTotal; i--) {
    const excess = total - maxTotal;
    const removeCount = Math.min(excess, trimmedChannels[i].length);
    trimmedChannels[i] = trimmedChannels[i].slice(
      0,
      trimmedChannels[i].length - removeCount,
    );
    total -= removeCount;
  }
  return [trimmedChannels, trimmedVideos];
}

const safetySchema = z.object({
  blocked: z.boolean(),
  reason: z.string().optional(),
  prompt: z.string().optional(),
});

async function resolveCameoUsage({
  prompt,
  isCameo,
  previousVersion,
  userId,
}: {
  prompt: string;
  isCameo?: boolean;
  previousVersion?: PreviousVersion;
  userId: string;
}) {
  const shouldAttemptCameo =
    Boolean(isCameo) ||
    /#(me|cameo)\b/i.test(prompt) ||
    Boolean(previousVersion?.cameoUsed);
  const cameoImages = shouldAttemptCameo ? await getCameoImages(userId) : null;

  return {
    cameoImages,
    shouldUseCameo: (cameoImages?.length ?? 0) > 0,
  };
}

function buildEnrichmentInput({
  promptForGeneration,
  shouldUseCameo,
  previousVersion,
  uploadedImage,
}: {
  promptForGeneration: string;
  shouldUseCameo: boolean;
  previousVersion?: PreviousVersion;
  uploadedImage?: { imageBase64: string; mimeType: string };
}) {
  const hasPrevious = Boolean(previousVersion?.enhancedPrompt);
  const hasStartingImage = Boolean(uploadedImage);

  if (shouldUseCameo) {
    if (hasPrevious) {
      return `[Cameo mode]\n[Previous thumbnail: "${previousVersion!.enhancedPrompt}"]\nEdit: ${promptForGeneration}`;
    }
    if (hasStartingImage) {
      return `[Cameo mode]\n[Starting image: user provided a photo — the people in it are the main subjects]\nPrompt: ${promptForGeneration}`;
    }
    return `[Cameo mode]\nPrompt: ${promptForGeneration}`;
  }

  if (hasPrevious) {
    return `[Previous thumbnail: "${previousVersion!.enhancedPrompt}"]\nEdit: ${promptForGeneration}`;
  }
  if (hasStartingImage) {
    return `[Starting image: user provided a photo — the people in it are the main subjects]\nPrompt: ${promptForGeneration}`;
  }
  return promptForGeneration;
}

export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    prompt,
    generationPrompt,
    userApiKey,
    uploadedImage,
    channelRefs,
    videoRefs,
    sessionId,
    previousGenerationId,
    isCameo,
  } = body as {
    prompt: string;
    generationPrompt?: string;
    userApiKey?: string;
    uploadedImage?: { imageBase64: string; mimeType: string };
    channelRefs?: ChannelRef[];
    videoRefs?: VideoRef[];
    sessionId?: string;
    previousGenerationId?: string;
    isCameo?: boolean;
  };

  const promptForGeneration = generationPrompt?.trim() || prompt?.trim() || "";

  if (!prompt?.trim()) {
    return Response.json({ error: "Message is required" }, { status: 400 });
  }
  if (promptForGeneration.length > MAX_PROMPT_LENGTH) {
    return Response.json(
      {
        error: `Message exceeds maximum length of ${MAX_PROMPT_LENGTH} characters`,
      },
      { status: 400 },
    );
  }

  const envApiKey = process.env.GOOGLE_AI_STUDIO_API_KEY?.trim();
  const fallbackUserApiKey = userApiKey?.trim();

  let deducted = false;
  let apiKeyToUse: string | null = null;
  let creditSource: "server_credits" | "user_api_key" = "server_credits";

  if (envApiKey) {
    deducted = await deductCredit(session.user.id);
    if (deducted) {
      apiKeyToUse = envApiKey;
      creditSource = "server_credits";
    } else if (fallbackUserApiKey) {
      apiKeyToUse = fallbackUserApiKey;
      creditSource = "user_api_key";
    } else {
      const remainingCredits = await getCredits(session.user.id);
      return Response.json(
        {
          error: "Insufficient credits",
          code: "NO_CREDITS",
          remainingCredits,
          creditSource: "server_credits",
        },
        { status: 402 },
      );
    }
  } else if (fallbackUserApiKey) {
    apiKeyToUse = fallbackUserApiKey;
    creditSource = "user_api_key";
  } else {
    return Response.json({ error: "Error generating image" }, { status: 500 });
  }

  const maybeRefundCredit = async () => {
    if (!deducted) return;
    await refundCredit(session.user.id);
  };

  try {
    const google = createGoogleGenerativeAI({ apiKey: apiKeyToUse });

    const [[channelImageGroups, videoImageGroups], previousVersion] =
      await Promise.all([
        Promise.all([
          Promise.all((channelRefs ?? []).map((ch) => fetchImages(ch.urls))),
          Promise.all((videoRefs ?? []).map((vr) => fetchImages([vr.url]))),
        ]),
        previousGenerationId
          ? fetchPreviousVersion(previousGenerationId, session.user.id)
          : Promise.resolve(
              uploadedImage
                ? ({
                    ...uploadedImage,
                    enhancedPrompt: null,
                  } satisfies PreviousVersion)
                : undefined,
            ),
      ]);

    const { cameoImages, shouldUseCameo } = await resolveCameoUsage({
      prompt,
      isCameo,
      previousVersion,
      userId: session.user.id,
    });

    const reservedSlots = (previousVersion ? 1 : 0) + (shouldUseCameo ? 1 : 0);
    const maxRefImages = MAX_TOTAL_IMAGES - reservedSlots;
    const [trimmedChannelGroups, trimmedVideoGroups] = trimImageGroups(
      channelImageGroups,
      videoImageGroups,
      maxRefImages,
    );

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
          cameoUsed: shouldUseCameo,
          previousGenerationId,
          channelRefs,
          videoRefs,
        });
      }
      const remainingCredits = await getCredits(session.user.id);
      return Response.json({
        mimeType: "image/png",
        enhancedPrompt: prompt,
        generationId,
        cameoUsed: shouldUseCameo,
        remainingCredits,
        creditSource,
      });
    }

    const enrichmentInput = buildEnrichmentInput({
      promptForGeneration,
      shouldUseCameo,
      previousVersion,
      uploadedImage,
    });

    const { output } = await generateText({
      model: google(SAFETY_MODEL),
      system: THUMBNAIL_SYSTEM_PROMPT,
      prompt: enrichmentInput,
      output: Output.object({ schema: safetySchema }),
    });

    if (output.blocked) {
      await maybeRefundCredit();
      const remainingCredits = await getCredits(session.user.id);
      return Response.json(
        {
          error:
            output.reason ?? "Generated content violates safety guidelines",
          remainingCredits,
          creditSource,
        },
        { status: 422 },
      );
    }

    const safePrompt = output.prompt;
    if (!safePrompt) {
      await maybeRefundCredit();
      const remainingCredits = await getCredits(session.user.id);
      return Response.json(
        { error: "Failed to validate prompt", remainingCredits, creditSource },
        { status: 500 },
      );
    }

    const isEditWithSigs =
      previousGenerationId != null &&
      previousVersion?.enhancedPrompt !== null &&
      previousVersion?.imageThoughtSignature != null;

    const { text, images } = buildImagePrompt({
      safePrompt,
      userPrompt: promptForGeneration,
      channelRefs,
      channelImageGroups: trimmedChannelGroups,
      videoRefs,
      videoImageGroups: trimmedVideoGroups,
      previousVersion,
      excludePreviousImage: isEditWithSigs,
      cameoImages: cameoImages ?? undefined,
    });

    const contents = buildGeminiContents(
      text,
      images,
      previousVersion,
      isEditWithSigs,
    );

    const { imageBase64, textThoughtSignature, imageThoughtSignature } =
      await callGeminiImage({
        apiKey: apiKeyToUse,
        contents,
        seed: previousGenerationId
          ? seedFromUUID(previousGenerationId)
          : undefined,
      });

    const generationId = crypto.randomUUID();
    if (sessionId) {
      await persistGeneration({
        generationId,
        sessionId,
        userId: session.user.id,
        prompt,
        enhancedPrompt: safePrompt,
        base64: imageBase64,
        cameoUsed: shouldUseCameo,
        previousGenerationId,
        channelRefs,
        videoRefs,
        textThoughtSignature,
        imageThoughtSignature,
      });
    }

    const remainingCredits = await getCredits(session.user.id);

    return Response.json({
      mimeType: "image/png",
      enhancedPrompt: safePrompt,
      generationId,
      cameoUsed: shouldUseCameo,
      remainingCredits,
      creditSource,
    });
  } catch (err) {
    await maybeRefundCredit();
    const remainingCredits = await getCredits(session.user.id);
    const message =
      err instanceof Error ? err.message : "Image generation failed";
    return Response.json(
      { error: message, remainingCredits, creditSource },
      { status: 500 },
    );
  }
}
