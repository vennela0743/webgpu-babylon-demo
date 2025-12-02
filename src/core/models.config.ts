// src/core/models.config.ts
export type ModelConfig = {
  name: string;
  file: string;
  scale?: number;
  rotation?: [number, number, number];
  position?: [number, number, number]; // [x, y, z] in meters
  pickable?: boolean;
  fitSize?: number; // target size in meters for auto-fit
};

// All files should be in public/assets/
export const MODELS: ModelConfig[] = [
  {
    name: "building",
    file: "wells_fargo.glb",
    rotation: [0, 0, 0],
    position: [-30, 0, 0], // 30m to the left of origin
    fitSize: 40, // scale to 40m tall/wide
    pickable: true,
  },
  {
    name: "bridge",
    file: "jt_alsop_bridge.glb",
    rotation: [0, Math.PI * 0.5, 0],
    position: [30, 0.4, 0], // Lift slightly to avoid z-fighting with the ground
    fitSize: 60, // scale to 60m
    pickable: true,
  },
];
