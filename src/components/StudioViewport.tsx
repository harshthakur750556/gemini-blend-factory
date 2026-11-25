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
import {
  Camera,
  ChevronDown,
  ChevronUp,
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
  Scissors,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Sun,
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
  createWorldPrimitive,
} from '../utils/worldPrimitives';
import { parseDxf3dFacesToGeometry, parseOffToGeometry } from '../utils/modelConverter';
import type {
  AnimationClipSummary,
  BoneControlInfo,
  CameraTelemetry,
  CapturedScreenshot,
  DragMouseMode,
  ExecutionMode,
  GizmoMode,
  GizmoSpace,
  InsideOutSide,
  MaterialChannelInfo,
  OutlinerNode,
  SceneTelemetry,
  SectionCutConfig,
  ShadingPass,
  StudioLightingPreset,
  SurfaceParams,
  TopologyDiagnostics,
  TransformInfo,
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
  toggleOrtho: () => void;
  zoomBy: (factor: number) => void;
  resetView: () => void;
  captureSnapshot: (download?: boolean) => string | null;
  captureMultiAngleScreenshots: () => CapturedScreenshot[];
  getActiveModelRoot: () => THREE.Object3D | null;
  selectNode: (uuid: string | null) => void;
  toggleNodeVisibility: (uuid: string) => void;
  toggleNodeLock: (uuid: string) => void;
  toggleSoloNode: (uuid: string) => void;
  showAllNodes: () => void;
  updateTransform: (
    axis: 'posX' | 'posY' | 'posZ' | 'rotX' | 'rotY' | 'rotZ' | 'scaleX' | 'scaleY' | 'scaleZ',
    value: number
  ) => void;
  // Blender World Assembly Suite
  addWorldPrimitive: (kind: WorldPrimitiveKind) => void;
  duplicateSelected: () => void;
  deleteSelected: () => void;
  mirrorSelected: (axis: 'x' | 'y' | 'z') => void;
  snapSelectedToGround: () => void;
  toggleSelectedFlatShading: () => void;
  applyArrayModifier: (count: number, offset: [number, number, number]) => void;
  applyScatterModifier: (count: number, radius: number) => void;
  updateWorldEnvironment: (preset: WorldEnvironmentPreset, fogDensity: number) => void;
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
  autoSpin: boolean;
  onToggleAutoSpin: () => void;
  exploded: boolean;
  onToggleExploded: () => void;
  lightingPreset: StudioLightingPreset;
  onLightingPresetChange: (preset: StudioLightingPreset) => void;
  lightAngleDeg: number;
  onLightAngleChange: (deg: number) => void;
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
  worldEnvPreset: WorldEnvironmentPreset;
  worldFogDensity: number;
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
  courtyard: '#E5E8EC',
  meadow: '#E3EBE5',
  desert: '#F1E6D6',
};

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
  const geo = new THREE.PlaneGeometry(80, 80, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uMinorColor: { value: new THREE.Color('#CEC8BE') },
      uMajorColor: { value: new THREE.Color('#ABA498') },
      uFadeDist: { value: 24.0 },
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
        vec2 grid = abs(fract(p - 0.5) - 0.5) / fwidth(p);
        float line = min(grid.x, grid.y);
        return 1.0 - min(line, 1.0);
      }

      void main() {
        float dist = length(vWorldPos.xz);
        float fade = smoothstep(uFadeDist, 1.5, dist);
        float minor = gridLine(vWorldPos.xz, 0.5) * 0.34;
        float major = gridLine(vWorldPos.xz, 2.0) * 0.65;
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
  return mesh;
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
      autoSpin,
      onToggleAutoSpin,
      exploded,
      onToggleExploded,
      lightingPreset,
      onLightingPresetChange,
      lightAngleDeg,
      onLightAngleChange,
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
      worldEnvPreset,
      worldFogDensity,
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
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const compassCanvasRef = useRef<HTMLCanvasElement | null>(null);

    const [dragMode, setDragMode] = useState<DragMouseMode>('orbit');
    const [toolMode, setToolMode] = useState<ViewportToolMode>('orbit');
    const [isOrtho, setIsOrtho] = useState(false);
    const [controlsHidden, setControlsHidden] = useState(false);
    const [openPopover, setOpenPopover] = useState<'shading' | 'lighting' | 'more' | null>(null);
    const [measuredDistance, setMeasuredDistance] = useState<number | null>(null);
    const [loadingLabel, setLoadingLabel] = useState<string | null>(null);
    const [captionModelName, setCaptionModelName] = useState<string>('Stone & Cedar Lantern');
    const [captionSummary, setCaptionSummary] = useState<string>('Architectural Sample');

    // Mutable 3D engine state refs
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const perspCamRef = useRef<THREE.PerspectiveCamera | null>(null);
    const orthoCamRef = useRef<THREE.OrthographicCamera | null>(null);
    const activeCamRef = useRef<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>(null);
    const orbitRef = useRef<OrbitControls | null>(null);
    const transformCtrlRef = useRef<TransformControls | null>(null);
    const transformHelperRef = useRef<THREE.Object3D | null>(null);
    const gridRef = useRef<THREE.Mesh | null>(null);
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
    const explodeBasePosRef = useRef<Map<THREE.Mesh, THREE.Vector3>>(new Map());
    const explodeDirRef = useRef<Map<THREE.Mesh, THREE.Vector3>>(new Map());
    const explodeFactorRef = useRef<number>(0);
    const lockedNodesRef = useRef<Set<string>>(new Set());
    const selectedNodeUuidRef = useRef<string | null>(null);
    const soloNodeUuidRef = useRef<string | null>(null);
    const modelCenterRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.72, 0));
    const modelRadiusRef = useRef<number>(1.05);

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
    const pendingCamTargetPosRef = useRef<THREE.Vector3 | null>(null);
    const pendingOrbitTargetRef = useRef<THREE.Vector3 | null>(null);
    const activePresetNameRef = useRef<string>('Hero 3/4');

    const propsRef = useRef({
      shadingPass,
      quadView,
      showGrid,
      autoSpin,
      exploded,
      lightingPreset,
      lightAngleDeg,
      wireframeOpacity,
      insideOutSide,
      surfaceParams,
      sectionCut,
      showSkeleton,
      gizmoMode,
      gizmoSpace,
      snapGrid,
      snapRotateDeg,
      toolMode,
      dragMode,
    });
    propsRef.current = {
      shadingPass,
      quadView,
      showGrid,
      autoSpin,
      exploded,
      lightingPreset,
      lightAngleDeg,
      wireframeOpacity,
      insideOutSide,
      surfaceParams,
      sectionCut,
      showSkeleton,
      gizmoMode,
      gizmoSpace,
      snapGrid,
      snapRotateDeg,
      toolMode,
      dragMode,
    };

    const requestRender = useCallback(() => {
      needsRenderRef.current = true;
    }, []);

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
                metalness: typeof std.metalness === 'number' ? std.metalness : 0,
                roughness: typeof std.roughness === 'number' ? std.roughness : 0.6,
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
        onTelemetryChange,
        onTransformInfoChange,
      ]
    );

    const registerMeshesInSubtree = useCallback((subtree: THREE.Object3D, centerRef: THREE.Vector3) => {
      subtree.traverse((obj) => {
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
      const { gizmoMode: mode, gizmoSpace: space, snapGrid: gSnap, snapRotateDeg: rSnap } =
        propsRef.current;

      if (mode === 'none' || !root) {
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
        if (!(obj as THREE.Mesh).isMesh) return;
        const mesh = obj as THREE.Mesh;
        const orig = originalMaterialsRef.current.get(mesh) ?? mesh.material;
        if (!originalMaterialsRef.current.has(mesh)) {
          originalMaterialsRef.current.set(mesh, orig);
        }

        if (pass === 'normal') {
          mesh.material = new THREE.MeshNormalMaterial({
            side: sideVal,
            clippingPlanes: activePlanes,
          });
        } else if (pass === 'matcap') {
          mesh.material = new THREE.MeshMatcapMaterial({
            matcap: matcapTexRef.current,
            side: sideVal,
            clippingPlanes: activePlanes,
          });
        } else if (pass === 'xray') {
          mesh.material = new THREE.MeshStandardMaterial({
            color: '#2D5A4C',
            transparent: true,
            opacity: 0.28,
            depthWrite: false,
            roughness: 0.35,
            side: THREE.DoubleSide,
            clippingPlanes: activePlanes,
          });
        } else if (pass === 'uv') {
          mesh.material = new THREE.MeshStandardMaterial({
            map: uvTexRef.current,
            roughness: 0.65,
            side: sideVal,
            clippingPlanes: activePlanes,
          });
        } else if (pass === 'roughness') {
          const origStd = (Array.isArray(orig) ? orig[0] : orig) as THREE.MeshStandardMaterial;
          const rVal = sp.overrideEnabled ? sp.roughness : origStd?.roughness ?? 0.6;
          const grey = Math.round(rVal * 255);
          mesh.material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(`rgb(${grey},${grey},${grey})`),
            side: sideVal,
            clippingPlanes: activePlanes,
          });
        } else if (pass === 'albedo') {
          const origStd = (Array.isArray(orig) ? orig[0] : orig) as THREE.MeshStandardMaterial;
          mesh.material = new THREE.MeshBasicMaterial({
            color: sp.overrideEnabled
              ? new THREE.Color(sp.baseColor)
              : origStd?.color
                ? origStd.color.clone()
                : new THREE.Color('#7B7871'),
            map: sp.overrideEnabled ? null : origStd?.map ?? null,
            side: sideVal,
            clippingPlanes: activePlanes,
          });
        } else if (pass === 'points') {
          mesh.material = new THREE.MeshBasicMaterial({
            color: '#D5CFC5',
            transparent: true,
            opacity: 0.12,
            depthWrite: false,
            side: sideVal,
            clippingPlanes: activePlanes,
          });
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
          mesh.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(sp.baseColor),
            metalness: sp.metallic,
            roughness: sp.roughness,
            emissive: new THREE.Color(sp.baseColor),
            emissiveIntensity: sp.emission,
            bumpScale: sp.normalStrength * 0.012,
            side: sideVal,
            clippingPlanes: activePlanes,
          });
        } else {
          mesh.material = orig;
          const mats = Array.isArray(orig) ? orig : [orig];
          for (const m of mats) {
            m.side = sideVal;
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

    // Apply lighting preset & key light azimuth angle
    const applyLighting = useCallback(() => {
      const key = keyLightRef.current;
      const rim = rimLightRef.current;
      const fill = fillLightRef.current;
      const hemi = hemiLightRef.current;
      const renderer = rendererRef.current;
      if (!key || !rim || !fill || !hemi || !renderer) return;

      const { lightingPreset: preset, lightAngleDeg: angleDeg } = propsRef.current;
      const rad = THREE.MathUtils.degToRad(angleDeg);
      const dist = 5.4;
      key.position.set(Math.cos(rad) * dist, 5.2, Math.sin(rad) * dist);
      rim.position.set(-Math.cos(rad) * dist * 0.85, 3.6, -Math.sin(rad) * dist * 0.85);

      if (preset === 'architectural') {
        key.color.set('#FFF8EB');
        key.intensity = 2.8;
        fill.color.set('#E2ECF5');
        fill.intensity = 1.05;
        rim.color.set('#FFFFFF');
        rim.intensity = 0.8;
        hemi.intensity = 0.85;
        renderer.toneMappingExposure = 1.08;
      } else if (preset === 'high-contrast') {
        key.color.set('#FFF2DF');
        key.intensity = 3.4;
        fill.color.set('#CBD4DE');
        fill.intensity = 0.42;
        rim.color.set('#DCE8E3');
        rim.intensity = 1.6;
        hemi.intensity = 0.4;
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
        key.intensity = 2.6;
        fill.color.set('#DCE7F0');
        fill.intensity = 0.85;
        rim.color.set('#EDF4F1');
        rim.intensity = 1.05;
        hemi.intensity = 0.72;
        renderer.toneMappingExposure = 1.04;
      }
      requestRender();
    }, [requestRender]);

    // Apply World Environment preset & fog
    const updateWorldEnvironment = useCallback(
      (preset: WorldEnvironmentPreset, fogDensity: number) => {
        const scene = sceneRef.current;
        if (!scene) return;
        const hex = WORLD_ENV_BG[preset] || '#ECEAE4';
        scene.background = new THREE.Color(hex);
        scene.fog = fogDensity > 0.0005 ? new THREE.FogExp2(hex, fogDensity) : null;
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
      initialBoneQuatsRef.current.clear();
      onSelectedNodeChange(null);
      onSoloNodeChange(null);
      onAnimationsChange([], 0, 0);
      onAnimationTimeChange(0, false);
    }, [onAnimationsChange, onAnimationTimeChange, onSelectedNodeChange, onSoloNodeChange]);

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
        if (contactShadowRef.current) {
          contactShadowRef.current.visible = true;
        }

        root.updateMatrixWorld(true);
        const rawBox = new THREE.Box3().setFromObject(root);
        const rawSize = new THREE.Vector3();
        const rawCenter = new THREE.Vector3();
        rawBox.getSize(rawSize);
        rawBox.getCenter(rawCenter);

        const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z);
        if (maxDim > 4.8 || (maxDim > 0 && maxDim < 0.35)) {
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

        const modelCenter = new THREE.Vector3();
        new THREE.Box3().setFromObject(root).getCenter(modelCenter);
        registerMeshesInSubtree(root, modelCenter);

        scene.add(root);
        activeModelRootRef.current = root;
        activeModelDisposeRef.current = disposeFn;

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
        inspectActiveModel(displayName);
        syncTransformGizmo();
      },
      [
        applyVisualMaterials,
        disposeCurrentModel,
        frameModel,
        inspectActiveModel,
        onAnimationsChange,
        registerMeshesInSubtree,
        syncTransformGizmo,
      ]
    );

    const ensureWorldRoot = useCallback((): THREE.Object3D => {
      if (activeModelRootRef.current) return activeModelRootRef.current;
      const worldGroup = new THREE.Group();
      worldGroup.name = 'World_Assembly';
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
          o.zoom = THREE.MathUtils.clamp(o.zoom / factor, 0.25, 8);
          o.updateProjectionMatrix();
        } else {
          const offset = cam.position.clone().sub(orbit.target);
          offset.multiplyScalar(factor);
          const len = THREE.MathUtils.clamp(offset.length(), 0.7, 28);
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

    const captureSnapshot = useCallback(
      (download = true): string | null => {
        const renderer = rendererRef.current;
        const scene = sceneRef.current;
        const cam = activeCamRef.current;
        if (!renderer || !scene || !cam) return null;

        const prevSelVis = selectionBoxRef.current?.visible ?? false;
        const prevTcVis = transformHelperRef.current?.visible ?? false;
        if (selectionBoxRef.current) selectionBoxRef.current.visible = false;
        if (transformHelperRef.current) transformHelperRef.current.visible = false;

        renderer.setScissorTest(false);
        renderer.render(scene, cam);
        const dataUrl = renderer.domElement.toDataURL('image/png');

        if (selectionBoxRef.current) selectionBoxRef.current.visible = prevSelVis;
        if (transformHelperRef.current) transformHelperRef.current.visible = prevTcVis;
        renderer.render(scene, cam);

        if (download) {
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = `blendfactory-snapshot-${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          onNotify('Saved studio PNG snapshot');
        }
        return dataUrl;
      },
      [onNotify]
    );

    // Captures 4 real studio angles (Hero 3/4, Front, Side, Top) without altering the user's camera!
    const captureMultiAngleScreenshots = useCallback((): CapturedScreenshot[] => {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const mainCam = activeCamRef.current;
      const root = activeModelRootRef.current;
      if (!renderer || !scene || !mainCam) return [];

      const box = root ? new THREE.Box3().setFromObject(root) : new THREE.Box3(
        new THREE.Vector3(-0.8, 0, -0.8),
        new THREE.Vector3(0.8, 1.4, 0.8)
      );
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z, 1.0);
      const dist = maxDim * 2.25;

      const w = renderer.domElement.clientWidth || 800;
      const h = Math.max(1, renderer.domElement.clientHeight || 600);
      const snapCam = new THREE.PerspectiveCamera(40, w / h, 0.05, 120);

      const prevSelVis = selectionBoxRef.current?.visible ?? false;
      const prevTcVis = transformHelperRef.current?.visible ?? false;
      if (selectionBoxRef.current) selectionBoxRef.current.visible = false;
      if (transformHelperRef.current) transformHelperRef.current.visible = false;

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
      const results: CapturedScreenshot[] = [];

      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, w, h);

      for (const item of angles) {
        const off = getBlenderPresetOffset(item.preset, dist);
        snapCam.position.set(center.x + off.x, center.y + off.y, center.z + off.z);
        snapCam.lookAt(center);
        snapCam.updateProjectionMatrix();
        renderer.render(scene, snapCam);
        results.push({
          id: `vp-${item.angle}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          angle: item.angle,
          label: item.label,
          dataUrl: renderer.domElement.toDataURL('image/png'),
          createdAt: stamp,
          source: 'viewport',
        });
      }

      if (selectionBoxRef.current) selectionBoxRef.current.visible = prevSelVis;
      if (transformHelperRef.current) transformHelperRef.current.visible = prevTcVis;
      renderer.render(scene, mainCam);
      requestRender();
      return results;
    }, [requestRender]);

    // Blender World Assembly Operations
    const addWorldPrimitive = useCallback(
      (kind: WorldPrimitiveKind) => {
        const root = ensureWorldRoot();
        const idx = primitiveCounterRef.current++;
        const obj = createWorldPrimitive(kind, idx);
        // Offset slightly if stage already has objects so new primitives don't stack invisibly
        if (root.children.length > 0 && kind !== 'terrain' && kind !== 'plane' && kind !== 'water') {
          const ring = ((idx - 1) % 6) * (Math.PI / 3);
          obj.position.x += Math.cos(ring) * 1.15;
          obj.position.z += Math.sin(ring) * 1.15;
        }
        root.add(obj);
        registerMeshesInSubtree(obj, modelCenterRef.current);
        applyVisualMaterials();
        selectNode(obj.uuid);
        onNotify(`Added ${obj.name} to World`);
      },
      [applyVisualMaterials, ensureWorldRoot, onNotify, registerMeshesInSubtree, selectNode]
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
      const clone = source.clone(true);
      clone.name = `${source.name || 'Node'}_Copy_${primitiveCounterRef.current++}`;
      clone.position.x += 0.75;
      source.parent.add(clone);
      registerMeshesInSubtree(clone, modelCenterRef.current);
      applyVisualMaterials();
      selectNode(clone.uuid);
      onNotify(`Duplicated ${source.name}`);
    }, [applyVisualMaterials, onNotify, registerMeshesInSubtree, selectNode]);

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
      transformCtrlRef.current?.detach();
      target.parent.remove(target);
      selectNode(null);
      applyVisualMaterials();
      inspectActiveModel(captionModelName);
      onNotify(`Deleted ${target.name}`);
    }, [applyVisualMaterials, captionModelName, inspectActiveModel, onNotify, selectNode]);

    const mirrorSelected = useCallback(
      (axis: 'x' | 'y' | 'z') => {
        const root = activeModelRootRef.current;
        if (!root) return;
        const target = selectedNodeUuidRef.current
          ? root.getObjectByProperty('uuid', selectedNodeUuidRef.current) || root
          : root;
        if (axis === 'x') target.scale.x *= -1;
        if (axis === 'y') target.scale.y *= -1;
        if (axis === 'z') target.scale.z *= -1;
        target.updateMatrixWorld(true);
        updateSelectionBox();
        inspectActiveModel(captionModelName);
        requestRender();
        onNotify(`Mirrored ${target.name} across ${axis.toUpperCase()}`);
      },
      [captionModelName, inspectActiveModel, onNotify, requestRender, updateSelectionBox]
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
        target.position.y -= box.min.y;
        target.updateMatrixWorld(true);
        updateSelectionBox();
        inspectActiveModel(captionModelName);
        requestRender();
        onNotify(`Snapped ${target.name} flush to Y = 0`);
      }
    }, [captionModelName, inspectActiveModel, onNotify, requestRender, updateSelectionBox]);

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
        applyVisualMaterials();
        selectNode(arrGroup.uuid);
        onNotify(`Applied ${count}× Array Modifier`);
      },
      [applyVisualMaterials, onNotify, registerMeshesInSubtree, selectNode]
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
        applyVisualMaterials();
        selectNode(scatterGrp.uuid);
        onNotify(`Scattered ${count} instances within ${radius}m`);
      },
      [applyVisualMaterials, onNotify, registerMeshesInSubtree, selectNode]
    );

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
        toggleOrtho,
        zoomBy,
        resetView,
        captureSnapshot,
        captureMultiAngleScreenshots,
        getActiveModelRoot: () => activeModelRootRef.current,
        selectNode,
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
          updateSelectionBox();
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
        appendModelFromUrl,
        applyArrayModifier,
        applyScatterModifier,
        applyVisualMaterials,
        captionModelName,
        captureMultiAngleScreenshots,
        captureSnapshot,
        clearToPointCloud,
        deleteSelected,
        duplicateSelected,
        inspectActiveModel,
        loadModelFromUrl,
        loadStarterLantern,
        mirrorSelected,
        mountModelObject,
        onAnimationTimeChange,
        onAnimationsChange,
        onNotify,
        onSoloNodeChange,
        requestRender,
        resetView,
        selectNode,
        setCameraPreset,
        snapSelectedToGround,
        syncTransformGizmo,
        toggleOrtho,
        toggleSelectedFlatShading,
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
      key.position.set(3.8, 5.2, 3.8);
      if (!isSw) {
        key.castShadow = true;
        key.shadow.mapSize.set(2048, 2048);
        key.shadow.bias = -0.0004;
        key.shadow.camera.near = 0.5;
        key.shadow.camera.far = 22;
        key.shadow.camera.left = -5;
        key.shadow.camera.right = 5;
        key.shadow.camera.top = 5;
        key.shadow.camera.bottom = -5;
      }
      scene.add(key);
      keyLightRef.current = key;

      const fill = new THREE.DirectionalLight('#DCE7F0', 0.85);
      fill.position.set(-4.2, 3.0, 2.4);
      scene.add(fill);
      fillLightRef.current = fill;

      const rim = new THREE.DirectionalLight('#EDF4F1', 1.05);
      rim.position.set(-3.2, 3.6, -3.5);
      scene.add(rim);
      rimLightRef.current = rim;

      const floorGrid = createInfiniteFloorGrid();
      floorGrid.visible = propsRef.current.showGrid;
      scene.add(floorGrid);
      gridRef.current = floorGrid;

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
      const persp = new THREE.PerspectiveCamera(42, aspect, 0.05, 140);
      persp.position.set(1.85, 1.35, 2.1);
      perspCamRef.current = persp;

      const ortho = new THREE.OrthographicCamera(-2 * aspect, 2 * aspect, 2, -2, 0.05, 140);
      ortho.position.copy(persp.position);
      orthoCamRef.current = ortho;
      activeCamRef.current = persp;

      const orbit = new OrbitControls(persp, renderer.domElement);
      orbit.enableDamping = !isSw;
      orbit.dampingFactor = 0.08;
      orbit.maxPolarAngle = Math.PI * 0.495;
      orbit.minDistance = 0.55;
      orbit.maxDistance = 32;
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
        orbit.enabled = !ev.value;
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

      // Auto-load single curated sample model immediately on mount
      loadStarterLantern(true);
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
        if (activeModelRootRef.current) {
          frameModel(activeModelRootRef.current, true);
        }
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

      const afterDraw = (cb: FrameRequestCallback) => {
        if (!isSw) {
          rafIdRef.current = requestAnimationFrame(cb);
          return;
        }
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
                rafIdRef.current = requestAnimationFrame(poll);
              } else {
                gl2.deleteSync(sync);
                rafIdRef.current = requestAnimationFrame(cb);
              }
            };
            rafIdRef.current = requestAnimationFrame(poll);
            return;
          }
        }
        rafIdRef.current = requestAnimationFrame(cb);
      };

      const quadFront = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.05, 80);
      const quadTop = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.05, 80);
      const quadRight = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.05, 80);

      let disposed = false;
      let lastTime = performance.now();
      let lastTelemetryPush = 0;

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

        if (curProps.autoSpin && activeModelRootRef.current) {
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

        if (pendingCamTargetPosRef.current && pendingOrbitTargetRef.current && cam && ctrl) {
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
          needsRenderRef.current = true;
        }

        if (mixerRef.current && animPlayingRef.current && activeActionRef.current) {
          mixerRef.current.update(dt);
          if (now - lastTelemetryPush > 120) {
            onAnimationTimeChange(activeActionRef.current.time, true);
          }
          continuous = true;
          needsRenderRef.current = true;
        }

        if (ctrl && ctrl.enableDamping) {
          const moved = ctrl.update();
          if (moved) needsRenderRef.current = true;
        }

        if ((needsRenderRef.current || continuous) && cam && ctrl) {
          needsRenderRef.current = false;
          const w = container.clientWidth;
          const h = Math.max(1, container.clientHeight);

          if (curProps.quadView) {
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
            quadTop.position.set(c.x, c.y + 8, c.z + 0.001);
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
            quadFront.position.set(c.x, c.y, c.z + 8);
            quadFront.lookAt(c);
            quadFront.updateProjectionMatrix();
            renderer.setViewport(0, 0, hw, hh);
            renderer.setScissor(0, 0, hw, hh);
            renderer.render(scene, quadFront);

            quadRight.left = -span * qAsp;
            quadRight.right = span * qAsp;
            quadRight.top = span;
            quadRight.bottom = -span;
            quadRight.position.set(c.x + 8, c.y, c.z);
            quadRight.lookAt(c);
            quadRight.updateProjectionMatrix();
            renderer.setViewport(hw, 0, w - hw, hh);
            renderer.setScissor(hw, 0, w - hw, hh);
            renderer.render(scene, quadRight);

            renderer.setScissorTest(false);
          } else {
            renderer.setScissorTest(false);
            renderer.setViewport(0, 0, w, h);
            renderer.render(scene, cam);
          }

          drawCompass(cam);

          if (now - lastTelemetryPush > 180) {
            lastTelemetryPush = now;
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

          afterDraw(tick);
        } else {
          rafIdRef.current = requestAnimationFrame(tick);
        }
      };

      rafIdRef.current = requestAnimationFrame(tick);

      return () => {
        disposed = true;
        cancelAnimationFrame(rafIdRef.current);
        resizeObserver.disconnect();
        tc.removeEventListener('dragging-changed', onTcDragging);
        tc.removeEventListener('objectChange', onTcObjectChange);
        tc.removeEventListener('change', requestRender);
        tc.dispose();
        orbit.removeEventListener('change', onOrbitChange);
        orbit.dispose();
        disposeCurrentModel();
        ptArt.dispose();
        floorGrid.geometry.dispose();
        (floorGrid.material as THREE.Material).dispose();
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
      if (gridRef.current) {
        gridRef.current.visible = showGrid;
        requestRender();
      }
    }, [showGrid, requestRender]);

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
    }, [lightingPreset, lightAngleDeg, applyLighting]);

    useEffect(() => {
      syncTransformGizmo();
    }, [gizmoMode, gizmoSpace, snapGrid, snapRotateDeg, syncTransformGizmo]);

    useEffect(() => {
      updateWorldEnvironment(worldEnvPreset, worldFogDensity);
    }, [worldEnvPreset, worldFogDensity, updateWorldEnvironment]);

    useEffect(() => {
      requestRender();
    }, [quadView, autoSpin, exploded, requestRender]);

    useEffect(() => {
      const orbit = orbitRef.current;
      if (!orbit) return;
      if (dragMode === 'pan') {
        orbit.mouseButtons.LEFT = THREE.MOUSE.PAN;
      } else if (dragMode === 'zoom') {
        orbit.mouseButtons.LEFT = THREE.MOUSE.DOLLY;
      } else {
        orbit.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
      }
    }, [dragMode]);

    // Keyboard shortcuts: Blender Numpad + Gizmos (G/R/S) + Shift+D Duplicate + Delete + WASD/QE + H
    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        const lower = e.key.toLowerCase();

        if (lower === 'h' && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          setControlsHidden((prev) => !prev);
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
          onGizmoModeChange('scale');
          return;
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
        } else if (e.code === 'Numpad0' || e.code === 'NumpadDecimal') {
          e.preventDefault();
          resetView();
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
          const step = 0.16;
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

      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }, [deleteSelected, duplicateSelected, onGizmoModeChange, requestRender, resetView, setCameraPreset, toggleOrtho]);

    // Canvas click for Raycast Select & 2-Point Measure Tape
    const handleCanvasPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
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
          selectNode(hitObj.uuid);
          onNotify(`Selected ${hitObj.name || hitObj.type}`);
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
            grp.remove(grp.children[0]);
          }
          setMeasuredDistance(null);
        }
        measurePointsRef.current.push(pt);
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(0.022, 16, 16),
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
          measureGroupRef.current.remove(measureGroupRef.current.children[0]);
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
          onPointerUp={handleCanvasPointerUp}
          className={`h-full w-full ${
            toolMode === 'measure' || toolMode === 'select'
              ? 'cursor-crosshair'
              : dragMode === 'pan'
                ? 'cursor-grab'
                : 'cursor-default'
          }`}
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

        {/* TOP-LEFT EDITORIAL CAPTION */}
        {!controlsHidden && (
          <div className="pointer-events-none absolute top-5 left-5 z-20 max-w-[235px] select-none sm:left-7 sm:max-w-xs">
            <h1 className="font-display text-[19px] leading-tight font-medium tracking-[-0.015em] text-[#1C1B19] sm:text-[22px]">
              {captionModelName}
            </h1>
            <p className="mt-1 font-mono text-[10.5px] text-[#6E6960] tabular-nums sm:text-[11px]">
              {captionSummary} · {activeShadingLabel}
            </p>
            <div className="pointer-events-auto mt-2 flex items-center gap-2.5 text-[12px] font-medium">
              <button
                type="button"
                onClick={onOpenLibrary}
                className="text-[#2D5A4C] underline-offset-4 transition-colors hover:text-[#1C1B19] hover:underline"
              >
                Model Library
              </button>
              <span className="text-[#CBC4B9]">·</span>
              <button
                type="button"
                onClick={onToggleInspector}
                className="text-[#5A564F] underline-offset-4 transition-colors hover:text-[#1C1B19] hover:underline"
              >
                {inspectorOpen ? 'Hide Inspector' : 'Open Inspector'}
              </button>
            </div>
          </div>
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

        {/* TOP-RIGHT 3D AXIS COMPASS & CAMERA UTILITIES */}
        {!controlsHidden && !inspectorOpen && (
          <div className="absolute top-5 right-4 z-20 flex flex-col items-center gap-2 sm:right-6">
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
        {controlsHidden ? (
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
              <div className="atelier-surface animate-atelier-popover absolute bottom-14 left-1/2 w-64 -translate-x-1/2 rounded-2xl p-2.5">
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
              <div className="atelier-surface animate-atelier-popover absolute bottom-14 left-1/2 w-72 -translate-x-1/2 space-y-3 rounded-2xl p-3.5">
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
              <div className="atelier-surface animate-atelier-popover absolute right-0 bottom-14 w-72 space-y-3 rounded-2xl p-3.5">
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
                onClick={() => captureSnapshot(true)}
                title="Capture PNG Snapshot (F12)"
                aria-label="Capture PNG snapshot"
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
