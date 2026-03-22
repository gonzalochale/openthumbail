"use client";

import { useEffect, useRef } from "react";

const KONAMI_SEQUENCE = [
  "arrowup",
  "arrowup",
  "arrowdown",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "arrowleft",
  "arrowright",
  "b",
  "a",
];

export function useKonamiCode(onSuccess: () => void, enabled: boolean) {
  const progress = useRef(0);

  useEffect(() => {
    if (!enabled) {
      progress.current = 0;
      return;
    }

    function onKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      if (key === KONAMI_SEQUENCE[progress.current]) {
        progress.current++;
        if (progress.current === KONAMI_SEQUENCE.length) {
          progress.current = 0;
          onSuccess();
        }
      } else {
        progress.current = key === KONAMI_SEQUENCE[0] ? 1 : 0;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, onSuccess]);
}
