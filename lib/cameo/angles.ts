export const CAMEO_ANGLES = ["front", "left", "right", "up", "down"] as const;
export type CameoAngle = (typeof CAMEO_ANGLES)[number];


interface PoseAngles {
  pitch: number;
  yaw: number;
}

const THRESHOLDS: Record<CameoAngle, (p: PoseAngles) => boolean> = {
  front: ({ pitch, yaw }) => Math.abs(yaw) < 5 && Math.abs(pitch) < 5,
  left: ({ pitch, yaw }) => yaw > 25 && Math.abs(pitch) < 15,
  right: ({ pitch, yaw }) => yaw < -25 && Math.abs(pitch) < 15,
  up: ({ pitch, yaw }) => pitch < -15 && Math.abs(yaw) < 20,
  down: ({ pitch, yaw }) => pitch > 15 && Math.abs(yaw) < 20,
};

export function checkAlignment(pose: PoseAngles, angle: CameoAngle): boolean {
  return THRESHOLDS[angle](pose);
}

export const HOLD_DURATION_MS = 1000;
