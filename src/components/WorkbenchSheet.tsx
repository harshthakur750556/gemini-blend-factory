import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Camera,
  CheckCircle2,
  CloudUpload,
  Code2,
  Copy,
  Cpu,
  ExternalLink,
  Eye,
  FolderGit2,
  FolderOpen,
  GitCommit,
  Loader2,
  Radio,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Shield,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import { validateBlenderScript } from '../utils/blenderSkill';
import type {
  CapturedScreenshot,
  ExecutionMode,
  GitHubCiStatus,
  HarnessActivityItem,
  ModelGroupName,
  VisionCritiqueResult,
  WorkbenchTabId,
  WorkspaceFileEntry,
} from '../types';

interface WorkbenchSheetProps {
  open: boolean;
  activeTab: WorkbenchTabId;
  onTabChange: (tab: WorkbenchTabId) => void;
  onClose: () => void;
  isStaticSite: boolean;
  geminiConfigured: boolean;
  githubConfigured: boolean;
  executionMode: ExecutionMode;
  localBlenderEndpoint: string;
  ciStatus: GitHubCiStatus | null;
  // Harness Real-Time Automation props
  activeModelSlug: string;
  onActiveModelSlugChange: (slug: string) => void;
  harnessAutoSync: boolean;
  onToggleHarnessAutoSync: () => void;
  harnessActivities: HarnessActivityItem[];
  onSaveBundleToGithub: (group: ModelGroupName) => Promise<void>;
  onCaptureAndStoreScreenshots: () => Promise<void>;
  onSyncHarnessNow: () => Promise<void>;
  onOpenAgentManual: () => void;
  // Real Vision QA props (zero static fake images!)
  realCaptures: CapturedScreenshot[];
  compareAId: string | null;
  compareBId: string | null;
  onCompareAIdChange: (id: string) => void;
  onCompareBIdChange: (id: string) => void;
  visionCritique: VisionCritiqueResult | null;
  isVisionRunning: boolean;
  onCaptureMultiAngleSheet: () => void;
  onFetchCyclesCiRenders: () => Promise<void>;
  onRunVisionAudit: () => Promise<void>;
  onApplyVisionPass2: () => Promise<void>;
  // build.py props
  buildPyCode: string;
  commitNote: string;
  isBuildRunning: boolean;
  onBuildPyChange: (code: string) => void;
  onCommitNoteChange: (note: string) => void;
  onResetStarterScript: () => void;
  onCommitAndBuild: () => void;
  onRefreshCiStatus: () => void;
  // GitHub Synced Workspace props
  localFolderName: string | null;
  fsSupported: boolean;
  workspaceFiles: WorkspaceFileEntry[];
  workspaceSyncedSource: 'github' | 'local' | 'starter';
  selectedFilePath: string | null;
  selectedFileContent: string;
  isWorkspaceLoading: boolean;
  onRefreshGithubWorkspace: () => Promise<void>;
  onLinkLocalFolder: () => void;
  onSelectWorkspaceFile: (path: string) => void;
  onSelectedFileContentChange: (content: string) => void;
  onCommitWorkspaceFileToGithub: (path: string, content: string, message: string) => Promise<void>;
  onRequestExecutionMode: (mode: ExecutionMode) => void;
  systemSkill: string;
  onSystemSkillChange: (val: string) => void;
  onResetSystemSkill: () => void;
  onNotify: (msg: string) => void;
}

export const WorkbenchSheet: React.FC<WorkbenchSheetProps> = ({
  open,
  activeTab,
  onTabChange,
  onClose,
  isStaticSite,
  geminiConfigured,
  githubConfigured,
  executionMode,
  localBlenderEndpoint,
  ciStatus,
  activeModelSlug,
  onActiveModelSlugChange,
  harnessAutoSync,
  onToggleHarnessAutoSync,
  harnessActivities,
  onSaveBundleToGithub,
  onCaptureAndStoreScreenshots,
  onSyncHarnessNow,
  onOpenAgentManual,
  realCaptures,
  compareAId,
  compareBId,
  onCompareAIdChange,
  onCompareBIdChange,
  visionCritique,
  isVisionRunning,
  onCaptureMultiAngleSheet,
  onFetchCyclesCiRenders,
  onRunVisionAudit,
  onApplyVisionPass2,
  buildPyCode,
  commitNote,
  isBuildRunning,
  onBuildPyChange,
  onCommitNoteChange,
  onResetStarterScript,
  onCommitAndBuild,
  onRefreshCiStatus,
  localFolderName,
  fsSupported,
  workspaceFiles,
  workspaceSyncedSource,
  selectedFilePath,
  selectedFileContent,
  isWorkspaceLoading,
  onRefreshGithubWorkspace,
  onLinkLocalFolder,
  onSelectWorkspaceFile,
  onSelectedFileContentChange,
  onCommitWorkspaceFileToGithub,
  onRequestExecutionMode,
  systemSkill,
  onSystemSkillChange,
  onResetSystemSkill,
  onNotify,
}) => {
  const [splitPercent, setSplitPercent] = useState(50);
  const [workspaceQuery, setWorkspaceQuery] = useState('');
  const [fileCommitMsg, setFileCommitMsg] = useState('');
  const [isSavingFile, setIsSavingFile] = useState(false);
  const [isHarnessBusy, setIsHarnessBusy] = useState(false);
  const [harnessGroup, setHarnessGroup] = useState<ModelGroupName>('Props');
  const splitContainerRef = useRef<HTMLDivElement | null>(null);

  const scriptReport = useMemo(() => validateBlenderScript(buildPyCode), [buildPyCode]);

  const filteredWorkspaceFiles = useMemo(() => {
    const q = workspaceQuery.trim().toLowerCase();
    if (!q) return workspaceFiles;
    return workspaceFiles.filter((f) => f.path.toLowerCase().includes(q));
  }, [workspaceFiles, workspaceQuery]);

  const captureA = useMemo(
    () => realCaptures.find((c) => c.id === compareAId) || realCaptures[0] || null,
    [realCaptures, compareAId]
  );
  const captureB = useMemo(
    () =>
      realCaptures.find((c) => c.id === compareBId) ||
      realCaptures[Math.min(1, realCaptures.length - 1)] ||
      captureA,
    [realCaptures, compareBId, captureA]
  );

  if (!open) return null;

  const tabs: Array<{ id: WorkbenchTabId; label: string; icon: React.ReactNode }> = [
    { id: 'harness', label: 'Harness', icon: <Cpu className="h-3.5 w-3.5" /> },
    { id: 'vision', label: 'Vision QA', icon: <Eye className="h-3.5 w-3.5" /> },
    { id: 'script', label: 'build.py', icon: <Code2 className="h-3.5 w-3.5" /> },
    { id: 'workspace', label: 'Workspace', icon: <FolderGit2 className="h-3.5 w-3.5" /> },
  ];

  const handleCurtainPointer = (clientX: number) => {
    const el = splitContainerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setSplitPercent(Math.round(pct));
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const harnessCurlSnippet = `curl -X POST ${origin}/api/harness/submit \\
  -H "Content-Type: application/json" \\
  -d '{"modelSlug":"${activeModelSlug || 'my-model'}","group":"${harnessGroup}","bpyScript":"..."}'`;

  return (
    <aside
      aria-label="Blender Pipeline & AI Harness Workbench"
      className="atelier-surface animate-atelier-sheet fixed top-16 right-4 bottom-20 z-30 flex w-[452px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#EFECE6] px-4 py-3">
        <div>
          <h2 className="font-display text-[16px] font-medium tracking-[-0.01em] text-[#1C1B19]">
            Pipeline & AI Harness
          </h2>
          <p className="text-[11px] text-[#847E75]">
            {executionMode === 'local'
              ? `Local Blender Bridge · ${localBlenderEndpoint}`
              : isStaticSite
                ? 'Static GitHub Pages Mode'
                : ciStatus?.configured
                  ? `Synced · ${ciStatus.owner}/${ciStatus.repo}`
                  : 'Configure GITHUB_TOKEN & repo secrets for live sync'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close pipeline workbench"
          className="rounded-lg p-1.5 text-[#847E75] transition-colors hover:bg-[#F5F3EF] hover:text-[#1C1B19]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 4 Tabs (Zero Chatbox) */}
      <div className="grid grid-cols-4 gap-1 border-b border-[#EFECE6] bg-[#FAF9F6] p-1.5">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11.5px] font-medium transition-colors ${
                active
                  ? 'bg-white text-[#1C1B19] shadow-[0_1px_3px_rgba(28,27,25,0.08)]'
                  : 'text-[#6E6960] hover:text-[#1C1B19]'
              }`}
            >
              <span className={active ? 'text-[#2D5A4C]' : ''}>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: REAL-TIME AI HARNESS LOOP */}
      {activeTab === 'harness' && (
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="rounded-xl border border-[#DCE8E2] bg-[#F4F9F6] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-[#1D4438]">
                <Radio className="h-4 w-4 text-[#2D5A4C]" />
                Real-Time Harness Loop
              </div>
              <button
                type="button"
                onClick={onToggleHarnessAutoSync}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  harnessAutoSync
                    ? 'bg-[#2D5A4C] text-white'
                    : 'border border-[#C9DBD3] bg-white text-[#5A564F]'
                }`}
              >
                {harnessAutoSync ? 'Auto-Sync ON (12s)' : 'Auto-Sync Off'}
              </button>
            </div>
            <p className="text-[11.5px] leading-relaxed text-[#4C5C56]">
              External AI harnesses submit models or <span className="font-mono">build.py</span> to{' '}
              <span className="font-mono">models/&lt;slug&gt;/</span>, read{' '}
              <span className="font-mono">screenshots/latest_*.png</span> +{' '}
              <span className="font-mono">manifest.json</span>, and reform geometry in real time.
            </p>
            <button
              type="button"
              onClick={onOpenAgentManual}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#C9DBD3] bg-white px-2.5 py-1 text-[11px] font-medium text-[#1D4438] transition-colors hover:bg-[#EBF2EF]"
            >
              <BookOpen className="h-3.5 w-3.5 text-[#2D5A4C]" />
              Open AGENTS.md Operating Manual
            </button>
          </div>

          {/* Active Model Subfolder Target */}
          <div className="rounded-xl border border-[#ECE8E1] bg-white p-3.5 space-y-2.5">
            <div className="text-[11px] font-semibold tracking-[0.04em] text-[#5A564F] uppercase">
              Active Model Asset Subfolder
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <input
                  type="text"
                  value={activeModelSlug}
                  onChange={(e) => onActiveModelSlugChange(e.target.value)}
                  placeholder="stone-cedar-lantern"
                  aria-label="Active model slug"
                  className="w-full rounded-lg border border-[#E2DDD4] bg-[#FAF9F6] px-2.5 py-1.5 font-mono text-[12px] text-[#1C1B19] outline-none focus:border-[#2D5A4C] focus:bg-white"
                />
              </div>
              <select
                value={harnessGroup}
                onChange={(e) => setHarnessGroup(e.target.value as ModelGroupName)}
                aria-label="Model group"
                className="rounded-lg border border-[#E2DDD4] bg-[#FAF9F6] px-2 py-1.5 text-[11.5px] text-[#1C1B19] outline-none focus:border-[#2D5A4C]"
              >
                <option value="Props">Props</option>
                <option value="Architecture">Architecture</option>
                <option value="Environment">Environment</option>
                <option value="World_Assemblies">Worlds</option>
              </select>
            </div>
            <div className="font-mono text-[10.5px] text-[#6E6960]">
              Repo Path: <span className="text-[#2D5A4C]">models/{activeModelSlug || 'asset'}/</span>
            </div>

            <div className="grid grid-cols-1 gap-2 pt-1">
              <button
                type="button"
                disabled={isHarnessBusy || !githubConfigured}
                onClick={async () => {
                  setIsHarnessBusy(true);
                  try {
                    await onSaveBundleToGithub(harnessGroup);
                  } finally {
                    setIsHarnessBusy(false);
                  }
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#2D5A4C] px-3 py-2 text-[12px] font-medium text-white transition-colors hover:bg-[#22453A] disabled:opacity-45"
              >
                {isHarnessBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CloudUpload className="h-3.5 w-3.5" />
                )}
                Save Model + Textures + 4-Angle Screenshots to GitHub
              </button>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={isHarnessBusy || !githubConfigured}
                  onClick={async () => {
                    setIsHarnessBusy(true);
                    try {
                      await onCaptureAndStoreScreenshots();
                    } finally {
                      setIsHarnessBusy(false);
                    }
                  }}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-[#D8D3CA] bg-[#FAF9F6] px-2.5 py-1.5 text-[11.5px] font-medium text-[#1C1B19] hover:bg-white disabled:opacity-45"
                >
                  <Camera className="h-3.5 w-3.5 text-[#2D5A4C]" />
                  Push 4-Angle Shots
                </button>
                <button
                  type="button"
                  disabled={isHarnessBusy || isStaticSite}
                  onClick={async () => {
                    setIsHarnessBusy(true);
                    try {
                      await onSyncHarnessNow();
                    } finally {
                      setIsHarnessBusy(false);
                    }
                  }}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-[#D8D3CA] bg-[#FAF9F6] px-2.5 py-1.5 text-[11.5px] font-medium text-[#1C1B19] hover:bg-white disabled:opacity-45"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-[#2D5A4C]" />
                  Pull Latest Build
                </button>
              </div>
            </div>
          </div>

          {/* Harness REST API Contract for AI Studio / External Agents */}
          <div className="rounded-xl border border-[#ECE8E1] bg-[#FAF9F6] p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-[0.04em] text-[#5A564F] uppercase">
                External AI Harness Endpoints
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(harnessCurlSnippet).catch(() => {});
                  onNotify('Copied Harness API curl snippet');
                }}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2D5A4C] hover:underline"
              >
                <Copy className="h-3 w-3" />
                Copy cURL
              </button>
            </div>
            <div className="space-y-1.5 font-mono text-[10.5px] text-[#5A564F]">
              <div className="rounded-md border border-[#EAE5DC] bg-white px-2.5 py-1.5">
                <span className="font-semibold text-[#2D5A4C]">POST</span> /api/harness/submit
                <div className="mt-0.5 font-sans text-[10.5px] text-[#847E75]">
                  Upload model/build.py + screenshots to GitHub & trigger CI reform
                </div>
              </div>
              <div className="rounded-md border border-[#EAE5DC] bg-white px-2.5 py-1.5">
                <span className="font-semibold text-[#436B95]">GET</span>{' '}
                /api/harness/models/{activeModelSlug || ':slug'}?includeBase64=1
                <div className="mt-0.5 font-sans text-[10.5px] text-[#847E75]">
                  Returns manifest, build.py, textures, & all stored screenshots for vision inspection
                </div>
              </div>
              <div className="rounded-md border border-[#EAE5DC] bg-white px-2.5 py-1.5">
                <span className="font-semibold text-[#2D5A4C]">POST</span>{' '}
                /api/harness/models/{activeModelSlug || ':slug'}/screenshots
                <div className="mt-0.5 font-sans text-[10.5px] text-[#847E75]">
                  Stores captured multi-angle PNG screenshots inside model assets
                </div>
              </div>
            </div>
          </div>

          {/* Live Activity Feed */}
          <div className="rounded-xl border border-[#ECE8E1] bg-white p-3.5 space-y-2">
            <div className="text-[11px] font-semibold tracking-[0.04em] text-[#5A564F] uppercase">
              Recent Harness & Sync Events
            </div>
            {harnessActivities.length === 0 ? (
              <p className="text-[11.5px] text-[#847E75]">
                No sync events yet. Capture 4-angle screenshots or save a model bundle to begin.
              </p>
            ) : (
              <div className="max-h-40 space-y-1.5 overflow-y-auto">
                {harnessActivities.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-[#EFECE6] bg-[#FAF9F6] px-2.5 py-2 text-[11px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[#1C1B19]">{item.title}</span>
                      <span className="font-mono text-[10px] text-[#847E75]">{item.timestamp}</span>
                    </div>
                    <div className="mt-0.5 text-[#5A564F]">{item.detail}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: REAL MULTI-ANGLE VISION QA (ZERO FAKE PLACEHOLDERS) */}
      {activeTab === 'vision' && (
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {/* Capture / Fetch Controls */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={onCaptureMultiAngleSheet}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-[#2D5A4C] px-3 py-2 text-[11.5px] font-medium text-white transition-colors hover:bg-[#22453A]"
            >
              <Camera className="h-3.5 w-3.5" />
              Capture 4-Angle Sheet
            </button>
            <button
              type="button"
              disabled={isStaticSite}
              onClick={onFetchCyclesCiRenders}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-[#D8D3CA] bg-white px-3 py-2 text-[11.5px] font-medium text-[#1C1B19] transition-colors hover:bg-[#F5F3EF] disabled:opacity-45"
            >
              <RefreshCw className="h-3.5 w-3.5 text-[#2D5A4C]" />
              Load Cycles CI Renders
            </button>
          </div>

          {/* Real Captured Multi-Angle Filmstrip */}
          {realCaptures.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#D8D3CA] bg-[#FAF9F6] p-5 text-center">
              <Camera className="mx-auto h-6 w-6 text-[#847E75]" />
              <div className="mt-2 text-[12.5px] font-medium text-[#1C1B19]">
                No Real Captures Yet
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-[#6E6960]">
                Click <span className="font-medium text-[#1C1B19]">Capture 4-Angle Sheet</span> to
                render live Hero, Front, Side, and Top screenshots directly from your 3D viewport,
                or load Cycles CPU renders from GitHub CI.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-medium text-[#5A564F]">
                  <span>Real Captured Angles ({realCaptures.length})</span>
                  <button
                    type="button"
                    onClick={onCaptureAndStoreScreenshots}
                    className="inline-flex items-center gap-1 text-[#2D5A4C] hover:underline"
                  >
                    <CloudUpload className="h-3 w-3" />
                    Save latest_*.png to Repo
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {realCaptures.slice(0, 8).map((shot) => {
                    const isA = captureA?.id === shot.id;
                    const isB = captureB?.id === shot.id;
                    return (
                      <button
                        key={shot.id}
                        type="button"
                        onClick={() => {
                          if (!isA) onCompareAIdChange(shot.id);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          onCompareBIdChange(shot.id);
                        }}
                        title={`${shot.label} (${shot.source}) — Click for Slot A`}
                        className={`group relative overflow-hidden rounded-lg border text-left transition-all ${
                          isA
                            ? 'border-[#2D5A4C] ring-1 ring-[#2D5A4C]'
                            : isB
                              ? 'border-[#436B95] ring-1 ring-[#436B95]'
                              : 'border-[#E5E1DA]'
                        }`}
                      >
                        <img
                          src={shot.dataUrl}
                          alt={shot.label}
                          className="aspect-[4/3] w-full object-cover"
                        />
                        <div className="truncate bg-white/95 px-1.5 py-0.5 font-mono text-[9.5px] text-[#1C1B19]">
                          {shot.label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Real Split-Curtain Comparison */}
              {captureA && captureB && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={captureA.id}
                      onChange={(e) => onCompareAIdChange(e.target.value)}
                      aria-label="Comparison Left Image"
                      className="rounded-lg border border-[#E2DDD4] bg-[#FAF9F6] px-2 py-1 text-[11px] text-[#1C1B19] outline-none focus:border-[#2D5A4C]"
                    >
                      {realCaptures.map((c) => (
                        <option key={c.id} value={c.id}>
                          Left: {c.label} ({c.source})
                        </option>
                      ))}
                    </select>
                    <select
                      value={captureB.id}
                      onChange={(e) => onCompareBIdChange(e.target.value)}
                      aria-label="Comparison Right Image"
                      className="rounded-lg border border-[#E2DDD4] bg-[#FAF9F6] px-2 py-1 text-[11px] text-[#1C1B19] outline-none focus:border-[#2D5A4C]"
                    >
                      {realCaptures.map((c) => (
                        <option key={c.id} value={c.id}>
                          Right: {c.label} ({c.source})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div
                    ref={splitContainerRef}
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      handleCurtainPointer(e.clientX);
                    }}
                    onPointerMove={(e) => {
                      if (e.buttons === 1) handleCurtainPointer(e.clientX);
                    }}
                    className="relative aspect-[4/3] w-full cursor-ew-resize select-none overflow-hidden rounded-xl border border-[#E5E1DA] bg-[#ECEAE4]"
                  >
                    <img
                      src={captureB.dataUrl}
                      alt={captureB.label}
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={{ clipPath: `inset(0 ${100 - splitPercent}% 0 0)` }}
                    >
                      <img
                        src={captureA.dataUrl}
                        alt={captureA.label}
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    </div>
                    <div
                      className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(28,27,25,0.45)]"
                      style={{ left: `${splitPercent}%` }}
                    >
                      <div className="absolute top-1/2 left-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#E5E1DA] bg-white text-[10px] font-semibold text-[#1C1B19] shadow-sm">
                        ↔
                      </div>
                    </div>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={splitPercent}
                    onChange={(e) => setSplitPercent(Number(e.target.value))}
                    aria-label="Compare left and right real captures"
                    className="atelier-range w-full"
                  />
                </div>
              )}
            </>
          )}

          {/* Real Multi-Angle Gemini Vision Critique & Reform Trigger */}
          <div className="space-y-2">
            {!geminiConfigured && !isStaticSite && (
              <div className="rounded-lg border border-[#EFE2C6] bg-[#FCF8EE] px-3 py-2 text-[11px] text-[#7D5516]">
                Configure <span className="font-mono">GEMINI_API_KEY</span> to enable automated
                multi-angle geometry critique & script reform.
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isVisionRunning || isStaticSite || realCaptures.length === 0}
                onClick={onRunVisionAudit}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1C1B19] px-3.5 py-2 text-[12px] font-medium text-white transition-colors hover:bg-[#2D5A4C] disabled:opacity-45"
              >
                {isVisionRunning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Inspect Real Captures ({Math.min(4, realCaptures.length)} Angles)
              </button>
              {visionCritique?.refinedScript && (
                <button
                  type="button"
                  disabled={isBuildRunning}
                  onClick={onApplyVisionPass2}
                  className="rounded-xl border border-[#2D5A4C] bg-[#F2F8F5] px-3 py-2 text-[12px] font-medium text-[#22453A] transition-colors hover:bg-[#E4F0EB] disabled:opacity-45"
                >
                  Reform & Build
                </button>
              )}
            </div>
          </div>

          {visionCritique && (
            <div className="space-y-3">
              <div className="rounded-xl border border-[#ECE8E1] bg-[#FAF9F6] p-3.5 text-[12px] leading-relaxed text-[#1C1B19]">
                {visionCritique.summary}
              </div>

              <div className="space-y-2">
                {visionCritique.defects.map((defect, idx) => (
                  <div
                    key={`${defect.area}-${idx}`}
                    className="rounded-xl border border-[#EAE5DC] bg-white p-3 text-[11.5px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#1C1B19]">{defect.area}</span>
                      <span
                        className={`font-mono text-[10px] uppercase ${
                          defect.severity === 'high'
                            ? 'text-[#A8383B]'
                            : defect.severity === 'medium'
                              ? 'text-[#9A6316]'
                              : 'text-[#2D5A4C]'
                        }`}
                      >
                        {defect.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-[#5A564F]">{defect.finding}</p>
                    <p className="mt-1.5 text-[#22453A]">Fix: {defect.fix}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SCRIPTS/BUILD.PY */}
      {activeTab === 'script' && (
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4">
          <div
            className={`rounded-xl border px-3.5 py-2.5 text-[11.5px] ${
              scriptReport.valid
                ? 'border-[#CFE2DA] bg-[#F2F8F5] text-[#22453A]'
                : 'border-[#F0D0D1] bg-[#FDF4F4] text-[#9E3134]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 font-medium">
                {scriptReport.valid ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5" />
                )}
                {scriptReport.valid ? 'Blender 4.2 LTS Ready' : scriptReport.errors[0]}
              </span>
              <button
                type="button"
                onClick={onResetStarterScript}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#5A564F] hover:text-[#1C1B19]"
              >
                <RotateCcw className="h-3 w-3" />
                Reset Starter
              </button>
            </div>
            {scriptReport.warnings.length > 0 && (
              <p className="mt-1 text-[11px] text-[#7D5516]">{scriptReport.warnings[0]}</p>
            )}
          </div>

          <textarea
            value={buildPyCode}
            onChange={(e) => onBuildPyChange(e.target.value)}
            spellCheck={false}
            aria-label="scripts/build.py Python editor"
            className="min-h-0 flex-1 resize-none rounded-xl border border-[#E2DDD4] bg-[#FCFBF9] p-3 font-mono text-[11.5px] leading-relaxed text-[#1C1B19] outline-none focus:border-[#2D5A4C] focus:bg-white"
          />

          <div className="space-y-2">
            <input
              type="text"
              value={commitNote}
              onChange={(e) => onCommitNoteChange(e.target.value)}
              placeholder="Commit note (e.g. Refine cedar lantern eaves)"
              className="w-full rounded-lg border border-[#E2DDD4] bg-white px-3 py-1.5 text-[12px] text-[#1C1B19] outline-none focus:border-[#2D5A4C]"
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={
                  isBuildRunning || !scriptReport.valid || (executionMode === 'cloud' && isStaticSite)
                }
                onClick={onCommitAndBuild}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#2D5A4C] px-3.5 py-2 text-[12px] font-medium text-white transition-colors hover:bg-[#22453A] disabled:opacity-45"
              >
                {isBuildRunning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <GitCommit className="h-3.5 w-3.5" />
                )}
                {executionMode === 'local'
                  ? 'Run on Local Blender'
                  : 'Commit & Build via Cloud CI'}
              </button>

              {!isStaticSite && (
                <button
                  type="button"
                  onClick={onRefreshCiStatus}
                  aria-label="Refresh CI status"
                  className="rounded-xl border border-[#DCD7CE] bg-white p-2 text-[#5A564F] transition-colors hover:bg-[#F5F3EF] hover:text-[#1C1B19]"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              )}
            </div>

            {ciStatus?.pagesUrl && (
              <div className="flex items-center justify-between text-[11px] text-[#6E6960]">
                <span>GitHub Pages Deployment</span>
                <a
                  href={ciStatus.pagesUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-[#2D5A4C] hover:underline"
                >
                  Open Live Site <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: GITHUB-SYNCED WORKSPACE & SYSTEM SKILL */}
      {activeTab === 'workspace' && (
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {/* Execution Pipeline Switch */}
          <div className="space-y-2.5 rounded-xl border border-[#ECE8E1] bg-[#FAF9F6] p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.04em] text-[#5A564F] uppercase">
                <Shield className="h-3.5 w-3.5 text-[#2D5A4C]" />
                Execution Target
              </div>
              <span className="font-mono text-[10.5px] text-[#6E6960]">
                {executionMode === 'cloud' ? 'GitHub Actions CI' : 'Local 2FA'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => onRequestExecutionMode('cloud')}
                className={`rounded-lg border py-2 text-[11.5px] font-medium transition-colors ${
                  executionMode === 'cloud'
                    ? 'border-[#2D5A4C] bg-[#2D5A4C] text-white'
                    : 'border-[#DCD7CE] bg-white text-[#5A564F] hover:text-[#1C1B19]'
                }`}
              >
                Cloud GitHub CI
              </button>
              <button
                type="button"
                onClick={() => onRequestExecutionMode('local')}
                className={`rounded-lg border py-2 text-[11.5px] font-medium transition-colors ${
                  executionMode === 'local'
                    ? 'border-[#2D5A4C] bg-[#2D5A4C] text-white'
                    : 'border-[#DCD7CE] bg-white text-[#5A564F] hover:text-[#1C1B19]'
                }`}
              >
                Local Blender (2FA)
              </button>
            </div>
          </div>

          {/* Live GitHub Repository Workspace Explorer */}
          <div className="space-y-2.5 rounded-xl border border-[#ECE8E1] bg-white p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <FolderGit2 className="h-3.5 w-3.5 text-[#2D5A4C]" />
                <span className="text-[11px] font-semibold tracking-[0.04em] text-[#5A564F] uppercase">
                  {workspaceSyncedSource === 'github'
                    ? 'GitHub Repo Sync'
                    : workspaceSyncedSource === 'local'
                      ? `Local: ${localFolderName}`
                      : 'Starter Workspace'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {githubConfigured && (
                  <button
                    type="button"
                    disabled={isWorkspaceLoading}
                    onClick={onRefreshGithubWorkspace}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2D5A4C] hover:underline disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${isWorkspaceLoading ? 'animate-spin' : ''}`}
                    />
                    Sync GitHub
                  </button>
                )}
                {fsSupported && (
                  <button
                    type="button"
                    onClick={onLinkLocalFolder}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#5A564F] hover:text-[#1C1B19]"
                  >
                    <FolderOpen className="h-3 w-3" />
                    Local PC
                  </button>
                )}
              </div>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#847E75]" />
              <input
                type="text"
                value={workspaceQuery}
                onChange={(e) => setWorkspaceQuery(e.target.value)}
                placeholder="Filter repo files (e.g. models/, scripts/)..."
                className="w-full rounded-lg border border-[#E5E1DA] bg-[#FAF9F6] py-1.5 pr-3 pl-8 text-[11.5px] text-[#1C1B19] outline-none focus:border-[#2D5A4C] focus:bg-white"
              />
            </div>

            <div className="max-h-40 overflow-y-auto rounded-lg border border-[#EFECE6] bg-[#FCFBF9] p-1">
              {filteredWorkspaceFiles.length === 0 ? (
                <div className="px-3 py-4 text-center text-[11px] text-[#847E75]">
                  No matching files in workspace.
                </div>
              ) : (
                filteredWorkspaceFiles.slice(0, 120).map((f) => (
                  <button
                    key={f.path}
                    type="button"
                    onClick={() => onSelectWorkspaceFile(f.path)}
                    className={`flex w-full items-center justify-between rounded-md px-2.5 py-1 text-left font-mono text-[10.5px] transition-colors ${
                      selectedFilePath === f.path
                        ? 'bg-[#EBF2EF] font-medium text-[#1D4438]'
                        : 'text-[#5A564F] hover:bg-[#F2EFE9] hover:text-[#1C1B19]'
                    }`}
                  >
                    <span className="truncate">{f.path}</span>
                    <span className="ml-2 shrink-0 text-[9.5px] text-[#847E75] tabular-nums">
                      {f.size > 0 ? `${Math.max(1, Math.round(f.size / 1024))}KB` : ''}
                    </span>
                  </button>
                ))
              )}
            </div>

            {selectedFilePath && (
              <div className="space-y-2 border-t border-[#EFECE6] pt-2.5">
                <div className="flex items-center justify-between">
                  <span className="truncate font-mono text-[11px] font-medium text-[#1C1B19]">
                    {selectedFilePath}
                  </span>
                </div>
                <textarea
                  rows={6}
                  value={selectedFileContent}
                  onChange={(e) => onSelectedFileContentChange(e.target.value)}
                  spellCheck={false}
                  aria-label="Workspace file content editor"
                  className="w-full resize-y rounded-lg border border-[#E2DDD4] bg-[#FAF9F6] p-2.5 font-mono text-[10.5px] leading-relaxed text-[#1C1B19] outline-none focus:border-[#2D5A4C] focus:bg-white"
                />
                {githubConfigured && (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={fileCommitMsg}
                      onChange={(e) => setFileCommitMsg(e.target.value)}
                      placeholder={`Update ${selectedFilePath}`}
                      className="min-w-0 flex-1 rounded-lg border border-[#E2DDD4] bg-white px-2.5 py-1 text-[11.5px] outline-none focus:border-[#2D5A4C]"
                    />
                    <button
                      type="button"
                      disabled={isSavingFile}
                      onClick={async () => {
                        setIsSavingFile(true);
                        try {
                          await onCommitWorkspaceFileToGithub(
                            selectedFilePath,
                            selectedFileContent,
                            fileCommitMsg.trim() || `Update ${selectedFilePath} from BlendFactory`
                          );
                          setFileCommitMsg('');
                        } finally {
                          setIsSavingFile(false);
                        }
                      }}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#2D5A4C] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[#22453A] disabled:opacity-45"
                    >
                      {isSavingFile ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="h-3 w-3" />
                      )}
                      Commit to GitHub
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Persistent Blender 4.2 System Skill */}
          <div className="space-y-2 rounded-xl border border-[#ECE8E1] bg-white p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.04em] text-[#5A564F] uppercase">
                <Wrench className="h-3.5 w-3.5 text-[#2D5A4C]" />
                Blender 4.2 System Skill
              </div>
              <button
                type="button"
                onClick={onResetSystemSkill}
                className="text-[11px] font-medium text-[#2D5A4C] hover:underline"
              >
                Reset Default
              </button>
            </div>
            <textarea
              rows={6}
              value={systemSkill}
              onChange={(e) => onSystemSkillChange(e.target.value)}
              aria-label="Blender 4.2 System Skill prompt"
              className="w-full resize-y rounded-lg border border-[#E2DDD4] bg-[#FCFBF9] p-2.5 font-mono text-[11px] leading-relaxed text-[#1C1B19] outline-none focus:border-[#2D5A4C] focus:bg-white"
            />
          </div>
        </div>
      )}
    </aside>
  );
};
