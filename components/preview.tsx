"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useThumbnailStore } from "@/store/use-thumbnail-store";
import { useShallow } from "zustand/react/shallow";
import { PreviewActions } from "@/components/preview-actions";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export function Preview() {
  const { versions, selectedVersionId, generating } = useThumbnailStore(
    useShallow((s) => ({
      versions: s.versions,
      selectedVersionId: s.selectedVersionId,
      generating: s.generating,
    })),
  );

  const selectedVersion = versions.find((v) => v.id === selectedVersionId);
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center gap-2">
      <PreviewActions />
      <div
        className="relative w-full overflow-hidden rounded-xl"
        style={{ aspectRatio: "16/9" }}
      >
        <AnimatePresence mode="sync">
          {generating ? (
            <motion.div
              key="skeleton"
              className="absolute inset-0"
              initial={shouldReduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={shouldReduceMotion ? {} : { opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <Skeleton className="w-full h-full" />
            </motion.div>
          ) : selectedVersion ? (
            <motion.img
              key={`image-${selectedVersion.id}`}
              src={`data:${selectedVersion.mimeType};base64,${selectedVersion.imageBase64}`}
              alt={`Thumbnail v${selectedVersion.id}`}
              className="absolute inset-0 w-full h-full object-cover select-none"
              draggable={false}
              initial={shouldReduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={shouldReduceMotion ? {} : { opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            />
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
