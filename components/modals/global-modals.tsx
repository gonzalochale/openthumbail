"use client";

import { useEffect } from "react";
import { AuthModal } from "@/components/modals/auth-modal";
import { CreditsModal } from "@/components/modals/credits-modal";
import { GeminiKeyModal } from "@/components/modals/gemini-key-modal";
import { InfoModal } from "@/components/modals/info-modal";
import { useThumbnailStore } from "@/store/use-thumbnail-store";
import { useThumbnailUIStore } from "@/store/use-thumbnail-ui-store";
import { useShallow } from "zustand/react/shallow";
import { authClient } from "@/lib/auth/client";

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
      const fresh = await authClient.getSession({
        fetchOptions: { cache: "no-store" },
      });
      if (fresh.data?.user.credits != null) {
        setCredits(fresh.data.user.credits);
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [setCredits]);
  const {
    authModalOpen,
    closeAuthModal,
    creditsModalOpen,
    closeCreditsModal,
    infoModalOpen,
    closeInfoModal,
    geminiKeyModalOpen,
    closeGeminiKeyModal,
  } = useThumbnailUIStore(
    useShallow((s) => ({
      authModalOpen: s.authModalOpen,
      closeAuthModal: s.closeAuthModal,
      creditsModalOpen: s.creditsModalOpen,
      closeCreditsModal: s.closeCreditsModal,
      infoModalOpen: s.infoModalOpen,
      closeInfoModal: s.closeInfoModal,
      geminiKeyModalOpen: s.geminiKeyModalOpen,
      closeGeminiKeyModal: s.closeGeminiKeyModal,
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
      <InfoModal
        open={infoModalOpen}
        onOpenChange={(o) => !o && closeInfoModal()}
      />
      <GeminiKeyModal
        open={geminiKeyModalOpen}
        onOpenChange={(o) => !o && closeGeminiKeyModal()}
      />
    </>
  );
}
