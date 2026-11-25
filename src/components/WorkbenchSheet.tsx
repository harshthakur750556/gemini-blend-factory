import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Code2,
  ExternalLink,
  Eye,
  FolderOpen,
  GitCommit,
  Loader2,
  RefreshCw,
  RotateCcw,
  Send,
  Shield,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import { validateBlenderScript } from '../utils/blenderSkill';
import { DiffApprovalCard } from './DiffApprovalCard';
import type {
  ChatMessageItem,
  ExecutionMode,
  GitHubCiStatus,
  PendingDiffProposal,
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
  executionMode: ExecutionMode;
  localBlenderEndpoint: string;
  ciStatus: GitHubCiStatus | null;
  chatMessages: ChatMessageItem[];
  pendingDiffs: Record<string, PendingDiffProposal>;
  isAgentBusy: boolean;
  onSendPrompt: (prompt: string) => void;
  onApproveDiff: (proposalId: string) => void;
  onRejectDiff: (proposalId: string) => void;
  pass1PreviewUrl: string;
  pass2PreviewUrl: string;
  visionCritique: VisionCritiqueResult | null;
  isVisionRunning: boolean;
  onRunVisionAudit: () => void;
  onApplyVisionPass2: () => void;
  buildPyCode: string;
  commitNote: string;
  isBuildRunning: boolean;
  onBuildPyChange: (code: string) => void;
  onCommitNoteChange: (note: string) => void;
  onResetStarterScript: () => void;
  onCommitAndBuild: () => void;
  onRefreshCiStatus: () => void;
  localFolderName: string | null;
  fsSupported: boolean;
  workspaceFiles: WorkspaceFileEntry[];
  selectedFilePath: string | null;
  selectedFileContent: string;
  onLinkLocalFolder: () => void;
  onSelectWorkspaceFile: (path: string) => void;
  onRequestExecutionMode: (mode: ExecutionMode) => void;
  systemSkill: string;
  onSystemSkillChange: (val: string) => void;
  onResetSystemSkill: () => void;
}

const STARTER_PROMPTS = [
  'Refine the Stone & Cedar Lantern with curved pagoda eaves and carved bronze brackets.',
  'Generate a minimal travertine courtyard bench with chamfered joinery in Blender 4.2.',
  'Inspect scripts/build.py and optimize bevel segments and material roughness contrast.',
];

export const WorkbenchSheet: React.FC<WorkbenchSheetProps> = ({
  open,
  activeTab,
  onTabChange,
  onClose,
  isStaticSite,
  geminiConfigured,
  executionMode,
  localBlenderEndpoint,
  ciStatus,
  chatMessages,
  pendingDiffs,
  isAgentBusy,
  onSendPrompt,
  onApproveDiff,
  onRejectDiff,
  pass1PreviewUrl,
  pass2PreviewUrl,
  visionCritique,
  isVisionRunning,
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
  selectedFilePath,
  selectedFileContent,
  onLinkLocalFolder,
  onSelectWorkspaceFile,
  onRequestExecutionMode,
  systemSkill,
  onSystemSkillChange,
  onResetSystemSkill,
}) => {
  const [promptInput, setPromptInput] = useState('');
  const [splitPercent, setSplitPercent] = useState(50);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);

  const scriptReport = useMemo(() => validateBlenderScript(buildPyCode), [buildPyCode]);

  if (!open) return null;

  const tabs: Array<{ id: WorkbenchTabId; label: string; icon: React.ReactNode }> = [
    { id: 'agent', label: 'AI Agent', icon: <Bot className="h-3.5 w-3.5" /> },
    { id: 'vision', label: 'Vision QA', icon: <Eye className="h-3.5 w-3.5" /> },
    { id: 'script', label: 'build.py', icon: <Code2 className="h-3.5 w-3.5" /> },
    { id: 'workspace', label: 'Workspace', icon: <FolderOpen className="h-3.5 w-3.5" /> },
  ];

  const handleSubmitChat = (e: React.FormEvent) => {
    e.preventDefault();
    const text = promptInput.trim();
    if (!text || isAgentBusy) return;
    setPromptInput('');
    onSendPrompt(text);
  };

  const handleCurtainPointer = (clientX: number) => {
    const el = splitContainerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setSplitPercent(Math.round(pct));
  };

  return (
    <aside
      aria-label="Blender Pipeline Workbench"
      className="atelier-surface animate-atelier-sheet fixed top-16 right-4 bottom-20 z-30 flex w-[430px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#EFECE6] px-4 py-3.5">
        <div>
          <h2 className="font-display text-[16px] font-medium tracking-[-0.01em] text-[#1C1B19]">
            Blender Pipeline
          </h2>
          <p className="text-[11px] text-[#847E75]">
            {executionMode === 'local'
              ? `Local Blender Bridge · ${localBlenderEndpoint}`
              : isStaticSite
                ? 'Static GitHub Pages Mode · Local Editing Ready'
                : ciStatus?.configured
                  ? `Cloud CI · ${ciStatus.owner}/${ciStatus.repo}`
                  : 'Cloud GitHub CI · Configure secrets to run remote builds'}
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

      {/* Tabs */}
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

      {/* TAB 1: AI AGENT */}
      {activeTab === 'agent' && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {isStaticSite && (
              <div className="rounded-xl border border-[#EAE5DC] bg-[#FAF9F6] p-3 text-[11.5px] leading-relaxed text-[#5A564F]">
                Running as a static GitHub Pages build. Server-backed Gemini Agent calls require the
                full-stack studio server; local script editing and 3D inspection remain fully active.
              </div>
            )}

            {!isStaticSite && !geminiConfigured && (
              <div className="rounded-xl border border-[#EFE2C6] bg-[#FCF8EE] p-3 text-[11.5px] leading-relaxed text-[#7D5516]">
                Configure <span className="font-mono">GEMINI_API_KEY</span> in environment secrets
                to enable the Blender 4.2 AI Builder Agent.
              </div>
            )}

            {chatMessages.length === 0 ? (
              <div className="space-y-3 pt-2">
                <div className="rounded-xl border border-[#ECE8E1] bg-[#FAF9F6] p-4">
                  <div className="font-display text-[15px] font-medium text-[#1C1B19]">
                    Blender 4.2 Technical Artist
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-[#5A564F]">
                    Describe an architectural prop, material revision, or procedural bmesh script.
                    The agent writes <span className="font-mono">scripts/build.py</span>, proposes
                    diffs for local workspace files, and runs Cloud CI builds.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[10.5px] font-semibold tracking-[0.04em] text-[#847E75] uppercase">
                    Suggested Prompts
                  </div>
                  {STARTER_PROMPTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      disabled={isAgentBusy}
                      onClick={() => onSendPrompt(p)}
                      className="block w-full rounded-xl border border-[#EAE5DC] bg-white px-3.5 py-2.5 text-left text-[12px] leading-relaxed text-[#1C1B19] transition-colors hover:border-[#2D5A4C] hover:bg-[#F5F9F7]"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              chatMessages.map((msg) => {
                const diffProposal = msg.diffProposalId ? pendingDiffs[msg.diffProposalId] : null;
                return (
                  <div
                    key={msg.id}
                    className={`rounded-xl border px-3.5 py-3 text-[12px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'ml-6 border-[#D6E4DD] bg-[#F2F8F5] text-[#1C1B19]'
                        : msg.error
                          ? 'border-[#F0D0D1] bg-[#FDF4F4] text-[#9E3134]'
                          : 'border-[#ECE8E1] bg-[#FAF9F6] text-[#1C1B19]'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between text-[10px] text-[#847E75]">
                      <span className="font-semibold uppercase">
                        {msg.role === 'user' ? 'You' : msg.role === 'system' ? 'Pipeline' : 'Builder Agent'}
                      </span>
                      <span className="font-mono tabular-nums">{msg.timestamp}</span>
                    </div>

                    {msg.text && <div className="whitespace-pre-wrap">{msg.text}</div>}
                    {msg.error && <div className="mt-1 font-medium">{msg.error}</div>}

                    {msg.toolTraces && msg.toolTraces.length > 0 && (
                      <div className="mt-2.5 space-y-1.5 border-t border-[#EAE5DC] pt-2">
                        {msg.toolTraces.map((trace) => (
                          <div
                            key={trace.id}
                            className="flex items-start justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[11px]"
                          >
                            <div className="min-w-0">
                              <span className="font-mono font-medium text-[#2D5A4C]">
                                {trace.name}
                              </span>
                              <div className="truncate text-[10.5px] text-[#6E6960]">
                                {trace.summary}
                              </div>
                            </div>
                            <span className="shrink-0 text-[10px] capitalize text-[#847E75]">
                              {trace.status.replace('_', ' ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {msg.buildProgress && (
                      <div className="mt-2.5 rounded-lg border border-[#DCE8E2] bg-white px-3 py-2 text-[11px]">
                        <div className="flex items-center justify-between font-medium text-[#22453A]">
                          <span>{msg.buildProgress.stage.replace('_', ' ')}</span>
                          {msg.buildProgress.runUrl && (
                            <a
                              href={msg.buildProgress.runUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 underline"
                            >
                              Logs <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <div className="mt-0.5 text-[#5A564F]">{msg.buildProgress.detail}</div>
                      </div>
                    )}

                    {diffProposal && (
                      <DiffApprovalCard
                        proposal={diffProposal}
                        isBusy={isAgentBusy}
                        onApprove={onApproveDiff}
                        onReject={onRejectDiff}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>

          <form
            onSubmit={handleSubmitChat}
            className="border-t border-[#EFECE6] bg-[#FAF9F6] p-3"
          >
            <div className="flex items-end gap-2">
              <textarea
                rows={2}
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitChat(e);
                  }
                }}
                placeholder="Ask the Blender 4.2 agent to model or refine..."
                className="flex-1 resize-none rounded-xl border border-[#DFDAD0] bg-white px-3 py-2 text-[12px] text-[#1C1B19] outline-none transition-colors focus:border-[#2D5A4C]"
              />
              <button
                type="submit"
                disabled={isAgentBusy || !promptInput.trim()}
                aria-label="Send prompt"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2D5A4C] text-white transition-colors hover:bg-[#22453A] disabled:opacity-45"
              >
                {isAgentBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: CYCLES VISION QA */}
      {activeTab === 'vision' && (
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-medium text-[#5A564F]">
              <span>Pass 1 · Initial Cycles Render</span>
              <span>Pass 2 · Refined Geometry</span>
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
                src={pass2PreviewUrl}
                alt="Cycles Render Pass 2"
                className="h-full w-full object-cover"
                draggable={false}
              />
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 ${100 - splitPercent}% 0 0)` }}
              >
                <img
                  src={pass1PreviewUrl}
                  alt="Cycles Render Pass 1"
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
              aria-label="Compare Pass 1 and Pass 2 renders"
              className="atelier-range w-full"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isVisionRunning || isStaticSite}
              onClick={onRunVisionAudit}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#2D5A4C] px-3.5 py-2 text-[12px] font-medium text-white transition-colors hover:bg-[#22453A] disabled:opacity-45"
            >
              {isVisionRunning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Run Vision Audit
            </button>
            {visionCritique?.refinedScript && (
              <button
                type="button"
                disabled={isBuildRunning}
                onClick={onApplyVisionPass2}
                className="rounded-xl border border-[#2D5A4C] bg-[#F2F8F5] px-3 py-2 text-[12px] font-medium text-[#22453A] transition-colors hover:bg-[#E4F0EB] disabled:opacity-45"
              >
                Apply Pass 2
              </button>
            )}
          </div>

          {visionCritique ? (
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
          ) : (
            <div className="rounded-xl border border-dashed border-[#DDD8CF] bg-[#FAF9F6] p-4 text-[12px] text-[#6E6960]">
              Drag the curtain above to inspect Pass 1 vs Pass 2 Cycles CPU renders, or run an
              automated Gemini Vision audit to generate a refined Pass 2 geometry script.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SCRIPTS/BUILD.PY */}
      {activeTab === 'script' && (
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4">
          {/* Validator Summary */}
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

          {/* Code Editor */}
          <textarea
            value={buildPyCode}
            onChange={(e) => onBuildPyChange(e.target.value)}
            spellCheck={false}
            aria-label="scripts/build.py Python editor"
            className="min-h-0 flex-1 resize-none rounded-xl border border-[#E2DDD4] bg-[#FCFBF9] p-3 font-mono text-[11.5px] leading-relaxed text-[#1C1B19] outline-none focus:border-[#2D5A4C] focus:bg-white"
          />

          {/* Commit Note & Build Trigger */}
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
                disabled={isBuildRunning || !scriptReport.valid || (executionMode === 'cloud' && isStaticSite)}
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

      {/* TAB 4: WORKSPACE & SYSTEM SKILL */}
      {activeTab === 'workspace' && (
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {/* Execution Pipeline Switch */}
          <div className="rounded-xl border border-[#ECE8E1] bg-[#FAF9F6] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.04em] text-[#5A564F] uppercase">
                <Shield className="h-3.5 w-3.5 text-[#2D5A4C]" />
                Execution Target
              </div>
              <span className="font-mono text-[10.5px] text-[#6E6960]">
                {executionMode === 'cloud' ? 'Isolated CI' : 'Local 2FA'}
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

          {/* Local Folder Explorer */}
          <div className="rounded-xl border border-[#ECE8E1] bg-white p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-[0.04em] text-[#5A564F] uppercase">
                Workspace Files
              </span>
              {fsSupported && (
                <button
                  type="button"
                  onClick={onLinkLocalFolder}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2D5A4C] hover:underline"
                >
                  <FolderOpen className="h-3 w-3" />
                  {localFolderName ? `Linked: ${localFolderName}` : 'Link Local Folder'}
                </button>
              )}
            </div>

            <div className="max-h-36 overflow-y-auto rounded-lg border border-[#EFECE6] bg-[#FCFBF9] p-1">
              {workspaceFiles.map((f) => (
                <button
                  key={f.path}
                  type="button"
                  onClick={() => onSelectWorkspaceFile(f.path)}
                  className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left font-mono text-[11px] transition-colors ${
                    selectedFilePath === f.path
                      ? 'bg-[#EBF2EF] font-medium text-[#1D4438]'
                      : 'text-[#5A564F] hover:bg-[#F2EFE9] hover:text-[#1C1B19]'
                  }`}
                >
                  <span className="truncate">{f.path}</span>
                  <span className="ml-2 shrink-0 text-[10px] text-[#847E75] tabular-nums">
                    {f.size > 0 ? `${Math.max(1, Math.round(f.size / 1024))}KB` : ''}
                  </span>
                </button>
              ))}
            </div>

            {selectedFilePath && (
              <pre className="max-h-36 overflow-auto rounded-lg border border-[#EFECE6] bg-[#FAF9F6] p-2.5 font-mono text-[10.5px] leading-relaxed text-[#5A564F]">
                {selectedFileContent.slice(0, 4000)}
              </pre>
            )}
          </div>

          {/* Persistent Blender 4.2 System Skill */}
          <div className="rounded-xl border border-[#ECE8E1] bg-white p-3.5 space-y-2">
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
              rows={7}
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
