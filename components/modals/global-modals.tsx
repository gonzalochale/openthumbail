"use client";

import { useEffect } from "react";
import { AuthModal } from "@/components/modals/auth-modal";
import { CreditsModal } from "@/components/modals/credits-modal";
import { GeminiKeyModal } from "@/components/modals/gemini-key-modal";
import { InfoModal } from "@/components/modals/info-modal";
import { CameoModal } from "@/components/cameo/cameo-modal";
import { useThumbnailStore } from "@/store/use-thumbnail-store";
import { useThumbnailUIStore } from "@/store/use-thumbnail-ui-store";
import { useCameoStore } from "@/store/use-cameo-store";
import { useShallow } from "zustand/react/shallow";
import { authClient } from "@/lib/auth/client";

export function GlobalModals() {
  const { data: session, isPending } = authClient.useSession();
  const setCredits = useThumbnailStore((s) => s.setCredits);
  const { setRegistered, setLoading } = useCameoStore(
    useShallow((s) => ({ setRegistered: s.setRegistered, setLoading: s.setLoading })),
  );

  useEffect(() => {
    if (isPending) return;
    if (!session) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    fetch("/api/cameo", { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        setRegistered(data.registered ?? false);
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") setLoading(false);
      });
    return () => controller.abort();
  }, [isPending, session?.user.id, setRegistered, setLoading]);

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
    cameoModalOpen,
    closeCameoModal,
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
      cameoModalOpen: s.cameoModalOpen,
      closeCameoModal: s.closeCameoModal,
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
      <CameoModal
        open={cameoModalOpen}
        onOpenChange={(o) => !o && closeCameoModal()}
      />
    </>
  );
}
