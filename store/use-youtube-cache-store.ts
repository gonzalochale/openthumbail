import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChannelReference, VideoData } from "@/lib/youtube";

const TTL_MS = 86_400_000; // 24 hours

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

interface YouTubeCacheState {
  channels: Record<string, CacheEntry<ChannelReference>>;
  videos: Record<string, CacheEntry<VideoData>>;
  isFresh: (cachedAt: number) => boolean;
  getChannel: (handle: string) => ChannelReference | null;
  setChannel: (handle: string, data: ChannelReference) => void;
  getVideo: (videoId: string) => VideoData | null;
  setVideo: (videoId: string, data: VideoData) => void;
}

export const useYouTubeCacheStore = create<YouTubeCacheState>()(
  persist(
    (set, get) => ({
      channels: {},
      videos: {},

      isFresh: (cachedAt) => Date.now() - cachedAt < TTL_MS,

      getChannel: (handle) => {
        const key = handle.toLowerCase();
        const entry = get().channels[key];
        if (!entry) return null;
        if (!get().isFresh(entry.cachedAt)) {
          set((state) => {
            const channels = { ...state.channels };
            delete channels[key];
            return { channels };
          });
          return null;
        }
        return entry.data;
      },

      setChannel: (handle, data) =>
        set((state) => ({
          channels: {
            ...state.channels,
            [handle.toLowerCase()]: { data, cachedAt: Date.now() },
          },
        })),

      getVideo: (videoId) => {
        const entry = get().videos[videoId];
        if (!entry) return null;
        if (!get().isFresh(entry.cachedAt)) {
          set((state) => {
            const videos = { ...state.videos };
            delete videos[videoId];
            return { videos };
          });
          return null;
        }
        return entry.data;
      },

      setVideo: (videoId, data) =>
        set((state) => ({
          videos: {
            ...state.videos,
            [videoId]: { data, cachedAt: Date.now() },
          },
        })),
    }),
    {
      name: "youtube-cache-store",
      partialize: (state) => ({
        channels: state.channels,
        videos: state.videos,
      }),
    },
  ),
);
