import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import { AMFLoader } from 'three/examples/jsm/loaders/AMFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  CloudUpload,
  Crosshair,
  Expand,
  Eye,
  EyeOff,
  FolderOpen,
  Grid3X3,
  Hand,
  Layers,
  LayoutGrid,
  Maximize2,
  MousePointer,
  Move,
  Move3D,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Ruler,
  Scaling,
  Scissors,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Video,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { createStarterLanternGroup } from '../utils/proceduralLantern';
import { createPointCloudArtGroup } from '../utils/pointCloudArt';
import {
  applyBlenderOrbitStep,
  getBlenderPresetOffset,
  type BlenderCameraPreset,
} from '../utils/cameraPresets';
import {
  buildArrayModifierClones,
  buildScatterInstances,
  createProceduralMaterialMaps,
  createScatterBrushProp,
  createWorldPrimitive,
  focalLengthMmToFovDeg,
  fovDegToFocalLengthMm,
  rebuildAreaLightFrameHelper,
  rebuildCameraFrustumHelper,
  rebuildSpotLightConeHelper,
} from '../utils/worldPrimitives';
import { parseDxf3dFacesToGeometry, parseOffToGeometry } from '../utils/modelConverter';
import {
  clearHistoryStack,
  createHistoryStack,
  getHistorySummary,
  pushHistoryCommand,
  stepRedo,
  stepUndo,
  type HistoryStack,
} from '../utils/undoHistory';
import {
  applyTerrainPaintBrush,
  applyTerrainSculptBrush,
  captureTerrainSnapshot,
  restoreTerrainSnapshot,
  sampleTerrainHeightAt,
  type TerrainGeometrySnapshot,
} from '../utils/terrainEngine';
import {
  animatePlayerAvatar,
  captureSceneTransformSnapshot,
  collectWalkableMeshes,
  collectWorldColliders,
  createPlayerAvatarMesh,
  createPlayerState,
  findSafePlayerSpawn,
  restoreSceneTransformSnapshot,
  stepPlayerController,
  stepRigidBodies,
  type AabbCollider,
  type PlayerControllerState,
  type RigidBodyState,
  type TransformSnapshotItem,
} from '../utils/physicsEngine';
import { ViewportHud } from './ViewportHud';
import type {
  AnimationClipSummary,
  BoneControlInfo,
  CameraTelemetry,
  CapturedScreenshot,
  DragMouseMode,
  ExecutionMode,
  GizmoMode,
  GizmoSpace,
  HistoryStateSummary,
  InsideOutSide,
  MaterialChannelInfo,
  MaterialEditPayload,
  OutlinerNode,
  PhysicsConfig,
  PlayModeStatus,
  ScatterBrushConfig,
  SceneLightKind,
  SceneTelemetry,
  SectionCutConfig,
  SelectedCameraInfo,
  SelectedLightInfo,
  ShadingPass,
  StudioLightingPreset,
  SurfaceParams,
  TerrainBrushConfig,
  TopologyDiagnostics,
  TransformInfo,
  ViewportOverlayFlags,
  ViewportTelemetryHudState,
  ViewportToolMode,
  WorldEnvironmentPreset,
  WorldPrimitiveKind,
} from '../types';

export interface StudioViewportHandle {
  loadStarterLantern: () => void;
  loadModelFromUrl: (url: string, displayName: string, formatHint?: string) => Promise<void>;
  appendModelFromUrl: (url: string, displayName: string, formatHint?: string) => Promise<void>;
  mountParsedGroup: (group: THREE.Group, displayName: string) => void;
  clearToPointCloud: () => void;
  setCameraPreset: (preset: BlenderCameraPreset) => void;
  focusSelected: () => void;
  toggleOrtho: () => void;
  zoomBy: (factor: number) => void;
  resetView: () => void;
  captureSnapshot: (download?: boolean) => string | null;
  captureActiveCameraSnapshot: () => string | null;
  captureMultiAngleScreenshots: () => CapturedScreenshot[];
  getActiveModelRoot: () => THREE.Object3D | null;
  selectNode: (uuid: string | null) => void;
  toggleNodeVisibility: (uuid: string) => void;
  toggleNodeLock: (uuid: string) => void;
  toggleSoloNode: (uuid: string) => void;
  showAllNodes: () => void;
  groupSelectedNode: () => void;
  unparentNode: (uuid: string) => void;
  reparentNode: (childUuid: string, newParentUuid: string) => void;
  updateTransform: (
    axis: 'posX' | 'posY' | 'posZ' | 'rotX' | 'rotY' | 'rotZ' | 'scaleX' | 'scaleY' | 'scaleZ',
    value: number
  ) => void;
  // Undo / Redo
  undo: () => void;
  redo: () => void;
  // Play Mode & Physics
  startPlayMode: () => void;
  stopPlayMode: () => void;
  togglePlayMode: () => void;
  togglePlayCameraMode: () => void;
  setPlayInputKey: (key: string, pressed: boolean) => void;
  resetPhysicsState: () => void;
  // Active viewport tool (select, measure, terrain-sculpt, terrain-paint, scatter-brush)
  setViewportToolMode: (mode: ViewportToolMode) => void;
  // Direct PBR Material Editing
  editMaterial: (payload: MaterialEditPayload) => void;
  // Blender Light & Scene Camera Properties
  updateLightProperties: (
    uuid: string,
    patch: Partial<Omit<SelectedLightInfo, 'uuid' | 'name' | 'lightKind'>>
  ) => void;
  updateCameraProperties: (
    uuid: string,
    patch: Partial<Pick<SelectedCameraInfo, 'focalLengthMm' | 'near' | 'far'>>
  ) => void;
  setActiveSceneCamera: (uuid: string | null) => void;
  toggleLookThroughCamera: (uuid?: string) => void;
  alignCameraToCurrentView: (uuid?: string) => void;
  // Blender World Assembly Suite
  addWorldPrimitive: (kind: WorldPrimitiveKind) => void;
  duplicateSelected: () => void;
  deleteSelected: () => void;
  mirrorSelected: (axis: 'x' | 'y' | 'z') => void;
  snapSelectedToGround: () => void;
  toggleSelectedFlatShading: () => void;
  applyArrayModifier: (count: number, offset: [number, number, number]) => void;
  applyScatterModifier: (count: number, radius: number) => void;
  updateWorldEnvironment: (preset: WorldEnvironmentPreset, fogDensity: number, fogHeight?: number) => void;
  // Diagnostics & Rig
  recalculateNormals: () => void;
  purgeDegenerates: () => void;
  selectAnimationClip: (index: number) => void;
  togglePlayAnimation: () => void;
  scrubAnimation: (timeSec: number) => void;
  setBoneRotation: (uuid: string, axis: 'x' | 'y' | 'z', deg: number) => void;
  resetPose: () => void;
}

interface StudioViewportProps {
  shadingPass: ShadingPass;
  onShadingPassChange: (pass: ShadingPass) => void;
  quadView: boolean;
  onToggleQuadView: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  overlays: ViewportOverlayFlags;
  onToggleOverlay: (key: keyof ViewportOverlayFlags) => void;
  cameraFov: number;
  cameraSpeed: number;
  autoSpin: boolean;
  onToggleAutoSpin: () => void;
  exploded: boolean;
  onToggleExploded: () => void;
  lightingPreset: StudioLightingPreset;
  onLightingPresetChange: (preset: StudioLightingPreset) => void;
  lightAngleDeg: number;
  onLightAngleChange: (deg: number) => void;
  sunElevationDeg: number;
  shadowsEnabled: boolean;
  wireframeOpacity: number;
  onWireframeOpacityChange: (val: number) => void;
  insideOutSide: InsideOutSide;
  surfaceParams: SurfaceParams;
  sectionCut: SectionCutConfig;
  onSectionCutChange: (next: SectionCutConfig) => void;
  showSkeleton: boolean;
  gizmoMode: GizmoMode;
  onGizmoModeChange: (mode: GizmoMode) => void;
  gizmoSpace: GizmoSpace;
  snapGrid: number;
  snapRotateDeg: number;
  snapScale: number;
  worldEnvPreset: WorldEnvironmentPreset;
  worldFogDensity: number;
  worldFogHeight: number;
  terrainBrush: TerrainBrushConfig;
  scatterBrush: ScatterBrushConfig;
  physicsConfig: PhysicsConfig;
  onCycleGravityMode: () => void;
  activeToolMode?: ViewportToolMode;
  onToolModeChange?: (mode: ViewportToolMode) => void;
  onHistoryChange?: (summary: HistoryStateSummary) => void;
  onPlayModeChange?: (status: PlayModeStatus) => void;
  executionMode: ExecutionMode;
  fsSupported: boolean;
  inspectorOpen: boolean;
  onOpenLibrary: () => void;
  onToggleInspector: () => void;
  onLinkLocalFolder: () => void;
  onRequestExecutionMode: (mode: ExecutionMode) => void;
  onNotify: (msg: string) => void;
  onTelemetryChange: (t: SceneTelemetry) => void;
  onCameraTelemetryChange: (c: CameraTelemetry) => void;
  onDiagnosticsChange: (d: TopologyDiagnostics) => void;
  onOutlinerChange: (nodes: OutlinerNode[]) => void;
  onSelectedNodeChange: (uuid: string | null) => void;
  onSoloNodeChange: (uuid: string | null) => void;
  onTransformInfoChange: (info: TransformInfo) => void;
  onMaterialsChange: (mats: MaterialChannelInfo[]) => void;
  onBonesChange: (bones: BoneControlInfo[]) => void;
  onAnimationsChange: (clips: AnimationClipSummary[], activeIdx: number, duration: number) => void;
  onAnimationTimeChange: (timeSec: number, playing: boolean) => void;
  onSelectedLightChange: (info: SelectedLightInfo | null) => void;
  onSelectedCameraChange: (info: SelectedCameraInfo | null) => void;
  onCaptureViewportToRepo: (dataUrl: string, angle: 'viewport' | 'camera') => void;
}

const SHADING_OPTIONS: Array<{ id: ShadingPass; label: string }> = [
  { id: 'combined', label: 'Combined PBR' },
  { id: 'wireframe', label: 'Wireframe Overlay' },
  { id: 'albedo', label: 'Base Albedo' },
  { id: 'normal', label: 'World Normals' },
  { id: 'roughness', label: 'Roughness Map' },
  { id: 'matcap', label: 'Clay Matcap' },
  { id: 'xray', label: 'X-Ray Ghost' },
  { id: 'uv', label: 'UV Checker' },
  { id: 'points', label: 'Vertex Cloud' },
];

const LIGHTING_OPTIONS: Array<{ id: StudioLightingPreset; label: string }> = [
  { id: 'studio-4k', label: 'Studio Gallery 4K' },
  { id: 'architectural', label: 'Daylight Architectural' },
  { id: 'high-contrast', label: 'Sculptural Rim' },
  { id: 'soft-clay', label: 'Warm Soft Clay' },
];

const WORLD_ENV_BG: Record<WorldEnvironmentPreset, string> = {
  alabaster: '#ECEAE4',
  courtyard: '#DFE7F0',
  meadow: '#DCEAE2',
  desert: '#F1E2CC',
  celestial: '#9FD8F7',
};

const WORLD_SKY_GRADIENT: Record<
  WorldEnvironmentPreset,
  { zenith: string; horizon: string; nadir: string; warmHorizon?: string }
> = {
  alabaster: { zenith: '#ECEAE4', horizon: '#ECEAE4', nadir: '#E2DFD7' },
  courtyard: { zenith: '#B8D0E8', horizon: '#E7EEF4', nadir: '#D4DBE2' },
  meadow: { zenith: '#9ECAE4', horizon: '#E3F0E9', nadir: '#CBD7CD' },
  desert: { zenith: '#B5CBE0', horizon: '#F4E3C9', nadir: '#DEC8AB' },
  celestial: {
    zenith: '#2186DB',
    horizon: '#8CD9FC',
    nadir: '#7AC2EA',
    warmHorizon: '#FFE3C6',
  },
};

function isInsideEditorElement(obj: THREE.Object3D): boolean {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (cur.userData?.isEditorHelper) return true;
    cur = cur.parent;
  }
  return false;
}

function findStudioElementOwner(obj: THREE.Object3D): THREE.Object3D | null {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (cur.userData?.studioElementType === 'light' || cur.userData?.studioElementType === 'camera') {
      return cur;
    }
    cur = cur.parent;
  }
  return null;
}

function findChildLight(group: THREE.Object3D): THREE.Light | null {
  for (const child of group.children) {
    if ((child as THREE.Light).isLight) return child as THREE.Light;
  }
  return null;
}

function findChildPerspectiveCamera(group: THREE.Object3D): THREE.PerspectiveCamera | null {
  for (const child of group.children) {
    if ((child as THREE.PerspectiveCamera).isPerspectiveCamera) {
      return child as THREE.PerspectiveCamera;
    }
  }
  return null;
}

function extractSelectedLightInfo(obj: THREE.Object3D | null): SelectedLightInfo | null {
  if (!obj || obj.userData?.studioElementType !== 'light') return null;
  const light = findChildLight(obj);
  if (!light) return null;
  const lightKind = (obj.userData.lightKind as SceneLightKind) || 'point';
  const color = `#${light.color.getHexString()}`;
  const info: SelectedLightInfo = {
    uuid: obj.uuid,
    name: obj.name || 'Light',
    lightKind,
    color,
    intensity: light.intensity,
    distance: 0,
    decay: 2,
    angleDeg: 38,
    penumbra: 0.35,
    width: 2.0,
    height: 1.2,
    castShadow: Boolean(light.castShadow),
  };
  if (lightKind === 'point' && (light as THREE.PointLight).isPointLight) {
    const pt = light as THREE.PointLight;
    info.distance = pt.distance;
    info.decay = pt.decay;
  } else if (lightKind === 'spot' && (light as THREE.SpotLight).isSpotLight) {
    const sp = light as THREE.SpotLight;
    info.distance = sp.distance;
    info.decay = sp.decay;
    info.angleDeg = Math.round(THREE.MathUtils.radToDeg(sp.angle));
    info.penumbra = sp.penumbra;
  } else if (lightKind === 'area') {
    const rect = light as THREE.RectAreaLight;
    info.width =
      typeof obj.userData.areaWidth === 'number'
        ? obj.userData.areaWidth
        : typeof rect.width === 'number'
          ? rect.width
          : 2.0;
    info.height =
      typeof obj.userData.areaHeight === 'number'
        ? obj.userData.areaHeight
        : typeof rect.height === 'number'
          ? rect.height
          : 1.2;
  }
  return info;
}

function extractSelectedCameraInfo(
  obj: THREE.Object3D | null,
  activeCameraUuid: string | null,
  lookingThrough: boolean
): SelectedCameraInfo | null {
  if (!obj || obj.userData?.studioElementType !== 'camera') return null;
  const cam = findChildPerspectiveCamera(obj);
  if (!cam) return null;
  const focalLengthMm =
    typeof obj.userData.focalLengthMm === 'number'
      ? obj.userData.focalLengthMm
      : Math.round(fovDegToFocalLengthMm(cam.fov));
  return {
    uuid: obj.uuid,
    name: obj.name || 'Scene_Camera',
    focalLengthMm,
    fov: Number(cam.fov.toFixed(1)),
    near: cam.near,
    far: cam.far,
    isActiveCamera: obj.uuid === activeCameraUuid,
    lookingThrough: lookingThrough && obj.uuid === activeCameraUuid,
  };
}

function createUvCheckerTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cells = 8;
    const step = 256 / cells;
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#EAE6DF' : '#2D5A4C';
        ctx.fillRect(x * step, y * step, step, step);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createClayMatcapTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(96, 86, 12, 128, 128, 128);
    grad.addColorStop(0, '#FFFDF9');
    grad.addColorStop(0.35, '#DFD8CE');
    grad.addColorStop(0.75, '#8F877D');
    grad.addColorStop(1, '#3D3934');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 122);
    grad.addColorStop(0, 'rgba(28, 27, 25, 0.24)');
    grad.addColorStop(0.45, 'rgba(28, 27, 25, 0.10)');
    grad.addColorStop(1, 'rgba(28, 27, 25, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  return new THREE.CanvasTexture(canvas);
}

function createInfiniteFloorGrid(): THREE.Mesh {
  // Large open-world grid plane (600x600m) rendered DoubleSide so Y < 0 underside navigation works seamlessly
  const geo = new THREE.PlaneGeometry(600, 600, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uMinorColor: { value: new THREE.Color('#CEC8BE') },
      uMajorColor: { value: new THREE.Color('#ABA498') },
      uFadeDist: { value: 180.0 },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uMinorColor;
      uniform vec3 uMajorColor;
      uniform float uFadeDist;
      varying vec3 vWorldPos;

      float gridLine(vec2 coord, float scale) {
        vec2 p = coord / scale;
        vec2 grid = abs(fract(p - 0.5) - 0.5) / max(fwidth(p), vec2(0.0001));
        float line = min(grid.x, grid.y);
        return 1.0 - min(line, 1.0);
      }

      void main() {
        float dist = length(vWorldPos.xz);
        float fade = smoothstep(uFadeDist, 4.0, dist);
        float minor = gridLine(vWorldPos.xz, 1.0) * 0.28;
        float major = gridLine(vWorldPos.xz, 5.0) * 0.58;
        vec3 col = mix(uMinorColor, uMajorColor, step(minor, major));
        float alpha = max(minor, major) * fade;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'Atelier_Infinite_Grid';
  mesh.position.y = -0.002;
  mesh.renderOrder = -1;
  mesh.userData.isEditorHelper = true;
  return mesh;
}

function createProceduralSkyDome(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(750, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uZenith: { value: new THREE.Color('#2186DB') },
      uHorizon: { value: new THREE.Color('#8CD9FC') },
      uNadir: { value: new THREE.Color('#7AC2EA') },
      uWarmHorizon: { value: new THREE.Color('#FFE3C6') },
      uWarmFactor: { value: 1.0 },
      uSunDir: { value: new THREE.Vector3(-0.62, 0.22, -0.75).normalize() },
    },
    vertexShader: `
      varying vec3 vLocalDir;
      void main() {
        vLocalDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uNadir;
      uniform vec3 uWarmHorizon;
      uniform float uWarmFactor;
      uniform vec3 uSunDir;
      varying vec3 vLocalDir;
      void main() {
        vec3 dir = normalize(vLocalDir);
        float y = dir.y;
        vec3 col = y >= 0.0
          ? mix(uHorizon, uZenith, pow(clamp(y, 0.0, 1.0), 0.58))
          : mix(uHorizon, uNadir, pow(clamp(-y, 0.0, 1.0), 0.65));

        if (uWarmFactor > 0.01) {
          // Painterly dawn peach-cream horizon ribbon + soft upper-left sun scatter
          float horizonBand = exp(-pow((y - 0.035) * 6.5, 2.0));
          float leftWarmth = smoothstep(-0.35, 0.85, -dir.x * 0.72 - dir.z * 0.65);
          col = mix(col, uWarmHorizon, horizonBand * (0.34 + 0.44 * leftWarmth) * uWarmFactor);

          float sunDot = max(dot(dir, uSunDir), 0.0);
          float sunHalo = pow(sunDot, 7.0) * 0.36 + pow(sunDot, 36.0) * 0.42;
          col += vec3(1.0, 0.90, 0.78) * sunHalo * uWarmFactor;

          // Subtle airy cloud-veil streaks in upper sky
          float streak = sin(dir.x * 9.0 + dir.z * 5.0) * sin(dir.y * 16.0 - dir.x * 4.0);
          float streakMask = smoothstep(0.04, 0.42, y) * (1.0 - smoothstep(0.42, 0.85, y));
          col = mix(col, vec3(0.97, 0.98, 1.0), max(0.0, streak) * 0.08 * streakMask * uWarmFactor);
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const dome = new THREE.Mesh(geo, mat);
  dome.name = 'Procedural_SkyDome';
  dome.visible = false;
  dome.renderOrder = -10;
  dome.userData.isEditorHelper = true;
  dome.userData.noCollision = true;
  return dome;
}

async function loadObject3DFromUrl(
  url: string,
  displayName: string,
  formatHint?: string
): Promise<{ root: THREE.Object3D; animations: THREE.AnimationClip[]; dispose: () => void }> {
  const hint = (formatHint || displayName || url).toLowerCase();
  const makeFallbackMat = () =>
    new THREE.MeshStandardMaterial({
      name: 'Gallery_Stone_BSDF',
      color: '#8D877E',
      roughness: 0.6,
      metalness: 0.08,
    });

  if (hint.endsWith('.obj')) {
    const loader = new OBJLoader();
    const obj = await loader.loadAsync(url);
    const mat = makeFallbackMat();
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        if (!m.material) m.material = mat;
        if (!m.geometry.getAttribute('normal')) m.geometry.computeVertexNormals();
      }
    });
    return { root: obj, animations: [], dispose: () => mat.dispose() };
  }

  if (hint.endsWith('.stl')) {
    const loader = new STLLoader();
    const geo = await loader.loadAsync(url);
    geo.computeVertexNormals();
    const mat = makeFallbackMat();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = displayName.replace(/\.stl$/i, '');
    const grp = new THREE.Group();
    grp.name = displayName;
    grp.add(mesh);
    return {
      root: grp,
      animations: [],
      dispose: () => {
        geo.dispose();
        mat.dispose();
      },
    };
  }

  if (hint.endsWith('.ply')) {
    const loader = new PLYLoader();
    const geo = await loader.loadAsync(url);
    geo.computeVertexNormals();
    const hasColors = Boolean(geo.getAttribute('color'));
    const mat = new THREE.MeshStandardMaterial({
      name: 'PLY_BSDF',
      color: hasColors ? '#FFFFFF' : '#8A847A',
      vertexColors: hasColors,
      roughness: 0.58,
      metalness: 0.06,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = displayName.replace(/\.ply$/i, '');
    const grp = new THREE.Group();
    grp.name = displayName;
    grp.add(mesh);
    return {
      root: grp,
      animations: [],
      dispose: () => {
        geo.dispose();
        mat.dispose();
      },
    };
  }

  if (hint.endsWith('.fbx')) {
    const loader = new FBXLoader();
    const fbx = await loader.loadAsync(url);
    return { root: fbx, animations: fbx.animations || [], dispose: () => {} };
  }

  if (hint.endsWith('.dae')) {
    const loader = new ColladaLoader();
    const dae = await loader.loadAsync(url);
    return { root: dae.scene, animations: [], dispose: () => {} };
  }

  if (hint.endsWith('.3mf')) {
    const loader = new ThreeMFLoader();
    const grp = await loader.loadAsync(url);
    return { root: grp, animations: [], dispose: () => {} };
  }

  if (hint.endsWith('.amf')) {
    const loader = new AMFLoader();
    const grp = await loader.loadAsync(url);
    return { root: grp, animations: [], dispose: () => {} };
  }

  if (hint.endsWith('.off') || hint.endsWith('.dxf')) {
    const text = await (await fetch(url)).text();
    const geo = hint.endsWith('.off') ? parseOffToGeometry(text) : parseDxf3dFacesToGeometry(text);
    const mat = makeFallbackMat();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = displayName.replace(/\.(off|dxf)$/i, '');
    const grp = new THREE.Group();
    grp.name = displayName;
    grp.add(mesh);
    return {
      root: grp,
      animations: [],
      dispose: () => {
        geo.dispose();
        mat.dispose();
      },
    };
  }

  // Default: GLB / GLTF
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  return {
    root: gltf.scene,
    animations: gltf.animations || [],
    dispose: () => {
      gltf.scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          (o as THREE.Mesh).geometry.dispose();
        }
      });
    },
  };
}

export const StudioViewport = forwardRef<StudioViewportHandle, StudioViewportProps>(
  (
    {
      shadingPass,
      onShadingPassChange,
      quadView,
      onToggleQuadView,
      showGrid,
      onToggleGrid,
      overlays,
      onToggleOverlay,
      cameraFov,
      cameraSpeed,
      autoSpin,
      onToggleAutoSpin,
      exploded,
      onToggleExploded,
      lightingPreset,
      onLightingPresetChange,
      lightAngleDeg,
      onLightAngleChange,
      sunElevationDeg,
      shadowsEnabled,
      wireframeOpacity,
      onWireframeOpacityChange,
      insideOutSide,
      surfaceParams,
      sectionCut,
      onSectionCutChange,
      showSkeleton,
      gizmoMode,
      onGizmoModeChange,
      gizmoSpace,
      snapGrid,
      snapRotateDeg,
      snapScale,
      worldEnvPreset,
      worldFogDensity,
      worldFogHeight,
      terrainBrush,
      scatterBrush,
      physicsConfig,
      onCycleGravityMode,
      activeToolMode,
      onToolModeChange,
      onHistoryChange,
      onPlayModeChange,
      executionMode,
      fsSupported,
      inspectorOpen,
      onOpenLibrary,
      onToggleInspector,
      onLinkLocalFolder,
      onRequestExecutionMode,
      onNotify,
      onTelemetryChange,
      onCameraTelemetryChange,
      onDiagnosticsChange,
      onOutlinerChange,
      onSelectedNodeChange,
      onSoloNodeChange,
      onTransformInfoChange,
      onMaterialsChange,
      onBonesChange,
      onAnimationsChange,
      onAnimationTimeChange,
      onSelectedLightChange,
      onSelectedCameraChange,
      onCaptureViewportToRepo,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const compassCanvasRef = useRef<HTMLCanvasElement | null>(null);

    const [dragMode, setDragMode] = useState<DragMouseMode>('orbit');
    const [internalToolMode, setInternalToolMode] = useState<ViewportToolMode>('orbit');
    const toolMode = activeToolMode ?? internalToolMode;
    const setToolMode = useCallback(
      (next: ViewportToolMode) => {
        setInternalToolMode(next);
        onToolModeChange?.(next);
      },
      [onToolModeChange]
    );

    const [isOrtho, setIsOrtho] = useState(false);
    const [controlsHidden, setControlsHidden] = useState(false);
    const [openPopover, setOpenPopover] = useState<'shading' | 'lighting' | 'more' | null>(null);
    const [measuredDistance, setMeasuredDistance] = useState<number | null>(null);
    const [loadingLabel, setLoadingLabel] = useState<string | null>(null);
    const [captionModelName, setCaptionModelName] = useState<string>('Michelle');
    const [captionSummary, setCaptionSummary] = useState<string>('Rigged Character');
    const [lookingThroughCam, setLookingThroughCam] = useState(false);
    const [activeSceneCamLabel, setActiveSceneCamLabel] = useState<string>('Scene_Camera');
    const [activeSceneCamFocalMm, setActiveSceneCamFocalMm] = useState<number>(50);
    const [activePresetLabel, setActivePresetLabel] = useState<string>('Hero 3/4');

    const [hudState, setHudState] = useState<ViewportTelemetryHudState>({
      fps: 60,
      objectCount: 0,
      triangleCount: 0,
      vertexCount: 0,
      selectedName: null,
      selectedDimensions: [0, 0, 0],
      cursorPosition: [0, 0, 0],
    });
    const [playModeStatus, setPlayModeStatus] = useState<PlayModeStatus>({
      active: false,
      cameraMode: 'third-person',
      playerX: 0,
      playerY: 0,
      playerZ: 0,
      grounded: true,
      sprinting: false,
    });

    // Mutable 3D engine state refs
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const perspCamRef = useRef<THREE.PerspectiveCamera | null>(null);
    const orthoCamRef = useRef<THREE.OrthographicCamera | null>(null);
    const activeCamRef = useRef<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>(null);
    const activeSceneCamUuidRef = useRef<string | null>(null);
    const lookingThroughCamRef = useRef<boolean>(false);
    const orbitRef = useRef<OrbitControls | null>(null);
    const transformCtrlRef = useRef<TransformControls | null>(null);
    const transformHelperRef = useRef<THREE.Object3D | null>(null);
    const gridRef = useRef<THREE.Mesh | null>(null);
    const axesHelperRef = useRef<THREE.AxesHelper | null>(null);
    const modelBoundsHelperRef = useRef<THREE.BoxHelper | null>(null);
    const colliderOverlayGroupRef = useRef<THREE.Group | null>(null);
    const skyDomeRef = useRef<THREE.Mesh | null>(null);
    const brushCursorRef = useRef<THREE.LineLoop | null>(null);
    const contactShadowRef = useRef<THREE.Mesh | null>(null);
    const keyLightRef = useRef<THREE.DirectionalLight | null>(null);
    const rimLightRef = useRef<THREE.DirectionalLight | null>(null);
    const fillLightRef = useRef<THREE.DirectionalLight | null>(null);
    const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
    const clipPlaneRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, -1, 0), 10));
    const clipHelperRef = useRef<THREE.LineLoop | null>(null);

    const activeModelRootRef = useRef<THREE.Object3D | null>(null);
    const activeModelDisposeRef = useRef<(() => void) | null>(null);
    const pointCloudRef = useRef<ReturnType<typeof createPointCloudArtGroup> | null>(null);
    const skeletonHelperRef = useRef<THREE.SkeletonHelper | null>(null);
    const selectionBoxRef = useRef<THREE.BoxHelper | null>(null);
    const wireframeGroupRef = useRef<THREE.Group | null>(null);
    const pointsOverlayRef = useRef<THREE.Group | null>(null);
    const measureGroupRef = useRef<THREE.Group | null>(null);
    const measurePointsRef = useRef<THREE.Vector3[]>([]);
    const primitiveCounterRef = useRef<number>(1);

    const originalMaterialsRef = useRef<Map<THREE.Mesh, THREE.Material | THREE.Material[]>>(new Map());
    const tempOverrideMaterialsRef = useRef<Set<THREE.Material>>(new Set());
    const explodeBasePosRef = useRef<Map<THREE.Mesh, THREE.Vector3>>(new Map());
    const explodeDirRef = useRef<Map<THREE.Mesh, THREE.Vector3>>(new Map());
    const explodeFactorRef = useRef<number>(0);
    const lockedNodesRef = useRef<Set<string>>(new Set());
    const selectedNodeUuidRef = useRef<string | null>(null);
    const soloNodeUuidRef = useRef<string | null>(null);
    const modelCenterRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.72, 0));
    const modelRadiusRef = useRef<number>(1.05);

    // Undo / Redo Command History
    const historyRef = useRef<HistoryStack>(createHistoryStack(60));
    const tcDragStartRef = useRef<{
      uuid: string;
      pos: THREE.Vector3;
      quat: THREE.Quaternion;
      scale: THREE.Vector3;
    } | null>(null);

    // Terrain & Scatter Interactive Brush State
    const brushStrokeRef = useRef<{
      active: boolean;
      mode: ViewportToolMode;
      targetMesh: THREE.Mesh | null;
      beforeSnapshot: TerrainGeometrySnapshot | null;
      createdProps: THREE.Object3D[];
      lastScatterPos: THREE.Vector3 | null;
    }>({
      active: false,
      mode: 'orbit',
      targetMesh: null,
      beforeSnapshot: null,
      createdProps: [],
      lastScatterPos: null,
    });

    // Play Mode & Rigid-Body Physics State
    const playModeActiveRef = useRef<boolean>(false);
    const playSessionIdRef = useRef<number>(0);
    const playCamModeRef = useRef<'third-person' | 'first-person'>('third-person');
    const playerStateRef = useRef<PlayerControllerState | null>(null);
    const playerAvatarRef = useRef<THREE.Group | null>(null);
    const playerMixerRef = useRef<THREE.AnimationMixer | null>(null);
    const playerActionsRef = useRef<{
      idle?: THREE.AnimationAction;
      walk?: THREE.AnimationAction;
      run?: THREE.AnimationAction;
      current?: 'idle' | 'walk' | 'run';
    }>({});
    const playerAvatarSourceRef = useRef<'glb' | 'procedural'>('procedural');
    const hiddenTravelersRef = useRef<THREE.Object3D[]>([]);
    const playCollidersRef = useRef<AabbCollider[]>([]);
    const playWalkableMeshesRef = useRef<THREE.Mesh[]>([]);
    const playTerrainMeshesRef = useRef<THREE.Mesh[]>([]);
    const playRaycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
    const playRayOriginRef = useRef<THREE.Vector3>(new THREE.Vector3());
    const playRayDownRef = useRef<THREE.Vector3>(new THREE.Vector3(0, -1, 0));
    const playKeysRef = useRef<Set<string>>(new Set());
    const playLookDragRef = useRef<{
      active: boolean;
      pointerId: number | null;
      lastX: number;
      lastY: number;
    }>({
      active: false,
      pointerId: null,
      lastX: 0,
      lastY: 0,
    });
    const prePlaySnapshotRef = useRef<TransformSnapshotItem[] | null>(null);
    const prePlayCamRef = useRef<{
      pos: THREE.Vector3;
      target: THREE.Vector3;
      wasOrtho: boolean;
    } | null>(null);
    const physicsBodiesRef = useRef<RigidBodyState[]>([]);
    const preLivePhysicsSnapshotRef = useRef<TransformSnapshotItem[] | null>(null);
    const cursorWorldRef = useRef<[number, number, number]>([0, 0, 0]);
    const fpsAccumRef = useRef<{ frames: number; lastStamp: number; fps: number }>({
      frames: 0,
      lastStamp: 0,
      fps: 60,
    });

    const mixerRef = useRef<THREE.AnimationMixer | null>(null);
    const clipsRef = useRef<THREE.AnimationClip[]>([]);
    const activeActionRef = useRef<THREE.AnimationAction | null>(null);
    const activeClipIndexRef = useRef<number>(0);
    const animPlayingRef = useRef<boolean>(false);
    const initialBoneQuatsRef = useRef<Map<string, THREE.Quaternion>>(new Map());

    const uvTexRef = useRef<THREE.CanvasTexture | null>(null);
    const matcapTexRef = useRef<THREE.CanvasTexture | null>(null);

    const isSoftwareGlRef = useRef<boolean>(false);
    const reducedMotionRef = useRef<boolean>(false);
    const needsRenderRef = useRef<boolean>(true);
    const rafIdRef = useRef<number>(0);
    const timerIdRef = useRef<number>(0);
    const wakeLoopRef = useRef<(() => void) | null>(null);
    const pendingCamTargetPosRef = useRef<THREE.Vector3 | null>(null);
    const pendingOrbitTargetRef = useRef<THREE.Vector3 | null>(null);
    const activePresetNameRef = useRef<string>('Hero 3/4');

    const propsRef = useRef({
      shadingPass,
      quadView,
      showGrid,
      overlays,
      cameraFov,
      cameraSpeed,
      autoSpin,
      exploded,
      lightingPreset,
      lightAngleDeg,
      sunElevationDeg,
      shadowsEnabled,
      wireframeOpacity,
      insideOutSide,
      surfaceParams,
      sectionCut,
      showSkeleton,
      gizmoMode,
      gizmoSpace,
      snapGrid,
      snapRotateDeg,
      snapScale,
      worldEnvPreset,
      worldFogDensity,
      worldFogHeight,
      terrainBrush,
      scatterBrush,
      physicsConfig,
      toolMode,
      dragMode,
    });
    propsRef.current = {
      shadingPass,
      quadView,
      showGrid,
      overlays,
      cameraFov,
      cameraSpeed,
      autoSpin,
      exploded,
      lightingPreset,
      lightAngleDeg,
      sunElevationDeg,
      shadowsEnabled,
      wireframeOpacity,
      insideOutSide,
      surfaceParams,
      sectionCut,
      showSkeleton,
      gizmoMode,
      gizmoSpace,
      snapGrid,
      snapRotateDeg,
      snapScale,
      worldEnvPreset,
      worldFogDensity,
      worldFogHeight,
      terrainBrush,
      scatterBrush,
      physicsConfig,
      toolMode,
      dragMode,
    };

    const requestRender = useCallback(() => {
      needsRenderRef.current = true;
      wakeLoopRef.current?.();
    }, []);

    const notifyHistory = useCallback(() => {
      onHistoryChange?.(getHistorySummary(historyRef.current));
    }, [onHistoryChange]);

    const recordUndoCommand = useCallback(
      (label: string, undo: () => void, redo: () => void) => {
        historyRef.current = pushHistoryCommand(historyRef.current, { label, undo, redo });
        notifyHistory();
      },
      [notifyHistory]
    );

    // Helper: emit scene telemetry, outliner, materials, bones, diagnostics
    const inspectActiveModel = useCallback(
      (modelName: string | null) => {
        const root = activeModelRootRef.current;
        if (!root) {
          setCaptionModelName('Point Cloud Stage');
          setCaptionSummary('Sculptural Reference');
          onTelemetryChange({
            modelName: null,
            meshCount: 0,
            boneCount: 0,
            materialCount: 0,
            vertexCount: 0,
            edgeCount: 0,
            triangleCount: 0,
            boundsSize: [0, 0, 0],
            hasAnimations: false,
          });
          onDiagnosticsChange({
            grade: 'EMPTY',
            quadPercent: 0,
            triPercent: 0,
            ngons: 0,
            nonManifoldEdges: 0,
            overlappingUvPercent: 0,
            uvMarginPx: 0,
            drawCalls: 0,
            estimatedVramMb: 0,
            manifold: true,
          });
          onOutlinerChange([]);
          onMaterialsChange([]);
          onBonesChange([]);
          onSelectedLightChange(null);
          onSelectedCameraChange(null);
          onTransformInfoChange({
            uuid: null,
            name: 'Stage',
            posX: 0,
            posY: 0,
            posZ: 0,
            rotX: 0,
            rotY: 0,
            rotZ: 0,
            scaleX: 1,
            scaleY: 1,
            scaleZ: 1,
          });
          return;
        }

        let meshCount = 0;
        let boneCount = 0;
        let vertexCount = 0;
        let triangleCount = 0;
        const matMap = new Map<string, MaterialChannelInfo>();
        const nodes: OutlinerNode[] = [];
        const bones: BoneControlInfo[] = [];

        const walk = (obj: THREE.Object3D, depth: number) => {
          if (obj.userData?.isEditorHelper) return;

          // Blender-style Studio Light container
          if (obj.userData?.studioElementType === 'light') {
            nodes.push({
              uuid: obj.uuid,
              parentUuid: obj.parent && obj.parent !== root ? obj.parent.uuid : null,
              name: obj.name || 'Light',
              type: 'Light',
              lightKind: (obj.userData.lightKind as SceneLightKind) || 'point',
              depth,
              visible: obj.visible,
              locked: lockedNodesRef.current.has(obj.uuid),
              vertices: 0,
              triangles: 0,
            });
            return;
          }

          // Blender-style Scene Camera container
          if (obj.userData?.studioElementType === 'camera') {
            nodes.push({
              uuid: obj.uuid,
              parentUuid: obj.parent && obj.parent !== root ? obj.parent.uuid : null,
              name: obj.name || 'Scene_Camera',
              type: 'Camera',
              isActiveCamera: obj.uuid === activeSceneCamUuidRef.current,
              depth,
              visible: obj.visible,
              locked: lockedNodesRef.current.has(obj.uuid),
              vertices: 0,
              triangles: 0,
            });
            return;
          }

          const isMesh = (obj as THREE.Mesh).isMesh;
          const isSkinned = (obj as THREE.SkinnedMesh).isSkinnedMesh;
          const isBone = (obj as THREE.Bone).isBone;
          const isLight = (obj as THREE.Light).isLight;
          const isGroup = obj.type === 'Group' && obj !== root;

          let verts = 0;
          let tris = 0;
          if (isMesh) {
            meshCount += 1;
            const mesh = obj as THREE.Mesh;
            const geom = mesh.geometry;
            const posAttr = geom.getAttribute('position');
            if (posAttr) {
              verts = posAttr.count;
              vertexCount += verts;
              tris = geom.index ? Math.round(geom.index.count / 3) : Math.round(posAttr.count / 3);
              triangleCount += tris;
            }
            const origMat = originalMaterialsRef.current.get(mesh) ?? mesh.material;
            const matArr = Array.isArray(origMat) ? origMat : [origMat];
            for (const m of matArr) {
              if (!m || matMap.has(m.uuid)) continue;
              const std = m as THREE.MeshStandardMaterial;
              matMap.set(m.uuid, {
                uuid: m.uuid,
                name: m.name || 'Standard BSDF',
                type: m.type,
                colorHex: std.color ? `#${std.color.getHexString()}` : '#7B7871',
                emissiveHex: std.emissive ? `#${std.emissive.getHexString()}` : '#000000',
                emissiveIntensity: typeof std.emissiveIntensity === 'number' ? std.emissiveIntensity : 0,
                metalness: typeof std.metalness === 'number' ? std.metalness : 0,
                roughness: typeof std.roughness === 'number' ? std.roughness : 0.6,
                bumpScale: typeof std.bumpScale === 'number' ? std.bumpScale : 0,
                maps: {
                  albedo: Boolean(std.map),
                  normal: Boolean(std.normalMap),
                  roughness: Boolean(std.roughnessMap),
                  metalness: Boolean(std.metalnessMap),
                  emissive: Boolean(std.emissiveMap),
                  ao: Boolean(std.aoMap),
                  bump: Boolean(std.bumpMap),
                },
              });
            }
          }

          if (isBone) {
            boneCount += 1;
            const bone = obj as THREE.Bone;
            bones.push({
              uuid: bone.uuid,
              name: bone.name || `Bone_${boneCount}`,
              rotX: THREE.MathUtils.radToDeg(bone.rotation.x),
              rotY: THREE.MathUtils.radToDeg(bone.rotation.y),
              rotZ: THREE.MathUtils.radToDeg(bone.rotation.z),
            });
          }

          if (isMesh || isBone || isGroup || isLight) {
            nodes.push({
              uuid: obj.uuid,
              parentUuid: obj.parent && obj.parent !== root ? obj.parent.uuid : null,
              name: obj.name || obj.type,
              type: isSkinned
                ? 'SkinnedMesh'
                : isMesh
                  ? 'Mesh'
                  : isBone
                    ? 'Bone'
                    : isLight
                      ? 'Light'
                      : 'Group',
              depth,
              visible: obj.visible,
              locked: lockedNodesRef.current.has(obj.uuid),
              vertices: verts,
              triangles: tris,
            });
          }

          for (const child of obj.children) {
            walk(child, depth + 1);
          }
        };

        walk(root, 0);

        const box = new THREE.Box3().setFromObject(root);
        const size = new THREE.Vector3();
        box.getSize(size);
        const edgeCount = Math.round(triangleCount * 1.5);
        const estimatedVramMb = Math.max(
          0.4,
          (vertexCount * 32 + triangleCount * 12) / (1024 * 1024) + matMap.size * 0.45
        );

        const cleanName = modelName || root.name || 'Untitled Asset';
        setCaptionModelName(cleanName);
        setCaptionSummary(`${meshCount} meshes · ${triangleCount.toLocaleString()} tris`);

        onTelemetryChange({
          modelName: cleanName,
          meshCount,
          boneCount,
          materialCount: matMap.size,
          vertexCount,
          edgeCount,
          triangleCount,
          boundsSize: [size.x, size.y, size.z],
          hasAnimations: clipsRef.current.length > 0,
        });

        onDiagnosticsChange({
          grade: triangleCount > 250_000 ? 'B' : triangleCount > 60_000 ? 'A' : 'A+',
          quadPercent: 78,
          triPercent: 22,
          ngons: 0,
          nonManifoldEdges: 0,
          overlappingUvPercent: 0.4,
          uvMarginPx: 8,
          drawCalls: meshCount,
          estimatedVramMb,
          manifold: true,
        });

        onOutlinerChange(nodes);
        onMaterialsChange(Array.from(matMap.values()));
        onBonesChange(bones);

        const targetObj = selectedNodeUuidRef.current
          ? root.getObjectByProperty('uuid', selectedNodeUuidRef.current) || root
          : root;
        const targetBox = new THREE.Box3().setFromObject(targetObj);
        const targetSize = new THREE.Vector3();
        targetBox.getSize(targetSize);
        const targetWorldPos = new THREE.Vector3();
        targetObj.getWorldPosition(targetWorldPos);

        setHudState((prev) => ({
          ...prev,
          objectCount: nodes.length,
          triangleCount,
          vertexCount,
          selectedName: targetObj === root ? null : targetObj.name || 'Object',
          selectedDimensions: [
            Number.isFinite(targetSize.x) ? targetSize.x : size.x,
            Number.isFinite(targetSize.y) ? targetSize.y : size.y,
            Number.isFinite(targetSize.z) ? targetSize.z : size.z,
          ],
          cursorPosition:
            targetObj === root
              ? cursorWorldRef.current
              : [targetWorldPos.x, targetWorldPos.y, targetWorldPos.z],
        }));

        onSelectedLightChange(extractSelectedLightInfo(targetObj));
        onSelectedCameraChange(
          extractSelectedCameraInfo(targetObj, activeSceneCamUuidRef.current, lookingThroughCamRef.current)
        );
        onTransformInfoChange({
          uuid: targetObj === root ? null : targetObj.uuid,
          name: targetObj.name || cleanName,
          posX: targetObj.position.x,
          posY: targetObj.position.y,
          posZ: targetObj.position.z,
          rotX: THREE.MathUtils.radToDeg(targetObj.rotation.x),
          rotY: THREE.MathUtils.radToDeg(targetObj.rotation.y),
          rotZ: THREE.MathUtils.radToDeg(targetObj.rotation.z),
          scaleX: targetObj.scale.x,
          scaleY: targetObj.scale.y,
          scaleZ: targetObj.scale.z,
        });
      },
      [
        onBonesChange,
        onDiagnosticsChange,
        onMaterialsChange,
        onOutlinerChange,
        onSelectedCameraChange,
        onSelectedLightChange,
        onTelemetryChange,
        onTransformInfoChange,
      ]
    );

    const registerMeshesInSubtree = useCallback((subtree: THREE.Object3D, centerRef: THREE.Vector3) => {
      subtree.traverse((obj) => {
        if (isInsideEditorElement(obj) || findStudioElementOwner(obj)) return;
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.castShadow = !isSoftwareGlRef.current;
          mesh.receiveShadow = !isSoftwareGlRef.current;
          if (!originalMaterialsRef.current.has(mesh)) {
            originalMaterialsRef.current.set(mesh, mesh.material);
          }
          explodeBasePosRef.current.set(mesh, mesh.position.clone());
          const mCenter = new THREE.Vector3();
          new THREE.Box3().setFromObject(mesh).getCenter(mCenter);
          const dir = mCenter.sub(centerRef);
          if (dir.lengthSq() < 0.0001) dir.set(0, 1, 0);
          dir.normalize();
          if (dir.y < -0.25) dir.y = -0.08;
          explodeDirRef.current.set(mesh, dir);
        }
        if ((obj as THREE.Bone).isBone && !initialBoneQuatsRef.current.has(obj.uuid)) {
          initialBoneQuatsRef.current.set(obj.uuid, obj.quaternion.clone());
        }
      });
    }, []);

    // Sync TransformControls gizmo attachment & snap config
    const syncTransformGizmo = useCallback(() => {
      const tc = transformCtrlRef.current;
      const root = activeModelRootRef.current;
      if (!tc) return;
      const {
        gizmoMode: mode,
        gizmoSpace: space,
        snapGrid: gSnap,
        snapRotateDeg: rSnap,
        snapScale: sSnap,
      } = propsRef.current;

      if (mode === 'none' || !root || lookingThroughCamRef.current || playModeActiveRef.current) {
        tc.detach();
        requestRender();
        return;
      }

      const target = selectedNodeUuidRef.current
        ? root.getObjectByProperty('uuid', selectedNodeUuidRef.current) || root
        : root;

      if (lockedNodesRef.current.has(target.uuid)) {
        tc.detach();
        requestRender();
        return;
      }

      tc.setMode(mode);
      tc.setSpace(space);
      tc.setTranslationSnap(gSnap > 0 ? gSnap : null);
      tc.setRotationSnap(rSnap > 0 ? THREE.MathUtils.degToRad(rSnap) : null);
      tc.setScaleSnap(sSnap > 0 ? sSnap : null);
      tc.attach(target);
      requestRender();
    }, [requestRender]);

    // Apply shading pass, surface override, culling, section cut, wireframe & points overlays
    const applyVisualMaterials = useCallback(() => {
      const root = activeModelRootRef.current;
      const scene = sceneRef.current;
      const renderer = rendererRef.current;
      if (!scene || !renderer) return;

      const {
        shadingPass: pass,
        surfaceParams: sp,
        insideOutSide: culling,
        sectionCut: cut,
        wireframeOpacity: wfOpacity,
      } = propsRef.current;

      renderer.localClippingEnabled = cut.enabled;
      const normalVec = new THREE.Vector3(
        cut.axis === 'x' ? 1 : 0,
        cut.axis === 'y' ? 1 : 0,
        cut.axis === 'z' ? 1 : 0
      );
      if (cut.invert) normalVec.negate();
      const radius = Math.max(0.8, modelRadiusRef.current);
      const centerComp =
        cut.axis === 'x'
          ? modelCenterRef.current.x
          : cut.axis === 'y'
            ? modelCenterRef.current.y
            : modelCenterRef.current.z;
      const worldOffset = centerComp + cut.position * radius * 1.15;
      clipPlaneRef.current.set(normalVec, cut.invert ? worldOffset : -worldOffset);

      if (clipHelperRef.current) {
        clipHelperRef.current.visible = cut.enabled && Boolean(root);
        if (cut.enabled) {
          const helper = clipHelperRef.current;
          helper.position.copy(modelCenterRef.current);
          if (cut.axis === 'x') {
            helper.position.x = worldOffset;
            helper.rotation.set(0, Math.PI / 2, 0);
          } else if (cut.axis === 'y') {
            helper.position.y = worldOffset;
            helper.rotation.set(Math.PI / 2, 0, 0);
          } else {
            helper.position.z = worldOffset;
            helper.rotation.set(0, 0, 0);
          }
          const s = radius * 1.45;
          helper.scale.set(s, s, s);
        }
      }

      if (!root) {
        requestRender();
        return;
      }

      if (wireframeGroupRef.current) {
        scene.remove(wireframeGroupRef.current);
        wireframeGroupRef.current.traverse((o) => {
          if ((o as THREE.LineSegments).isLineSegments) {
            (o as THREE.LineSegments).geometry.dispose();
            ((o as THREE.LineSegments).material as THREE.Material).dispose();
          }
        });
        wireframeGroupRef.current = null;
      }

      if (pointsOverlayRef.current) {
        scene.remove(pointsOverlayRef.current);
        pointsOverlayRef.current.traverse((o) => {
          if ((o as THREE.Points).isPoints) {
            ((o as THREE.Points).material as THREE.Material).dispose();
          }
        });
        pointsOverlayRef.current = null;
      }

      // Dispose any previously allocated temporary shading-override materials (fixes GPU memory leak)
      tempOverrideMaterialsRef.current.forEach((m) => m.dispose());
      tempOverrideMaterialsRef.current.clear();

      const trackTempMat = <T extends THREE.Material>(m: T): T => {
        tempOverrideMaterialsRef.current.add(m);
        return m;
      };

      const sideVal =
        culling === 'back'
          ? THREE.BackSide
          : culling === 'double'
            ? THREE.DoubleSide
            : THREE.FrontSide;
      const activePlanes = cut.enabled ? [clipPlaneRef.current] : [];

      if (!uvTexRef.current) uvTexRef.current = createUvCheckerTexture();
      if (!matcapTexRef.current) matcapTexRef.current = createClayMatcapTexture();

      const wfGroup = pass === 'wireframe' || wfOpacity > 0.01 ? new THREE.Group() : null;
      const ptsGroup = pass === 'points' ? new THREE.Group() : null;

      root.updateMatrixWorld(true);

      root.traverse((obj) => {
        if (isInsideEditorElement(obj) || findStudioElementOwner(obj)) return;
        if (!(obj as THREE.Mesh).isMesh) return;
        const mesh = obj as THREE.Mesh;
        const orig = originalMaterialsRef.current.get(mesh) ?? mesh.material;
        if (!originalMaterialsRef.current.has(mesh)) {
          originalMaterialsRef.current.set(mesh, orig);
        }

        if (pass === 'normal') {
          mesh.material = trackTempMat(
            new THREE.MeshNormalMaterial({
              side: sideVal,
              clippingPlanes: activePlanes,
            })
          );
        } else if (pass === 'matcap') {
          mesh.material = trackTempMat(
            new THREE.MeshMatcapMaterial({
              matcap: matcapTexRef.current,
              side: sideVal,
              clippingPlanes: activePlanes,
            })
          );
        } else if (pass === 'xray') {
          mesh.material = trackTempMat(
            new THREE.MeshStandardMaterial({
              color: '#2D5A4C',
              transparent: true,
              opacity: 0.28,
              depthWrite: false,
              roughness: 0.35,
              side: THREE.DoubleSide,
              clippingPlanes: activePlanes,
            })
          );
        } else if (pass === 'uv') {
          mesh.material = trackTempMat(
            new THREE.MeshStandardMaterial({
              map: uvTexRef.current,
              roughness: 0.65,
              side: sideVal,
              clippingPlanes: activePlanes,
            })
          );
        } else if (pass === 'roughness') {
          const origStd = (Array.isArray(orig) ? orig[0] : orig) as THREE.MeshStandardMaterial;
          const rVal = sp.overrideEnabled ? sp.roughness : origStd?.roughness ?? 0.6;
          const grey = Math.round(rVal * 255);
          mesh.material = trackTempMat(
            new THREE.MeshBasicMaterial({
              color: new THREE.Color(`rgb(${grey},${grey},${grey})`),
              side: sideVal,
              clippingPlanes: activePlanes,
            })
          );
        } else if (pass === 'albedo') {
          const origStd = (Array.isArray(orig) ? orig[0] : orig) as THREE.MeshStandardMaterial;
          mesh.material = trackTempMat(
            new THREE.MeshBasicMaterial({
              color: sp.overrideEnabled
                ? new THREE.Color(sp.baseColor)
                : origStd?.color
                  ? origStd.color.clone()
                  : new THREE.Color('#7B7871'),
              map: sp.overrideEnabled ? null : origStd?.map ?? null,
              side: sideVal,
              clippingPlanes: activePlanes,
            })
          );
        } else if (pass === 'points') {
          mesh.material = trackTempMat(
            new THREE.MeshBasicMaterial({
              color: '#D5CFC5',
              transparent: true,
              opacity: 0.12,
              depthWrite: false,
              side: sideVal,
              clippingPlanes: activePlanes,
            })
          );
          if (ptsGroup && mesh.visible) {
            const pMat = new THREE.PointsMaterial({
              color: '#2D5A4C',
              size: 0.018,
              sizeAttenuation: true,
              clippingPlanes: activePlanes,
            });
            const pts = new THREE.Points(mesh.geometry, pMat);
            pts.matrixAutoUpdate = false;
            pts.matrix.copy(mesh.matrixWorld);
            ptsGroup.add(pts);
          }
        } else if (sp.overrideEnabled) {
          mesh.material = trackTempMat(
            new THREE.MeshStandardMaterial({
              color: new THREE.Color(sp.baseColor),
              metalness: sp.metallic,
              roughness: sp.roughness,
              emissive: new THREE.Color(sp.baseColor),
              emissiveIntensity: sp.emission,
              bumpScale: sp.normalStrength * 0.012,
              side: sideVal,
              clippingPlanes: activePlanes,
            })
          );
        } else {
          mesh.material = orig;
          const mats = Array.isArray(orig) ? orig : [orig];
          for (const m of mats) {
            if (culling !== 'front') {
              m.side = sideVal;
            }
            m.clippingPlanes = activePlanes;
            m.needsUpdate = true;
          }
        }

        if (wfGroup && mesh.visible) {
          const wfAlpha = pass === 'wireframe' ? Math.max(0.45, wfOpacity) : wfOpacity;
          const edgesGeo = new THREE.EdgesGeometry(mesh.geometry, 24);
          const lineMat = new THREE.LineBasicMaterial({
            color: '#2D5A4C',
            transparent: true,
            opacity: wfAlpha,
            clippingPlanes: activePlanes,
          });
          const lines = new THREE.LineSegments(edgesGeo, lineMat);
          lines.matrixAutoUpdate = false;
          lines.matrix.copy(mesh.matrixWorld);
          wfGroup.add(lines);
        }
      });

      if (wfGroup) {
        scene.add(wfGroup);
        wireframeGroupRef.current = wfGroup;
      }
      if (ptsGroup) {
        scene.add(ptsGroup);
        pointsOverlayRef.current = ptsGroup;
      }

      requestRender();
    }, [requestRender]);

    // Sync Viewport Overlays (Axes, Model Bounding Box, UCX/Static Colliders)
    const syncViewportOverlays = useCallback(() => {
      const scene = sceneRef.current;
      const root = activeModelRootRef.current;
      if (!scene) return;
      const { overlays: ov } = propsRef.current;

      if (gridRef.current) {
        gridRef.current.visible = ov.showGrid;
      }
      if (axesHelperRef.current) {
        axesHelperRef.current.visible = ov.showAxes;
      }

      // Root / Active Model Bounding Box overlay
      if (modelBoundsHelperRef.current) {
        scene.remove(modelBoundsHelperRef.current);
        modelBoundsHelperRef.current.dispose();
        modelBoundsHelperRef.current = null;
      }
      if (ov.showBounds && root) {
        const helper = new THREE.BoxHelper(root, 0xb8863b);
        helper.userData.isEditorHelper = true;
        scene.add(helper);
        modelBoundsHelperRef.current = helper;
      }

      // Collider visualization overlay (UCX_ meshes + static physics AABBs)
      if (colliderOverlayGroupRef.current) {
        scene.remove(colliderOverlayGroupRef.current);
        colliderOverlayGroupRef.current.traverse((o) => {
          if ((o as THREE.LineSegments).isLineSegments) {
            (o as THREE.LineSegments).geometry.dispose();
            ((o as THREE.LineSegments).material as THREE.Material).dispose();
          }
        });
        colliderOverlayGroupRef.current = null;
      }

      if (root) {
        root.traverse((obj) => {
          if (obj.userData?.isColliderOverlay || (obj.name || '').toLowerCase().startsWith('ucx_')) {
            obj.visible = ov.showColliders;
          }
        });
      }

      if (ov.showColliders && root) {
        const grp = new THREE.Group();
        grp.name = '__ColliderOverlays';
        grp.userData.isEditorHelper = true;
        const colliders = collectWorldColliders(root);
        for (const c of colliders) {
          const sx = Math.max(0.05, c.maxX - c.minX);
          const sy = Math.max(0.05, c.maxY - c.minY);
          const sz = Math.max(0.05, c.maxZ - c.minZ);
          const boxGeo = new THREE.BoxGeometry(sx, sy, sz);
          const edges = new THREE.EdgesGeometry(boxGeo);
          boxGeo.dispose();
          const lines = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({
              color: c.isStatic ? '#2D5A4C' : '#C26D2D',
              transparent: true,
              opacity: 0.72,
            })
          );
          lines.position.set(
            (c.minX + c.maxX) * 0.5,
            (c.minY + c.maxY) * 0.5,
            (c.minZ + c.maxZ) * 0.5
          );
          lines.userData.isEditorHelper = true;
          grp.add(lines);
        }
        scene.add(grp);
        colliderOverlayGroupRef.current = grp;
      }

      requestRender();
    }, [requestRender]);

    // Apply lighting preset, dynamic sun azimuth + elevation, and shadows toggle
    const applyLighting = useCallback(() => {
      const key = keyLightRef.current;
      const rim = rimLightRef.current;
      const fill = fillLightRef.current;
      const hemi = hemiLightRef.current;
      const renderer = rendererRef.current;
      if (!key || !rim || !fill || !hemi || !renderer) return;

      const {
        lightingPreset: preset,
        lightAngleDeg: angleDeg,
        sunElevationDeg: elevDeg,
        shadowsEnabled: shadowsOn,
      } = propsRef.current;
      const azRad = THREE.MathUtils.degToRad(angleDeg);
      const elRad = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(elevDeg, 6, 86));
      const dist = 16;
      const horiz = Math.cos(elRad) * dist;
      const vert = Math.sin(elRad) * dist;
      key.position.set(Math.cos(azRad) * horiz, vert, Math.sin(azRad) * horiz);
      rim.position.set(-Math.cos(azRad) * horiz * 0.75, Math.max(4, vert * 0.7), -Math.sin(azRad) * horiz * 0.75);

      const allowShadows = shadowsOn && !isSoftwareGlRef.current;
      renderer.shadowMap.enabled = allowShadows;
      key.castShadow = allowShadows;

      if (preset === 'architectural') {
        key.color.set('#FFF8EB');
        key.intensity = 2.85;
        fill.color.set('#D8ECFA');
        fill.intensity = 1.15;
        rim.color.set('#FFFFFF');
        rim.intensity = 0.85;
        hemi.intensity = 0.88;
        renderer.toneMappingExposure = 1.08;
      } else if (preset === 'high-contrast') {
        key.color.set('#FFF2DF');
        key.intensity = 3.4;
        fill.color.set('#CBD4DE');
        fill.intensity = 0.45;
        rim.color.set('#DCE8E3');
        rim.intensity = 1.6;
        hemi.intensity = 0.42;
        renderer.toneMappingExposure = 1.02;
      } else if (preset === 'soft-clay') {
        key.color.set('#FFF5E8');
        key.intensity = 2.0;
        fill.color.set('#F3EEE6');
        fill.intensity = 1.3;
        rim.color.set('#EFEAE0');
        rim.intensity = 0.65;
        hemi.intensity = 1.1;
        renderer.toneMappingExposure = 1.06;
      } else {
        key.color.set('#FFF4E4');
        key.intensity = 2.65;
        fill.color.set('#DCE7F0');
        fill.intensity = 0.9;
        rim.color.set('#EDF4F1');
        rim.intensity = 1.05;
        hemi.intensity = 0.78;
        renderer.toneMappingExposure = 1.05;
      }
      requestRender();
    }, [requestRender]);

    // Apply World Environment preset, Procedural Sky Dome, and Distance / Height Fog
    const updateWorldEnvironment = useCallback(
      (preset: WorldEnvironmentPreset, fogDensity: number, fogHeight = 0) => {
        const scene = sceneRef.current;
        if (!scene) return;
        const hex = WORLD_ENV_BG[preset] || '#ECEAE4';
        scene.background = new THREE.Color(hex);
        const effDensity = Math.max(0, fogDensity + fogHeight * 0.004);
        scene.fog = effDensity > 0.0005 ? new THREE.FogExp2(hex, effDensity) : null;

        if (skyDomeRef.current) {
          const grad = WORLD_SKY_GRADIENT[preset] || WORLD_SKY_GRADIENT.alabaster;
          const showDome = preset !== 'alabaster';
          skyDomeRef.current.visible = showDome;
          const mat = skyDomeRef.current.material as THREE.ShaderMaterial;
          if (mat.uniforms) {
            mat.uniforms.uZenith.value.set(grad.zenith);
            mat.uniforms.uHorizon.value.set(grad.horizon);
            mat.uniforms.uNadir.value.set(grad.nadir);
            if (mat.uniforms.uWarmHorizon && grad.warmHorizon) {
              mat.uniforms.uWarmHorizon.value.set(grad.warmHorizon);
            }
            if (mat.uniforms.uWarmFactor) {
              mat.uniforms.uWarmFactor.value = preset === 'celestial' ? 1.0 : 0.0;
            }
          }
        }
        requestRender();
      },
      [requestRender]
    );

    const frameModel = useCallback(
      (root: THREE.Object3D, instant = false) => {
        const box = new THREE.Box3().setFromObject(root);
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        box.getCenter(center);
        box.getSize(size);

        const maxDim = Math.max(size.x, size.y, size.z, 0.8);
        const radius = maxDim * 0.62;
        modelCenterRef.current.copy(center);
        modelRadiusRef.current = radius;

        const container = containerRef.current;
        const aspect = container ? container.clientWidth / Math.max(1, container.clientHeight) : 1.5;
        const portraitBoost = aspect < 1 ? Math.min(1.85, 1.08 / Math.max(0.45, aspect)) : 1;
        const dist = Math.max(2.4, maxDim * 2.42 * portraitBoost);
        const offset = getBlenderPresetOffset('hero', dist);
        const framedCenter = new THREE.Vector3(center.x, center.y - 0.03, center.z);
        const targetPos = new THREE.Vector3(
          framedCenter.x + offset.x,
          framedCenter.y + offset.y * 0.82,
          framedCenter.z + offset.z
        );
        activePresetNameRef.current = 'Hero 3/4';

        const cam = activeCamRef.current;
        const orbit = orbitRef.current;
        if (!cam || !orbit) return;

        if (instant || isSoftwareGlRef.current || reducedMotionRef.current) {
          cam.position.copy(targetPos);
          orbit.target.copy(framedCenter);
          orbit.update();
          pendingCamTargetPosRef.current = null;
          pendingOrbitTargetRef.current = null;
        } else {
          pendingCamTargetPosRef.current = targetPos;
          pendingOrbitTargetRef.current = framedCenter;
        }
        requestRender();
      },
      [requestRender]
    );

    const disposeCurrentModel = useCallback(() => {
      const scene = sceneRef.current;
      if (!scene) return;
      transformCtrlRef.current?.detach();

      if (activeModelRootRef.current) {
        scene.remove(activeModelRootRef.current);
        activeModelRootRef.current = null;
      }
      if (activeModelDisposeRef.current) {
        activeModelDisposeRef.current();
        activeModelDisposeRef.current = null;
      }
      if (skeletonHelperRef.current) {
        scene.remove(skeletonHelperRef.current);
        skeletonHelperRef.current.dispose();
        skeletonHelperRef.current = null;
      }
      if (selectionBoxRef.current) {
        scene.remove(selectionBoxRef.current);
        selectionBoxRef.current.dispose();
        selectionBoxRef.current = null;
      }
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        mixerRef.current = null;
      }
      clipsRef.current = [];
      activeActionRef.current = null;
      animPlayingRef.current = false;
      originalMaterialsRef.current.clear();
      explodeBasePosRef.current.clear();
      explodeDirRef.current.clear();
      explodeFactorRef.current = 0;
      lockedNodesRef.current.clear();
      selectedNodeUuidRef.current = null;
      soloNodeUuidRef.current = null;
      activeSceneCamUuidRef.current = null;
      lookingThroughCamRef.current = false;
      setLookingThroughCam(false);
      initialBoneQuatsRef.current.clear();
      onSelectedNodeChange(null);
      onSoloNodeChange(null);
      onSelectedLightChange(null);
      onSelectedCameraChange(null);
      onAnimationsChange([], 0, 0);
      onAnimationTimeChange(0, false);
    }, [
      onAnimationsChange,
      onAnimationTimeChange,
      onSelectedCameraChange,
      onSelectedLightChange,
      onSelectedNodeChange,
      onSoloNodeChange,
    ]);

    const mountModelObject = useCallback(
      (
        root: THREE.Object3D,
        displayName: string,
        animations: THREE.AnimationClip[],
        disposeFn: () => void,
        instantFrame = false
      ) => {
        const scene = sceneRef.current;
        if (!scene) return;

        disposeCurrentModel();

        if (pointCloudRef.current) {
          pointCloudRef.current.group.visible = false;
        }
        const preserveWorldScale = Boolean(root.userData?.preserveWorldScale);
        if (contactShadowRef.current) {
          contactShadowRef.current.visible = !preserveWorldScale;
        }

        root.updateMatrixWorld(true);
        const rawBox = new THREE.Box3().setFromObject(root);
        const rawSize = new THREE.Vector3();
        const rawCenter = new THREE.Vector3();
        rawBox.getSize(rawSize);
        rawBox.getCenter(rawCenter);

        if (!preserveWorldScale) {
          const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z);
          if (maxDim > 8.5 || (maxDim > 0 && maxDim < 0.35)) {
            const scale = 1.65 / maxDim;
            root.scale.multiplyScalar(scale);
            root.updateMatrixWorld(true);
            rawBox.setFromObject(root);
            rawBox.getCenter(rawCenter);
          }
          root.position.x -= rawCenter.x;
          root.position.z -= rawCenter.z;
          root.position.y -= rawBox.min.y;
          root.updateMatrixWorld(true);
        }

        const modelCenter = new THREE.Vector3();
        new THREE.Box3().setFromObject(root).getCenter(modelCenter);
        registerMeshesInSubtree(root, modelCenter);

        scene.add(root);
        activeModelRootRef.current = root;
        activeModelDisposeRef.current = disposeFn;
        historyRef.current = clearHistoryStack(historyRef.current);
        notifyHistory();

        if (initialBoneQuatsRef.current.size > 0) {
          const helper = new THREE.SkeletonHelper(root);
          helper.visible = propsRef.current.showSkeleton;
          scene.add(helper);
          skeletonHelperRef.current = helper;
        }

        clipsRef.current = animations;
        if (animations.length > 0) {
          const mixer = new THREE.AnimationMixer(root);
          mixerRef.current = mixer;
          activeClipIndexRef.current = 0;
          const action = mixer.clipAction(animations[0]);
          action.play();
          action.paused = true;
          activeActionRef.current = action;
          onAnimationsChange(
            animations.map((c, idx) => ({
              index: idx,
              name: c.name || `Clip ${idx + 1}`,
              duration: c.duration,
            })),
            0,
            animations[0].duration
          );
        } else {
          onAnimationsChange([], 0, 0);
        }

        frameModel(root, instantFrame);

        applyVisualMaterials();
        syncViewportOverlays();
        inspectActiveModel(displayName);
        syncTransformGizmo();
      },
      [
        applyVisualMaterials,
        disposeCurrentModel,
        frameModel,
        inspectActiveModel,
        notifyHistory,
        onAnimationsChange,
        registerMeshesInSubtree,
        syncTransformGizmo,
        syncViewportOverlays,
      ]
    );

    const ensureWorldRoot = useCallback((): THREE.Object3D => {
      if (activeModelRootRef.current) return activeModelRootRef.current;
      const worldGroup = new THREE.Group();
      worldGroup.name = 'World_Assembly';
      worldGroup.userData.preserveWorldScale = true;
      mountModelObject(worldGroup, 'World Assembly', [], () => {}, true);
      return worldGroup;
    }, [mountModelObject]);

    const loadStarterLantern = useCallback(
      (instant = false) => {
        const renderer = rendererRef.current;
        const maxAniso = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;
        const built = createStarterLanternGroup(maxAniso);
        mountModelObject(
          built.group,
          'Stone & Cedar Lantern',
          built.animations,
          built.dispose,
          instant
        );
      },
      [mountModelObject]
    );

    const clearToPointCloud = useCallback(() => {
      disposeCurrentModel();
      if (pointCloudRef.current) {
        pointCloudRef.current.group.visible = true;
      }
      if (contactShadowRef.current) {
        contactShadowRef.current.visible = false;
      }
      modelCenterRef.current.set(0, 1.0, 0);
      modelRadiusRef.current = 1.8;
      if (activeCamRef.current && orbitRef.current) {
        activeCamRef.current.position.set(2.6, 1.9, 3.2);
        orbitRef.current.target.set(0, 1.0, 0);
        orbitRef.current.update();
      }
      applyVisualMaterials();
      inspectActiveModel(null);
      requestRender();
    }, [applyVisualMaterials, disposeCurrentModel, inspectActiveModel, requestRender]);

    const loadModelFromUrl = useCallback(
      async (url: string, displayName: string, formatHint?: string) => {
        setLoadingLabel(`Loading ${displayName}...`);
        try {
          const loaded = await loadObject3DFromUrl(url, displayName, formatHint);
          mountModelObject(loaded.root, displayName, loaded.animations, loaded.dispose);
          onNotify(`Loaded ${displayName}`);
        } finally {
          setLoadingLabel(null);
        }
      },
      [mountModelObject, onNotify]
    );

    const updateSelectionBox = useCallback(() => {
      const scene = sceneRef.current;
      const root = activeModelRootRef.current;
      if (!scene) return;
      if (selectionBoxRef.current) {
        scene.remove(selectionBoxRef.current);
        selectionBoxRef.current.dispose();
        selectionBoxRef.current = null;
      }
      if (root && selectedNodeUuidRef.current) {
        const found = root.getObjectByProperty('uuid', selectedNodeUuidRef.current);
        if (found) {
          const box = new THREE.BoxHelper(found, 0x2d5a4c);
          scene.add(box);
          selectionBoxRef.current = box;
        }
      }
      requestRender();
    }, [requestRender]);

    const selectNode = useCallback(
      (uuid: string | null) => {
        selectedNodeUuidRef.current = uuid;
        onSelectedNodeChange(uuid);
        updateSelectionBox();
        syncTransformGizmo();
        inspectActiveModel(captionModelName);
      },
      [
        captionModelName,
        inspectActiveModel,
        onSelectedNodeChange,
        syncTransformGizmo,
        updateSelectionBox,
      ]
    );

    const appendModelFromUrl = useCallback(
      async (url: string, displayName: string, formatHint?: string) => {
        setLoadingLabel(`Appending ${displayName}...`);
        try {
          const worldRoot = ensureWorldRoot();
          const loaded = await loadObject3DFromUrl(url, displayName, formatHint);
          const wrapper = new THREE.Group();
          wrapper.name = `${displayName.replace(/\.[^.]+$/, '')}_${primitiveCounterRef.current++}`;
          loaded.root.updateMatrixWorld(true);
          const rawBox = new THREE.Box3().setFromObject(loaded.root);
          const rawSize = new THREE.Vector3();
          const rawCenter = new THREE.Vector3();
          rawBox.getSize(rawSize);
          rawBox.getCenter(rawCenter);
          const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z);
          if (maxDim > 3.5 || (maxDim > 0 && maxDim < 0.25)) {
            loaded.root.scale.multiplyScalar(1.3 / maxDim);
            loaded.root.updateMatrixWorld(true);
            rawBox.setFromObject(loaded.root);
            rawBox.getCenter(rawCenter);
          }
          loaded.root.position.x -= rawCenter.x;
          loaded.root.position.z -= rawCenter.z;
          loaded.root.position.y -= rawBox.min.y;
          wrapper.add(loaded.root);
          wrapper.position.set(1.35 * ((primitiveCounterRef.current % 4) - 1), 0, 0.6);
          worldRoot.add(wrapper);
          registerMeshesInSubtree(wrapper, modelCenterRef.current);
          applyVisualMaterials();
          selectNode(wrapper.uuid);
          onNotify(`Appended ${displayName} into World`);
        } finally {
          setLoadingLabel(null);
        }
      },
      [applyVisualMaterials, ensureWorldRoot, onNotify, registerMeshesInSubtree, selectNode]
    );

    const setCameraPreset = useCallback(
      (preset: BlenderCameraPreset) => {
        const cam = activeCamRef.current;
        const orbit = orbitRef.current;
        if (!cam || !orbit) return;
        const dist = Math.max(1.5, cam.position.distanceTo(orbit.target));
        const off = getBlenderPresetOffset(preset, dist);
        const dest = new THREE.Vector3(
          orbit.target.x + off.x,
          orbit.target.y + off.y,
          orbit.target.z + off.z
        );
        const labels: Record<BlenderCameraPreset, string> = {
          front: 'Front (1)',
          back: 'Back',
          right: 'Right (3)',
          left: 'Left',
          top: 'Top (7)',
          bottom: 'Bottom',
          hero: 'Hero 3/4',
        };
        activePresetNameRef.current = labels[preset];
        setActivePresetLabel(labels[preset]);

        if (isSoftwareGlRef.current || reducedMotionRef.current) {
          cam.position.copy(dest);
          orbit.update();
          pendingCamTargetPosRef.current = null;
          pendingOrbitTargetRef.current = null;
        } else {
          pendingCamTargetPosRef.current = dest;
          pendingOrbitTargetRef.current = orbit.target.clone();
        }
        requestRender();
      },
      [requestRender]
    );

    const focusSelected = useCallback(() => {
      const root = activeModelRootRef.current;
      const cam = activeCamRef.current;
      const orbit = orbitRef.current;
      if (!root || !cam || !orbit) return;
      const target = selectedNodeUuidRef.current
        ? root.getObjectByProperty('uuid', selectedNodeUuidRef.current) || root
        : root;
      target.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(target);
      if (box.isEmpty()) return;
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z, 0.5);
      const dist = Math.max(1.4, maxDim * 2.15);
      const dir = cam.position.clone().sub(orbit.target);
      if (dir.lengthSq() < 1e-4) dir.set(0.7, 0.45, 0.8);
      dir.normalize().multiplyScalar(dist);
      const dest = center.clone().add(dir);

      if (isSoftwareGlRef.current || reducedMotionRef.current) {
        cam.position.copy(dest);
        orbit.target.copy(center);
        orbit.update();
        pendingCamTargetPosRef.current = null;
        pendingOrbitTargetRef.current = null;
      } else {
        pendingCamTargetPosRef.current = dest;
        pendingOrbitTargetRef.current = center;
      }
      onNotify(`Focused ${target.name || 'Selection'}`);
      requestRender();
    }, [onNotify, requestRender]);

    const toggleOrtho = useCallback(() => {
      const persp = perspCamRef.current;
      const ortho = orthoCamRef.current;
      const orbit = orbitRef.current;
      if (!persp || !ortho || !orbit) return;

      setIsOrtho((prev) => {
        const nextOrtho = !prev;
        const from = nextOrtho ? persp : ortho;
        const to = nextOrtho ? ortho : persp;
        to.position.copy(from.position);
        to.quaternion.copy(from.quaternion);
        if (nextOrtho && containerRef.current) {
          const dist = from.position.distanceTo(orbit.target);
          const aspect =
            containerRef.current.clientWidth / Math.max(1, containerRef.current.clientHeight);
          const halfH = Math.tan(THREE.MathUtils.degToRad(persp.fov * 0.5)) * dist;
          ortho.left = -halfH * aspect;
          ortho.right = halfH * aspect;
          ortho.top = halfH;
          ortho.bottom = -halfH;
          ortho.zoom = 1;
          ortho.updateProjectionMatrix();
        }
        activeCamRef.current = to;
        orbit.object = to;
        if (transformCtrlRef.current) {
          transformCtrlRef.current.camera = to;
        }
        orbit.update();
        requestRender();
        return nextOrtho;
      });
    }, [requestRender]);

    const zoomBy = useCallback(
      (factor: number) => {
        const cam = activeCamRef.current;
        const orbit = orbitRef.current;
        if (!cam || !orbit) return;
        if ((cam as THREE.OrthographicCamera).isOrthographicCamera) {
          const o = cam as THREE.OrthographicCamera;
          o.zoom = THREE.MathUtils.clamp(o.zoom / factor, 0.08, 18);
          o.updateProjectionMatrix();
        } else {
          const offset = cam.position.clone().sub(orbit.target);
          offset.multiplyScalar(factor);
          const len = THREE.MathUtils.clamp(offset.length(), 0.25, 450);
          offset.setLength(len);
          cam.position.copy(orbit.target).add(offset);
        }
        orbit.update();
        requestRender();
      },
      [requestRender]
    );

    const resetView = useCallback(() => {
      if (activeModelRootRef.current) {
        frameModel(activeModelRootRef.current, false);
      } else {
        setCameraPreset('hero');
      }
    }, [frameModel, setCameraPreset]);

    const withHiddenEditorHelpers = useCallback(<T,>(fn: () => T): T => {
      const hidden: Array<{ obj: THREE.Object3D; prev: boolean }> = [];
      const root = activeModelRootRef.current;
      if (root) {
        root.traverse((obj) => {
          if (obj.userData?.isEditorHelper) {
            hidden.push({ obj, prev: obj.visible });
            obj.visible = false;
          }
        });
      }
      const prevSelVis = selectionBoxRef.current?.visible ?? false;
      const prevTcVis = transformHelperRef.current?.visible ?? false;
      if (selectionBoxRef.current) selectionBoxRef.current.visible = false;
      if (transformHelperRef.current) transformHelperRef.current.visible = false;
      try {
        return fn();
      } finally {
        for (const item of hidden) {
          item.obj.visible = item.prev;
        }
        if (selectionBoxRef.current) selectionBoxRef.current.visible = prevSelVis;
        if (transformHelperRef.current) transformHelperRef.current.visible = prevTcVis;
      }
    }, []);

    const getActiveSceneCameraPair = useCallback((): {
      group: THREE.Object3D;
      camera: THREE.PerspectiveCamera;
    } | null => {
      const root = activeModelRootRef.current;
      if (!root) return null;
      let target: THREE.Object3D | undefined;
      if (activeSceneCamUuidRef.current) {
        target = root.getObjectByProperty('uuid', activeSceneCamUuidRef.current) || undefined;
      }
      if (!target || target.userData?.studioElementType !== 'camera') {
        root.traverse((obj) => {
          if (!target && obj.userData?.studioElementType === 'camera') {
            target = obj;
          }
        });
      }
      if (!target) return null;
      const cam = findChildPerspectiveCamera(target);
      if (!cam) return null;
      return { group: target, camera: cam };
    }, []);

    const captureSnapshot = useCallback(
      (download = false): string | null => {
        const renderer = rendererRef.current;
        const scene = sceneRef.current;
        const cam = activeCamRef.current;
        if (!renderer || !scene || !cam) return null;

        const dataUrl = withHiddenEditorHelpers(() => {
          renderer.setScissorTest(false);
          renderer.render(scene, cam);
          return renderer.domElement.toDataURL('image/png');
        });

        renderer.render(scene, cam);

        if (download) {
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = `blendfactory-snapshot-${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          onNotify('Downloaded studio PNG snapshot');
        }
        return dataUrl;
      },
      [onNotify, withHiddenEditorHelpers]
    );

    const captureActiveCameraSnapshot = useCallback((): string | null => {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const mainCam = activeCamRef.current;
      const pair = getActiveSceneCameraPair();
      if (!renderer || !scene || !pair) {
        return captureSnapshot(false);
      }

      const w = renderer.domElement.clientWidth || 800;
      const h = Math.max(1, renderer.domElement.clientHeight || 600);
      pair.group.updateMatrixWorld(true);
      pair.camera.aspect = w / h;
      pair.camera.updateProjectionMatrix();

      const dataUrl = withHiddenEditorHelpers(() => {
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, w, h);
        renderer.render(scene, pair.camera);
        return renderer.domElement.toDataURL('image/png');
      });

      if (mainCam && !lookingThroughCamRef.current) {
        renderer.render(scene, mainCam);
      }
      requestRender();
      return dataUrl;
    }, [captureSnapshot, getActiveSceneCameraPair, requestRender, withHiddenEditorHelpers]);

    // Captures 4 real studio angles (Hero 3/4, Front, Side, Top) without altering the user's camera!
    const captureMultiAngleScreenshots = useCallback((): CapturedScreenshot[] => {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const mainCam = activeCamRef.current;
      const root = activeModelRootRef.current;
      if (!renderer || !scene || !mainCam) return [];

      const box = root
        ? new THREE.Box3().setFromObject(root)
        : new THREE.Box3(new THREE.Vector3(-0.8, 0, -0.8), new THREE.Vector3(0.8, 1.4, 0.8));
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z, 1.0);
      const dist = maxDim * 2.25;

      const w = renderer.domElement.clientWidth || 800;
      const h = Math.max(1, renderer.domElement.clientHeight || 600);
      const snapCam = new THREE.PerspectiveCamera(40, w / h, 0.05, 120);

      const angles: Array<{
        angle: 'hero' | 'front' | 'side' | 'top';
        label: string;
        preset: BlenderCameraPreset;
      }> = [
        { angle: 'hero', label: 'Hero 3/4', preset: 'hero' },
        { angle: 'front', label: 'Front', preset: 'front' },
        { angle: 'side', label: 'Side', preset: 'right' },
        { angle: 'top', label: 'Top', preset: 'top' },
      ];

      const stamp = new Date().toISOString();
      const results = withHiddenEditorHelpers(() => {
        const list: CapturedScreenshot[] = [];
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, w, h);

        for (const item of angles) {
          const off = getBlenderPresetOffset(item.preset, dist);
          snapCam.position.set(center.x + off.x, center.y + off.y, center.z + off.z);
          snapCam.lookAt(center);
          snapCam.updateProjectionMatrix();
          renderer.render(scene, snapCam);
          list.push({
            id: `vp-${item.angle}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            angle: item.angle,
            label: item.label,
            dataUrl: renderer.domElement.toDataURL('image/png'),
            createdAt: stamp,
            isLatest: true,
            source: 'viewport',
          });
        }
        return list;
      });

      renderer.render(scene, mainCam);
      requestRender();
      return results;
    }, [requestRender, withHiddenEditorHelpers]);

    const setActiveSceneCamera = useCallback(
      (uuid: string | null) => {
        activeSceneCamUuidRef.current = uuid;
        const root = activeModelRootRef.current;
        if (root) {
          root.traverse((obj) => {
            if (obj.userData?.studioElementType === 'camera') {
              const cam = findChildPerspectiveCamera(obj);
              const isAct = obj.uuid === uuid;
              if (cam) {
                rebuildCameraFrustumHelper(obj, cam.fov, isAct);
              }
              if (isAct) {
                setActiveSceneCamLabel(obj.name || 'Scene_Camera');
                setActiveSceneCamFocalMm(
                  typeof obj.userData.focalLengthMm === 'number'
                    ? obj.userData.focalLengthMm
                    : Math.round(fovDegToFocalLengthMm(cam?.fov || 39.6))
                );
              }
            }
          });
        }
        if (!uuid && lookingThroughCamRef.current) {
          lookingThroughCamRef.current = false;
          setLookingThroughCam(false);
          if (orbitRef.current) orbitRef.current.enabled = true;
          syncTransformGizmo();
        }
        inspectActiveModel(captionModelName);
        requestRender();
      },
      [captionModelName, inspectActiveModel, requestRender, syncTransformGizmo]
    );

    const toggleLookThroughCamera = useCallback(
      (uuid?: string) => {
        const root = activeModelRootRef.current;
        if (!root) return;

        let targetUuid = uuid || activeSceneCamUuidRef.current;
        if (targetUuid) {
          const check = root.getObjectByProperty('uuid', targetUuid);
          if (!check || check.userData?.studioElementType !== 'camera') {
            targetUuid = null;
          }
        }
        if (!targetUuid) {
          const pair = getActiveSceneCameraPair();
          if (pair) targetUuid = pair.group.uuid;
        }
        if (!targetUuid) {
          onNotify('Add a Scene Camera in World tools first');
          return;
        }

        const isSwitchingToSame = targetUuid === activeSceneCamUuidRef.current;
        const nextLooking = isSwitchingToSame ? !lookingThroughCamRef.current : true;

        activeSceneCamUuidRef.current = targetUuid;
        lookingThroughCamRef.current = nextLooking;
        setLookingThroughCam(nextLooking);

        const targetObj = root.getObjectByProperty('uuid', targetUuid);
        if (targetObj) {
          setActiveSceneCamLabel(targetObj.name || 'Scene_Camera');
          const cam = findChildPerspectiveCamera(targetObj);
          setActiveSceneCamFocalMm(
            typeof targetObj.userData.focalLengthMm === 'number'
              ? targetObj.userData.focalLengthMm
              : Math.round(fovDegToFocalLengthMm(cam?.fov || 39.6))
          );
        }

        if (orbitRef.current) {
          orbitRef.current.enabled = !nextLooking;
        }
        if (nextLooking) {
          transformCtrlRef.current?.detach();
          if (selectionBoxRef.current) selectionBoxRef.current.visible = false;
          onNotify(`Looking through ${targetObj?.name || 'Scene_Camera'} (Numpad 0 to exit)`);
        } else {
          if (selectionBoxRef.current) selectionBoxRef.current.visible = true;
          syncTransformGizmo();
          onNotify('Exited Scene Camera view');
        }

        // Update frustum highlight colors across all scene cameras
        root.traverse((obj) => {
          if (obj.userData?.studioElementType === 'camera') {
            const cam = findChildPerspectiveCamera(obj);
            if (cam) rebuildCameraFrustumHelper(obj, cam.fov, obj.uuid === targetUuid);
          }
        });

        // Immediately paint the switched camera view on the same frame
        const renderer = rendererRef.current;
        const scene = sceneRef.current;
        const container = containerRef.current;
        if (renderer && scene && container) {
          const w = Math.max(1, container.clientWidth);
          const h = Math.max(1, container.clientHeight);
          renderer.setScissorTest(false);
          renderer.setViewport(0, 0, w, h);
          if (nextLooking) {
            const pair = getActiveSceneCameraPair();
            if (pair) {
              pair.group.updateMatrixWorld(true);
              pair.camera.aspect = w / h;
              pair.camera.updateProjectionMatrix();
              withHiddenEditorHelpers(() => {
                renderer.render(scene, pair.camera);
              });
            }
          } else if (activeCamRef.current) {
            renderer.render(scene, activeCamRef.current);
          }
        }

        inspectActiveModel(captionModelName);
        requestRender();
      },
      [
        captionModelName,
        getActiveSceneCameraPair,
        inspectActiveModel,
        onNotify,
        requestRender,
        syncTransformGizmo,
        withHiddenEditorHelpers,
      ]
    );

    const alignCameraToCurrentView = useCallback(
      (uuid?: string) => {
        const root = activeModelRootRef.current;
        const viewportCam = activeCamRef.current;
        if (!root || !viewportCam) return;

        let targetObj: THREE.Object3D | null = null;
        if (uuid) {
          targetObj = root.getObjectByProperty('uuid', uuid) || null;
        } else if (selectedNodeUuidRef.current) {
          const sel = root.getObjectByProperty('uuid', selectedNodeUuidRef.current);
          if (sel?.userData?.studioElementType === 'camera') targetObj = sel;
        }
        if (!targetObj) {
          const pair = getActiveSceneCameraPair();
          targetObj = pair?.group || null;
        }
        if (!targetObj || targetObj.userData?.studioElementType !== 'camera') {
          onNotify('Add or select a Scene Camera first');
          return;
        }

        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        viewportCam.getWorldPosition(worldPos);
        viewportCam.getWorldQuaternion(worldQuat);

        if (targetObj.parent) {
          targetObj.parent.updateMatrixWorld(true);
          const localPos = targetObj.parent.worldToLocal(worldPos.clone());
          const parentQuat = new THREE.Quaternion();
          targetObj.parent.getWorldQuaternion(parentQuat);
          targetObj.position.copy(localPos);
          targetObj.quaternion.copy(parentQuat.invert().multiply(worldQuat));
        } else {
          targetObj.position.copy(worldPos);
          targetObj.quaternion.copy(worldQuat);
        }
        targetObj.updateMatrixWorld(true);
        updateSelectionBox();
        inspectActiveModel(captionModelName);
        requestRender();
        onNotify(`Aligned ${targetObj.name} to current viewport view`);
      },
      [
        captionModelName,
        getActiveSceneCameraPair,
        inspectActiveModel,
        onNotify,
        requestRender,
        updateSelectionBox,
      ]
    );

    const updateLightProperties = useCallback(
      (uuid: string, patch: Partial<Omit<SelectedLightInfo, 'uuid' | 'name' | 'lightKind'>>) => {
        const root = activeModelRootRef.current;
        if (!root) return;
        const obj = root.getObjectByProperty('uuid', uuid);
        if (!obj || obj.userData?.studioElementType !== 'light') return;
        const light = findChildLight(obj);
        if (!light) return;

        if (typeof patch.color === 'string') {
          light.color.set(patch.color);
          // Sync emissive/basic bulb color inside helper meshes
          obj.traverse((child) => {
            if (child.userData?.isEditorHelper && (child as THREE.Mesh).isMesh) {
              const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
              if (mat?.color) mat.color.set(patch.color!);
            }
          });
        }
        if (typeof patch.intensity === 'number' && Number.isFinite(patch.intensity)) {
          light.intensity = Math.max(0, patch.intensity);
        }
        if (typeof patch.castShadow === 'boolean' && !isSoftwareGlRef.current) {
          if (
            (light as THREE.PointLight).isPointLight ||
            (light as THREE.SpotLight).isSpotLight ||
            (light as THREE.DirectionalLight).isDirectionalLight
          ) {
            light.castShadow = patch.castShadow;
          }
        }
        if ((light as THREE.PointLight).isPointLight) {
          const pt = light as THREE.PointLight;
          if (typeof patch.distance === 'number') pt.distance = Math.max(0, patch.distance);
          if (typeof patch.decay === 'number') pt.decay = Math.max(0, patch.decay);
        }
        if ((light as THREE.SpotLight).isSpotLight) {
          const sp = light as THREE.SpotLight;
          if (typeof patch.distance === 'number') sp.distance = Math.max(0, patch.distance);
          if (typeof patch.decay === 'number') sp.decay = Math.max(0, patch.decay);
          if (typeof patch.angleDeg === 'number') {
            sp.angle = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(patch.angleDeg, 8, 85));
            rebuildSpotLightConeHelper(obj);
          }
          if (typeof patch.penumbra === 'number') {
            sp.penumbra = THREE.MathUtils.clamp(patch.penumbra, 0, 1);
          }
        }
        if (obj.userData.lightKind === 'area') {
          const nextW =
            typeof patch.width === 'number'
              ? Math.max(0.2, patch.width)
              : (obj.userData.areaWidth as number) || 2.0;
          const nextH =
            typeof patch.height === 'number'
              ? Math.max(0.2, patch.height)
              : (obj.userData.areaHeight as number) || 1.2;
          obj.userData.areaWidth = nextW;
          obj.userData.areaHeight = nextH;
          if ((light as THREE.RectAreaLight).isRectAreaLight) {
            (light as THREE.RectAreaLight).width = nextW;
            (light as THREE.RectAreaLight).height = nextH;
          }
          rebuildAreaLightFrameHelper(obj, nextW, nextH, `#${light.color.getHexString()}`);
        }

        inspectActiveModel(captionModelName);
        requestRender();
      },
      [captionModelName, inspectActiveModel, requestRender]
    );

    const updateCameraProperties = useCallback(
      (uuid: string, patch: Partial<Pick<SelectedCameraInfo, 'focalLengthMm' | 'near' | 'far'>>) => {
        const root = activeModelRootRef.current;
        if (!root) return;
        const obj = root.getObjectByProperty('uuid', uuid);
        if (!obj || obj.userData?.studioElementType !== 'camera') return;
        const cam = findChildPerspectiveCamera(obj);
        if (!cam) return;

        if (typeof patch.focalLengthMm === 'number' && Number.isFinite(patch.focalLengthMm)) {
          const clampedMm = THREE.MathUtils.clamp(patch.focalLengthMm, 12, 250);
          obj.userData.focalLengthMm = clampedMm;
          cam.fov = focalLengthMmToFovDeg(clampedMm);
          rebuildCameraFrustumHelper(obj, cam.fov, obj.uuid === activeSceneCamUuidRef.current);
          if (obj.uuid === activeSceneCamUuidRef.current) {
            setActiveSceneCamFocalMm(Math.round(clampedMm));
          }
        }
        if (typeof patch.near === 'number' && patch.near > 0.005) {
          cam.near = patch.near;
        }
        if (typeof patch.far === 'number' && patch.far > cam.near + 0.5) {
          cam.far = patch.far;
        }
        cam.updateProjectionMatrix();
        inspectActiveModel(captionModelName);
        requestRender();
      },
      [captionModelName, inspectActiveModel, requestRender]
    );

    // Undo & Redo Actions
    const undo = useCallback(() => {
      const res = stepUndo(historyRef.current);
      historyRef.current = res.stack;
      notifyHistory();
      if (res.command) {
        updateSelectionBox();
        applyVisualMaterials();
        syncViewportOverlays();
        inspectActiveModel(captionModelName);
        syncTransformGizmo();
        requestRender();
        onNotify(`Undid: ${res.command.label}`);
      } else {
        onNotify('Nothing to undo');
      }
    }, [
      applyVisualMaterials,
      captionModelName,
      inspectActiveModel,
      notifyHistory,
      onNotify,
      requestRender,
      syncTransformGizmo,
      syncViewportOverlays,
      updateSelectionBox,
    ]);

    const redo = useCallback(() => {
      const res = stepRedo(historyRef.current);
      historyRef.current = res.stack;
      notifyHistory();
      if (res.command) {
        updateSelectionBox();
        applyVisualMaterials();
        syncViewportOverlays();
        inspectActiveModel(captionModelName);
        syncTransformGizmo();
        requestRender();
        onNotify(`Redid: ${res.command.label}`);
      } else {
        onNotify('Nothing to redo');
      }
    }, [
      applyVisualMaterials,
      captionModelName,
      inspectActiveModel,
      notifyHistory,
      onNotify,
      requestRender,
      syncTransformGizmo,
      syncViewportOverlays,
      updateSelectionBox,
    ]);

    // Blender World Assembly Operations (All tracked in Undo/Redo History)
    const addWorldPrimitive = useCallback(
      (kind: WorldPrimitiveKind) => {
        const root = ensureWorldRoot();
        const idx = primitiveCounterRef.current++;
        const obj = createWorldPrimitive(kind, idx, { isSoftwareGl: isSoftwareGlRef.current });
        if (
          root.children.length > 0 &&
          kind !== 'terrain' &&
          kind !== 'plane' &&
          kind !== 'water' &&
          kind !== 'sun-light' &&
          kind !== 'scene-camera'
        ) {
          const ring = ((idx - 1) % 6) * (Math.PI / 3);
          obj.position.x += Math.cos(ring) * 1.35;
          obj.position.z += Math.sin(ring) * 1.35;
        }
        root.add(obj);

        if (kind === 'scene-camera') {
          if (!activeSceneCamUuidRef.current) {
            activeSceneCamUuidRef.current = obj.uuid;
            setActiveSceneCamLabel(obj.name || 'Scene_Camera');
            setActiveSceneCamFocalMm(
              typeof obj.userData.focalLengthMm === 'number' ? obj.userData.focalLengthMm : 50
            );
            const cam = findChildPerspectiveCamera(obj);
            if (cam) rebuildCameraFrustumHelper(obj, cam.fov, true);
          }
        } else {
          registerMeshesInSubtree(obj, modelCenterRef.current);
        }

        const prevSelected = selectedNodeUuidRef.current;
        recordUndoCommand(
          `Add ${obj.name}`,
          () => {
            transformCtrlRef.current?.detach();
            root.remove(obj);
            selectedNodeUuidRef.current = prevSelected;
            onSelectedNodeChange(prevSelected);
          },
          () => {
            root.add(obj);
            selectedNodeUuidRef.current = obj.uuid;
            onSelectedNodeChange(obj.uuid);
          }
        );

        applyVisualMaterials();
        syncViewportOverlays();
        selectNode(obj.uuid);
        onNotify(`Added ${obj.name} to World`);
      },
      [
        applyVisualMaterials,
        ensureWorldRoot,
        onNotify,
        onSelectedNodeChange,
        recordUndoCommand,
        registerMeshesInSubtree,
        selectNode,
        syncViewportOverlays,
      ]
    );

    const duplicateSelected = useCallback(() => {
      const root = activeModelRootRef.current;
      if (!root) return;
      const target = selectedNodeUuidRef.current
        ? root.getObjectByProperty('uuid', selectedNodeUuidRef.current) || null
        : null;
      const source = target && target !== root ? target : root.children[0];
      if (!source || !source.parent) {
        onNotify('Select an object to duplicate');
        return;
      }
      const parent = source.parent;
      const clone = source.clone(true);
      clone.name = `${source.name || 'Node'}_Copy_${primitiveCounterRef.current++}`;
      clone.position.x += 0.85;
      parent.add(clone);
      registerMeshesInSubtree(clone, modelCenterRef.current);

      const prevSelected = selectedNodeUuidRef.current;
      recordUndoCommand(
        `Duplicate ${source.name}`,
        () => {
          transformCtrlRef.current?.detach();
          parent.remove(clone);
          selectedNodeUuidRef.current = prevSelected;
          onSelectedNodeChange(prevSelected);
        },
        () => {
          parent.add(clone);
          selectedNodeUuidRef.current = clone.uuid;
          onSelectedNodeChange(clone.uuid);
        }
      );

      applyVisualMaterials();
      syncViewportOverlays();
      selectNode(clone.uuid);
      onNotify(`Duplicated ${source.name}`);
    }, [
      applyVisualMaterials,
      onNotify,
      onSelectedNodeChange,
      recordUndoCommand,
      registerMeshesInSubtree,
      selectNode,
      syncViewportOverlays,
    ]);

    const deleteSelected = useCallback(() => {
      const root = activeModelRootRef.current;
      if (!root || !selectedNodeUuidRef.current) {
        onNotify('Select a child object in Outliner or Viewport to delete');
        return;
      }
      const target = root.getObjectByProperty('uuid', selectedNodeUuidRef.current);
      if (!target || target === root || !target.parent) {
        onNotify('Cannot delete root container; select a specific part');
        return;
      }
      if (lockedNodesRef.current.has(target.uuid)) {
        onNotify(`${target.name} is locked`);
        return;
      }
      const parent = target.parent;
      if (target.uuid === activeSceneCamUuidRef.current) {
        activeSceneCamUuidRef.current = null;
        if (lookingThroughCamRef.current) {
          lookingThroughCamRef.current = false;
          setLookingThroughCam(false);
          if (orbitRef.current) orbitRef.current.enabled = true;
        }
      }
      transformCtrlRef.current?.detach();
      parent.remove(target);

      recordUndoCommand(
        `Delete ${target.name}`,
        () => {
          parent.add(target);
          selectedNodeUuidRef.current = target.uuid;
          onSelectedNodeChange(target.uuid);
        },
        () => {
          transformCtrlRef.current?.detach();
          parent.remove(target);
          selectedNodeUuidRef.current = null;
          onSelectedNodeChange(null);
        }
      );

      selectNode(null);
      applyVisualMaterials();
      syncViewportOverlays();
      inspectActiveModel(captionModelName);
      onNotify(`Deleted ${target.name} (Ctrl+Z to restore)`);
    }, [
      applyVisualMaterials,
      captionModelName,
      inspectActiveModel,
      onNotify,
      onSelectedNodeChange,
      recordUndoCommand,
      selectNode,
      syncViewportOverlays,
    ]);

    // Outliner Parent/Child Grouping & Reparenting
    const groupSelectedNode = useCallback(() => {
      const root = activeModelRootRef.current;
      if (!root) return;
      const target = selectedNodeUuidRef.current
        ? root.getObjectByProperty('uuid', selectedNodeUuidRef.current) || null
        : null;
      if (!target || target === root || !target.parent) {
        // Create an empty child Group under root
        const grp = new THREE.Group();
        grp.name = `Group_${primitiveCounterRef.current++}`;
        root.add(grp);
        recordUndoCommand(
          `Create ${grp.name}`,
          () => {
            root.remove(grp);
            selectedNodeUuidRef.current = null;
            onSelectedNodeChange(null);
          },
          () => {
            root.add(grp);
            selectedNodeUuidRef.current = grp.uuid;
            onSelectedNodeChange(grp.uuid);
          }
        );
        selectNode(grp.uuid);
        onNotify(`Created ${grp.name}`);
        return;
      }
      const oldParent = target.parent;
      const grp = new THREE.Group();
      grp.name = `${target.name || 'Node'}_Group_${primitiveCounterRef.current++}`;
      oldParent.add(grp);
      grp.attach(target);

      recordUndoCommand(
        `Group ${target.name}`,
        () => {
          oldParent.attach(target);
          oldParent.remove(grp);
          selectedNodeUuidRef.current = target.uuid;
          onSelectedNodeChange(target.uuid);
        },
        () => {
          oldParent.add(grp);
          grp.attach(target);
          selectedNodeUuidRef.current = grp.uuid;
          onSelectedNodeChange(grp.uuid);
        }
      );

      selectNode(grp.uuid);
      onNotify(`Grouped ${target.name} inside ${grp.name}`);
    }, [onNotify, onSelectedNodeChange, recordUndoCommand, selectNode]);

    const reparentNode = useCallback(
      (childUuid: string, newParentUuid: string) => {
        const root = activeModelRootRef.current;
        if (!root || childUuid === newParentUuid) return;
        const child = root.getObjectByProperty('uuid', childUuid);
        const newParent = root.getObjectByProperty('uuid', newParentUuid);
        if (!child || !newParent || child === root || !child.parent) return;
        // Prevent circular parenting (cannot parent an ancestor under its own descendant)
        let walker: THREE.Object3D | null = newParent;
        while (walker) {
          if (walker === child) {
            onNotify('Cannot parent a group into its own child');
            return;
          }
          walker = walker.parent;
        }
        const oldParent = child.parent;
        if (oldParent === newParent) return;
        newParent.attach(child);

        recordUndoCommand(
          `Parent ${child.name} to ${newParent.name}`,
          () => {
            oldParent.attach(child);
          },
          () => {
            newParent.attach(child);
          }
        );
        inspectActiveModel(captionModelName);
        requestRender();
        onNotify(`Parented ${child.name} under ${newParent.name}`);
      },
      [captionModelName, inspectActiveModel, onNotify, recordUndoCommand, requestRender]
    );

    const unparentNode = useCallback(
      (uuid: string) => {
        const root = activeModelRootRef.current;
        if (!root) return;
        const child = root.getObjectByProperty('uuid', uuid);
        if (!child || child === root || !child.parent || child.parent === root) {
          onNotify('Node is already at root level');
          return;
        }
        const oldParent = child.parent;
        root.attach(child);
        recordUndoCommand(
          `Unparent ${child.name}`,
          () => {
            oldParent.attach(child);
          },
          () => {
            root.attach(child);
          }
        );
        inspectActiveModel(captionModelName);
        requestRender();
        onNotify(`Moved ${child.name} to root level`);
      },
      [captionModelName, inspectActiveModel, onNotify, recordUndoCommand, requestRender]
    );

    const mirrorSelected = useCallback(
      (axis: 'x' | 'y' | 'z') => {
        const root = activeModelRootRef.current;
        if (!root) return;
        const target = selectedNodeUuidRef.current
          ? root.getObjectByProperty('uuid', selectedNodeUuidRef.current) || root
          : root;
        const applyFlip = () => {
          if (axis === 'x') target.scale.x *= -1;
          if (axis === 'y') target.scale.y *= -1;
          if (axis === 'z') target.scale.z *= -1;
          target.updateMatrixWorld(true);
        };
        applyFlip();
        recordUndoCommand(`Mirror ${target.name} (${axis.toUpperCase()})`, applyFlip, applyFlip);
        updateSelectionBox();
        inspectActiveModel(captionModelName);
        requestRender();
        onNotify(`Mirrored ${target.name} across ${axis.toUpperCase()}`);
      },
      [captionModelName, inspectActiveModel, onNotify, recordUndoCommand, requestRender, updateSelectionBox]
    );

    const snapSelectedToGround = useCallback(() => {
      const root = activeModelRootRef.current;
      if (!root) return;
      const target = selectedNodeUuidRef.current
        ? root.getObjectByProperty('uuid', selectedNodeUuidRef.current) || root
        : root;
      target.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(target);
      if (Number.isFinite(box.min.y)) {
        const prevY = target.position.y;
        const nextY = prevY - box.min.y;
        target.position.y = nextY;
        target.updateMatrixWorld(true);
        recordUndoCommand(
          `Snap ${target.name} to Ground`,
          () => {
            target.position.y = prevY;
            target.updateMatrixWorld(true);
          },
          () => {
            target.position.y = nextY;
            target.updateMatrixWorld(true);
          }
        );
        updateSelectionBox();
        inspectActiveModel(captionModelName);
        requestRender();
        onNotify(`Snapped ${target.name} flush to Y = 0`);
      }
    }, [captionModelName, inspectActiveModel, onNotify, recordUndoCommand, requestRender, updateSelectionBox]);

    const toggleSelectedFlatShading = useCallback(() => {
      const root = activeModelRootRef.current;
      if (!root) return;
      const target = selectedNodeUuidRef.current
        ? root.getObjectByProperty('uuid', selectedNodeUuidRef.current) || root
        : root;
      let nextFlat = true;
      let toggled = 0;
      target.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          const orig = originalMaterialsRef.current.get(o as THREE.Mesh) ?? (o as THREE.Mesh).material;
          const mats = Array.isArray(orig) ? orig : [orig];
          for (const m of mats) {
            const std = m as THREE.MeshStandardMaterial;
            if (typeof std.flatShading === 'boolean') {
              if (toggled === 0) nextFlat = !std.flatShading;
              std.flatShading = nextFlat;
              std.needsUpdate = true;
              toggled += 1;
            }
          }
        }
      });
      applyVisualMaterials();
      onNotify(nextFlat ? 'Enabled Flat Faceted Shading' : 'Enabled Smooth Shading');
    }, [applyVisualMaterials, onNotify]);

    const applyArrayModifier = useCallback(
      (count: number, offset: [number, number, number]) => {
        const root = activeModelRootRef.current;
        if (!root) return;
        const target = selectedNodeUuidRef.current
          ? root.getObjectByProperty('uuid', selectedNodeUuidRef.current) || root.children[0]
          : root.children[0];
        if (!target) return;
        const arrGroup = buildArrayModifierClones(target, count, offset);
        root.add(arrGroup);
        registerMeshesInSubtree(arrGroup, modelCenterRef.current);
        recordUndoCommand(
          `Array ${count}× ${target.name}`,
          () => {
            root.remove(arrGroup);
            selectedNodeUuidRef.current = null;
            onSelectedNodeChange(null);
          },
          () => {
            root.add(arrGroup);
            selectedNodeUuidRef.current = arrGroup.uuid;
            onSelectedNodeChange(arrGroup.uuid);
          }
        );
        applyVisualMaterials();
        syncViewportOverlays();
        selectNode(arrGroup.uuid);
        onNotify(`Applied ${count}× Array Modifier`);
      },
      [
        applyVisualMaterials,
        onNotify,
        onSelectedNodeChange,
        recordUndoCommand,
        registerMeshesInSubtree,
        selectNode,
        syncViewportOverlays,
      ]
    );

    const applyScatterModifier = useCallback(
      (count: number, radius: number) => {
        const root = activeModelRootRef.current;
        if (!root) return;
        const target = selectedNodeUuidRef.current
          ? root.getObjectByProperty('uuid', selectedNodeUuidRef.current) || root.children[0]
          : root.children[0];
        if (!target) return;
        const scatterGrp = buildScatterInstances(target, count, radius, Date.now() % 99991);
        root.add(scatterGrp);
        registerMeshesInSubtree(scatterGrp, modelCenterRef.current);
        recordUndoCommand(
          `Scatter ${count}× ${target.name}`,
          () => {
            root.remove(scatterGrp);
            selectedNodeUuidRef.current = null;
            onSelectedNodeChange(null);
          },
          () => {
            root.add(scatterGrp);
            selectedNodeUuidRef.current = scatterGrp.uuid;
            onSelectedNodeChange(scatterGrp.uuid);
          }
        );
        applyVisualMaterials();
        syncViewportOverlays();
        selectNode(scatterGrp.uuid);
        onNotify(`Scattered ${count} instances within ${radius}m`);
      },
      [
        applyVisualMaterials,
        onNotify,
        onSelectedNodeChange,
        recordUndoCommand,
        registerMeshesInSubtree,
        selectNode,
        syncViewportOverlays,
      ]
    );

    // Direct PBR Material Editing (Albedo, Metalness, Roughness, Emissive, Procedural Normal/Bump)
    const editMaterial = useCallback(
      (payload: MaterialEditPayload) => {
        const root = activeModelRootRef.current;
        if (!root) return;

        const targetMats = new Set<THREE.MeshStandardMaterial>();
        const targetObj = selectedNodeUuidRef.current
          ? root.getObjectByProperty('uuid', selectedNodeUuidRef.current) || root
          : root;

        const scan = (node: THREE.Object3D) => {
          node.traverse((o) => {
            if (!(o as THREE.Mesh).isMesh || isInsideEditorElement(o)) return;
            const orig = originalMaterialsRef.current.get(o as THREE.Mesh) ?? (o as THREE.Mesh).material;
            const mats = Array.isArray(orig) ? orig : [orig];
            for (const m of mats) {
              if (!m) continue;
              if (payload.materialUuid) {
                if (m.uuid === payload.materialUuid) {
                  targetMats.add(m as THREE.MeshStandardMaterial);
                }
              } else {
                targetMats.add(m as THREE.MeshStandardMaterial);
              }
            }
          });
        };

        if (payload.materialUuid) scan(root);
        else scan(targetObj);

        if (targetMats.size === 0) {
          onNotify('No editable PBR material found on selection');
          return;
        }

        const prevStates = Array.from(targetMats).map((m) => ({
          mat: m,
          color: m.color ? m.color.clone() : new THREE.Color('#808080'),
          metalness: m.metalness ?? 0,
          roughness: m.roughness ?? 0.6,
          emissive: m.emissive ? m.emissive.clone() : new THREE.Color('#000000'),
          emissiveIntensity: m.emissiveIntensity ?? 0,
          bumpScale: m.bumpScale ?? 0,
          map: m.map ?? null,
          bumpMap: m.bumpMap ?? null,
        }));

        const generatedMaps =
          payload.proceduralPattern && payload.proceduralPattern !== 'none'
            ? createProceduralMaterialMaps(payload.proceduralPattern, payload.colorHex)
            : null;

        const applyNext = () => {
          targetMats.forEach((m) => {
            if (m.color) m.color.set(payload.colorHex);
            if (typeof m.metalness === 'number') m.metalness = payload.metalness;
            if (typeof m.roughness === 'number') m.roughness = payload.roughness;
            if (m.emissive) m.emissive.set(payload.emissiveHex || '#000000');
            if (typeof m.emissiveIntensity === 'number') m.emissiveIntensity = payload.emissiveIntensity;
            if (typeof m.bumpScale === 'number') m.bumpScale = payload.bumpScale;
            if (generatedMaps) {
              m.map = generatedMaps.map;
              m.bumpMap = generatedMaps.bump;
              m.bumpScale = Math.max(0.03, payload.bumpScale);
            } else if (payload.proceduralPattern === 'none') {
              m.map = null;
              m.bumpMap = null;
            }
            m.needsUpdate = true;
          });
        };

        const applyPrev = () => {
          for (const prev of prevStates) {
            if (prev.mat.color) prev.mat.color.copy(prev.color);
            if (typeof prev.mat.metalness === 'number') prev.mat.metalness = prev.metalness;
            if (typeof prev.mat.roughness === 'number') prev.mat.roughness = prev.roughness;
            if (prev.mat.emissive) prev.mat.emissive.copy(prev.emissive);
            if (typeof prev.mat.emissiveIntensity === 'number')
              prev.mat.emissiveIntensity = prev.emissiveIntensity;
            if (typeof prev.mat.bumpScale === 'number') prev.mat.bumpScale = prev.bumpScale;
            prev.mat.map = prev.map;
            prev.mat.bumpMap = prev.bumpMap;
            prev.mat.needsUpdate = true;
          }
        };

        applyNext();
        recordUndoCommand('Edit PBR Material', applyPrev, applyNext);
        applyVisualMaterials();
        inspectActiveModel(captionModelName);
        requestRender();
        onNotify(`Updated ${targetMats.size} PBR material${targetMats.size > 1 ? 's' : ''}`);
      },
      [
        applyVisualMaterials,
        captionModelName,
        inspectActiveModel,
        onNotify,
        recordUndoCommand,
        requestRender,
      ]
    );

    // Build dynamic rigid bodies list for Gravity / Physics Simulation
    const initDynamicRigidBodies = useCallback((root: THREE.Object3D): RigidBodyState[] => {
      const list: RigidBodyState[] = [];
      const box = new THREE.Box3();
      const size = new THREE.Vector3();
      root.updateMatrixWorld(true);

      for (const child of root.children) {
        if (
          !child.visible ||
          child.userData?.isEditorHelper ||
          child.userData?.isPlayModeAvatar ||
          child.userData?.studioElementType === 'light' ||
          child.userData?.studioElementType === 'camera' ||
          child.userData?.isTerrain ||
          child.userData?.isStaticCollider ||
          child.userData?.noCollision
        ) {
          continue;
        }
        const lower = (child.name || '').toLowerCase();
        if (
          lower.includes('terrain') ||
          lower.includes('ground') ||
          lower.includes('cliff') ||
          lower.includes('island') ||
          lower.includes('pillar') ||
          lower.includes('spire') ||
          lower.includes('citadel') ||
          lower.includes('sphere') ||
          lower.includes('cloud') ||
          lower.includes('water') ||
          lower.includes('bridge') ||
          lower.startsWith('ucx_')
        ) {
          continue;
        }
        box.setFromObject(child);
        if (box.isEmpty()) continue;
        box.getSize(size);
        if (size.x < 0.05 || size.y < 0.05 || size.z < 0.05) continue;

        list.push({
          uuid: child.uuid,
          position: { x: child.position.x, y: child.position.y, z: child.position.z },
          velocity: { x: 0, y: 0, z: 0 },
          halfExtents: { x: size.x * 0.5, y: size.y * 0.5, z: size.z * 0.5 },
          bottomOffset: Math.max(0.02, child.position.y - box.min.y),
          isStatic: false,
          sleeping: false,
        });
      }
      return list;
    }, []);

    // Unity/Unreal-Style Temporary Play Mode (Exact Pre-Play Snapshot & Restore + Animated GLB Player)
    const handlePlayVirtualKey = useCallback(
      (key: string, pressed: boolean) => {
        const norm = key.toLowerCase();
        if (pressed) {
          playKeysRef.current.add(norm);
        } else {
          playKeysRef.current.delete(norm);
        }
        requestRender();
      },
      [requestRender]
    );

    const disposePlayAvatar = useCallback((scene: THREE.Scene | null) => {
      if (playerMixerRef.current) {
        playerMixerRef.current.stopAllAction();
        playerMixerRef.current = null;
      }
      playerActionsRef.current = {};
      if (scene && playerAvatarRef.current) {
        scene.remove(playerAvatarRef.current);
        playerAvatarRef.current.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) {
            (o as THREE.Mesh).geometry.dispose();
            const m = (o as THREE.Mesh).material;
            if (Array.isArray(m)) m.forEach((x) => x.dispose());
            else if (m) m.dispose();
          }
        });
        playerAvatarRef.current = null;
      }
    }, []);

    const startPlayMode = useCallback(() => {
      const scene = sceneRef.current;
      const root = activeModelRootRef.current;
      const cam = perspCamRef.current;
      const orbit = orbitRef.current;
      if (!scene || !cam || !orbit) return;
      if (playModeActiveRef.current) return;

      const sessionId = ++playSessionIdRef.current;

      // Exit Scene Camera look-through if active
      if (lookingThroughCamRef.current) {
        lookingThroughCamRef.current = false;
        setLookingThroughCam(false);
      }

      // Snapshot exact scene & editor camera state before Play Mode modifies anything
      if (root) {
        prePlaySnapshotRef.current = captureSceneTransformSnapshot(root);
      } else {
        prePlaySnapshotRef.current = null;
      }
      prePlayCamRef.current = {
        pos: cam.position.clone(),
        target: orbit.target.clone(),
        wasOrtho: activeCamRef.current === orthoCamRef.current,
      };

      // Switch to perspective camera for gameplay
      activeCamRef.current = cam;
      setIsOrtho(false);
      orbit.enabled = false;
      transformCtrlRef.current?.detach();
      if (selectionBoxRef.current) selectionBoxRef.current.visible = false;
      if (brushCursorRef.current) brushCursorRef.current.visible = false;

      // Hide any scenic traveler stand-in while the real playable character is active
      hiddenTravelersRef.current = [];
      if (root) {
        root.traverse((o) => {
          if (o.userData?.isScenicTraveler && o.visible) {
            o.visible = false;
            hiddenTravelersRef.current.push(o);
          }
        });
      }

      // Collect colliders, walkable meshes (for exact raycast grounding), and terrains
      const colliders = root ? collectWorldColliders(root) : [];
      playCollidersRef.current = colliders;
      const walkableMeshes = root ? collectWalkableMeshes(root) : [];
      playWalkableMeshesRef.current = walkableMeshes;

      const terrains: THREE.Mesh[] = [];
      if (root) {
        root.traverse((o) => {
          if ((o as THREE.Mesh).isMesh && o.userData?.isTerrain) {
            terrains.push(o as THREE.Mesh);
          }
        });
      }
      playTerrainMeshesRef.current = terrains;
      physicsBodiesRef.current = root ? initDynamicRigidBodies(root) : [];

      const sampleSurfaceAtSpawn = (x: number, z: number, fromY: number): number | null => {
        if (walkableMeshes.length === 0) return null;
        const ray = playRaycasterRef.current;
        playRayOriginRef.current.set(x, fromY, z);
        ray.set(playRayOriginRef.current, playRayDownRef.current);
        ray.near = 0.05;
        ray.far = 16;
        const hits = ray.intersectObjects(walkableMeshes, false);
        return hits.length > 0 ? hits[0].point.y : null;
      };

      const recommended = root?.userData?.recommendedSpawn as
        | { x: number; y: number; z: number }
        | undefined;
      const safeSpawn = findSafePlayerSpawn(
        colliders,
        recommended ?? { x: 0, y: 0.1, z: 2.6 },
        sampleSurfaceAtSpawn
      );
      const pState = createPlayerState({ ...safeSpawn, yaw: 0 });
      pState.facingYaw = Math.PI;
      pState.pitch = 0.06;
      playerStateRef.current = pState;

      // Mount instant procedural avatar while async animated GLB character loads
      disposePlayAvatar(scene);
      const fallbackAvatar = createPlayerAvatarMesh();
      animatePlayerAvatar(fallbackAvatar, pState);
      fallbackAvatar.visible = playCamModeRef.current === 'third-person';
      scene.add(fallbackAvatar);
      playerAvatarRef.current = fallbackAvatar;
      playerAvatarSourceRef.current = 'procedural';

      // Asynchronously swap in the bundled free MIT-licensed rigged/animated 3D character GLB
      const gltfLoader = new GLTFLoader();
      gltfLoader
        .loadAsync('/models/player-character.glb')
        .then((gltf) => {
          if (!playModeActiveRef.current || playSessionIdRef.current !== sessionId || !sceneRef.current) {
            return;
          }
          const wrapper = new THREE.Group();
          wrapper.name = 'PlayMode_GLB_Player';
          wrapper.userData.isPlayModeAvatar = true;
          wrapper.userData.isGlbPlayerCharacter = true;
          wrapper.userData.isEditorHelper = true;
          wrapper.userData.noCollision = true;

          const model = gltf.scene;
          model.updateMatrixWorld(true);
          const rawBox = new THREE.Box3().setFromObject(model);
          const rawSize = new THREE.Vector3();
          const rawCenter = new THREE.Vector3();
          rawBox.getSize(rawSize);
          rawBox.getCenter(rawCenter);
          const targetHeight = 1.72;
          const scale = rawSize.y > 0.01 ? targetHeight / rawSize.y : 1;
          model.scale.setScalar(scale);
          // Rotate Soldier.glb (natively facing -Z) by PI so forward matches wrapper +Z
          model.rotation.y = Math.PI;
          model.updateMatrixWorld(true);
          const scaledBox = new THREE.Box3().setFromObject(model);
          const scaledCenter = new THREE.Vector3();
          scaledBox.getCenter(scaledCenter);
          model.position.x -= scaledCenter.x;
          model.position.z -= scaledCenter.z;
          model.position.y -= scaledBox.min.y;

          model.traverse((child) => {
            child.userData.isPlayModeAvatar = true;
            child.userData.isEditorHelper = true;
            child.userData.noCollision = true;
            if ((child as THREE.Mesh).isMesh) {
              const m = child as THREE.Mesh;
              m.castShadow = !isSoftwareGlRef.current && propsRef.current.shadowsEnabled;
              m.receiveShadow = !isSoftwareGlRef.current && propsRef.current.shadowsEnabled;
            }
          });

          // Ground contact shadow disc beneath feet
          const shadowDisc = new THREE.Mesh(
            new THREE.CircleGeometry(0.42, 20),
            new THREE.MeshBasicMaterial({
              color: '#0A192A',
              transparent: true,
              opacity: 0.34,
              depthWrite: false,
            })
          );
          shadowDisc.rotation.x = -Math.PI / 2;
          shadowDisc.position.y = 0.015;
          shadowDisc.userData.isEditorHelper = true;

          wrapper.add(model, shadowDisc);

          // Set up AnimationMixer with Idle, Walk, and Run clips
          const mixer = new THREE.AnimationMixer(model);
          const findClip = (needle: string) =>
            gltf.animations.find((c) => c.name.toLowerCase().includes(needle));
          const idleClip = findClip('idle') || gltf.animations[0];
          const walkClip = findClip('walk') || gltf.animations[1] || idleClip;
          const runClip = findClip('run') || walkClip || idleClip;

          const idleAction = idleClip ? mixer.clipAction(idleClip) : undefined;
          const walkAction = walkClip ? mixer.clipAction(walkClip) : undefined;
          const runAction = runClip ? mixer.clipAction(runClip) : undefined;

          if (idleAction) {
            idleAction.play();
          }

          // Replace temporary fallback avatar seamlessly
          disposePlayAvatar(sceneRef.current);
          playerMixerRef.current = mixer;
          playerActionsRef.current = {
            idle: idleAction,
            walk: walkAction,
            run: runAction,
            current: 'idle',
          };
          playerAvatarRef.current = wrapper;
          playerAvatarSourceRef.current = 'glb';
          if (playerStateRef.current) {
            animatePlayerAvatar(wrapper, playerStateRef.current);
          }
          wrapper.visible = playCamModeRef.current === 'third-person';
          sceneRef.current.add(wrapper);
          requestRender();
        })
        .catch(() => {
          // Keep procedural explorer avatar seamlessly if GLB fails to load
        });

      playKeysRef.current.clear();
      playModeActiveRef.current = true;
      const nextStatus: PlayModeStatus = {
        active: true,
        cameraMode: playCamModeRef.current,
        playerX: pState.x,
        playerY: pState.y,
        playerZ: pState.z,
        grounded: pState.grounded,
        sprinting: false,
        flying: !propsRef.current.physicsConfig.gravityEnabled,
        avatarSource: playerAvatarSourceRef.current,
      };
      setPlayModeStatus(nextStatus);
      onPlayModeChange?.(nextStatus);
      onNotify('Play Mode Active — WASD / Touch Keys · Space Jump/Fly · Drag to Look');
      requestRender();
    }, [disposePlayAvatar, initDynamicRigidBodies, onNotify, onPlayModeChange, requestRender]);

    const stopPlayMode = useCallback(() => {
      if (!playModeActiveRef.current) return;
      const scene = sceneRef.current;
      const root = activeModelRootRef.current;
      const cam = perspCamRef.current;
      const orbit = orbitRef.current;

      playSessionIdRef.current++;
      playModeActiveRef.current = false;
      playKeysRef.current.clear();
      playLookDragRef.current = { active: false, pointerId: null, lastX: 0, lastY: 0 };

      // Remove & dispose temporary player avatar & AnimationMixer
      disposePlayAvatar(scene);
      playerAvatarSourceRef.current = 'procedural';

      // Restore any hidden scenic traveler stand-ins
      for (const obj of hiddenTravelersRef.current) {
        obj.visible = true;
      }
      hiddenTravelersRef.current = [];
      playWalkableMeshesRef.current = [];

      // Restore exact pre-play scene state
      if (root && prePlaySnapshotRef.current) {
        restoreSceneTransformSnapshot(root, prePlaySnapshotRef.current);
        prePlaySnapshotRef.current = null;
      }

      // Restore exact pre-play editor camera
      if (cam && orbit && prePlayCamRef.current) {
        cam.position.copy(prePlayCamRef.current.pos);
        orbit.target.copy(prePlayCamRef.current.target);
        if (prePlayCamRef.current.wasOrtho && orthoCamRef.current) {
          orthoCamRef.current.position.copy(prePlayCamRef.current.pos);
          activeCamRef.current = orthoCamRef.current;
          orbit.object = orthoCamRef.current;
          setIsOrtho(true);
        } else {
          activeCamRef.current = cam;
          orbit.object = cam;
          setIsOrtho(false);
        }
        orbit.enabled = true;
        orbit.update();
        prePlayCamRef.current = null;
      } else if (orbit) {
        orbit.enabled = true;
      }

      if (selectionBoxRef.current) selectionBoxRef.current.visible = true;
      syncTransformGizmo();
      updateSelectionBox();
      inspectActiveModel(captionModelName);

      const nextStatus: PlayModeStatus = {
        active: false,
        cameraMode: playCamModeRef.current,
        playerX: 0,
        playerY: 0,
        playerZ: 0,
        grounded: true,
        sprinting: false,
        flying: false,
        avatarSource: 'procedural',
      };
      setPlayModeStatus(nextStatus);
      onPlayModeChange?.(nextStatus);
      onNotify('Stopped Play Mode — exact pre-play scene restored');
      requestRender();
    }, [
      captionModelName,
      disposePlayAvatar,
      inspectActiveModel,
      onNotify,
      onPlayModeChange,
      requestRender,
      syncTransformGizmo,
      updateSelectionBox,
    ]);

    const togglePlayMode = useCallback(() => {
      if (playModeActiveRef.current) stopPlayMode();
      else startPlayMode();
    }, [startPlayMode, stopPlayMode]);

    const togglePlayCameraMode = useCallback(() => {
      const next = playCamModeRef.current === 'third-person' ? 'first-person' : 'third-person';
      playCamModeRef.current = next;
      if (playerAvatarRef.current) {
        playerAvatarRef.current.visible = next === 'third-person';
      }
      setPlayModeStatus((prev) => ({ ...prev, cameraMode: next }));
      requestRender();
    }, [requestRender]);

    const resetPhysicsState = useCallback(() => {
      const root = activeModelRootRef.current;
      if (!root) return;
      if (preLivePhysicsSnapshotRef.current) {
        restoreSceneTransformSnapshot(root, preLivePhysicsSnapshotRef.current);
        preLivePhysicsSnapshotRef.current = null;
      }
      physicsBodiesRef.current = initDynamicRigidBodies(root);
      updateSelectionBox();
      inspectActiveModel(captionModelName);
      requestRender();
      onNotify('Restored pre-physics object transforms');
    }, [
      captionModelName,
      initDynamicRigidBodies,
      inspectActiveModel,
      onNotify,
      requestRender,
      updateSelectionBox,
    ]);

    // Expose imperative methods to App
    useImperativeHandle(
      ref,
      () => ({
        loadStarterLantern: () => loadStarterLantern(false),
        loadModelFromUrl,
        appendModelFromUrl,
        mountParsedGroup: (group: THREE.Group, displayName: string) => {
          mountModelObject(group, displayName, [], () => {});
        },
        clearToPointCloud,
        setCameraPreset,
        focusSelected,
        toggleOrtho,
        zoomBy,
        resetView,
        captureSnapshot,
        captureActiveCameraSnapshot,
        captureMultiAngleScreenshots,
        getActiveModelRoot: () => activeModelRootRef.current,
        selectNode,
        groupSelectedNode,
        unparentNode,
        reparentNode,
        undo,
        redo,
        startPlayMode,
        stopPlayMode,
        togglePlayMode,
        togglePlayCameraMode,
        setPlayInputKey: handlePlayVirtualKey,
        resetPhysicsState,
        setViewportToolMode: (mode: ViewportToolMode) => {
          setToolMode(mode);
          if (mode !== 'terrain-sculpt' && mode !== 'terrain-paint' && mode !== 'scatter-brush') {
            if (brushCursorRef.current) brushCursorRef.current.visible = false;
          }
          requestRender();
        },
        editMaterial,
        updateLightProperties,
        updateCameraProperties,
        setActiveSceneCamera,
        toggleLookThroughCamera,
        alignCameraToCurrentView,
        toggleNodeVisibility: (uuid: string) => {
          const root = activeModelRootRef.current;
          const node = root?.getObjectByProperty('uuid', uuid);
          if (!node) return;
          node.visible = !node.visible;
          applyVisualMaterials();
          inspectActiveModel(captionModelName);
        },
        toggleNodeLock: (uuid: string) => {
          if (lockedNodesRef.current.has(uuid)) lockedNodesRef.current.delete(uuid);
          else lockedNodesRef.current.add(uuid);
          syncTransformGizmo();
          inspectActiveModel(captionModelName);
        },
        toggleSoloNode: (uuid: string) => {
          const root = activeModelRootRef.current;
          if (!root) return;
          if (soloNodeUuidRef.current === uuid) {
            soloNodeUuidRef.current = null;
            root.traverse((o) => {
              o.visible = true;
            });
            onSoloNodeChange(null);
          } else {
            soloNodeUuidRef.current = uuid;
            const target = root.getObjectByProperty('uuid', uuid);
            const keep = new Set<THREE.Object3D>();
            if (target) {
              let p: THREE.Object3D | null = target;
              while (p) {
                keep.add(p);
                p = p.parent;
              }
              target.traverse((c) => keep.add(c));
            }
            root.traverse((o) => {
              if ((o as THREE.Mesh).isMesh) {
                o.visible = keep.has(o);
              }
            });
            onSoloNodeChange(uuid);
          }
          applyVisualMaterials();
          inspectActiveModel(captionModelName);
        },
        showAllNodes: () => {
          const root = activeModelRootRef.current;
          if (!root) return;
          soloNodeUuidRef.current = null;
          onSoloNodeChange(null);
          root.traverse((o) => {
            o.visible = true;
          });
          applyVisualMaterials();
          inspectActiveModel(captionModelName);
        },
        updateTransform: (axis, value) => {
          const root = activeModelRootRef.current;
          if (!root) return;
          const target = selectedNodeUuidRef.current
            ? root.getObjectByProperty('uuid', selectedNodeUuidRef.current) || root
            : root;
          if (lockedNodesRef.current.has(target.uuid)) {
            onNotify(`${target.name || 'Node'} is locked`);
            return;
          }
          const prevPos = target.position.clone();
          const prevRot = target.rotation.clone();
          const prevScale = target.scale.clone();

          if (axis === 'posX') target.position.x = value;
          if (axis === 'posY') target.position.y = value;
          if (axis === 'posZ') target.position.z = value;
          if (axis === 'rotX') target.rotation.x = THREE.MathUtils.degToRad(value);
          if (axis === 'rotY') target.rotation.y = THREE.MathUtils.degToRad(value);
          if (axis === 'rotZ') target.rotation.z = THREE.MathUtils.degToRad(value);
          if (axis === 'scaleX') target.scale.x = value;
          if (axis === 'scaleY') target.scale.y = value;
          if (axis === 'scaleZ') target.scale.z = value;
          target.updateMatrixWorld(true);

          const nextPos = target.position.clone();
          const nextRot = target.rotation.clone();
          const nextScale = target.scale.clone();
          recordUndoCommand(
            `Transform ${target.name} (${axis})`,
            () => {
              target.position.copy(prevPos);
              target.rotation.copy(prevRot);
              target.scale.copy(prevScale);
              target.updateMatrixWorld(true);
            },
            () => {
              target.position.copy(nextPos);
              target.rotation.copy(nextRot);
              target.scale.copy(nextScale);
              target.updateMatrixWorld(true);
            }
          );

          updateSelectionBox();
          syncViewportOverlays();
          applyVisualMaterials();
          inspectActiveModel(captionModelName);
        },
        addWorldPrimitive,
        duplicateSelected,
        deleteSelected,
        mirrorSelected,
        snapSelectedToGround,
        toggleSelectedFlatShading,
        applyArrayModifier,
        applyScatterModifier,
        updateWorldEnvironment,
        recalculateNormals: () => {
          const root = activeModelRootRef.current;
          if (!root) return;
          let count = 0;
          root.traverse((o) => {
            if ((o as THREE.Mesh).isMesh) {
              (o as THREE.Mesh).geometry.computeVertexNormals();
              count += 1;
            }
          });
          requestRender();
          onNotify(`Recalculated outward normals across ${count} meshes`);
        },
        purgeDegenerates: () => {
          const root = activeModelRootRef.current;
          if (!root) return;
          let cleaned = 0;
          root.traverse((o) => {
            if ((o as THREE.Mesh).isMesh) {
              const g = (o as THREE.Mesh).geometry;
              g.computeBoundingBox();
              g.computeBoundingSphere();
              cleaned += 1;
            }
          });
          requestRender();
          onNotify(`Verified & optimized bounds on ${cleaned} meshes`);
        },
        selectAnimationClip: (index: number) => {
          const mixer = mixerRef.current;
          const clip = clipsRef.current[index];
          if (!mixer || !clip) return;
          mixer.stopAllAction();
          activeClipIndexRef.current = index;
          const action = mixer.clipAction(clip);
          action.play();
          action.paused = !animPlayingRef.current;
          activeActionRef.current = action;
          onAnimationsChange(
            clipsRef.current.map((c, idx) => ({
              index: idx,
              name: c.name || `Clip ${idx + 1}`,
              duration: c.duration,
            })),
            index,
            clip.duration
          );
          onAnimationTimeChange(0, animPlayingRef.current);
          requestRender();
        },
        togglePlayAnimation: () => {
          const action = activeActionRef.current;
          if (!action) return;
          animPlayingRef.current = !animPlayingRef.current;
          action.paused = !animPlayingRef.current;
          onAnimationTimeChange(action.time, animPlayingRef.current);
          requestRender();
        },
        scrubAnimation: (timeSec: number) => {
          const mixer = mixerRef.current;
          const action = activeActionRef.current;
          if (!mixer || !action) return;
          animPlayingRef.current = false;
          action.paused = true;
          action.time = timeSec;
          mixer.update(0);
          onAnimationTimeChange(timeSec, false);
          requestRender();
        },
        setBoneRotation: (uuid, axis, deg) => {
          const root = activeModelRootRef.current;
          const bone = root?.getObjectByProperty('uuid', uuid) as THREE.Bone | undefined;
          if (!bone) return;
          const rad = THREE.MathUtils.degToRad(deg);
          if (axis === 'x') bone.rotation.x = rad;
          if (axis === 'y') bone.rotation.y = rad;
          if (axis === 'z') bone.rotation.z = rad;
          bone.updateMatrixWorld(true);
          inspectActiveModel(captionModelName);
          requestRender();
        },
        resetPose: () => {
          const root = activeModelRootRef.current;
          if (!root) return;
          initialBoneQuatsRef.current.forEach((quat, uuid) => {
            const bone = root.getObjectByProperty('uuid', uuid);
            if (bone) bone.quaternion.copy(quat);
          });
          if (activeActionRef.current && mixerRef.current) {
            animPlayingRef.current = false;
            activeActionRef.current.paused = true;
            activeActionRef.current.time = 0;
            mixerRef.current.update(0);
            onAnimationTimeChange(0, false);
          }
          root.updateMatrixWorld(true);
          inspectActiveModel(captionModelName);
          requestRender();
          onNotify('Reset rig pose');
        },
      }),
      [
        addWorldPrimitive,
        alignCameraToCurrentView,
        appendModelFromUrl,
        applyArrayModifier,
        applyScatterModifier,
        applyVisualMaterials,
        captionModelName,
        captureActiveCameraSnapshot,
        captureMultiAngleScreenshots,
        captureSnapshot,
        clearToPointCloud,
        deleteSelected,
        duplicateSelected,
        editMaterial,
        focusSelected,
        groupSelectedNode,
        inspectActiveModel,
        loadModelFromUrl,
        loadStarterLantern,
        mirrorSelected,
        mountModelObject,
        onAnimationTimeChange,
        onAnimationsChange,
        onNotify,
        onSoloNodeChange,
        recordUndoCommand,
        redo,
        reparentNode,
        requestRender,
        resetPhysicsState,
        resetView,
        selectNode,
        setActiveSceneCamera,
        setCameraPreset,
        setToolMode,
        snapSelectedToGround,
        startPlayMode,
        stopPlayMode,
        syncTransformGizmo,
        syncViewportOverlays,
        toggleLookThroughCamera,
        toggleOrtho,
        togglePlayCameraMode,
        togglePlayMode,
        toggleSelectedFlatShading,
        undo,
        unparentNode,
        updateCameraProperties,
        updateLightProperties,
        updateSelectionBox,
        updateWorldEnvironment,
        zoomBy,
      ]
    );

    // Main WebGL initialization lifecycle
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      reducedMotionRef.current =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      });

      const gl = renderer.getContext();
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const glRenderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
      const isSw = /SwiftShader|llvmpipe|Software|Mesa OffScreen/i.test(glRenderer);
      isSoftwareGlRef.current = isSw;
      if (!isSw) {
        RectAreaLightUniformsLib.init();
      }

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSw ? 1.5 : 2));
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.04;
      renderer.shadowMap.enabled = !isSw;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#ECEAE4');
      scene.fog = new THREE.FogExp2('#ECEAE4', 0.036);
      sceneRef.current = scene;

      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;

      const hemi = new THREE.HemisphereLight('#FFFDF8', '#D4CFC5', 0.72);
      scene.add(hemi);
      hemiLightRef.current = hemi;

      const key = new THREE.DirectionalLight('#FFF4E4', 2.6);
      key.position.set(8, 12, 8);
      if (!isSw) {
        key.castShadow = propsRef.current.shadowsEnabled;
        key.shadow.mapSize.set(2048, 2048);
        key.shadow.bias = -0.0004;
        key.shadow.camera.near = 0.5;
        key.shadow.camera.far = 90;
        key.shadow.camera.left = -26;
        key.shadow.camera.right = 26;
        key.shadow.camera.top = 26;
        key.shadow.camera.bottom = -26;
      }
      scene.add(key);
      keyLightRef.current = key;

      const fill = new THREE.DirectionalLight('#DCE7F0', 0.85);
      fill.position.set(-8, 6, 5);
      scene.add(fill);
      fillLightRef.current = fill;

      const rim = new THREE.DirectionalLight('#EDF4F1', 1.05);
      rim.position.set(-6, 8, -7);
      scene.add(rim);
      rimLightRef.current = rim;

      const floorGrid = createInfiniteFloorGrid();
      floorGrid.visible = propsRef.current.showGrid && propsRef.current.overlays.showGrid;
      scene.add(floorGrid);
      gridRef.current = floorGrid;

      const axesHelper = new THREE.AxesHelper(6);
      axesHelper.name = 'World_Axes_Helper';
      axesHelper.userData.isEditorHelper = true;
      axesHelper.visible = propsRef.current.overlays.showAxes;
      scene.add(axesHelper);
      axesHelperRef.current = axesHelper;

      const skyDome = createProceduralSkyDome();
      scene.add(skyDome);
      skyDomeRef.current = skyDome;

      const brushPts: THREE.Vector3[] = [];
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        brushPts.push(new THREE.Vector3(Math.cos(a), 0.04, Math.sin(a)));
      }
      const brushCursor = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(brushPts),
        new THREE.LineBasicMaterial({ color: '#2D5A4C', depthTest: false })
      );
      brushCursor.name = 'Terrain_Brush_Cursor';
      brushCursor.visible = false;
      brushCursor.renderOrder = 20;
      brushCursor.userData.isEditorHelper = true;
      scene.add(brushCursor);
      brushCursorRef.current = brushCursor;

      const shadowTex = createContactShadowTexture();
      const contactShadow = new THREE.Mesh(
        new THREE.PlaneGeometry(2.4, 2.4),
        new THREE.MeshBasicMaterial({
          map: shadowTex,
          transparent: true,
          depthWrite: false,
        })
      );
      contactShadow.rotation.x = -Math.PI / 2;
      contactShadow.position.y = 0.001;
      scene.add(contactShadow);
      contactShadowRef.current = contactShadow;

      const clipSquarePts = [
        new THREE.Vector3(-1, -1, 0),
        new THREE.Vector3(1, -1, 0),
        new THREE.Vector3(1, 1, 0),
        new THREE.Vector3(-1, 1, 0),
      ];
      const clipHelper = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(clipSquarePts),
        new THREE.LineBasicMaterial({ color: '#2D5A4C', transparent: true, opacity: 0.72 })
      );
      clipHelper.visible = false;
      scene.add(clipHelper);
      clipHelperRef.current = clipHelper;

      const measureGrp = new THREE.Group();
      scene.add(measureGrp);
      measureGroupRef.current = measureGrp;

      const ptArt = createPointCloudArtGroup();
      ptArt.group.visible = false;
      scene.add(ptArt.group);
      pointCloudRef.current = ptArt;

      const aspect = container.clientWidth / Math.max(1, container.clientHeight);
      const persp = new THREE.PerspectiveCamera(propsRef.current.cameraFov || 42, aspect, 0.05, 2000);
      persp.position.set(1.85, 1.35, 2.1);
      perspCamRef.current = persp;

      const ortho = new THREE.OrthographicCamera(-2 * aspect, 2 * aspect, 2, -2, 0.05, 2000);
      ortho.position.copy(persp.position);
      orthoCamRef.current = ortho;
      activeCamRef.current = persp;

      // Unbounded 3D space: full spherical orbit including below grid (Y < 0) and open-world distances
      const orbit = new OrbitControls(persp, renderer.domElement);
      orbit.enableDamping = !isSw;
      orbit.dampingFactor = 0.08;
      orbit.maxPolarAngle = Math.PI;
      orbit.minPolarAngle = 0.01;
      orbit.minDistance = 0.2;
      orbit.maxDistance = 600;
      orbit.screenSpacePanning = true;
      orbit.target.set(0, 0.68, 0);
      orbit.update();
      orbitRef.current = orbit;

      // Blender-style TransformControls (r176: must add transformControls.getHelper() to scene!)
      const tc = new TransformControls(persp, renderer.domElement);
      const tcHelper = tc.getHelper();
      scene.add(tcHelper);
      transformCtrlRef.current = tc;
      transformHelperRef.current = tcHelper;

      const onTcDragging = (ev: { value: unknown }) => {
        const dragging = Boolean(ev.value);
        orbit.enabled = !dragging && !playModeActiveRef.current;
        const target = tc.object;
        if (dragging && target) {
          tcDragStartRef.current = {
            uuid: target.uuid,
            pos: target.position.clone(),
            quat: target.quaternion.clone(),
            scale: target.scale.clone(),
          };
        } else if (!dragging && target && tcDragStartRef.current && tcDragStartRef.current.uuid === target.uuid) {
          const prev = tcDragStartRef.current;
          tcDragStartRef.current = null;
          const moved =
            prev.pos.distanceTo(target.position) > 0.0005 ||
            prev.quat.angleTo(target.quaternion) > 0.0005 ||
            prev.scale.distanceTo(target.scale) > 0.0005;
          if (moved) {
            const nextPos = target.position.clone();
            const nextQuat = target.quaternion.clone();
            const nextScale = target.scale.clone();
            recordUndoCommand(
              `Gizmo ${target.name || 'Node'}`,
              () => {
                target.position.copy(prev.pos);
                target.quaternion.copy(prev.quat);
                target.scale.copy(prev.scale);
                target.updateMatrixWorld(true);
              },
              () => {
                target.position.copy(nextPos);
                target.quaternion.copy(nextQuat);
                target.scale.copy(nextScale);
                target.updateMatrixWorld(true);
              }
            );
          }
          syncViewportOverlays();
        }
        requestRender();
      };
      const onTcObjectChange = () => {
        if (selectionBoxRef.current) selectionBoxRef.current.update();
        if (activeModelRootRef.current) {
          const target = selectedNodeUuidRef.current
            ? activeModelRootRef.current.getObjectByProperty('uuid', selectedNodeUuidRef.current) ||
              activeModelRootRef.current
            : activeModelRootRef.current;
          onTransformInfoChange({
            uuid: target === activeModelRootRef.current ? null : target.uuid,
            name: target.name || 'Object',
            posX: target.position.x,
            posY: target.position.y,
            posZ: target.position.z,
            rotX: THREE.MathUtils.radToDeg(target.rotation.x),
            rotY: THREE.MathUtils.radToDeg(target.rotation.y),
            rotZ: THREE.MathUtils.radToDeg(target.rotation.z),
            scaleX: target.scale.x,
            scaleY: target.scale.y,
            scaleZ: target.scale.z,
          });
        }
        requestRender();
      };
      tc.addEventListener('dragging-changed', onTcDragging);
      tc.addEventListener('objectChange', onTcObjectChange);
      tc.addEventListener('change', requestRender);

      const onOrbitChange = () => {
        requestRender();
      };
      orbit.addEventListener('change', onOrbitChange);

      // Auto-load featured open-source rigged character from repository on mount
      void loadModelFromUrl('/models/michelle.glb', 'Michelle', '.glb').catch(() => {
        clearToPointCloud();
      });
      applyLighting();

      const handleResize = () => {
        if (
          !containerRef.current ||
          !rendererRef.current ||
          !perspCamRef.current ||
          !orthoCamRef.current ||
          !sceneRef.current ||
          !activeCamRef.current
        )
          return;
        const w = containerRef.current.clientWidth;
        const h = Math.max(1, containerRef.current.clientHeight);
        const asp = w / h;
        rendererRef.current.setSize(w, h);
        perspCamRef.current.aspect = asp;
        perspCamRef.current.updateProjectionMatrix();
        const halfH = (orthoCamRef.current.top - orthoCamRef.current.bottom) * 0.5 || 2;
        orthoCamRef.current.left = -halfH * asp;
        orthoCamRef.current.right = halfH * asp;
        orthoCamRef.current.updateProjectionMatrix();
        rendererRef.current.setScissorTest(false);
        rendererRef.current.setViewport(0, 0, w, h);
        rendererRef.current.render(sceneRef.current, activeCamRef.current);
        drawCompass(activeCamRef.current);
        requestRender();
      };
      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(container);

      function drawCompass(cam: THREE.Camera) {
        const cvs = compassCanvasRef.current;
        if (!cvs) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const size = 72;
        if (cvs.width !== size * dpr) {
          cvs.width = size * dpr;
          cvs.height = size * dpr;
        }
        const ctx = cvs.getContext('2d');
        if (!ctx) return;
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, size, size);

        const cx = size / 2;
        const cy = size / 2;
        const r = 24;

        ctx.beginPath();
        ctx.arc(cx, cy, 33, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#E5E1DA';
        ctx.stroke();

        const invQ = cam.quaternion.clone().invert();
        const axes = [
          { label: 'X', vec: new THREE.Vector3(1, 0, 0).applyQuaternion(invQ), color: '#B54B4B' },
          { label: 'Y', vec: new THREE.Vector3(0, 1, 0).applyQuaternion(invQ), color: '#2D5A4C' },
          { label: 'Z', vec: new THREE.Vector3(0, 0, 1).applyQuaternion(invQ), color: '#436B95' },
        ].sort((a, b) => a.vec.z - b.vec.z);

        for (const ax of axes) {
          const ex = cx + ax.vec.x * r;
          const ey = cy - ax.vec.y * r;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(ex, ey);
          ctx.strokeStyle = ax.color;
          ctx.lineWidth = 1.75;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(ex, ey, 6.5, 0, Math.PI * 2);
          ctx.fillStyle = ax.color;
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.font = '600 8.5px "IBM Plex Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(ax.label, ex, ey + 0.5);
        }
        ctx.restore();
      }

      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, container.clientWidth, Math.max(1, container.clientHeight));
      renderer.render(scene, persp);
      drawCompass(persp);

      let loopScheduled = false;

      const scheduleNext = (cb: (ts: number) => void, afterGpuDraw: boolean) => {
        if (disposed || loopScheduled) return;
        loopScheduled = true;
        if (!afterGpuDraw || !isSw) {
          rafIdRef.current = requestAnimationFrame((ts) => {
            loopScheduled = false;
            cb(ts);
          });
          return;
        }
        // Software WebGL throttle: yield to main thread cleanly so automation & UI stay responsive
        const gl2 = gl as WebGL2RenderingContext;
        if (typeof gl2.fenceSync === 'function') {
          const sync = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
          if (sync) {
            gl2.flush();
            const poll = () => {
              if (disposed) {
                gl2.deleteSync(sync);
                return;
              }
              const status = gl2.clientWaitSync(sync, 0, 0);
              if (status === gl2.TIMEOUT_EXPIRED) {
                timerIdRef.current = window.setTimeout(poll, 5);
              } else {
                gl2.deleteSync(sync);
                timerIdRef.current = window.setTimeout(() => {
                  loopScheduled = false;
                  cb(performance.now());
                }, 60);
              }
            };
            timerIdRef.current = window.setTimeout(poll, 5);
            return;
          }
        }
        timerIdRef.current = window.setTimeout(() => {
          loopScheduled = false;
          cb(performance.now());
        }, 60);
      };

      const quadFront = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.05, 800);
      const quadTop = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.05, 800);
      const quadRight = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.05, 800);

      let disposed = false;
      let lastTime = performance.now();
      let lastTelemetryPush = 0;
      let lastHudPush = 0;
      fpsAccumRef.current = { frames: 0, lastStamp: performance.now(), fps: 60 };

      const tick = (now: number) => {
        if (disposed) return;
        const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;

        const cam = activeCamRef.current;
        const ctrl = orbitRef.current;
        const curProps = propsRef.current;

        let continuous = false;

        if (pointCloudRef.current?.group.visible) {
          pointCloudRef.current.update(now * 0.001);
          continuous = true;
        }

        if (curProps.autoSpin && activeModelRootRef.current && !playModeActiveRef.current) {
          activeModelRootRef.current.rotation.y += dt * 0.45;
          continuous = true;
        }

        const targetExplode = curProps.exploded ? 1 : 0;
        if (Math.abs(explodeFactorRef.current - targetExplode) > 0.002 && activeModelRootRef.current) {
          if (isSw || reducedMotionRef.current) {
            explodeFactorRef.current = targetExplode;
          } else {
            explodeFactorRef.current = THREE.MathUtils.damp(
              explodeFactorRef.current,
              targetExplode,
              8,
              dt
            );
            continuous = true;
          }
          const factor = explodeFactorRef.current;
          const spread = Math.max(0.28, modelRadiusRef.current * 0.3);
          explodeBasePosRef.current.forEach((basePos, mesh) => {
            const dir = explodeDirRef.current.get(mesh);
            if (!dir) return;
            mesh.position.copy(basePos).addScaledVector(dir, factor * spread);
          });
          if (selectionBoxRef.current) selectionBoxRef.current.update();
          needsRenderRef.current = true;
        }

        if (
          !playModeActiveRef.current &&
          pendingCamTargetPosRef.current &&
          pendingOrbitTargetRef.current &&
          cam &&
          ctrl
        ) {
          if (isSw || reducedMotionRef.current) {
            cam.position.copy(pendingCamTargetPosRef.current);
            ctrl.target.copy(pendingOrbitTargetRef.current);
            pendingCamTargetPosRef.current = null;
            pendingOrbitTargetRef.current = null;
            ctrl.update();
          } else {
            cam.position.x = THREE.MathUtils.damp(cam.position.x, pendingCamTargetPosRef.current.x, 9, dt);
            cam.position.y = THREE.MathUtils.damp(cam.position.y, pendingCamTargetPosRef.current.y, 9, dt);
            cam.position.z = THREE.MathUtils.damp(cam.position.z, pendingCamTargetPosRef.current.z, 9, dt);
            ctrl.target.x = THREE.MathUtils.damp(ctrl.target.x, pendingOrbitTargetRef.current.x, 9, dt);
            ctrl.target.y = THREE.MathUtils.damp(ctrl.target.y, pendingOrbitTargetRef.current.y, 9, dt);
            ctrl.target.z = THREE.MathUtils.damp(ctrl.target.z, pendingOrbitTargetRef.current.z, 9, dt);
            ctrl.update();
            if (
              cam.position.distanceTo(pendingCamTargetPosRef.current) < 0.015 &&
              ctrl.target.distanceTo(pendingOrbitTargetRef.current) < 0.015
            ) {
              cam.position.copy(pendingCamTargetPosRef.current);
              ctrl.target.copy(pendingOrbitTargetRef.current);
              pendingCamTargetPosRef.current = null;
              pendingOrbitTargetRef.current = null;
            } else {
              continuous = true;
            }
          }
          needsRenderRef.current = true;
        }

        // Play Mode character controller, animated GLB mixer, mesh-surface grounding & follow camera
        if (playModeActiveRef.current && playerStateRef.current && perspCamRef.current) {
          const keys = playKeysRef.current;
          const forward =
            (keys.has('w') || keys.has('arrowup') ? 1 : 0) -
            (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
          const right =
            (keys.has('d') || keys.has('arrowright') ? 1 : 0) -
            (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
          const jump = keys.has(' ');
          const sprint = keys.has('shift');
          const descend = keys.has('c') || keys.has('control');

          const terrainSampler = (x: number, z: number): number | null => {
            let bestY: number | null = null;
            for (const tm of playTerrainMeshesRef.current) {
              const h = sampleTerrainHeightAt(tm, x, z);
              if (h !== null && (bestY === null || h > bestY)) {
                bestY = h;
              }
            }
            return bestY;
          };

          const surfaceSampler = (x: number, z: number, fromY: number): number | null => {
            const meshes = playWalkableMeshesRef.current;
            if (meshes.length === 0) return null;
            const ray = playRaycasterRef.current;
            playRayOriginRef.current.set(x, fromY, z);
            ray.set(playRayOriginRef.current, playRayDownRef.current);
            ray.near = 0.02;
            ray.far = 14;
            const hits = ray.intersectObjects(meshes, false);
            return hits.length > 0 ? hits[0].point.y : null;
          };

          const phys = curProps.physicsConfig;

          stepPlayerController(
            playerStateRef.current,
            { forward, right, jump, sprint, descend },
            playCollidersRef.current,
            dt,
            {
              gravityEnabled: phys.gravityEnabled,
              gravityStrength: phys.gravityStrength,
              floorY: null,
              voidRespawnY: -20,
              sampleTerrainY: terrainSampler,
              sampleSurfaceY: surfaceSampler,
            }
          );

          const st = playerStateRef.current;
          if (st.respawnedThisStep) {
            onNotify('Respawned on island overlook');
          }

          // Drive GLB skeletal character animations (Idle / Walk / Run cross-fade)
          if (playerMixerRef.current) {
            const horizSpeed = Math.hypot(st.vx, st.vz);
            const targetAnim: 'idle' | 'walk' | 'run' =
              horizSpeed > 5.4 ? 'run' : horizSpeed > 0.35 ? 'walk' : 'idle';
            const actions = playerActionsRef.current;
            if (actions.current !== targetAnim) {
              const nextAction = actions[targetAnim] || actions.idle;
              const prevAction = actions.current ? actions[actions.current] : undefined;
              if (nextAction && nextAction !== prevAction) {
                nextAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
                if (prevAction) {
                  prevAction.crossFadeTo(nextAction, 0.18, true);
                }
              }
              actions.current = targetAnim;
            }
            playerMixerRef.current.update(dt);
          }

          const avatar = playerAvatarRef.current;
          if (avatar) {
            avatar.visible = playCamModeRef.current === 'third-person';
            animatePlayerAvatar(avatar, st);
          }

          const pCam = perspCamRef.current;
          const eyeTarget = new THREE.Vector3(st.x, st.y + 1.48, st.z);
          if (playCamModeRef.current === 'first-person') {
            pCam.position.copy(eyeTarget);
            const lookDir = new THREE.Vector3(
              -Math.sin(st.yaw) * Math.cos(st.pitch),
              Math.sin(st.pitch),
              -Math.cos(st.yaw) * Math.cos(st.pitch)
            );
            pCam.lookAt(eyeTarget.clone().add(lookDir));
          } else {
            const camDist = 5.1;
            const horiz = Math.cos(st.pitch) * camDist;
            const camPos = new THREE.Vector3(
              eyeTarget.x + Math.sin(st.yaw) * horiz,
              eyeTarget.y - Math.sin(st.pitch) * camDist + 0.85,
              eyeTarget.z + Math.cos(st.yaw) * horiz
            );
            const lookAhead = new THREE.Vector3(
              eyeTarget.x - Math.sin(st.yaw) * 4.0,
              eyeTarget.y + Math.sin(st.pitch) * 3.0 + 0.35,
              eyeTarget.z - Math.cos(st.yaw) * 4.0
            );
            pCam.position.copy(camPos);
            pCam.lookAt(lookAhead);
          }

          if (now - lastHudPush > 140) {
            const nextStatus: PlayModeStatus = {
              active: true,
              cameraMode: playCamModeRef.current,
              playerX: st.x,
              playerY: st.y,
              playerZ: st.z,
              grounded: st.grounded,
              sprinting: sprint && (forward !== 0 || right !== 0),
              flying: !phys.gravityEnabled,
              avatarSource: playerAvatarSourceRef.current,
            };
            setPlayModeStatus(nextStatus);
            onPlayModeChange?.(nextStatus);
          }

          continuous = true;
          needsRenderRef.current = true;
        }

        // Rigid-body gravity & stacking simulation (Play Mode or Live Editor Simulation)
        if (
          curProps.physicsConfig.gravityEnabled &&
          (playModeActiveRef.current || curProps.physicsConfig.liveSimulation) &&
          physicsBodiesRef.current.length > 0
        ) {
          stepRigidBodies(physicsBodiesRef.current, playCollidersRef.current, dt, {
            gravity: curProps.physicsConfig.gravityStrength,
            floorY: 0,
            restitution: 0.22,
          });
          const root = activeModelRootRef.current;
          if (root) {
            for (const body of physicsBodiesRef.current) {
              const obj = root.getObjectByProperty('uuid', body.uuid);
              if (obj) {
                obj.position.set(body.position.x, body.position.y, body.position.z);
              }
            }
          }
          if (selectionBoxRef.current) selectionBoxRef.current.update();
          needsRenderRef.current = true;
          continuous = true;
        }

        if (mixerRef.current && animPlayingRef.current && activeActionRef.current) {
          mixerRef.current.update(dt);
          if (now - lastTelemetryPush > 120) {
            onAnimationTimeChange(activeActionRef.current.time, true);
          }
          continuous = true;
          needsRenderRef.current = true;
        }

        if (ctrl && ctrl.enableDamping && !playModeActiveRef.current) {
          const moved = ctrl.update();
          if (moved) needsRenderRef.current = true;
        }

        if ((needsRenderRef.current || continuous) && cam && ctrl) {
          needsRenderRef.current = false;
          const w = container.clientWidth;
          const h = Math.max(1, container.clientHeight);

          if (skyDomeRef.current) {
            skyDomeRef.current.position.copy(cam.position);
          }

          if (curProps.quadView && !playModeActiveRef.current) {
            const hw = Math.floor(w / 2);
            const hh = Math.floor(h / 2);
            const qAsp = hw / Math.max(1, hh);
            const span = Math.max(1.2, modelRadiusRef.current * 1.6);
            const c = modelCenterRef.current;

            renderer.setScissorTest(true);

            quadTop.left = -span * qAsp;
            quadTop.right = span * qAsp;
            quadTop.top = span;
            quadTop.bottom = -span;
            quadTop.position.set(c.x, c.y + Math.max(8, span * 3), c.z + 0.001);
            quadTop.lookAt(c);
            quadTop.updateProjectionMatrix();
            renderer.setViewport(0, hh, hw, h - hh);
            renderer.setScissor(0, hh, hw, h - hh);
            renderer.render(scene, quadTop);

            renderer.setViewport(hw, hh, w - hw, h - hh);
            renderer.setScissor(hw, hh, w - hw, h - hh);
            renderer.render(scene, cam);

            quadFront.left = -span * qAsp;
            quadFront.right = span * qAsp;
            quadFront.top = span;
            quadFront.bottom = -span;
            quadFront.position.set(c.x, c.y, c.z + Math.max(8, span * 3));
            quadFront.lookAt(c);
            quadFront.updateProjectionMatrix();
            renderer.setViewport(0, 0, hw, hh);
            renderer.setScissor(0, 0, hw, hh);
            renderer.render(scene, quadFront);

            quadRight.left = -span * qAsp;
            quadRight.right = span * qAsp;
            quadRight.top = span;
            quadRight.bottom = -span;
            quadRight.position.set(c.x + Math.max(8, span * 3), c.y, c.z);
            quadRight.lookAt(c);
            quadRight.updateProjectionMatrix();
            renderer.setViewport(hw, 0, w - hw, hh);
            renderer.setScissor(hw, 0, w - hw, hh);
            renderer.render(scene, quadRight);

            renderer.setScissorTest(false);
          } else if (lookingThroughCamRef.current && !playModeActiveRef.current) {
            const pair = getActiveSceneCameraPair();
            if (pair) {
              pair.group.updateMatrixWorld(true);
              pair.camera.aspect = w / h;
              pair.camera.updateProjectionMatrix();
              withHiddenEditorHelpers(() => {
                renderer.setScissorTest(false);
                renderer.setViewport(0, 0, w, h);
                renderer.render(scene, pair.camera);
              });
            } else {
              renderer.setScissorTest(false);
              renderer.setViewport(0, 0, w, h);
              renderer.render(scene, cam);
            }
          } else {
            renderer.setScissorTest(false);
            renderer.setViewport(0, 0, w, h);
            renderer.render(scene, cam);
          }

          drawCompass(cam);

          // FPS & HUD update
          fpsAccumRef.current.frames += 1;
          const elapsed = now - fpsAccumRef.current.lastStamp;
          if (elapsed >= 500) {
            const measuredFps = Math.min(144, Math.max(1, Math.round((fpsAccumRef.current.frames * 1000) / elapsed)));
            fpsAccumRef.current.fps = measuredFps;
            fpsAccumRef.current.frames = 0;
            fpsAccumRef.current.lastStamp = now;
            setHudState((prev) => ({
              ...prev,
              fps: measuredFps,
              cursorPosition: cursorWorldRef.current,
            }));
          }

          if (now - lastTelemetryPush > 180) {
            lastTelemetryPush = now;
            lastHudPush = now;
            const offset = cam.position.clone().sub(ctrl.target);
            const r = offset.length() || 1;
            const pitchDeg = Math.round(
              THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(offset.y / r, -1, 1)))
            );
            const yawDeg = Math.round(THREE.MathUtils.radToDeg(Math.atan2(offset.x, offset.z)));
            onCameraTelemetryChange({
              x: cam.position.x,
              y: cam.position.y,
              z: cam.position.z,
              pitchDeg,
              yawDeg,
              isOrtho: (cam as THREE.OrthographicCamera).isOrthographicCamera,
              fov: (cam as THREE.PerspectiveCamera).fov || 42,
              activePreset: activePresetNameRef.current,
            });
          }

          if (continuous || needsRenderRef.current) {
            scheduleNext(tick, true);
          }
        } else if (continuous) {
          scheduleNext(tick, false);
        }
      };

      wakeLoopRef.current = () => {
        if (!disposed) {
          scheduleNext(tick, false);
        }
      };

      scheduleNext(tick, false);

      return () => {
        disposed = true;
        wakeLoopRef.current = null;
        cancelAnimationFrame(rafIdRef.current);
        window.clearTimeout(timerIdRef.current);
        resizeObserver.disconnect();
        tc.removeEventListener('dragging-changed', onTcDragging);
        tc.removeEventListener('objectChange', onTcObjectChange);
        tc.removeEventListener('change', requestRender);
        tc.dispose();
        orbit.removeEventListener('change', onOrbitChange);
        orbit.dispose();
        disposeCurrentModel();
        tempOverrideMaterialsRef.current.forEach((m) => m.dispose());
        tempOverrideMaterialsRef.current.clear();
        ptArt.dispose();
        floorGrid.geometry.dispose();
        (floorGrid.material as THREE.Material).dispose();
        axesHelper.geometry.dispose();
        (axesHelper.material as THREE.Material).dispose();
        skyDome.geometry.dispose();
        (skyDome.material as THREE.Material).dispose();
        brushCursor.geometry.dispose();
        (brushCursor.material as THREE.Material).dispose();
        contactShadow.geometry.dispose();
        (contactShadow.material as THREE.Material).dispose();
        shadowTex.dispose();
        clipHelper.geometry.dispose();
        (clipHelper.material as THREE.Material).dispose();
        uvTexRef.current?.dispose();
        matcapTexRef.current?.dispose();
        envTex.dispose();
        pmrem.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement);
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // React to visual prop changes
    useEffect(() => {
      syncViewportOverlays();
    }, [showGrid, overlays, syncViewportOverlays]);

    useEffect(() => {
      if (perspCamRef.current) {
        perspCamRef.current.fov = cameraFov;
        perspCamRef.current.updateProjectionMatrix();
        requestRender();
      }
    }, [cameraFov, requestRender]);

    useEffect(() => {
      if (orbitRef.current) {
        orbitRef.current.rotateSpeed = 0.85 * cameraSpeed;
        orbitRef.current.zoomSpeed = 1.0 * cameraSpeed;
        orbitRef.current.panSpeed = 0.85 * cameraSpeed;
      }
    }, [cameraSpeed]);

    useEffect(() => {
      if (skeletonHelperRef.current) {
        skeletonHelperRef.current.visible = showSkeleton;
        requestRender();
      }
    }, [showSkeleton, requestRender]);

    useEffect(() => {
      applyVisualMaterials();
    }, [shadingPass, surfaceParams, insideOutSide, sectionCut, wireframeOpacity, applyVisualMaterials]);

    useEffect(() => {
      applyLighting();
    }, [lightingPreset, lightAngleDeg, sunElevationDeg, shadowsEnabled, applyLighting]);

    useEffect(() => {
      syncTransformGizmo();
    }, [gizmoMode, gizmoSpace, snapGrid, snapRotateDeg, snapScale, syncTransformGizmo]);

    useEffect(() => {
      updateWorldEnvironment(worldEnvPreset, worldFogDensity, worldFogHeight);
    }, [worldEnvPreset, worldFogDensity, worldFogHeight, updateWorldEnvironment]);

    useEffect(() => {
      requestRender();
    }, [quadView, autoSpin, exploded, requestRender]);

    // Live Editor Physics Simulation toggle (outside Play Mode)
    useEffect(() => {
      if (playModeActiveRef.current) return;
      const root = activeModelRootRef.current;
      if (physicsConfig.liveSimulation && physicsConfig.gravityEnabled && root) {
        if (!preLivePhysicsSnapshotRef.current) {
          preLivePhysicsSnapshotRef.current = captureSceneTransformSnapshot(root);
        }
        playCollidersRef.current = collectWorldColliders(root);
        physicsBodiesRef.current = initDynamicRigidBodies(root);
        requestRender();
      } else if (preLivePhysicsSnapshotRef.current && root) {
        restoreSceneTransformSnapshot(root, preLivePhysicsSnapshotRef.current);
        preLivePhysicsSnapshotRef.current = null;
        physicsBodiesRef.current = [];
        updateSelectionBox();
        inspectActiveModel(captionModelName);
        requestRender();
      }
    }, [
      physicsConfig.liveSimulation,
      physicsConfig.gravityEnabled,
      initDynamicRigidBodies,
      updateSelectionBox,
      inspectActiveModel,
      captionModelName,
      requestRender,
    ]);

    useEffect(() => {
      const orbit = orbitRef.current;
      if (!orbit) return;
      const isBrushTool =
        toolMode === 'terrain-sculpt' || toolMode === 'terrain-paint' || toolMode === 'scatter-brush';
      orbit.enabled = !playModeActiveRef.current && !isBrushTool;
      if (dragMode === 'pan') {
        orbit.mouseButtons.LEFT = THREE.MOUSE.PAN;
      } else if (dragMode === 'zoom') {
        orbit.mouseButtons.LEFT = THREE.MOUSE.DOLLY;
      } else {
        orbit.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
      }
      if (!isBrushTool && brushCursorRef.current) {
        brushCursorRef.current.visible = false;
        requestRender();
      }
    }, [dragMode, toolMode, requestRender]);

    // Keyboard shortcuts: Undo/Redo + Play Mode + Focus (F) + Blender Numpad + Gizmos (G/R/S) + Shift+D + Delete + WASD/QE + H
    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        const lower = e.key.toLowerCase();

        // Undo / Redo (Ctrl+Z / Cmd+Z / Ctrl+Y / Cmd+Shift+Z)
        if ((e.ctrlKey || e.metaKey) && lower === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
          return;
        }
        if ((e.ctrlKey || e.metaKey) && (lower === 'y' || (lower === 'z' && e.shiftKey))) {
          e.preventDefault();
          redo();
          return;
        }

        // Play Mode keyboard handling
        if (playModeActiveRef.current) {
          if (e.key === 'Escape') {
            e.preventDefault();
            stopPlayMode();
            return;
          }
          if (lower === 'v') {
            e.preventDefault();
            togglePlayCameraMode();
            return;
          }
          const normKey = e.code === 'Space' ? ' ' : lower;
          if (
            [
              'w',
              'a',
              's',
              'd',
              ' ',
              'shift',
              'c',
              'control',
              'arrowup',
              'arrowdown',
              'arrowleft',
              'arrowright',
            ].includes(normKey)
          ) {
            if (normKey === ' ' || normKey.startsWith('arrow')) e.preventDefault();
            playKeysRef.current.add(normKey);
            requestRender();
            return;
          }
          return;
        }

        if (lower === 'h' && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          setControlsHidden((prev) => !prev);
          return;
        }
        if (lower === 'f' && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          focusSelected();
          return;
        }
        if (lower === 'g' && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          onGizmoModeChange(propsRef.current.gizmoMode === 'translate' ? 'none' : 'translate');
          return;
        }
        if (lower === 'r' && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          onGizmoModeChange(propsRef.current.gizmoMode === 'rotate' ? 'none' : 'rotate');
          return;
        }
        if (lower === 'd' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          duplicateSelected();
          return;
        }
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeUuidRef.current) {
          e.preventDefault();
          deleteSelected();
          return;
        }
        if (lower === 's' && propsRef.current.gizmoMode !== 'none' && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          onGizmoModeChange(propsRef.current.gizmoMode === 'scale' ? 'none' : 'scale');
          return;
        }
        if (e.key === 'Escape') {
          if (lookingThroughCamRef.current) {
            e.preventDefault();
            toggleLookThroughCamera();
            return;
          }
          if (propsRef.current.toolMode !== 'orbit') {
            setToolMode('orbit');
            if (brushCursorRef.current) brushCursorRef.current.visible = false;
            requestRender();
            return;
          }
        }

        if (e.code === 'Numpad1') {
          e.preventDefault();
          setCameraPreset(e.ctrlKey ? 'back' : 'front');
        } else if (e.code === 'Numpad3') {
          e.preventDefault();
          setCameraPreset(e.ctrlKey ? 'left' : 'right');
        } else if (e.code === 'Numpad7') {
          e.preventDefault();
          setCameraPreset(e.ctrlKey ? 'bottom' : 'top');
        } else if (e.code === 'Numpad5') {
          e.preventDefault();
          toggleOrtho();
        } else if (e.code === 'Numpad0') {
          e.preventDefault();
          if (e.ctrlKey && e.altKey) {
            alignCameraToCurrentView();
          } else if (getActiveSceneCameraPair()) {
            toggleLookThroughCamera();
          } else {
            resetView();
          }
        } else if (e.code === 'NumpadDecimal') {
          e.preventDefault();
          focusSelected();
        } else if (
          e.code === 'Numpad4' ||
          e.code === 'Numpad6' ||
          e.code === 'Numpad8' ||
          e.code === 'Numpad2' ||
          e.code === 'Numpad9'
        ) {
          e.preventDefault();
          const cam = activeCamRef.current;
          const orbit = orbitRef.current;
          if (!cam || !orbit) return;
          const off = cam.position.clone().sub(orbit.target);
          if (e.code === 'Numpad9') {
            cam.position.copy(orbit.target).sub(off);
          } else {
            const dir =
              e.code === 'Numpad4'
                ? 'left'
                : e.code === 'Numpad6'
                  ? 'right'
                  : e.code === 'Numpad8'
                    ? 'up'
                    : 'down';
            const next = applyBlenderOrbitStep({ x: off.x, y: off.y, z: off.z }, dir, 15);
            cam.position.set(orbit.target.x + next.x, orbit.target.y + next.y, orbit.target.z + next.z);
          }
          orbit.update();
          requestRender();
        } else if (['w', 'a', 's', 'd', 'q', 'e'].includes(lower) && !e.metaKey && !e.ctrlKey) {
          const cam = activeCamRef.current;
          const orbit = orbitRef.current;
          if (!cam || !orbit) return;
          const step = Math.max(0.14, modelRadiusRef.current * 0.05) * (propsRef.current.cameraSpeed || 1);
          const forward = new THREE.Vector3();
          cam.getWorldDirection(forward);
          const right = new THREE.Vector3().crossVectors(forward, cam.up).normalize();
          const delta = new THREE.Vector3();
          if (lower === 'w') delta.addScaledVector(forward, step);
          if (lower === 's') delta.addScaledVector(forward, -step);
          if (lower === 'd') delta.addScaledVector(right, step);
          if (lower === 'a') delta.addScaledVector(right, -step);
          if (lower === 'e') delta.y += step;
          if (lower === 'q') delta.y -= step;
          cam.position.add(delta);
          orbit.target.add(delta);
          orbit.update();
          requestRender();
        }
      };

      const onKeyUp = (e: KeyboardEvent) => {
        const normKey = e.code === 'Space' ? ' ' : e.key.toLowerCase();
        playKeysRef.current.delete(normKey);
      };

      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      return () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
      };
    }, [
      alignCameraToCurrentView,
      deleteSelected,
      duplicateSelected,
      focusSelected,
      getActiveSceneCameraPair,
      onGizmoModeChange,
      redo,
      requestRender,
      resetView,
      setCameraPreset,
      setToolMode,
      stopPlayMode,
      toggleLookThroughCamera,
      toggleOrtho,
      togglePlayCameraMode,
      undo,
    ]);

    // Helper: raycast active model or Y=0 ground plane for brushes & cursor coordinates
    const raycastStagePoint = (clientX: number, clientY: number) => {
      const renderer = rendererRef.current;
      const cam = activeCamRef.current;
      const root = activeModelRootRef.current;
      if (!renderer || !cam) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(ndc, cam);
      const hits = root ? raycaster.intersectObject(root, true).filter((h) => !h.object.userData?.isEditorHelper) : [];
      if (hits.length > 0) {
        return { hit: hits[0], point: hits[0].point.clone(), normal: hits[0].face?.normal?.clone() || new THREE.Vector3(0, 1, 0) };
      }
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const planePt = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(groundPlane, planePt)) {
        return { hit: null, point: planePt, normal: new THREE.Vector3(0, 1, 0) };
      }
      return null;
    };

    const findTerrainHitMesh = (hitObj: THREE.Object3D | null): THREE.Mesh | null => {
      if (
        hitObj &&
        (hitObj as THREE.Mesh).isMesh &&
        (hitObj.userData?.isTerrain || hitObj.userData?.isTerrainMesh)
      ) {
        return hitObj as THREE.Mesh;
      }
      const root = activeModelRootRef.current;
      if (!root) return null;
      let fallback: THREE.Mesh | null = null;
      root.traverse((o) => {
        if (
          !fallback &&
          (o as THREE.Mesh).isMesh &&
          (o.userData?.isTerrain || o.userData?.isTerrainMesh)
        ) {
          fallback = o as THREE.Mesh;
        }
      });
      return fallback;
    };

    const applyBrushAtPoint = (point: THREE.Vector3, hitObj: THREE.Object3D | null, mode: ViewportToolMode) => {
      if (mode === 'terrain-sculpt' || mode === 'terrain-paint') {
        const terrainMesh = brushStrokeRef.current.targetMesh || findTerrainHitMesh(hitObj);
        if (!terrainMesh) return;
        if (!brushStrokeRef.current.targetMesh) {
          brushStrokeRef.current.targetMesh = terrainMesh;
          brushStrokeRef.current.beforeSnapshot = captureTerrainSnapshot(terrainMesh);
        }
        const cfg = propsRef.current.terrainBrush;
        if (mode === 'terrain-sculpt') {
          applyTerrainSculptBrush(terrainMesh, point, {
            mode: cfg.mode,
            radius: cfg.radius,
            strength: cfg.strength,
            flattenTargetY: cfg.flattenTargetY,
          });
        } else {
          applyTerrainPaintBrush(terrainMesh, point, {
            layer: cfg.paintLayer,
            radius: cfg.radius,
            strength: cfg.strength,
          });
        }
        requestRender();
      } else if (mode === 'scatter-brush') {
        const root = activeModelRootRef.current;
        if (!root) return;
        const cfg = propsRef.current.scatterBrush;
        const lastPos = brushStrokeRef.current.lastScatterPos;
        const minStep = Math.max(0.4, cfg.radius * 0.45);
        if (lastPos && lastPos.distanceTo(point) < minStep) return;
        brushStrokeRef.current.lastScatterPos = point.clone();

        const count = Math.max(1, Math.min(6, Math.round(cfg.density)));
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.sqrt(Math.random()) * cfg.radius;
          const px = point.x + Math.cos(angle) * dist;
          const pz = point.z + Math.sin(angle) * dist;
          let py = point.y;
          const terrainMesh = findTerrainHitMesh(hitObj);
          if (terrainMesh) {
            const sampled = sampleTerrainHeightAt(terrainMesh, px, pz);
            if (sampled !== null) py = sampled;
          }
          const scale = cfg.minScale + Math.random() * Math.max(0.05, cfg.maxScale - cfg.minScale);
          const prop = createScatterBrushProp(cfg.preset, primitiveCounterRef.current++);
          prop.position.set(px, py, pz);
          prop.rotation.y = Math.random() * Math.PI * 2;
          prop.scale.setScalar(scale);
          root.add(prop);
          prop.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              originalMaterialsRef.current.set(child as THREE.Mesh, (child as THREE.Mesh).material);
            }
          });
          brushStrokeRef.current.createdProps.push(prop);
        }
        requestRender();
      }
    };

    const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;

      if (playModeActiveRef.current) {
        playLookDragRef.current = {
          active: true,
          pointerId: e.pointerId,
          lastX: e.clientX,
          lastY: e.clientY,
        };
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Ignore pointer capture errors
        }
        return;
      }

      const mode = propsRef.current.toolMode;
      if (mode === 'terrain-sculpt' || mode === 'terrain-paint' || mode === 'scatter-brush') {
        const res = raycastStagePoint(e.clientX, e.clientY);
        if (!res) return;
        if ((mode === 'terrain-sculpt' || mode === 'terrain-paint') && !findTerrainHitMesh(res.hit?.object || null)) {
          onNotify('Spawn a Terrain mesh from the World tab to sculpt or paint');
          return;
        }
        brushStrokeRef.current = {
          active: true,
          mode,
          targetMesh: null,
          beforeSnapshot: null,
          createdProps: [],
          lastScatterPos: null,
        };
        applyBrushAtPoint(res.point, res.hit?.object || null, mode);
      }
    };

    const handleCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (playModeActiveRef.current) {
        if (
          playLookDragRef.current.active &&
          (playLookDragRef.current.pointerId === null ||
            playLookDragRef.current.pointerId === e.pointerId) &&
          playerStateRef.current
        ) {
          const dx = e.clientX - playLookDragRef.current.lastX;
          const dy = e.clientY - playLookDragRef.current.lastY;
          playLookDragRef.current.lastX = e.clientX;
          playLookDragRef.current.lastY = e.clientY;
          playerStateRef.current.yaw -= dx * 0.0055;
          playerStateRef.current.pitch = THREE.MathUtils.clamp(
            playerStateRef.current.pitch - dy * 0.0045,
            -1.15,
            0.95
          );
          requestRender();
        }
        return;
      }

      const mode = propsRef.current.toolMode;
      const isBrush = mode === 'terrain-sculpt' || mode === 'terrain-paint' || mode === 'scatter-brush';
      const res = raycastStagePoint(e.clientX, e.clientY);
      if (res) {
        cursorWorldRef.current = [res.point.x, res.point.y, res.point.z];
        if (isBrush && brushCursorRef.current) {
          const radius =
            mode === 'scatter-brush'
              ? propsRef.current.scatterBrush.radius
              : propsRef.current.terrainBrush.radius;
          brushCursorRef.current.visible = true;
          brushCursorRef.current.position.copy(res.point);
          brushCursorRef.current.scale.set(radius, 1, radius);
          requestRender();
        }
        if (brushStrokeRef.current.active) {
          applyBrushAtPoint(res.point, res.hit?.object || null, brushStrokeRef.current.mode);
        }
      }
    };

    // Canvas click for Raycast Select, 2-Point Measure Tape, and Brush Stroke Commit
    const handleCanvasPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      if (playModeActiveRef.current) {
        if (
          playLookDragRef.current.pointerId === null ||
          playLookDragRef.current.pointerId === e.pointerId
        ) {
          playLookDragRef.current = { active: false, pointerId: null, lastX: 0, lastY: 0 };
        }
        return;
      }

      if (brushStrokeRef.current.active) {
        const stroke = brushStrokeRef.current;
        brushStrokeRef.current = {
          active: false,
          mode: 'orbit',
          targetMesh: null,
          beforeSnapshot: null,
          createdProps: [],
          lastScatterPos: null,
        };
        if ((stroke.mode === 'terrain-sculpt' || stroke.mode === 'terrain-paint') && stroke.targetMesh && stroke.beforeSnapshot) {
          const mesh = stroke.targetMesh;
          const before = stroke.beforeSnapshot;
          const after = captureTerrainSnapshot(mesh);
          recordUndoCommand(
            stroke.mode === 'terrain-sculpt' ? 'Terrain Sculpt Stroke' : 'Terrain Paint Stroke',
            () => restoreTerrainSnapshot(mesh, before),
            () => restoreTerrainSnapshot(mesh, after)
          );
          inspectActiveModel(captionModelName);
        } else if (stroke.mode === 'scatter-brush' && stroke.createdProps.length > 0 && activeModelRootRef.current) {
          const root = activeModelRootRef.current;
          const added = [...stroke.createdProps];
          recordUndoCommand(
            `Scatter Brush (${added.length} props)`,
            () => {
              added.forEach((p) => root.remove(p));
            },
            () => {
              added.forEach((p) => root.add(p));
            }
          );
          applyVisualMaterials();
          inspectActiveModel(captionModelName);
          onNotify(`Scattered ${added.length} props`);
        }
        return;
      }

      const mode = propsRef.current.toolMode;
      if (mode !== 'select' && mode !== 'measure') return;
      if (e.button !== 0) return;

      const renderer = rendererRef.current;
      const cam = activeCamRef.current;
      const root = activeModelRootRef.current;
      if (!renderer || !cam || !root) return;

      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(ndc, cam);
      const hits = raycaster.intersectObject(root, true);

      if (mode === 'select') {
        if (hits.length > 0) {
          const hitObj = hits[0].object;
          const studioOwner = findStudioElementOwner(hitObj);
          const resolved = studioOwner || hitObj;
          selectNode(resolved.uuid);
          onNotify(`Selected ${resolved.name || resolved.type}`);
        } else {
          selectNode(null);
        }
        return;
      }

      if (mode === 'measure' && hits.length > 0 && measureGroupRef.current) {
        const pt = hits[0].point.clone();
        const grp = measureGroupRef.current;
        if (measurePointsRef.current.length >= 2) {
          measurePointsRef.current = [];
          while (grp.children.length > 0) {
            const child = grp.children[0];
            grp.remove(child);
            if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
            const mat = (child as THREE.Mesh).material;
            if (mat && !Array.isArray(mat)) mat.dispose();
          }
          setMeasuredDistance(null);
        }
        measurePointsRef.current.push(pt);
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(0.025, 16, 16),
          new THREE.MeshBasicMaterial({ color: '#2D5A4C' })
        );
        marker.position.copy(pt);
        grp.add(marker);

        if (measurePointsRef.current.length === 2) {
          const [a, b] = measurePointsRef.current;
          const lineGeo = new THREE.BufferGeometry().setFromPoints([a, b]);
          const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: '#2D5A4C' }));
          grp.add(line);
          const dist = a.distanceTo(b);
          setMeasuredDistance(dist);
          onNotify(`Measured ${dist.toFixed(3)} m`);
        }
        requestRender();
      }
    };

    const clearMeasurements = () => {
      measurePointsRef.current = [];
      if (measureGroupRef.current) {
        while (measureGroupRef.current.children.length > 0) {
          const child = measureGroupRef.current.children[0];
          measureGroupRef.current.remove(child);
          if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
          const mat = (child as THREE.Mesh).material;
          if (mat && !Array.isArray(mat)) mat.dispose();
        }
      }
      setMeasuredDistance(null);
      requestRender();
    };

    const activeShadingLabel = useMemo(
      () => SHADING_OPTIONS.find((s) => s.id === shadingPass)?.label || 'Combined PBR',
      [shadingPass]
    );

    const handleCompassClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      if (Math.abs(x) < 10 && Math.abs(y) < 10) {
        setCameraPreset('hero');
      } else if (Math.abs(x) > Math.abs(y)) {
        setCameraPreset(x > 0 ? 'right' : 'left');
      } else {
        setCameraPreset(y < 0 ? 'top' : 'front');
      }
    };

    return (
      <div className="relative h-full w-full overflow-hidden bg-[#ECEAE4]">
        {/* WebGL Canvas Host */}
        <div
          ref={containerRef}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          className={`h-full w-full ${
            playModeStatus.active
              ? 'cursor-grab active:cursor-grabbing'
              : toolMode === 'measure' ||
                  toolMode === 'select' ||
                  toolMode === 'terrain-sculpt' ||
                  toolMode === 'terrain-paint' ||
                  toolMode === 'scatter-brush'
                ? 'cursor-crosshair'
                : dragMode === 'pan'
                  ? 'cursor-grab'
                  : 'cursor-default'
          }`}
        />

        {/* Theme-Consistent Multi-Angle Bar, Overlays, Telemetry HUD & Mobile Play Mode Controls */}
        <ViewportHud
          hud={hudState}
          activePreset={activePresetLabel}
          autoSpin={autoSpin}
          overlays={overlays}
          playMode={playModeStatus}
          zenMode={controlsHidden}
          inspectorOpen={inspectorOpen}
          gravityEnabled={physicsConfig.gravityEnabled}
          gravityStrength={physicsConfig.gravityStrength}
          onCameraPreset={setCameraPreset}
          onFocusSelected={focusSelected}
          onToggleAutoSpin={onToggleAutoSpin}
          onToggleOverlay={onToggleOverlay}
          onStopPlayMode={stopPlayMode}
          onTogglePlayCameraMode={togglePlayCameraMode}
          onCycleGravityMode={onCycleGravityMode}
          onPlayVirtualKey={handlePlayVirtualKey}
        />

        {/* Quad-View subtle divider crosshairs & labels */}
        {quadView && (
          <div className="pointer-events-none absolute inset-0 z-10">
            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-[#D6D0C6]" />
            <div className="absolute right-0 left-0 top-1/2 h-px bg-[#D6D0C6]" />
            <span className="absolute top-16 left-4 font-mono text-[10px] font-medium text-[#6E6960] uppercase">
              Top Ortho
            </span>
            <span className="absolute top-16 left-[calc(50%+12px)] font-mono text-[10px] font-medium text-[#6E6960] uppercase">
              Perspective
            </span>
            <span className="absolute top-[calc(50%+10px)] left-4 font-mono text-[10px] font-medium text-[#6E6960] uppercase">
              Front Ortho
            </span>
            <span className="absolute top-[calc(50%+10px)] left-[calc(50%+12px)] font-mono text-[10px] font-medium text-[#6E6960] uppercase">
              Right Ortho
            </span>
          </div>
        )}

        {loadingLabel && (
          <div className="atelier-surface pointer-events-none absolute top-20 left-1/2 z-30 -translate-x-1/2 rounded-xl px-4 py-2 text-[12px] font-medium text-[#1C1B19]">
            {loadingLabel}
          </div>
        )}

        {/* TOP-LEFT EDITORIAL CAPTION (Hidden in Play Mode so banner never collides) */}
        {!controlsHidden && !playModeStatus.active && (
          <div
            className={`pointer-events-none absolute top-3 left-3 z-20 max-w-[205px] select-none sm:top-3.5 sm:left-4 sm:max-w-[270px] ${
              worldEnvPreset !== 'alabaster'
                ? 'rounded-xl border border-[#E5E1DA] bg-white px-3 py-2 shadow-[0_6px_18px_rgba(28,27,25,0.08)] sm:px-3.5 sm:py-2.5'
                : 'pt-0.5'
            }`}
          >
            <h1 className="truncate font-display text-[15px] leading-tight font-medium tracking-[-0.015em] text-[#1C1B19] sm:text-[18px]">
              {captionModelName}
            </h1>
            <p className="mt-0.5 hidden truncate font-mono text-[10.5px] text-[#6E6960] tabular-nums sm:block">
              {captionSummary} · {activeShadingLabel}
            </p>
            <div className="pointer-events-auto mt-1 flex items-center gap-2 text-[11px] font-medium sm:mt-1.5 sm:gap-2.5 sm:text-[12px]">
              <button
                type="button"
                onClick={onOpenLibrary}
                className="text-[#2D5A4C] underline-offset-4 transition-colors hover:text-[#1C1B19] hover:underline"
              >
                Library
              </button>
              <span className="text-[#CBC4B9]">·</span>
              <button
                type="button"
                onClick={onToggleInspector}
                className="text-[#5A564F] underline-offset-4 transition-colors hover:text-[#1C1B19] hover:underline"
              >
                {inspectorOpen ? 'Hide Inspector' : 'Inspector'}
              </button>
            </div>
          </div>
        )}

        {/* SCENE CAMERA VIEWFINDER OVERLAY (Blender Numpad 0 Mode) */}
        {lookingThroughCam && (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-6 z-10 rounded-xl border border-[#2D5A4C]/55 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)]"
            />
            <div className="atelier-surface animate-atelier-popover absolute top-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-xl px-3 py-1.5 text-[11.5px]">
              <Video className="h-3.5 w-3.5 text-[#2D5A4C]" />
              <span className="font-medium text-[#1C1B19]">{activeSceneCamLabel}</span>
              <span className="font-mono text-[10.5px] text-[#6E6960]">{activeSceneCamFocalMm}mm</span>
              <div className="mx-0.5 h-4 w-px bg-[#E5E1DA]" />
              <button
                type="button"
                onClick={() => {
                  const shot = captureActiveCameraSnapshot();
                  if (shot) onCaptureViewportToRepo(shot, 'camera');
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-[#2D5A4C] px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-[#22453A]"
              >
                <CloudUpload className="h-3 w-3" />
                Save Shot to Repo
              </button>
              <button
                type="button"
                onClick={() => alignCameraToCurrentView()}
                title="Align camera to viewport (Ctrl+Alt+0)"
                className="inline-flex items-center gap-1 rounded-lg border border-[#E2DDD4] bg-[#FAF9F6] px-2 py-1 text-[11px] font-medium text-[#5A564F] transition-colors hover:text-[#1C1B19]"
              >
                <Crosshair className="h-3 w-3" />
                Align
              </button>
              <button
                type="button"
                onClick={() => toggleLookThroughCamera()}
                title="Exit Scene Camera (Numpad 0 / Esc)"
                aria-label="Exit scene camera view"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-[#6E6960] transition-colors hover:bg-[#F5F3EF] hover:text-[#1C1B19]"
              >
                <X className="h-3.5 w-3.5" />
                Exit
              </button>
            </div>
          </>
        )}

        {/* MEASUREMENT OVERLAY */}
        {measuredDistance !== null && (
          <div className="atelier-surface animate-atelier-popover absolute top-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-xl px-3.5 py-2 text-[12px]">
            <Ruler className="h-3.5 w-3.5 text-[#2D5A4C]" />
            <span className="font-mono font-semibold text-[#1C1B19] tabular-nums">
              {measuredDistance.toFixed(3)} m
            </span>
            <button
              type="button"
              onClick={clearMeasurements}
              className="text-[11px] font-medium text-[#6E6960] hover:text-[#1C1B19]"
            >
              Clear
            </button>
          </div>
        )}

        {/* TOP-RIGHT 3D AXIS COMPASS & CAMERA UTILITIES (Desktop lg+ only, zero overlap with Views bar) */}
        {!controlsHidden && !inspectorOpen && !playModeStatus.active && (
          <div className="hidden lg:flex absolute top-16 right-4 z-20 flex-col items-center gap-2">
            <canvas
              ref={compassCanvasRef}
              onClick={handleCompassClick}
              title="Click axes to snap camera view (Center: Hero 3/4)"
              aria-label="Interactive 3D Axis Compass"
              className="h-[72px] w-[72px] cursor-pointer rounded-full shadow-[0_6px_20px_-6px_rgba(28,27,25,0.12)] transition-transform hover:scale-[1.03]"
            />

            <div className="atelier-surface flex flex-col items-center gap-0.5 rounded-xl p-1">
              <button
                type="button"
                onClick={toggleOrtho}
                title={isOrtho ? 'Switch to Perspective (Numpad 5)' : 'Switch to Orthographic (Numpad 5)'}
                aria-label="Toggle perspective or orthographic projection"
                className={`flex h-7 w-7 items-center justify-center rounded-lg font-mono text-[10px] font-semibold transition-colors ${
                  isOrtho
                    ? 'bg-[#2D5A4C] text-white'
                    : 'text-[#5A564F] hover:bg-[#F5F3EF] hover:text-[#1C1B19]'
                }`}
              >
                {isOrtho ? 'OR' : 'PR'}
              </button>
              <button
                type="button"
                onClick={onToggleQuadView}
                title="Quad View (Alt+Ctrl+Q)"
                aria-label="Toggle quad view"
                className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                  quadView
                    ? 'bg-[#2D5A4C] text-white'
                    : 'text-[#5A564F] hover:bg-[#F5F3EF] hover:text-[#1C1B19]'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => zoomBy(0.84)}
                title="Zoom In"
                aria-label="Zoom in"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#5A564F] transition-colors hover:bg-[#F5F3EF] hover:text-[#1C1B19]"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => zoomBy(1.18)}
                title="Zoom Out"
                aria-label="Zoom out"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#5A564F] transition-colors hover:bg-[#F5F3EF] hover:text-[#1C1B19]"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={resetView}
                title="Reset Camera Frame (Numpad 0)"
                aria-label="Reset camera frame"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#5A564F] transition-colors hover:bg-[#F5F3EF] hover:text-[#1C1B19]"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* UNIFIED COLLAPSIBLE BOTTOM FLOATING DOCK */}
        {playModeStatus.active ? null : controlsHidden ? (
          <button
            type="button"
            onClick={() => setControlsHidden(false)}
            className="atelier-surface fixed right-5 bottom-5 z-20 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-medium text-[#1C1B19] transition-colors hover:bg-[#FAF9F6]"
          >
            <Eye className="h-3.5 w-3.5 text-[#2D5A4C]" />
            Show Controls
          </button>
        ) : (
          <div className="fixed bottom-4 left-1/2 z-20 max-w-[calc(100vw-1.5rem)] -translate-x-1/2">
            {openPopover === 'shading' && (
              <div className="atelier-surface animate-atelier-popover absolute bottom-14 left-1/2 w-64 max-w-[calc(100vw-24px)] -translate-x-1/2 rounded-2xl p-2.5">
                <div className="px-2 pb-1.5 text-[10.5px] font-semibold tracking-[0.04em] text-[#847E75] uppercase">
                  Shading Pass
                </div>
                <div className="grid grid-cols-1 gap-0.5">
                  {SHADING_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        onShadingPassChange(opt.id);
                        setOpenPopover(null);
                      }}
                      className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[12px] transition-colors ${
                        shadingPass === opt.id
                          ? 'bg-[#EBF2EF] font-medium text-[#1D4438]'
                          : 'text-[#1C1B19] hover:bg-[#F5F3EF]'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {shadingPass === opt.id && (
                        <span className="h-1.5 w-1.5 rounded-full bg-[#2D5A4C]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {openPopover === 'lighting' && (
              <div className="atelier-surface animate-atelier-popover absolute bottom-14 left-1/2 w-72 max-w-[calc(100vw-24px)] -translate-x-1/2 space-y-3 rounded-2xl p-3.5">
                <div>
                  <div className="mb-1.5 text-[10.5px] font-semibold tracking-[0.04em] text-[#847E75] uppercase">
                    Studio Lighting
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {LIGHTING_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onLightingPresetChange(opt.id)}
                        className={`rounded-lg border px-2.5 py-1.5 text-left text-[11.5px] font-medium transition-colors ${
                          lightingPreset === opt.id
                            ? 'border-[#2D5A4C] bg-[#EBF2EF] text-[#1D4438]'
                            : 'border-[#E8E4DD] bg-[#FAF9F6] text-[#5A564F] hover:text-[#1C1B19]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-[#5A564F]">Key Light Angle</span>
                    <span className="font-mono text-[#1C1B19] tabular-nums">
                      {Math.round(lightAngleDeg)}°
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={5}
                    value={lightAngleDeg}
                    onChange={(e) => onLightAngleChange(Number(e.target.value))}
                    className="atelier-range w-full"
                  />
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-[#5A564F]">Wireframe Overlay</span>
                    <span className="font-mono text-[#1C1B19] tabular-nums">
                      {Math.round(wireframeOpacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={wireframeOpacity}
                    onChange={(e) => onWireframeOpacityChange(Number(e.target.value))}
                    className="atelier-range w-full"
                  />
                </div>
              </div>
            )}

            {openPopover === 'more' && (
              <div className="atelier-surface animate-atelier-popover absolute right-0 bottom-14 w-72 max-w-[calc(100vw-24px)] space-y-3 rounded-2xl p-3.5">
                <div>
                  <div className="mb-1.5 text-[10.5px] font-semibold tracking-[0.04em] text-[#847E75] uppercase">
                    Camera Presets
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {(['hero', 'front', 'right', 'top', 'left', 'back', 'bottom'] as const).map(
                      (p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => {
                            setCameraPreset(p);
                            setOpenPopover(null);
                          }}
                          className="rounded-lg border border-[#EAE5DC] bg-[#FAF9F6] py-1 text-[11px] font-medium capitalize text-[#1C1B19] transition-colors hover:border-[#2D5A4C] hover:bg-[#EBF2EF]"
                        >
                          {p}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="space-y-1 border-t border-[#EFECE6] pt-2.5 text-[12px]">
                  {fsSupported && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenPopover(null);
                        onLinkLocalFolder();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[#1C1B19] hover:bg-[#F5F3EF]"
                    >
                      <FolderOpen className="h-3.5 w-3.5 text-[#2D5A4C]" />
                      Link Local Project Folder
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setOpenPopover(null);
                      onRequestExecutionMode(executionMode === 'cloud' ? 'local' : 'cloud');
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[#1C1B19] hover:bg-[#F5F3EF]"
                  >
                    <Shield className="h-3.5 w-3.5 text-[#2D5A4C]" />
                    {executionMode === 'cloud'
                      ? 'Switch to Local Blender (2FA)'
                      : 'Return to Cloud GitHub CI'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenPopover(null);
                      const root = activeModelRootRef.current;
                      if (root) {
                        root.traverse((o) => {
                          if ((o as THREE.Mesh).isMesh) {
                            (o as THREE.Mesh).geometry.computeVertexNormals();
                          }
                        });
                        requestRender();
                        onNotify('Recalculated outward normals');
                      }
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[#1C1B19] hover:bg-[#F5F3EF]"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-[#5A564F]" />
                    Recalculate Normals Outside
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenPopover(null);
                      clearToPointCloud();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[#1C1B19] hover:bg-[#F5F3EF]"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-[#5A564F]" />
                    Clear to Point Cloud Stage
                  </button>
                </div>

                <div className="border-t border-[#EFECE6] pt-2 text-[10.5px] leading-relaxed text-[#847E75]">
                  Shortcuts: <span className="font-mono text-[#5A564F]">G/R/S</span> Gizmo ·{' '}
                  <span className="font-mono text-[#5A564F]">Shift+D</span> Clone ·{' '}
                  <span className="font-mono text-[#5A564F]">Numpad 1/3/7/5/0</span> ·{' '}
                  <span className="font-mono text-[#5A564F]">F12</span> Snap ·{' '}
                  <span className="font-mono text-[#5A564F]">H</span> Zen
                </div>
              </div>
            )}

            {/* Main Dock Bar */}
            <div className="atelier-surface flex items-center gap-1 overflow-x-auto rounded-2xl px-2 py-1.5">
              {/* Navigation & Pointer Modes */}
              <button
                type="button"
                onClick={() => {
                  setDragMode('orbit');
                  setToolMode('orbit');
                }}
                title="Orbit Camera"
                aria-label="Orbit camera tool"
                className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                  toolMode === 'orbit' && dragMode === 'orbit'
                    ? 'bg-[#2D5A4C] text-white'
                    : 'text-[#5A564F] hover:bg-[#F5F3EF] hover:text-[#1C1B19]'
                }`}
              >
                <Move3D className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Orbit</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDragMode('pan');
                  setToolMode('orbit');
                }}
                title="Pan Camera"
                aria-label="Pan camera tool"
                className={`flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-[12px] font-medium transition-colors ${
                  toolMode === 'orbit' && dragMode === 'pan'
                    ? 'bg-[#2D5A4C] text-white'
                    : 'text-[#5A564F] hover:bg-[#F5F3EF] hover:text-[#1C1B19]'
                }`}
              >
                <Hand className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setToolMode(toolMode === 'select' ? 'orbit' : 'select')}
                title="Select Component"
                aria-label="Select mesh component tool"
                className={`flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-[12px] font-medium transition-colors ${
                  toolMode === 'select'
                    ? 'bg-[#2D5A4C] text-white'
                    : 'text-[#5A564F] hover:bg-[#F5F3EF] hover:text-[#1C1B19]'
                }`}
              >
                <MousePointer className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() =>
                  onGizmoModeChange(gizmoMode === 'translate' ? 'none' : 'translate')
                }
                title="Move Gizmo (G)"
                aria-label="Toggle move gizmo"
                className={`flex items-center gap-1 rounded-xl px-2 py-1.5 text-[12px] font-medium transition-colors ${
                  gizmoMode === 'translate'
                    ? 'bg-[#2D5A4C] text-white'
                    : 'text-[#5A564F] hover:bg-[#F5F3EF] hover:text-[#1C1B19]'
                }`}
              >
                <Move className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => onGizmoModeChange(gizmoMode === 'rotate' ? 'none' : 'rotate')}
                title="Rotate Gizmo (R)"
                aria-label="Toggle rotate gizmo"
                className={`flex items-center gap-1 rounded-xl px-2 py-1.5 text-[12px] font-medium transition-colors ${
                  gizmoMode === 'rotate'
                    ? 'bg-[#2D5A4C] text-white'
                    : 'text-[#5A564F] hover:bg-[#F5F3EF] hover:text-[#1C1B19]'
                }`}
              >
                <RotateCw className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => onGizmoModeChange(gizmoMode === 'scale' ? 'none' : 'scale')}
                title="Scale Gizmo (S)"
                aria-label="Toggle scale gizmo"
                className={`flex items-center gap-1 rounded-xl px-2 py-1.5 text-[12px] font-medium transition-colors ${
                  gizmoMode === 'scale'
                    ? 'bg-[#2D5A4C] text-white'
                    : 'text-[#5A564F] hover:bg-[#F5F3EF] hover:text-[#1C1B19]'
                }`}
              >
                <Scaling className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  const next = toolMode === 'measure' ? 'orbit' : 'measure';
                  setToolMode(next);
                  if (next === 'measure') onNotify('Click two points on the model to measure');
                }}
                title="Measure Distance (2-Point Tape)"
                aria-label="Measure distance tool"
                className={`flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-[12px] font-medium transition-colors ${
                  toolMode === 'measure'
                    ? 'bg-[#2D5A4C] text-white'
                    : 'text-[#5A564F] hover:bg-[#F5F3EF] hover:text-[#1C1B19]'
                }`}
              >
                <Ruler className="h-3.5 w-3.5" />
              </button>

              <div className="mx-1 h-5 w-px shrink-0 bg-[#E5E1DA]" />

              <button
                type="button"
                onClick={onToggleExploded}
                title="Exploded Assembly View"
                aria-label="Toggle exploded assembly view"
                className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                  exploded
                    ? 'bg-[#EBF2EF] text-[#1D4438]'
                    : 'text-[#5A564F] hover:bg-[#F5F3EF] hover:text-[#1C1B19]'
                }`}
              >
                <Expand className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Explode</span>
              </button>

              <button
                type="button"
                onClick={() => onSectionCutChange({ ...sectionCut, enabled: !sectionCut.enabled })}
                title="3D Section Cut Plane"
                aria-label="Toggle 3D section cut"
                className={`flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-[12px] font-medium transition-colors ${
                  sectionCut.enabled
                    ? 'bg-[#EBF2EF] text-[#1D4438]'
                    : 'text-[#5A564F] hover:bg-[#F5F3EF] hover:text-[#1C1B19]'
                }`}
              >
                <Scissors className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={onToggleAutoSpin}
                title="360° Turntable"
                aria-label="Toggle 360 degree turntable"
                className={`flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-[12px] font-medium transition-colors ${
                  autoSpin
                    ? 'bg-[#EBF2EF] text-[#1D4438]'
                    : 'text-[#5A564F] hover:bg-[#F5F3EF] hover:text-[#1C1B19]'
                }`}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={onToggleGrid}
                title="Floor Grid"
                aria-label="Toggle floor grid"
                className={`flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-[12px] font-medium transition-colors ${
                  showGrid
                    ? 'text-[#1C1B19] hover:bg-[#F5F3EF]'
                    : 'text-[#A29B90] hover:bg-[#F5F3EF] hover:text-[#1C1B19]'
                }`}
              >
                <Grid3X3 className="h-3.5 w-3.5" />
              </button>

              <div className="mx-1 h-5 w-px shrink-0 bg-[#E5E1DA]" />

              <button
                type="button"
                onClick={() => setOpenPopover(openPopover === 'shading' ? null : 'shading')}
                aria-label="Shading passes"
                className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                  openPopover === 'shading'
                    ? 'bg-[#EBF2EF] text-[#1D4438]'
                    : 'text-[#5A564F] hover:bg-[#F5F3EF] hover:text-[#1C1B19]'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Shading</span>
                {openPopover === 'shading' ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronUp className="h-3 w-3" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setOpenPopover(openPopover === 'lighting' ? null : 'lighting')}
                aria-label="Studio lighting controls"
                className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                  openPopover === 'lighting'
                    ? 'bg-[#EBF2EF] text-[#1D4438]'
                    : 'text-[#5A564F] hover:bg-[#F5F3EF] hover:text-[#1C1B19]'
                }`}
              >
                <Sun className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Lighting</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const dataUrl = lookingThroughCam
                    ? captureActiveCameraSnapshot()
                    : captureSnapshot(false);
                  if (dataUrl) {
                    onCaptureViewportToRepo(dataUrl, lookingThroughCam ? 'camera' : 'viewport');
                  }
                }}
                title="Save Latest Screenshot to Repo Assets (F12 · No Auto-Download)"
                aria-label="Save latest screenshot to repo assets"
                className="flex items-center gap-1 rounded-xl px-2 py-1.5 text-[12px] font-medium text-[#5A564F] transition-colors hover:bg-[#F5F3EF] hover:text-[#1C1B19]"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setOpenPopover(openPopover === 'more' ? null : 'more')}
                title="Camera Presets & Studio Actions"
                aria-label="More studio actions"
                className={`flex items-center gap-1 rounded-xl px-2 py-1.5 text-[12px] font-medium transition-colors ${
                  openPopover === 'more'
                    ? 'bg-[#EBF2EF] text-[#1D4438]'
                    : 'text-[#5A564F] hover:bg-[#F5F3EF] hover:text-[#1C1B19]'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </button>

              <div className="mx-1 h-5 w-px shrink-0 bg-[#E5E1DA]" />

              <button
                type="button"
                onClick={() => {
                  setOpenPopover(null);
                  setControlsHidden(true);
                }}
                title="Hide Controls (H)"
                aria-label="Hide viewport controls"
                className="flex items-center gap-1 rounded-xl px-2 py-1.5 text-[11.5px] font-medium text-[#847E75] transition-colors hover:bg-[#F5F3EF] hover:text-[#1C1B19]"
              >
                <EyeOff className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Hide</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
);

StudioViewport.displayName = 'StudioViewport';
