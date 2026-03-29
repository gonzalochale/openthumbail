import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface UserGeminiKeyState {
  apiKey: string;
  setApiKey: (apiKey: string) => void;
  clearApiKey: () => void;
}

export const useUserGeminiKeyStore = create<UserGeminiKeyState>()(
  persist(
    (set) => ({
      apiKey: "",
      setApiKey: (apiKey) => set({ apiKey: apiKey.trim() }),
      clearApiKey: () => set({ apiKey: "" }),
    }),
    {
      name: "user-gemini-key-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ apiKey: state.apiKey }),
    },
  ),
);
