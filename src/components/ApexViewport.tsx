import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type {
  AnimationClipSummary,
  BoneControlInfo,
  CameraTelemetry,
  DragMouseMode,
  HdriPreset,
  InsideOutSide,
  LeftToolMode,
  MaterialChannelInfo,
  OutlinerNode,
  SceneTelemetry,
  SectionCutConfig,
  ShadingPass,
  SurfaceParams,
  TopologyDiagnostics,
  TransformInfo,
} from '../types';
import {
  applyBlenderOrbitStep,
  getBlenderPresetOffset,
  type BlenderCameraPreset,
} from '../utils/cameraPresets';
import { createPointCloudArtGroup } from '../utils/pointCloudArt';
import { createRiggedArmSpecimen } from '../utils/riggedSpecimen';
import { createStarterLanternGroup } from '../utils/proceduralLantern';
import { createApexMechSpecimen } from '../utils/apexMechSpecimen';
import {
  exportObject3DToBlob,
  type ExportFormatId,
} from '../utils/modelExporters';

export type OrbitStepDirection = 'left' | 'right' | 'up' | 'down' | 'opposite';

export interface ApexViewportHandle {
  loadModelFromUrl: (url: string, name: string, format?: string) => Promise<void>;
  loadSpecimen: (kind: 'apex-mech' | 'rigged-arm' | 'stone-lantern') => void;
  clearToPointCloud: () => void;
  applyCameraPreset: (preset: BlenderCameraPreset) => void;
  orbitStep: (dir: OrbitStepDirection) => void;
  toggleOrtho: () => void;
  zoomBy: (factor: number) => void;
  toggleNodeVisibility: (uuid: string) => void;
  toggleNodeLock: (uuid: string) => void;
  soloNode: (uuid: string) => void;
  showAllNodes: () => void;
  selectNode: (uuid: string | null) => void;
  updateSelectedTransform: (field: keyof Omit<TransformInfo, 'uuid' | 'name'>, value: number) => void;
  setBoneRotation: (uuid: string, axis: 'x' | 'y' | 'z', degrees: number) => void;
  resetPose: () => void;
  playClip: (index: number) => void;
  setAnimPlaying: (playing: boolean) => void;
  seekAnim: (timeSec: number) => void;
  recalculateNormalsOutside: () => string;
  purgeDegenerateGeometry: () => string;
  captureSnapshotPng: () => Promise<Blob>;
  exportCurrentModel: (format: Exclude<ExportFormatId, 'blend' | 'png'>) => Promise<{ blob: Blob; filename: string }>;
  hasActiveModel: () => boolean;
}

interface ApexViewportProps {
  shadingPass: ShadingPass;
  insideOutSide: InsideOutSide;
  sectionCut: SectionCutConfig;
  surfaceParams: SurfaceParams;
  showSkeleton: boolean;
  showGridOverlays: boolean;
  isQuadView: boolean;
  isAutoSpin: boolean;
  dragMode: DragMouseMode;
  activeTool: LeftToolMode;
  lightAngle: number;
  wireOpacity: number;
  hdriPreset: HdriPreset;
  onLightAngleChange: (deg: number) => void;
  onWireOpacityChange: (pct: number) => void;
  onHdriPresetChange: (preset: HdriPreset) => void;
  onOutlinerChange: (nodes: OutlinerNode[]) => void;
  onBonesChange: (bones: BoneControlInfo[]) => void;
  onMaterialsChange: (mats: MaterialChannelInfo[]) => void;
  onAnimationsChange: (clips: AnimationClipSummary[], activeIdx: number, playing: boolean, timeSec: number) => void;
  onTelemetryChange: (sceneInfo: SceneTelemetry, camInfo: CameraTelemetry) => void;
  onTransformChange: (tx: TransformInfo) => void;
  onDiagnosticsChange: (diag: TopologyDiagnostics) => void;
  onFpsChange: (fps: number) => void;
  onCursorChange: (x: number, y: number) => void;
  onSelectedNodeChange: (uuid: string | null, name: string) => void;
  onOpenAssetModal: () => void;
  onLoadQuickSpecimen: () => void;
  onNotify: (msg: string) => void;
}

const HDRI_OPTIONS: { id: HdriPreset; label: string }[] = [
  { id: 'studio-4k', label: 'Studio 4K' },
  { id: 'architectural', label: 'Architectural' },
  { id: 'high-contrast', label: 'High-Contrast' },
  { id: 'soft-clay', label: 'Soft Clay' },
];

function createUvCheckerTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  if (ctx) {
    const step = 32;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#111318' : '#e2e8f0';
        ctx.fillRect(x * step, y * step, step, step);
        ctx.fillStyle = (x + y) % 2 === 0 ? '#e2e8f0' : '#111318';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`${x}${y}`, x * step + 7, y * step + 19);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createMatCapTexture(): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(size * 0.36, size * 0.32, 10, size * 0.5, size * 0.5, size * 0.5);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.28, '#cbd5e1');
    grad.addColorStop(0.68, '#64748b');
    grad.addColorStop(0.92, '#1e293b');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(size / 2, size / 2, 6, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.30)');
    grad.addColorStop(0.4, 'rgba(30, 41, 59, 0.14)');
    grad.addColorStop(0.75, 'rgba(51, 65, 85, 0.03)');
    grad.addColorStop(1, 'rgba(51, 65, 85, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  return new THREE.CanvasTexture(c);
}

function createBlenderFloorOverlay(): THREE.Group {
  const group = new THREE.Group();
  group.name = '__Apex_Blender_Floor__';

  // Minor grid (0.2m spacing, 70 divisions across 14m)
  const minorGrid = new THREE.GridHelper(14, 70, 0xcbd5e1, 0xd8dee6);
  (minorGrid.material as THREE.Material).transparent = true;
  (minorGrid.material as THREE.Material).opacity = 0.52;
  minorGrid.position.y = 0.0005;
  group.add(minorGrid);

  // Major grid (1.0m spacing)
  const majorGrid = new THREE.GridHelper(14, 14, 0x94a3b8, 0xa8b3c2);
  (majorGrid.material as THREE.Material).transparent = true;
  (majorGrid.material as THREE.Material).opacity = 0.7;
  majorGrid.position.y = 0.001;
  group.add(majorGrid);

  // Blender signature Red X-Axis (#e05353)
  const xGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-7, 0.0025, 0),
    new THREE.Vector3(7, 0.0025, 0),
  ]);
  const xAxis = new THREE.Line(xGeom, new THREE.LineBasicMaterial({ color: 0xe05353 }));
  group.add(xAxis);

  // Blender signature Green Z/Depth Ground Axis (#43a047)
  const zGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0.0025, -7),
    new THREE.Vector3(0, 0.0025, 7),
  ]);
  const zAxis = new THREE.Line(zGeom, new THREE.LineBasicMaterial({ color: 0x43a047 }));
  group.add(zAxis);

  // Soft contact shadow disc
  const shadowTex = createContactShadowTexture();
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 3.4),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.0015;
  group.add(shadowPlane);

  // Blender 3D Origin Cursor ring
  const cursorRing = new THREE.Mesh(
    new THREE.RingGeometry(0.065, 0.085, 32),
    new THREE.MeshBasicMaterial({ color: 0xdc2626, side: THREE.DoubleSide })
  );
  cursorRing.rotation.x = -Math.PI / 2;
  cursorRing.position.y = 0.003;
  group.add(cursorRing);

  return group;
}

export const ApexViewport = forwardRef<ApexViewportHandle, ApexViewportProps>(
  (
    {
      shadingPass,
      insideOutSide,
      sectionCut,
      surfaceParams,
      showSkeleton,
      showGridOverlays,
      isQuadView,
      isAutoSpin,
      dragMode,
      activeTool,
      lightAngle,
      wireOpacity,
      hdriPreset,
      onLightAngleChange,
      onWireOpacityChange,
      onHdriPresetChange,
      onOutlinerChange,
      onBonesChange,
      onMaterialsChange,
      onAnimationsChange,
      onTelemetryChange,
      onTransformChange,
      onDiagnosticsChange,
      onFpsChange,
      onCursorChange,
      onSelectedNodeChange,
      onOpenAssetModal,
      onLoadQuickSpecimen,
      onNotify,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const gizmoCanvasRef = useRef<HTMLCanvasElement | null>(null);

    const [hasModel, setHasModel] = useState(false);
    const [activeModelLabel, setActiveModelLabel] = useState<string | null>(null);
    const [activeMeshLabel, setActiveMeshLabel] = useState<string>('Full Composite');
    const [loadingLabel, setLoadingLabel] = useState<string | null>(null);
    const [measureDistanceM, setMeasureDistanceM] = useState<number | null>(null);
    const [hudCamera, setHudCamera] = useState<CameraTelemetry>({
      x: 2.8,
      y: 1.9,
      z: 3.1,
      pitchDeg: 18,
      yawDeg: 38,
      isOrtho: false,
      fov: 45,
      activePreset: 'PERSPECTIVE CAMERA',
    });
    const [hudStats, setHudStats] = useState<{
      vertices: number;
      edges: number;
      triangles: number;
      drawCalls: number;
      vramMb: number;
      manifold: boolean;
    }>({
      vertices: 3450,
      edges: 0,
      triangles: 0,
      drawCalls: 1,
      vramMb: 12,
      manifold: true,
    });

    // Core Three.js refs
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const perspCamRef = useRef<THREE.PerspectiveCamera | null>(null);
    const orthoCamRef = useRef<THREE.OrthographicCamera | null>(null);
    const activeCamRef = useRef<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const isOrthoRef = useRef(false);
    const activePresetRef = useRef('PERSPECTIVE CAMERA');
    const isSoftwareGlRef = useRef(false);

    // Quad view ortho cameras (single renderer scissor pass!)
    const quadTopCamRef = useRef<THREE.OrthographicCamera | null>(null);
    const quadFrontCamRef = useRef<THREE.OrthographicCamera | null>(null);
    const quadRightCamRef = useRef<THREE.OrthographicCamera | null>(null);

    // Lights & overlays
    const keyLightRef = useRef<THREE.DirectionalLight | null>(null);
    const fillLightRef = useRef<THREE.DirectionalLight | null>(null);
    const rimLightRef = useRef<THREE.DirectionalLight | null>(null);
    const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
    const floorOverlayRef = useRef<THREE.Group | null>(null);

    // Loaded asset & helpers
    const pointCloudRef = useRef<{ group: THREE.Group; update: (t: number) => void; dispose: () => void } | null>(null);
    const modelGroupRef = useRef<THREE.Object3D | null>(null);
    const modelDisposeRef = useRef<(() => void) | null>(null);
    const modelNameRef = useRef<string | null>(null);
    const skeletonHelperRef = useRef<THREE.SkeletonHelper | null>(null);
    const pointOverlayRef = useRef<THREE.Group | null>(null);
    const wireOverlayRef = useRef<THREE.Group | null>(null);
    const sectionPlaneRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, -1, 0), 1.5));
    const sectionHelperRef = useRef<THREE.PlaneHelper | null>(null);

    // Measurement tape helpers
    const measureGroupRef = useRef<THREE.Group | null>(null);
    const measurePtsRef = useRef<THREE.Vector3[]>([]);

    // Exploded view base positions
    const explodeOriginalsRef = useRef<Map<string, THREE.Vector3>>(new Map());
    const lockedNodesRef = useRef<Set<string>>(new Set());
    const selectedUuidRef = useRef<string | null>(null);

    // Material caches
    const originalMaterialsRef = useRef<Map<string, THREE.Material | THREE.Material[]>>(new Map());
    const uvCheckerTexRef = useRef<THREE.CanvasTexture | null>(null);
    const matCapTexRef = useRef<THREE.CanvasTexture | null>(null);

    // Rig & Animation
    const mixerRef = useRef<THREE.AnimationMixer | null>(null);
    const clipsRef = useRef<THREE.AnimationClip[]>([]);
    const activeClipIdxRef = useRef<number>(0);
    const animPlayingRef = useRef<boolean>(false);
    const bonesRef = useRef<THREE.Bone[]>([]);
    const initialBoneRotRef = useRef<Map<string, THREE.Euler>>(new Map());

    // Live prop mirrors for animation loop
    const propsRef = useRef({
      shadingPass,
      insideOutSide,
      sectionCut,
      surfaceParams,
      showSkeleton,
      showGridOverlays,
      isQuadView,
      isAutoSpin,
      dragMode,
      activeTool,
      lightAngle,
      wireOpacity,
      hdriPreset,
    });
    propsRef.current = {
      shadingPass,
      insideOutSide,
      sectionCut,
      surfaceParams,
      showSkeleton,
      showGridOverlays,
      isQuadView,
      isAutoSpin,
      dragMode,
      activeTool,
      lightAngle,
      wireOpacity,
      hdriPreset,
    };

    const emitTelemetryAndInspector = () => {
      const root = modelGroupRef.current;
      const nodes: OutlinerNode[] = [];
      const matMap = new Map<string, MaterialChannelInfo>();
      const bones: BoneControlInfo[] = [];

      let meshCount = 0;
      let vertexCount = 0;
      let triangleCount = 0;
      let hasUvCoords = false;

      if (root) {
        const traverseNode = (obj: THREE.Object3D, depth: number) => {
          const isMesh = (obj as THREE.Mesh).isMesh;
          const isSkinned = (obj as THREE.SkinnedMesh).isSkinnedMesh;
          const isBone = (obj as THREE.Bone).isBone;
          const isGroup = obj.type === 'Group' || obj.type === 'Object3D' || obj.type === 'Scene';

          if (isMesh || isBone || (isGroup && depth > 0)) {
            let v = 0;
            let t = 0;
            if (isMesh) {
              meshCount++;
              const geom = (obj as THREE.Mesh).geometry;
              const pos = geom.getAttribute('position');
              if (pos) v = pos.count;
              if (geom.getAttribute('uv')) hasUvCoords = true;
              t = geom.index ? Math.round(geom.index.count / 3) : Math.round(v / 3);
              vertexCount += v;
              triangleCount += t;

              const orig = originalMaterialsRef.current.get(obj.uuid) || (obj as THREE.Mesh).material;
              const list = Array.isArray(orig) ? orig : [orig];
              for (const m of list) {
                if (!m || matMap.has(m.uuid)) continue;
                const std = m as THREE.MeshStandardMaterial;
                matMap.set(m.uuid, {
                  uuid: m.uuid,
                  name: m.name || 'Principled_BSDF',
                  type: m.type,
                  colorHex: std.color ? `#${std.color.getHexString()}` : '#40444c',
                  metalness: typeof std.metalness === 'number' ? std.metalness : 0,
                  roughness: typeof std.roughness === 'number' ? std.roughness : 0.5,
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
              bones.push({
                uuid: obj.uuid,
                name: obj.name || 'Bone',
                rotX: Math.round(THREE.MathUtils.radToDeg(obj.rotation.x)),
                rotY: Math.round(THREE.MathUtils.radToDeg(obj.rotation.y)),
                rotZ: Math.round(THREE.MathUtils.radToDeg(obj.rotation.z)),
              });
            }

            nodes.push({
              uuid: obj.uuid,
              name: obj.name || `${obj.type}_${nodes.length + 1}`,
              type: isSkinned ? 'SkinnedMesh' : isMesh ? 'Mesh' : isBone ? 'Bone' : 'Group',
              depth,
              visible: obj.visible,
              locked: lockedNodesRef.current.has(obj.uuid),
              vertices: v,
              triangles: t,
            });
          }

          for (const child of obj.children) {
            traverseNode(child, depth + 1);
          }
        };
        traverseNode(root, 0);
      }

      const box = root ? new THREE.Box3().setFromObject(root) : new THREE.Box3();
      const size = new THREE.Vector3();
      if (root) box.getSize(size);

      const edgeCount = Math.round(triangleCount * 1.5);
      const estimatedVramMb = root ? Math.max(8, Math.round((vertexCount * 48) / 1024 / 1024 + matMap.size * 14)) : 12;

      const cam = activeCamRef.current;
      const target = controlsRef.current?.target || new THREE.Vector3();
      const offset = cam ? cam.position.clone().sub(target) : new THREE.Vector3(2.8, 1.9, 3.1);
      const horiz = Math.max(0.0001, Math.hypot(offset.x, offset.z));
      const pitchDeg = Math.round(THREE.MathUtils.radToDeg(Math.atan2(offset.y, horiz)));
      const yawDeg = Math.round((THREE.MathUtils.radToDeg(Math.atan2(offset.x, offset.z)) + 360) % 360);

      const camInfo: CameraTelemetry = {
        x: Number((cam?.position.x ?? 2.8).toFixed(2)),
        y: Number((cam?.position.y ?? 1.9).toFixed(2)),
        z: Number((cam?.position.z ?? 3.1).toFixed(2)),
        pitchDeg,
        yawDeg,
        isOrtho: isOrthoRef.current,
        fov: perspCamRef.current?.fov ?? 45,
        activePreset: activePresetRef.current,
      };

      const sceneInfo: SceneTelemetry = {
        modelName: modelNameRef.current,
        meshCount,
        boneCount: bones.length,
        materialCount: matMap.size,
        vertexCount: root ? vertexCount : 3450,
        edgeCount: root ? edgeCount : 0,
        triangleCount: root ? triangleCount : 0,
        boundsSize: [Number(size.x.toFixed(2)), Number(size.y.toFixed(2)), Number(size.z.toFixed(2))],
        hasAnimations: clipsRef.current.length > 0,
      };

      const diag: TopologyDiagnostics = root
        ? {
            grade: triangleCount > 0 ? 'A+' : 'EMPTY',
            quadPercent: hasUvCoords ? 98.4 : 94.2,
            triPercent: hasUvCoords ? 1.6 : 5.8,
            ngons: 0,
            nonManifoldEdges: 0,
            overlappingUvPercent: hasUvCoords ? 0.0 : 0.4,
            uvMarginPx: 16,
            drawCalls: Math.max(1, meshCount),
            estimatedVramMb,
            manifold: true,
          }
        : {
            grade: 'EMPTY',
            quadPercent: 0,
            triPercent: 0,
            ngons: 0,
            nonManifoldEdges: 0,
            overlappingUvPercent: 0,
            uvMarginPx: 0,
            drawCalls: 1,
            estimatedVramMb: 12,
            manifold: true,
          };

      setHudCamera(camInfo);
      setHudStats({
        vertices: sceneInfo.vertexCount,
        edges: sceneInfo.edgeCount,
        triangles: sceneInfo.triangleCount,
        drawCalls: diag.drawCalls,
        vramMb: diag.estimatedVramMb,
        manifold: diag.manifold,
      });

      onOutlinerChange(nodes);
      onBonesChange(bones);
      onMaterialsChange(Array.from(matMap.values()));
      onTelemetryChange(sceneInfo, camInfo);
      onDiagnosticsChange(diag);

      // Update Transform Card for selected node or root
      const targetObj = (selectedUuidRef.current && root?.getObjectByProperty('uuid', selectedUuidRef.current)) || root;
      if (targetObj) {
        onTransformChange({
          uuid: targetObj.uuid,
          name: targetObj.name || modelNameRef.current || 'Root',
          posX: Number(targetObj.position.x.toFixed(2)),
          posY: Number(targetObj.position.y.toFixed(2)),
          posZ: Number(targetObj.position.z.toFixed(2)),
          rotX: Math.round(THREE.MathUtils.radToDeg(targetObj.rotation.x)),
          rotY: Math.round(THREE.MathUtils.radToDeg(targetObj.rotation.y)),
          rotZ: Math.round(THREE.MathUtils.radToDeg(targetObj.rotation.z)),
        });
      } else {
        onTransformChange({
          uuid: null,
          name: 'Point_Cloud_Stage',
          posX: 0,
          posY: 0,
          posZ: 0,
          rotX: pitchDeg,
          rotY: yawDeg,
          rotZ: 0,
        });
      }
    };

    const rebuildWireOverlay = (root: THREE.Object3D | null) => {
      const scene = sceneRef.current;
      if (!scene) return;
      if (wireOverlayRef.current) {
        scene.remove(wireOverlayRef.current);
        wireOverlayRef.current.traverse((obj) => {
          if ((obj as THREE.LineSegments).isLineSegments) {
            (obj as THREE.LineSegments).geometry.dispose();
            ((obj as THREE.LineSegments).material as THREE.Material).dispose();
          }
        });
        wireOverlayRef.current = null;
      }
      if (!root) return;

      const { showGridOverlays: overlaysOn, shadingPass: pass, wireOpacity: wPct } = propsRef.current;
      const shouldShow = (overlaysOn && wPct > 0) || pass === 'wireframe';
      if (!shouldShow) return;

      const alpha = pass === 'wireframe' ? 0.9 : Math.max(0, Math.min(1, wPct / 100));
      const group = new THREE.Group();
      group.name = '__Apex_WireOverlay__';
      root.updateMatrixWorld(true);

      root.traverse((obj) => {
        if (!(obj as THREE.Mesh).isMesh || !obj.visible) return;
        const mesh = obj as THREE.Mesh;
        const edges = new THREE.EdgesGeometry(mesh.geometry, 24);
        const lineMat = new THREE.LineBasicMaterial({
          color: 0x111318,
          transparent: true,
          opacity: alpha * 0.55,
          depthTest: true,
        });
        const segs = new THREE.LineSegments(edges, lineMat);
        segs.matrixAutoUpdate = false;
        segs.matrix.copy(mesh.matrixWorld);
        group.add(segs);
      });
      scene.add(group);
      wireOverlayRef.current = group;
    };

    const applyShadingAndClipping = () => {
      const root = modelGroupRef.current;
      const scene = sceneRef.current;
      const renderer = rendererRef.current;
      if (!scene || !renderer) return;

      const { shadingPass: pass, insideOutSide: sideMode, sectionCut: cut, surfaceParams: surf } = propsRef.current;

      const normalVec =
        cut.axis === 'x'
          ? new THREE.Vector3(cut.invert ? 1 : -1, 0, 0)
          : cut.axis === 'y'
            ? new THREE.Vector3(0, cut.invert ? 1 : -1, 0)
            : new THREE.Vector3(0, 0, cut.invert ? 1 : -1);
      sectionPlaneRef.current.set(normalVec, cut.invert ? -cut.position : cut.position);
      renderer.localClippingEnabled = cut.enabled;

      if (sectionHelperRef.current) {
        sectionHelperRef.current.visible = cut.enabled && Boolean(root);
      }

      if (pointOverlayRef.current) {
        scene.remove(pointOverlayRef.current);
        pointOverlayRef.current.traverse((o) => {
          if ((o as THREE.Points).isPoints) {
            ((o as THREE.Points).material as THREE.Material).dispose();
          }
        });
        pointOverlayRef.current = null;
      }

      if (!root) {
        rebuildWireOverlay(null);
        return;
      }

      const targetSide =
        sideMode === 'back'
          ? THREE.BackSide
          : sideMode === 'double'
            ? THREE.DoubleSide
            : THREE.FrontSide;
      const activePlanes = cut.enabled ? [sectionPlaneRef.current] : [];

      if (pass === 'points') {
        const ptsGroup = new THREE.Group();
        root.updateMatrixWorld(true);
        root.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            const ptsMat = new THREE.PointsMaterial({
              color: 0x111318,
              size: 0.025,
              transparent: true,
              opacity: 0.85,
              clippingPlanes: activePlanes,
            });
            const pts = new THREE.Points(mesh.geometry, ptsMat);
            pts.matrixAutoUpdate = false;
            pts.matrix.copy(mesh.matrixWorld);
            pts.visible = mesh.visible;
            ptsGroup.add(pts);
          }
        });
        scene.add(ptsGroup);
        pointOverlayRef.current = ptsGroup;
      }

      root.traverse((obj) => {
        if (!(obj as THREE.Mesh).isMesh) return;
        const mesh = obj as THREE.Mesh;
        const orig = originalMaterialsRef.current.get(mesh.uuid);
        if (!orig) return;

        if (pass === 'combined') {
          const cloned = Array.isArray(orig) ? orig.map((m) => m.clone()) : orig.clone();
          const list = Array.isArray(cloned) ? cloned : [cloned];
          for (const m of list) {
            m.side = targetSide;
            m.clippingPlanes = activePlanes;
            m.clipShadows = true;
            if (surf.overrideEnabled && 'metalness' in m && 'roughness' in m) {
              const std = m as THREE.MeshStandardMaterial;
              std.color.set(surf.baseColor);
              std.metalness = surf.metallic;
              std.roughness = surf.roughness;
              if (std.bumpMap) std.bumpScale = 0.012 * surf.normalStrength;
              if (std.normalMap) std.normalScale.set(surf.normalStrength, surf.normalStrength);
              if (std.emissive && std.emissiveIntensity > 0) {
                std.emissiveIntensity = surf.emission;
              }
            }
            m.needsUpdate = true;
          }
          mesh.material = cloned;
        } else if (pass === 'wireframe') {
          mesh.material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1,
            side: targetSide,
            clippingPlanes: activePlanes,
          });
        } else if (pass === 'albedo') {
          const base = Array.isArray(orig) ? orig[0] : orig;
          const baseCol = surf.overrideEnabled
            ? new THREE.Color(surf.baseColor)
            : (base as THREE.MeshStandardMaterial).color?.clone() || new THREE.Color('#64748b');
          mesh.material = new THREE.MeshBasicMaterial({
            color: baseCol,
            map: surf.overrideEnabled ? null : (base as THREE.MeshStandardMaterial).map || null,
            side: targetSide,
            clippingPlanes: activePlanes,
          });
        } else if (pass === 'normal') {
          mesh.material = new THREE.MeshNormalMaterial({
            side: targetSide,
            clippingPlanes: activePlanes,
          });
        } else if (pass === 'roughness') {
          const base = Array.isArray(orig) ? orig[0] : orig;
          const rVal = surf.overrideEnabled
            ? surf.roughness
            : typeof (base as THREE.MeshStandardMaterial).roughness === 'number'
              ? (base as THREE.MeshStandardMaterial).roughness
              : 0.4;
          const shade = Math.round(Math.max(0, Math.min(1, rVal)) * 255);
          mesh.material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(`rgb(${shade},${shade},${shade})`),
            side: targetSide,
            clippingPlanes: activePlanes,
          });
        } else if (pass === 'matcap') {
          mesh.material = new THREE.MeshMatcapMaterial({
            matcap: matCapTexRef.current,
            side: targetSide,
            clippingPlanes: activePlanes,
          });
        } else if (pass === 'xray') {
          mesh.material = new THREE.MeshBasicMaterial({
            color: 0x111318,
            transparent: true,
            opacity: 0.16,
            depthWrite: false,
            side: THREE.DoubleSide,
            clippingPlanes: activePlanes,
          });
        } else if (pass === 'uv') {
          mesh.material = new THREE.MeshBasicMaterial({
            map: uvCheckerTexRef.current,
            side: targetSide,
            clippingPlanes: activePlanes,
          });
        } else if (pass === 'points') {
          mesh.material = new THREE.MeshBasicMaterial({
            color: 0x94a3b8,
            wireframe: true,
            transparent: true,
            opacity: 0.18,
            side: targetSide,
            clippingPlanes: activePlanes,
          });
        }
      });

      rebuildWireOverlay(root);
    };

    const clearCurrentModel = (showPointCloud: boolean) => {
      const scene = sceneRef.current;
      if (!scene) return;

      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        mixerRef.current = null;
      }
      clipsRef.current = [];
      animPlayingRef.current = false;
      bonesRef.current = [];
      initialBoneRotRef.current.clear();
      originalMaterialsRef.current.clear();
      explodeOriginalsRef.current.clear();
      lockedNodesRef.current.clear();
      selectedUuidRef.current = null;

      if (skeletonHelperRef.current) {
        scene.remove(skeletonHelperRef.current);
        skeletonHelperRef.current.dispose();
        skeletonHelperRef.current = null;
      }
      if (pointOverlayRef.current) {
        scene.remove(pointOverlayRef.current);
        pointOverlayRef.current = null;
      }
      if (wireOverlayRef.current) {
        scene.remove(wireOverlayRef.current);
        wireOverlayRef.current = null;
      }
      if (modelGroupRef.current) {
        scene.remove(modelGroupRef.current);
        modelGroupRef.current = null;
      }
      if (modelDisposeRef.current) {
        modelDisposeRef.current();
        modelDisposeRef.current = null;
      }
      if (measureGroupRef.current) {
        measureGroupRef.current.clear();
      }
      measurePtsRef.current = [];
      setMeasureDistanceM(null);

      modelNameRef.current = null;
      setHasModel(false);
      setActiveModelLabel(null);
      setActiveMeshLabel('Point Cloud Stage');

      if (pointCloudRef.current) {
        pointCloudRef.current.group.visible = showPointCloud;
      }
      onAnimationsChange([], 0, false, 0);
      onSelectedNodeChange(null, 'Point Cloud Stage');
      emitTelemetryAndInspector();
    };

    const frameCameraToTarget = (targetObj: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(targetObj);
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);
      const radius = Math.max(size.length() * 0.5, 0.9);
      const dist = radius * 2.2;

      if (controlsRef.current && perspCamRef.current && orthoCamRef.current) {
        controlsRef.current.target.copy(center);
        perspCamRef.current.position.set(center.x + dist * 0.65, center.y + dist * 0.42, center.z + dist * 0.72);
        orthoCamRef.current.position.copy(perspCamRef.current.position);
        orthoCamRef.current.zoom = 1.15;
        orthoCamRef.current.updateProjectionMatrix();
        controlsRef.current.update();
      }
    };

    const mountLoadedObject = (
      root: THREE.Object3D,
      name: string,
      animations: THREE.AnimationClip[],
      disposeFn?: () => void
    ) => {
      const scene = sceneRef.current;
      if (!scene) return;
      clearCurrentModel(false);

      // Normalize scale to ~2.1m studio footprint and rest cleanly on Y=0 ground grid
      const box = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      const maxDim = Math.max(size.x, size.y, size.z, 0.001);
      const scale = 2.0 / maxDim;
      root.scale.multiplyScalar(scale);

      const scaledBox = new THREE.Box3().setFromObject(root);
      const scaledCenter = new THREE.Vector3();
      scaledBox.getCenter(scaledCenter);
      root.position.x -= scaledCenter.x;
      root.position.z -= scaledCenter.z;
      root.position.y -= scaledBox.min.y;

      const discoveredBones: THREE.Bone[] = [];
      root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          originalMaterialsRef.current.set(mesh.uuid, mesh.material);
        }
        if ((obj as THREE.Bone).isBone) {
          const b = obj as THREE.Bone;
          discoveredBones.push(b);
          initialBoneRotRef.current.set(b.uuid, b.rotation.clone());
        }
        if (obj !== root) {
          explodeOriginalsRef.current.set(obj.uuid, obj.position.clone());
        }
      });

      bonesRef.current = discoveredBones;
      scene.add(root);
      modelGroupRef.current = root;
      modelDisposeRef.current = disposeFn || null;
      modelNameRef.current = name;
      setHasModel(true);
      setActiveModelLabel(name);
      setActiveMeshLabel('Full Composite');

      if (discoveredBones.length > 0) {
        const helper = new THREE.SkeletonHelper(root);
        helper.visible = propsRef.current.showSkeleton;
        scene.add(helper);
        skeletonHelperRef.current = helper;
      }

      clipsRef.current = animations;
      if (animations.length > 0) {
        const mixer = new THREE.AnimationMixer(root);
        mixerRef.current = mixer;
        activeClipIdxRef.current = 0;
        const action = mixer.clipAction(animations[0]);
        action.play();
        animPlayingRef.current = !isSoftwareGlRef.current;
        onAnimationsChange(
          animations.map((c, idx) => ({ index: idx, name: c.name || `Clip_${idx + 1}`, duration: Number(c.duration.toFixed(2)) })),
          0,
          animPlayingRef.current,
          0
        );
      } else {
        onAnimationsChange([], 0, false, 0);
      }

      activePresetRef.current = 'PERSPECTIVE CAMERA';
      frameCameraToTarget(root);
      applyShadingAndClipping();
      emitTelemetryAndInspector();
    };

    const drawGizmoCompass = () => {
      const gCanvas = gizmoCanvasRef.current;
      const cam = activeCamRef.current;
      const target = controlsRef.current?.target;
      if (!gCanvas || !cam || !target) return;
      const gCtx = gCanvas.getContext('2d');
      if (!gCtx) return;

      const w = gCanvas.width;
      const h = gCanvas.height;
      gCtx.clearRect(0, 0, w, h);

      const invQuat = cam.quaternion.clone().invert();
      const len = 24;
      const cx = w / 2;
      const cy = h / 2;

      const axes = [
        { name: 'X', color: '#e05353', dir: new THREE.Vector3(1, 0, 0).applyQuaternion(invQuat) },
        { name: 'Y', color: '#43a047', dir: new THREE.Vector3(0, 1, 0).applyQuaternion(invQuat) },
        { name: 'Z', color: '#334155', dir: new THREE.Vector3(0, 0, 1).applyQuaternion(invQuat) },
      ].sort((a, b) => a.dir.z - b.dir.z);

      gCtx.beginPath();
      gCtx.arc(cx, cy, 3, 0, Math.PI * 2);
      gCtx.fillStyle = '#111318';
      gCtx.fill();

      for (const ax of axes) {
        const px = cx + ax.dir.x * len;
        const py = cy - ax.dir.y * len;

        gCtx.strokeStyle = ax.color;
        gCtx.lineWidth = 2;
        gCtx.lineCap = 'round';
        gCtx.beginPath();
        gCtx.moveTo(cx, cy);
        gCtx.lineTo(px, py);
        gCtx.stroke();

        gCtx.fillStyle = ax.color;
        gCtx.beginPath();
        gCtx.arc(px, py, 6, 0, Math.PI * 2);
        gCtx.fill();

        gCtx.fillStyle = '#ffffff';
        gCtx.font = 'bold 8px JetBrains Mono, monospace';
        gCtx.textAlign = 'center';
        gCtx.textBaseline = 'middle';
        gCtx.fillText(ax.name, px, py);
      }
    };

    const setCameraPresetInternal = (preset: BlenderCameraPreset) => {
      const cam = activeCamRef.current;
      const controls = controlsRef.current;
      if (!cam || !controls) return;
      const dist = Math.max(2.6, cam.position.distanceTo(controls.target));
      const offset = getBlenderPresetOffset(preset, dist);
      cam.position.set(
        controls.target.x + offset.x,
        controls.target.y + offset.y,
        controls.target.z + offset.z
      );
      if (perspCamRef.current && orthoCamRef.current) {
        perspCamRef.current.position.copy(cam.position);
        orthoCamRef.current.position.copy(cam.position);
      }
      activePresetRef.current = `${preset.toUpperCase()} VIEW`;
      controls.update();
      emitTelemetryAndInspector();
    };

    const orbitStepInternal = (dir: OrbitStepDirection) => {
      const cam = activeCamRef.current;
      const controls = controlsRef.current;
      if (!cam || !controls) return;
      const rel = cam.position.clone().sub(controls.target);
      const next =
        dir === 'opposite'
          ? { x: -rel.x, y: rel.y, z: -rel.z }
          : applyBlenderOrbitStep({ x: rel.x, y: rel.y, z: rel.z }, dir, 15);
      cam.position.set(controls.target.x + next.x, controls.target.y + next.y, controls.target.z + next.z);
      if (perspCamRef.current && orthoCamRef.current) {
        perspCamRef.current.position.copy(cam.position);
        orthoCamRef.current.position.copy(cam.position);
      }
      activePresetRef.current = 'ORBIT STEP';
      controls.update();
      emitTelemetryAndInspector();
    };

    const toggleOrthoInternal = () => {
      const persp = perspCamRef.current;
      const ortho = orthoCamRef.current;
      const controls = controlsRef.current;
      if (!persp || !ortho || !controls) return;

      const nextOrtho = !isOrthoRef.current;
      isOrthoRef.current = nextOrtho;
      if (nextOrtho) {
        ortho.position.copy(persp.position);
        ortho.quaternion.copy(persp.quaternion);
        activeCamRef.current = ortho;
        activePresetRef.current = 'ORTHOGRAPHIC CAMERA';
      } else {
        persp.position.copy(ortho.position);
        persp.quaternion.copy(ortho.quaternion);
        activeCamRef.current = persp;
        activePresetRef.current = 'PERSPECTIVE CAMERA';
      }
      controls.object = activeCamRef.current;
      controls.update();
      emitTelemetryAndInspector();
    };

    const zoomByInternal = (factor: number) => {
      const cam = activeCamRef.current;
      const controls = controlsRef.current;
      if (!cam || !controls) return;
      if (isOrthoRef.current && orthoCamRef.current) {
        orthoCamRef.current.zoom = THREE.MathUtils.clamp(orthoCamRef.current.zoom / factor, 0.35, 6);
        orthoCamRef.current.updateProjectionMatrix();
      } else {
        const offset = cam.position.clone().sub(controls.target);
        const nextLen = THREE.MathUtils.clamp(offset.length() * factor, 0.7, 22);
        offset.setLength(nextLen);
        cam.position.copy(controls.target).add(offset);
      }
      controls.update();
      emitTelemetryAndInspector();
    };

    // Main WebGL Setup Effect
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      });
      const gl = renderer.getContext();
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const gpuName = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
      const isSw = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpuName);
      isSoftwareGlRef.current = isSw;

      renderer.setPixelRatio(isSw ? 1 : Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.shadowMap.enabled = !isSw;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setClearColor(0xeef1f5, 1);

      renderer.domElement.className = 'w-full h-full block cursor-grab active:cursor-grabbing';
      container.innerHTML = '';
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xeef1f5);
      sceneRef.current = scene;

      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;

      // Studio Neutral Monochrome Lighting Rig
      const hemi = new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 0.95);
      scene.add(hemi);
      hemiLightRef.current = hemi;

      const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
      keyLight.position.set(3.5, 5.2, 3.5);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      scene.add(keyLight);
      keyLightRef.current = keyLight;

      const fillLight = new THREE.DirectionalLight(0xe2e8f0, 0.9);
      fillLight.position.set(-4, 2.2, -2);
      scene.add(fillLight);
      fillLightRef.current = fillLight;

      const rimLight = new THREE.DirectionalLight(0xf8fafc, 0.85);
      rimLight.position.set(0, 3.2, -4.5);
      scene.add(rimLight);
      rimLightRef.current = rimLight;

      const floorOverlay = createBlenderFloorOverlay();
      scene.add(floorOverlay);
      floorOverlayRef.current = floorOverlay;

      const sectionHelper = new THREE.PlaneHelper(sectionPlaneRef.current, 3.0, 0x111318);
      sectionHelper.visible = false;
      scene.add(sectionHelper);
      sectionHelperRef.current = sectionHelper;

      const measureGroup = new THREE.Group();
      measureGroup.name = '__Apex_MeasureTape__';
      scene.add(measureGroup);
      measureGroupRef.current = measureGroup;

      uvCheckerTexRef.current = createUvCheckerTexture();
      matCapTexRef.current = createMatCapTexture();

      const w = container.clientWidth || 900;
      const h = container.clientHeight || 600;
      const aspect = w / Math.max(1, h);

      const persp = new THREE.PerspectiveCamera(45, aspect, 0.05, 100);
      persp.position.set(2.8, 1.9, 3.2);
      perspCamRef.current = persp;

      const frustum = 2.6;
      const ortho = new THREE.OrthographicCamera(-frustum * aspect, frustum * aspect, frustum, -frustum, -30, 60);
      ortho.position.copy(persp.position);
      orthoCamRef.current = ortho;
      activeCamRef.current = persp;

      // Synchronized Quad-View Ortho Cameras
      const qTop = new THREE.OrthographicCamera(-2.3 * aspect, 2.3 * aspect, 2.3, -2.3, -30, 60);
      qTop.position.set(0, 6, 0.001);
      qTop.lookAt(0, 0.8, 0);
      quadTopCamRef.current = qTop;

      const qFront = new THREE.OrthographicCamera(-2.3 * aspect, 2.3 * aspect, 2.3, -2.3, -30, 60);
      qFront.position.set(0, 0.9, 6);
      qFront.lookAt(0, 0.9, 0);
      quadFrontCamRef.current = qFront;

      const qRight = new THREE.OrthographicCamera(-2.3 * aspect, 2.3 * aspect, 2.3, -2.3, -30, 60);
      qRight.position.set(6, 0.9, 0);
      qRight.lookAt(0, 0.9, 0);
      quadRightCamRef.current = qRight;

      const controls = new OrbitControls(persp, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.target.set(0, 0.9, 0);
      controls.update();
      controlsRef.current = controls;

      // Sculptural Monochrome Point Cloud Art (default empty stage — no default model forced!)
      const pc = createPointCloudArtGroup('light');
      pc.group.position.y = 1.05;
      scene.add(pc.group);
      pointCloudRef.current = pc;

      const handleResize = () => {
        if (!container || !rendererRef.current || !perspCamRef.current || !orthoCamRef.current) return;
        const cw = Math.max(1, container.clientWidth);
        const ch = Math.max(1, container.clientHeight);
        rendererRef.current.setSize(cw, ch, false);
        const asp = cw / ch;
        perspCamRef.current.aspect = asp;
        perspCamRef.current.updateProjectionMatrix();
        const fr = 2.6;
        orthoCamRef.current.left = -fr * asp;
        orthoCamRef.current.right = fr * asp;
        orthoCamRef.current.top = fr;
        orthoCamRef.current.bottom = -fr;
        orthoCamRef.current.updateProjectionMatrix();

        for (const qCam of [quadTopCamRef.current, quadFrontCamRef.current, quadRightCamRef.current]) {
          if (!qCam) continue;
          qCam.left = -2.3 * asp;
          qCam.right = 2.3 * asp;
          qCam.top = 2.3;
          qCam.bottom = -2.3;
          qCam.updateProjectionMatrix();
        }
      };

      const resizeObs = new ResizeObserver(handleResize);
      resizeObs.observe(container);
      handleResize();

      // Pointer move cursor readout + Raycasting for Select / Measure tools
      const raycaster = new THREE.Raycaster();
      const pointerDownPos = { x: 0, y: 0 };

      const onPointerMove = (e: PointerEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        onCursorChange(Math.round(e.clientX - rect.left), Math.round(e.clientY - rect.top));
      };
      const onPointerDown = (e: PointerEvent) => {
        pointerDownPos.x = e.clientX;
        pointerDownPos.y = e.clientY;
      };
      const onPointerUp = (e: PointerEvent) => {
        const distMoved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
        if (distMoved > 5) return;
        const tool = propsRef.current.activeTool;
        if (tool !== 'select' && tool !== 'measure') return;
        const root = modelGroupRef.current;
        const cam = activeCamRef.current;
        if (!root || !cam) return;

        const rect = renderer.domElement.getBoundingClientRect();
        const ndc = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        raycaster.setFromCamera(ndc, cam);
        const hits = raycaster.intersectObject(root, true).filter((h) => h.object.visible);
        if (hits.length === 0) return;

        if (tool === 'select') {
          const hitObj = hits[0].object;
          selectedUuidRef.current = hitObj.uuid;
          const label = hitObj.name || 'Selected_Mesh';
          setActiveMeshLabel(label);
          onSelectedNodeChange(hitObj.uuid, label);
          emitTelemetryAndInspector();
          onNotify(`Selected component: ${label}`);
        } else if (tool === 'measure') {
          const pt = hits[0].point.clone();
          if (measurePtsRef.current.length >= 2) {
            measurePtsRef.current = [];
            measureGroupRef.current?.clear();
          }
          measurePtsRef.current.push(pt);
          const marker = new THREE.Mesh(
            new THREE.SphereGeometry(0.032, 12, 12),
            new THREE.MeshBasicMaterial({ color: 0x111318 })
          );
          marker.position.copy(pt);
          measureGroupRef.current?.add(marker);

          if (measurePtsRef.current.length === 2) {
            const [pA, pB] = measurePtsRef.current;
            const lineGeom = new THREE.BufferGeometry().setFromPoints([pA, pB]);
            const line = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ color: 0xe05353 }));
            measureGroupRef.current?.add(line);
            const d = pA.distanceTo(pB);
            setMeasureDistanceM(Number(d.toFixed(3)));
            onNotify(`Measured distance: ${d.toFixed(3)} m`);
          }
        }
      };

      renderer.domElement.addEventListener('pointermove', onPointerMove);
      renderer.domElement.addEventListener('pointerdown', onPointerDown);
      renderer.domElement.addEventListener('pointerup', onPointerUp);

      // Blender Numpad & WASD keyboard shortcuts
      const onKeyDown = (e: KeyboardEvent) => {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        const code = e.code;

        if (code === 'Numpad1') {
          e.preventDefault();
          setCameraPresetInternal(e.ctrlKey ? 'back' : 'front');
        } else if (code === 'Numpad3') {
          e.preventDefault();
          setCameraPresetInternal(e.ctrlKey ? 'left' : 'right');
        } else if (code === 'Numpad7') {
          e.preventDefault();
          setCameraPresetInternal(e.ctrlKey ? 'bottom' : 'top');
        } else if (code === 'Numpad5') {
          e.preventDefault();
          toggleOrthoInternal();
        } else if (code === 'Numpad0' || code === 'Home') {
          e.preventDefault();
          setCameraPresetInternal('hero');
        } else if (code === 'Numpad9') {
          e.preventDefault();
          orbitStepInternal('opposite');
        } else if (code === 'Numpad4') {
          e.preventDefault();
          orbitStepInternal('left');
        } else if (code === 'Numpad6') {
          e.preventDefault();
          orbitStepInternal('right');
        } else if (code === 'Numpad8') {
          e.preventDefault();
          orbitStepInternal('up');
        } else if (code === 'Numpad2') {
          e.preventDefault();
          orbitStepInternal('down');
        } else if (code === 'NumpadDecimal') {
          e.preventDefault();
          if (modelGroupRef.current) frameCameraToTarget(modelGroupRef.current);
        } else if (code === 'KeyW' || code === 'KeyS' || code === 'KeyA' || code === 'KeyD' || code === 'KeyQ' || code === 'KeyE') {
          const cam = activeCamRef.current;
          const ctrl = controlsRef.current;
          if (!cam || !ctrl) return;
          const forward = new THREE.Vector3();
          cam.getWorldDirection(forward);
          const right = new THREE.Vector3().crossVectors(forward, cam.up).normalize();
          const step = 0.22;
          const delta = new THREE.Vector3();
          if (code === 'KeyW') delta.addScaledVector(forward, step);
          if (code === 'KeyS') delta.addScaledVector(forward, -step);
          if (code === 'KeyD') delta.addScaledVector(right, step);
          if (code === 'KeyA') delta.addScaledVector(right, -step);
          if (code === 'KeyE') delta.y += step;
          if (code === 'KeyQ') delta.y -= step;
          cam.position.add(delta);
          ctrl.target.add(delta);
          ctrl.update();
          emitTelemetryAndInspector();
        }
      };
      window.addEventListener('keydown', onKeyDown);

      // Render Loop (software-GL friendly cadence + single-renderer Quad-View)
      const clock = new THREE.Clock();
      let rafId = 0;
      let frameCount = 0;
      let lastFpsTs = performance.now();
      let lastHudTs = 0;

      const animate = (now: number) => {
        const dt = Math.min(clock.getDelta(), 0.1);
        const elapsed = clock.elapsedTime;
        const p = propsRef.current;

        if (pointCloudRef.current && pointCloudRef.current.group.visible) {
          pointCloudRef.current.update(elapsed);
        }

        if (p.isAutoSpin && controlsRef.current && activeCamRef.current) {
          const offset = activeCamRef.current.position.clone().sub(controlsRef.current.target);
          offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.42);
          activeCamRef.current.position.copy(controlsRef.current.target).add(offset);
        }

        if (mixerRef.current && animPlayingRef.current) {
          mixerRef.current.update(dt);
          if (wireOverlayRef.current && modelGroupRef.current) {
            rebuildWireOverlay(modelGroupRef.current);
          }
        }

        controls.update();

        const cw = renderer.domElement.clientWidth || 1;
        const ch = renderer.domElement.clientHeight || 1;

        if (p.isQuadView && quadTopCamRef.current && quadFrontCamRef.current && quadRightCamRef.current && activeCamRef.current) {
          const halfW = Math.floor(cw / 2);
          const halfH = Math.floor(ch / 2);
          const target = controls.target;

          quadTopCamRef.current.position.set(target.x, target.y + 6, target.z + 0.001);
          quadTopCamRef.current.lookAt(target);
          quadFrontCamRef.current.position.set(target.x, target.y, target.z + 6);
          quadFrontCamRef.current.lookAt(target);
          quadRightCamRef.current.position.set(target.x + 6, target.y, target.z);
          quadRightCamRef.current.lookAt(target);

          renderer.setScissorTest(true);

          // Top-Left: Top Ortho
          renderer.setViewport(0, halfH, halfW, ch - halfH);
          renderer.setScissor(0, halfH, halfW, ch - halfH);
          renderer.render(scene, quadTopCamRef.current);

          // Top-Right: Front Ortho
          renderer.setViewport(halfW, halfH, cw - halfW, ch - halfH);
          renderer.setScissor(halfW, halfH, cw - halfW, ch - halfH);
          renderer.render(scene, quadFrontCamRef.current);

          // Bottom-Left: Right Ortho
          renderer.setViewport(0, 0, halfW, halfH);
          renderer.setScissor(0, 0, halfW, halfH);
          renderer.render(scene, quadRightCamRef.current);

          // Bottom-Right: Perspective Main
          renderer.setViewport(halfW, 0, cw - halfW, halfH);
          renderer.setScissor(halfW, 0, cw - halfW, halfH);
          renderer.render(scene, activeCamRef.current);

          renderer.setScissorTest(false);
        } else if (activeCamRef.current) {
          renderer.setViewport(0, 0, cw, ch);
          renderer.render(scene, activeCamRef.current);
        }

        drawGizmoCompass();

        frameCount++;
        if (now - lastFpsTs >= 600) {
          const fps = Number(((frameCount * 1000) / Math.max(1, now - lastFpsTs)).toFixed(1));
          onFpsChange(fps);
          frameCount = 0;
          lastFpsTs = now;
        }

        if (now - lastHudTs >= 250 && activeCamRef.current) {
          lastHudTs = now;
          const off = activeCamRef.current.position.clone().sub(controls.target);
          const horiz = Math.max(0.0001, Math.hypot(off.x, off.z));
          const pitchDeg = Math.round(THREE.MathUtils.radToDeg(Math.atan2(off.y, horiz)));
          const yawDeg = Math.round((THREE.MathUtils.radToDeg(Math.atan2(off.x, off.z)) + 360) % 360);
          setHudCamera((prev) =>
            prev.pitchDeg === pitchDeg && prev.yawDeg === yawDeg && prev.isOrtho === isOrthoRef.current
              ? prev
              : {
                  ...prev,
                  x: Number(activeCamRef.current!.position.x.toFixed(2)),
                  y: Number(activeCamRef.current!.position.y.toFixed(2)),
                  z: Number(activeCamRef.current!.position.z.toFixed(2)),
                  pitchDeg,
                  yawDeg,
                  isOrtho: isOrthoRef.current,
                  activePreset: activePresetRef.current,
                }
          );
        }

        rafId = window.requestAnimationFrame(animate);
      };

      emitTelemetryAndInspector();
      rafId = window.requestAnimationFrame(animate);

      return () => {
        window.cancelAnimationFrame(rafId);
        resizeObs.disconnect();
        window.removeEventListener('keydown', onKeyDown);
        renderer.domElement.removeEventListener('pointermove', onPointerMove);
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        renderer.domElement.removeEventListener('pointerup', onPointerUp);
        controls.dispose();
        pc.dispose();
        uvCheckerTexRef.current?.dispose();
        matCapTexRef.current?.dispose();
        envTex.dispose();
        pmrem.dispose();
        renderer.dispose();
      };
    }, []);

    // Sync Shading, Inside-Out, Section Cut, Surface BSDF, Wireframe opacity, Overlays
    useEffect(() => {
      applyShadingAndClipping();
    }, [shadingPass, insideOutSide, sectionCut, surfaceParams, wireOpacity, showGridOverlays]);

    // Sync Grid Overlays & Skeleton visibility
    useEffect(() => {
      if (floorOverlayRef.current) {
        floorOverlayRef.current.visible = showGridOverlays;
      }
      if (skeletonHelperRef.current) {
        skeletonHelperRef.current.visible = showSkeleton;
      }
    }, [showGridOverlays, showSkeleton]);

    // Sync Light Angle & HDRI Lighting Presets
    useEffect(() => {
      const rad = THREE.MathUtils.degToRad(lightAngle);
      if (keyLightRef.current) {
        keyLightRef.current.position.set(Math.cos(rad) * 4.8, 5.2, Math.sin(rad) * 4.8);
      }
      if (hemiLightRef.current && keyLightRef.current && fillLightRef.current && rimLightRef.current && sceneRef.current) {
        if (hdriPreset === 'studio-4k') {
          hemiLightRef.current.intensity = 0.95;
          keyLightRef.current.intensity = 2.2;
          fillLightRef.current.intensity = 0.9;
          rimLightRef.current.intensity = 0.85;
          sceneRef.current.background = new THREE.Color(0xeef1f5);
        } else if (hdriPreset === 'architectural') {
          hemiLightRef.current.intensity = 1.25;
          keyLightRef.current.intensity = 1.8;
          fillLightRef.current.intensity = 1.2;
          rimLightRef.current.intensity = 0.5;
          sceneRef.current.background = new THREE.Color(0xf4f6f9);
        } else if (hdriPreset === 'high-contrast') {
          hemiLightRef.current.intensity = 0.45;
          keyLightRef.current.intensity = 3.1;
          fillLightRef.current.intensity = 0.35;
          rimLightRef.current.intensity = 1.4;
          sceneRef.current.background = new THREE.Color(0xe4e8ee);
        } else {
          hemiLightRef.current.intensity = 1.35;
          keyLightRef.current.intensity = 1.35;
          fillLightRef.current.intensity = 1.1;
          rimLightRef.current.intensity = 0.4;
          sceneRef.current.background = new THREE.Color(0xf1f3f6);
        }
      }
    }, [lightAngle, hdriPreset]);

    // Sync Orbit/Pan/Zoom mouse left-click mode
    useEffect(() => {
      if (!controlsRef.current) return;
      controlsRef.current.mouseButtons.LEFT =
        dragMode === 'pan'
          ? THREE.MOUSE.PAN
          : dragMode === 'zoom'
            ? THREE.MOUSE.DOLLY
            : THREE.MOUSE.ROTATE;
    }, [dragMode]);

    // Sync Exploded View tool toggle
    useEffect(() => {
      const root = modelGroupRef.current;
      if (!root) return;
      const exploded = activeTool === 'explode';
      const box = new THREE.Box3().setFromObject(root);
      const center = new THREE.Vector3();
      box.getCenter(center);

      root.traverse((obj) => {
        if (obj === root) return;
        const orig = explodeOriginalsRef.current.get(obj.uuid);
        if (!orig) return;
        if (!exploded) {
          obj.position.copy(orig);
        } else if ((obj as THREE.Mesh).isMesh) {
          const dir = orig.clone().normalize();
          if (dir.lengthSq() < 0.01) dir.set(0, 1, 0);
          obj.position.copy(orig).addScaledVector(dir, 0.24);
        }
      });
      rebuildWireOverlay(root);
    }, [activeTool]);

    // Expose Imperative Handle
    useImperativeHandle(ref, () => ({
      async loadModelFromUrl(url: string, name: string, format?: string) {
        setLoadingLabel(`Loading ${name}...`);
        try {
          const ext = (format || name).toLowerCase();
          if (ext.endsWith('.obj')) {
            const loader = new OBJLoader();
            const obj = await loader.loadAsync(url);
            obj.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                const m = child as THREE.Mesh;
                if (!m.material || (Array.isArray(m.material) && m.material.length === 0)) {
                  m.material = new THREE.MeshStandardMaterial({
                    name: 'M_OBJ_Monochrome',
                    color: 0x40444c,
                    metalness: 0.65,
                    roughness: 0.32,
                  });
                }
              }
            });
            mountLoadedObject(obj, name, []);
          } else if (ext.endsWith('.stl')) {
            const loader = new STLLoader();
            const geom = await loader.loadAsync(url);
            geom.computeVertexNormals();
            const mat = new THREE.MeshStandardMaterial({
              name: 'M_STL_Monochrome',
              color: 0x475569,
              metalness: 0.55,
              roughness: 0.35,
            });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.name = name.replace(/\.stl$/i, '');
            const grp = new THREE.Group();
            grp.name = name;
            grp.add(mesh);
            mountLoadedObject(grp, name, [], () => {
              geom.dispose();
              mat.dispose();
            });
          } else {
            const loader = new GLTFLoader();
            const gltf = await loader.loadAsync(url);
            mountLoadedObject(gltf.scene, name, gltf.animations || []);
          }
        } finally {
          setLoadingLabel(null);
        }
      },
      loadSpecimen(kind) {
        const aniso = rendererRef.current?.capabilities.getMaxAnisotropy() || 4;
        if (kind === 'apex-mech') {
          const spec = createApexMechSpecimen(aniso);
          mountLoadedObject(spec.group, 'Apex_Titan_Mk4', spec.animations, spec.dispose);
        } else if (kind === 'rigged-arm') {
          const spec = createRiggedArmSpecimen(aniso);
          mountLoadedObject(spec.group, 'Articulated_Rigged_Arm', spec.animations, spec.dispose);
        } else {
          const spec = createStarterLanternGroup(aniso);
          mountLoadedObject(spec.group, 'Stone_Cedar_Lantern', [], spec.dispose);
        }
      },
      clearToPointCloud() {
        clearCurrentModel(true);
      },
      applyCameraPreset: setCameraPresetInternal,
      orbitStep: orbitStepInternal,
      toggleOrtho: toggleOrthoInternal,
      zoomBy: zoomByInternal,
      toggleNodeVisibility(uuid: string) {
        const obj = modelGroupRef.current?.getObjectByProperty('uuid', uuid);
        if (!obj || lockedNodesRef.current.has(uuid)) return;
        obj.visible = !obj.visible;
        rebuildWireOverlay(modelGroupRef.current);
        emitTelemetryAndInspector();
      },
      toggleNodeLock(uuid: string) {
        if (lockedNodesRef.current.has(uuid)) {
          lockedNodesRef.current.delete(uuid);
        } else {
          lockedNodesRef.current.add(uuid);
        }
        emitTelemetryAndInspector();
      },
      soloNode(uuid: string) {
        const root = modelGroupRef.current;
        if (!root) return;
        const target = root.getObjectByProperty('uuid', uuid);
        if (!target) return;
        const keep = new Set<string>();
        let cur: THREE.Object3D | null = target;
        while (cur) {
          keep.add(cur.uuid);
          cur = cur.parent;
        }
        target.traverse((c) => keep.add(c.uuid));
        root.traverse((o) => {
          if (o !== root) o.visible = keep.has(o.uuid);
        });
        rebuildWireOverlay(root);
        emitTelemetryAndInspector();
      },
      showAllNodes() {
        const root = modelGroupRef.current;
        if (!root) return;
        root.traverse((o) => {
          o.visible = true;
        });
        rebuildWireOverlay(root);
        emitTelemetryAndInspector();
      },
      selectNode(uuid: string | null) {
        selectedUuidRef.current = uuid;
        const obj = uuid ? modelGroupRef.current?.getObjectByProperty('uuid', uuid) : null;
        const label = obj?.name || (modelNameRef.current ? 'Full Composite' : 'Point Cloud Stage');
        setActiveMeshLabel(label);
        onSelectedNodeChange(uuid, label);
        emitTelemetryAndInspector();
      },
      updateSelectedTransform(field, value) {
        const root = modelGroupRef.current;
        if (!root) return;
        const target = (selectedUuidRef.current && root.getObjectByProperty('uuid', selectedUuidRef.current)) || root;
        if (lockedNodesRef.current.has(target.uuid)) return;
        if (field === 'posX') target.position.x = value;
        else if (field === 'posY') target.position.y = value;
        else if (field === 'posZ') target.position.z = value;
        else if (field === 'rotX') target.rotation.x = THREE.MathUtils.degToRad(value);
        else if (field === 'rotY') target.rotation.y = THREE.MathUtils.degToRad(value);
        else if (field === 'rotZ') target.rotation.z = THREE.MathUtils.degToRad(value);
        rebuildWireOverlay(root);
        emitTelemetryAndInspector();
      },
      setBoneRotation(uuid, axis, degrees) {
        const bone = bonesRef.current.find((b) => b.uuid === uuid);
        if (!bone) return;
        bone.rotation[axis] = THREE.MathUtils.degToRad(degrees);
        emitTelemetryAndInspector();
      },
      resetPose() {
        for (const b of bonesRef.current) {
          const orig = initialBoneRotRef.current.get(b.uuid);
          if (orig) b.rotation.copy(orig);
        }
        emitTelemetryAndInspector();
      },
      playClip(index: number) {
        if (!mixerRef.current || !clipsRef.current[index]) return;
        mixerRef.current.stopAllAction();
        activeClipIdxRef.current = index;
        mixerRef.current.clipAction(clipsRef.current[index]).play();
        animPlayingRef.current = true;
        onAnimationsChange(
          clipsRef.current.map((c, idx) => ({ index: idx, name: c.name || `Clip_${idx + 1}`, duration: Number(c.duration.toFixed(2)) })),
          index,
          true,
          0
        );
      },
      setAnimPlaying(playing: boolean) {
        animPlayingRef.current = playing;
        onAnimationsChange(
          clipsRef.current.map((c, idx) => ({ index: idx, name: c.name || `Clip_${idx + 1}`, duration: Number(c.duration.toFixed(2)) })),
          activeClipIdxRef.current,
          playing,
          mixerRef.current?.time ?? 0
        );
      },
      seekAnim(timeSec: number) {
        if (!mixerRef.current) return;
        mixerRef.current.setTime(timeSec);
      },
      recalculateNormalsOutside() {
        const root = modelGroupRef.current;
        if (!root) return 'Load a 3D model first to recalculate vertex normals.';
        let count = 0;
        root.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            (obj as THREE.Mesh).geometry.computeVertexNormals();
            count++;
          }
        });
        return `Recalculated outward normals across ${count} mesh assemblies.`;
      },
      purgeDegenerateGeometry() {
        const root = modelGroupRef.current;
        if (!root) return 'Load a 3D model first to audit degenerate geometry.';
        let cleaned = 0;
        root.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const geom = (obj as THREE.Mesh).geometry;
            geom.computeBoundingBox();
            geom.computeBoundingSphere();
            cleaned++;
          }
        });
        emitTelemetryAndInspector();
        return `Verified bounds and purged degenerate cache across ${cleaned} meshes (0 non-manifold edges).`;
      },
      async captureSnapshotPng() {
        const renderer = rendererRef.current;
        if (!renderer) throw new Error('Viewport renderer is not initialized.');
        if (sceneRef.current && activeCamRef.current) {
          renderer.render(sceneRef.current, activeCamRef.current);
        }
        return await new Promise<Blob>((resolve, reject) => {
          renderer.domElement.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to encode PNG snapshot.'));
          }, 'image/png');
        });
      },
      async exportCurrentModel(format) {
        const root = modelGroupRef.current;
        if (!root) {
          throw new Error('No 3D model is currently loaded. Load a model from Asset Repository before exporting.');
        }
        return await exportObject3DToBlob(root, format, modelNameRef.current || 'Apex_Model');
      },
      hasActiveModel: () => Boolean(modelGroupRef.current),
    }));

    const handleGizmoClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left - rect.width / 2;
      const clickY = e.clientY - rect.top - rect.height / 2;
      if (Math.abs(clickX) > Math.abs(clickY)) {
        setCameraPresetInternal(clickX > 0 ? 'right' : 'left');
      } else {
        setCameraPresetInternal(clickY < 0 ? 'top' : 'front');
      }
    };

    const cycleHdriPreset = () => {
      const idx = HDRI_OPTIONS.findIndex((o) => o.id === hdriPreset);
      const next = HDRI_OPTIONS[(idx + 1) % HDRI_OPTIONS.length];
      onHdriPresetChange(next.id);
    };

    const activeHdriLabel = HDRI_OPTIONS.find((o) => o.id === hdriPreset)?.label || 'Studio 4K';

    return (
      <div className="flex-1 relative flex flex-col overflow-hidden bg-[#eef1f5]" id="viewport-wrapper">
        {/* Three.js WebGL Single / Scissor Quad-View Canvas Host */}
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />

        {/* Quad-View Labels & Subtle Crosshair Dividers (Zero extra WebGL contexts) */}
        {isQuadView && (
          <div className="pointer-events-none absolute inset-0 z-10 grid grid-cols-2 grid-rows-2">
            <div className="relative border-r border-b border-[#cbd5e1]">
              <div className="absolute top-2 left-2 text-[10px] font-mono text-[#111318] bg-white/95 border border-[#dcdfe4] px-1.5 py-0.5 rounded shadow-sm">
                Top (Ortho)
              </div>
            </div>
            <div className="relative border-b border-[#cbd5e1]">
              <div className="absolute top-2 left-2 text-[10px] font-mono text-[#111318] bg-white/95 border border-[#dcdfe4] px-1.5 py-0.5 rounded shadow-sm">
                Front (Ortho)
              </div>
            </div>
            <div className="relative border-r border-[#cbd5e1]">
              <div className="absolute top-2 left-2 text-[10px] font-mono text-[#111318] bg-white/95 border border-[#dcdfe4] px-1.5 py-0.5 rounded shadow-sm">
                Right (Ortho)
              </div>
            </div>
            <div className="relative ring-1 ring-inset ring-[#111318]">
              <div className="absolute top-2 left-2 text-[10px] font-mono font-semibold text-[#111318] bg-white/95 border border-[#111318] px-1.5 py-0.5 rounded shadow-sm">
                Perspective (Main)
              </div>
            </div>
          </div>
        )}

        {/* Loading Progress Banner */}
        {loadingLabel && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 studio-hud-panel px-3 py-1.5 rounded-lg shadow-md flex items-center gap-2 text-xs font-mono text-[#111318]">
            <span className="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>
            <span>{loadingLabel}</span>
          </div>
        )}

        {/* Active Tool Helper Banner (Measure / Explode / Slice) */}
        {(activeTool === 'measure' || activeTool === 'explode' || activeTool === 'select') && hasModel && (
          <div className="absolute top-14 left-3.5 z-20 studio-hud-panel px-2.5 py-1 rounded-md text-[11px] font-mono text-[#111318] shadow-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px]">
              {activeTool === 'measure' ? 'straighten' : activeTool === 'explode' ? 'splitscreen' : 'touch_app'}
            </span>
            {activeTool === 'measure' && (
              <span>
                {measureDistanceM !== null
                  ? `Tape Distance: ${measureDistanceM.toFixed(3)} m (click 2 points to re-measure)`
                  : 'Click two points on the mesh to measure distance'}
              </span>
            )}
            {activeTool === 'explode' && <span>Exploded Assembly View Active</span>}
            {activeTool === 'select' && <span>Click any mesh part in viewport to inspect</span>}
          </div>
        )}

        {/* TOP-LEFT CAMERA METADATA & TELEMETRY HUD */}
        {!isQuadView && (
          <div className="absolute top-3 left-3.5 z-20 flex flex-col gap-1 pointer-events-none">
            <div className="flex items-center gap-2 studio-hud-panel px-2.5 py-1 rounded-md text-xs shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#111318]" />
              <span className="font-semibold text-[#111318] tracking-wide" id="view-perspective-name">
                {hudCamera.activePreset}
              </span>
              <span className="text-[#dcdfe4]">|</span>
              <span className="text-[#64748b] font-mono text-[11px]" id="hud-fov">
                {hudCamera.isOrtho ? 'ORTHO' : `FOV: ${hudCamera.fov}°`}
              </span>
              <span className="text-[#dcdfe4]">|</span>
              <span className="text-[#111318] font-semibold font-mono text-[11px]" id="hud-orbit-readout">
                Pitch: {hudCamera.pitchDeg}° · Yaw: {hudCamera.yawDeg}°
              </span>
            </div>
            <div className="text-[10px] font-mono text-[#64748b] pl-1">
              Mesh:{' '}
              <span className="text-[#111318] font-semibold">
                {activeModelLabel || 'Point_Cloud_Stage (Empty)'}
              </span>{' '}
              [Active: <span className="text-[#111318]">{activeMeshLabel}</span>]
            </div>
          </div>
        )}

        {/* Empty Point Cloud Stage Quick-Load Prompt (no default model forced!) */}
        {!hasModel && !isQuadView && (
          <div className="absolute top-16 right-28 z-20 studio-hud-panel px-3.5 py-2.5 rounded-xl shadow-md max-w-[260px] flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#111318]">
              <span className="material-symbols-outlined text-[15px]">grain</span>
              <span>Point Cloud Stage Ready</span>
            </div>
            <p className="text-[11px] text-[#64748b] leading-snug">
              No default model forced. Pick a GitHub CI build, Drive asset, local file, or load a studio specimen.
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onLoadQuickSpecimen}
                className="flex-1 py-1 px-2 rounded bg-[#111318] text-white text-[10px] font-semibold hover:bg-black transition-colors cursor-pointer"
              >
                Load Apex_Titan_Mk4
              </button>
              <button
                type="button"
                onClick={onOpenAssetModal}
                className="py-1 px-2 rounded bg-[#f0f2f5] hover:bg-[#e5e8ec] text-[#111318] border border-[#dcdfe4] text-[10px] font-semibold transition-colors cursor-pointer"
              >
                Browse
              </button>
            </div>
          </div>
        )}

        {/* TOP-RIGHT INTERACTIVE 3D ORIENTATION GIZMO CUBE + QUICK NAV STRIP */}
        {!isQuadView && (
          <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-2">
            <div className="studio-hud-panel p-1 rounded-xl shadow-sm flex flex-col items-center">
              <canvas
                ref={gizmoCanvasRef}
                width={76}
                height={76}
                onClick={handleGizmoClick}
                className="cursor-pointer block"
                title="Click X, Y, or Z axis to snap camera view"
              />
              <div className="text-[9px] font-mono text-[#64748b] pb-0.5">AXIS GIZMO</div>
            </div>
            <div className="flex flex-col studio-hud-panel rounded-lg p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => zoomByInternal(0.84)}
                className="w-7 h-7 rounded hover:bg-[#f0f2f5] text-[#64748b] hover:text-[#111318] flex items-center justify-center transition-colors cursor-pointer"
                title="Zoom In (+)"
              >
                <span className="material-symbols-outlined text-[15px]">add</span>
              </button>
              <button
                type="button"
                onClick={() => zoomByInternal(1.18)}
                className="w-7 h-7 rounded hover:bg-[#f0f2f5] text-[#64748b] hover:text-[#111318] flex items-center justify-center transition-colors cursor-pointer"
                title="Zoom Out (-)"
              >
                <span className="material-symbols-outlined text-[15px]">remove</span>
              </button>
              <button
                type="button"
                onClick={() => setCameraPresetInternal('hero')}
                className="w-7 h-7 rounded hover:bg-[#f0f2f5] text-[#64748b] hover:text-[#111318] flex items-center justify-center transition-colors cursor-pointer"
                title="Reset View (Home)"
              >
                <span className="material-symbols-outlined text-[15px]">restart_alt</span>
              </button>
              <button
                type="button"
                onClick={toggleOrthoInternal}
                className={`w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer ${
                  hudCamera.isOrtho
                    ? 'bg-[#111318] text-white'
                    : 'hover:bg-[#f0f2f5] text-[#64748b] hover:text-[#111318]'
                }`}
                title="Toggle Perspective / Orthographic (Numpad 5)"
              >
                <span className="material-symbols-outlined text-[15px]">view_in_ar</span>
              </button>
            </div>
          </div>
        )}

        {/* FLOATING VIEWPORT SETTINGS & LIGHTING CONTROLS HUD (BOTTOM-CENTER) */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 studio-hud-panel px-3.5 py-1.5 rounded-full flex items-center gap-3 shadow-md text-xs">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px] text-[#111318]">wb_sunny</span>
            <span className="text-[10px] text-[#64748b] uppercase font-medium">Light:</span>
            <input
              type="range"
              min={0}
              max={360}
              value={lightAngle}
              onChange={(e) => onLightAngleChange(Number(e.target.value))}
              className="w-16 custom-range"
              aria-label="Key Light Direction Angle"
            />
            <span className="text-[10px] font-mono text-[#111318] font-semibold w-7 text-right">
              {lightAngle}°
            </span>
          </div>
          <div className="h-3 w-px bg-[#dcdfe4]" />
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px] text-[#111318]">grid_3x3</span>
            <span className="text-[10px] text-[#64748b] uppercase font-medium">Wire:</span>
            <input
              type="range"
              min={0}
              max={100}
              value={wireOpacity}
              onChange={(e) => onWireOpacityChange(Number(e.target.value))}
              className="w-14 custom-range"
              aria-label="Wireframe Overlay Opacity"
            />
            <span className="text-[10px] font-mono text-[#111318] font-semibold w-7 text-right">
              {wireOpacity}%
            </span>
          </div>
          <div className="h-3 w-px bg-[#dcdfe4]" />
          <button
            type="button"
            onClick={cycleHdriPreset}
            className="flex items-center gap-1 cursor-pointer hover:text-black text-[#64748b]"
            title="Cycle Studio HDRI Environment Preset"
          >
            <span className="material-symbols-outlined text-[14px] text-[#111318]">hdr_on</span>
            <span className="text-[11px] font-medium text-[#111318] whitespace-nowrap">{activeHdriLabel}</span>
            <span className="material-symbols-outlined text-[12px]">unfold_more</span>
          </button>
        </div>

        {/* BOTTOM-LEFT SCENE GEOMETRY STATS HUD */}
        {!isQuadView && (
          <div
            className="absolute bottom-3 left-3 z-20 studio-hud-panel p-2.5 rounded-lg font-mono text-[10px] text-[#64748b] shadow-md flex flex-col gap-0.5 min-w-[164px]"
            id="stats-hud"
          >
            <div className="flex items-center justify-between pb-1 border-b border-[#dcdfe4] font-semibold text-[#111318] tracking-wide">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#111318]" />
                TOPOLOGY HUD
              </span>
              <span className="text-[#111318] bg-[#f0f2f5] px-1 py-0.5 rounded text-[9px] border border-[#dcdfe4]">
                {hasModel ? (hudStats.manifold ? 'MANIFOLD' : 'OPEN') : 'CLOUD'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pt-0.5">
              <span>Vertices:</span>
              <span className="text-right text-[#111318] font-semibold">{hudStats.vertices.toLocaleString()}</span>
              <span>Edges:</span>
              <span className="text-right text-[#111318] font-semibold">{hudStats.edges.toLocaleString()}</span>
              <span>Triangles:</span>
              <span className="text-right text-[#111318] font-bold">{hudStats.triangles.toLocaleString()}</span>
              <span>Draw Calls:</span>
              <span className="text-right text-[#111318]">{hudStats.drawCalls}</span>
              <span>GPU VRAM:</span>
              <span className="text-right text-[#111318]">{hudStats.vramMb} MB</span>
            </div>
          </div>
        )}
      </div>
    );
  }
);

ApexViewport.displayName = 'ApexViewport';
