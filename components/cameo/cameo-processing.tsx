"use client";

import { m, useMotionValue, useReducedMotion } from "motion/react";
import { CAMEO_ANGLES } from "@/lib/cameo/angles";
import { CameoScannerOverlay } from "./cameo-scanner-overlay";

const SIZE = 280;
const VIDEO_R = 108;

export function CameoProcessing() {
  const rm = useReducedMotion();

  const front = useMotionValue(0);
  const left = useMotionValue(0);
  const right = useMotionValue(0);
  const up = useMotionValue(0);
  const down = useMotionValue(0);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <m.div
          className="absolute"
          style={{
            inset: SIZE / 2 - VIDEO_R,
            borderRadius: "50%",
            background: "var(--channel)",
          }}
          animate={rm ? {} : { opacity: [0.3, 0.65, 0.3] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <CameoScannerOverlay
          capturedAngles={new Set(CAMEO_ANGLES)}
          holdProgressMap={{ front, left, right, up, down }}
        />
      </div>
    </div>
  );
}
