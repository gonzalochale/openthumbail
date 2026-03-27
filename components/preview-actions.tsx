"use client";

import {
  ArrowDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TextShimmer } from "@/components//ui/text-shimmer";
import { TextLoop } from "@/components//ui/text-loop";
import { GENERATING_PHRASES } from "@/lib/constants";
import { randomItem } from "@/lib/utils";

export function PreviewActions() {
  const shouldReduceMotion = useReducedMotion();
  const phraseIndexRef = useRef(0);
  const randomInterval = () => randomItem([2.5, 3, 3.5, 4, 4.5, 5]);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [downloadedKey, setDownloadedKey] = useState(0);
  const [downloaded, setDownloaded] = useState(false);
  const downloadResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    versions,
    selectedVersionId,
    generating,
    loading,
    download,
    downloadTick,
    downloading,
    copy,
    copyTick,
    copying,
    selectVersion,
  } = useThumbnailStore(
    useShallow((s) => ({
      versions: s.versions,
      selectedVersionId: s.selectedVersionId,
      generating: s.generating,
      loading: s.loading,
      download: s.download,
      downloadTick: s.downloadTick,
      downloading: s.downloading,
      copy: s.copy,
      copyTick: s.copyTick,
      copying: s.copying,
      selectVersion: s.selectVersion,
    })),
  );

  const shuffledPhrases = useMemo(
    () =>
      !generating
        ? GENERATING_PHRASES
        : [...GENERATING_PHRASES].sort(() => Math.random() - 0.5),
    [generating],
  );
  useEffect(() => {
    if (generating) phraseIndexRef.current = 0;
  }, [generating]);

  useEffect(() => {
    const version = useThumbnailStore
      .getState()
      .versions.find((v) => v.id === selectedVersionId);
    if (!version) return;
    const controller = new AbortController();
    fetch(`${version.imageUrl}?blob=1`, { signal: controller.signal }).catch(
      () => {},
    );
    return () => controller.abort();
  }, [selectedVersionId]);

  useEffect(() => {
    if (downloadTick === 0) return;
    setDownloaded(true);
    setDownloadedKey((k) => k + 1);
    if (downloadResetTimer.current) clearTimeout(downloadResetTimer.current);
    downloadResetTimer.current = setTimeout(() => setDownloaded(false), 600);
    return () => {
      if (downloadResetTimer.current) clearTimeout(downloadResetTimer.current);
    };
  }, [downloadTick]);

  useEffect(() => {
    if (copyTick === 0) return;
    setCopyState("copied");
    if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    copyResetTimer.current = setTimeout(() => setCopyState("idle"), 600);
    return () => {
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    };
  }, [copyTick]);

  const selectedVersion = versions.find((v) => v.id === selectedVersionId);

  const slotVariants = {
    initial: shouldReduceMotion ? { opacity: 0 } : { y: 8, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: shouldReduceMotion ? { opacity: 0 } : { y: -8, opacity: 0 },
  };
  const slotTransition = { duration: 0.15, ease: [0.25, 1, 0.5, 1] as const };

  const copyDisabled =
    loading || !selectedVersion || copying || copyState !== "idle";
  const downloadDisabled =
    loading || !selectedVersion || downloading || downloaded;

  return (
    <div className="w-full flex items-center justify-between gap-2">
      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait">
          {generating ? (
            <motion.div
              key="loading"
              variants={slotVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={slotTransition}
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
                  {shuffledPhrases.map((phrase, i) => (
                    <TextShimmer
                      key={i}
                      className="font-mono text-sm"
                      duration={1}
                    >
                      {phrase}
                    </TextShimmer>
                  ))}
                </TextLoop>
              )}
            </motion.div>
          ) : selectedVersion ? (
            <motion.div
              key={`version-${selectedVersion.id}`}
              variants={slotVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={slotTransition}
            >
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="icon-lg"
                  disabled={selectedVersion.id === 0}
                  onClick={() => selectVersion(selectedVersion.id - 1)}
                >
                  <ChevronLeft size={16} />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        className="font-mono text-sm text-muted-foreground px-1.5"
                      />
                    }
                  >
                    v{selectedVersion.id}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48 p-0">
                    <div className="flex items-center justify-between px-2.5 py-2 border-b">
                      <span className="text-xs font-medium">All versions</span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {versions.length}
                      </span>
                    </div>
                    <ScrollArea
                      className="max-h-60"
                      scrollbarClassName="data-vertical:w-2"
                    >
                      <div className="flex flex-col gap-1 p-1.5">
                        {[...versions].reverse().map((v) => (
                          <DropdownMenuItem
                            key={v.id}
                            ref={
                              v.id === selectedVersionId
                                ? (el) =>
                                    el?.scrollIntoView({ block: "nearest" })
                                : undefined
                            }
                            onClick={() => selectVersion(v.id)}
                            className={cn(
                              "cursor-pointer justify-between gap-2 py-2",
                              v.id === selectedVersionId &&
                                "bg-accent text-accent-foreground",
                            )}
                          >
                            <span className="font-mono text-xs tabular-nums">
                              v{v.id}
                            </span>
                            <img
                              src={v.imageUrl}
                              alt={`v${v.id}`}
                              className="aspect-video w-16 shrink-0 rounded-sm object-cover select-none bg-accent"
                              draggable={false}
                            />
                          </DropdownMenuItem>
                        ))}
                      </div>
                    </ScrollArea>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  disabled={selectedVersion.id === versions.length - 1}
                  onClick={() => selectVersion(selectedVersion.id + 1)}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            disabled={copyDisabled}
            render={
              <Button
                variant="ghost"
                onClick={() => selectedVersion && copy(selectedVersion.id)}
                size="icon-lg"
                disabled={copyDisabled}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {copyState === "copied" ? (
                    <motion.span
                      key="check"
                      initial={
                        shouldReduceMotion
                          ? { opacity: 0 }
                          : { opacity: 0, scale: 0.6 }
                      }
                      animate={{ opacity: 1, scale: 1 }}
                      exit={
                        shouldReduceMotion
                          ? { opacity: 0 }
                          : { opacity: 0, scale: 0.6 }
                      }
                      transition={{ duration: 0.15, ease: [0.25, 1, 0.5, 1] }}
                    >
                      <Check size={16} />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="copy"
                      initial={
                        shouldReduceMotion
                          ? { opacity: 0 }
                          : { opacity: 0, scale: 0.6 }
                      }
                      animate={{ opacity: 1, scale: 1 }}
                      exit={
                        shouldReduceMotion
                          ? { opacity: 0 }
                          : { opacity: 0, scale: 0.6 }
                      }
                      transition={{ duration: 0.15, ease: [0.25, 1, 0.5, 1] }}
                    >
                      <Copy size={16} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
            }
            onClick={(event) => event.stopPropagation()}
          />
          <TooltipContent>
            <p>{copyState === "copied" ? "Copied!" : "Copy to clipboard"}</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            disabled={downloadDisabled}
            render={
              <Button
                variant="ghost"
                onClick={() => selectedVersion && download(selectedVersion.id)}
                size="icon-lg"
                disabled={downloadDisabled}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {downloaded ? (
                    <motion.span
                      key={`check-${downloadedKey}`}
                      initial={
                        shouldReduceMotion
                          ? { opacity: 0 }
                          : { opacity: 0, scale: 0.6 }
                      }
                      animate={{ opacity: 1, scale: 1 }}
                      exit={
                        shouldReduceMotion
                          ? { opacity: 0 }
                          : { opacity: 0, scale: 0.6 }
                      }
                      transition={{ duration: 0.15, ease: [0.25, 1, 0.5, 1] }}
                    >
                      <Check size={16} />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="arrow"
                      initial={
                        shouldReduceMotion
                          ? { opacity: 0 }
                          : { opacity: 0, scale: 0.6 }
                      }
                      animate={{ opacity: 1, scale: 1 }}
                      exit={
                        shouldReduceMotion
                          ? { opacity: 0 }
                          : { opacity: 0, scale: 0.6 }
                      }
                      transition={{ duration: 0.15, ease: [0.25, 1, 0.5, 1] }}
                    >
                      <ArrowDown size={18} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
            }
            onClick={(event) => event.stopPropagation()}
          />
          <TooltipContent>
            <p>{downloaded ? "Downloaded!" : "Download"}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
