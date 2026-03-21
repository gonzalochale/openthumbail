import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ThumbnailVersion {
  id: number;
  imageBase64: string;
  mimeType: string;
  prompt: string;
  enhancedPrompt: string | null;
  createdAt: number;
}

interface ThumbnailState {
  versions: ThumbnailVersion[];
  selectedVersionId: number | null;
  loading: boolean;
  generating: boolean;
  error: string | null;
  pendingPrompt: string | null;
  addVersion: (v: Omit<ThumbnailVersion, "id">) => void;
  selectVersion: (id: number) => void;
  setLoading: (loading: boolean) => void;
  startGenerating: () => void;
  setError: (error: string) => void;
  setPendingPrompt: (prompt: string | null) => void;
  download: (id?: number) => void;
  clear: () => void;
}

export const useThumbnailStore = create<ThumbnailState>()(
  persist(
    (set, get) => ({
      versions: [],
      selectedVersionId: null,
      loading: false,
      generating: false,
      error: null,
      pendingPrompt: null,

      addVersion: (versionData) =>
        set((state) => {
          const newId = state.versions.length;
          const version: ThumbnailVersion = { ...versionData, id: newId };
          return {
            versions: [...state.versions, version],
            selectedVersionId: newId,
            loading: false,
            generating: false,
            error: null,
          };
        }),

      selectVersion: (id) => set({ selectedVersionId: id }),

      setLoading: (loading) => set(loading ? { loading } : { loading, generating: false }),

      startGenerating: () => set({ loading: true, generating: true }),

      setError: (error) => set({ error }),

      setPendingPrompt: (prompt) => set({ pendingPrompt: prompt }),

      download: (id) => {
        const { versions, selectedVersionId } = get();
        const targetId = id ?? selectedVersionId;
        const version = versions.find((v) => v.id === targetId);
        if (!version) return;
        const a = document.createElement("a");
        a.href = `data:${version.mimeType};base64,${version.imageBase64}`;
        a.download = `thumbnail-v${version.id}.png`;
        a.click();
      },

      clear: () => set({ versions: [], selectedVersionId: null, error: null }),
    }),
    {
      name: "thumbnail-store",
      partialize: (state) => ({ pendingPrompt: state.pendingPrompt }),
    },
  ),
);
