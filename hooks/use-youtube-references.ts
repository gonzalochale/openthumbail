"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ChannelReference,
  type ChannelWidget,
  type VideoChip,
  countChannelThumbnails,
  extractYouTubeMatches,
  truncateTitle,
} from "@/lib/youtube";
import {
  DEBOUNCE_MS,
  MAX_FILES,
  VIDEO_TITLE_MAX_LENGTH,
} from "@/lib/constants";
import { toast } from "sonner";
import { useYouTubeCacheStore } from "@/store/use-youtube-cache-store";

export function useYouTubeReferences({
  onVideoTitleResolved,
  onAuthRequired,
  isAuthenticated,
}: {
  onVideoTitleResolved: (originalUrl: string, title: string) => void;
  onAuthRequired: () => void;
  isAuthenticated: boolean;
}) {
  const [channelWidgets, setChannelWidgets] = useState<
    Map<string, ChannelWidget>
  >(new Map());
  const [videoChips, setVideoChips] = useState<VideoChip[]>([]);

  const getChannel = useYouTubeCacheStore((s) => s.getChannel);
  const setChannel = useYouTubeCacheStore((s) => s.setChannel);
  const getVideo = useYouTubeCacheStore((s) => s.getVideo);
  const setVideo = useYouTubeCacheStore((s) => s.setVideo);

  const debounceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const inflightHandlesRef = useRef<Set<string>>(new Set());
  const videoInflightRef = useRef<Set<string>>(new Set());
  const onTitleResolvedRef = useRef(onVideoTitleResolved);
  useEffect(() => {
    onTitleResolvedRef.current = onVideoTitleResolved;
  });

  const seenUnauthRef = useRef<{ videoIds: Set<string>; handles: Set<string> }>(
    {
      videoIds: new Set(),
      handles: new Set(),
    },
  );

  const channelWidgetsRef = useRef(new Map<string, ChannelWidget>());
  const fetchChannelRef = useRef<((handle: string) => Promise<void>) | null>(
    null,
  );
  useEffect(() => {
    channelWidgetsRef.current = channelWidgets;
  }, [channelWidgets]);
  useEffect(() => {
    if (!isAuthenticated) return;
    seenUnauthRef.current.videoIds.clear();
    seenUnauthRef.current.handles.clear();
    for (const [handle, widget] of channelWidgetsRef.current) {
      if (
        widget.stage === "loading" &&
        !inflightHandlesRef.current.has(handle)
      ) {
        fetchChannelRef.current?.(handle);
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    return () => {
      for (const timer of debounceTimersRef.current.values())
        clearTimeout(timer);
      videoInflightRef.current.clear();
      inflightHandlesRef.current.clear();
      seenUnauthRef.current.videoIds.clear();
      seenUnauthRef.current.handles.clear();
    };
  }, []);

  const requireAuth = useCallback(
    (id: string, seenSet: Set<string>): boolean => {
      if (!isAuthenticated) {
        if (!seenSet.has(id)) {
          seenSet.add(id);
          onAuthRequired();
        }
        return false;
      }
      return true;
    },
    [isAuthenticated, onAuthRequired],
  );

  const fetchChannel = useCallback(
    async (handle: string) => {
      if (!requireAuth(handle, seenUnauthRef.current.handles)) return;
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
      const cached = getChannel(handle);
      if (cached) {
        setChannelWidgets((prev) =>
          new Map(prev).set(
            handle,
            cached.thumbnails.length === 0
              ? { stage: "empty", handle }
              : { stage: "found", ref: cached },
          ),
        );
        return;
      }
      inflightHandlesRef.current.add(handle);
      try {
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
        setChannel(handle, ref);
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
    },
    [videoChips, channelWidgets, requireAuth, getChannel, setChannel],
  );
  useEffect(() => {
    fetchChannelRef.current = fetchChannel;
  }, [fetchChannel]);

  const addVideoChip = useCallback(
    async (videoId: string, originalUrl: string) => {
      if (!requireAuth(videoId, seenUnauthRef.current.videoIds)) return;
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
      const cachedVideo = getVideo(videoId);
      if (cachedVideo) {
        const title = truncateTitle(cachedVideo.title, VIDEO_TITLE_MAX_LENGTH);
        setVideoChips((prev) => [
          ...prev,
          { stage: "found", videoId, title, originalUrl },
        ]);
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
        const title = truncateTitle(rawTitle, VIDEO_TITLE_MAX_LENGTH);
        setVideo(videoId, {
          videoId,
          title: rawTitle,
          thumbnailUrl: data.thumbnailUrl as string,
        });
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
    [videoChips, channelWidgets, requireAuth, getVideo, setVideo],
  );

  const processValueChange = useCallback(
    (value: string): string => {
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

      for (const m of toAdd) {
        const canonical = `youtu.be/${m.videoId}`;
        if (m.matchedUrl !== canonical) {
          value = value.replace(m.matchedUrl, canonical);
        }
        const cached = getVideo(m.videoId);
        if (cached) {
          value = value.replace(
            canonical,
            truncateTitle(cached.title, VIDEO_TITLE_MAX_LENGTH),
          );
        }
      }

      if (videoChips.some((c) => !idsInTextSet.has(c.videoId))) {
        setVideoChips((prev) =>
          prev.filter((c) => idsInTextSet.has(c.videoId)),
        );
      }

      for (const id of [...videoInflightRef.current]) {
        if (!idsInTextSet.has(id)) videoInflightRef.current.delete(id);
      }

      toAdd.forEach((m) => addVideoChip(m.videoId, `youtu.be/${m.videoId}`));

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
    [videoChips, channelWidgets, addVideoChip, fetchChannel, getVideo],
  );

  const clearAll = useCallback(() => {
    setChannelWidgets(new Map());
    setVideoChips([]);
    videoInflightRef.current.clear();
    inflightHandlesRef.current.clear();
    for (const timer of debounceTimersRef.current.values()) clearTimeout(timer);
    debounceTimersRef.current.clear();
  }, []);

  return {
    channelWidgets,
    videoChips,
    processValueChange,
    clearAll,
  };
}
