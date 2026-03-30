"use client";

import {
  useMotionValueEvent,
  useReducedMotion,
  type MotionValue,
} from "motion/react";
import { useState } from "react";
import type { CameoAngle } from "@/lib/cameo/angles";

export interface CameoScannerOverlayProps {
  capturedAngles: Set<CameoAngle>;
  holdProgressMap: Record<CameoAngle, MotionValue<number>>;
}

const SIZE = 280;
const CX = SIZE / 2;
const CY = SIZE / 2;
const RING_RADIUS = 114;

const TICKS_PER_SECTION = 12;
const SECTION_GAP_DEG = 5;
const SECTION_DEG = (360 - 4 * SECTION_GAP_DEG) / 4;
const TICK_DEG = SECTION_DEG / TICKS_PER_SECTION;

const TICK_CIRC_W = 4;
const TICK_W_BASE = 12;
const TICK_W_HOLD_MAX = 20;
const TICK_W_DONE = 23;

const COLOR_IDLE = "color-mix(in srgb, white 15%, transparent)";
const COLOR_ACTIVE = "color-mix(in srgb, white 45%, transparent)";
const COLOR_DONE = "var(--success)";

const SECTIONS = [
  { angle: "up" as CameoAngle, ringStart: -132.5 },
  { angle: "right" as CameoAngle, ringStart: -42.5 },
  { angle: "down" as CameoAngle, ringStart: 47.5 },
  { angle: "left" as CameoAngle, ringStart: 137.5 },
] as const;

const TICK_DATA = SECTIONS.flatMap(({ angle, ringStart }, sectionIdx) =>
  Array.from({ length: TICKS_PER_SECTION }, (_, tickIdx) => ({
    sectionIdx,
    tickIdx,
    sectionAngle: angle,
    angle: ringStart + (tickIdx + 0.5) * TICK_DEG,
  })),
);

type DirectionalAngle = "up" | "right" | "down" | "left";

export function CameoScannerOverlay({
  capturedAngles,
  holdProgressMap,
}: CameoScannerOverlayProps) {
  const [holdUp, setHoldUp] = useState(0);
  const [holdRight, setHoldRight] = useState(0);
  const [holdDown, setHoldDown] = useState(0);
  const [holdLeft, setHoldLeft] = useState(0);
  const reducedMotion = useReducedMotion();

  useMotionValueEvent(holdProgressMap.up, "change", setHoldUp);
  useMotionValueEvent(holdProgressMap.right, "change", setHoldRight);
  useMotionValueEvent(holdProgressMap.down, "change", setHoldDown);
  useMotionValueEvent(holdProgressMap.left, "change", setHoldLeft);

  const holdFractions: Record<DirectionalAngle, number> = {
    up: holdUp,
    right: holdRight,
    down: holdDown,
    left: holdLeft,
  };

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="absolute inset-0 pointer-events-none"
    >
      {TICK_DATA.map(({ sectionIdx, tickIdx, sectionAngle, angle }) => {
        const isDone = capturedAngles.has(sectionAngle);
        const holdFraction = holdFractions[sectionAngle as DirectionalAngle];

        const lo = tickIdx / TICKS_PER_SECTION;
        const hi = (tickIdx + 1) / TICKS_PER_SECTION;
        const tickProgress =
          holdFraction >= hi
            ? 1
            : holdFraction > lo
              ? (holdFraction - lo) * TICKS_PER_SECTION
              : 0;

        const w = reducedMotion
          ? isDone
            ? TICK_W_DONE
            : TICK_W_BASE
          : isDone
            ? TICK_W_DONE
            : TICK_W_BASE + holdFraction * (TICK_W_HOLD_MAX - TICK_W_BASE);

        let fill: string;
        if (isDone || tickProgress >= 1) {
          fill = COLOR_DONE;
        } else if (holdFraction > 0) {
          fill = COLOR_ACTIVE;
        } else {
          fill = COLOR_IDLE;
        }

        const transition = reducedMotion
          ? "none"
          : isDone
            ? "fill 300ms ease-out, width 400ms cubic-bezier(0.22, 1, 0.36, 1)"
            : holdFraction > 0
              ? "fill 80ms ease, width 50ms linear"
              : "fill 200ms ease-out, width 200ms ease-out";

        return (
          <g
            key={`${sectionIdx}-${tickIdx}`}
            transform={`rotate(${angle} ${CX} ${CY})`}
          >
            <rect
              x={CX + RING_RADIUS}
              y={CY - TICK_CIRC_W / 2}
              width={w}
              height={TICK_CIRC_W}
              rx={TICK_CIRC_W / 2}
              style={{ fill, transition }}
            />
          </g>
        );
      })}
    </svg>
  );
}
