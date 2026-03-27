import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";

export interface ThumbnailVersion {
  id: number;
  generationId?: string;
  imageUrl: string;
  mimeType: string;
  prompt: string;
  rawPrompt?: string;
  enhancedPrompt: string | null;
  createdAt: number;
}

interface ThumbnailState {
  versions: ThumbnailVersion[];
  selectedVersionId: number | null;
  sessionId: string | null;
  loading: boolean;
  generating: boolean;
  error: string | null;
  pendingPrompt: string | null;
  credits: number | null;
  addVersion: (v: Omit<ThumbnailVersion, "id">) => void;
  selectVersion: (id: number) => void;
  setSessionId: (id: string) => void;
  setLoading: (loading: boolean) => void;
  startGenerating: () => void;
  setError: (error: string) => void;
  setPendingPrompt: (prompt: string | null) => void;
  setCredits: (credits: number) => void;
  decrementCredits: () => void;
  loadSession: (
    sessionId: string,
    versions: Omit<ThumbnailVersion, "id">[],
  ) => void;
  downloadTick: number;
  downloading: boolean;
  download: (id?: number) => Promise<void>;
  copyTick: number;
  copying: boolean;
  copy: (id?: number) => Promise<void>;
  authModalOpen: boolean;
  creditsModalOpen: boolean;
  infoModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  openCreditsModal: () => void;
  closeCreditsModal: () => void;
  openInfoModal: () => void;
  closeInfoModal: () => void;
  promptFocusTick: number;
  focusPrompt: () => void;
  clearTick: number;
  clear: () => void;
  clearHistory: () => void;
}

export const useThumbnailStore = create<ThumbnailState>()(
  persist(
    (set, get) => ({
      versions: [],
      selectedVersionId: null,
      sessionId: null,
      loading: false,
      generating: false,
      error: null,
      pendingPrompt: null,
      credits: null,
      downloadTick: 0,
      downloading: false,
      copyTick: 0,
      copying: false,
      authModalOpen: false,
      creditsModalOpen: false,
      infoModalOpen: false,
      promptFocusTick: 0,
      clearTick: 0,

      openAuthModal: () => set({ authModalOpen: true }),
      closeAuthModal: () => set({ authModalOpen: false }),
      openCreditsModal: () => set({ creditsModalOpen: true }),
      closeCreditsModal: () => set({ creditsModalOpen: false }),
      openInfoModal: () => set({ infoModalOpen: true }),
      closeInfoModal: () => set({ infoModalOpen: false }),
      focusPrompt: () => set((s) => ({ promptFocusTick: s.promptFocusTick + 1 })),

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

      setSessionId: (id) => set({ sessionId: id }),

      loadSession: (sessionId, versionData) => {
        const versions = versionData.map((v, i) => ({ ...v, id: i }));
        set({
          sessionId,
          versions,
          selectedVersionId:
            versions.length > 0 ? versions[versions.length - 1].id : null,
          error: null,
        });
      },

      setLoading: (loading) =>
        set(loading ? { loading } : { loading, generating: false }),

      startGenerating: () => set({ loading: true, generating: true }),

      setError: (error) => set({ error }),

      setPendingPrompt: (prompt) => set({ pendingPrompt: prompt }),

      setCredits: (credits) => set({ credits }),

      decrementCredits: () =>
        set((state) => ({
          credits:
            state.credits !== null ? Math.max(0, state.credits - 1) : null,
        })),

      download: async (id) => {
        if (get().downloading) return;
        const { versions, selectedVersionId } = get();
        const version = versions.find(
          (v) => v.id === (id ?? selectedVersionId),
        );
        if (!version) return;
        set({ downloading: true });
        try {
          const res = await fetch(`${version.imageUrl}?blob=1`);
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = `thumbnail-v${version.id}.png`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
          set((state) => ({
            downloading: false,
            downloadTick: state.downloadTick + 1,
          }));
        } catch {
          set({ downloading: false });
        }
      },

      copy: async (id) => {
        if (get().copying) return;
        const { versions, selectedVersionId } = get();
        const version = versions.find(
          (v) => v.id === (id ?? selectedVersionId),
        );
        if (!version) return;
        if (typeof ClipboardItem === "undefined") return;
        set({ copying: true });
        try {
          const res = await fetch(`${version.imageUrl}?blob=1`);
          const blob = await res.blob();
          await navigator.clipboard.write([
            new ClipboardItem({ [version.mimeType]: blob }),
          ]);
          set((state) => ({ copying: false, copyTick: state.copyTick + 1 }));
        } catch {
          toast("Failed to copy to clipboard");
          set({ copying: false });
        }
      },

      clear: () =>
        set((s) => ({
          versions: [],
          selectedVersionId: null,
          sessionId: null,
          error: null,
          clearTick: s.clearTick + 1,
        })),

      clearHistory: () =>
        set((s) => ({
          versions: [],
          selectedVersionId: null,
          sessionId: null,
          clearTick: s.clearTick + 1,
        })),
    }),
    {
      name: "thumbnail-store",
      partialize: (state) => ({
        pendingPrompt: state.pendingPrompt,
        sessionId: state.sessionId,
      }),
    },
  ),
);
