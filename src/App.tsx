import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { StudioViewport, type StudioViewportHandle } from './components/StudioViewport';
import { InspectorSheet } from './components/InspectorSheet';
import { WorkbenchSheet } from './components/WorkbenchSheet';
import { LibraryModal } from './components/LibraryModal';
import { ExportDialog } from './components/ExportDialog';
import { TwoFactorModal } from './components/TwoFactorModal';
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
  writeFileToDirectory,
} from './utils/fsAccess';
import {
  downloadDriveModelAsBlobUrl,
  initDriveAuth,
  listDrive3DModels,
  signInWithGoogleDrive,
  signOutGoogleDrive,
  uploadModelToGoogleDrive,
} from './utils/googleDrive';
import {
  exportObject3DToBlob,
  triggerBlobDownload,
  type ExportFormatId,
} from './utils/modelExporters';
import { validateModelUpload } from './utils/modelUploadValidation';
import { normalizeWorkspacePath, resolveStaticPagesAssetUrl } from './utils/pathSafety';
import pass1ReferenceImg from './assets/images/lantern_render_pass1_1795369398050.jpg';
import pass2ReferenceImg from './assets/images/lantern_render_pass2_1795369396454.jpg';
import type {
  AnimationClipSummary,
  AvailableModelItem,
  BoneControlInfo,
  CameraTelemetry,
  ChatMessageItem,
  ExecutionMode,
  GeminiContentTurn,
  GitHubCiStatus,
  InsideOutSide,
  InspectorTabId,
  MaterialChannelInfo,
  OutlinerNode,
  PendingDiffProposal,
  SceneTelemetry,
  SectionCutConfig,
  ServerConfig,
  ShadingPass,
  StudioLightingPreset,
  SurfaceParams,
  ToolTrace,
  TopologyDiagnostics,
  TransformInfo,
  VisionCritiqueResult,
  WorkbenchTabId,
  WorkspaceFileEntry,
  WorkspaceModeId,
} from './types';

const SINGLE_SAMPLE_MODEL: AvailableModelItem = {
  id: 'sample:stone-lantern',
  name: 'Stone & Cedar Lantern',
  source: 'specimen',
  format: 'procedural',
  category: 'Sample',
  specimenKind: 'stone-lantern',
  viewable: true,
  description:
    'Curated architectural garden lantern with beveled granite plinth, hinoki cedar kumiko lattice, patinated bronze collars, warm washi core, and stepped slate pagoda roof.',
};

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

async function fetchJsonSafe<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T | null }> {
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
  const geminiHistoryRef = useRef<GeminiContentTurn[]>([]);
  const toastTimerRef = useRef<number | null>(null);

  // Navigation & Sheet States
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceModeId>('inspect');
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTabId>('outliner');
  const [workbenchOpen, setWorkbenchOpen] = useState(false);
  const [workbenchTab, setWorkbenchTab] = useState<WorkbenchTabId>('agent');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 3D Viewport Visual State
  const [shadingPass, setShadingPass] = useState<ShadingPass>('combined');
  const [quadView, setQuadView] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [autoSpin, setAutoSpin] = useState(false);
  const [exploded, setExploded] = useState(false);
  const [lightingPreset, setLightingPreset] = useState<StudioLightingPreset>('studio-4k');
  const [lightAngleDeg, setLightAngleDeg] = useState(42);
  const [wireframeOpacity, setWireframeOpacity] = useState(0);
  const [insideOutSide, setInsideOutSide] = useState<InsideOutSide>('front');
  const [showSkeleton, setShowSkeleton] = useState(false);
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
    modelName: 'Stone & Cedar Lantern',
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
    name: 'Stone & Cedar Lantern',
    posX: 0,
    posY: 0,
    posZ: 0,
    rotX: 0,
    rotY: 0,
    rotZ: 0,
  });
  const [materials, setMaterials] = useState<MaterialChannelInfo[]>([]);
  const [bones, setBones] = useState<BoneControlInfo[]>([]);
  const [animationClips, setAnimationClips] = useState<AnimationClipSummary[]>([]);
  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const [animationDuration, setAnimationDuration] = useState(0);
  const [animationTime, setAnimationTime] = useState(0);
  const [animationPlaying, setAnimationPlaying] = useState(false);

  // Asset Library & Cloud/Static Environment State
  const [isStaticSite, setIsStaticSite] = useState(false);
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);
  const [ciStatus, setCiStatus] = useState<GitHubCiStatus | null>(null);
  const [activeModelId, setActiveModelId] = useState<string | null>(SINGLE_SAMPLE_MODEL.id);
  const [githubModels, setGithubModels] = useState<AvailableModelItem[]>([]);
  const [driveModels, setDriveModels] = useState<AvailableModelItem[]>([]);
  const [localModels, setLocalModels] = useState<AvailableModelItem[]>([]);
  const [staticPagesModels, setStaticPagesModels] = useState<AvailableModelItem[]>([]);
  const [libraryBusy, setLibraryBusy] = useState(false);

  // Google Drive Auth State
  const [driveSignedIn, setDriveSignedIn] = useState(false);
  const [driveUserEmail, setDriveUserEmail] = useState<string | null>(null);

  // Pipeline Workbench State
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('cloud');
  const [localBlenderEndpoint, setLocalBlenderEndpoint] = useState('http://127.0.0.1:8787/blender');
  const [buildPyCode, setBuildPyCode] = useState<string>(STARTER_BUILD_PY);
  const [commitNote, setCommitNote] = useState('Refine Stone & Cedar Lantern proportions and bevels');
  const [isBuildRunning, setIsBuildRunning] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>([]);
  const [pendingDiffs, setPendingDiffs] = useState<Record<string, PendingDiffProposal>>({});
  const [isAgentBusy, setIsAgentBusy] = useState(false);
  const [pass1PreviewUrl, setPass1PreviewUrl] = useState<string>(pass1ReferenceImg);
  const [pass2PreviewUrl, setPass2PreviewUrl] = useState<string>(pass2ReferenceImg);
  const [visionCritique, setVisionCritique] = useState<VisionCritiqueResult | null>(null);
  const [isVisionRunning, setIsVisionRunning] = useState(false);

  // Local Workspace Folder & System Skill
  const fsSupported = useMemo(() => isFileSystemAccessSupported(), []);
  const [localFolderName, setLocalFolderName] = useState<string | null>(null);
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
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 3200);
  }, []);

  // Persist system skill cleanly
  useEffect(() => {
    try {
      localStorage.setItem(SYSTEM_SKILL_STORAGE_KEY, systemSkill);
    } catch {
      // Ignore storage quota errors in restricted frames
    }
  }, [systemSkill]);

  // Refresh GitHub CI status & model catalog (with graceful Static GitHub Pages detection)
  const refreshServerAndCi = useCallback(async () => {
    setLibraryBusy(true);
    try {
      const cfg = await fetchJsonSafe<ServerConfig>('/api/config');
      if (!cfg.ok || !cfg.data) {
        // Running statically (e.g., GitHub Pages)
        setIsStaticSite(true);
        const glbPath = resolveStaticPagesAssetUrl('model.glb');
        const previewPath = resolveStaticPagesAssetUrl('preview.png');
        if (glbPath) {
          try {
            const headRes = await fetch(glbPath, { method: 'HEAD' });
            if (headRes.ok) {
              const size = Number(headRes.headers.get('content-length') || 0);
              setStaticPagesModels([
                {
                  id: 'pages:model.glb',
                  name: 'Published CI Build (model.glb)',
                  source: 'github-release',
                  format: '.glb',
                  category: 'Cloud_CI',
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
        if (previewPath) {
          try {
            const imgRes = await fetch(previewPath, { method: 'HEAD' });
            if (imgRes.ok) {
              setPass2PreviewUrl(previewPath);
            }
          } catch {
            // Fallback to bundled reference renders
          }
        }
        return;
      }

      setIsStaticSite(false);
      setServerConfig(cfg.data);

      const [starterRes, statusRes, ghModelsRes] = await Promise.all([
        fetchJsonSafe<{ files?: Array<{ path: string; content: string; size: number }> }>('/api/workspace/starter'),
        fetchJsonSafe<GitHubCiStatus>('/api/github/status'),
        fetchJsonSafe<{ configured: boolean; models?: AvailableModelItem[] }>('/api/github/models'),
      ]);

      if (starterRes.ok && starterRes.data?.files && !localDirHandleRef.current) {
        const mapped: WorkspaceFileEntry[] = starterRes.data.files.map((f) => ({
          path: f.path,
          name: f.path.split('/').pop() || f.path,
          size: f.size,
          source: 'starter',
          content: f.content,
        }));
        if (mapped.length > 0) {
          setWorkspaceFiles(mapped);
          const buildEntry = mapped.find((m) => m.path === 'scripts/build.py');
          if (buildEntry?.content) {
            setBuildPyCode(buildEntry.content);
            setSelectedFilePath(buildEntry.path);
            setSelectedFileContent(buildEntry.content);
          }
        }
      }

      if (statusRes.ok && statusRes.data) {
        setCiStatus(statusRes.data);
      }

      if (ghModelsRes.ok && ghModelsRes.data?.models) {
        setGithubModels(ghModelsRes.data.models);
      }
    } finally {
      setLibraryBusy(false);
    }
  }, []);

  useEffect(() => {
    refreshServerAndCi();
  }, [refreshServerAndCi]);

  // Initialize Google Drive auth listener
  const refreshDriveModels = useCallback(async () => {
    try {
      const files = await listDrive3DModels();
      setDriveModels(
        files.map((f) => {
          const lower = f.name.toLowerCase();
          const fmt = lower.endsWith('.glb')
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
            sizeBytes: f.size ? Number(f.size) : undefined,
            driveFileId: f.id,
            htmlUrl: f.webViewLink,
            viewable: fmt !== '.blend',
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

  // Global keyboard shortcuts (Escape, Alt+Ctrl+Q, F12)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLibraryOpen(false);
        setExportOpen(false);
        setTwoFactorOpen(false);
      } else if (e.altKey && e.ctrlKey && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        setQuadView((prev) => !prev);
      } else if (e.key === 'F12') {
        e.preventDefault();
        viewportRef.current?.captureSnapshot(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Top-bar mode switcher (Inspect, Topology, LookDev, Pipeline)
  const handleSelectWorkspaceMode = (mode: WorkspaceModeId) => {
    setWorkspaceMode(mode);
    if (mode === 'inspect') {
      setWorkbenchOpen(false);
      setShadingPass('combined');
      setWireframeOpacity(0);
    } else if (mode === 'topology') {
      setWorkbenchOpen(false);
      setShadingPass('wireframe');
      setWireframeOpacity(0.55);
      setInspectorTab('diagnostics');
      setInspectorOpen(true);
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

  // All available models (ONLY ONE sample model!)
  const allAvailableModels = useMemo<AvailableModelItem[]>(() => {
    return [SINGLE_SAMPLE_MODEL, ...staticPagesModels, ...githubModels, ...driveModels, ...localModels];
  }, [staticPagesModels, githubModels, driveModels, localModels]);

  // Select and load any asset on stage
  const handleSelectModel = async (item: AvailableModelItem) => {
    try {
      if (item.source === 'specimen') {
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
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to load model');
    }
  };

  // Import local 3D file
  const handleImportLocalFile = async (file: File) => {
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
    const newItem: AvailableModelItem = {
      id: `local:${Date.now()}-${check.sanitizedName}`,
      name: check.sanitizedName,
      source: 'local-file',
      format: check.extension as AvailableModelItem['format'],
      sizeBytes: file.size,
      url: blobUrl,
      viewable: true,
      updatedAt: new Date().toISOString(),
    };
    setLocalModels((prev) => [newItem, ...prev]);
    await viewportRef.current?.loadModelFromUrl(blobUrl, newItem.name, newItem.format);
    setActiveModelId(newItem.id);
    setLibraryOpen(false);
  };

  // Upload file to GitHub models/
  const handleUploadFileToGithub = async (file: File) => {
    const check = validateModelUpload(file.name, file.size);
    if (!check.valid || !check.sanitizedName) {
      notify(check.reason || 'Invalid file');
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(buf);
      const res = await fetchJsonSafe<{ uploaded?: boolean; error?: string }>('/api/github/upload-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: check.sanitizedName,
          contentBase64: base64,
          commitMessage: `Add ${check.sanitizedName} via BlendFactory Studio`,
        }),
      });
      if (!res.ok) throw new Error(res.data?.error || 'GitHub upload failed');
      notify(`Uploaded ${check.sanitizedName} to GitHub`);
      await refreshServerAndCi();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'GitHub upload failed');
    }
  };

  // Upload file to Google Drive
  const handleUploadFileToDrive = async (file: File) => {
    const check = validateModelUpload(file.name, file.size);
    if (!check.valid || !check.sanitizedName) {
      notify(check.reason || 'Invalid file');
      return;
    }
    try {
      await uploadModelToGoogleDrive(file, check.sanitizedName);
      notify(`Saved ${check.sanitizedName} to Google Drive`);
      await refreshDriveModels();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Drive upload failed');
    }
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

  const handleSelectWorkspaceFile = async (relPath: string) => {
    setSelectedFilePath(relPath);
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

  // Execution Mode Switch (Cloud CI vs Local 2FA)
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
        notify('Committed scripts/build.py · Polling GitHub Actions CI');

        // Poll up to 45s for run completion
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
              setPass2PreviewUrl(`/api/github/artifacts/preview.png?ts=${Date.now()}`);
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
          detail: 'Build triggered and running on GitHub Actions CI. Refresh CI status once complete.',
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
    [executionMode, localBlenderEndpoint, notify, refreshServerAndCi]
  );

  // Vision QA Critique
  const handleRunVisionAudit = async () => {
    setIsVisionRunning(true);
    try {
      const snapDataUrl = viewportRef.current?.captureSnapshot(false);
      let base64 = '';
      let mimeType = 'image/png';
      if (snapDataUrl && snapDataUrl.includes(',')) {
        base64 = snapDataUrl.split(',')[1];
      } else {
        const res = await fetch(pass1PreviewUrl);
        const buf = await res.arrayBuffer();
        base64 = arrayBufferToBase64(buf);
        mimeType = res.headers.get('content-type') || 'image/jpeg';
      }

      const auditRes = await fetchJsonSafe<VisionCritiqueResult & { error?: string }>(
        '/api/vision/critique',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType,
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
      notify('Completed Cycles Vision QA audit');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Vision audit failed');
    } finally {
      setIsVisionRunning(false);
    }
  };

  const handleApplyVisionPass2 = async () => {
    if (!visionCritique?.refinedScript) return;
    setBuildPyCode(visionCritique.refinedScript);
    setCommitNote(visionCritique.commitNote || 'Apply Vision QA Pass 2 refinements');
    setWorkbenchTab('script');
    await executeBuildPipeline(
      visionCritique.refinedScript,
      visionCritique.commitNote || 'Vision QA Pass 2 refinement'
    );
  };

  // Gemini AI Agent Function-Calling Loop
  const handleSendAgentPrompt = async (promptText: string) => {
    const userMsg: ChatMessageItem = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      text: promptText,
      timestamp: nowStamp(),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setIsAgentBusy(true);

    try {
      const nextHistory: GeminiContentTurn[] = [
        ...geminiHistoryRef.current,
        { role: 'user', parts: [{ text: promptText }] },
      ];

      for (let step = 0; step < 4; step++) {
        const chatRes = await fetchJsonSafe<{
          text?: string;
          functionCalls?: Array<{ id?: string; name: string; args?: Record<string, unknown> }>;
          modelContent?: GeminiContentTurn | null;
          error?: string;
        }>('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: nextHistory,
            systemSkill,
            mode: executionMode,
            localFiles: workspaceFiles.map((f) => f.path),
            currentBuildPy: buildPyCode,
          }),
        });

        if (!chatRes.ok || !chatRes.data) {
          throw new Error(chatRes.data?.error || 'AI Builder Agent requires a running studio server.');
        }

        if (chatRes.data.modelContent) {
          nextHistory.push(chatRes.data.modelContent);
        }

        const calls = chatRes.data.functionCalls || [];
        if (calls.length === 0) {
          setChatMessages((prev) => [
            ...prev,
            {
              id: `msg-${Date.now()}-a`,
              role: 'assistant',
              text: chatRes.data?.text || 'Done.',
              timestamp: nowStamp(),
            },
          ]);
          break;
        }

        const traces: ToolTrace[] = [];
        const fnResponses: Array<{
          functionResponse: { id?: string; name: string; response: Record<string, unknown> };
        }> = [];
        let createdProposalId: string | undefined;
        let buildProgress: ChatMessageItem['buildProgress'];

        for (const fc of calls) {
          const args = fc.args || {};
          if (fc.name === 'list_local_files') {
            const subdir = typeof args.subdir === 'string' ? args.subdir : '';
            const matching = workspaceFiles
              .map((f) => f.path)
              .filter((p) => !subdir || p.startsWith(subdir));
            traces.push({
              id: `tr-${Date.now()}-${fc.name}`,
              name: fc.name,
              argsPreview: subdir || '(root)',
              status: 'completed',
              summary: `Found ${matching.length} files`,
            });
            fnResponses.push({
              functionResponse: { id: fc.id, name: fc.name, response: { files: matching } },
            });
          } else if (fc.name === 'read_local_file') {
            const rawPath = String(args.path || '');
            try {
              const safePath = normalizeWorkspacePath(rawPath);
              let content = '';
              if (localDirHandleRef.current) {
                content = await readFileFromDirectory(localDirHandleRef.current, safePath);
              } else {
                content =
                  workspaceFiles.find((f) => f.path === safePath)?.content ||
                  (safePath === 'scripts/build.py' ? buildPyCode : '');
              }
              traces.push({
                id: `tr-${Date.now()}-${fc.name}`,
                name: fc.name,
                argsPreview: safePath,
                status: 'completed',
                summary: `Read ${content.length} chars`,
              });
              fnResponses.push({
                functionResponse: { id: fc.id, name: fc.name, response: { path: safePath, content } },
              });
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : 'Read error';
              traces.push({
                id: `tr-${Date.now()}-${fc.name}`,
                name: fc.name,
                argsPreview: rawPath,
                status: 'error',
                summary: errMsg,
              });
              fnResponses.push({
                functionResponse: { id: fc.id, name: fc.name, response: { error: errMsg } },
              });
            }
          } else if (fc.name === 'write_local_file') {
            const rawPath = String(args.path || '');
            const afterContent = String(args.content || '');
            try {
              const safePath = normalizeWorkspacePath(rawPath);
              let beforeContent = '';
              if (localDirHandleRef.current) {
                try {
                  beforeContent = await readFileFromDirectory(localDirHandleRef.current, safePath);
                } catch {
                  beforeContent = '';
                }
              } else {
                beforeContent =
                  workspaceFiles.find((f) => f.path === safePath)?.content ||
                  (safePath === 'scripts/build.py' ? buildPyCode : '');
              }
              const proposalId = `diff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
              createdProposalId = proposalId;
              setPendingDiffs((prev) => ({
                ...prev,
                [proposalId]: {
                  id: proposalId,
                  path: safePath,
                  beforeContent,
                  afterContent,
                  status: 'pending',
                  createdAt: nowStamp(),
                },
              }));
              traces.push({
                id: `tr-${Date.now()}-${fc.name}`,
                name: fc.name,
                argsPreview: safePath,
                status: 'awaiting_approval',
                summary: `Diff ready for ${safePath}`,
              });
              fnResponses.push({
                functionResponse: {
                  id: fc.id,
                  name: fc.name,
                  response: { status: 'pending_user_approval', path: safePath },
                },
              });
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : 'Write proposal rejected';
              traces.push({
                id: `tr-${Date.now()}-${fc.name}`,
                name: fc.name,
                argsPreview: rawPath,
                status: 'error',
                summary: errMsg,
              });
              fnResponses.push({
                functionResponse: { id: fc.id, name: fc.name, response: { error: errMsg } },
              });
            }
          } else if (fc.name === 'build_blend_cloud') {
            const scriptText = String(args.bpy_script || '');
            const note = String(args.commit_note || 'Update scripts/build.py via AI Agent');
            if (scriptText.trim()) {
              setBuildPyCode(scriptText);
              setCommitNote(note);
            }
            const result = await executeBuildPipeline(scriptText, note);
            buildProgress = {
              mode: executionMode,
              stage: result.ok ? 'completed' : 'failed',
              runUrl: result.runUrl,
              detail: result.detail,
            };
            traces.push({
              id: `tr-${Date.now()}-${fc.name}`,
              name: fc.name,
              argsPreview: note,
              status: result.ok ? 'completed' : 'error',
              summary: result.detail,
            });
            fnResponses.push({
              functionResponse: {
                id: fc.id,
                name: fc.name,
                response: { ok: result.ok, detail: result.detail },
              },
            });
          }
        }

        setChatMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-t-${step}`,
            role: 'assistant',
            text: chatRes.data?.text || '',
            timestamp: nowStamp(),
            toolTraces: traces,
            diffProposalId: createdProposalId,
            buildProgress,
          },
        ]);

        nextHistory.push({ role: 'user', parts: fnResponses });
      }

      geminiHistoryRef.current = nextHistory.slice(-24);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-err`,
          role: 'system',
          text: '',
          error: err instanceof Error ? err.message : 'Agent request failed.',
          timestamp: nowStamp(),
        },
      ]);
    } finally {
      setIsAgentBusy(false);
    }
  };

  // Diff Approval handlers
  const handleApproveDiff = async (proposalId: string) => {
    const prop = pendingDiffs[proposalId];
    if (!prop) return;
    try {
      if (localDirHandleRef.current) {
        await writeFileToDirectory(localDirHandleRef.current, prop.path, prop.afterContent);
      }
      if (prop.path === 'scripts/build.py') {
        setBuildPyCode(prop.afterContent);
      }
      setWorkspaceFiles((prev) =>
        prev.map((f) => (f.path === prop.path ? { ...f, content: prop.afterContent } : f))
      );
      if (selectedFilePath === prop.path) {
        setSelectedFileContent(prop.afterContent);
      }
      setPendingDiffs((prev) => ({
        ...prev,
        [proposalId]: { ...prop, status: 'approved' },
      }));
      notify(`Approved & wrote ${prop.path}`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to write file');
    }
  };

  const handleRejectDiff = (proposalId: string) => {
    const prop = pendingDiffs[proposalId];
    if (!prop) return;
    setPendingDiffs((prev) => ({
      ...prev,
      [proposalId]: { ...prop, status: 'rejected' },
    }));
    notify(`Rejected change to ${prop.path}`);
  };

  // Export handlers
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
      throw new Error('Load a 3D model before exporting geometry.');
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
    const res = await executeBuildPipeline(pyScript, `Build native .blend for ${telemetry.modelName || 'model'}`);
    if (!res.ok) throw new Error(res.detail);
  };

  const handlePushCurrentToGithub = async () => {
    const root = viewportRef.current?.getActiveModelRoot();
    if (!root) throw new Error('Load a 3D model first.');
    const { blob, filename } = await exportObject3DToBlob(
      root,
      'glb',
      telemetry.modelName || 'stone-lantern'
    );
    const file = new File([blob], filename, { type: 'model/gltf-binary' });
    await handleUploadFileToGithub(file);
  };

  const handleSaveCurrentToDrive = async () => {
    const root = viewportRef.current?.getActiveModelRoot();
    if (!root) throw new Error('Load a 3D model first.');
    const { blob, filename } = await exportObject3DToBlob(
      root,
      'glb',
      telemetry.modelName || 'stone-lantern'
    );
    const file = new File([blob], filename, { type: 'model/gltf-binary' });
    await handleUploadFileToDrive(file);
  };

  const githubSlug =
    serverConfig?.githubOwner && serverConfig?.githubRepo
      ? `${serverConfig.githubOwner}/${serverConfig.githubRepo}`
      : null;

  const hasLatestBlendArtifact = Boolean(ciStatus?.assets?.some((a) => a.name === 'model.blend'));

  const navItems: Array<{ id: WorkspaceModeId; label: string }> = [
    { id: 'inspect', label: 'Inspect' },
    { id: 'topology', label: 'Topology' },
    { id: 'lookdev', label: 'LookDev' },
    { id: 'pipeline', label: 'Pipeline' },
  ];

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#F5F3EF] text-[#1C1B19]">
      {/* 3-ZONE TOP HEADER: [Brand Wordmark] — [4 Clean Nav Links] — [1 Primary CTA] */}
      <header className="z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-[#E5E1DA] bg-white px-3.5 sm:px-6">
        {/* Left: Brand Wordmark */}
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

        {/* Center: 4 Single-Line Workspace Links */}
        <nav aria-label="Workspace modes" className="flex items-center gap-0.5 sm:gap-2">
          {navItems.map((item) => {
            const active =
              workspaceMode === item.id && (item.id !== 'pipeline' || workbenchOpen);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectWorkspaceMode(item.id)}
                className={`relative rounded-lg px-2 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors sm:px-3 sm:text-[13px] ${
                  active
                    ? 'bg-[#EBF2EF] text-[#1D4438]'
                    : 'text-[#5A564F] hover:bg-[#F5F3EF] hover:text-[#1C1B19]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right: Single Primary CTA */}
        <button
          type="button"
          onClick={() => setExportOpen(true)}
          aria-label="Export 3D asset"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#2D5A4C] px-2.5 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#22453A] sm:px-3.5 sm:text-[12.5px]"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Export</span>
        </button>
      </header>

      {/* FULL-BLEED 3D ARCHITECTURAL VIEWPORT STAGE */}
      <main className="relative min-h-0 flex-1">
        <StudioViewport
          ref={viewportRef}
          shadingPass={shadingPass}
          onShadingPassChange={setShadingPass}
          quadView={quadView}
          onToggleQuadView={() => setQuadView((p) => !p)}
          showGrid={showGrid}
          onToggleGrid={() => setShowGrid((p) => !p)}
          autoSpin={autoSpin}
          onToggleAutoSpin={() => setAutoSpin((p) => !p)}
          exploded={exploded}
          onToggleExploded={() => setExploded((p) => !p)}
          lightingPreset={lightingPreset}
          onLightingPresetChange={setLightingPreset}
          lightAngleDeg={lightAngleDeg}
          onLightAngleChange={setLightAngleDeg}
          wireframeOpacity={wireframeOpacity}
          onWireframeOpacityChange={setWireframeOpacity}
          insideOutSide={insideOutSide}
          surfaceParams={surfaceParams}
          sectionCut={sectionCut}
          onSectionCutChange={setSectionCut}
          showSkeleton={showSkeleton}
          executionMode={executionMode}
          fsSupported={fsSupported}
          inspectorOpen={inspectorOpen}
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
          onAnimationsChange={(clips, idx, dur) => {
            setAnimationClips(clips);
            setActiveClipIndex(idx);
            setAnimationDuration(dur);
          }}
          onAnimationTimeChange={(t, playing) => {
            setAnimationTime(t);
            setAnimationPlaying(playing);
          }}
        />

        {/* SLIDE-OVER INSPECTOR SHEET */}
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
        />

        {/* SLIDE-OVER PIPELINE WORKBENCH SHEET */}
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
          executionMode={executionMode}
          localBlenderEndpoint={localBlenderEndpoint}
          ciStatus={ciStatus}
          chatMessages={chatMessages}
          pendingDiffs={pendingDiffs}
          isAgentBusy={isAgentBusy}
          onSendPrompt={handleSendAgentPrompt}
          onApproveDiff={handleApproveDiff}
          onRejectDiff={handleRejectDiff}
          pass1PreviewUrl={pass1PreviewUrl}
          pass2PreviewUrl={pass2PreviewUrl}
          visionCritique={visionCritique}
          isVisionRunning={isVisionRunning}
          onRunVisionAudit={handleRunVisionAudit}
          onApplyVisionPass2={handleApplyVisionPass2}
          buildPyCode={buildPyCode}
          commitNote={commitNote}
          isBuildRunning={isBuildRunning}
          onBuildPyChange={setBuildPyCode}
          onCommitNoteChange={setCommitNote}
          onResetStarterScript={() => {
            setBuildPyCode(STARTER_BUILD_PY);
            notify('Reset scripts/build.py to starter lantern');
          }}
          onCommitAndBuild={() => {
            executeBuildPipeline(buildPyCode, commitNote);
          }}
          onRefreshCiStatus={refreshServerAndCi}
          localFolderName={localFolderName}
          fsSupported={fsSupported}
          workspaceFiles={workspaceFiles}
          selectedFilePath={selectedFilePath}
          selectedFileContent={selectedFileContent}
          onLinkLocalFolder={handleLinkLocalFolder}
          onSelectWorkspaceFile={handleSelectWorkspaceFile}
          onRequestExecutionMode={handleRequestExecutionMode}
          systemSkill={systemSkill}
          onSystemSkillChange={setSystemSkill}
          onResetSystemSkill={() => {
            setSystemSkill(DEFAULT_BLENDER_SKILL);
            notify('Restored default Blender 4.2 system skill');
          }}
        />

        {/* FLEETING TOAST FEEDBACK */}
        {toastMessage && (
          <div
            role="status"
            aria-live="polite"
            className="atelier-surface animate-atelier-toast pointer-events-none fixed bottom-20 left-6 z-40 rounded-xl px-4 py-2 text-[12px] font-medium text-[#1C1B19]"
          >
            {toastMessage}
          </div>
        )}
      </main>

      {/* MODALS */}
      <LibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        models={allAvailableModels}
        activeModelId={activeModelId}
        githubConfigured={Boolean(serverConfig?.githubConfigured)}
        githubSlug={githubSlug}
        driveSignedIn={driveSignedIn}
        driveUserEmail={driveUserEmail}
        localFolderName={localFolderName}
        fsSupported={fsSupported}
        isBusy={libraryBusy}
        onSelectModel={handleSelectModel}
        onClearToPointCloud={() => {
          viewportRef.current?.clearToPointCloud();
          setActiveModelId(null);
          notify('Switched to Point Cloud Stage');
        }}
        onImportLocalFile={handleImportLocalFile}
        onUploadToGithub={handleUploadFileToGithub}
        onUploadToDrive={handleUploadFileToDrive}
        onSignInDrive={handleSignInDrive}
        onSignOutDrive={handleSignOutDrive}
        onRefreshAll={async () => {
          await refreshServerAndCi();
          if (driveSignedIn) await refreshDriveModels();
          notify('Refreshed asset library');
        }}
        onLinkLocalFolder={handleLinkLocalFolder}
      />

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
        onDownloadFormat={handleDownloadFormat}
        onBuildBlendViaCloudCi={handleBuildBlendViaCloudCi}
        onPushCurrentToGithub={handlePushCurrentToGithub}
        onSaveCurrentToDrive={handleSaveCurrentToDrive}
        onSignInDrive={handleSignInDrive}
      />

      <TwoFactorModal
        open={twoFactorOpen}
        currentLocalEndpoint={localBlenderEndpoint}
        onClose={() => setTwoFactorOpen(false)}
        onApproved={(endpoint) => {
          setLocalBlenderEndpoint(endpoint);
          setExecutionMode('local');
          setTwoFactorOpen(false);
          notify(`Local Blender Backup active (${endpoint})`);
        }}
      />
    </div>
  );
}

export default App;
