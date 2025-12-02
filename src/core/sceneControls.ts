// Scene control functions - separated from CanvasHost for HMR compatibility
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { HighlightLayer } from "@babylonjs/core/Layers/highlightLayer";
import { Animation } from "@babylonjs/core/Animations/animation";

// Store refs for scene controls
const DEFAULT_LOWER_RADIUS = 0.2;
const DEFAULT_UPPER_RADIUS = 1500;

let sceneRef: Scene | null = null;
let cameraRef: ArcRotateCamera | null = null;
let highlightLayerRef: HighlightLayer | null = null;
let anchorsRef: Record<string, TransformNode> = {};

export function setSceneRefs(
  scene: Scene | null, 
  camera: ArcRotateCamera | null,
  highlightLayer: HighlightLayer | null,
  anchors: Record<string, TransformNode>
) {
  sceneRef = scene;
  cameraRef = camera;
  highlightLayerRef = highlightLayer;
  anchorsRef = anchors;
}

export function clearSceneRefs() {
  sceneRef = null;
  cameraRef = null;
  highlightLayerRef = null;
  anchorsRef = {};
}

export function getAnchorsRef() {
  return anchorsRef;
}

export function getHighlightLayer() {
  return highlightLayerRef;
}

export function focusModel(name: string) {
  const anchor = anchorsRef[name];
  if (!anchor || !cameraRef || !sceneRef) return;
  
  const bounds = computeWorldBounds(anchor);
  if (!bounds) return;
  
  const center = bounds.min.add(bounds.max).scale(0.5);
  const size = bounds.max.subtract(bounds.min);
  center.y += Math.max(size.y * 0.1, 1.5);
  // Pad radius a bit so the model fills the view without clipping
  const radius = Math.max(size.x, size.y, size.z) * 1.1;
  cameraRef.lowerRadiusLimit = DEFAULT_LOWER_RADIUS;
  cameraRef.upperRadiusLimit = DEFAULT_UPPER_RADIUS;
  
  animateCameraTo(center, Math.max(radius, 2));
}

export function resetView() {
  if (!cameraRef || !sceneRef) return;
  cameraRef.lowerRadiusLimit = DEFAULT_LOWER_RADIUS;
  cameraRef.upperRadiusLimit = DEFAULT_UPPER_RADIUS;
  animateCameraTo(new Vector3(0, 20, 0), 150);
}

export function toggleWireframe(enabled: boolean) {
  if (!sceneRef) return;
  sceneRef.meshes.forEach(mesh => {
    if (mesh.material) {
      mesh.material.wireframe = enabled;
    }
  });
}

function animateCameraTo(target: Vector3, radius: number) {
  if (!cameraRef || !sceneRef) return;
  
  const cam = cameraRef;
  const scene = sceneRef;
  const frameRate = 60;
  const totalFrames = 30;
  
  const targetAnim = new Animation(
    "cameraTarget",
    "target",
    frameRate,
    Animation.ANIMATIONTYPE_VECTOR3,
    Animation.ANIMATIONLOOPMODE_CONSTANT
  );
  targetAnim.setKeys([
    { frame: 0, value: cam.target.clone() },
    { frame: totalFrames, value: target }
  ]);
  
  const radiusAnim = new Animation(
    "cameraRadius",
    "radius",
    frameRate,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT
  );
  radiusAnim.setKeys([
    { frame: 0, value: cam.radius },
    { frame: totalFrames, value: radius }
  ]);
  
  cam.animations = [targetAnim, radiusAnim];
  scene.beginAnimation(cam, 0, totalFrames, false);
}

export function computeWorldBounds(node: TransformNode): { min: Vector3; max: Vector3 } | null {
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
