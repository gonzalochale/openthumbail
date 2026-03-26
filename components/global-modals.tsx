"use client";

import { useEffect } from "react";
import { AuthModal } from "@/components/auth-modal";
import { CreditsModal } from "@/components/credits-modal";
import { useThumbnailStore } from "@/store/use-thumbnail-store";
import { useShallow } from "zustand/react/shallow";
import { authClient } from "@/lib/auth-client";

export function GlobalModals() {
  const { data: session } = authClient.useSession();
  const setCredits = useThumbnailStore((s) => s.setCredits);

  useEffect(() => {
    if (session?.user.credits != null) {
      setCredits(session.user.credits);
    }
  }, [session?.user.credits, setCredits]);

  useEffect(() => {
    const onFocus = async () => {
      const fresh = await authClient.getSession({ fetchOptions: { cache: "no-store" } });
      if (fresh.data?.user.credits != null) {
        setCredits(fresh.data.user.credits);
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [setCredits]);
  const { authModalOpen, closeAuthModal, creditsModalOpen, closeCreditsModal } =
    useThumbnailStore(
      useShallow((s) => ({
        authModalOpen: s.authModalOpen,
        closeAuthModal: s.closeAuthModal,
        creditsModalOpen: s.creditsModalOpen,
        closeCreditsModal: s.closeCreditsModal,
      })),
    );

  return (
    <>
      <AuthModal
        open={authModalOpen}
        onOpenChange={(o) => !o && closeAuthModal()}
      />
      <CreditsModal
        open={creditsModalOpen}
        onOpenChange={(o) => !o && closeCreditsModal()}
      />
    </>
  );
}
