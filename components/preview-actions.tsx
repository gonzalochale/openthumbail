"use client";

import { ArrowDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { useThumbnailStore } from "@/store/use-thumbnail-store";
import { useShallow } from "zustand/react/shallow";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { TextShimmer } from "./ui/text-shimmer";
import { TextLoop } from "./ui/text-loop";

const GENERATING_PHRASES = [
  "Adjusting details...",
  "Refining colors...",
  "Applying styles...",
  "Almost there...",
  "Adding depth...",
  "Balancing contrast...",
  "Enhancing lighting...",
  "Fine-tuning layout...",
  "Sharpening edges...",
  "Polishing textures...",
  "Optimizing composition...",
  "Rendering pixels...",
  "Crafting masterpiece...",
  "Infusing creativity...",
  "Bringing vision to life...",
  "Transforming ideas...",
  "Creating magic...",
  "Unleashing imagination...",
  "Blending elements...",
  "Perfecting design...",
  "Capturing essence...",
  "Elevating aesthetics...",
  "Sculpting visuals...",
  "Harmonizing colors...",
  "Weaving details...",
  "Balancing hues...",
  "Refining composition...",
];

export function PreviewActions() {
  const shouldReduceMotion = useReducedMotion();
  const phraseIndexRef = useRef(0);
  const randomInterval = () => {
    const steps = [2.5, 3, 3.5, 4, 4.5, 5];
    return steps[Math.floor(Math.random() * steps.length)];
  };
  const { versions, selectedVersionId, generating, loading, download } =
    useThumbnailStore(
      useShallow((s) => ({
        versions: s.versions,
        selectedVersionId: s.selectedVersionId,
        generating: s.generating,
        loading: s.loading,
        download: s.download,
      })),
    );

  const selectedVersion = versions.find((v) => v.id === selectedVersionId);
  if (!selectedVersion && !generating) return null;

  return (
    <div className="w-full flex items-center justify-between gap-2">
      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait">
          {generating ? (
            <motion.div
              key="loading"
              initial={shouldReduceMotion ? false : { y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              transition={{ duration: 0.15, ease: [0.215, 0.61, 0.355, 1] }}
            >
              {versions.length === 0 ? (
                <TextShimmer className="font-mono text-sm" duration={1}>
                  Creating image...
                </TextShimmer>
              ) : (
                <TextLoop
                  className="font-mono text-sm"
                  interval={randomInterval}
                  presenceInitial={true}
                  startIndex={
                    (phraseIndexRef.current + 1) % GENERATING_PHRASES.length
                  }
                  onIndexChange={(i) => {
                    phraseIndexRef.current = i;
                  }}
                >
                  {GENERATING_PHRASES.map((phrase) => (
                    <TextShimmer
                      key={phrase}
                      className="font-mono text-sm"
                      duration={1}
                    >
                      {phrase}
                    </TextShimmer>
                  ))}
                </TextLoop>
              )}
            </motion.div>
          ) : (
            <motion.div
              key={`version-${selectedVersion!.id}`}
              initial={shouldReduceMotion ? false : { y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              transition={{ duration: 0.15, ease: [0.215, 0.61, 0.355, 1] }}
            >
              <p className="font-mono text-sm text-muted-foreground">
                v{selectedVersion!.id}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <Tooltip>
        <TooltipTrigger
          disabled={loading || !selectedVersion}
          render={
            <Button
              variant="outline"
              onClick={() => selectedVersion && download(selectedVersion.id)}
              size="icon-lg"
              disabled={loading || !selectedVersion}
            >
              <ArrowDown size={18} />
            </Button>
          }
          onClick={(event) => event.stopPropagation()}
        />
        <TooltipContent>
          <p>Download</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
