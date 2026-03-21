import { generateImage, generateText, Output } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { whitePng } from "@/lib/white-png";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const THUMBNAIL_SYSTEM_PROMPT = `
Safety check (MANDATORY)

Reject the request if the user's idea contains or implies ANY of the following:
- Nudity, sexual content, or anything suggestive of an adult/+18 nature
- Graphic violence, gore, or gratuitous depictions of injury or death
- Hate speech, discrimination, or symbols associated with extremist groups
- Content that sexualizes or endangers minors in any way
- Realistic depictions of self-harm or suicide
- Illegal activities presented approvingly (drug manufacturing, weapon smuggling, etc.)

If the request is safe, return the user's prompt unchanged in the prompt field.`;

const CREATE_IMAGES = process.env.GENERATE_IMAGES === "true";
const SAFETY_MODEL = "gemini-3-flash-preview";
const IMAGE_MODEL = "gemini-3.1-flash-image-preview";

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
  const { prompt, previousVersion, referenceImages } = body as {
    prompt: string;
    previousVersion?: PreviousVersion;
    referenceImages?: ReferenceImage[];
  };

  if (!prompt && !referenceImages?.length) {
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;

  if (!apiKey) {
    console.error("Missing Google AI Studio API key");
    return Response.json({ error: "Error generating image" }, { status: 500 });
  }

  try {
    if (!CREATE_IMAGES) {
      await new Promise((r) => setTimeout(r, 5000));
      return Response.json({
        image: whitePng(1280, 720),
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
      return Response.json(
        { error: "Failed to validate prompt" },
        { status: 500 },
      );
    }

    const hasReferenceImages = referenceImages && referenceImages.length > 0;
    const hasPreviousVersion = !!previousVersion;

    let imagePromptText = safePrompt;

    if (hasPreviousVersion && hasReferenceImages) {
      imagePromptText =
        `The FIRST image is the previously generated thumbnail — use it as the base to edit and improve upon based on the instruction below.\n` +
        `The next ${referenceImages.length} image(s) are visual references provided by the user (e.g. branding, style, composition inspiration) — do NOT reproduce them directly, use them as context.\n\n` +
        `Instruction: ${imagePromptText}`;
    } else if (hasPreviousVersion) {
      imagePromptText = `The attached image is the previously generated thumbnail. Edit and improve it based on this instruction: ${imagePromptText}`;
    } else if (hasReferenceImages) {
      imagePromptText =
        `The attached image(s) are visual references provided by the user (e.g. branding, style, colors, faces, composition). ` +
        `Use them as context to generate a new YouTube thumbnail. Do NOT copy them — create an original thumbnail inspired by them.\n\n` +
        `Instruction: ${imagePromptText}`;
    }

    const allImages: Buffer[] = [
      ...(hasPreviousVersion
        ? [Buffer.from(previousVersion.imageBase64, "base64")]
        : []),
      ...(hasReferenceImages
        ? referenceImages.map((r) => Buffer.from(r.imageBase64, "base64"))
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
    });

    return Response.json({
      image: image.base64,
      mimeType: "image/png",
      enhancedPrompt: safePrompt,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Image generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
