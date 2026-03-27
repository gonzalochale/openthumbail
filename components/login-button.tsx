"use client";

import { Button } from "@/components/ui/button";
import { useThumbnailStore } from "@/store/use-thumbnail-store";
import { cn } from "@/lib/utils";

export function LoginButton({ className }: { className?: string }) {
  const openAuthModal = useThumbnailStore((s) => s.openAuthModal);

  return (
    <Button size="lg" variant="outline" className={cn("w-28", className)} onClick={openAuthModal}>
      Log in
    </Button>
  );
}
