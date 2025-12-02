import { create } from "zustand";

type Quality = "low" | "high";
type EngineType = "WebGL" | "WebGPU" | null;

interface UIState {
  quality: Quality;
  waterEnabled: boolean;
  snapMeters: number;
  selectedModel: string | null;
  wireframeEnabled: boolean;
  engineType: EngineType;
  
  setQuality: (q: Quality) => void;
  setWater: (on: boolean) => void;
  setSnap: (m: number) => void;
  setSelected: (name: string | null) => void;
  setWireframe: (on: boolean) => void;
  setEngineType: (type: EngineType) => void;
}

export const useUIStore = create<UIState>((set) => ({
  quality: "high",
  waterEnabled: false,
  snapMeters: 0.5,
  selectedModel: null,
  wireframeEnabled: false,
  engineType: null,
  
  setQuality: (quality) => set({ quality }),
  setWater: (waterEnabled) => set({ waterEnabled }),
  setSnap: (snapMeters) => set({ snapMeters }),
  setSelected: (selectedModel) => set({ selectedModel }),
  setWireframe: (wireframeEnabled) => set({ wireframeEnabled }),
  setEngineType: (engineType) => set({ engineType }),
}));
