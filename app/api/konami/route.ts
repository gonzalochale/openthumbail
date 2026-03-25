import { auth } from "@/lib/auth";
import { grantKonamiCredits } from "@/lib/credits";
import { headers } from "next/headers";

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { newBalance, alreadyRedeemed } = await grantKonamiCredits(
    session.user.id,
    session.user.email,
  );
  if (alreadyRedeemed)
    return Response.json({ error: "Already redeemed" }, { status: 409 });

  return Response.json({ credits: newBalance });
}
