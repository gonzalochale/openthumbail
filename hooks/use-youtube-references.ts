"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ChannelReference,
  type ChannelWidget,
  type VideoChip,
  countChannelThumbnails,
  extractYouTubeMatches,
} from "@/lib/youtube";
import {
  DEBOUNCE_MS,
  MAX_FILES,
  VIDEO_TITLE_MAX_LENGTH,
} from "@/lib/constants";
import { toast } from "sonner";

export function useYouTubeReferences({
  onVideoTitleResolved,
}: {
  onVideoTitleResolved: (originalUrl: string, title: string) => void;
}) {
  const [channelWidgets, setChannelWidgets] = useState<
    Map<string, ChannelWidget>
  >(new Map());
  const [videoChips, setVideoChips] = useState<VideoChip[]>([]);

  const debounceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const inflightHandlesRef = useRef<Set<string>>(new Set());
  const videoInflightRef = useRef<Set<string>>(new Set());
  const onTitleResolvedRef = useRef(onVideoTitleResolved);
  useEffect(() => {
    onTitleResolvedRef.current = onVideoTitleResolved;
  });

  useEffect(() => {
    return () => {
      for (const timer of debounceTimersRef.current.values())
        clearTimeout(timer);
      videoInflightRef.current.clear();
      inflightHandlesRef.current.clear();
    };
  }, []);

  const fetchChannel = useCallback(async (handle: string) => {
    inflightHandlesRef.current.add(handle);
    try {
      const totalUsed =
        videoChips.filter((c) => c.stage !== "error").length +
        videoInflightRef.current.size +
        countChannelThumbnails(channelWidgets);
      if (totalUsed >= MAX_FILES) {
        setChannelWidgets((prev) =>
          new Map(prev).set(handle, { stage: "error", handle }),
        );
        toast(`You've reached the ${MAX_FILES} reference image limit`);
        return;
      }
      const res = await fetch(
        `/api/youtube/channel?handle=${encodeURIComponent(handle)}`,
      );
      if (!inflightHandlesRef.current.has(handle)) return;
      const data = await res.json();
      if (!res.ok) {
        setChannelWidgets((prev) =>
          new Map(prev).set(handle, { stage: "error", handle }),
        );
        return;
      }
      const ref = data as ChannelReference;
      setChannelWidgets((prev) =>
        new Map(prev).set(
          handle,
          ref.thumbnails.length === 0
            ? { stage: "empty", handle }
            : { stage: "found", ref },
        ),
      );
    } catch {
      if (inflightHandlesRef.current.has(handle))
        setChannelWidgets((prev) =>
          new Map(prev).set(handle, { stage: "error", handle }),
        );
    } finally {
      inflightHandlesRef.current.delete(handle);
    }
  }, [videoChips, channelWidgets]);

  const addVideoChip = useCallback(
    async (videoId: string, originalUrl: string, fileEntriesCount: number) => {
      if (videoInflightRef.current.has(videoId)) return;
      if (videoChips.some((c) => c.videoId === videoId)) return;
      const totalUsed =
        videoChips.length +
        videoInflightRef.current.size +
        countChannelThumbnails(channelWidgets);
      if (totalUsed >= MAX_FILES) {
        toast(`You've reached the ${MAX_FILES} reference image limit`);
        return;
      }
      videoInflightRef.current.add(videoId);
      setVideoChips((prev) => [
        ...prev,
        { stage: "loading", videoId, originalUrl },
      ]);
      try {
        const res = await fetch(
          `/api/youtube/video?videoId=${encodeURIComponent(videoId)}`,
        );
        if (!videoInflightRef.current.has(videoId)) return;
        const data = await res.json();
        if (!res.ok) {
          setVideoChips((prev) =>
            prev.map((c) =>
              c.videoId === videoId
                ? { stage: "error", videoId, originalUrl }
                : c,
            ),
          );
          return;
        }
        const rawTitle = data.title as string;
        const title =
          rawTitle.length > VIDEO_TITLE_MAX_LENGTH
            ? rawTitle.slice(0, VIDEO_TITLE_MAX_LENGTH - 1) + "…"
            : rawTitle;
        setVideoChips((prev) =>
          prev.map((c) =>
            c.videoId === videoId
              ? { stage: "found", videoId, title, originalUrl }
              : c,
          ),
        );
        onTitleResolvedRef.current(originalUrl, title);
      } catch {
        if (videoInflightRef.current.has(videoId))
          setVideoChips((prev) =>
            prev.map((c) =>
              c.videoId === videoId
                ? { stage: "error", videoId, originalUrl }
                : c,
            ),
          );
      } finally {
        videoInflightRef.current.delete(videoId);
      }
    },
    [videoChips, channelWidgets],
  );

  const processValueChange = useCallback(
    (value: string, fileEntriesCount: number): string => {
      const urlMatches = extractYouTubeMatches(value);

      for (const m of urlMatches) {
        if (
          videoChips.some((c) => c.videoId === m.videoId) ||
          videoInflightRef.current.has(m.videoId)
        ) {
          value = value
            .replace(m.matchedUrl, "")
            .replace(/\s{2,}/g, " ")
            .trimStart();
        }
      }

      const titleChips = videoChips.filter(
        (c) =>
          c.stage === "found" &&
          value.includes((c as VideoChip & { stage: "found" }).title),
      );
      const idsInTextSet = new Set([
        ...urlMatches.map((m) => m.videoId),
        ...titleChips.map((c) => c.videoId),
      ]);

      const toAdd = urlMatches.filter(
        (m) =>
          !videoChips.some((c) => c.videoId === m.videoId) &&
          !videoInflightRef.current.has(m.videoId),
      );

      if (videoChips.some((c) => !idsInTextSet.has(c.videoId))) {
        setVideoChips((prev) =>
          prev.filter((c) => idsInTextSet.has(c.videoId)),
        );
      }

      for (const id of [...videoInflightRef.current]) {
        if (!idsInTextSet.has(id)) videoInflightRef.current.delete(id);
      }

      toAdd.forEach((m) =>
        addVideoChip(m.videoId, m.matchedUrl, fileEntriesCount),
      );

      const mentionedHandles = new Set<string>();
      const mentionRe = /@([\w.-]*)/g;
      let mm: RegExpExecArray | null;
      while ((mm = mentionRe.exec(value)) !== null) mentionedHandles.add(mm[1]);

      for (const [h, timer] of debounceTimersRef.current) {
        if (!mentionedHandles.has(h)) {
          clearTimeout(timer);
          debounceTimersRef.current.delete(h);
        }
      }
      for (const h of [...inflightHandlesRef.current]) {
        if (!mentionedHandles.has(h)) inflightHandlesRef.current.delete(h);
      }

      const toRemove = [...channelWidgets.keys()].filter(
        (h) => !mentionedHandles.has(h),
      );
      const toAddHandles = [...mentionedHandles].filter(
        (h) =>
          !channelWidgets.has(h) &&
          !inflightHandlesRef.current.has(h) &&
          !debounceTimersRef.current.has(h),
      );

      if (toRemove.length > 0 || toAddHandles.length > 0) {
        setChannelWidgets((prev) => {
          const next = new Map(prev);
          for (const h of toRemove) next.delete(h);
          for (const h of toAddHandles)
            next.set(h, { stage: "loading", handle: h });
          return next;
        });
      }

      for (const h of toAddHandles) {
        if (h === "") continue;
        const timer = setTimeout(() => {
          debounceTimersRef.current.delete(h);
          fetchChannel(h);
        }, DEBOUNCE_MS);
        debounceTimersRef.current.set(h, timer);
      }

      return value;
    },
    [videoChips, channelWidgets, addVideoChip, fetchChannel],
  );

  const clearAll = useCallback(() => {
    setChannelWidgets(new Map());
    setVideoChips([]);
    videoInflightRef.current.clear();
    inflightHandlesRef.current.clear();
    for (const timer of debounceTimersRef.current.values()) clearTimeout(timer);
    debounceTimersRef.current.clear();
  }, []);

  const countSlots = useCallback(
    () =>
      countChannelThumbnails(channelWidgets) +
      videoChips.filter((c) => c.stage !== "error").length,
    [channelWidgets, videoChips],
  );

  return {
    channelWidgets,
    videoChips,
    processValueChange,
    clearAll,
    countSlots,
  };
}
