"use client";

import { cn } from "@/lib/utils";
import { m, AnimatePresence, useReducedMotion } from "motion/react";
import { buttonVariants } from "../ui/button";

interface CameoCompleteProps {
  uploading: boolean;
  error: string | null;
  onDone: () => void;
}

const EASE_OUT = [0.25, 1, 0.5, 1] as const;
const SPRING_BTN = { type: "spring" as const, stiffness: 500, damping: 30 };

export function CameoComplete({
  uploading,
  error,
  onDone,
}: CameoCompleteProps) {
  const rm = useReducedMotion();

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <AnimatePresence mode="wait">
        {uploading ? (
          <m.div
            key="uploading"
            initial={rm ? (false as const) : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            className="flex flex-col items-center gap-3"
          >
            <div className="relative w-12 h-12 flex items-center justify-center">
              <m.div
                className="absolute inset-0 rounded-full border-2 border-ring/50"
                animate={
                  rm
                    ? {}
                    : {
                        scale: [1, 1.35, 1],
                        opacity: [0.5, 0, 0.5],
                      }
                }
                transition={{
                  duration: 1.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <div className="w-2 h-2 rounded-full bg-ring/60" />
            </div>
            <m.p
              className="text-sm text-muted-foreground"
              animate={rm ? {} : { opacity: [0.5, 1, 0.5] }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              Saving…
            </m.p>
          </m.div>
        ) : error ? (
          <m.div
            key="error"
            initial={rm ? (false as const) : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
            className="flex flex-col items-center gap-3 text-center"
          >
            <p className="text-sm text-destructive">{error}</p>
            <m.button
              onClick={onDone}
              whileTap={rm ? undefined : { scale: 0.97 }}
              transition={SPRING_BTN}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Try again
            </m.button>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
