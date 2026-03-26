import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { getSignedUrl } from "@/lib/s3";
import { headers } from "next/headers";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: generationId } = await params;

  const result = await pool.query<{ image_key: string }>(
    `SELECT image_key FROM thumbnail_generation WHERE id = $1 AND user_id = $2`,
    [generationId, session.user.id],
  );
  if (result.rows.length === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const signedUrl = await getSignedUrl(result.rows[0].image_key);

  const blob = new URL(req.url).searchParams.get("blob");
  if (blob) {
    const s3Response = await fetch(signedUrl);
    return new Response(s3Response.body, {
      headers: {
        "Content-Type": s3Response.headers.get("Content-Type") ?? "image/png",
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  return Response.redirect(signedUrl, 302);
}
