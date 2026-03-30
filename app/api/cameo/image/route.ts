import { requireAuth } from "@/lib/auth/require-auth";
import { getCameo } from "@/lib/cameo/service";
import { getObjectBase64 } from "@/lib/storage/s3";

export async function GET() {
  const session = await requireAuth();
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const record = await getCameo(session.user.id);
  if (!record) return Response.json({ error: "Not found" }, { status: 404 });

  const base64 = await getObjectBase64(record.imageKey);
  const body = Buffer.from(base64, "base64");
  return new Response(body, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
