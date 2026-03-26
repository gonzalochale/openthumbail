"use client";

import { useEffect } from "react";
import { useThumbnailStore } from "@/store/use-thumbnail-store";

export function useThumbnailShortcuts() {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const {
        versions,
        selectedVersionId,
        loading,
        downloading,
        copying,
        download,
        copy,
        selectVersion,
      } = useThumbnailStore.getState();
      const selectedVersion = versions.find((v) => v.id === selectedVersionId);

      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        if (!selectedVersion || loading || downloading) return;
        e.preventDefault();
        download(selectedVersion.id);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "c") {
        if (!selectedVersion || loading || copying) return;
        if (window.getSelection()?.toString()) return;
        e.preventDefault();
        copy(selectedVersion.id);
        return;
      }

      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "ArrowLeft") {
        if (!selectedVersion || selectedVersion.id === 0) return;
        selectVersion(selectedVersion.id - 1);
      } else if (e.key === "ArrowRight") {
        if (!selectedVersion || selectedVersion.id === versions.length - 1)
          return;
        selectVersion(selectedVersion.id + 1);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
