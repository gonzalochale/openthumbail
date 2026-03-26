"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

export type FileEntry = { file: File; url: string };

interface FileChipListProps {
  fileEntries: FileEntry[];
  pendingDeleteFile: boolean;
  fileHoverOpen: boolean | undefined;
  onHoverOpenChange: (open: boolean | undefined) => void;
  onRemove: (index: number) => void;
}

export function FileChipList({
  fileEntries,
  pendingDeleteFile,
  fileHoverOpen,
  onHoverOpenChange,
  onRemove,
}: FileChipListProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {fileEntries.length > 0 && (
        <motion.div
          key="chips"
          initial={
            shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }
          }
          animate={
            shouldReduceMotion ? { opacity: 1 } : { height: "auto", opacity: 1 }
          }
          exit={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
          style={{ overflow: "hidden" }}
        >
          <div className="flex flex-wrap gap-2 px-2 pt-2 pb-1">
            <AnimatePresence mode="popLayout">
              {fileEntries.map(({ file, url }, index) => (
                <motion.div
                  key={url}
                  initial={
                    shouldReduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, scale: 0.85, filter: "blur(4px)" }
                  }
                  animate={
                    shouldReduceMotion
                      ? { opacity: 1 }
                      : { opacity: 1, scale: 1, filter: "blur(0px)" }
                  }
                  exit={
                    shouldReduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, scale: 0.85 }
                  }
                  transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                  className={`bg-background border rounded-lg text-sm overflow-hidden transition-shadow duration-150 ${pendingDeleteFile ? "ring-2 ring-offset-1 ring-offset-card ring-destructive/60" : ""}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <HoverCard
                    open={fileHoverOpen}
                    onOpenChange={onHoverOpenChange}
                  >
                    <HoverCardTrigger
                      delay={200}
                      closeDelay={100}
                      render={
                        <div className="flex items-center gap-1.5 pl-1.5 pr-2 py-1.5 cursor-default" />
                      }
                    >
                      <img
                        src={url}
                        alt="Starting image"
                        className="size-6 rounded-sm object-cover shrink-0"
                        draggable={false}
                      />
                      <span className="text-xs font-medium leading-tight text-muted-foreground">
                        Starting image
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(index);
                        }}
                        className={buttonVariants({
                          variant: "ghost",
                          size: "icon-sm",
                        })}
                      >
                        <X className="size-3" />
                      </button>
                    </HoverCardTrigger>
                    <HoverCardContent
                      className="w-52 p-2"
                      side="top"
                      align="start"
                    >
                      <motion.img
                        src={url}
                        alt={file.name}
                        className="aspect-video w-full rounded-sm object-cover"
                        draggable={false}
                        initial={
                          shouldReduceMotion
                            ? false
                            : { opacity: 0, scale: 0.95 }
                        }
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                          duration: 0.18,
                          ease: [0.25, 1, 0.5, 1],
                        }}
                      />
                    </HoverCardContent>
                  </HoverCard>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
