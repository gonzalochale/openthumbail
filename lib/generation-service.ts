import { pool } from "@/lib/db";
import { generationKey, getObjectBase64, uploadImage } from "@/lib/s3";
import {
  type ChannelRef,
  type PreviousVersion,
  type VideoRef,
} from "@/lib/build-image-prompt";

export async function persistGeneration({
  generationId,
  sessionId,
  userId,
  prompt,
  enhancedPrompt,
  base64,
  previousGenerationId,
  channelRefs,
  videoRefs,
}: {
  generationId: string;
  sessionId: string;
  userId: string;
  prompt: string;
  enhancedPrompt: string;
  base64: string;
  previousGenerationId?: string;
  channelRefs?: ChannelRef[];
  videoRefs?: VideoRef[];
}) {
  const key = generationKey(userId, sessionId, generationId);
  await Promise.all([
    uploadImage(key, base64, "image/png"),
    pool.query(
      `INSERT INTO thumbnail_generation
         (id, session_id, user_id, prompt, enhanced_prompt, image_key, mime_type, previous_generation_id, channel_refs, video_refs)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        generationId,
        sessionId,
        userId,
        prompt,
        enhancedPrompt,
        key,
        "image/png",
        previousGenerationId ?? null,
        channelRefs ? JSON.stringify(channelRefs) : null,
        videoRefs ? JSON.stringify(videoRefs) : null,
      ],
    ),
  ]);
}

export async function fetchPreviousVersion(
  previousGenerationId: string,
  userId: string,
): Promise<PreviousVersion | undefined> {
  const prev = await pool.query<{
    image_key: string;
    enhanced_prompt: string | null;
  }>(
    `SELECT image_key, enhanced_prompt FROM thumbnail_generation WHERE id = $1 AND user_id = $2`,
    [previousGenerationId, userId],
  );
  if (prev.rows.length === 0) return undefined;
  return {
    imageBase64: await getObjectBase64(prev.rows[0].image_key),
    mimeType: "image/png",
    enhancedPrompt: prev.rows[0].enhanced_prompt,
  };
}
