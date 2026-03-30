import { create } from "zustand";

interface CameoState {
  registered: boolean;
  loading: boolean;
  setRegistered: (v: boolean) => void;
  setLoading: (v: boolean) => void;
}

export const useCameoStore = create<CameoState>()((set) => ({
  registered: false,
  loading: true,
  setRegistered: (registered) => set({ registered }),
  setLoading: (loading) => set({ loading }),
}));
