"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { animate, useMotionValue, useReducedMotion } from "motion/react";
import type { MotionValue } from "motion/react";
import {
  CAMEO_ANGLES,
  HOLD_DURATION_MS,
  checkAlignment,
  type CameoAngle,
} from "@/lib/cameo/angles";
import { getPoseAngles } from "@/lib/cameo/pose";
import { CameoScannerOverlay } from "./cameo-scanner-overlay";

const MEDIAPIPE_NOISY_ERROR_SNIPPETS = [
  "INFO: Created TensorFlow Lite XNNPACK delegate for CPU.",
];

function shouldIgnoreMediapipeConsoleError(args: unknown[]): boolean {
  return args.some(
    (arg) =>
      typeof arg === "string" &&
      MEDIAPIPE_NOISY_ERROR_SNIPPETS.some((snippet) => arg.includes(snippet)),
  );
}

function withFilteredConsoleError<T>(run: () => T): T {
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    if (shouldIgnoreMediapipeConsoleError(args)) return;
    originalConsoleError(...(args as Parameters<typeof console.error>));
  };
  try {
    return run();
  } finally {
    console.error = originalConsoleError;
  }
}

async function withFilteredConsoleErrorAsync<T>(
  run: () => Promise<T>,
): Promise<T> {
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    if (shouldIgnoreMediapipeConsoleError(args)) return;
    originalConsoleError(...(args as Parameters<typeof console.error>));
  };
  try {
    return await run();
  } finally {
    console.error = originalConsoleError;
  }
}

function silentClose(landmarker: { close: () => void }) {
  withFilteredConsoleError(() => {
    try {
      landmarker.close();
    } catch {}
  });
}

interface CameoScannerProps {
  onComplete: (images: { angle: string; base64: string }[]) => void;
}

const SIZE = 280;
const VIDEO_R = 108;
const COMPOSITE_CELL = 256;
// Layout: front left right / up down (empty)
const COMPOSITE_LAYOUT: [CameoAngle, number, number][] = [
  ["front", 0, 0],
  ["left", 1, 0],
  ["right", 2, 0],
  ["up", 0, 1],
  ["down", 1, 1],
];

export function CameoScanner({ onComplete }: CameoScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceLandmarkerRef = useRef<
    import("@mediapipe/tasks-vision").FaceLandmarker | null
  >(null);
  const holdStartRef = useRef<Partial<Record<CameoAngle, number>>>({});
  const rafRef = useRef<number | null>(null);
  const capturedRef = useRef<Map<CameoAngle, string>>(new Map());

  const [cameraReady, setCameraReady] = useState(false);
  const [mpReady, setMpReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [captured, setCaptured] = useState<Map<CameoAngle, string>>(new Map());
  const [faceDetected, setFaceDetected] = useState(false);

  const holdProgressFront = useMotionValue(0);
  const holdProgressLeft = useMotionValue(0);
  const holdProgressRight = useMotionValue(0);
  const holdProgressUp = useMotionValue(0);
  const holdProgressDown = useMotionValue(0);
  const holdProgressRef = useRef<Record<CameoAngle, MotionValue<number>>>({
    front: holdProgressFront,
    left: holdProgressLeft,
    right: holdProgressRight,
    up: holdProgressUp,
    down: holdProgressDown,
  });

  const scanning =
    cameraReady && mpReady && captured.size < CAMEO_ANGLES.length;

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video
            .play()
            .then(() => {
              if (!cancelled) setCameraReady(true);
            })
            .catch((err) => {
              if (!cancelled && err?.name !== "AbortError")
                setCameraError("Could not start camera.");
            });
        }
      })
      .catch((err) => {
        if (!cancelled)
          setCameraError(
            err?.name === "NotAllowedError"
              ? "Camera access denied. Please allow camera access and try again."
              : "Could not open camera.",
          );
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const WASM =
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm";
      const MODEL =
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
      const opts = (delegate: "GPU" | "CPU") => ({
        baseOptions: { modelAssetPath: MODEL, delegate },
        runningMode: "VIDEO" as const,
        outputFacialTransformationMatrixes: true,
        numFaces: 1,
      });
      for (const delegate of ["GPU", "CPU"] as const) {
        try {
          const { FaceLandmarker, FilesetResolver } =
            await import("@mediapipe/tasks-vision");
          const vision = await FilesetResolver.forVisionTasks(WASM);
          const lm = await withFilteredConsoleErrorAsync(() =>
            FaceLandmarker.createFromOptions(vision, opts(delegate)),
          );
          if (cancelled) {
            silentClose(lm);
            return;
          }
          faceLandmarkerRef.current = lm;
          setMpReady(true);
          return;
        } catch {}
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const captureFrame = useCallback((angle: CameoAngle): string => {
    const video = videoRef.current!;
    const canvas = canvasRef.current!;
    const size = 512;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const srcX = (video.videoWidth - size) / 2;
    const srcY = (video.videoHeight - size) / 2;
    ctx.save();
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, srcX, srcY, size, size, 0, 0, size, size);
    ctx.restore();
    return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
  }, []);

  useEffect(() => {
    if (!scanning) return;
    const landmarker = faceLandmarkerRef.current!;
    const hp = holdProgressRef.current;
    let lastTs = -1;

    function detect() {
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(detect);
        return;
      }
      const ts = performance.now();
      if (ts === lastTs) {
        rafRef.current = requestAnimationFrame(detect);
        return;
      }
      lastTs = ts;

      const result = withFilteredConsoleError(() =>
        landmarker.detectForVideo(video, ts),
      );
      const hasface = (result.faceLandmarks?.length ?? 0) > 0;
      setFaceDetected(hasface);

      if (hasface && result.facialTransformationMatrixes?.length > 0) {
        const pose = getPoseAngles(
          result.facialTransformationMatrixes[0]
            .data as unknown as Float32Array,
        );

        for (const angle of CAMEO_ANGLES) {
          if (capturedRef.current.has(angle)) continue;

          if (checkAlignment(pose, angle)) {
            if (holdStartRef.current[angle] === undefined) {
              holdStartRef.current[angle] = Date.now();
            }
            const elapsed = Date.now() - holdStartRef.current[angle]!;
            animate(hp[angle], elapsed / HOLD_DURATION_MS, { duration: 0.05 });

            if (elapsed >= HOLD_DURATION_MS) {
              delete holdStartRef.current[angle];
              animate(hp[angle], 0, { duration: 0.1 });
              const base64 = captureFrame(angle);
              const next = new Map(capturedRef.current);
              next.set(angle, base64);
              capturedRef.current = next;
              setCaptured(next);
            }
          } else if (holdStartRef.current[angle] !== undefined) {
            delete holdStartRef.current[angle];
            animate(hp[angle], 0, { duration: 0.2 });
          }
        }
      } else {
        for (const angle of CAMEO_ANGLES) {
          if (holdStartRef.current[angle] !== undefined) {
            delete holdStartRef.current[angle];
            animate(hp[angle], 0, { duration: 0.2 });
          }
        }
      }

      rafRef.current = requestAnimationFrame(detect);
    }

    rafRef.current = requestAnimationFrame(detect);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [scanning, captureFrame]);

  useEffect(() => {
    if (captured.size < CAMEO_ANGLES.length) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const canvas = canvasRef.current!;
    canvas.width = COMPOSITE_CELL * 3;
    canvas.height = COMPOSITE_CELL * 2;
    const ctx = canvas.getContext("2d")!;

    const promises: Promise<void>[] = [];
    for (const [angle, col, row] of COMPOSITE_LAYOUT) {
      const base64 = captured.get(angle)!;
      promises.push(
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(
              img,
              col * COMPOSITE_CELL,
              row * COMPOSITE_CELL,
              COMPOSITE_CELL,
              COMPOSITE_CELL,
            );
            resolve();
          };
          img.src = `data:image/jpeg;base64,${base64}`;
        }),
      );
    }
    Promise.all(promises).then(() => {
      const composite = canvas.toDataURL("image/jpeg", 0.9).split(",")[1];
      onComplete([{ angle: "composite", base64: composite }]);
    });
  }, [captured, onComplete]);

  const rm = useReducedMotion();
  const ready = cameraReady && mpReady && !cameraError;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <div
          className="absolute overflow-hidden"
          style={{
            inset: SIZE / 2 - VIDEO_R,
            borderRadius: "50%",
            backgroundColor: "black",
          }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
        </div>

        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-muted-foreground text-xs text-center px-8">
              {cameraError}
            </p>
          </div>
        )}

        <CameoScannerOverlay
          capturedAngles={new Set(captured.keys())}
          holdProgressMap={holdProgressRef.current}
        />

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
