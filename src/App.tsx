import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import pass1ReferenceImg from './assets/images/lantern_render_pass1_1795369398050.jpg';
import pass2ReferenceImg from './assets/images/lantern_render_pass2_1795369396454.jpg';
import type {
  AnimationClipSummary,
  AvailableModelItem,
  BoneControlInfo,
  CameraTelemetry,
  ChatMessageItem,
  DragMouseMode,
  ExecutionMode,
  GeminiContentTurn,
  GitHubCiStatus,
  HdriPreset,
  InsideOutSide,
  InspectorTabId,
  LeftToolMode,
  MaterialChannelInfo,
  OutlinerNode,
  PendingDiffProposal,
  SceneTelemetry,
  SectionCutConfig,
  ServerConfig,
  ShadingPass,
  StudioDrawerTabId,
  SurfaceParams,
  ToolTrace,
  TopologyDiagnostics,
  TransformInfo,
  VisionCritiqueResult,
  WorkspaceFileEntry,
  WorkspaceTabId,
} from './types';
import {
  DEFAULT_BLENDER_SKILL,
  SYSTEM_SKILL_STORAGE_KEY,
  STARTER_BUILD_PY,
} from './utils/blenderSkill';
import {
  validateModelUpload,
} from './utils/modelUploadValidation';
import {
  normalizeWorkspacePath,
  validateLocalBlenderEndpoint,
} from './utils/pathSafety';
import {
  downloadDriveModelAsBlobUrl,
  initDriveAuth,
  listDrive3DModels,
  signInWithGoogleDrive,
  signOutGoogleDrive,
  uploadModelToGoogleDrive,
} from './utils/googleDrive';
import {
  formatExportFilename,
  triggerBlobDownload,
  type ExportFormatId,
} from './utils/modelExporters';
import { EntranceAnimation } from './components/EntranceAnimation';
import { ApexViewport, type ApexViewportHandle } from './components/ApexViewport';
import { RightInspector } from './components/RightInspector';
import { AssetRepositoryModal } from './components/AssetRepositoryModal';
import { ExportModal } from './components/ExportModal';
import { StudioDrawer } from './components/StudioDrawer';
import { TwoFactorSwitchModal } from './components/TwoFactorSwitchModal';

interface DirectoryHandleLike {
  name: string;
  entries: () => AsyncIterable<[string, HandleLike]>;
  getDirectoryHandle: (name: string, opts?: { create?: boolean }) => Promise<DirectoryHandleLike>;
  getFileHandle: (name: string, opts?: { create?: boolean }) => Promise<FileHandleLike>;
}

interface FileHandleLike {
  kind: 'file';
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }>;
}

type HandleLike =
  | FileHandleLike
  | (DirectoryHandleLike & { kind: 'directory' });

const STUDIO_SPECIMENS: AvailableModelItem[] = [
  {
    id: 'specimen:apex-mech',
    name: 'Apex_Titan_Mk4',
    source: 'specimen',
    format: 'procedural',
    category: 'Mech_Frames',
    specimenKind: 'apex-mech',
    viewable: true,
    description:
      '5-assembly hard-surface mech rig (Sub_Chassis_Hull, Cockpit_Canopy_Armor, Hydraulic_Pistons_Rig, Shoulder_Gatling_Pods, Bipedal_Leg_Struts) with 4 bones & scan clip.',
  },
  {
    id: 'specimen:rigged-arm',
    name: 'Articulated_Rigged_Arm',
    source: 'specimen',
    format: 'procedural',
    category: 'Rigged_Assets',
    specimenKind: 'rigged-arm',
    viewable: true,
    description:
      'Multi-jointed robotic arm with live skeleton posing, PBR brushed alloy textures, and calibrated servo animation.',
  },
  {
    id: 'specimen:stone-lantern',
    name: 'Stone_Cedar_Lantern',
    source: 'specimen',
    format: 'procedural',
    category: 'Environment_Props',
    specimenKind: 'stone-lantern',
    viewable: true,
    description:
      'Beveled architectural stone & cedar lantern matching starter scripts/build.py with emissive glass core.',
  },
];

const SHADING_PASSES: { id: ShadingPass; label: string; title: string }[] = [
  { id: 'combined', label: 'Combined', title: 'Combined Studio PBR Shading' },
  { id: 'wireframe', label: 'Wireframe', title: 'Wireframe Mesh Cage' },
  { id: 'albedo', label: 'Albedo', title: 'Diffuse / Albedo Flat Color' },
  { id: 'normal', label: 'Normal', title: 'Tangent Space Normal Map' },
  { id: 'roughness', label: 'Roughness', title: 'Roughness / Gloss Map' },
  { id: 'matcap', label: 'MatCap', title: 'Pure Clay / Sculptor MatCap' },
  { id: 'xray', label: 'X-Ray', title: 'Topology X-Ray' },
  { id: 'uv', label: 'UV', title: 'UV Checker Grid' },
];

function nowTimeLabel(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

async function blobToBase64(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const str = String(reader.result || '');
      resolve(str.replace(/^data:[^;]+;base64,/, ''));
    };
    reader.onerror = () => reject(new Error('Failed to encode binary payload.'));
    reader.readAsDataURL(blob);
  });
}

export function App() {
  const viewportRef = useRef<ApexViewportHandle | null>(null);
  const localDirHandleRef = useRef<DirectoryHandleLike | null>(null);
  const objectUrlsRef = useRef<string[]>([]);

  // Three.js Entrance Animation State
  const [showEntrance, setShowEntrance] = useState(true);

  // Top Header / Workspace / Navigation State
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTabId>('inspection');
  const [openMenu, setOpenMenu] = useState<'file' | 'edit' | 'asset' | 'render' | 'view' | 'help' | null>(null);
  const [sceneDropdownOpen, setSceneDropdownOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [inspectorTab, setInspectorTab] = useState<InspectorTabId>('outliner');

  // Modals & Studio Drawer State
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<StudioDrawerTabId>('agent');
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Viewport Controls State
  const [isQuadView, setIsQuadView] = useState(false);
  const [isAutoSpin, setIsAutoSpin] = useState(false);
  const [showGridOverlays, setShowGridOverlays] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [dragMode, setDragMode] = useState<DragMouseMode>('orbit');
  const [activeTool, setActiveTool] = useState<LeftToolMode>('orbit');
  const [shadingPass, setShadingPass] = useState<ShadingPass>('combined');
  const [insideOutSide, setInsideOutSide] = useState<InsideOutSide>('front');
  const [sectionCut, setSectionCut] = useState<SectionCutConfig>({
    enabled: false,
    axis: 'y',
    position: 1.0,
    invert: false,
  });
  const [surfaceParams, setSurfaceParams] = useState<SurfaceParams>({
    overrideEnabled: false,
    baseColor: '#40444c',
    metallic: 0.82,
    roughness: 0.24,
    normalStrength: 1.0,
    emission: 0.65,
  });
  const [lightAngle, setLightAngle] = useState(45);
  const [wireOpacity, setWireOpacity] = useState(35);
  const [hdriPreset, setHdriPreset] = useState<HdriPreset>('studio-4k');
  const [liveFps, setLiveFps] = useState(60.0);
  const [cursorCoords, setCursorCoords] = useState({ x: 0, y: 0 });

  // Scene Inspector State (populated live from ApexViewport)
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [outlinerNodes, setOutlinerNodes] = useState<OutlinerNode[]>([]);
  const [selectedNodeUuid, setSelectedNodeUuid] = useState<string | null>(null);
  const [selectedNodeName, setSelectedNodeName] = useState<string>('Point Cloud Stage');
  const [bones, setBones] = useState<BoneControlInfo[]>([]);
  const [materials, setMaterials] = useState<MaterialChannelInfo[]>([]);
  const [clips, setClips] = useState<AnimationClipSummary[]>([]);
  const [activeClipIdx, setActiveClipIdx] = useState(0);
  const [animPlaying, setAnimPlaying] = useState(false);
  const [animTime, setAnimTime] = useState(0);
  const [sceneTelemetry, setSceneTelemetry] = useState<SceneTelemetry>({
    modelName: null,
    meshCount: 0,
    boneCount: 0,
    materialCount: 0,
    vertexCount: 3450,
    edgeCount: 0,
    triangleCount: 0,
    boundsSize: [0, 0, 0],
    hasAnimations: false,
  });
  const [transformInfo, setTransformInfo] = useState<TransformInfo>({
    uuid: null,
    name: 'Point_Cloud_Stage',
    posX: 0,
    posY: 0,
    posZ: 0,
    rotX: 18,
    rotY: 38,
    rotZ: 0,
  });
  const [diagnostics, setDiagnostics] = useState<TopologyDiagnostics>({
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
  });

  // Backend, GitHub CI, Local Backup, Google Drive, Local Files & Skill State
  const [mode, setMode] = useState<ExecutionMode>('cloud');
  const [localEndpoint, setLocalEndpoint] = useState('http://127.0.0.1:8787/blender');
  const [localOfflineBanner, setLocalOfflineBanner] = useState<string | null>(null);
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);
  const [ciStatus, setCiStatus] = useState<GitHubCiStatus | null>(null);
  const [githubModels, setGithubModels] = useState<AvailableModelItem[]>([]);
  const [driveModels, setDriveModels] = useState<AvailableModelItem[]>([]);
  const [localModels, setLocalModels] = useState<AvailableModelItem[]>([]);
  const [driveUser, setDriveUser] = useState<User | null>(null);

  // Script, Skill, Workspace Files, Chat & Vision State
  const [buildPy, setBuildPy] = useState<string>(STARTER_BUILD_PY);
  const [buildBusy, setBuildBusy] = useState(false);
  const [systemSkill, setSystemSkill] = useState<string>(() => {
    try {
      return localStorage.getItem(SYSTEM_SKILL_STORAGE_KEY) || DEFAULT_BLENDER_SKILL;
    } catch {
      return DEFAULT_BLENDER_SKILL;
    }
  });
  const [localFolderName, setLocalFolderName] = useState<string | null>(null);
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFileEntry[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>('scripts/build.py');

  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [geminiHistory, setGeminiHistory] = useState<GeminiContentTurn[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [diffProposals, setDiffProposals] = useState<Record<string, PendingDiffProposal>>({});

  const [pass1ImageUrl, setPass1ImageUrl] = useState<string>(pass1ReferenceImg);
  const [pass2ImageUrl, setPass2ImageUrl] = useState<string>(pass2ReferenceImg);
  const [latestVisionCritique, setLatestVisionCritique] = useState<VisionCritiqueResult | null>(null);
  const [visionBusy, setVisionBusy] = useState(false);

  const notify = useCallback((msg: string) => {
    setToastMsg(msg);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 3400);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  useEffect(() => {
    try {
      localStorage.setItem(SYSTEM_SKILL_STORAGE_KEY, systemSkill);
    } catch {
      // Ignore storage quota errors
    }
  }, [systemSkill]);

  useEffect(() => {
    return () => {
      for (const u of objectUrlsRef.current) URL.revokeObjectURL(u);
    };
  }, []);

  // Combined list of all real available 3D models
  const allAvailableModels = useMemo<AvailableModelItem[]>(() => {
    return [...githubModels, ...driveModels, ...localModels, ...STUDIO_SPECIMENS];
  }, [githubModels, driveModels, localModels]);

  // Fetch server config, GitHub CI status, GitHub models & starter files
  const refreshGitHubAndModels = useCallback(async () => {
    try {
      const [cfgRes, statusRes, modelsRes] = await Promise.all([
        fetch('/api/config'),
        fetch('/api/github/status'),
        fetch('/api/github/models'),
      ]);
      if (cfgRes.ok) {
        setServerConfig((await cfgRes.json()) as ServerConfig);
      }
      if (statusRes.ok) {
        const st = (await statusRes.json()) as GitHubCiStatus;
        setCiStatus(st);
        if (st.assets?.some((a) => a.name === 'preview.png')) {
          setPass2ImageUrl(`/api/github/artifacts/preview.png?ts=${Date.now()}`);
        }
      }
      if (modelsRes.ok) {
        const data = (await modelsRes.json()) as { models?: AvailableModelItem[] };
        setGithubModels(
          (data.models || []).map((m) => ({
            ...m,
            category: 'Cloud_CI',
            description:
              m.source === 'github-release'
                ? 'Latest headless Blender 4.2 LTS GitHub Actions CI build.'
                : `Stored in GitHub repository models/${m.name}`,
          }))
        );
      }
    } catch {
      // Non-fatal offline tolerance
    }
  }, []);

  const refreshDriveModels = useCallback(async () => {
    try {
      const files = await listDrive3DModels();
      setDriveModels(
        files.map((f) => {
          const lower = f.name.toLowerCase();
          const fmt: AvailableModelItem['format'] = lower.endsWith('.glb')
            ? '.glb'
            : lower.endsWith('.gltf')
              ? '.gltf'
              : lower.endsWith('.obj')
                ? '.obj'
                : lower.endsWith('.stl')
                  ? '.stl'
                  : '.blend';
          return {
            id: `drive:${f.id}`,
            name: f.name,
            source: 'google-drive',
            format: fmt,
            category: 'Cloud_CI',
            sizeBytes: f.size ? Number(f.size) : undefined,
            driveFileId: f.id,
            htmlUrl: f.webViewLink,
            viewable: fmt !== '.blend',
            updatedAt: f.modifiedTime,
            description: 'Synced from your Google Drive (drive.file scope).',
          };
        })
      );
    } catch {
      setDriveModels([]);
    }
  }, []);

  useEffect(() => {
    void refreshGitHubAndModels();
    fetch('/api/workspace/starter')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { files?: Array<{ path: string; content: string; size: number }> } | null) => {
        if (!data?.files) return;
        const entries: WorkspaceFileEntry[] = data.files.map((f) => ({
          path: f.path,
          name: f.path.split('/').pop() || f.path,
          size: f.size,
          source: 'starter',
          content: f.content,
        }));
        setWorkspaceFiles(entries);
        const starterBuild = entries.find((e) => e.path === 'scripts/build.py');
        if (starterBuild?.content) setBuildPy(starterBuild.content);
      })
      .catch(() => undefined);

    const unsub = initDriveAuth(
      (user) => {
        setDriveUser(user);
        void refreshDriveModels();
      },
      () => {
        setDriveUser(null);
        setDriveModels([]);
      }
    );
    return () => unsub();
  }, [refreshGitHubAndModels, refreshDriveModels]);

  // Global keyboard shortcuts (Escape closes menus/modals, Alt+Ctrl+Q toggles Quad View, F12 Snapshot)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null);
        setSceneDropdownOpen(false);
        setAssetModalOpen(false);
        setExportModalOpen(false);
      } else if (e.altKey && e.ctrlKey && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        setIsQuadView((v) => !v);
      } else if (e.key === 'F12') {
        e.preventDefault();
        void handleQuickSnapshot();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Load any available model into ApexViewport
  const handleSelectModel = async (model: AvailableModelItem) => {
    if (!viewportRef.current) return;
    if (model.source === 'specimen' && model.specimenKind) {
      viewportRef.current.loadSpecimen(model.specimenKind);
      setActiveModelId(model.id);
      notify(`Loaded ${model.name} into viewport.`);
      return;
    }
    if (model.source === 'google-drive' && model.driveFileId) {
      const blobUrl = await downloadDriveModelAsBlobUrl(model.driveFileId);
      objectUrlsRef.current.push(blobUrl);
      await viewportRef.current.loadModelFromUrl(blobUrl, model.name, model.format);
      setActiveModelId(model.id);
      notify(`Loaded ${model.name} from Google Drive.`);
      return;
    }
    if (model.url) {
      await viewportRef.current.loadModelFromUrl(model.url, model.name, model.format);
      setActiveModelId(model.id);
      notify(`Loaded ${model.name} into viewport.`);
      return;
    }
    throw new Error('Selected model cannot be loaded directly into WebGL.');
  };

  const handleImportLocalFile = async (file: File) => {
    const check = validateModelUpload(file.name, file.size);
    if (!check.valid || !check.sanitizedName || !check.extension) {
      throw new Error(check.reason || 'Unsupported 3D model file.');
    }
    const blobUrl = URL.createObjectURL(file);
    objectUrlsRef.current.push(blobUrl);
    const localItem: AvailableModelItem = {
      id: `local:${Date.now()}:${check.sanitizedName}`,
      name: check.sanitizedName,
      source: 'local-file',
      format: check.extension as AvailableModelItem['format'],
      category: 'Mech_Frames',
      sizeBytes: file.size,
      url: blobUrl,
      viewable: check.extension !== '.blend',
      description: 'Imported directly from your local workstation.',
    };
    setLocalModels((prev) => [localItem, ...prev]);
    if (localItem.viewable && viewportRef.current) {
      await viewportRef.current.loadModelFromUrl(blobUrl, localItem.name, localItem.format);
      setActiveModelId(localItem.id);
      notify(`Imported & loaded ${localItem.name}`);
    }
  };

  const handleUploadToGitHub = async (file: File, sanitizedName: string) => {
    const base64 = await blobToBase64(file);
    const res = await fetch('/api/github/upload-model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: sanitizedName,
        contentBase64: base64,
        commitMessage: `Upload 3D model ${sanitizedName} from Apex 3D Studio`,
      }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(data.error || `GitHub upload failed (${res.status}).`);
    await refreshGitHubAndModels();
    notify(`Uploaded ${sanitizedName} to GitHub models/`);
  };

  const handleUploadToGoogleDrive = async (file: File, sanitizedName: string) => {
    await uploadModelToGoogleDrive(file, sanitizedName);
    await refreshDriveModels();
    notify(`Saved ${sanitizedName} to Google Drive.`);
  };

  // Native File System Access API (Link Local PC Folder)
  const scanDirectoryRecursive = async (
    dir: DirectoryHandleLike,
    prefix = ''
  ): Promise<WorkspaceFileEntry[]> => {
    const results: WorkspaceFileEntry[] = [];
    for await (const [name, handle] of dir.entries()) {
      if (name === '.git' || name === 'node_modules' || name === 'dist') continue;
      const relPath = prefix ? `${prefix}/${name}` : name;
      if (handle.kind === 'directory') {
        const nested = await scanDirectoryRecursive(handle, relPath);
        results.push(...nested);
      } else {
        try {
          const f = await handle.getFile();
          const lower = name.toLowerCase();
          if (
            lower.endsWith('.glb') ||
            lower.endsWith('.gltf') ||
            lower.endsWith('.obj') ||
            lower.endsWith('.stl')
          ) {
            const url = URL.createObjectURL(f);
            objectUrlsRef.current.push(url);
            const ext = lower.endsWith('.glb')
              ? '.glb'
              : lower.endsWith('.gltf')
                ? '.gltf'
                : lower.endsWith('.obj')
                  ? '.obj'
                  : '.stl';
            setLocalModels((prev) => {
              if (prev.some((p) => p.name === relPath)) return prev;
              return [
                ...prev,
                {
                  id: `local-dir:${relPath}`,
                  name: relPath,
                  source: 'local-file',
                  format: ext,
                  category: 'Mech_Frames',
                  sizeBytes: f.size,
                  url,
                  viewable: true,
                  description: `From linked PC folder: ${dir.name}`,
                },
              ];
            });
          } else if (f.size < 250_000) {
            const text = await f.text();
            results.push({ path: relPath, name, size: f.size, source: 'local', content: text });
          }
        } catch {
          // Skip unreadable files
        }
      }
      if (results.length >= 120) break;
    }
    return results;
  };

  const handleLinkLocalFolder = async () => {
    const picker = (window as unknown as {
      showDirectoryPicker?: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<DirectoryHandleLike>;
    }).showDirectoryPicker;
    if (!picker) {
      notify('File System Access API requires Chrome/Edge desktop over HTTPS/localhost.');
      return;
    }
    try {
      const handle = await picker({ mode: 'readwrite' });
      localDirHandleRef.current = handle;
      setLocalFolderName(handle.name);
      const scanned = await scanDirectoryRecursive(handle);
      if (scanned.length > 0) {
        setWorkspaceFiles(scanned);
        const buildEntry = scanned.find((e) => e.path === 'scripts/build.py');
        if (buildEntry?.content) setBuildPy(buildEntry.content);
      }
      notify(`Linked local folder: ${handle.name} (${scanned.length} workspace files).`);
    } catch {
      // User cancelled picker
    }
  };

  const writeLocalWorkspaceFile = async (relPath: string, content: string): Promise<boolean> => {
    const safeRel = normalizeWorkspacePath(relPath);
    const dir = localDirHandleRef.current;
    if (dir) {
      const parts = safeRel.split('/');
      const fileName = parts.pop()!;
      let curDir = dir;
      for (const seg of parts) {
        curDir = await curDir.getDirectoryHandle(seg, { create: true });
      }
      const fh = await curDir.getFileHandle(fileName, { create: true });
      const writable = await fh.createWritable();
      await writable.write(content);
      await writable.close();
    }
    setWorkspaceFiles((prev) => {
      const idx = prev.findIndex((f) => f.path === safeRel);
      const entry: WorkspaceFileEntry = {
        path: safeRel,
        name: safeRel.split('/').pop() || safeRel,
        size: content.length,
        source: dir ? 'local' : 'starter',
        content,
      };
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = entry;
        return next;
      }
      return [entry, ...prev];
    });
    if (safeRel === 'scripts/build.py') {
      setBuildPy(content);
    }
    return Boolean(dir);
  };

  // Run Blender 4.2 Build (Cloud GitHub CI Primary OR Local Blender Backup)
  const executeBlenderBuild = async (
    script: string,
    commitNote: string,
    onProgress?: (detail: string, stage: NonNullable<ChatMessageItem['buildProgress']>['stage'], runUrl?: string) => void
  ): Promise<{ ok: boolean; summary: string; previewUrl?: string }> => {
    setBuildPy(script);
    setBuildBusy(true);
    try {
      if (mode === 'local') {
        const check = validateLocalBlenderEndpoint(localEndpoint);
        if (!check.valid || !check.normalized) {
          throw new Error(check.reason || 'Invalid local loopback endpoint.');
        }
        onProgress?.(`Sending bpy script to local worker ${check.normalized}...`, 'in_progress');
        try {
          const res = await fetch(check.normalized, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bpy_script: script, commit_note: commitNote }),
          });
          if (!res.ok) throw new Error(`Local Blender worker returned HTTP ${res.status}`);
          setLocalOfflineBanner(null);
          onProgress?.('Local Blender build completed.', 'completed');
          return { ok: true, summary: 'Local Blender Backup build completed successfully.' };
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Connection refused';
          setLocalOfflineBanner(msg);
          onProgress?.(`Local Backup Offline: ${msg}`, 'failed');
          return { ok: false, summary: `Local Backup Offline (${check.normalized}): ${msg}` };
        }
      }

      // Cloud Primary Mode -> GitHub REST API commit + Actions poll
      onProgress?.('Committing scripts/build.py to GitHub repository...', 'committing');
      const commitRes = await fetch('/api/cloud/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bpy_script: script, commit_note: commitNote }),
      });
      const commitData = (await commitRes.json()) as {
        error?: string;
        commitSha?: string;
        pagesUrl?: string;
      };
      if (!commitRes.ok) {
        throw new Error(commitData.error || `GitHub commit failed (${commitRes.status}).`);
      }

      const sha = commitData.commitSha || '';
      onProgress?.(`Committed ${sha.slice(0, 7)}. Waiting for headless Blender 4.2 CI...`, 'queued');

      let runUrl: string | undefined;
      for (let attempt = 0; attempt < 18; attempt++) {
        await new Promise((r) => setTimeout(r, 4000));
        const pollRes = await fetch(`/api/cloud/poll?commitSha=${encodeURIComponent(sha)}`);
        if (!pollRes.ok) continue;
        const pollData = (await pollRes.json()) as {
          found?: boolean;
          status?: string;
          conclusion?: string | null;
          htmlUrl?: string;
        };
        if (pollData.htmlUrl) runUrl = pollData.htmlUrl;
        if (pollData.status === 'completed') {
          if (pollData.conclusion === 'success') {
            onProgress?.('Headless Blender 4.2 CI succeeded! Fetching preview.png & model.glb...', 'fetching_preview', runUrl);
            await refreshGitHubAndModels();
            const previewUrl = `/api/github/artifacts/preview.png?ts=${Date.now()}`;
            setPass1ImageUrl(pass2ImageUrl);
            setPass2ImageUrl(previewUrl);
            if (viewportRef.current) {
              try {
                await viewportRef.current.loadModelFromUrl(`/api/github/artifacts/model.glb?ts=${Date.now()}`, 'Latest CI Build (model.glb)', '.glb');
                setActiveModelId('gh-release:model.glb');
              } catch {
                // Keep current viewport if GLB still propagating
              }
            }
            onProgress?.('Cloud GitHub CI build complete & loaded.', 'completed', runUrl);
            return {
              ok: true,
              summary: `Cloud CI succeeded (${sha.slice(0, 7)}). Latest model.glb, model.blend, and Cycles preview.png published.`,
              previewUrl,
            };
          }
          onProgress?.(`CI run ended with conclusion: ${pollData.conclusion || 'failed'}.`, 'failed', runUrl);
          return { ok: false, summary: `GitHub Actions run failed (${pollData.conclusion || 'error'}).` };
        }
        onProgress?.(`Blender 4.2 CI status: ${pollData.status || 'queued'}...`, 'in_progress', runUrl);
      }

      onProgress?.('CI run still active on GitHub Actions. Check status pill to sync.', 'in_progress', runUrl);
      return {
        ok: true,
        summary: `Committed ${sha.slice(0, 7)} to GitHub Actions CI. Build is running in the cloud.`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Build execution failed.';
      onProgress?.(msg, 'failed');
      return { ok: false, summary: msg };
    } finally {
      setBuildBusy(false);
    }
  };

  // Autonomous Gemini Vision Critique (Cycles preview.png)
  const handleRunVisionCritique = async (overrideImageUrl?: string) => {
    setVisionBusy(true);
    try {
      const targetUrl = overrideImageUrl || pass2ImageUrl;
      const imgRes = await fetch(targetUrl);
      if (!imgRes.ok) throw new Error('Unable to load Cycles preview image for Vision QA.');
      const blob = await imgRes.blob();
      const imageBase64 = await blobToBase64(blob);

      const res = await fetch('/api/vision/critique', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mimeType: blob.type || 'image/png',
          bpyScript: buildPy,
          userGoal: 'Inspect bevel sharpness, grounding, silhouette proportions, and Principled BSDF materials.',
          passNumber: 1,
          systemSkill,
        }),
      });
      const data = (await res.json()) as VisionCritiqueResult & { error?: string };
      if (!res.ok) throw new Error(data.error || `Vision critique failed (${res.status}).`);
      setLatestVisionCritique(data);
      notify(`Vision QA found ${data.defects.length} inspection notes.`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Vision QA failed.');
    } finally {
      setVisionBusy(false);
    }
  };

  // Gemini Function Calling Chat Loop
  const handleSendMessage = async (prompt: string) => {
    const userMsg: ChatMessageItem = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: prompt,
      timestamp: nowTimeLabel(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setChatBusy(true);

    const nextTurns: GeminiContentTurn[] = [...geminiHistory, { role: 'user', parts: [{ text: prompt }] }];

    try {
      let currentTurns = nextTurns;
      for (let hop = 0; hop < 3; hop++) {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: currentTurns,
            systemSkill,
            mode,
            localFiles: workspaceFiles.map((f) => f.path),
            currentBuildPy: buildPy,
          }),
        });
        const data = (await res.json()) as {
          error?: string;
          text?: string;
          functionCalls?: Array<{ id?: string; name: string; args?: Record<string, unknown> }>;
          modelContent?: GeminiContentTurn | null;
        };
        if (!res.ok) throw new Error(data.error || `Gemini API failed (${res.status}).`);

        if (data.modelContent) {
          currentTurns = [...currentTurns, data.modelContent];
        }

        const calls = data.functionCalls || [];
        if (calls.length === 0) {
          setMessages((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}-${hop}`,
              role: 'assistant',
              text: data.text || 'Completed request.',
              timestamp: nowTimeLabel(),
            },
          ]);
          setGeminiHistory(currentTurns);
          break;
        }

        const traces: ToolTrace[] = [];
        const fnResponses: GeminiContentTurn['parts'] = [];
        let createdProposalId: string | undefined;

        for (const fc of calls) {
          const args = fc.args || {};
          if (fc.name === 'list_local_files') {
            const subdir = typeof args.subdir === 'string' ? args.subdir.trim() : '';
            const list = workspaceFiles
              .map((f) => f.path)
              .filter((p) => (!subdir ? true : p.startsWith(subdir)));
            traces.push({
              id: `tr-${Date.now()}-${Math.random()}`,
              name: fc.name,
              argsPreview: subdir || '*',
              status: 'completed',
              summary: `Listed ${list.length} workspace files.`,
            });
            fnResponses.push({
              functionResponse: { id: fc.id, name: fc.name, response: { files: list } },
            });
          } else if (fc.name === 'read_local_file') {
            const rawPath = typeof args.path === 'string' ? args.path : '';
            try {
              const safe = normalizeWorkspacePath(rawPath);
              const found = workspaceFiles.find((f) => f.path === safe);
              const content = found?.content ?? '';
              traces.push({
                id: `tr-${Date.now()}-${Math.random()}`,
                name: fc.name,
                argsPreview: safe,
                status: found ? 'completed' : 'error',
                summary: found ? `Read ${safe} (${content.length} chars).` : `File not found: ${safe}`,
              });
              fnResponses.push({
                functionResponse: {
                  id: fc.id,
                  name: fc.name,
                  response: found ? { path: safe, content } : { error: `File ${safe} not found.` },
                },
              });
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : 'Invalid path';
              fnResponses.push({
                functionResponse: { id: fc.id, name: fc.name, response: { error: errMsg } },
              });
            }
          } else if (fc.name === 'write_local_file') {
            const rawPath = typeof args.path === 'string' ? args.path : 'scripts/build.py';
            const afterContent = typeof args.content === 'string' ? args.content : '';
            const safe = normalizeWorkspacePath(rawPath);
            const beforeContent = workspaceFiles.find((f) => f.path === safe)?.content || '';
            const pid = `diff-${Date.now()}`;
            createdProposalId = pid;
            setDiffProposals((prev) => ({
              ...prev,
              [pid]: {
                id: pid,
                path: safe,
                beforeContent,
                afterContent,
                status: 'pending',
                createdAt: nowTimeLabel(),
              },
            }));
            traces.push({
              id: `tr-${Date.now()}-${Math.random()}`,
              name: fc.name,
              argsPreview: safe,
              status: 'awaiting_approval',
              summary: `Prepared diff proposal for ${safe}. Waiting for explicit user approval.`,
            });
            fnResponses.push({
              functionResponse: {
                id: fc.id,
                name: fc.name,
                response: { status: 'awaiting_user_diff_approval', path: safe },
              },
            });
          } else if (fc.name === 'build_blend_cloud') {
            const script = typeof args.bpy_script === 'string' ? args.bpy_script : buildPy;
            const note = typeof args.commit_note === 'string' ? args.commit_note : 'Build via Apex 3D Agent';
            const msgId = `build-${Date.now()}`;
            setMessages((prev) => [
              ...prev,
              {
                id: msgId,
                role: 'assistant',
                text: `Executing Blender 4.2 build: ${note}`,
                timestamp: nowTimeLabel(),
                buildProgress: { mode, stage: 'committing', detail: 'Preparing build...' },
              },
            ]);
            const result = await executeBlenderBuild(script, note, (detail, stage, runUrl) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === msgId ? { ...m, buildProgress: { mode, stage, detail, runUrl } } : m
                )
              );
            });
            if (result.ok && result.previewUrl) {
              void handleRunVisionCritique(result.previewUrl);
            }
            traces.push({
              id: `tr-${Date.now()}-${Math.random()}`,
              name: fc.name,
              argsPreview: note,
              status: result.ok ? 'completed' : 'error',
              summary: result.summary,
            });
            fnResponses.push({
              functionResponse: {
                id: fc.id,
                name: fc.name,
                response: { ok: result.ok, summary: result.summary },
              },
            });
          }
        }

        if (traces.length > 0) {
          setMessages((prev) => [
            ...prev,
            {
              id: `tool-${Date.now()}-${hop}`,
              role: 'assistant',
              text: data.text || 'Executed studio tool actions:',
              timestamp: nowTimeLabel(),
              toolTraces: traces,
              diffProposalId: createdProposalId,
            },
          ]);
        }

        currentTurns = [...currentTurns, { role: 'user', parts: fnResponses }];
        setGeminiHistory(currentTurns);
        if (createdProposalId) break;
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text: 'Could not complete Gemini request.',
          error: err instanceof Error ? err.message : 'Unknown error',
          timestamp: nowTimeLabel(),
        },
      ]);
    } finally {
      setChatBusy(false);
    }
  };

  const handleApproveDiff = async (id: string) => {
    const proposal = diffProposals[id];
    if (!proposal) return;
    try {
      const wroteDisk = await writeLocalWorkspaceFile(proposal.path, proposal.afterContent);
      setDiffProposals((prev) => ({
        ...prev,
        [id]: { ...proposal, status: 'approved' },
      }));
      notify(
        wroteDisk
          ? `Approved & wrote ${proposal.path} to linked local folder.`
          : `Approved & updated ${proposal.path} in studio workspace.`
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to write file.');
    }
  };

  const handleRejectDiff = (id: string) => {
    setDiffProposals((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      return { ...prev, [id]: { ...cur, status: 'rejected' } };
    });
    notify('Diff proposal rejected.');
  };

  // Workspace Preset Tabs Switcher
  const handleWorkspaceTab = (tab: WorkspaceTabId) => {
    setActiveWorkspaceTab(tab);
    if (tab === 'inspection') {
      setShadingPass('combined');
      setInspectorTab('outliner');
      setHdriPreset('studio-4k');
      setWireOpacity(35);
    } else if (tab === 'uv-topology') {
      setShadingPass('uv');
      setInspectorTab('diagnostics');
      setWireOpacity(80);
    } else if (tab === 'lookdev') {
      setShadingPass('combined');
      setInspectorTab('material');
      setHdriPreset('high-contrast');
      setWireOpacity(0);
    } else if (tab === 'baking') {
      setShadingPass('normal');
      setDrawerTab('vision');
      setDrawerOpen(true);
    }
  };

  // Quick PNG Snapshot (F12 or Left Toolbar Camera)
  const handleQuickSnapshot = async () => {
    if (!viewportRef.current) return;
    try {
      const blob = await viewportRef.current.captureSnapshotPng();
      const filename = formatExportFilename(sceneTelemetry.modelName || 'Apex_Viewport', '.png');
      triggerBlobDownload(blob, filename);
      notify(`Saved high-res render snapshot: ${filename}`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Snapshot capture failed.');
    }
  };

  // Left Mini Toolbar Tool Selection
  const handleLeftTool = (tool: LeftToolMode) => {
    setActiveTool(tool);
    if (tool === 'orbit') {
      setDragMode('orbit');
    } else if (tool === 'slice') {
      setSectionCut((prev) => ({ ...prev, enabled: !prev.enabled }));
      setInspectorTab('material');
      setRightPanelOpen(true);
    } else if (tool === 'light') {
      setLightAngle((prev) => (prev + 45) % 360);
    }
  };

  const activePassTitle = SHADING_PASSES.find((p) => p.id === shadingPass)?.title || shadingPass.toUpperCase();
  const shortSha = ciStatus?.latestRun?.headSha ? ciStatus.latestRun.headSha.slice(0, 7) : 'ready';

  return (
    <div
      className="bg-[#f8f9fa] text-[#111318] antialiased flex flex-col h-screen w-screen overflow-hidden"
      onClick={() => {
        if (openMenu) setOpenMenu(null);
        if (sceneDropdownOpen) setSceneDropdownOpen(false);
      }}
    >
      {/* THREE.JS MONOCHROME ENTERING ANIMATION */}
      {showEntrance && <EntranceAnimation onComplete={() => setShowEntrance(false)} />}

      {/* TOP SYSTEM HEADER & WORKSPACE TABS */}
      <header className="h-11 w-full bg-white border-b border-[#dcdfe4] flex items-center justify-between px-2 shrink-0 z-40 select-none">
        {/* Brand, Interactive Main Menus & Workspace Tabs */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setShowEntrance(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#111318] text-white font-bold text-xs shadow-sm cursor-pointer shrink-0"
            title="Replay Apex 3D Entrance Animation"
          >
            <span className="material-symbols-outlined text-[16px]">deployed_code</span>
            <span className="tracking-wide uppercase text-[10px]">APEX 3D</span>
          </button>

          <div className="h-4 w-px bg-[#dcdfe4] mx-0.5 hidden sm:block" />

          {/* Functional Menu Bar */}
          <div
            className="hidden sm:flex items-center text-xs text-[#64748b] relative"
            onClick={(e) => e.stopPropagation()}
          >
            {(['file', 'edit', 'asset', 'render', 'view', 'help'] as const).map((m) => (
              <div key={m} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenMenu(openMenu === m ? null : m)}
                  className={`px-2 py-1 rounded capitalize transition-colors cursor-pointer ${
                    openMenu === m
                      ? 'bg-[#111318] text-white'
                      : 'hover:bg-[#f0f2f5] hover:text-black'
                  }`}
                >
                  {m}
                </button>
                {openMenu === m && (
                  <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-[#cbd5e1] rounded-lg shadow-xl py-1 z-50 text-xs text-[#111318]">
                    {m === 'file' && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            setAssetModalOpen(true);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-[#f0f2f5] flex justify-between cursor-pointer"
                        >
                          <span>Open Model Assets</span>
                          <span className="font-mono text-[10px] text-[#64748b]">Repo</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            void handleLinkLocalFolder();
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-[#f0f2f5] cursor-pointer"
                        >
                          Link Local PC Folder...
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            setExportModalOpen(true);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-[#f0f2f5] flex justify-between cursor-pointer"
                        >
                          <span>Export 3D Model (.glb/.obj/.stl/.blend)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            setDrawerTab('script');
                            setDrawerOpen(true);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-[#f0f2f5] cursor-pointer"
                        >
                          Open scripts/build.py Studio
                        </button>
                        <div className="my-1 border-t border-[#e5e8ec]" />
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            viewportRef.current?.clearToPointCloud();
                            setActiveModelId(null);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-[#f0f2f5] text-[#64748b] cursor-pointer"
                        >
                          Clear Stage to Point Cloud
                        </button>
                      </>
                    )}
                    {m === 'edit' && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            notify(viewportRef.current?.recalculateNormalsOutside() || '');
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-[#f0f2f5] cursor-pointer"
                        >
                          Recalculate Normals Outside
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            notify(viewportRef.current?.purgeDegenerateGeometry() || '');
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-[#f0f2f5] cursor-pointer"
                        >
                          Purge Degenerate Dissolves
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            viewportRef.current?.resetPose();
                            notify('Reset armature bone pose.');
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-[#f0f2f5] cursor-pointer"
                        >
                          Reset Armature Pose
                        </button>
                        <div className="my-1 border-t border-[#e5e8ec]" />
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            if (mode === 'cloud') setTwoFactorOpen(true);
                            else {
                              setMode('cloud');
                              notify('Switched back to Cloud GitHub CI [Primary].');
                            }
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-[#f0f2f5] cursor-pointer"
                        >
                          {mode === 'cloud'
                            ? 'Switch to Local Blender (2FA)...'
                            : 'Switch to Cloud GitHub CI [Primary]'}
                        </button>
                      </>
                    )}
                    {m === 'asset' && (
                      <>
                        {STUDIO_SPECIMENS.map((spec) => (
                          <button
                            key={spec.id}
                            type="button"
                            onClick={() => {
                              setOpenMenu(null);
                              void handleSelectModel(spec);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-[#f0f2f5] cursor-pointer"
                          >
                            Load {spec.name}
                          </button>
                        ))}
                        <div className="my-1 border-t border-[#e5e8ec]" />
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            void refreshGitHubAndModels();
                            notify('Synced GitHub & Release models.');
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-[#f0f2f5] cursor-pointer"
                        >
                          Sync Remote Repositories
                        </button>
                      </>
                    )}
                    {m === 'render' && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            void handleQuickSnapshot();
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-[#f0f2f5] flex justify-between cursor-pointer"
                        >
                          <span>Viewport Snapshot (.png)</span>
                          <span className="font-mono text-[10px] text-[#64748b]">F12</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            setDrawerTab('vision');
                            setDrawerOpen(true);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-[#f0f2f5] cursor-pointer"
                        >
                          Cycles Vision QA (Pass 1 vs 2)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            setDrawerTab('agent');
                            setDrawerOpen(true);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-[#f0f2f5] cursor-pointer"
                        >
                          AI Builder &amp; Cloud CI
                        </button>
                      </>
                    )}
                    {m === 'view' && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            setIsQuadView((v) => !v);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-[#f0f2f5] flex justify-between cursor-pointer"
                        >
                          <span>Toggle 4-View Quad Split</span>
                          <span className="font-mono text-[10px] text-[#64748b]">Alt+Ctrl+Q</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            viewportRef.current?.toggleOrtho();
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-[#f0f2f5] flex justify-between cursor-pointer"
                        >
                          <span>Perspective / Ortho</span>
                          <span className="font-mono text-[10px] text-[#64748b]">Num 5</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            viewportRef.current?.applyCameraPreset('front');
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-[#f0f2f5] flex justify-between cursor-pointer"
                        >
                          <span>Front View</span>
                          <span className="font-mono text-[10px] text-[#64748b]">Num 1</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            viewportRef.current?.applyCameraPreset('right');
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-[#f0f2f5] flex justify-between cursor-pointer"
                        >
                          <span>Right View</span>
                          <span className="font-mono text-[10px] text-[#64748b]">Num 3</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            viewportRef.current?.applyCameraPreset('top');
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-[#f0f2f5] flex justify-between cursor-pointer"
                        >
                          <span>Top View</span>
                          <span className="font-mono text-[10px] text-[#64748b]">Num 7</span>
                        </button>
                      </>
                    )}
                    {m === 'help' && (
                      <>
                        <div className="px-3 py-2 text-[11px] text-[#475569] space-y-1 font-mono">
                          <div className="font-bold text-[#111318]">Blender Camera Hotkeys</div>
                          <div>Num 1/3/7 · Front/Right/Top</div>
                          <div>Num 5 · Ortho / Perspective</div>
                          <div>Num 2/4/6/8 · 15° Orbit Step</div>
                          <div>WASD + Q/E · Fly Navigation</div>
                        </div>
                        <div className="my-1 border-t border-[#e5e8ec]" />
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            setDrawerTab('workspace');
                            setDrawerOpen(true);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-[#f0f2f5] cursor-pointer"
                        >
                          Blender 4.2 System Skill
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Workspace Tabs */}
          <div className="hidden md:flex items-center gap-0.5 ml-1 bg-[#f0f2f5] p-0.5 rounded-md border border-[#dcdfe4]">
            {(
              [
                { id: 'inspection', label: 'Inspection' },
                { id: 'uv-topology', label: 'UV & Topology' },
                { id: 'lookdev', label: 'LookDev & Lighting' },
                { id: 'baking', label: 'Baking' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleWorkspaceTab(tab.id)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                  activeWorkspaceTab === tab.id
                    ? 'bg-[#111318] text-white shadow-sm'
                    : 'text-[#64748b] hover:text-black hover:bg-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setDrawerTab('agent');
                setDrawerOpen(true);
              }}
              className="px-1.5 py-0.5 text-[#64748b] hover:text-black cursor-pointer"
              title="Open AI Builder, Script Studio & Cycles Vision QA"
              aria-label="Open Studio Pipeline Drawer"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
            </button>
          </div>
        </div>

        {/* Header Right Control Cluster */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Live GitHub CI Status Pill */}
          <div className="hidden xl:flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#f0f2f5] border border-[#dcdfe4] text-xs font-mono mr-0.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                ciStatus?.state === 'failed' || ciStatus?.state === 'error'
                  ? 'bg-red-500'
                  : ciStatus?.state === 'building'
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-emerald-500 animate-pulse'
              }`}
            />
            <span className="text-[#64748b] font-medium">GitHub:</span>
            <span className="text-black font-semibold">
              {serverConfig?.githubBranch || 'main'}@{shortSha}
            </span>
            <span className="text-[#dcdfe4]">/</span>
            <span className="text-black truncate max-w-[100px]">
              {selectedNodeName}
            </span>
            <button
              type="button"
              onClick={() => {
                void refreshGitHubAndModels();
                notify('Pulled latest GitHub Actions status & models.');
              }}
              className="ml-0.5 text-[#64748b] hover:text-black transition-colors cursor-pointer"
              title="Pull Latest GitHub Changes"
              aria-label="Sync GitHub Repository"
            >
              <span className="material-symbols-outlined text-[13px]">sync</span>
            </button>
          </div>

          {/* Model Assets Button */}
          <button
            type="button"
            onClick={() => setAssetModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-black text-white hover:bg-[#334155] border border-black shadow-sm transition-all cursor-pointer"
            id="btn-open-asset-browser"
            title="Open 3D Model Asset Picker & Repository"
          >
            <span className="material-symbols-outlined text-[15px]">folder_data</span>
            <span className="font-medium">Model Assets</span>
            <span className="px-1 py-0.2 rounded bg-white/20 text-[10px] font-mono font-bold">
              {allAvailableModels.length}
            </span>
          </button>

          {/* Scene Context Quick Selector */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setSceneDropdownOpen((v) => !v)}
              className="flex items-center bg-[#f0f2f5] hover:bg-white px-2 py-1 rounded-md border border-[#dcdfe4] gap-1.5 text-xs transition-colors cursor-pointer"
              title="Quick Switch Scene Asset"
            >
              <span className="material-symbols-outlined text-[14px] text-black">deployed_code_history</span>
              <span className="text-black font-semibold text-[11px] max-w-[125px] truncate">
                {sceneTelemetry.modelName || 'Point_Cloud_Stage'}
              </span>
              <span className="material-symbols-outlined text-[12px] text-[#64748b]">expand_more</span>
            </button>
            {sceneDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-[#cbd5e1] rounded-lg shadow-xl py-1 z-50 text-xs">
                <div className="px-3 py-1 text-[10px] font-mono uppercase text-[#64748b] border-b border-[#e5e8ec]">
                  Quick Load Model
                </div>
                {allAvailableModels.slice(0, 7).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSceneDropdownOpen(false);
                      void handleSelectModel(m);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#f0f2f5] flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="truncate font-medium text-[#111318]">{m.name}</span>
                    <span className="font-mono text-[9px] text-[#64748b] uppercase">{m.format}</span>
                  </button>
                ))}
                <div className="border-t border-[#e5e8ec] mt-1 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSceneDropdownOpen(false);
                      viewportRef.current?.clearToPointCloud();
                      setActiveModelId(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#f0f2f5] text-[#64748b] cursor-pointer"
                  >
                    Return to Point Cloud Stage
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quad / Single View Toggle */}
          <button
            type="button"
            onClick={() => setIsQuadView((v) => !v)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs border transition-all cursor-pointer ${
              isQuadView
                ? 'bg-[#111318] text-white border-[#111318]'
                : 'bg-[#f0f2f5] border-[#dcdfe4] hover:bg-white hover:border-black text-[#64748b] hover:text-black'
            }`}
            id="toggle-quadview"
            title="Toggle Quad-View Split (Alt+Ctrl+Q)"
          >
            <span className="material-symbols-outlined text-[14px]">grid_view</span>
            <span className="hidden lg:inline text-[11px]">{isQuadView ? '4-View' : 'Single'}</span>
          </button>

          {/* Turntable Auto-Spin Switch */}
          <button
            type="button"
            onClick={() => setIsAutoSpin((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-all cursor-pointer ${
              isAutoSpin
                ? 'bg-white text-black border-black font-semibold'
                : 'bg-[#f0f2f5] border-[#dcdfe4] hover:bg-white hover:border-black text-[#64748b] hover:text-black'
            }`}
            id="btn-autospin"
            title="Toggle Turntable 360° Auto-Spin"
          >
            <span className="material-symbols-outlined text-[14px]">autorenew</span>
            <span className="hidden sm:inline text-[11px]">{isAutoSpin ? 'Spinning' : 'Turntable'}</span>
          </button>

          {/* Multi-Format Export Button */}
          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-[#111318] text-white shadow-sm hover:bg-black transition-all cursor-pointer"
            id="btn-open-export"
          >
            <span className="material-symbols-outlined text-[14px]">ios_share</span>
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </header>

      {/* SECONDARY SUB-BAR / TRANSPORT, PIPELINE MODE & SHADING PASS STRIP */}
      <div className="h-9 w-full bg-[#f8f9fa] border-b border-[#dcdfe4] px-2.5 flex items-center justify-between shrink-0 z-30 select-none gap-2">
        {/* Left: Gizmo Navigation Modes & Cloud/Local 2FA Pipeline Toggle */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-white rounded p-0.5 border border-[#dcdfe4]">
            <button
              type="button"
              onClick={() => {
                setDrawerTab('agent');
                setDrawerOpen(true);
              }}
              className="px-2 py-0.5 rounded text-[11px] font-semibold text-white bg-[#111318] hover:bg-black flex items-center gap-1 cursor-pointer"
              title="Open AI Builder, Script Studio & Cycles Vision QA"
            >
              <span className="material-symbols-outlined text-[13px]">center_focus_strong</span>
              <span className="hidden lg:inline">Studio AI</span>
            </button>
            <div className="h-3 w-px bg-[#dcdfe4] mx-1" />
            {(
              [
                { id: 'orbit', icon: '3d_rotation', label: 'Orbit' },
                { id: 'pan', icon: 'pan_tool', label: 'Pan' },
                { id: 'zoom', icon: 'zoom_in', label: 'Zoom' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setDragMode(m.id);
                  if (m.id === 'orbit') setActiveTool('orbit');
                }}
                className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 cursor-pointer transition-colors ${
                  dragMode === m.id
                    ? 'text-black bg-[#f0f2f5] font-semibold'
                    : 'text-[#64748b] hover:text-black hover:bg-[#f0f2f5]'
                }`}
              >
                <span className="material-symbols-outlined text-[13px]">{m.icon}</span>
                <span className="hidden md:inline">{m.label}</span>
              </button>
            ))}
          </div>

          {/* Pipeline Mode Switch with 2FA Gate */}
          <div className="hidden xl:flex items-center bg-white rounded p-0.5 border border-[#dcdfe4] text-[10px] font-mono">
            <button
              type="button"
              onClick={() => {
                if (mode !== 'cloud') {
                  setMode('cloud');
                  notify('Switched to Cloud GitHub CI [Primary].');
                }
              }}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                mode === 'cloud' ? 'bg-[#111318] text-white font-semibold' : 'text-[#64748b] hover:text-black'
              }`}
            >
              Cloud CI
            </button>
            <button
              type="button"
              onClick={() => {
                if (mode === 'cloud') setTwoFactorOpen(true);
              }}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                mode === 'local' ? 'bg-[#111318] text-white font-semibold' : 'text-[#64748b] hover:text-black'
              }`}
              title="Switch to Local Blender Backup (Requires 2-Factor Verification)"
            >
              Local 2FA
            </button>
          </div>
        </div>

        {/* Center: Shading & Render Pass Selector Cluster */}
        <div className="flex items-center gap-1 bg-white p-0.5 rounded-md border border-[#dcdfe4] overflow-x-auto">
          <span className="text-[10px] font-mono text-[#64748b] px-1 uppercase tracking-wider hidden sm:inline">
            Pass:
          </span>
          {SHADING_PASSES.map((pass) => (
            <button
              key={pass.id}
              type="button"
              onClick={() => setShadingPass(pass.id)}
              title={pass.title}
              className={`px-2 py-0.5 rounded text-[10px] transition-all whitespace-nowrap cursor-pointer ${
                shadingPass === pass.id
                  ? 'font-semibold bg-[#111318] text-white shadow-sm'
                  : 'font-medium text-[#64748b] hover:text-black hover:bg-[#f0f2f5]'
              }`}
            >
              {pass.label}
            </button>
          ))}
        </div>

        {/* Right: Live FPS, Overlays & Collapse Right Inspector */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-[#dcdfe4] font-mono text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
            <span className="text-black font-bold">{liveFps.toFixed(1)}</span>
            <span className="text-[#64748b]">FPS</span>
          </div>
          <button
            type="button"
            onClick={() => setShowGridOverlays((v) => !v)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border cursor-pointer transition-colors ${
              showGridOverlays
                ? 'bg-white text-black border-[#111318]'
                : 'bg-[#f0f2f5] text-[#64748b] border-[#dcdfe4] hover:text-black'
            }`}
            id="btn-toggle-overlays"
          >
            <span className="material-symbols-outlined text-[13px]">grid_4x4</span>
            <span className="hidden md:inline">Overlays</span>
          </button>
          <button
            type="button"
            onClick={() => setRightPanelOpen((v) => !v)}
            className="w-6 h-6 rounded flex items-center justify-center text-[#64748b] hover:text-black hover:bg-[#e5e8ec] cursor-pointer"
            title="Toggle Right Inspector Panel"
            aria-label="Toggle Right Inspector Panel"
          >
            <span className="material-symbols-outlined text-[16px]">
              {rightPanelOpen ? 'dock_to_left' : 'dock_to_right'}
            </span>
          </button>
        </div>
      </div>

      {/* MAIN WORKSPACE: LEFT MINI TOOLBAR + CENTRAL 3D VIEWPORT + RIGHT INSPECTOR */}
      <div className="flex-1 w-full flex overflow-hidden relative">
        {/* LEFT MINI TOOLBAR */}
        <aside className="w-10 bg-white border-r border-[#dcdfe4] flex flex-col items-center py-2 gap-1.5 shrink-0 z-20">
          <button
            type="button"
            onClick={() => setAssetModalOpen(true)}
            className="w-7 h-7 rounded-md bg-[#f0f2f5] hover:bg-[#111318] text-black hover:text-white border border-[#dcdfe4] hover:border-black flex items-center justify-center transition-all shadow-sm cursor-pointer"
            title="3D Model Asset Picker & Repo Browser"
            aria-label="Open Asset Browser"
          >
            <span className="material-symbols-outlined text-[16px]">folder_special</span>
          </button>
          <div className="w-5 h-px bg-[#dcdfe4] my-0.5" />

          {(
            [
              { id: 'orbit', icon: 'orbit', title: 'Orbit Inspection (1)' },
              { id: 'select', icon: 'touch_app', title: 'Select Component (V)' },
              { id: 'measure', icon: 'straighten', title: '3D Measurement Tape (M)' },
              { id: 'explode', icon: 'splitscreen', title: 'Exploded View (E)' },
              { id: 'light', icon: 'lightbulb', title: 'Rotate Key Light Rig +45° (L)' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleLeftTool(t.id)}
              title={t.title}
              aria-label={t.title}
              className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                activeTool === t.id
                  ? 'bg-[#111318] text-white shadow-sm'
                  : 'text-[#64748b] hover:text-black hover:bg-[#f0f2f5]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
            </button>
          ))}

          <div className="w-5 h-px bg-[#dcdfe4] my-1" />

          <button
            type="button"
            onClick={() => handleLeftTool('slice')}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
              sectionCut.enabled
                ? 'bg-[#111318] text-white shadow-sm'
                : 'text-[#64748b] hover:text-black hover:bg-[#f0f2f5]'
            }`}
            title="Slice Plane / Cross Section (C)"
            aria-label="Toggle Section Cut Plane"
          >
            <span className="material-symbols-outlined text-[16px]">cut</span>
          </button>
          <button
            type="button"
            onClick={() => void handleQuickSnapshot()}
            className="w-7 h-7 rounded-md text-[#64748b] hover:text-black hover:bg-[#f0f2f5] flex items-center justify-center transition-colors cursor-pointer"
            title="Snapshot High-Res Render (F12)"
            aria-label="Capture Viewport Snapshot"
          >
            <span className="material-symbols-outlined text-[16px]">camera</span>
          </button>
          <button
            type="button"
            onClick={() => viewportRef.current?.applyCameraPreset('hero')}
            className="w-7 h-7 rounded-md text-[#64748b] hover:text-black hover:bg-[#f0f2f5] flex items-center justify-center transition-colors cursor-pointer"
            title="Reset Camera View (Home)"
            aria-label="Reset Camera View"
          >
            <span className="material-symbols-outlined text-[16px]">center_focus_weak</span>
          </button>

          <div className="mt-auto flex flex-col gap-1.5 items-center">
            <button
              type="button"
              onClick={() => {
                setDrawerTab('script');
                setDrawerOpen(true);
              }}
              className="w-7 h-7 rounded-md text-[#64748b] hover:text-black hover:bg-[#f0f2f5] flex items-center justify-center cursor-pointer"
              title="Python build.py Script Studio"
              aria-label="Open Python Script Studio"
            >
              <span className="material-symbols-outlined text-[16px]">code</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setDrawerTab('workspace');
                setDrawerOpen(true);
              }}
              className="w-7 h-7 rounded-md text-[#64748b] hover:text-black hover:bg-[#f0f2f5] flex items-center justify-center cursor-pointer"
              title="Local Workspace & Blender 4.2 Skill Settings"
              aria-label="Open Studio Settings"
            >
              <span className="material-symbols-outlined text-[16px]">settings</span>
            </button>
          </div>
        </aside>

        {/* CENTRAL 3D WEBGL VIEWPORT */}
        <ApexViewport
          ref={viewportRef}
          shadingPass={shadingPass}
          insideOutSide={insideOutSide}
          sectionCut={sectionCut}
          surfaceParams={surfaceParams}
          showSkeleton={showSkeleton}
          showGridOverlays={showGridOverlays}
          isQuadView={isQuadView}
          isAutoSpin={isAutoSpin}
          dragMode={dragMode}
          activeTool={activeTool}
          lightAngle={lightAngle}
          wireOpacity={wireOpacity}
          hdriPreset={hdriPreset}
          onLightAngleChange={setLightAngle}
          onWireOpacityChange={setWireOpacity}
          onHdriPresetChange={setHdriPreset}
          onOutlinerChange={setOutlinerNodes}
          onBonesChange={setBones}
          onMaterialsChange={setMaterials}
          onAnimationsChange={(nextClips, idx, playing, time) => {
            setClips(nextClips);
            setActiveClipIdx(idx);
            setAnimPlaying(playing);
            setAnimTime(time);
          }}
          onTelemetryChange={(sc) => setSceneTelemetry(sc)}
          onTransformChange={setTransformInfo}
          onDiagnosticsChange={setDiagnostics}
          onFpsChange={setLiveFps}
          onCursorChange={(x, y) => setCursorCoords({ x, y })}
          onSelectedNodeChange={(uuid, name) => {
            setSelectedNodeUuid(uuid);
            setSelectedNodeName(name);
          }}
          onOpenAssetModal={() => setAssetModalOpen(true)}
          onLoadQuickSpecimen={() => void handleSelectModel(STUDIO_SPECIMENS[0])}
          onNotify={notify}
        />

        {/* RIGHT DOCKABLE INSPECTOR COLUMN */}
        {rightPanelOpen && (
          <RightInspector
            activeTab={inspectorTab}
            onTabChange={setInspectorTab}
            modelName={sceneTelemetry.modelName}
            outlinerNodes={outlinerNodes}
            selectedNodeUuid={selectedNodeUuid}
            onSelectNode={(uuid) => viewportRef.current?.selectNode(uuid)}
            onToggleNodeVisibility={(uuid) => viewportRef.current?.toggleNodeVisibility(uuid)}
            onToggleNodeLock={(uuid) => viewportRef.current?.toggleNodeLock(uuid)}
            onSoloNode={(uuid) => viewportRef.current?.soloNode(uuid)}
            onShowAllNodes={() => viewportRef.current?.showAllNodes()}
            transformInfo={transformInfo}
            onTransformChange={(field, val) => viewportRef.current?.updateSelectedTransform(field, val)}
            surfaceParams={surfaceParams}
            onSurfaceParamsChange={setSurfaceParams}
            materials={materials}
            insideOutSide={insideOutSide}
            onInsideOutChange={setInsideOutSide}
            sectionCut={sectionCut}
            onSectionCutChange={setSectionCut}
            diagnostics={diagnostics}
            onRecalculateNormals={() => notify(viewportRef.current?.recalculateNormalsOutside() || '')}
            onPurgeDegenerates={() => notify(viewportRef.current?.purgeDegenerateGeometry() || '')}
            bones={bones}
            showSkeleton={showSkeleton}
            onToggleSkeleton={() => setShowSkeleton((v) => !v)}
            onSetBoneRotation={(uuid, axis, deg) => viewportRef.current?.setBoneRotation(uuid, axis, deg)}
            onResetPose={() => viewportRef.current?.resetPose()}
            clips={clips}
            activeClipIdx={activeClipIdx}
            animPlaying={animPlaying}
            animTime={animTime}
            onPlayClip={(idx) => viewportRef.current?.playClip(idx)}
            onToggleAnimPlay={() => viewportRef.current?.setAnimPlaying(!animPlaying)}
            onSeekAnim={(t) => viewportRef.current?.seekAnim(t)}
            onOpenAssetModal={() => setAssetModalOpen(true)}
          />
        )}

        {/* Toast Feedback Banner */}
        {toastMsg && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 bg-[#111318] text-white px-3.5 py-1.5 rounded-full text-xs font-mono shadow-lg">
            {toastMsg}
          </div>
        )}
      </div>

      {/* FOOTER STATUS & WORKSPACE TELEMETRY STRIP */}
      <footer className="h-6 w-full bg-white border-t border-[#dcdfe4] px-3 flex items-center justify-between shrink-0 font-mono text-[10px] text-[#64748b] select-none z-40">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-black font-semibold">
            <span className="material-symbols-outlined text-[12px]">verified</span>
            Real-time Monochrome Shader Core v4.2
          </span>
          <span className="text-[#dcdfe4]">|</span>
          <span className="hidden sm:inline">
            Active Pass: <strong className="text-black">{activePassTitle}</strong>
          </span>
          <span className="text-[#dcdfe4] hidden md:inline">|</span>
          <span className="hidden md:inline">
            Pipeline:{' '}
            <span className="text-black font-semibold">
              {mode === 'cloud' ? 'Cloud GitHub CI (Blender 4.2 LTS)' : `Local 2FA (${localEndpoint})`}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span>
            Cursor:{' '}
            <span className="text-black font-semibold">
              X: {cursorCoords.x} Y: {cursorCoords.y}
            </span>
          </span>
          <span className="text-[#dcdfe4]">|</span>
          <span className="text-black font-semibold">
            Ready · {isAutoSpin ? 'Turntable Active' : 'Interactive'} {liveFps.toFixed(0)}FPS
          </span>
        </div>
      </footer>

      {/* MODALS & DRAWERS */}
      <AssetRepositoryModal
        open={assetModalOpen}
        onClose={() => setAssetModalOpen(false)}
        models={allAvailableModels}
        activeModelId={activeModelId}
        serverConfig={serverConfig}
        ciStatus={ciStatus}
        driveUser={driveUser}
        localFolderName={localFolderName}
        onSelectModel={handleSelectModel}
        onRefreshModels={async () => {
          await refreshGitHubAndModels();
          if (driveUser) await refreshDriveModels();
        }}
        onImportLocalFile={handleImportLocalFile}
        onUploadToGitHub={handleUploadToGitHub}
        onUploadToGoogleDrive={handleUploadToGoogleDrive}
        onSignInGoogleDrive={async () => {
          await signInWithGoogleDrive();
          await refreshDriveModels();
          notify('Connected Google Drive workspace.');
        }}
        onSignOutGoogleDrive={async () => {
          await signOutGoogleDrive();
          notify('Signed out of Google Drive.');
        }}
        onLinkLocalFolder={handleLinkLocalFolder}
        onClearToPointCloud={() => {
          viewportRef.current?.clearToPointCloud();
          setActiveModelId(null);
          notify('Cleared viewport to Monochrome Point Cloud Stage.');
        }}
      />

      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        modelName={sceneTelemetry.modelName}
        hasActiveModel={Boolean(sceneTelemetry.modelName)}
        serverConfig={serverConfig}
        ciStatus={ciStatus}
        driveUser={driveUser}
        onExportGeometry={async (fmt: Exclude<ExportFormatId, 'blend' | 'png'>) => {
          if (!viewportRef.current) throw new Error('Viewport is not ready.');
          return await viewportRef.current.exportCurrentModel(fmt);
        }}
        onCaptureSnapshotPng={async () => {
          if (!viewportRef.current) throw new Error('Viewport is not ready.');
          return await viewportRef.current.captureSnapshotPng();
        }}
        onTriggerCloudBlendBuild={async (pyScript, note) => {
          const res = await executeBlenderBuild(pyScript, note);
          if (!res.ok) throw new Error(res.summary);
        }}
        onPushExportToGitHub={async (blob, filename) => {
          const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
          const check = validateModelUpload(filename, file.size);
          if (!check.valid || !check.sanitizedName) {
            throw new Error(check.reason || 'Invalid filename for GitHub push.');
          }
          await handleUploadToGitHub(file, check.sanitizedName);
        }}
        onPushExportToDrive={async (blob, filename) => {
          const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
          const check = validateModelUpload(filename, file.size);
          if (!check.valid || !check.sanitizedName) {
            throw new Error(check.reason || 'Invalid filename for Google Drive.');
          }
          await handleUploadToGoogleDrive(file, check.sanitizedName);
        }}
      />

      <StudioDrawer
        open={drawerOpen}
        activeTab={drawerTab}
        onTabChange={setDrawerTab}
        onClose={() => setDrawerOpen(false)}
        mode={mode}
        localEndpoint={localEndpoint}
        localOfflineBanner={localOfflineBanner}
        serverConfig={serverConfig}
        ciStatus={ciStatus}
        messages={messages}
        chatBusy={chatBusy}
        onSendMessage={handleSendMessage}
        diffProposals={diffProposals}
        onApproveDiff={handleApproveDiff}
        onRejectDiff={handleRejectDiff}
        pass1ImageUrl={pass1ImageUrl}
        pass2ImageUrl={pass2ImageUrl}
        latestVisionCritique={latestVisionCritique}
        visionBusy={visionBusy}
        onRunVisionCritique={() => handleRunVisionCritique()}
        onApplyPass2Script={async (script, note) => {
          const res = await executeBlenderBuild(script, note);
          notify(res.summary);
        }}
        buildPy={buildPy}
        onBuildPyChange={setBuildPy}
        buildBusy={buildBusy}
        onRunBuildPy={async (note) => {
          const res = await executeBlenderBuild(buildPy, note);
          notify(res.summary);
        }}
        onResetStarterPy={() => {
          setBuildPy(STARTER_BUILD_PY);
          notify('Reset scripts/build.py to starter lantern script.');
        }}
        localFolderName={localFolderName}
        workspaceFiles={workspaceFiles}
        selectedFilePath={selectedFilePath}
        onSelectFile={setSelectedFilePath}
        onLinkLocalFolder={handleLinkLocalFolder}
        systemSkill={systemSkill}
        onSystemSkillChange={setSystemSkill}
        onResetSystemSkill={() => {
          setSystemSkill(DEFAULT_BLENDER_SKILL);
          notify('Restored default Blender 4.2 LTS System Skill.');
        }}
      />

      <TwoFactorSwitchModal
        open={twoFactorOpen}
        localEndpoint={localEndpoint}
        onCancel={() => setTwoFactorOpen(false)}
        onVerified={(ep) => {
          setLocalEndpoint(ep);
          setMode('local');
          setTwoFactorOpen(false);
          notify(`2FA Verified — Switched to Local Blender Backup (${ep}).`);
        }}
      />
    </div>
  );
}
