"use client";
import { cn } from "@/lib/utils";
import {
  motion,
  AnimatePresence,
  Transition,
  Variants,
  AnimatePresenceProps,
} from "motion/react";
import { useState, useEffect, Children } from "react";

export type TextLoopProps = {
  children: React.ReactNode[];
  className?: string;
  interval?: number | (() => number);
  transition?: Transition;
  variants?: Variants;
  onIndexChange?: (index: number) => void;
  trigger?: boolean;
  mode?: AnimatePresenceProps["mode"];
  presenceInitial?: boolean;
  startIndex?: number;
};

export function TextLoop({
  children,
  className,
  interval = 2,
  transition = { duration: 0.3 },
  variants,
  onIndexChange,
  trigger = true,
  mode = "popLayout",
  presenceInitial = false,
  startIndex = 0,
}: TextLoopProps) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const items = Children.toArray(children);

  useEffect(() => {
    if (!trigger) return;

    const getMs = () =>
      (typeof interval === "function" ? interval() : interval) * 1000;

    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setCurrentIndex((current) => {
          const next = (current + 1) % items.length;
          onIndexChange?.(next);
          return next;
        });
        schedule();
      }, getMs());
    };
    schedule();
    return () => clearTimeout(timer);
  }, [items.length, interval, onIndexChange, trigger]);

  const motionVariants: Variants = {
    initial: { y: 20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -20, opacity: 0 },
  };

  return (
    <div className={cn("relative inline-block whitespace-nowrap", className)}>
      <AnimatePresence mode={mode} initial={presenceInitial}>
        <motion.div
          key={currentIndex}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transition}
          variants={variants || motionVariants}
        >
          {items[currentIndex]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
