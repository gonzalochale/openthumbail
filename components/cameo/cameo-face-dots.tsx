"use client";

import { m } from "motion/react";
import { CAMEO_ANGLES, type CameoAngle } from "@/lib/cameo/angles";

interface CameoFaceDotsProps {
  captured: Set<CameoAngle>;
  current: CameoAngle | null;
}

const DOT_LABELS: Record<CameoAngle, string> = {
  front: "Front",
  left: "Left",
  right: "Right",
  up: "Up",
  down: "Down",
};

export function CameoFaceDots({ captured, current }: CameoFaceDotsProps) {
  return (
    <div className="flex items-center gap-3 justify-center">
      {CAMEO_ANGLES.map((angle) => {
        const isDone = captured.has(angle);
        const isActive = current === angle && !isDone;
        return (
          <div key={angle} className="flex flex-col items-center gap-1">
            <m.div
              animate={
                isDone
                  ? { scale: 1, opacity: 1 }
                  : isActive
                    ? { scale: [0.95, 1.1, 0.95], opacity: [0.8, 1, 0.8] }
                    : { scale: 0.8, opacity: 0.4 }
              }
              transition={
                isActive && !isDone
                  ? { duration: 1, repeat: Infinity, ease: "easeInOut" }
                  : { type: "spring", stiffness: 400, damping: 20 }
              }
              className={[
                "w-3 h-3 rounded-full border-2 transition-colors",
                isDone
                  ? "bg-channel border-channel"
                  : isActive
                    ? "bg-transparent border-foreground"
                    : "bg-transparent border-foreground/30",
              ].join(" ")}
            />
            <span
              className={[
                "text-[10px] transition-colors",
                isDone
                  ? "text-channel"
                  : isActive
                    ? "text-foreground"
                    : "text-foreground/30",
              ].join(" ")}
            >
              {DOT_LABELS[angle]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
