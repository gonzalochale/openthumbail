"use client";

import { ArrowDown, Check } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { useThumbnailStore } from "@/store/use-thumbnail-store";
import { useShallow } from "zustand/react/shallow";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components//ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TextShimmer } from "@/components//ui/text-shimmer";
import { TextLoop } from "@/components//ui/text-loop";

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
  const {
    versions,
    selectedVersionId,
    generating,
    loading,
    download,
    selectVersion,
  } = useThumbnailStore(
    useShallow((s) => ({
      versions: s.versions,
      selectedVersionId: s.selectedVersionId,
      generating: s.generating,
      loading: s.loading,
      download: s.download,
      selectVersion: s.selectVersion,
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
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      className="font-mono text-sm text-muted-foreground"
                    />
                  }
                >
                  v{selectedVersion!.id}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-32 p-0">
                  <ScrollArea
                    className="max-h-40"
                    scrollbarClassName="data-vertical:w-2"
                  >
                    <div className="p-1">
                      {[...versions].reverse().map((v) => (
                        <DropdownMenuItem
                          key={v.id}
                          ref={
                            v.id === selectedVersionId
                              ? (el) => el?.scrollIntoView({ block: "nearest" })
                              : undefined
                          }
                          onClick={() => selectVersion(v.id)}
                          className="font-mono justify-between"
                        >
                          v{v.id}
                          {v.id === selectedVersionId && <Check data-icon />}
                        </DropdownMenuItem>
                      ))}
                    </div>
                  </ScrollArea>
                </DropdownMenuContent>
              </DropdownMenu>
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
