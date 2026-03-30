"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useCameoStore } from "@/store/use-cameo-store";
import { CameoScanner } from "./cameo-scanner";
import { CameoManage } from "./cameo-manage";

interface CameoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CameoModal({ open, onOpenChange }: CameoModalProps) {
  const { registered, setRegistered } = useCameoStore();
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleScanComplete(
    images: { angle: string; base64: string }[],
  ) {
    setRegistered(true);
    setUploadError(null);
    try {
      const res = await fetch("/api/cameo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: images[0].base64 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Upload failed");
      }
    } catch (err) {
      setRegistered(false);
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  function handleClose() {
    onOpenChange(false);
    setTimeout(() => setUploadError(null), 300);
  }

  const title = registered ? "Your Cameo" : "Register Cameo";
  const description = registered
    ? "Use #me in any prompt to appear in your thumbnails."
    : "Scan your face to personalize thumbnails.";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent showCloseButton={false} className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-xs">
            {description}
          </DialogDescription>
        </DialogHeader>
        {uploadError && (
          <p className="text-xs text-destructive -mt-1">{uploadError}</p>
        )}
        {registered ? (
          <CameoManage onClose={handleClose} />
        ) : (
          <CameoScanner onComplete={handleScanComplete} />
        )}
      </DialogContent>
    </Dialog>
  );
}
