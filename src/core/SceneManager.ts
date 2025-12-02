// src/core/SceneManager.ts
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Vector3, Color4, Color3 } from "@babylonjs/core/Maths/math";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { GridMaterial } from "@babylonjs/materials/grid/gridMaterial";
// Note: DynamicTexture not used with WebGPU modular imports due to compatibility issues

import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF";

import type { ModelConfig } from "./models.config";

type Quality = "low" | "high";
type Callbacks = {
  onSceneReady?: () => void;
  onModelSelected?: (name: string | null) => void;
  onError?: (msg: string) => void;
};
export type SceneManagerOptions = { initialQuality?: Quality; callbacks?: Callbacks };

// Scene uses 1 unit = 1 meter
const GROUND_SIZE = 200;

class SceneManager {
  private engine?: WebGPUEngine;
  private scene?: Scene;
  private camera?: ArcRotateCamera;
  private anchors: Record<string, TransformNode> = {};
  private groups: Record<string, TransformNode> = {};
  private inited = false;
  private resizeHandler?: () => void;
  private opts: SceneManagerOptions;
  constructor(opts: SceneManagerOptions = {}) {
    this.opts = opts;
  }

  async init(canvas: HTMLCanvasElement) {
    if (this.inited) {
      return;
    }

    if (!navigator.gpu) {
      this.opts.callbacks?.onError?.("WebGPU is not available in this browser/device.");
      return;
    }

    this.inited = true;

    // WebGPU only
    let engine: WebGPUEngine;
    try {
      engine = new WebGPUEngine(canvas, {
        antialias: true,
        stencil: true,
        adaptToDeviceRatio: true,
      });
      await engine.initAsync();
    } catch (e) {
      this.opts.callbacks?.onError?.("Failed to initialize WebGPU engine");
      this.inited = false;
      return;
    }
    
    this.engine = engine;

    // Scene setup
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.06, 0.08, 0.12, 1.0);
    this.scene = scene;

    // Camera
    const cam = new ArcRotateCamera(
      "MainCamera",
      Math.PI * 1.25,
      Math.PI / 3,
      150,
      new Vector3(0, 20, 0),
      scene
    );
    cam.attachControl(canvas, true);
    cam.lowerRadiusLimit = 20;
    cam.upperRadiusLimit = 500;
    cam.wheelDeltaPercentage = 0.02;
    cam.panningSensibility = 50;
    this.camera = cam;

    // Lights
    const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
    hemi.intensity = 0.6;
    const sun = new DirectionalLight("sun", new Vector3(-0.5, -1, -0.3), scene);
    sun.intensity = 1.0;

    // Build ground with grid material
    this.buildGround(scene);

    // Build axis and scale indicators
    this.buildAxisIndicators(scene);

    // Resize handling
    this.resizeHandler = () => this.engine?.resize();
    window.addEventListener("resize", this.resizeHandler);
    engine.runRenderLoop(() => this.scene?.render());

    this.opts.callbacks?.onSceneReady?.();
  }

  private buildGround(scene: Scene) {
    // Ground plane with grid material
    const ground = MeshBuilder.CreateGround(
      "ground",
      { width: GROUND_SIZE, height: GROUND_SIZE },
      scene
    );
    ground.position.y = 0;
    ground.isPickable = false;

    // Use Babylon's built-in GridMaterial
    const gridMat = new GridMaterial("gridMat", scene);
    gridMat.majorUnitFrequency = 10; // Major line every 10 units (10m)
    gridMat.minorUnitVisibility = 0.3;
    gridMat.gridRatio = 1; // 1 unit = 1m grid
    gridMat.backFaceCulling = false;
    gridMat.mainColor = new Color3(0.1, 0.12, 0.16);
    gridMat.lineColor = new Color3(0.3, 0.35, 0.45);
    gridMat.opacity = 0.98;

    ground.material = gridMat;

    // Add dimension labels at the edges
    this.addDimensionLabels(scene);

  }

  private addDimensionLabels(scene: Scene) {
    // Create simple marker boxes at key distances instead of text labels
    // (DynamicTexture has compatibility issues with WebGPU modular imports)
    const distances = [
      { dist: 25, color: new Color3(0.3, 0.6, 0.9) },
      { dist: 50, color: new Color3(0.5, 0.8, 0.4) },
      { dist: 100, color: new Color3(0.9, 0.6, 0.3) },
    ];

    distances.forEach(({ dist, color }) => {
      // X-axis markers
      const xMarker = MeshBuilder.CreateBox(`xMarker_${dist}`, { width: 2, height: 0.3, depth: 2 }, scene);
      xMarker.position = new Vector3(dist, 0.15, -GROUND_SIZE / 2 + 5);
      const xMat = new StandardMaterial(`xMarkerMat_${dist}`, scene);
      xMat.diffuseColor = color;
      xMat.emissiveColor = color.scale(0.3);
      xMarker.material = xMat;

      // Z-axis markers
      const zMarker = MeshBuilder.CreateBox(`zMarker_${dist}`, { width: 2, height: 0.3, depth: 2 }, scene);
      zMarker.position = new Vector3(-GROUND_SIZE / 2 + 5, 0.15, dist);
      const zMat = new StandardMaterial(`zMarkerMat_${dist}`, scene);
      zMat.diffuseColor = color;
      zMat.emissiveColor = color.scale(0.3);
      zMarker.material = zMat;
    });

  }

  private buildAxisIndicators(scene: Scene) {
    const axisLength = 50;
    const y = 0.1;

    // X axis (red)
    const xAxis = MeshBuilder.CreateLines(
      "xAxis",
      { points: [new Vector3(0, y, 0), new Vector3(axisLength, y, 0)] },
      scene
    );
    xAxis.color = new Color3(1, 0.2, 0.2);

    // X arrow
    MeshBuilder.CreateLines(
      "xArrow",
      {
        points: [
          new Vector3(axisLength - 4, y, 2),
          new Vector3(axisLength, y, 0),
          new Vector3(axisLength - 4, y, -2),
        ],
      },
      scene
    ).color = new Color3(1, 0.2, 0.2);

    // Y axis (green)
    const yAxis = MeshBuilder.CreateLines(
      "yAxis",
      { points: [new Vector3(0, 0, 0), new Vector3(0, axisLength, 0)] },
      scene
    );
    yAxis.color = new Color3(0.2, 1, 0.2);

    // Z axis (blue)
    const zAxis = MeshBuilder.CreateLines(
      "zAxis",
      { points: [new Vector3(0, y, 0), new Vector3(0, y, axisLength)] },
      scene
    );
    zAxis.color = new Color3(0.2, 0.4, 1);

    // Z arrow
    MeshBuilder.CreateLines(
      "zArrow",
      {
        points: [
          new Vector3(2, y, axisLength - 4),
          new Vector3(0, y, axisLength),
          new Vector3(-2, y, axisLength - 4),
        ],
      },
      scene
    ).color = new Color3(0.2, 0.4, 1);

    // Scale markers at 10m, 25m, 50m
    [10, 25, 50].forEach((dist) => {
      // X markers (orange poles)
      const xPole = MeshBuilder.CreateCylinder(`xPole_${dist}`, { height: 8, diameter: 0.8 }, scene);
      xPole.position = new Vector3(dist, 4, 0);
      const xMat = new StandardMaterial(`xPoleMat_${dist}`, scene);
      xMat.diffuseColor = new Color3(1, 0.5, 0.1);
      xMat.emissiveColor = new Color3(0.2, 0.1, 0);
      xPole.material = xMat;

      // Z markers (cyan poles)
      const zPole = MeshBuilder.CreateCylinder(`zPole_${dist}`, { height: 8, diameter: 0.8 }, scene);
      zPole.position = new Vector3(0, 4, dist);
      const zMat = new StandardMaterial(`zPoleMat_${dist}`, scene);
      zMat.diffuseColor = new Color3(0.1, 0.7, 1);
      zMat.emissiveColor = new Color3(0, 0.1, 0.2);
      zPole.material = zMat;
    });

  }

  dispose() {
    if (this.resizeHandler) {
      window.removeEventListener("resize", this.resizeHandler);
      this.resizeHandler = undefined;
    }
    this.engine?.stopRenderLoop();
    this.scene?.dispose();
    this.engine?.dispose();
    this.engine = undefined;
    this.scene = undefined;
    this.camera = undefined;
    this.anchors = {};
    this.groups = {};
    this.inited = false;
  }

  async loadModels(configs: ModelConfig[]) {
    if (!this.scene) {
      this.opts.callbacks?.onError?.("Scene not initialized");
      return;
    }

    for (const cfg of configs) {
      if (this.anchors[cfg.name]) {
        continue;
      }

      try {
        // Load GLB first to compute raw bounds
        const container = await LoadAssetContainerAsync(`/assets/${cfg.file}`, this.scene);

        // Create a temporary node to measure
        const tempNode = new TransformNode(`${cfg.name}_temp`, this.scene);
        container.meshes.forEach((m) => {
          if (!m.parent) {
            m.parent = tempNode;
          }
        });

        // Compute raw bounds (before any transforms)
        const rawBounds = this.computeLocalBounds(tempNode);
        if (!rawBounds) {
          tempNode.dispose();
          continue;
        }

        const rawSize = rawBounds.max.subtract(rawBounds.min);
        const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z);
        // Target size
        const targetSize = cfg.fitSize ?? 30;
        const scale = targetSize / maxDim;

        // Center of raw geometry
        const rawCenter = rawBounds.min.add(rawBounds.max).scale(0.5);

        // Create anchor at specified position
        const anchor = new TransformNode(`${cfg.name}_anchor`, this.scene);
        const [px, py, pz] = cfg.position ?? [0, 0, 0];
        anchor.position.set(px, py, pz);
        this.anchors[cfg.name] = anchor;

        // Create group for the model
        const group = new TransformNode(`${cfg.name}_root`, this.scene);
        group.parent = anchor;
        this.groups[cfg.name] = group;

        // Apply rotation
        const [rx, ry, rz] = cfg.rotation ?? [0, 0, 0];
        group.rotation.set(rx, ry, rz);

        // Move meshes from temp to group
        tempNode.getChildMeshes().forEach((m) => {
          m.parent = group;
        });
        tempNode.dispose();

        // Apply scaling
        group.scaling.set(scale, scale, scale);

        // Offset to center at origin and sit on ground
        // After scaling, the bottom should be at y=0
        const scaledCenter = rawCenter.scale(scale);
        const scaledMinY = rawBounds.min.y * scale;
        
        // Position offset: center X/Z at anchor, bottom at ground level
        group.position.set(
          -scaledCenter.x,
          -scaledMinY,
          -scaledCenter.z
        );

        // Add to scene
        container.addAllToScene();

      } catch (e) {
        this.opts.callbacks?.onError?.(`Failed to load ${cfg.name}`);
      }
    }

    // Frame camera to see all models
    this.frameAll();
  }

  private computeLocalBounds(node: TransformNode): { min: Vector3; max: Vector3 } | null {
    const meshes = node.getChildMeshes(false) as AbstractMesh[];
    if (meshes.length === 0) return null;

    let min = new Vector3(Infinity, Infinity, Infinity);
    let max = new Vector3(-Infinity, -Infinity, -Infinity);

    meshes.forEach((m) => {
      // Force bounding info refresh
      m.refreshBoundingInfo(true, false);
      const bi = m.getBoundingInfo();
      
      // Use local bounding box (not world)
      min = Vector3.Minimize(min, bi.boundingBox.minimum);
      max = Vector3.Maximize(max, bi.boundingBox.maximum);
    });

    if (!isFinite(min.x) || !isFinite(max.x)) return null;

    return { min, max };
  }

  private computeWorldBounds(node: TransformNode): { min: Vector3; max: Vector3 } | null {
    const meshes = node.getChildMeshes(false) as AbstractMesh[];
    if (meshes.length === 0) return null;

    let min = new Vector3(Infinity, Infinity, Infinity);
    let max = new Vector3(-Infinity, -Infinity, -Infinity);

    meshes.forEach((m) => {
      m.computeWorldMatrix(true);
      m.refreshBoundingInfo(true, false);
      const bi = m.getBoundingInfo();
      min = Vector3.Minimize(min, bi.boundingBox.minimumWorld);
      max = Vector3.Maximize(max, bi.boundingBox.maximumWorld);
    });

    if (!isFinite(min.x) || !isFinite(max.x)) return null;

    return { min, max };
  }

  private frameAll() {
    if (!this.camera) return;

    let min = new Vector3(Infinity, Infinity, Infinity);
    let max = new Vector3(-Infinity, -Infinity, -Infinity);
    let hasModels = false;

    Object.values(this.anchors).forEach((anchor) => {
      const bounds = this.computeWorldBounds(anchor);
      if (bounds) {
        min = Vector3.Minimize(min, bounds.min);
        max = Vector3.Maximize(max, bounds.max);
        hasModels = true;
      }
    });

    if (!hasModels) {
      // Default view
      this.camera.setTarget(new Vector3(0, 10, 0));
      this.camera.radius = 150;
      return;
    }

    const center = min.add(max).scale(0.5);
    const size = max.subtract(min);
    const radius = Math.max(size.x, size.y, size.z) * 1.5;

    this.camera.setTarget(center);
    this.camera.radius = Math.max(radius, 100);

  }

  resetPositions() {
    this.frameAll();
  }

  focusModel(name: string) {
    const anchor = this.anchors[name];
    if (!anchor || !this.camera) {
      return;
    }

    const bounds = this.computeWorldBounds(anchor);
    if (!bounds) return;

    const center = bounds.min.add(bounds.max).scale(0.5);
    const size = bounds.max.subtract(bounds.min);
    const radius = Math.max(size.x, size.y, size.z) * 2;

    this.camera.setTarget(center);
    this.camera.radius = Math.max(radius, 60);

  }

  isInitialized(): boolean {
    return this.inited;
  }
}

// Export a factory function instead of a singleton
// This avoids issues with React StrictMode and HMR
let instance: SceneManager | null = null;

export function getSceneManager(opts: SceneManagerOptions = {}): SceneManager {
  if (!instance) {
    instance = new SceneManager(opts);
  }
  return instance;
}

export function disposeSceneManager() {
  if (instance) {
    instance.dispose();
    instance = null;
  }
}

// For backwards compatibility
export const sceneManager = new SceneManager({
  initialQuality: "high",
  callbacks: {},
});
