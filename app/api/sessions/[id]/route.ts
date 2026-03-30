import { pool } from "@/lib/db";
import { imageProxyUrl } from "@/lib/storage/s3";
import { requireAuth } from "@/lib/auth/require-auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id: sessionId } = await params;

  const sessionCheck = await pool.query(
    `SELECT id FROM thumbnail_session WHERE id = $1 AND user_id = $2`,
    [sessionId, session.user.id],
  );
  if (sessionCheck.rows.length === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const result = await pool.query<{
    id: string;
    prompt: string;
    enhanced_prompt: string | null;
    mime_type: string;
    previous_generation_id: string | null;
    channel_refs: unknown;
    video_refs: unknown;
    created_at: string;
  }>(
    `SELECT id, prompt, enhanced_prompt, mime_type,
            previous_generation_id, channel_refs, video_refs, created_at
     FROM thumbnail_generation
     WHERE session_id = $1
     ORDER BY created_at ASC`,
    [sessionId],
  );

  const generations = result.rows.map((row) => ({
    id: row.id,
    prompt: row.prompt,
    enhancedPrompt: row.enhanced_prompt,
    imageUrl: imageProxyUrl(row.id),
    mimeType: row.mime_type,
    previousGenerationId: row.previous_generation_id,
    channelRefs: row.channel_refs,
    videoRefs: row.video_refs,
    createdAt: row.created_at,
  }));

  return Response.json({ generations });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id: sessionId } = await params;

  await pool.query(
    `DELETE FROM thumbnail_session WHERE id = $1 AND user_id = $2`,
    [sessionId, session.user.id],
  );

  return new Response(null, { status: 204 });
}
