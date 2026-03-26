import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { imageProxyUrl } from "@/lib/s3";
import { headers } from "next/headers";

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await pool.query<{ id: string }>(
    `INSERT INTO thumbnail_session (user_id) VALUES ($1) RETURNING id`,
    [session.user.id],
  );

  return Response.json({ id: result.rows[0].id });
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await pool.query<{
    id: string;
    created_at: string;
    generation_count: number;
    last_generation_id: string | null;
    first_prompt: string | null;
  }>(
    `SELECT
       s.id,
       s.created_at,
       COUNT(g.id)::int AS generation_count,
       (
         SELECT g2.id
         FROM thumbnail_generation g2
         WHERE g2.session_id = s.id
         ORDER BY g2.created_at DESC
         LIMIT 1
       ) AS last_generation_id,
       (
         SELECT g3.prompt
         FROM thumbnail_generation g3
         WHERE g3.session_id = s.id
         ORDER BY g3.created_at ASC
         LIMIT 1
       ) AS first_prompt
     FROM thumbnail_session s
     LEFT JOIN thumbnail_generation g ON g.session_id = s.id
     WHERE s.user_id = $1
     GROUP BY s.id
     ORDER BY s.created_at DESC`,
    [session.user.id],
  );

  const sessions = result.rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    generationCount: row.generation_count,
    previewUrl: row.last_generation_id
      ? imageProxyUrl(row.last_generation_id)
      : null,
    firstPrompt: row.first_prompt ?? null,
  }));

  return Response.json({ sessions });
}
