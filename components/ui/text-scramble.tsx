"use client";
import { type JSX, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, MotionProps } from "motion/react";

export type TextScrambleProps = {
  children: string;
  duration?: number;
  speed?: number;
  characterSet?: string;
  as?: React.ElementType;
  className?: string;
  trigger?: boolean;
  onScrambleComplete?: () => void;
} & MotionProps;

const defaultChars =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function TextScramble({
  children,
  duration = 0.8,
  speed = 0.04,
  characterSet = defaultChars,
  className,
  as: Component = "p",
  trigger = true,
  onScrambleComplete,
  ...props
}: TextScrambleProps) {
  const MotionComponent = motion.create(
    Component as keyof JSX.IntrinsicElements,
  );
  const [scrambledText, setScrambledText] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const prevChildrenRef = useRef(children);
  if (!trigger && !isAnimating) {
    prevChildrenRef.current = children;
  }

  const displayText = scrambledText ?? children;

  useLayoutEffect(() => {
    if (!trigger || isAnimating) return;
    const fromLen = prevChildrenRef.current.length;
    if (fromLen <= children.length) return;
    const initial = Array.from({ length: fromLen }, (_, i) =>
      i < children.length && children[i] === " "
        ? " "
        : characterSet[Math.floor(Math.random() * characterSet.length)],
    ).join("");
    setScrambledText(initial);
  }, [trigger]);

  useEffect(() => {
    if (!trigger) return;
    if (isAnimating) return;

    const text = children;
    const fromLen = prevChildrenRef.current.length;
    setIsAnimating(true);

    const steps = duration / speed;
    let step = 0;

    const interval = setInterval(() => {
      const progress = step / steps;

      const extraLen =
        fromLen > text.length
          ? Math.round((fromLen - text.length) * (1 - progress))
          : 0;
      const totalLen = text.length + extraLen;

      let scrambled = "";
      for (let i = 0; i < totalLen; i++) {
        if (i < text.length) {
          if (text[i] === " ") {
            scrambled += " ";
          } else if (progress * text.length > i) {
            scrambled += text[i];
          } else {
            scrambled +=
              characterSet[Math.floor(Math.random() * characterSet.length)];
          }
        } else {
          scrambled +=
            characterSet[Math.floor(Math.random() * characterSet.length)];
        }
      }

      setScrambledText(scrambled);
      step++;

      if (step > steps) {
        clearInterval(interval);
        setScrambledText(null);
        setIsAnimating(false);
        onScrambleComplete?.();
      }
    }, speed * 1000);

    return () => clearInterval(interval);
  }, [trigger]);

  return (
    <MotionComponent className={className} {...props}>
      {displayText}
    </MotionComponent>
  );
}
