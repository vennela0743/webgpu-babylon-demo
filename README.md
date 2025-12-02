# Babylon WebGPU Demo

An interactive 3D architectural viewer built with Babylon.js, React, and WebGPU.
This project showcases the Wells Fargo Tower and Alsop Bridge rendered with smooth and intuitive camera controls for rotating, panning, and zooming.
It features a clean, minimal interface and supports model highlighting for better visualization.

> **WebGPU requirement**: Works on Chrome/Edge ≥121 (or Safari ≥17.4). 

---

## Features
- Pure WebGPU rendering via Babylon’s `WebGPUEngine`
- Automatic model loading and scaling from `public/assets/*.glb`
- Smooth camera controls with click-to-focus and snap-to-grid options
- Outline-based hover highlighting (fallback when highlight shaders aren’t available)
- Zustand store powering the control panel (quality, snap distance, selected model)
- Ready for Vercel deployment with `npm run build`

---

## Project Structure

| Path | Purpose |
| --- | --- |
| `src/App.tsx` | Mounts the canvas (`CanvasHost`) and overlay UI (`ControlsPanel`). |
| `src/components/CanvasHost.tsx` | Sets up the WebGPU engine, camera, lights; loads models; wires pointer interactions. |
| `src/core/SceneManager.ts` | Alt. scene manager used by utilities/tests (kept for reference). |
| `src/core/sceneControls.ts` | Camera helpers (`focusModel`, `resetView`, `toggleWireframe`). |
| `src/core/models.config.ts` | Declarative list of GLB models (file name, position, fit size, rotation). |
| `src/state/store.ts` | Zustand store for UI state (quality, snap meters, engine badge, etc.). |
| `public/assets` | The GLB files that are loaded at runtime. |

---

## Key Functions & Hooks

### `initScene(canvas)` – `CanvasHost.tsx`
1. Checks `navigator.gpu`, creates a `WebGPUEngine`, and configures Babylon scene + lights.
2. Tunes the `ArcRotateCamera` (wheel, pan, rotation sensitivities).
3. Creates the highlight/outline infrastructure and registers resize + pointer listeners.
4. Calls `loadModels(scene, MODELS, camera, highlightLayer, anchors)` to bring in GLBs.

### `loadModels(...)`
- Loads each GLB via `LoadAssetContainerAsync`.
- Computes bounds to auto-scale and center each model around its anchor.
- Repairs UVs only if missing/invalid (fixes the bridge appearance).
- Registers hover/pick actions that interact with the highlight fallback and `focusModel`.

### `sceneControls.ts`
- `focusModel(name)` animates the camera to the model’s bounds.
- `resetView()` resets the orbit view.
- `toggleWireframe(enabled)` toggles wireframe on every mesh.

### Zustand actions (`src/state/store.ts`)
- `setQuality`, `setWater`, `setSnap`, `setSelected`, `setWireframe`, `setEngineType`.
These keep React UI state synchronized with camera tweaks inside Babylon.

---

## Getting Started

```bash
# 1. Install
npm install

# 2. Run dev server (http://localhost:5173)
npm run dev

# 3. Build production bundle
npm run build

# 4. Preview the built bundle with the same headers as prod
npm run preview
```

### Node version
Use Node 20+ . Earlier versions may lack WebGPU polyfills.

### Cross-Origin Isolation
`vite.config.ts` injects the headers below for both `dev` and `preview` so WebGPU works without Chrome flags:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

If you switch to another HTTP server (nginx, S3, etc.) ensure these two headers are set.

---

## Deployment (Vercel example)

1. Push the repo to GitHub.
2. In Vercel, **Import Project → GitHub → this repo**.
3. Framework preset: `Vite` (detected automatically).  
   Build command: `npm run build` · Output dir: `dist`.
4. Leave “Root Directory” empty (project lives at repo root).
5. Deploy – Vercel builds and serves `dist/` with the correct headers.

You can also serve `dist/` from any static host (Netlify, Cloudflare, nginx) as long as you keep the COOP/COEP headers.

---

## Controls Cheat Sheet

| Action | Input |
| --- | --- |
| Orbit | Left mouse drag |
| Pan | Right mouse drag |
| Zoom | Scroll wheel |
| Focus model | Click a model (anchor animates camera) |

