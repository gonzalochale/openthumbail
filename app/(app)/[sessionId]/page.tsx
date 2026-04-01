import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/require-auth";
import { pool } from "@/lib/db";
import { imageProxyUrl } from "@/lib/storage/s3";
import { SessionLoader } from "@/components/sessions/session-loader";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await requireAuth();

  if (!session) {
    redirect("/");
  }

  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(sessionId)) notFound();

  const ownershipCheck = await pool.query(
    `SELECT id FROM thumbnail_session WHERE id = $1 AND user_id = $2`,
    [sessionId, session.user.id],
  );

  if (ownershipCheck.rows.length === 0) {
    notFound();
  }

  const result = await pool.query(
    `SELECT id, prompt, enhanced_prompt, mime_type,
            cameo_used,
            created_at
     FROM thumbnail_generation
     WHERE session_id = $1
     ORDER BY created_at ASC`,
    [sessionId],
  );

  const generations = result.rows.map((row) => ({
    generationId: row.id as string,
    prompt: row.prompt as string,
    enhancedPrompt: row.enhanced_prompt as string | null,
    imageUrl: imageProxyUrl(row.id as string),
    mimeType: (row.mime_type as string | null) ?? "image/png",
    cameoUsed:
      Boolean(row.cameo_used) || /#(me|cameo)\b/i.test(row.prompt as string),
    createdAt: new Date(row.created_at as string).getTime(),
  }));

  return <SessionLoader sessionId={sessionId} generations={generations} />;
}
