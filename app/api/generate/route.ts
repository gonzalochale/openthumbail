import { generateImage, generateText, Output } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";

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

const isDev = process.env.NODE_ENV === "development";
const SAFETY_MODEL = isDev ? "gemini-2.5-flash" : "gemini-3.1-flash-preview";
const IMAGE_MODEL = isDev
  ? "gemini-2.5-flash-image"
  : "gemini-3.1-flash-image-preview";

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
  const body = await req.json();
  const { prompt, previousVersion } = body as {
    prompt: string;
    previousVersion?: PreviousVersion;
  };

  if (!prompt) {
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
  if (!apiKey) {
    console.error("Missing Google AI Studio API key");
    return Response.json({ error: "Error generating image" }, { status: 500 });
  }

  try {
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

    const imagePrompt = previousVersion
      ? {
          text: safePrompt,
          images: [Buffer.from(previousVersion.imageBase64, "base64")],
        }
      : safePrompt;

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
