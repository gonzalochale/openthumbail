"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { useThumbnailStore } from "@/store/use-thumbnail-store";
import { useKonamiCode } from "@/hooks/use-konami-code";

export function KonamiCode() {
  const { data: session } = authClient.useSession();
  const setCredits = useThumbnailStore((s) => s.setCredits);

  const handleSuccess = useCallback(async () => {
    try {
      const res = await fetch("/api/konami", { method: "POST" });
      if (!res.ok) {
        if (res.status === 409)
          toast("You already found the secret. Nice try though");
        return;
      }
      const data = await res.json();
      setCredits(data.credits);
      toast("↑↑↓↓←→←→BA — Secret unlocked! +5 credits");
    } catch {
      // ignore errors, this is just an easter egg
    }
  }, [setCredits]);

  useKonamiCode(handleSuccess, !!session);

  return null;
}
