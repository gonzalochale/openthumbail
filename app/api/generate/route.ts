import { generateImage, generateText, Output } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";

const THUMBNAIL_SYSTEM_PROMPT = `
Step 1 — Safety check (MANDATORY, evaluated first)

Reject the request if the user's idea contains or implies ANY of the following:
- Nudity, sexual content, or anything suggestive of an adult/+18 nature
- Graphic violence, gore, or gratuitous depictions of injury or death
- Hate speech, discrimination, or symbols associated with extremist groups
- Content that sexualizes or endangers minors in any way
- Realistic depictions of self-harm or suicide
- Illegal activities presented approvingly (drug manufacturing, weapon smuggling, etc.)

Step 2 — Prompt enhancement (only if Step 1 passes)

Transform the user's safe idea into a detailed, cinematic image generation prompt for a professional 16:9 YouTube thumbnail. Include:
- A vivid, high-contrast color palette (e.g. "electric blue and golden yellow")
- Clear composition: subject placement, foreground/background split, rule of thirds
- Quality descriptors: "8K ultra-detailed", "cinematic lighting", "studio-quality render"
- Dramatic lighting: "rim lighting", "golden hour glow", "volumetric light rays"
- Bold graphic elements: strong visual contrast, dynamic angles, expressive subjects
- Depth cues: "bokeh background", "shallow depth of field", "sharp foreground subject"
- Under 300 words`;

const safetySchema = z.discriminatedUnion("blocked", [
  z.object({ blocked: z.literal(true), reason: z.string() }),
  z.object({ blocked: z.literal(false), prompt: z.string() }),
]);

export async function POST(req: Request) {
  const { apiKey, prompt } = await req.json();

  if (!apiKey || !prompt) {
    return Response.json(
      { error: "API key and prompt are required" },
      { status: 400 },
    );
  }

  try {
    const google = createGoogleGenerativeAI({ apiKey });

    const { output } = await generateText({
      model: google("gemini-3.1-flash-lite-preview"),
      system: THUMBNAIL_SYSTEM_PROMPT,
      prompt,
      output: Output.object({ schema: safetySchema }),
    });

    if (output.blocked) {
      return Response.json({ error: output.reason }, { status: 422 });
    }

    const enhancedPrompt = output.prompt;

    const { image } = await generateImage({
      model: google.image("gemini-3.1-flash-image-preview"),
      prompt: enhancedPrompt,
      aspectRatio: "16:9",
    });

    return Response.json({
      image: image.base64,
      mimeType: "image/png",
      enhancedPrompt,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Image generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
