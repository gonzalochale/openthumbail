import { pool } from "@/lib/db";
import { generationKey, getObjectBase64, uploadImage } from "@/lib/storage/s3";
import type { PersistGenerationParams, PreviousVersion } from "./types";

export async function persistGeneration(params: PersistGenerationParams) {
  const {
    generationId,
    sessionId,
    userId,
    prompt,
    enhancedPrompt,
    base64,
    cameoUsed,
    previousGenerationId,
    channelRefs,
    videoRefs,
    textThoughtSignature,
    imageThoughtSignature,
  } = params;

  const key = generationKey(userId, sessionId, generationId);
  await Promise.all([
    uploadImage(key, base64, "image/png"),
    pool.query(
      `INSERT INTO thumbnail_generation
        (id, session_id, user_id, prompt, enhanced_prompt, image_key, mime_type,
          cameo_used, previous_generation_id, channel_refs, video_refs,
         text_thought_signature, image_thought_signature)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        generationId,
        sessionId,
        userId,
        prompt,
        enhancedPrompt,
        key,
        "image/png",
        cameoUsed ?? false,
        previousGenerationId ?? null,
        channelRefs ? JSON.stringify(channelRefs) : null,
        videoRefs ? JSON.stringify(videoRefs) : null,
        textThoughtSignature ?? null,
        imageThoughtSignature ?? null,
      ],
    ),
  ]);
}

export async function fetchPreviousVersion(
  previousGenerationId: string,
  userId: string,
): Promise<PreviousVersion | undefined> {
  const result = await pool.query<{
    image_key: string;
    enhanced_prompt: string | null;
    prompt: string;
    cameo_used: boolean;
    text_thought_signature: string | null;
    image_thought_signature: string | null;
  }>(
    `SELECT image_key, enhanced_prompt, prompt, cameo_used,
            text_thought_signature, image_thought_signature
     FROM thumbnail_generation WHERE id = $1 AND user_id = $2`,
    [previousGenerationId, userId],
  );

  if (result.rows.length === 0) return undefined;
  const row = result.rows[0];

  return {
    imageBase64: await getObjectBase64(row.image_key),
    mimeType: "image/png",
    enhancedPrompt: row.enhanced_prompt,
    cameoUsed: row.cameo_used || /#(me|cameo)\b/i.test(row.prompt),
    textThoughtSignature: row.text_thought_signature,
    imageThoughtSignature: row.image_thought_signature,
  };
}
