import { GoogleGenerativeAI } from "@google/generative-ai";
import { IMAGE_MODEL } from "@/lib/constants";
import type { PreviousVersion, ReferenceImage } from "@/lib/generation-types";

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  thoughtSignature?: string;
  thought?: boolean;
}

type GeminiContents = Array<{ role: "user" | "model"; parts: GeminiPart[] }>;

export interface GeminiImageResult {
  imageBase64: string;
  textThoughtSignature: string | null;
  imageThoughtSignature: string | null;
}

function toImageParts(images: ReferenceImage[]): GeminiPart[] {
  return images.map((img) => ({
    inlineData: { mimeType: img.mimeType, data: img.imageBase64 },
  }));
}

export function buildGeminiContents(
  text: string,
  images: ReferenceImage[],
  previousVersion: PreviousVersion | undefined,
  useMultiTurn: boolean,
): GeminiContents {
  if (useMultiTurn && previousVersion?.imageThoughtSignature) {
    const modelParts: GeminiPart[] = [];
    if (previousVersion.textThoughtSignature) {
      modelParts.push({
        text: "",
        thoughtSignature: previousVersion.textThoughtSignature,
      });
    }
    modelParts.push({
      inlineData: {
        mimeType: previousVersion.mimeType,
        data: previousVersion.imageBase64,
      },
      thoughtSignature: previousVersion.imageThoughtSignature,
    });

    return [
      {
        role: "user",
        parts: [{ text: previousVersion.enhancedPrompt ?? text }],
      },
      { role: "model", parts: modelParts },
      { role: "user", parts: [{ text }, ...toImageParts(images)] },
    ];
  }

  return [{ role: "user", parts: [{ text }, ...toImageParts(images)] }];
}

export async function callGeminiImage({
  apiKey,
  contents,
  seed,
}: {
  apiKey: string;
  contents: GeminiContents;
  seed?: number;
}): Promise<GeminiImageResult> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: IMAGE_MODEL });

  const result = await model.generateContent({
    contents: contents as any,
    generationConfig: {
      responseModalities: ["IMAGE"],
      ...(seed != null ? { seed } : {}),
      imageConfig: { aspectRatio: "16:9", imageSize: "2K" },
    } as any,
  });

  const parts = (result.response.candidates?.[0]?.content?.parts ??
    []) as GeminiPart[];

  let imageBase64: string | null = null;
  let textThoughtSignature: string | null = null;
  let imageThoughtSignature: string | null = null;

  for (const part of parts) {
    if (part.text != null && part.thoughtSignature && !textThoughtSignature) {
      textThoughtSignature = part.thoughtSignature;
    }
    if (
      part.inlineData?.mimeType.startsWith("image/") &&
      !part.thought &&
      !imageBase64
    ) {
      imageBase64 = part.inlineData.data;
      imageThoughtSignature = part.thoughtSignature ?? null;
    }
  }

  if (!imageBase64) throw new Error("No image in Gemini response");
  return { imageBase64, textThoughtSignature, imageThoughtSignature };
}
