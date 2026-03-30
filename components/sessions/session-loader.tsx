"use client";

import { useLayoutEffect } from "react";
import {
  useThumbnailStore,
  type ThumbnailVersion,
} from "@/store/use-thumbnail-store";
import { useThumbnailUIStore } from "@/store/use-thumbnail-ui-store";

interface SessionLoaderProps {
  sessionId: string;
  generations: Omit<ThumbnailVersion, "id">[];
}

export function SessionLoader({ sessionId, generations }: SessionLoaderProps) {
  const loadSession = useThumbnailStore((s) => s.loadSession);
  const focusPrompt = useThumbnailUIStore((s) => s.focusPrompt);

  useLayoutEffect(() => {
    const state = useThumbnailStore.getState();

    if (state.sessionId !== sessionId) {
      loadSession(sessionId, generations);
    }

    focusPrompt();
  }, [sessionId, generations, loadSession, focusPrompt]);

  return null;
}
