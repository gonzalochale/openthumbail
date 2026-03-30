"use client";

import { m, AnimatePresence, useReducedMotion } from "motion/react";
import { CheckCircle } from "lucide-react";

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
              className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              Try again
            </m.button>
          </m.div>
        ) : (
          <m.div key="success" className="flex flex-col items-center gap-3">
            <m.div
              initial={rm ? (false as const) : { scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", duration: 0.45, bounce: 0.15 }}
            >
              <CheckCircle className="w-10 h-10 text-green-500" />
            </m.div>
            <m.p
              initial={rm ? (false as const) : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.1, ease: EASE_OUT }}
              className="text-sm font-medium"
            >
              Cameo ready
            </m.p>
            <m.p
              initial={rm ? (false as const) : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.15, ease: EASE_OUT }}
              className="text-xs text-muted-foreground text-center px-4"
            >
              Type <span className="font-mono text-foreground">#me</span> in any
              prompt to appear in your thumbnails
            </m.p>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
