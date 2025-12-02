import { useEffect, useRef, useCallback } from "react";
import { MODELS } from "../core/models.config";
import { 
  setSceneRefs, 
  clearSceneRefs, 
  focusModel 
} from "../core/sceneControls";

// Import Babylon.js modules
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Vector3, Color4, Color3 } from "@babylonjs/core/Maths/math";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Material } from "@babylonjs/core/Materials/material";
import { GridMaterial } from "@babylonjs/materials/grid/gridMaterial";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { HighlightLayer } from "@babylonjs/core/Layers/highlightLayer";
import "@babylonjs/core/Layers/effectLayerSceneComponent";
import { ActionManager } from "@babylonjs/core/Actions/actionManager";
import { ExecuteCodeAction } from "@babylonjs/core/Actions/directActions";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF";
import "@babylonjs/core/Culling/ray";
import "@babylonjs/core/Materials/Textures/Loaders/envTextureLoader";
import "@babylonjs/core/Helpers/sceneHelpers";
import "@babylonjs/core/Materials/PBR/index";

import type { ModelConfig } from "../core/models.config";
import { useUIStore } from "../state/store";

const GROUND_SIZE = 200;
const ENABLE_HIGHLIGHT_LAYER = false;

// Track if user is interacting (to prevent hover flicker during camera rotation/zoom)
let isInteracting = false;
let interactionTimeout: ReturnType<typeof setTimeout> | null = null;
let lastHoveredMesh: any = null;

function setInteracting(active: boolean) {
  if (active) {
    isInteracting = true;
    if (interactionTimeout) {
      clearTimeout(interactionTimeout);
      interactionTimeout = null;
    }
  } else {
    if (interactionTimeout) clearTimeout(interactionTimeout);
    interactionTimeout = setTimeout(() => {
      isInteracting = false;
      interactionTimeout = null;
    }, 150);
  }
}

export default function CanvasHost() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<WebGPUEngine | null>(null);
  const cameraLocalRef = useRef<ArcRotateCamera | null>(null);
  const snapRef = useRef<number>(0);
  const { setEngineType } = useUIStore();
  const quality = useUIStore(s => s.quality);
  const snapMeters = useUIStore(s => s.snapMeters);

  const initScene = useCallback(async (canvas: HTMLCanvasElement) => {
    if (engineRef.current) return;

    if (!navigator.gpu) {
      setEngineType(null);
      return;
    }

    let engine: WebGPUEngine;
    try {
      engine = new WebGPUEngine(canvas, { 
        antialias: true,
        stencil: true,
        adaptToDeviceRatio: true 
      });
      await engine.initAsync();
    } catch {
      setEngineType(null);
      return;
    }
    
    engineRef.current = engine;
    setEngineType("WebGPU");

    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.02, 0.03, 0.06, 1.0);
    scene.blockMaterialDirtyMechanism = false;
    scene.environmentIntensity = 1.0;

    const cam = new ArcRotateCamera(
      "MainCamera",
      Math.PI * 1.25,
      Math.PI / 3,
      150,
      new Vector3(0, 20, 0),
      scene
    );
    cam.attachControl(canvas, true);
    cam.lowerRadiusLimit = 0.05;
    cam.upperRadiusLimit = 1500;
    cam.wheelDeltaPercentage = 0.008;
    cam.panningSensibility = 150;
    cam.inertia = 0.9;
    cam.minZ = 0.01;
    cam.maxZ = 2000;
    cameraLocalRef.current = cam;

    const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
    hemi.intensity = 1.0;
    hemi.groundColor = new Color3(0.2, 0.2, 0.25);

    const sun = new DirectionalLight("sun", new Vector3(-0.5, -1, -0.3), scene);
    sun.intensity = 1.5;
    sun.diffuse = new Color3(1, 0.95, 0.8);
    
    const fillLight = new HemisphericLight("fill", new Vector3(0, -1, 0), scene);
    fillLight.intensity = 0.4;
    fillLight.groundColor = new Color3(0.3, 0.3, 0.35);

    let highlightLayer: HighlightLayer | null = null;
    if (ENABLE_HIGHLIGHT_LAYER) {
      try {
        highlightLayer = new HighlightLayer("highlight", scene);
      } catch {
        highlightLayer = null;
      }
    }

    const anchors: Record<string, TransformNode> = {};
    setSceneRefs(scene, cam, highlightLayer, anchors);

    buildGround(scene);
    buildAxisIndicators(scene);

    const handleResize = () => engine.resize();
    window.addEventListener("resize", handleResize);
    
    const handlePointerDown = () => setInteracting(true);
    const handlePointerUp = () => setInteracting(false);
    const handleWheel = () => {
      setInteracting(true);
      setInteracting(false);
    };
    
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointerleave", handlePointerUp);
    canvas.addEventListener("wheel", handleWheel, { passive: true });

    const applySnap = () => {
      const snap = snapRef.current;
      if (snap <= 0) return;
      const t = cam.target;
      const snappedX = Math.round(t.x / snap) * snap;
      const snappedZ = Math.round(t.z / snap) * snap;
      if (snappedX !== t.x || snappedZ !== t.z) {
        cam.setTarget(new Vector3(snappedX, t.y, snappedZ));
      }
    };
    cam.onViewMatrixChangedObservable.add(applySnap);

    engine.runRenderLoop(() => {
      scene.render();
    });

    try {
      await loadModels(scene, MODELS, cam, highlightLayer, anchors);
      setSceneRefs(scene, cam, highlightLayer, anchors);
    } catch {
      // Model loading failed silently
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointerleave", handlePointerUp);
      canvas.removeEventListener("wheel", handleWheel);
      cam.onViewMatrixChangedObservable.removeCallback(applySnap);
      isInteracting = false;
      if (interactionTimeout) {
        clearTimeout(interactionTimeout);
        interactionTimeout = null;
      }
      lastHoveredMesh = null;
    };
  }, [setEngineType]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cleanupFn: (() => void) | undefined;

    initScene(canvas).then(fn => {
      cleanupFn = fn;
    });

    return () => {
      cleanupFn?.();
      clearSceneRefs();
      if (engineRef.current) {
        engineRef.current.stopRenderLoop();
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, [initScene]);

  useEffect(() => {
    snapRef.current = snapMeters;
    if (cameraLocalRef.current) {
      cameraLocalRef.current.panningInertia = snapMeters > 0 ? 0 : 0.5;
    }
  }, [snapMeters]);

  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;
    const scale = quality === "low" ? 1.5 : 1.0;
    eng.setHardwareScalingLevel(scale);
  }, [quality]);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          touchAction: "none",
        }}
      />
    </div>
  );
}

function buildGround(scene: Scene) {
  const ground = MeshBuilder.CreateGround(
    "ground",
    { width: GROUND_SIZE, height: GROUND_SIZE },
    scene
  );
  ground.position.y = 0;
  ground.isPickable = false;

  const gridMat = new GridMaterial("gridMat", scene);
  gridMat.majorUnitFrequency = 10;
  gridMat.minorUnitVisibility = 0.4;
  gridMat.gridRatio = 1;
  gridMat.backFaceCulling = false;
  gridMat.mainColor = new Color3(0.05, 0.06, 0.1);
  gridMat.lineColor = new Color3(0.2, 0.25, 0.4);
  gridMat.opacity = 0.98;
  ground.material = gridMat;

  [25, 50, 100].forEach((dist) => {
    const color = dist === 25 ? new Color3(0.2, 0.5, 1) : 
                  dist === 50 ? new Color3(0.3, 0.8, 0.3) : 
                  new Color3(1, 0.5, 0.2);

    const xMarker = MeshBuilder.CreateBox(`xMarker_${dist}`, { width: 3, height: 0.5, depth: 3 }, scene);
    xMarker.position = new Vector3(dist, 0.25, -GROUND_SIZE / 2 + 8);
    const xMat = new StandardMaterial(`xMarkerMat_${dist}`, scene);
    xMat.diffuseColor = color;
    xMat.emissiveColor = color.scale(0.3);
    xMarker.material = xMat;

    const zMarker = MeshBuilder.CreateBox(`zMarker_${dist}`, { width: 3, height: 0.5, depth: 3 }, scene);
    zMarker.position = new Vector3(-GROUND_SIZE / 2 + 8, 0.25, dist);
    const zMat = new StandardMaterial(`zMarkerMat_${dist}`, scene);
    zMat.diffuseColor = color;
    zMat.emissiveColor = color.scale(0.3);
    zMarker.material = zMat;
  });
}

function buildAxisIndicators(scene: Scene) {
  const axisLength = 60;
  const y = 0.15;

  const xPoints = [new Vector3(0, y, 0), new Vector3(axisLength, y, 0)];
  const xAxis = MeshBuilder.CreateTube("xAxis", { path: xPoints, radius: 0.4, tessellation: 8 }, scene);
  const xMat = new StandardMaterial("xAxisMat", scene);
  xMat.diffuseColor = new Color3(1, 0.2, 0.2);
  xMat.emissiveColor = new Color3(0.5, 0.1, 0.1);
  xAxis.material = xMat;

  const xCone = MeshBuilder.CreateCylinder("xCone", { height: 4, diameterTop: 0, diameterBottom: 1.5 }, scene);
  xCone.position = new Vector3(axisLength + 2, y, 0);
  xCone.rotation.z = -Math.PI / 2;
  xCone.material = xMat;

  const yPoints = [new Vector3(0, 0, 0), new Vector3(0, axisLength, 0)];
  const yAxis = MeshBuilder.CreateTube("yAxis", { path: yPoints, radius: 0.4, tessellation: 8 }, scene);
  const yMat = new StandardMaterial("yAxisMat", scene);
  yMat.diffuseColor = new Color3(0.2, 1, 0.2);
  yMat.emissiveColor = new Color3(0.1, 0.5, 0.1);
  yAxis.material = yMat;

  const yCone = MeshBuilder.CreateCylinder("yCone", { height: 4, diameterTop: 0, diameterBottom: 1.5 }, scene);
  yCone.position = new Vector3(0, axisLength + 2, 0);
  yCone.material = yMat;

  const zPoints = [new Vector3(0, y, 0), new Vector3(0, y, axisLength)];
  const zAxis = MeshBuilder.CreateTube("zAxis", { path: zPoints, radius: 0.4, tessellation: 8 }, scene);
  const zMat = new StandardMaterial("zAxisMat", scene);
  zMat.diffuseColor = new Color3(0.2, 0.4, 1);
  zMat.emissiveColor = new Color3(0.1, 0.2, 0.5);
  zAxis.material = zMat;

  const zCone = MeshBuilder.CreateCylinder("zCone", { height: 4, diameterTop: 0, diameterBottom: 1.5 }, scene);
  zCone.position = new Vector3(0, y, axisLength + 2);
  zCone.rotation.x = Math.PI / 2;
  zCone.material = zMat;

  [10, 25, 50].forEach((dist) => {
    const xPole = MeshBuilder.CreateCylinder(`xPole_${dist}`, { height: 10, diameter: 1 }, scene);
    xPole.position = new Vector3(dist, 5, 0);
    const xPoleMat = new StandardMaterial(`xPoleMat_${dist}`, scene);
    xPoleMat.diffuseColor = new Color3(1, 0.4, 0.1);
    xPoleMat.emissiveColor = new Color3(0.3, 0.1, 0);
    xPole.material = xPoleMat;

    const zPole = MeshBuilder.CreateCylinder(`zPole_${dist}`, { height: 10, diameter: 1 }, scene);
    zPole.position = new Vector3(0, 5, dist);
    const zPoleMat = new StandardMaterial(`zPoleMat_${dist}`, scene);
    zPoleMat.diffuseColor = new Color3(0.1, 0.6, 1);
    zPoleMat.emissiveColor = new Color3(0, 0.2, 0.3);
    zPole.material = zPoleMat;
  });

  const origin = MeshBuilder.CreateSphere("origin", { diameter: 3 }, scene);
  origin.position = new Vector3(0, 1.5, 0);
  const originMat = new StandardMaterial("originMat", scene);
  originMat.diffuseColor = new Color3(1, 1, 1);
  originMat.emissiveColor = new Color3(0.3, 0.3, 0.3);
  origin.material = originMat;
}

const UV_KIND_ORDER = [
  VertexBuffer.UVKind,
  VertexBuffer.UV2Kind,
  VertexBuffer.UV3Kind,
  VertexBuffer.UV4Kind,
  VertexBuffer.UV5Kind,
  VertexBuffer.UV6Kind,
];

async function loadModels(
  scene: Scene, 
  configs: ModelConfig[], 
  camera: ArcRotateCamera,
  highlightLayer: HighlightLayer | null,
  anchors: Record<string, TransformNode>
) {
  for (const cfg of configs) {
    try {
      const container = await LoadAssetContainerAsync(`/assets/${cfg.file}`, scene);
      container.addAllToScene();

      const meshesWithGeom = container.meshes.filter(m => m.getTotalVertices() > 0);
      
      const isBridge = cfg.name === "bridge";

      // Repair UVs if they look invalid
      meshesWithGeom.forEach(mesh => {
        if (!mesh.isVerticesDataPresent(VertexBuffer.PositionKind)) return;

        let uvs = mesh.getVerticesData(VertexBuffer.UVKind);
        if (!uvs) {
          for (const kind of UV_KIND_ORDER.slice(1)) {
            const alt = mesh.getVerticesData(kind);
            if (alt && alt.length > 0) {
              mesh.setVerticesData(VertexBuffer.UVKind, alt.slice(), false);
              uvs = alt;
              break;
            }
          }
        }

        const needsFix = !uvs || uvs.some(v => !isFinite(v) || v < -1 || v > 10);
        if (needsFix) {
          const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
          if (!positions) return;

          let minX = Infinity, maxX = -Infinity;
          let minZ = Infinity, maxZ = -Infinity;
          for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i];
            const z = positions[i + 2];
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (z < minZ) minZ = z;
            if (z > maxZ) maxZ = z;
          }
          const rangeX = maxX - minX || 1;
          const rangeZ = maxZ - minZ || 1;

          const newUVs = new Array((positions.length / 3) * 2);
          for (let i = 0, j = 0; i < positions.length; i += 3, j += 2) {
            const x = positions[i];
            const z = positions[i + 2];
            newUVs[j] = (x - minX) / rangeX;
            newUVs[j + 1] = (z - minZ) / rangeZ;
          }

          mesh.setVerticesData(VertexBuffer.UVKind, newUVs, false);
          uvs = newUVs;
        }
      });
      
      if (meshesWithGeom.length === 0) continue;
      
      await scene.whenReadyAsync();
      
      // Configure PBR materials for WebGPU
      container.materials.forEach(material => {
        if (material && material instanceof PBRMaterial) {
          const forceUnlit = !isBridge;
          material.forceIrradianceInFragment = true;
          material.realTimeFiltering = false;
          material.realTimeFilteringQuality = 0;
          
          if (material.albedoTexture && forceUnlit) {
            material.emissiveTexture = material.albedoTexture;
            material.emissiveColor = Color3.White();
            material.disableLighting = true;
            material.unlit = true;
            material.useAlphaFromAlbedoTexture = false;
            material.backFaceCulling = false;
            material.twoSidedLighting = true;
          } else if (!material.albedoTexture && forceUnlit) {
            if (material.name.toLowerCase().includes('glass')) {
              material.albedoColor = new Color3(0.7, 0.8, 0.9);
              material.alpha = 0.5;
            } else if (material.name.toLowerCase().includes('metal')) {
              material.albedoColor = new Color3(0.6, 0.6, 0.65);
              material.metallic = 0.9;
            } else if (material.name.toLowerCase().includes('concrete') || material.name.toLowerCase().includes('stone')) {
              material.albedoColor = new Color3(0.5, 0.5, 0.48);
            } else {
              material.albedoColor = new Color3(0.7, 0.7, 0.68);
            }
          }
          
          if (!forceUnlit) {
            material.disableLighting = false;
            material.unlit = false;
            material.useAlphaFromAlbedoTexture = !!material.albedoTexture?.hasAlpha;
          }
          
          material.backFaceCulling = false;
          material.twoSidedLighting = true;
          
          material.markAsDirty(Material.AllDirtyFlag);
        }
      });

      // Force material compilation
      container.materials.forEach((mat) => {
        const meshForMat = meshesWithGeom.find(m => m.material === mat);
        if (meshForMat) {
          mat.forceCompilationAsync?.(meshForMat).catch(() => {});
        }
      });

      // Compute world bounds
      let min = new Vector3(Infinity, Infinity, Infinity);
      let max = new Vector3(-Infinity, -Infinity, -Infinity);
      
      meshesWithGeom.forEach((m) => {
        m.computeWorldMatrix(true);
        m.refreshBoundingInfo(true, false);
        const bi = m.getBoundingInfo();
        min = Vector3.Minimize(min, bi.boundingBox.minimumWorld);
        max = Vector3.Maximize(max, bi.boundingBox.maximumWorld);
      });

      const rawSize = max.subtract(min);
      const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z);
      const rawCenter = min.add(max).scale(0.5);
      const targetSize = cfg.fitSize ?? 30;
      const scale = targetSize / maxDim;

      const anchor = new TransformNode(`${cfg.name}_anchor`, scene);
      const [px, py, pz] = cfg.position ?? [0, 0, 0];
      anchor.position.set(px, py, pz);
      anchors[cfg.name] = anchor;

      const [rx, ry, rz] = cfg.rotation ?? [0, 0, 0];
      anchor.rotation.set(rx, ry, rz);

      const scaler = new TransformNode(`${cfg.name}_scaler`, scene);
      scaler.parent = anchor;
      scaler.scaling.set(scale, scale, scale);

      const offset = new TransformNode(`${cfg.name}_offset`, scene);
      offset.parent = scaler;
      offset.position.set(-rawCenter.x, -min.y, -rawCenter.z);

      const rootNode = container.transformNodes.find(t => t.name === "__root__");
      if (rootNode) {
        rootNode.parent = offset;
      } else {
        container.meshes.forEach(m => {
          if (!m.parent) m.parent = offset;
        });
      }

      // Make meshes interactive
      const hoverColor = Color3.FromHexString("#00AAFF");

      meshesWithGeom.forEach(mesh => {
        mesh.isPickable = cfg.pickable !== false;
        
        if (mesh.material) {
          mesh.material.markAsDirty(Material.AllDirtyFlag);
        }
        
        mesh.actionManager = new ActionManager(scene);
        mesh.actionManager.registerAction(
          new ExecuteCodeAction(
            ActionManager.OnPointerOverTrigger,
            () => {
              if (isInteracting) return;
              if (lastHoveredMesh === mesh) return;
              
              if (lastHoveredMesh && lastHoveredMesh !== mesh) {
                if (highlightLayer) {
                  highlightLayer.removeMesh(lastHoveredMesh);
                } else {
                  lastHoveredMesh.renderOutline = false;
                }
              }
              
              lastHoveredMesh = mesh;
              if (highlightLayer) {
                highlightLayer.addMesh(mesh as any, hoverColor);
              } else {
                mesh.outlineColor = hoverColor;
                mesh.outlineWidth = 0.05;
                mesh.renderOutline = true;
              }
              document.body.style.cursor = "pointer";
            }
          )
        );
        mesh.actionManager.registerAction(
          new ExecuteCodeAction(
            ActionManager.OnPointerOutTrigger,
            () => {
              if (isInteracting) return;
              
              if (lastHoveredMesh === mesh) {
                lastHoveredMesh = null;
              }
              if (highlightLayer) {
                highlightLayer.removeMesh(mesh as any);
              } else {
                mesh.renderOutline = false;
              }
              document.body.style.cursor = "default";
            }
          )
        );
        mesh.actionManager.registerAction(
          new ExecuteCodeAction(
            ActionManager.OnPickTrigger,
            () => {
              if (!isInteracting) {
                focusModel(cfg.name);
              }
            }
          )
        );
      });
    } catch {
      // Model loading failed silently
    }
  }

  // Frame camera to see models
  const anchorNames = Object.keys(anchors);
  if (anchorNames.length > 0) {
    let sumX = 0, sumZ = 0;
    anchorNames.forEach(name => {
      sumX += anchors[name].position.x;
      sumZ += anchors[name].position.z;
    });
    camera.setTarget(new Vector3(sumX / anchorNames.length, 20, sumZ / anchorNames.length));
  }
  camera.radius = 150;
}

