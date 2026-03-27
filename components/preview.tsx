"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useThumbnailStore } from "@/store/use-thumbnail-store";
import { useShallow } from "zustand/react/shallow";
import { PreviewActions } from "@/components/preview-actions";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ThumbnailVersion } from "@/store/use-thumbnail-store";

function PreviewImage({
  version,
  shouldReduceMotion,
  onLoaded,
}: {
  version: ThumbnailVersion;
  shouldReduceMotion: boolean | null;
  onLoaded: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <motion.img
      src={version.imageUrl}
      alt={`Thumbnail v${version.id}`}
      className="absolute inset-0 w-full h-full object-cover select-none"
      draggable={false}
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: loaded ? 1 : 0 }}
      exit={shouldReduceMotion ? {} : { opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
      onLoad={() => {
        setLoaded(true);
        onLoaded();
      }}
    />
  );
}

export function Preview() {
  const { versions, selectedVersionId, generating } = useThumbnailStore(
    useShallow((s) => ({
      versions: s.versions,
      selectedVersionId: s.selectedVersionId,
      generating: s.generating,
    })),
  );

  const [loadedVersionId, setLoadedVersionId] = useState<number | null>(null);
  const selectedVersion = versions.find((v) => v.id === selectedVersionId);
  const shouldReduceMotion = useReducedMotion();
  const imageLoaded = loadedVersionId === selectedVersion?.id;
  const showSkeleton = generating || (!!selectedVersion && !imageLoaded);
  const showPreview = generating || versions.length > 0;

  return (
    <div className="w-full max-w-5xl flex-1 flex flex-col items-center justify-center">
      <AnimatePresence>
        {showPreview && (
          <motion.div
            key="preview-area"
            className="w-full flex flex-col gap-2"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
          >
            <PreviewActions />
            <div
              className="relative w-full overflow-hidden rounded-md"
              style={{ aspectRatio: "16/9" }}
            >
              <AnimatePresence>
                {showSkeleton && (
                  <motion.div
                    key="skeleton"
                    className="absolute inset-0"
                    initial={shouldReduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={shouldReduceMotion ? {} : { opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
                  >
                    <Skeleton className="w-full h-full" />
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {selectedVersion && !generating && (
                  <PreviewImage
                    key={`image-${selectedVersion.id}`}
                    version={selectedVersion}
                    shouldReduceMotion={shouldReduceMotion}
                    onLoaded={() => setLoadedVersionId(selectedVersion.id)}
                  />
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
