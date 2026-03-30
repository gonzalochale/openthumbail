import { requireAuth } from "@/lib/auth/require-auth";
import {
  deleteCameo,
  hasCameo,
  saveCameo,
  validateImage,
} from "@/lib/cameo/service";

export async function GET() {
  const session = await requireAuth();
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const registered = await hasCameo(session.user.id);
  return Response.json({ registered });
}

export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { image } = body as { image?: string };
  const validationError = validateImage(image ?? "");
  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  await saveCameo(session.user.id, image!);
  return Response.json({ success: true });
}

export async function DELETE() {
  const session = await requireAuth();
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  await deleteCameo(session.user.id);
  return Response.json({ success: true });
}
