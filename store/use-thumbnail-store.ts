import { create } from "zustand";

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
  addVersion: (v: Omit<ThumbnailVersion, "id">) => void;
  selectVersion: (id: number) => void;
  setLoading: (loading: boolean) => void;
  startGenerating: () => void;
  setError: (error: string) => void;
  download: (id?: number) => void;
  clear: () => void;
}

export const useThumbnailStore = create<ThumbnailState>()((set, get) => ({
  versions: [],
  selectedVersionId: null,
  loading: false,
  generating: false,
  error: null,

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
}));
