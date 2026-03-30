"use client";

import { ScanFace } from "lucide-react";
import { useCameoStore } from "@/store/use-cameo-store";
import { useThumbnailUIStore } from "@/store/use-thumbnail-ui-store";
import { authClient } from "@/lib/auth/client";
import { buttonVariants } from "@/components/ui/button";

export function CameoButton() {
  const { registered, loading } = useCameoStore();
  const openCameoModal = useThumbnailUIStore((s) => s.openCameoModal);
  const openAuthModal = useThumbnailUIStore((s) => s.openAuthModal);
  const { data: session } = authClient.useSession();

  function handleClick() {
    if (!session) {
      openAuthModal();
    } else {
      openCameoModal();
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title={
        registered
          ? "Cameo registered — click to manage"
          : "Register your Cameo"
      }
      className={buttonVariants({ variant: "secondary", size: "lg" })}
    >
      <ScanFace className="size-4" />
      Cameo
    </button>
  );
}
