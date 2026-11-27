import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  BookOpen,
  Download,
  Feather,
  Layers,
  Magnet,
  Menu,
  Play,
  Redo2,
  SlidersHorizontal,
  Square,
  Undo2,
  User,
  Wind,
  X,
} from 'lucide-react';
import * as THREE from 'three';
import { StudioViewport, type StudioViewportHandle } from './components/StudioViewport';
import { InspectorSheet } from './components/InspectorSheet';
import { WorkbenchSheet } from './components/WorkbenchSheet';
import { LibraryModal } from './components/LibraryModal';
import { ExportDialog } from './components/ExportDialog';
import { ConverterModal } from './components/ConverterModal';
import { TwoFactorModal } from './components/TwoFactorModal';
import { ManualModal } from './components/ManualModal';
import { CreatorModal } from './components/CreatorModal';
import {
  DEFAULT_BLENDER_SKILL,
  STARTER_BUILD_PY,
  SYSTEM_SKILL_STORAGE_KEY,
} from './utils/blenderSkill';
import {
  isFileSystemAccessSupported,
  pickLocalDirectory,
  readFileFromDirectory,
  scanDirectoryTree,
} from './utils/fsAccess';
import {
  backupModelBundleToDrive,
  downloadDriveModelAsBlobUrl,
  initDriveAuth,
  listDrive3DModels,
  signInWithGoogleDrive,
  signOutGoogleDrive,
} from './utils/googleDrive';
import {
  exportObject3DToBlob,
  triggerBlobDownload,
  type ExportFormatId,
} from './utils/modelExporters';
import { extractTexturesFromObject3D } from './utils/worldPrimitives';
import { validateModelUpload } from './utils/modelUploadValidation';
import {
  buildLatestScreenshotFilename,
  isLatestScreenshotFilename,
  resolveStaticPagesAssetUrl,
  sanitizeModelSlug,
} from './utils/pathSafety';
import type { ParsedModelSummary } from './utils/modelConverter';
import type {
  AnimationClipSummary,
  AvailableModelItem,
  BoneControlInfo,
  CameraTelemetry,
  CapturedScreenshot,
  ExecutionMode,
  GitHubCiStatus,
  GizmoMode,
  GizmoSpace,
  HarnessActivityItem,
  HistoryStateSummary,
  InsideOutSide,
  InspectorTabId,
  MaterialChannelInfo,
  ModelGroupName,
  OutlinerNode,
  PhysicsConfig,
  PlayModeStatus,
  ScatterBrushConfig,
  SceneTelemetry,
  SectionCutConfig,
  SelectedCameraInfo,
  SelectedLightInfo,
  ServerConfig,
  ShadingPass,
  StudioLightingPreset,
  SurfaceParams,
  TerrainBrushConfig,
  TopologyDiagnostics,
  TransformInfo,
  ViewportOverlayFlags,
  ViewportToolMode,
  VisionCritiqueResult,
  WorkbenchTabId,
  WorkspaceFileEntry,
  WorkspaceModeId,
  WorldEnvironmentPreset,
} from './types';

const REPOSITORY_CHARACTER_MODELS: AvailableModelItem[] = [
  {
    id: 'repo:michelle',
    slug: 'michelle',
    name: 'Michelle',
    source: 'specimen',
    format: '.glb',
    group: 'Female_Characters',
    sizeBytes: 3340928,
    url: '/models/michelle.glb',
    previewUrl: '/models/previews/michelle.png',
    repoFolderPath: 'models/michelle',
    viewable: true,
    updatedAt: '2026-11-26T18:10:00.000Z',
    description:
      'Rigged and animated stylized female character model from the official Three.js glTF sample collection (MIT / Mixamo Sample).',
  },
  {
    id: 'repo:tactical-soldier',
    slug: 'tactical-soldier',
    name: 'Tactical Soldier',
    source: 'specimen',
    format: '.glb',
    group: 'Male_Characters',
    sizeBytes: 2160468,
    url: '/models/player-character.glb',
    previewUrl: '/models/previews/player-character.png',
    repoFolderPath: 'models/tactical-soldier',
    viewable: true,
    updatedAt: '2026-11-26T18:09:00.000Z',
    description:
      'Rigged animated male tactical character with Idle, Walk, and Run skeletal animation clips (MIT, powers Play Mode).',
  },
  {
    id: 'repo:cesium-explorer',
    slug: 'cesium-explorer',
    name: 'Cesium Explorer',
    source: 'specimen',
    format: '.glb',
    group: 'Male_Characters',
    sizeBytes: 438272,
    url: '/models/cesium-man.glb',
    previewUrl: '/models/previews/cesium-man.png',
    repoFolderPath: 'models/cesium-explorer',
    viewable: true,
    updatedAt: '2026-11-26T18:08:00.000Z',
    description:
      'Rigged walking male explorer character from the official Khronos Group glTF Sample Assets repository (CC-BY 4.0).',
  },
  {
    id: 'repo:xbot-rig',
    slug: 'xbot-rig',
    name: 'Xbot Articulated Rig',
    source: 'specimen',
    format: '.glb',
    group: 'Characters',
    sizeBytes: 2936012,
    url: '/models/xbot.glb',
    previewUrl: '/models/previews/xbot.png',
    repoFolderPath: 'models/xbot-rig',
    viewable: true,
    updatedAt: '2026-11-26T18:07:00.000Z',
    description:
      'Articulated humanoid character rig with Idle, Walk, Run, and emote skeletal animations from Three.js examples (MIT).',
  },
  {
    id: 'repo:expressive-robot',
    slug: 'expressive-robot',
    name: 'Expressive Robot',
    source: 'specimen',
    format: '.glb',
    group: 'Characters',
    sizeBytes: 464896,
    url: '/models/robot-expressive.glb',
    previewUrl: '/models/previews/robot-expressive.png',
    repoFolderPath: 'models/expressive-robot',
    viewable: true,
    updatedAt: '2026-11-26T18:06:00.000Z',
    description:
      'Expressive rigged character with skeletal locomotion and morph-target facial expressions from Three.js examples (CC0 1.0).',
  },
];

function nowStamp(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

async function fetchJsonSafe<T>(
  url: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T | null }> {
  try {
    const res = await fetch(url, init);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { ok: false, status: res.status, data: null };
    }
    const data = (await res.json()) as T;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

export function App() {
  const viewportRef = useRef<StudioViewportHandle | null>(null);
  const localDirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const lastSeenRunIdRef = useRef<number | null>(null);

  // Navigation & Sheet States
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceModeId>('inspect');
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTabId>('outliner');
  const [workbenchOpen, setWorkbenchOpen] = useState(false);
  const [workbenchTab, setWorkbenchTab] = useState<WorkbenchTabId>('harness');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [converterOpen, setConverterOpen] = useState(false);
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 3D Viewport & World Assembly State (clean warm-porcelain Atelier studio)
  const [shadingPass, setShadingPass] = useState<ShadingPass>('combined');
  const [quadView, setQuadView] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [overlays, setOverlays] = useState<ViewportOverlayFlags>({
    showGrid: true,
    showAxes: false,
    showBounds: false,
    showColliders: false,
  });
  const [cameraFov, setCameraFov] = useState(42);
  const [cameraSpeed, setCameraSpeed] = useState(1.0);
  const [autoSpin, setAutoSpin] = useState(false);
  const [exploded, setExploded] = useState(false);
  const [lightingPreset, setLightingPreset] = useState<StudioLightingPreset>('studio-4k');
  const [lightAngleDeg, setLightAngleDeg] = useState(42);
  const [sunElevationDeg, setSunElevationDeg] = useState(48);
  const [shadowsEnabled, setShadowsEnabled] = useState(true);
  const [wireframeOpacity, setWireframeOpacity] = useState(0);
  const [insideOutSide, setInsideOutSide] = useState<InsideOutSide>('front');
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>('none');
  const [gizmoSpace, setGizmoSpace] = useState<GizmoSpace>('world');
  const [snapGrid, setSnapGrid] = useState<number>(0);
  const [snapRotateDeg, setSnapRotateDeg] = useState<number>(0);
  const [snapScale, setSnapScale] = useState<number>(0);
  const [worldEnvPreset, setWorldEnvPreset] = useState<WorldEnvironmentPreset>('alabaster');
  const [worldFogDensity, setWorldFogDensity] = useState<number>(0.012);
  const [worldFogHeight, setWorldFogHeight] = useState<number>(0);
  const [activeToolMode, setActiveToolMode] = useState<ViewportToolMode>('orbit');
  const [terrainBrush, setTerrainBrush] = useState<TerrainBrushConfig>({
    mode: 'raise',
    paintLayer: 'grass',
    radius: 3.0,
    strength: 0.45,
    flattenTargetY: 0,
  });
  const [scatterBrush, setScatterBrush] = useState<ScatterBrushConfig>({
    preset: 'pine-tree',
    radius: 2.5,
    density: 2,
    minScale: 0.75,
    maxScale: 1.35,
    alignToNormal: true,
  });
  const [physicsConfig, setPhysicsConfig] = useState<PhysicsConfig>({
    gravityEnabled: true,
    gravityStrength: 9.81,
    liveSimulation: false,
  });
  const [historySummary, setHistorySummary] = useState<HistoryStateSummary>({
    canUndo: false,
    canRedo: false,
    undoLabel: null,
    redoLabel: null,
    undoCount: 0,
    redoCount: 0,
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
  const [surfaceParams, setSurfaceParams] = useState<SurfaceParams>({
    overrideEnabled: false,
    baseColor: '#7B7871',
    metallic: 0.14,
    roughness: 0.56,
    normalStrength: 1.0,
    emission: 0,
  });
  const [sectionCut, setSectionCut] = useState<SectionCutConfig>({
    enabled: false,
    axis: 'y',
    position: 0,
    invert: false,
  });

  // Scene Telemetry & Inspector State
  const [telemetry, setTelemetry] = useState<SceneTelemetry>({
    modelName: 'Michelle',
    meshCount: 0,
    boneCount: 0,
    materialCount: 0,
    vertexCount: 0,
    edgeCount: 0,
    triangleCount: 0,
    boundsSize: [0, 0, 0],
    hasAnimations: false,
  });
  const [, setCameraTelemetry] = useState<CameraTelemetry>({
    x: 0,
    y: 0,
    z: 0,
    pitchDeg: 24,
    yawDeg: 40,
    isOrtho: false,
    fov: 42,
    activePreset: 'Hero 3/4',
  });
  const [diagnostics, setDiagnostics] = useState<TopologyDiagnostics>({
    grade: 'A+',
    quadPercent: 78,
    triPercent: 22,
    ngons: 0,
    nonManifoldEdges: 0,
    overlappingUvPercent: 0.4,
    uvMarginPx: 8,
    drawCalls: 0,
    estimatedVramMb: 1.2,
    manifold: true,
  });
  const [outlinerNodes, setOutlinerNodes] = useState<OutlinerNode[]>([]);
  const [selectedNodeUuid, setSelectedNodeUuid] = useState<string | null>(null);
  const [soloNodeUuid, setSoloNodeUuid] = useState<string | null>(null);
  const [transformInfo, setTransformInfo] = useState<TransformInfo>({
    uuid: null,
    name: 'Michelle',
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
  const [materials, setMaterials] = useState<MaterialChannelInfo[]>([]);
  const [bones, setBones] = useState<BoneControlInfo[]>([]);
  const [animationClips, setAnimationClips] = useState<AnimationClipSummary[]>([]);
  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const [animationDuration, setAnimationDuration] = useState(0);
  const [animationTime, setAnimationTime] = useState(0);
  const [animationPlaying, setAnimationPlaying] = useState(false);
  const [selectedLightInfo, setSelectedLightInfo] = useState<SelectedLightInfo | null>(null);
  const [selectedCameraInfo, setSelectedCameraInfo] = useState<SelectedCameraInfo | null>(null);

  // Asset Library & Cloud/Static Environment State
  const [isStaticSite, setIsStaticSite] = useState(false);
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);
  const [ciStatus, setCiStatus] = useState<GitHubCiStatus | null>(null);
  const [activeModelId, setActiveModelId] = useState<string | null>(REPOSITORY_CHARACTER_MODELS[0].id);
  const [activeModelSlug, setActiveModelSlug] = useState<string>(REPOSITORY_CHARACTER_MODELS[0].slug);
  const [githubModels, setGithubModels] = useState<AvailableModelItem[]>([]);
  const [driveModels, setDriveModels] = useState<AvailableModelItem[]>([]);
  const [localModels, setLocalModels] = useState<AvailableModelItem[]>([]);
  const [staticPagesModels, setStaticPagesModels] = useState<AvailableModelItem[]>([]);
  const [libraryBusy, setLibraryBusy] = useState(false);

  // Google Drive Auth State
  const [driveSignedIn, setDriveSignedIn] = useState(false);
  const [driveUserEmail, setDriveUserEmail] = useState<string | null>(null);

  // Pipeline, Real-Time Harness & Real Vision QA State
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('cloud');
  const [localBlenderEndpoint, setLocalBlenderEndpoint] = useState('http://127.0.0.1:8787/blender');
  const [buildPyCode, setBuildPyCode] = useState<string>(STARTER_BUILD_PY);
  const [commitNote, setCommitNote] = useState('Refine Stone & Cedar Lantern proportions and bevels');
  const [isBuildRunning, setIsBuildRunning] = useState(false);
  const [harnessAutoSync, setHarnessAutoSync] = useState(false);
  const [harnessActivities, setHarnessActivities] = useState<HarnessActivityItem[]>([]);

  // 100% REAL Vision QA captures (zero fake static reference JPGs)
  const [realCaptures, setRealCaptures] = useState<CapturedScreenshot[]>([]);
  const [compareAId, setCompareAId] = useState<string | null>(null);
  const [compareBId, setCompareBId] = useState<string | null>(null);
  const [visionCritique, setVisionCritique] = useState<VisionCritiqueResult | null>(null);
  const [isVisionRunning, setIsVisionRunning] = useState(false);

  // GitHub-Synced Workspace & System Skill State
  const fsSupported = useMemo(() => isFileSystemAccessSupported(), []);
  const [localFolderName, setLocalFolderName] = useState<string | null>(null);
  const [workspaceSyncedSource, setWorkspaceSyncedSource] = useState<'github' | 'local' | 'starter'>('starter');
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFileEntry[]>([
    {
      path: 'scripts/build.py',
      name: 'build.py',
      size: STARTER_BUILD_PY.length,
      source: 'starter',
      content: STARTER_BUILD_PY,
    },
  ]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>('scripts/build.py');
  const [selectedFileContent, setSelectedFileContent] = useState<string>(STARTER_BUILD_PY);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(false);
  const [systemSkill, setSystemSkill] = useState<string>(() => {
    try {
      return localStorage.getItem(SYSTEM_SKILL_STORAGE_KEY) || DEFAULT_BLENDER_SKILL;
    } catch {
      return DEFAULT_BLENDER_SKILL;
    }
  });

  const notify = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 3400);
  }, []);

  const pushHarnessActivity = useCallback(
    (
      stage: HarnessActivityItem['stage'],
      title: string,
      detail: string,
      status: HarnessActivityItem['status'] = 'completed',
      modelSlug?: string
    ) => {
      setHarnessActivities((prev) => [
        {
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          timestamp: nowStamp(),
          stage,
          title,
          detail,
          status,
          modelSlug,
        },
        ...prev.slice(0, 29),
      ]);
    },
    []
  );

  useEffect(() => {
    try {
      localStorage.setItem(SYSTEM_SKILL_STORAGE_KEY, systemSkill);
    } catch {
      // Ignore storage quota errors in restricted frames
    }
  }, [systemSkill]);

  // Fetch live recursive GitHub repository file tree
  const refreshGithubWorkspace = useCallback(async () => {
    setIsWorkspaceLoading(true);
    try {
      const treeRes = await fetchJsonSafe<{
        configured?: boolean;
        files?: Array<{ path: string; name: string; size: number; sha?: string; source: 'github' }>;
      }>('/api/github/tree');
      if (treeRes.ok && treeRes.data?.configured && Array.isArray(treeRes.data.files)) {
        setWorkspaceFiles(treeRes.data.files);
        setWorkspaceSyncedSource('github');
        // Load live scripts/build.py from GitHub if present
        const hasBuild = treeRes.data.files.some((f) => f.path === 'scripts/build.py');
        if (hasBuild) {
          const fileRes = await fetchJsonSafe<{ content?: string }>(
            '/api/github/file?path=scripts%2Fbuild.py'
          );
          if (fileRes.ok && typeof fileRes.data?.content === 'string') {
            setBuildPyCode(fileRes.data.content);
            setSelectedFilePath('scripts/build.py');
            setSelectedFileContent(fileRes.data.content);
          }
        }
      }
    } finally {
      setIsWorkspaceLoading(false);
    }
  }, []);

  // Refresh GitHub CI status, organized model catalog, and workspace tree
  const refreshServerAndCi = useCallback(async () => {
    setLibraryBusy(true);
    try {
      const cfg = await fetchJsonSafe<ServerConfig>('/api/config');
      if (!cfg.ok || !cfg.data) {
        setIsStaticSite(true);
        const glbPath = resolveStaticPagesAssetUrl('model.glb');
        if (glbPath) {
          try {
            const headRes = await fetch(glbPath, { method: 'HEAD' });
            if (headRes.ok) {
              const size = Number(headRes.headers.get('content-length') || 0);
              setStaticPagesModels([
                {
                  id: 'pages:model.glb',
                  slug: 'published-ci-build',
                  name: 'Published CI Build (model.glb)',
                  source: 'github-release',
                  format: '.glb',
                  group: 'Cloud_CI',
                  sizeBytes: size || undefined,
                  url: glbPath,
                  viewable: true,
                  description: 'Latest headless Blender 4.2 LTS model deployed to GitHub Pages.',
                },
              ]);
            }
          } catch {
            // Static model.glb not present yet
          }
        }
        return;
      }

      setIsStaticSite(false);
      setServerConfig(cfg.data);

      const [starterRes, statusRes, ghModelsRes] = await Promise.all([
        fetchJsonSafe<{ files?: Array<{ path: string; content: string; size: number }> }>(
          '/api/workspace/starter'
        ),
        fetchJsonSafe<GitHubCiStatus>('/api/github/status'),
        fetchJsonSafe<{ configured: boolean; models?: AvailableModelItem[] }>('/api/github/models'),
      ]);

      if (statusRes.ok && statusRes.data) {
        setCiStatus(statusRes.data);
        if (statusRes.data.latestRun?.id) {
          lastSeenRunIdRef.current = statusRes.data.latestRun.id;
        }
      }

      if (ghModelsRes.ok && ghModelsRes.data?.models) {
        setGithubModels(ghModelsRes.data.models);
      }

      if (cfg.data.githubConfigured && !localDirHandleRef.current) {
        await refreshGithubWorkspace();
      } else if (starterRes.ok && starterRes.data?.files && !localDirHandleRef.current) {
        const mapped: WorkspaceFileEntry[] = starterRes.data.files.map((f) => ({
          path: f.path,
          name: f.path.split('/').pop() || f.path,
          size: f.size,
          source: 'starter',
          content: f.content,
        }));
        if (mapped.length > 0) {
          setWorkspaceFiles(mapped);
          setWorkspaceSyncedSource('starter');
          const buildEntry = mapped.find((m) => m.path === 'scripts/build.py');
          if (buildEntry?.content) {
            setBuildPyCode(buildEntry.content);
            setSelectedFilePath(buildEntry.path);
            setSelectedFileContent(buildEntry.content);
          }
        }
      }
    } finally {
      setLibraryBusy(false);
    }
  }, [refreshGithubWorkspace]);

  useEffect(() => {
    refreshServerAndCi();
  }, [refreshServerAndCi]);

  // Real-Time Harness Auto-Sync Polling (detects new AI harness commits & auto-reloads!)
  const handleSyncHarnessNow = useCallback(async () => {
    const statusRes = await fetchJsonSafe<GitHubCiStatus>('/api/github/status');
    const ghModelsRes = await fetchJsonSafe<{ configured: boolean; models?: AvailableModelItem[] }>(
      '/api/github/models'
    );
    if (ghModelsRes.ok && ghModelsRes.data?.models) {
      setGithubModels(ghModelsRes.data.models);
      // If active model slug exists in GitHub repo and has stored screenshots, sync them into Vision QA!
      const match = ghModelsRes.data.models.find((m) => m.slug === activeModelSlug);
      if (match?.screenshots && match.screenshots.length > 0) {
        const remoteShots: CapturedScreenshot[] = match.screenshots.map((s) => ({
          id: `gh-${s.path}`,
          angle: s.name.includes('front')
            ? 'front'
            : s.name.includes('side')
              ? 'side'
              : s.name.includes('top')
                ? 'top'
                : s.name.includes('camera')
                  ? 'camera'
                  : s.name.includes('viewport')
                    ? 'viewport'
                    : 'hero',
          label: s.name.replace(/\.[^.]+$/, ''),
          dataUrl: s.url,
          createdAt: new Date().toISOString(),
          githubPath: s.path,
          isLatest: isLatestScreenshotFilename(s.name),
          source: 'github',
        }));
        setRealCaptures((prev) => {
          const existingPaths = new Set(prev.map((p) => p.githubPath).filter(Boolean));
          const fresh = remoteShots.filter((r) => !existingPaths.has(r.githubPath));
          return fresh.length > 0 ? [...fresh, ...prev] : prev;
        });
      }
    }
    if (statusRes.ok && statusRes.data) {
      setCiStatus(statusRes.data);
      const latestRun = statusRes.data.latestRun;
      if (
        latestRun &&
        latestRun.status === 'completed' &&
        latestRun.conclusion === 'success' &&
        lastSeenRunIdRef.current !== null &&
        latestRun.id !== lastSeenRunIdRef.current
      ) {
        lastSeenRunIdRef.current = latestRun.id;
        const glbUrl = `/api/github/artifacts/model.glb?ts=${Date.now()}`;
        await viewportRef.current?.loadModelFromUrl(glbUrl, 'Latest Harness CI Build', '.glb');
        pushHarnessActivity(
          'sync',
          'Auto-Loaded New Harness Build',
          `Detected completed CI run #${latestRun.id} and refreshed stage.`,
          'completed',
          activeModelSlug
        );
        notify('Auto-loaded latest AI Harness CI build');
      }
    }
    await refreshGithubWorkspace();
  }, [activeModelSlug, notify, pushHarnessActivity, refreshGithubWorkspace]);

  useEffect(() => {
    if (!harnessAutoSync || isStaticSite) return;
    const timer = window.setInterval(() => {
      handleSyncHarnessNow().catch(() => {});
    }, 12_000);
    return () => window.clearInterval(timer);
  }, [harnessAutoSync, isStaticSite, handleSyncHarnessNow]);

  // Google Drive auth listener
  const refreshDriveModels = useCallback(async () => {
    try {
      const files = await listDrive3DModels();
      setDriveModels(
        files.map((f) => {
          const lower = f.name.toLowerCase();
          const dot = lower.lastIndexOf('.');
          const fmt = (dot >= 0 ? lower.slice(dot) : '.glb') as AvailableModelItem['format'];
          return {
            id: `drive:${f.id}`,
            slug: sanitizeModelSlug(f.name),
            name: f.name,
            source: 'google-drive',
            format: fmt,
            group: 'Props',
            sizeBytes: f.size ? Number(f.size) : undefined,
            driveFileId: f.id,
            htmlUrl: f.webViewLink,
            viewable: fmt !== '.blend' && fmt !== '.step' && fmt !== '.usdz' && fmt !== '.usda',
            updatedAt: f.modifiedTime,
          };
        })
      );
    } catch {
      // Silent if not signed in
    }
  }, []);

  useEffect(() => {
    const unsub = initDriveAuth(
      (user) => {
        setDriveSignedIn(true);
        setDriveUserEmail(user.email || user.displayName || 'Google Account');
        refreshDriveModels();
      },
      () => {
        setDriveSignedIn(false);
        setDriveUserEmail(null);
        setDriveModels([]);
      }
    );
    return () => unsub();
  }, [refreshDriveModels]);

  // Repo-first screenshot saving (ZERO browser auto-download!)
  const handleCaptureViewportToRepo = useCallback(
    async (dataUrl: string, angle: 'viewport' | 'camera' = 'viewport') => {
      const slug = sanitizeModelSlug(activeModelSlug || telemetry.modelName || 'model');
      const latestFileName = buildLatestScreenshotFilename(angle);
      const stamp = new Date().toISOString();
      const newShot: CapturedScreenshot = {
        id: `vp-${angle}-${Date.now()}`,
        angle,
        label: angle === 'camera' ? 'latest_camera' : 'latest_viewport',
        dataUrl,
        createdAt: stamp,
        githubPath: `models/${slug}/screenshots/${latestFileName}`,
        isLatest: true,
        source: 'viewport',
      };

      setRealCaptures((prev) => [newShot, ...prev.slice(0, 11)]);
      setCompareAId(newShot.id);

      const contentBase64 = dataUrl.split(',')[1] || '';
      if (!contentBase64) return;

      if (!serverConfig?.githubConfigured) {
        pushHarnessActivity(
          'screenshot',
          `Captured ${latestFileName}`,
          'Added to local Vision QA. Connect GitHub token to commit into models/' + slug + '/screenshots/.',
          'completed',
          slug
        );
        notify(`Saved ${latestFileName} to Vision QA (connect GitHub to sync to repo)`);
        return;
      }

      const res = await fetchJsonSafe<{
        stored?: boolean;
        uploaded?: boolean;
        latestPrimary?: string;
        error?: string;
      }>(`/api/harness/models/${encodeURIComponent(slug)}/screenshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenshots: [{ name: latestFileName, contentBase64 }],
          commitMessage: `Update ${latestFileName} for models/${slug}/`,
        }),
      });

      if (!res.ok || (!res.data?.stored && !res.data?.uploaded)) {
        notify(res.data?.error || `Saved ${latestFileName} to Vision QA (GitHub sync failed)`);
        return;
      }

      pushHarnessActivity(
        'screenshot',
        `Saved models/${slug}/screenshots/${latestFileName}`,
        `Updated manifest.json latestScreenshots pointer for AI harnesses.`,
        'completed',
        slug
      );
      notify(`Saved ${latestFileName} to models/${slug}/screenshots/`);
      await refreshServerAndCi();
    },
    [
      activeModelSlug,
      notify,
      pushHarnessActivity,
      refreshServerAndCi,
      serverConfig?.githubConfigured,
      telemetry.modelName,
    ]
  );

  // Global keyboard shortcuts (Escape, Alt+Ctrl+Q, F12 repo-first capture)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLibraryOpen(false);
        setExportOpen(false);
        setConverterOpen(false);
        setTwoFactorOpen(false);
        setManualOpen(false);
        setCreatorOpen(false);
        setMobileMenuOpen(false);
        setGizmoMode('none');
      } else if (e.altKey && e.ctrlKey && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        setQuadView((prev) => !prev);
      } else if (e.key === 'F12') {
        e.preventDefault();
        const dataUrl = viewportRef.current?.captureSnapshot(false);
        if (dataUrl) {
          handleCaptureViewportToRepo(dataUrl, 'viewport');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCaptureViewportToRepo]);

  // Top-bar mode switcher (Inspect, World, LookDev, Pipeline)
  const handleSelectWorkspaceMode = (mode: WorkspaceModeId) => {
    setWorkspaceMode(mode);
    if (mode === 'inspect') {
      setWorkbenchOpen(false);
      setShadingPass('combined');
      setWireframeOpacity(0);
    } else if (mode === 'world') {
      setWorkbenchOpen(false);
      setInspectorTab('world');
      setInspectorOpen(true);
      if (gizmoMode === 'none') setGizmoMode('translate');
    } else if (mode === 'lookdev') {
      setWorkbenchOpen(false);
      setShadingPass('combined');
      setWireframeOpacity(0);
      setInspectorTab('material');
      setInspectorOpen(true);
    } else if (mode === 'pipeline') {
      setInspectorOpen(false);
      setWorkbenchOpen(true);
    }
  };

  // All available models (Categorized Repository Characters + Cloud/Drive/Local)
  const allAvailableModels = useMemo<AvailableModelItem[]>(() => {
    const repoSlugs = new Set(REPOSITORY_CHARACTER_MODELS.map((m) => m.slug));
    const filteredGithub = githubModels.filter(
      (m) => !repoSlugs.has(m.slug) && m.slug !== 'celestial-sky-citadel' && m.slug !== 'stone-cedar-lantern'
    );
    return [
      ...REPOSITORY_CHARACTER_MODELS,
      ...staticPagesModels,
      ...filteredGithub,
      ...driveModels,
      ...localModels,
    ];
  }, [staticPagesModels, githubModels, driveModels, localModels]);

  // Select and load any model on stage (+ load its stored GitHub screenshots into Vision QA!)
  const handleSelectModel = async (item: AvailableModelItem) => {
    try {
      setActiveModelSlug(item.slug || sanitizeModelSlug(item.name));
      if (item.source === 'specimen' && !item.url) {
        setWorldEnvPreset('alabaster');
        setWorldFogDensity(0.012);
        setCameraFov(42);
        setShowGrid(true);
        setOverlays((o) => ({ ...o, showGrid: true }));
        viewportRef.current?.loadStarterLantern();
        setActiveModelId(item.id);
        notify(`Loaded ${item.name}`);
        return;
      }
      if (item.source === 'google-drive' && item.driveFileId) {
        const blobUrl = await downloadDriveModelAsBlobUrl(item.driveFileId);
        await viewportRef.current?.loadModelFromUrl(blobUrl, item.name, item.format);
        setActiveModelId(item.id);
        return;
      }
      if (item.url) {
        await viewportRef.current?.loadModelFromUrl(item.url, item.name, item.format);
        setActiveModelId(item.id);
        if (item.screenshots && item.screenshots.length > 0) {
          const loadedShots: CapturedScreenshot[] = item.screenshots.map((s) => ({
            id: `gh-${s.path}`,
            angle: s.name.includes('front')
              ? 'front'
              : s.name.includes('side')
                ? 'side'
                : s.name.includes('top')
                  ? 'top'
                  : s.name.includes('camera')
                    ? 'camera'
                    : s.name.includes('viewport')
                      ? 'viewport'
                      : 'hero',
            label: s.name.replace(/\.[^.]+$/, ''),
            dataUrl: s.url,
            createdAt: item.updatedAt || new Date().toISOString(),
            githubPath: s.path,
            isLatest: isLatestScreenshotFilename(s.name),
            source: 'github',
          }));
          setRealCaptures(loadedShots);
          setCompareAId(loadedShots[0]?.id || null);
          setCompareBId(loadedShots[1]?.id || loadedShots[0]?.id || null);
        }
        if (item.buildPyPath) {
          const pyRes = await fetchJsonSafe<{ content?: string }>(
            `/api/github/file?path=${encodeURIComponent(item.buildPyPath)}`
          );
          if (pyRes.ok && pyRes.data?.content) {
            setBuildPyCode(pyRes.data.content);
          }
        }
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to load model');
    }
  };

  // Append / Kitbash any library model into the active 3D World!
  const handleAppendModelToWorld = async (item: AvailableModelItem) => {
    try {
      if (item.source === 'specimen') {
        const root = viewportRef.current?.getActiveModelRoot();
        if (!root) {
          viewportRef.current?.loadStarterLantern();
        } else {
          viewportRef.current?.addWorldPrimitive('arch');
        }
        return;
      }
      if (item.source === 'google-drive' && item.driveFileId) {
        const blobUrl = await downloadDriveModelAsBlobUrl(item.driveFileId);
        await viewportRef.current?.appendModelFromUrl(blobUrl, item.name, item.format);
        return;
      }
      if (item.url) {
        await viewportRef.current?.appendModelFromUrl(item.url, item.name, item.format);
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to append model');
    }
  };

  // Import local 3D file into chosen category and auto-generate thumbnail preview
  const handleImportLocalFile = async (file: File, group: ModelGroupName = 'Props') => {
    const check = validateModelUpload(file.name, file.size);
    if (!check.valid || !check.sanitizedName || !check.extension) {
      notify(check.reason || 'Unsupported 3D file');
      return;
    }
    if (check.extension === '.blend') {
      notify('Native .blend files require headless Blender CI to convert to .glb.');
      return;
    }
    const blobUrl = URL.createObjectURL(file);
    const slug = sanitizeModelSlug(check.sanitizedName);
    const itemId = `local:${Date.now()}-${check.sanitizedName}`;
    const newItem: AvailableModelItem = {
      id: itemId,
      slug,
      name: check.sanitizedName,
      source: 'local-file',
      format: check.extension as AvailableModelItem['format'],
      group,
      sizeBytes: file.size,
      url: blobUrl,
      viewable: true,
      updatedAt: new Date().toISOString(),
    };
    setLocalModels((prev) => [newItem, ...prev]);
    await viewportRef.current?.loadModelFromUrl(blobUrl, newItem.name, newItem.format);
    setActiveModelId(itemId);
    setActiveModelSlug(slug);
    setLibraryOpen(false);
    // Capture a live viewport preview thumbnail for the imported model card
    window.setTimeout(() => {
      const snap = viewportRef.current?.captureSnapshot(false);
      if (snap) {
        setLocalModels((prev) =>
          prev.map((m) => (m.id === itemId ? { ...m, previewUrl: snap } : m))
        );
      }
    }, 350);
  };

  // Upload a local file directly into organized GitHub models/<slug>/
  const handleUploadFileToGithub = async (file: File, group: ModelGroupName) => {
    const check = validateModelUpload(file.name, file.size);
    if (!check.valid || !check.sanitizedName) {
      notify(check.reason || 'Invalid file');
      return;
    }
    try {
      const slug = sanitizeModelSlug(check.sanitizedName);
      const buf = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(buf);
      const res = await fetchJsonSafe<{ uploaded?: boolean; path?: string; error?: string }>(
        '/api/github/upload-model',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: check.sanitizedName,
            modelSlug: slug,
            group,
            contentBase64: base64,
            commitMessage: `Add ${check.sanitizedName} to models/${slug}/`,
          }),
        }
      );
      if (!res.ok) throw new Error(res.data?.error || 'GitHub upload failed');
      notify(`Saved to GitHub: ${res.data?.path || `models/${slug}/`}`);
      await refreshServerAndCi();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'GitHub upload failed');
    }
  };

  // Default Organized Save: Save Active Stage (GLB + Extracted Textures + 4-Angle Screenshots + Manifest + build.py) into GitHub models/<slug>/
  const handleSaveActiveStageToGithub = useCallback(
    async (group: ModelGroupName) => {
      const root = viewportRef.current?.getActiveModelRoot();
      if (!root) throw new Error('Load or create a 3D model first.');
      const slug = sanitizeModelSlug(activeModelSlug || telemetry.modelName || 'model');

      // 1. Export active model/world to GLB
      const { blob, filename } = await exportObject3DToBlob(root, 'glb', slug);
      const modelBase64 = arrayBufferToBase64(await blob.arrayBuffer());

      // 2. Extract embedded material textures as PNGs
      const extractedTextures = await extractTexturesFromObject3D(root);

      // 3. Capture 4 real studio angles right from WebGL viewport
      const shots = viewportRef.current?.captureMultiAngleScreenshots() || [];
      if (shots.length > 0) {
        setRealCaptures(shots);
        setCompareAId(shots[0]?.id || null);
        setCompareBId(shots[1]?.id || shots[0]?.id || null);
      }

      const res = await fetchJsonSafe<{
        saved?: boolean;
        folder?: string;
        committedFiles?: string[];
        error?: string;
      }>('/api/github/save-model-bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelSlug: slug,
          displayName: telemetry.modelName || slug,
          group,
          fileName: filename,
          contentBase64: modelBase64,
          buildPy: buildPyCode,
          textures: extractedTextures.map((t) => ({ name: t.name, contentBase64: t.base64 })),
          screenshots: shots.map((s) => ({
            name: buildLatestScreenshotFilename(s.angle),
            contentBase64: s.dataUrl.split(',')[1] || '',
          })),
          commitMessage: `Save organized model bundle models/${slug}/ (${group})`,
        }),
      });

      if (!res.ok || !res.data?.saved) {
        throw new Error(res.data?.error || 'Failed to save bundle to GitHub');
      }

      pushHarnessActivity(
        'screenshot',
        `Saved models/${slug}/ Bundle`,
        `Committed mesh, ${extractedTextures.length} textures, and ${shots.length} latest_* screenshots.`,
        'completed',
        slug
      );
      notify(`Saved bundle to GitHub ${res.data.folder}/ (${res.data.committedFiles?.length || 1} files)`);
      await refreshServerAndCi();
    },
    [activeModelSlug, buildPyCode, notify, pushHarnessActivity, refreshServerAndCi, telemetry.modelName]
  );

  // Save converted file from ConverterModal into GitHub models/<slug>/
  const handleSaveConvertedToGithub = async (params: {
    blob: Blob;
    filename: string;
    slug: string;
    group: ModelGroupName;
    sourceGroup: THREE.Group;
  }) => {
    const modelBase64 = arrayBufferToBase64(await params.blob.arrayBuffer());
    const extractedTextures = await extractTexturesFromObject3D(params.sourceGroup);
    const res = await fetchJsonSafe<{ saved?: boolean; folder?: string; error?: string }>(
      '/api/github/save-model-bundle',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelSlug: params.slug,
          displayName: params.slug,
          group: params.group,
          fileName: params.filename,
          contentBase64: modelBase64,
          textures: extractedTextures.map((t) => ({ name: t.name, contentBase64: t.base64 })),
          commitMessage: `Save converted ${params.filename} to models/${params.slug}/`,
        }),
      }
    );
    if (!res.ok || !res.data?.saved) {
      throw new Error(res.data?.error || 'Failed to save converted model to GitHub');
    }
    notify(`Saved converted model to GitHub models/${params.slug}/`);
    await refreshServerAndCi();
  };

  // Capture 4 real viewport screenshots right now (local Vision QA — zero auto-download)
  const handleCaptureMultiAngleSheet = useCallback(() => {
    const shots = viewportRef.current?.captureMultiAngleScreenshots() || [];
    if (shots.length === 0) {
      notify('Unable to capture screenshots from viewport');
      return;
    }
    setRealCaptures((prev) => [...shots, ...prev.slice(0, 8)]);
    setCompareAId(shots[0].id);
    setCompareBId(shots[1]?.id || shots[0].id);
    pushHarnessActivity(
      'screenshot',
      'Captured 4-Angle Viewport Sheet',
      'Rendered live latest_hero, latest_front, latest_side, and latest_top views for Vision QA.',
      'completed',
      activeModelSlug
    );
    notify('Captured 4 real multi-angle screenshots (latest_*.png ready)');
  }, [activeModelSlug, notify, pushHarnessActivity]);

  // Capture 4 real angles AND upload them straight to GitHub models/<slug>/screenshots/latest_*.png for AI harnesses!
  const handleCaptureAndStoreScreenshots = useCallback(async () => {
    const shots = viewportRef.current?.captureMultiAngleScreenshots() || [];
    if (shots.length === 0) {
      notify('Unable to capture screenshots');
      return;
    }
    setRealCaptures((prev) => [...shots, ...prev.slice(0, 8)]);
    setCompareAId(shots[0].id);
    setCompareBId(shots[1]?.id || shots[0].id);

    const slug = sanitizeModelSlug(activeModelSlug || telemetry.modelName || 'model');
    const res = await fetchJsonSafe<{
      stored?: boolean;
      uploaded?: boolean;
      screenshots?: Array<{ name: string; path: string }>;
      error?: string;
    }>(`/api/harness/models/${encodeURIComponent(slug)}/screenshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        screenshots: shots.map((s) => ({
          name: buildLatestScreenshotFilename(s.angle),
          contentBase64: s.dataUrl.split(',')[1] || '',
        })),
        commitMessage: `Update 4-angle latest_* screenshots for models/${slug}/`,
      }),
    });

    if (!res.ok || (!res.data?.stored && !res.data?.uploaded)) {
      notify(res.data?.error || 'GitHub not configured; latest_*.png kept in local Vision QA');
      return;
    }
    pushHarnessActivity(
      'screenshot',
      `Stored 4 latest_* Shots in models/${slug}/screenshots/`,
      'External AI harnesses can fetch latest views via GET /api/harness/models/' + slug,
      'completed',
      slug
    );
    notify(`Stored latest_hero/front/side/top.png in models/${slug}/screenshots/`);
    await refreshServerAndCi();
  }, [activeModelSlug, notify, pushHarnessActivity, refreshServerAndCi, telemetry.modelName]);

  // Load real Cycles CPU multi-angle renders from GitHub CI release
  const handleFetchCyclesCiRenders = useCallback(async () => {
    const names = [
      { file: 'hero.png', angle: 'hero' as const, label: 'Cycles Hero' },
      { file: 'front.png', angle: 'front' as const, label: 'Cycles Front' },
      { file: 'side.png', angle: 'side' as const, label: 'Cycles Side' },
      { file: 'top.png', angle: 'top' as const, label: 'Cycles Top' },
      { file: 'preview.png', angle: 'cycles' as const, label: 'Cycles Preview' },
    ];
    const found: CapturedScreenshot[] = [];
    for (const n of names) {
      const url = `/api/github/artifacts/${n.file}?ts=${Date.now()}`;
      try {
        const res = await fetch(url);
        if (res.ok && (res.headers.get('content-type') || '').includes('image/')) {
          const blob = await res.blob();
          const base64 = arrayBufferToBase64(await blob.arrayBuffer());
          found.push({
            id: `cycles-${n.file}-${Date.now()}`,
            angle: n.angle,
            label: n.label,
            dataUrl: `data:image/png;base64,${base64}`,
            createdAt: new Date().toISOString(),
            source: 'cycles',
          });
        }
      } catch {
        // Ignore missing optional render angle
      }
    }
    if (found.length === 0) {
      notify('No Cycles CI renders found on latest GitHub release yet. Commit build.py to render.');
      return;
    }
    setRealCaptures((prev) => [...found, ...prev]);
    setCompareAId(found[0].id);
    setCompareBId(found[1]?.id || found[0].id);
    notify(`Loaded ${found.length} real Cycles CPU renders from GitHub CI`);
  }, [notify]);

  // Selective or Group Google Drive Backup (copies model + textures + screenshots + manifest + build.py!)
  const handleBackupModelsToDrive = async (items: AvailableModelItem[]) => {
    if (items.length === 0) return;
    let totalFiles = 0;
    for (const item of items) {
      try {
        let modelBlob: Blob;
        let modelFileName = `${item.slug}${item.format === 'procedural' ? '.glb' : item.format}`;
        const textures: Array<{ name: string; blob: Blob }> = [];
        const screenshots: Array<{ name: string; blob: Blob }> = [];
        let buildPyText: string | undefined;

        if (item.source === 'specimen') {
          const root = viewportRef.current?.getActiveModelRoot();
          if (!root) continue;
          const exported = await exportObject3DToBlob(root, 'glb', item.slug);
          modelBlob = exported.blob;
          modelFileName = exported.filename;
          const extTex = await extractTexturesFromObject3D(root);
          extTex.forEach((t) => textures.push({ name: t.name, blob: t.blob }));
          const shots = viewportRef.current?.captureMultiAngleScreenshots() || [];
          for (const s of shots) {
            screenshots.push({ name: `${s.angle}.png`, blob: await dataUrlToBlob(s.dataUrl) });
          }
          buildPyText = buildPyCode;
        } else if (item.source === 'google-drive' && item.driveFileId) {
          const blobUrl = await downloadDriveModelAsBlobUrl(item.driveFileId);
          modelBlob = await (await fetch(blobUrl)).blob();
        } else if (item.url) {
          modelBlob = await (await fetch(item.url)).blob();
          if (item.textures) {
            for (const tex of item.textures) {
              try {
                const b = await (await fetch(tex.url)).blob();
                textures.push({ name: tex.name, blob: b });
              } catch {
                // Skip unavailable asset
              }
            }
          }
          if (item.screenshots) {
            for (const shot of item.screenshots) {
              try {
                const b = await (await fetch(shot.url)).blob();
                screenshots.push({ name: shot.name, blob: b });
              } catch {
                // Skip unavailable asset
              }
            }
          }
          if (item.buildPyPath) {
            const pyRes = await fetchJsonSafe<{ content?: string }>(
              `/api/github/file?path=${encodeURIComponent(item.buildPyPath)}`
            );
            if (pyRes.ok && pyRes.data?.content) buildPyText = pyRes.data.content;
          }
        } else {
          continue;
        }

        const manifestJson = JSON.stringify(
          {
            slug: item.slug,
            name: item.name,
            group: item.group,
            format: item.format,
            backedUpAt: new Date().toISOString(),
            textureCount: textures.length,
            screenshotCount: screenshots.length,
          },
          null,
          2
        );

        const res = await backupModelBundleToDrive({
          group: item.group,
          modelSlug: item.slug,
          modelBlob,
          modelFileName,
          manifestJson,
          buildPy: buildPyText,
          textures,
          screenshots,
        });
        totalFiles += res.uploadedCount;
      } catch (err) {
        notify(
          `Drive backup warning for ${item.name}: ${err instanceof Error ? err.message : 'failed'}`
        );
      }
    }
    notify(`Backed up ${items.length} model(s) (${totalFiles} files incl. textures & screenshots) to Drive`);
    await refreshDriveModels();
  };

  const handleBackupActiveBundleToDrive = async (group: ModelGroupName) => {
    const root = viewportRef.current?.getActiveModelRoot();
    if (!root) throw new Error('Load or create a 3D model first.');
    const slug = sanitizeModelSlug(activeModelSlug || telemetry.modelName || 'model');
    const { blob, filename } = await exportObject3DToBlob(root, 'glb', slug);
    const extTex = await extractTexturesFromObject3D(root);
    const shots = viewportRef.current?.captureMultiAngleScreenshots() || [];
    const shotBlobs: Array<{ name: string; blob: Blob }> = [];
    for (const s of shots) {
      shotBlobs.push({ name: `${s.angle}.png`, blob: await dataUrlToBlob(s.dataUrl) });
    }
    const manifestJson = JSON.stringify(
      {
        slug,
        name: telemetry.modelName || slug,
        group,
        backedUpAt: new Date().toISOString(),
        textureCount: extTex.length,
        screenshotCount: shotBlobs.length,
      },
      null,
      2
    );
    const result = await backupModelBundleToDrive({
      group,
      modelSlug: slug,
      modelBlob: blob,
      modelFileName: filename,
      manifestJson,
      buildPy: buildPyCode,
      textures: extTex.map((t) => ({ name: t.name, blob: t.blob })),
      screenshots: shotBlobs,
    });
    notify(`Copied ${result.uploadedCount} files to Google Drive BlendFactory_Backup/${group}/${slug}/`);
    await refreshDriveModels();
  };

  const handleSignInDrive = async () => {
    try {
      const { user } = await signInWithGoogleDrive();
      setDriveSignedIn(true);
      setDriveUserEmail(user.email || user.displayName || 'Google Account');
      await refreshDriveModels();
      notify('Connected Google Drive');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Google Drive sign-in cancelled');
    }
  };

  const handleSignOutDrive = async () => {
    await signOutGoogleDrive();
    setDriveSignedIn(false);
    setDriveUserEmail(null);
    setDriveModels([]);
    notify('Disconnected Google Drive');
  };

  // File System Access API local folder link
  const handleLinkLocalFolder = async () => {
    try {
      const dirHandle = await pickLocalDirectory();
      localDirHandleRef.current = dirHandle;
      setLocalFolderName(dirHandle.name);
      const scanned = await scanDirectoryTree(dirHandle);
      setWorkspaceFiles(scanned);
      setWorkspaceSyncedSource('local');
      const buildFile = scanned.find((f) => f.path === 'scripts/build.py');
      if (buildFile) {
        const text = await readFileFromDirectory(dirHandle, buildFile.path);
        setBuildPyCode(text);
        setSelectedFilePath(buildFile.path);
        setSelectedFileContent(text);
      }
      notify(`Linked local folder: ${dirHandle.name}`);
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        notify(err instanceof Error ? err.message : 'Unable to link folder');
      }
    }
  };

  // Select any file in GitHub-synced or local workspace
  const handleSelectWorkspaceFile = async (relPath: string) => {
    setSelectedFilePath(relPath);
    if (workspaceSyncedSource === 'github') {
      setIsWorkspaceLoading(true);
      try {
        const res = await fetchJsonSafe<{ content?: string; error?: string }>(
          `/api/github/file?path=${encodeURIComponent(relPath)}`
        );
        if (res.ok && typeof res.data?.content === 'string') {
          setSelectedFileContent(res.data.content);
          if (relPath === 'scripts/build.py') setBuildPyCode(res.data.content);
        } else {
          setSelectedFileContent(res.data?.error || 'Binary or unreadable file.');
        }
      } finally {
        setIsWorkspaceLoading(false);
      }
      return;
    }
    if (localDirHandleRef.current) {
      try {
        const content = await readFileFromDirectory(localDirHandleRef.current, relPath);
        setSelectedFileContent(content);
        if (relPath === 'scripts/build.py') setBuildPyCode(content);
        return;
      } catch (err) {
        setSelectedFileContent(err instanceof Error ? err.message : 'Unable to read file.');
        return;
      }
    }
    const found = workspaceFiles.find((f) => f.path === relPath);
    setSelectedFileContent(found?.content || '');
  };

  // Commit any edited workspace file directly back to GitHub!
  const handleCommitWorkspaceFileToGithub = async (
    filePath: string,
    content: string,
    message: string
  ) => {
    const res = await fetchJsonSafe<{ committed?: boolean; error?: string }>('/api/github/file', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content, commitMessage: message }),
    });
    if (!res.ok || !res.data?.committed) {
      notify(res.data?.error || 'Unable to commit file to GitHub');
      return;
    }
    if (filePath === 'scripts/build.py') {
      setBuildPyCode(content);
    }
    notify(`Committed ${filePath} to GitHub`);
    await refreshGithubWorkspace();
  };

  const handleOpenAgentManual = () => {
    setInspectorOpen(false);
    setWorkbenchOpen(true);
    setWorkbenchTab('workspace');
    handleSelectWorkspaceFile('AGENTS.md');
  };

  const handleRequestExecutionMode = (mode: ExecutionMode) => {
    if (mode === executionMode) return;
    if (mode === 'local') {
      setTwoFactorOpen(true);
    } else {
      setExecutionMode('cloud');
      notify('Switched back to Cloud GitHub CI');
    }
  };

  // Cloud CI / Local Blender Build Runner
  const executeBuildPipeline = useCallback(
    async (scriptText: string, note: string): Promise<{ ok: boolean; detail: string; runUrl?: string }> => {
      setIsBuildRunning(true);
      try {
        if (executionMode === 'local') {
          const res = await fetch(localBlenderEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bpy_script: scriptText, commit_note: note }),
          });
          if (!res.ok) {
            throw new Error(`Local Blender bridge responded with HTTP ${res.status}`);
          }
          notify('Dispatched build script to Local Blender');
          return { ok: true, detail: `Executed on ${localBlenderEndpoint}` };
        }

        const commitRes = await fetchJsonSafe<{
          committed?: boolean;
          commitSha?: string;
          commitUrl?: string;
          error?: string;
        }>('/api/cloud/commit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bpy_script: scriptText, commit_note: note }),
        });

        if (!commitRes.ok || !commitRes.data?.committed) {
          throw new Error(commitRes.data?.error || 'GitHub CI commit failed');
        }

        const sha = commitRes.data.commitSha || '';
        pushHarnessActivity('build', 'Committed scripts/build.py', note, 'running', activeModelSlug);
        notify('Committed scripts/build.py · Polling GitHub Actions CI');

        let lastUrl = commitRes.data.commitUrl || undefined;
        for (let attempt = 0; attempt < 9; attempt++) {
          await new Promise((r) => setTimeout(r, 5000));
          const poll = await fetchJsonSafe<{
            status?: string;
            conclusion?: string | null;
            htmlUrl?: string;
          }>(`/api/cloud/poll?commitSha=${encodeURIComponent(sha)}`);
          if (poll.data?.htmlUrl) lastUrl = poll.data.htmlUrl;
          if (poll.data?.status === 'completed') {
            if (poll.data.conclusion === 'success') {
              await refreshServerAndCi();
              const glbUrl = `/api/github/artifacts/model.glb?ts=${Date.now()}`;
              await viewportRef.current?.loadModelFromUrl(glbUrl, 'Cloud CI Build (model.glb)', '.glb');
              await handleFetchCyclesCiRenders();
              pushHarnessActivity(
                'build',
                'Cloud CI Build Succeeded',
                'Loaded compiled .glb and real Cycles multi-angle renders.',
                'completed',
                activeModelSlug
              );
              return { ok: true, detail: 'Cloud CI build succeeded and loaded on stage.', runUrl: lastUrl };
            }
            return {
              ok: false,
              detail: `GitHub Actions run ended with conclusion: ${poll.data.conclusion || 'failed'}`,
              runUrl: lastUrl,
            };
          }
        }

        await refreshServerAndCi();
        return {
          ok: true,
          detail: 'Build triggered and running on GitHub Actions CI.',
          runUrl: lastUrl,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Build failed';
        notify(msg);
        return { ok: false, detail: msg };
      } finally {
        setIsBuildRunning(false);
      }
    },
    [
      activeModelSlug,
      executionMode,
      handleFetchCyclesCiRenders,
      localBlenderEndpoint,
      notify,
      pushHarnessActivity,
      refreshServerAndCi,
    ]
  );

  // 100% REAL Multi-Angle Vision QA Critique (sends up to 4 real captured angles + build.py!)
  const handleRunVisionAudit = async () => {
    setIsVisionRunning(true);
    try {
      let shotsToSend = realCaptures.slice(0, 4);
      if (shotsToSend.length === 0) {
        const fresh = viewportRef.current?.captureMultiAngleScreenshots() || [];
        setRealCaptures(fresh);
        shotsToSend = fresh;
      }

      const encodedImages: Array<{ label: string; imageBase64: string; mimeType: string }> = [];
      for (const s of shotsToSend) {
        if (s.dataUrl.startsWith('data:')) {
          const [meta, b64] = s.dataUrl.split(',');
          const mimeMatch = meta.match(/data:([^;]+);/);
          if (b64) {
            encodedImages.push({
              label: s.label,
              imageBase64: b64,
              mimeType: mimeMatch?.[1] || 'image/png',
            });
          }
        } else {
          try {
            const res = await fetch(s.dataUrl);
            const buf = await res.arrayBuffer();
            encodedImages.push({
              label: s.label,
              imageBase64: arrayBufferToBase64(buf),
              mimeType: res.headers.get('content-type') || 'image/png',
            });
          } catch {
            // Skip unreachable image
          }
        }
      }

      if (encodedImages.length === 0) {
        throw new Error('Capture at least one real viewport screenshot first.');
      }

      const auditRes = await fetchJsonSafe<VisionCritiqueResult & { error?: string }>(
        '/api/vision/critique',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            images: encodedImages,
            bpyScript: buildPyCode,
            userGoal: commitNote,
            passNumber: 1,
            systemSkill,
          }),
        }
      );

      if (!auditRes.ok || !auditRes.data || auditRes.data.error) {
        throw new Error(auditRes.data?.error || 'Vision QA requires server GEMINI_API_KEY.');
      }

      setVisionCritique(auditRes.data);
      pushHarnessActivity(
        'vision',
        `Multi-Angle Vision Critique (${encodedImages.length} Views)`,
        auditRes.data.summary.slice(0, 140),
        'completed',
        activeModelSlug
      );
      notify(`Completed real Vision QA across ${encodedImages.length} angles`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Vision audit failed');
    } finally {
      setIsVisionRunning(false);
    }
  };

  const handleApplyVisionPass2 = async () => {
    if (!visionCritique?.refinedScript) return;
    setBuildPyCode(visionCritique.refinedScript);
    setCommitNote(visionCritique.commitNote || 'Apply Vision QA Pass 2 reforms');
    setWorkbenchTab('script');
    pushHarnessActivity(
      'reform',
      'Applying Vision QA Reform Script',
      visionCritique.commitNote || 'Triggering Pass 2 Blender build',
      'running',
      activeModelSlug
    );
    await executeBuildPipeline(
      visionCritique.refinedScript,
      visionCritique.commitNote || 'Vision QA Pass 2 refinement'
    );
  };

  // Universal Export handlers
  const handleDownloadFormat = async (format: ExportFormatId) => {
    if (format === 'png') {
      viewportRef.current?.captureSnapshot(true);
      return;
    }
    if (format === 'blend') {
      const hasBlend = ciStatus?.assets?.some((a) => a.name === 'model.blend');
      if (hasBlend && !isStaticSite) {
        const a = document.createElement('a');
        a.href = '/api/github/artifacts/model.blend';
        a.download = 'model.blend';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }
      throw new Error('No .blend CI build available yet. Click "Build Native .blend via Cloud CI".');
    }
    const root = viewportRef.current?.getActiveModelRoot();
    if (!root) {
      throw new Error('Load or create a 3D model before exporting geometry.');
    }
    const { blob, filename } = await exportObject3DToBlob(
      root,
      format,
      telemetry.modelName || 'stone-lantern'
    );
    triggerBlobDownload(blob, filename);
  };

  const handleBuildBlendViaCloudCi = async () => {
    const root = viewportRef.current?.getActiveModelRoot();
    if (!root) throw new Error('Load a 3D model first.');
    const { blob } = await exportObject3DToBlob(root, 'py', telemetry.modelName || 'stone-lantern');
    const pyScript = await blob.text();
    setBuildPyCode(pyScript);
    const res = await executeBuildPipeline(
      pyScript,
      `Build native .blend for ${telemetry.modelName || 'model'}`
    );
    if (!res.ok) throw new Error(res.detail);
  };

  const handlePreviewConvertedModel = (summary: ParsedModelSummary) => {
    viewportRef.current?.mountParsedGroup(summary.group, summary.sourceFileName);
    setActiveModelSlug(sanitizeModelSlug(summary.group.name || summary.sourceFileName));
    notify(`Previewing ${summary.sourceFileName} on stage`);
  };

  const githubSlug =
    serverConfig?.githubOwner && serverConfig?.githubRepo
      ? `${serverConfig.githubOwner}/${serverConfig.githubRepo}`
      : null;

  const hasLatestBlendArtifact = Boolean(ciStatus?.assets?.some((a) => a.name === 'model.blend'));

  const navItems: Array<{ id: WorkspaceModeId; label: string }> = [
    { id: 'inspect', label: 'Inspect' },
    { id: 'world', label: 'World' },
    { id: 'lookdev', label: 'LookDev' },
    { id: 'pipeline', label: 'Pipeline' },
  ];

  const handleToggleOverlay = useCallback((key: keyof ViewportOverlayFlags) => {
    if (key === 'showGrid') {
      setShowGrid((prev) => {
        const next = !prev;
        setOverlays((o) => ({ ...o, showGrid: next }));
        return next;
      });
      return;
    }
    setOverlays((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Cycle gravity cleanly: Normal (9.81 m/s²) -> Low-G (3.5 m/s²) -> Zero-G Sky Flight -> Normal
  const handleCycleGravityMode = useCallback(() => {
    setPhysicsConfig((prev) => {
      if (prev.gravityEnabled && prev.gravityStrength >= 6) {
        notify('Low-G Gravity (3.5 m/s² — floating island leaps)');
        return { ...prev, gravityEnabled: true, gravityStrength: 3.5 };
      }
      if (prev.gravityEnabled) {
        notify('Zero-G Sky Flight (Space ascends · C/Down descends)');
        return { ...prev, gravityEnabled: false, gravityStrength: 9.81 };
      }
      notify('Normal Gravity (9.81 m/s²)');
      return { ...prev, gravityEnabled: true, gravityStrength: 9.81 };
    });
  }, [notify]);

  const gravityHeaderLabel = !physicsConfig.gravityEnabled
    ? 'Fly (0G)'
    : physicsConfig.gravityStrength < 6
      ? 'Low-G'
      : 'Gravity';

  const handleSaveTexturesToRepo = useCallback(async () => {
    const root = viewportRef.current?.getActiveModelRoot();
    if (!root) {
      notify('Load a 3D model first');
      return;
    }
    const extracted = await extractTexturesFromObject3D(root);
    if (extracted.length === 0) {
      notify('Apply a procedural PBR map or load a textured asset first');
      return;
    }
    if (serverConfig?.githubConfigured) {
      try {
        await handleSaveActiveStageToGithub('Props');
        return;
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Unable to save textures to GitHub');
        return;
      }
    }
    // Fallback: download first extracted texture locally so creator always gets tangible output
    extracted.slice(0, 3).forEach((t) => triggerBlobDownload(t.blob, t.name));
    notify(`Extracted ${extracted.length} PBR texture map(s)`);
  }, [handleSaveActiveStageToGithub, notify, serverConfig?.githubConfigured]);

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#F5F3EF] text-[#1C1B19]">
      {/* RESPONSIVE 3-ZONE TOP HEADER (Zero overflow from 360px mobile to 1440px+ desktop) */}
      <header className="relative z-40 flex h-13 shrink-0 items-center justify-between gap-2 border-b border-[#E5E1DA] bg-white px-2.5 sm:h-14 sm:px-5">
        {/* Left: Brand Wordmark + Undo / Redo */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => handleSelectWorkspaceMode('inspect')}
            aria-label="BlendFactory Home"
            className="flex shrink-0 items-center gap-2 text-left transition-opacity hover:opacity-80"
          >
            <span
              aria-hidden="true"
              className="flex h-6 w-6 items-center justify-center rounded-md bg-[#2D5A4C] text-white"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 1.5L14 5V11L8 14.5L2 11V5L8 1.5Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path d="M8 8V14.5M8 8L14 5M8 8L2 5" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            </span>
            <span className="hidden font-display text-[17px] font-medium tracking-[-0.02em] text-[#1C1B19] sm:inline">
              BlendFactory
            </span>
          </button>

          <div className="mx-0.5 hidden h-5 w-px bg-[#E5E1DA] sm:block" />

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              disabled={!historySummary.canUndo}
              onClick={() => viewportRef.current?.undo()}
              title={
                historySummary.undoLabel
                  ? `Undo: ${historySummary.undoLabel} (Ctrl+Z)`
                  : 'Undo (Ctrl+Z)'
              }
              aria-label="Undo last action"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-transparent text-[#5A564F] transition-colors hover:border-[#E5E1DA] hover:bg-[#FAF9F6] hover:text-[#1C1B19] disabled:opacity-35"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={!historySummary.canRedo}
              onClick={() => viewportRef.current?.redo()}
              title={
                historySummary.redoLabel
                  ? `Redo: ${historySummary.redoLabel} (Ctrl+Y)`
                  : 'Redo (Ctrl+Y)'
              }
              aria-label="Redo last action"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-transparent text-[#5A564F] transition-colors hover:border-[#E5E1DA] hover:bg-[#FAF9F6] hover:text-[#1C1B19] disabled:opacity-35"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Center: Workspace Modes (md+) + Play/Stop & Gravity Mode Cycle (always visible!) */}
        <nav aria-label="Workspace modes" className="flex items-center gap-1 sm:gap-1.5">
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const active =
                workspaceMode === item.id && (item.id !== 'pipeline' || workbenchOpen);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectWorkspaceMode(item.id)}
                  className={`relative shrink-0 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-[#EBF2EF] text-[#1D4438]'
                      : 'text-[#5A564F] hover:bg-[#F5F3EF] hover:text-[#1C1B19]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
            <div className="mx-1 h-5 w-px shrink-0 bg-[#E5E1DA]" />
          </div>

          <button
            type="button"
            onClick={() => viewportRef.current?.togglePlayMode()}
            title={
              playModeStatus.active
                ? 'Stop Play Mode & Restore Scene (Esc)'
                : 'Enter Temporary Play Mode (WASD / Touch Keys + Space)'
            }
            aria-label={playModeStatus.active ? 'Stop play mode' : 'Start play mode'}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors ${
              playModeStatus.active
                ? 'border-[#9E3134] bg-[#9E3134] text-white hover:bg-[#822528]'
                : 'border-[#CFE2DA] bg-[#F2F8F5] text-[#1D4438] hover:border-[#2D5A4C] hover:bg-[#E4F0EB]'
            }`}
          >
            {playModeStatus.active ? (
              <Square className="h-3 w-3 fill-current" />
            ) : (
              <Play className="h-3 w-3 fill-current" />
            )}
            <span>{playModeStatus.active ? 'Stop' : 'Play'}</span>
          </button>

          <button
            type="button"
            onClick={handleCycleGravityMode}
            title="Cycle Gravity: Normal (9.81 m/s²) → Low-G (3.5 m/s²) → Zero-G Sky Flight"
            aria-label={`Gravity mode: ${gravityHeaderLabel}`}
            className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1.5 text-[11.5px] font-medium whitespace-nowrap transition-colors ${
              !physicsConfig.gravityEnabled
                ? 'border-[#2D5A4C] bg-[#EBF2EF] text-[#1D4438]'
                : physicsConfig.gravityStrength < 6
                  ? 'border-[#C9DBD3] bg-[#F4F9F6] text-[#2D5A4C]'
                  : 'border-[#E5E1DA] bg-[#FAF9F6] text-[#5A564F] hover:text-[#1C1B19]'
            }`}
          >
            {!physicsConfig.gravityEnabled ? (
              <Wind className="h-3.5 w-3.5 text-[#2D5A4C]" />
            ) : physicsConfig.gravityStrength < 6 ? (
              <Feather className="h-3.5 w-3.5 text-[#2D5A4C]" />
            ) : (
              <Magnet className="h-3.5 w-3.5 text-[#2D5A4C]" />
            )}
            <span className="hidden sm:inline">{gravityHeaderLabel}</span>
          </button>
        </nav>

        {/* Right: Desktop Utility Actions + Export CTA + Mobile Overflow Menu */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={() => setManualOpen(true)}
            aria-label="Open user manual"
            className="hidden md:inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#E5E1DA] bg-[#FAF9F6] px-2.5 py-1.5 text-[12px] font-medium whitespace-nowrap text-[#5A564F] transition-colors hover:bg-[#F0EDE6] hover:text-[#1C1B19]"
          >
            <BookOpen className="h-3.5 w-3.5 text-[#2D5A4C]" />
            <span className="hidden xl:inline">Manual</span>
          </button>

          <button
            type="button"
            onClick={() => setCreatorOpen(true)}
            aria-label="Open creator and about info"
            className="hidden md:inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#E5E1DA] bg-[#FAF9F6] px-2.5 py-1.5 text-[12px] font-medium whitespace-nowrap text-[#5A564F] transition-colors hover:bg-[#F0EDE6] hover:text-[#1C1B19]"
          >
            <User className="h-3.5 w-3.5 text-[#2D5A4C]" />
            <span className="hidden xl:inline">Creator</span>
          </button>

          <button
            type="button"
            onClick={() => setConverterOpen(true)}
            aria-label="Open 3D file extension converter"
            className="hidden md:inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#E5E1DA] bg-[#FAF9F6] px-2.5 py-1.5 text-[12px] font-medium whitespace-nowrap text-[#5A564F] transition-colors hover:bg-[#F0EDE6] hover:text-[#1C1B19]"
          >
            <ArrowRightLeft className="h-3.5 w-3.5 text-[#2D5A4C]" />
            <span className="hidden lg:inline">Convert</span>
          </button>

          <button
            type="button"
            onClick={() => setExportOpen(true)}
            aria-label="Export 3D asset"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#2D5A4C] px-2.5 py-1.5 text-[12px] font-medium whitespace-nowrap text-white transition-colors hover:bg-[#22453A] sm:px-3.5 sm:text-[12.5px]"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Mobile Menu Trigger (< md) */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close studio menu' : 'Open studio menu'}
            aria-expanded={mobileMenuOpen}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E5E1DA] bg-[#FAF9F6] text-[#1C1B19] transition-colors hover:bg-[#F0EDE6] md:hidden"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {/* Mobile Overflow Navigation Drawer (< md) */}
        {mobileMenuOpen && (
          <div
            role="menu"
            aria-label="Mobile Studio Menu"
            className="absolute top-full right-2.5 z-50 mt-1.5 w-64 max-w-[calc(100vw-20px)] space-y-2.5 rounded-2xl border border-[#E5E1DA] bg-white p-3 shadow-[0_14px_34px_rgba(28,27,25,0.16)] md:hidden"
          >
            <div>
              <div className="mb-1.5 px-1 text-[10px] font-semibold tracking-[0.04em] text-[#847E75] uppercase">
                Workspace
              </div>
              <div className="grid grid-cols-2 gap-1">
                {navItems.map((item) => {
                  const active =
                    workspaceMode === item.id && (item.id !== 'pipeline' || workbenchOpen);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        handleSelectWorkspaceMode(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`rounded-lg px-2.5 py-1.5 text-left text-[12px] font-medium transition-colors ${
                        active
                          ? 'bg-[#EBF2EF] text-[#1D4438]'
                          : 'bg-[#FAF9F6] text-[#4F4B45] hover:bg-[#F0EDE6]'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1 border-t border-[#EFECE6] pt-2 text-[12px]">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setLibraryOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-medium text-[#1C1B19] hover:bg-[#F5F3EF]"
              >
                <Layers className="h-3.5 w-3.5 text-[#2D5A4C]" />
                Model Library
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setWorkbenchOpen(false);
                  setInspectorOpen((p) => !p);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-medium text-[#1C1B19] hover:bg-[#F5F3EF]"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-[#2D5A4C]" />
                {inspectorOpen ? 'Hide Inspector' : 'Open Inspector'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setConverterOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-medium text-[#1C1B19] hover:bg-[#F5F3EF]"
              >
                <ArrowRightLeft className="h-3.5 w-3.5 text-[#2D5A4C]" />
                3D Format Converter
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setManualOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-medium text-[#1C1B19] hover:bg-[#F5F3EF]"
              >
                <BookOpen className="h-3.5 w-3.5 text-[#2D5A4C]" />
                User Manual
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setCreatorOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-medium text-[#1C1B19] hover:bg-[#F5F3EF]"
              >
                <User className="h-3.5 w-3.5 text-[#2D5A4C]" />
                Creator & About
              </button>
            </div>
          </div>
        )}
      </header>

      {/* FULL-BLEED 3D STAGE */}
      <main className="relative min-h-0 flex-1 overflow-hidden">
        <StudioViewport
          ref={viewportRef}
          shadingPass={shadingPass}
          onShadingPassChange={setShadingPass}
          quadView={quadView}
          onToggleQuadView={() => setQuadView((p) => !p)}
          showGrid={showGrid}
          onToggleGrid={() => handleToggleOverlay('showGrid')}
          overlays={overlays}
          onToggleOverlay={handleToggleOverlay}
          cameraFov={cameraFov}
          cameraSpeed={cameraSpeed}
          autoSpin={autoSpin}
          onToggleAutoSpin={() => setAutoSpin((p) => !p)}
          exploded={exploded}
          onToggleExploded={() => setExploded((p) => !p)}
          lightingPreset={lightingPreset}
          onLightingPresetChange={setLightingPreset}
          lightAngleDeg={lightAngleDeg}
          onLightAngleChange={setLightAngleDeg}
          sunElevationDeg={sunElevationDeg}
          shadowsEnabled={shadowsEnabled}
          wireframeOpacity={wireframeOpacity}
          onWireframeOpacityChange={setWireframeOpacity}
          insideOutSide={insideOutSide}
          surfaceParams={surfaceParams}
          sectionCut={sectionCut}
          onSectionCutChange={setSectionCut}
          showSkeleton={showSkeleton}
          gizmoMode={gizmoMode}
          onGizmoModeChange={setGizmoMode}
          gizmoSpace={gizmoSpace}
          snapGrid={snapGrid}
          snapRotateDeg={snapRotateDeg}
          snapScale={snapScale}
          worldEnvPreset={worldEnvPreset}
          worldFogDensity={worldFogDensity}
          worldFogHeight={worldFogHeight}
          terrainBrush={terrainBrush}
          scatterBrush={scatterBrush}
          physicsConfig={physicsConfig}
          onCycleGravityMode={handleCycleGravityMode}
          activeToolMode={activeToolMode}
          onToolModeChange={setActiveToolMode}
          onHistoryChange={setHistorySummary}
          onPlayModeChange={setPlayModeStatus}
          executionMode={executionMode}
          fsSupported={fsSupported}
          inspectorOpen={inspectorOpen || workbenchOpen}
          onOpenLibrary={() => setLibraryOpen(true)}
          onToggleInspector={() => {
            setWorkbenchOpen(false);
            setInspectorOpen((p) => !p);
          }}
          onLinkLocalFolder={handleLinkLocalFolder}
          onRequestExecutionMode={handleRequestExecutionMode}
          onNotify={notify}
          onTelemetryChange={setTelemetry}
          onCameraTelemetryChange={setCameraTelemetry}
          onDiagnosticsChange={setDiagnostics}
          onOutlinerChange={setOutlinerNodes}
          onSelectedNodeChange={setSelectedNodeUuid}
          onSoloNodeChange={setSoloNodeUuid}
          onTransformInfoChange={setTransformInfo}
          onMaterialsChange={setMaterials}
          onBonesChange={setBones}
          onAnimationsChange={(clips, activeIdx, duration) => {
            setAnimationClips(clips);
            setActiveClipIndex(activeIdx);
            setAnimationDuration(duration);
          }}
          onAnimationTimeChange={(timeSec, playing) => {
            setAnimationTime(timeSec);
            setAnimationPlaying(playing);
          }}
          onSelectedLightChange={setSelectedLightInfo}
          onSelectedCameraChange={setSelectedCameraInfo}
          onCaptureViewportToRepo={(dataUrl, angle) => {
            handleCaptureViewportToRepo(dataUrl, angle);
          }}
        />

        {/* ON-DEMAND STUDIO INSPECTOR SHEET (Scene / World / Shader / Mesh / Rig) */}
        <InspectorSheet
          open={inspectorOpen}
          activeTab={inspectorTab}
          onTabChange={setInspectorTab}
          onClose={() => setInspectorOpen(false)}
          telemetry={telemetry}
          diagnostics={diagnostics}
          outlinerNodes={outlinerNodes}
          selectedNodeUuid={selectedNodeUuid}
          soloNodeUuid={soloNodeUuid}
          transformInfo={transformInfo}
          lightingPreset={lightingPreset}
          lightAngleDeg={lightAngleDeg}
          surfaceParams={surfaceParams}
          insideOutSide={insideOutSide}
          sectionCut={sectionCut}
          materials={materials}
          showSkeleton={showSkeleton}
          bones={bones}
          animationClips={animationClips}
          activeClipIndex={activeClipIndex}
          animationPlaying={animationPlaying}
          animationTime={animationTime}
          animationDuration={animationDuration}
          gizmoMode={gizmoMode}
          gizmoSpace={gizmoSpace}
          snapGrid={snapGrid}
          snapRotateDeg={snapRotateDeg}
          snapScale={snapScale}
          worldEnvPreset={worldEnvPreset}
          worldFogDensity={worldFogDensity}
          worldFogHeight={worldFogHeight}
          sunElevationDeg={sunElevationDeg}
          shadowsEnabled={shadowsEnabled}
          cameraFov={cameraFov}
          cameraSpeed={cameraSpeed}
          activeToolMode={activeToolMode}
          terrainBrush={terrainBrush}
          scatterBrush={scatterBrush}
          physicsConfig={physicsConfig}
          playModeActive={playModeStatus.active}
          onGizmoModeChange={setGizmoMode}
          onGizmoSpaceChange={setGizmoSpace}
          onSnapGridChange={setSnapGrid}
          onSnapRotateChange={setSnapRotateDeg}
          onSnapScaleChange={setSnapScale}
          onSunElevationChange={setSunElevationDeg}
          onToggleShadows={() => setShadowsEnabled((p) => !p)}
          onWorldFogHeightChange={setWorldFogHeight}
          onCameraFovChange={setCameraFov}
          onCameraSpeedChange={setCameraSpeed}
          onActiveToolModeChange={(mode) => {
            setActiveToolMode(mode);
            viewportRef.current?.setViewportToolMode(mode);
          }}
          onTerrainBrushChange={setTerrainBrush}
          onScatterBrushChange={setScatterBrush}
          onPhysicsConfigChange={setPhysicsConfig}
          onResetPhysics={() => viewportRef.current?.resetPhysicsState()}
          onTogglePlayMode={() => viewportRef.current?.togglePlayMode()}
          onEditMaterial={(payload) => viewportRef.current?.editMaterial(payload)}
          onSaveTexturesToRepo={handleSaveTexturesToRepo}
          onGroupSelected={() => viewportRef.current?.groupSelectedNode()}
          onUnparentNode={(uuid) => viewportRef.current?.unparentNode(uuid)}
          onAddPrimitive={(kind) => viewportRef.current?.addWorldPrimitive(kind)}
          onOpenLibraryToAppend={() => setLibraryOpen(true)}
          onDuplicateSelected={() => viewportRef.current?.duplicateSelected()}
          onDeleteSelected={() => viewportRef.current?.deleteSelected()}
          onMirrorSelected={(axis) => viewportRef.current?.mirrorSelected(axis)}
          onSnapSelectedToGround={() => viewportRef.current?.snapSelectedToGround()}
          onToggleFlatShading={() => viewportRef.current?.toggleSelectedFlatShading()}
          onApplyArrayModifier={(count, offset) =>
            viewportRef.current?.applyArrayModifier(count, offset)
          }
          onApplyScatterModifier={(count, radius) =>
            viewportRef.current?.applyScatterModifier(count, radius)
          }
          onWorldEnvChange={(preset, fog) => {
            setWorldEnvPreset(preset);
            setWorldFogDensity(fog);
          }}
          onSelectNode={(uuid) => viewportRef.current?.selectNode(uuid)}
          onToggleNodeVisibility={(uuid) => viewportRef.current?.toggleNodeVisibility(uuid)}
          onToggleNodeLock={(uuid) => viewportRef.current?.toggleNodeLock(uuid)}
          onToggleSoloNode={(uuid) => viewportRef.current?.toggleSoloNode(uuid)}
          onShowAllNodes={() => viewportRef.current?.showAllNodes()}
          onTransformChange={(axis, val) => viewportRef.current?.updateTransform(axis, val)}
          onSurfaceParamsChange={setSurfaceParams}
          onInsideOutSideChange={setInsideOutSide}
          onSectionCutChange={setSectionCut}
          onRecalculateNormals={() => viewportRef.current?.recalculateNormals()}
          onPurgeDegenerates={() => viewportRef.current?.purgeDegenerates()}
          onToggleSkeleton={() => setShowSkeleton((p) => !p)}
          onSelectClip={(idx) => viewportRef.current?.selectAnimationClip(idx)}
          onTogglePlayAnimation={() => viewportRef.current?.togglePlayAnimation()}
          onScrubAnimation={(t) => viewportRef.current?.scrubAnimation(t)}
          onBoneRotationChange={(uuid, axis, deg) =>
            viewportRef.current?.setBoneRotation(uuid, axis, deg)
          }
          onResetPose={() => viewportRef.current?.resetPose()}
          selectedLightInfo={selectedLightInfo}
          selectedCameraInfo={selectedCameraInfo}
          onUpdateLightProperties={(uuid, patch) =>
            viewportRef.current?.updateLightProperties(uuid, patch)
          }
          onUpdateCameraProperties={(uuid, patch) =>
            viewportRef.current?.updateCameraProperties(uuid, patch)
          }
          onSetActiveSceneCamera={(uuid) => viewportRef.current?.setActiveSceneCamera(uuid)}
          onToggleLookThroughCamera={(uuid) => viewportRef.current?.toggleLookThroughCamera(uuid)}
          onAlignCameraToView={(uuid) => viewportRef.current?.alignCameraToCurrentView(uuid)}
          onCaptureCameraToRepo={() => {
            const shot = viewportRef.current?.captureActiveCameraSnapshot();
            if (shot) handleCaptureViewportToRepo(shot, 'camera');
          }}
        />

        {/* ON-DEMAND PIPELINE & AI HARNESS WORKBENCH (Zero Chatbox!) */}
        <WorkbenchSheet
          open={workbenchOpen}
          activeTab={workbenchTab}
          onTabChange={setWorkbenchTab}
          onClose={() => {
            setWorkbenchOpen(false);
            if (workspaceMode === 'pipeline') setWorkspaceMode('inspect');
          }}
          isStaticSite={isStaticSite}
          geminiConfigured={Boolean(serverConfig?.geminiConfigured)}
          githubConfigured={Boolean(serverConfig?.githubConfigured)}
          executionMode={executionMode}
          localBlenderEndpoint={localBlenderEndpoint}
          ciStatus={ciStatus}
          activeModelSlug={activeModelSlug}
          onActiveModelSlugChange={(slug) => setActiveModelSlug(sanitizeModelSlug(slug))}
          harnessAutoSync={harnessAutoSync}
          onToggleHarnessAutoSync={() => setHarnessAutoSync((p) => !p)}
          harnessActivities={harnessActivities}
          onSaveBundleToGithub={handleSaveActiveStageToGithub}
          onCaptureAndStoreScreenshots={handleCaptureAndStoreScreenshots}
          onSyncHarnessNow={handleSyncHarnessNow}
          onOpenAgentManual={handleOpenAgentManual}
          realCaptures={realCaptures}
          compareAId={compareAId}
          compareBId={compareBId}
          onCompareAIdChange={setCompareAId}
          onCompareBIdChange={setCompareBId}
          visionCritique={visionCritique}
          isVisionRunning={isVisionRunning}
          onCaptureMultiAngleSheet={handleCaptureMultiAngleSheet}
          onFetchCyclesCiRenders={handleFetchCyclesCiRenders}
          onRunVisionAudit={handleRunVisionAudit}
          onApplyVisionPass2={handleApplyVisionPass2}
          buildPyCode={buildPyCode}
          commitNote={commitNote}
          isBuildRunning={isBuildRunning}
          onBuildPyChange={setBuildPyCode}
          onCommitNoteChange={setCommitNote}
          onResetStarterScript={() => {
            setBuildPyCode(STARTER_BUILD_PY);
            notify('Restored starter scripts/build.py');
          }}
          onCommitAndBuild={() => {
            executeBuildPipeline(buildPyCode, commitNote);
          }}
          onRefreshCiStatus={() => {
            refreshServerAndCi();
            notify('Refreshed Cloud CI status');
          }}
          localFolderName={localFolderName}
          fsSupported={fsSupported}
          workspaceFiles={workspaceFiles}
          workspaceSyncedSource={workspaceSyncedSource}
          selectedFilePath={selectedFilePath}
          selectedFileContent={selectedFileContent}
          isWorkspaceLoading={isWorkspaceLoading}
          onRefreshGithubWorkspace={refreshGithubWorkspace}
          onLinkLocalFolder={handleLinkLocalFolder}
          onSelectWorkspaceFile={handleSelectWorkspaceFile}
          onSelectedFileContentChange={setSelectedFileContent}
          onCommitWorkspaceFileToGithub={handleCommitWorkspaceFileToGithub}
          onRequestExecutionMode={handleRequestExecutionMode}
          systemSkill={systemSkill}
          onSystemSkillChange={setSystemSkill}
          onResetSystemSkill={() => {
            setSystemSkill(DEFAULT_BLENDER_SKILL);
            notify('Restored default Blender 4.2 System Skill');
          }}
          onNotify={notify}
        />

        {/* Quiet Floating Toast Notification */}
        {toastMessage && (
          <div
            role="status"
            aria-live="polite"
            className="atelier-surface animate-atelier-popover pointer-events-none fixed bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-xl px-4 py-2 text-[12px] font-medium text-[#1C1B19]"
          >
            {toastMessage}
          </div>
        )}
      </main>

      {/* ORGANIZED MODEL LIBRARY MODAL */}
      <LibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        models={allAvailableModels}
        activeModelId={activeModelId}
        hasActiveModel={Boolean(telemetry.modelName)}
        githubConfigured={Boolean(serverConfig?.githubConfigured)}
        githubSlug={githubSlug}
        driveSignedIn={driveSignedIn}
        driveUserEmail={driveUserEmail}
        localFolderName={localFolderName}
        fsSupported={fsSupported}
        isBusy={libraryBusy}
        onSelectModel={handleSelectModel}
        onAppendModelToWorld={handleAppendModelToWorld}
        onClearToPointCloud={() => {
          viewportRef.current?.clearToPointCloud();
          setActiveModelId(null);
        }}
        onImportLocalFile={handleImportLocalFile}
        onUploadToGithub={handleUploadFileToGithub}
        onSaveActiveStageToGithub={handleSaveActiveStageToGithub}
        onBackupSelectedToDrive={handleBackupModelsToDrive}
        onOpenConverter={() => setConverterOpen(true)}
        onSignInDrive={handleSignInDrive}
        onSignOutDrive={handleSignOutDrive}
        onRefreshAll={async () => {
          await refreshServerAndCi();
          if (driveSignedIn) await refreshDriveModels();
          notify('Synced Model Library & GitHub Repo');
        }}
        onLinkLocalFolder={handleLinkLocalFolder}
      />

      {/* UNIVERSAL 16-FORMAT EXPORT & CLOUD BUNDLE MODAL */}
      <ExportDialog
        open={exportOpen}
        activeModelName={telemetry.modelName}
        hasActiveModel={Boolean(telemetry.modelName)}
        githubConfigured={Boolean(serverConfig?.githubConfigured)}
        hasLatestBlendArtifact={hasLatestBlendArtifact}
        driveSignedIn={driveSignedIn}
        driveUserEmail={driveUserEmail}
        isBusy={isBuildRunning}
        onClose={() => setExportOpen(false)}
        onOpenConverter={() => setConverterOpen(true)}
        onDownloadFormat={handleDownloadFormat}
        onSaveViewportToRepo={async () => {
          const dataUrl = viewportRef.current?.captureSnapshot(false);
          if (!dataUrl) throw new Error('Unable to capture viewport frame.');
          await handleCaptureViewportToRepo(dataUrl, 'viewport');
        }}
        onBuildBlendViaCloudCi={handleBuildBlendViaCloudCi}
        onPushBundleToGithub={handleSaveActiveStageToGithub}
        onBackupBundleToDrive={handleBackupActiveBundleToDrive}
        onSignInDrive={handleSignInDrive}
      />

      {/* DEDICATED 3D FILE EXTENSION CONVERTER MODAL */}
      <ConverterModal
        open={converterOpen}
        onClose={() => setConverterOpen(false)}
        githubConfigured={Boolean(serverConfig?.githubConfigured)}
        onPreviewParsedModel={handlePreviewConvertedModel}
        onSaveConvertedToGithub={handleSaveConvertedToGithub}
        onNotify={notify}
      />

      {/* 2FA LOCAL BLENDER BRIDGE MODAL */}
      <TwoFactorModal
        open={twoFactorOpen}
        currentLocalEndpoint={localBlenderEndpoint}
        onClose={() => setTwoFactorOpen(false)}
        onApproved={(endpoint) => {
          setLocalBlenderEndpoint(endpoint);
          setExecutionMode('local');
          setTwoFactorOpen(false);
          notify('Unlocked Local Blender Bridge');
        }}
      />

      {/* USER MANUAL MODAL */}
      <ManualModal open={manualOpen} onClose={() => setManualOpen(false)} />

      {/* CREATOR / ABOUT MODAL */}
      <CreatorModal
        open={creatorOpen}
        onClose={() => setCreatorOpen(false)}
        repoOwner={serverConfig?.githubOwner}
        repoName={serverConfig?.githubRepo}
      />
    </div>
  );
}

export default App;
