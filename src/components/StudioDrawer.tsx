import React, { useMemo, useState } from 'react';
import type {
  ChatMessageItem,
  ExecutionMode,
  GitHubCiStatus,
  PendingDiffProposal,
  ServerConfig,
  StudioDrawerTabId,
  VisionCritiqueResult,
  WorkspaceFileEntry,
} from '../types';
import { validateBlenderScript } from '../utils/blenderSkill';
import { DiffApprovalCard } from './DiffApprovalCard';

interface StudioDrawerProps {
  open: boolean;
  activeTab: StudioDrawerTabId;
  onTabChange: (tab: StudioDrawerTabId) => void;
  onClose: () => void;
  mode: ExecutionMode;
  localEndpoint: string;
  localOfflineBanner: string | null;
  serverConfig: ServerConfig | null;
  ciStatus: GitHubCiStatus | null;
  // Chat & Agent
  messages: ChatMessageItem[];
  chatBusy: boolean;
  onSendMessage: (prompt: string) => Promise<void>;
  diffProposals: Record<string, PendingDiffProposal>;
  onApproveDiff: (id: string) => Promise<void>;
  onRejectDiff: (id: string) => void;
  // Vision QA
  pass1ImageUrl: string;
  pass2ImageUrl: string;
  latestVisionCritique: VisionCritiqueResult | null;
  visionBusy: boolean;
  onRunVisionCritique: () => Promise<void>;
  onApplyPass2Script: (script: string, note: string) => Promise<void>;
  // Script Studio
  buildPy: string;
  onBuildPyChange: (next: string) => void;
  buildBusy: boolean;
  onRunBuildPy: (commitNote: string) => Promise<void>;
  onResetStarterPy: () => void;
  // Local Files & Blender 4.2 Skill
  localFolderName: string | null;
  workspaceFiles: WorkspaceFileEntry[];
  selectedFilePath: string | null;
  onSelectFile: (path: string) => void;
  onLinkLocalFolder: () => Promise<void>;
  systemSkill: string;
  onSystemSkillChange: (next: string) => void;
  onResetSystemSkill: () => void;
}

const QUICK_PROMPTS = [
  'Design a beveled architectural titanium mechanical turret with chamfered armor seams and Principled BSDF.',
  'Inspect scripts/build.py in the workspace and add crisp bevel modifiers and brass fasteners.',
  'List all files in my linked local folder and summarize the Blender build pipeline.',
];

export const StudioDrawer: React.FC<StudioDrawerProps> = ({
  open,
  activeTab,
  onTabChange,
  onClose,
  mode,
  localEndpoint,
  localOfflineBanner,
  serverConfig,
  ciStatus,
  messages,
  chatBusy,
  onSendMessage,
  diffProposals,
  onApproveDiff,
  onRejectDiff,
  pass1ImageUrl,
  pass2ImageUrl,
  latestVisionCritique,
  visionBusy,
  onRunVisionCritique,
  onApplyPass2Script,
  buildPy,
  onBuildPyChange,
  buildBusy,
  onRunBuildPy,
  onResetStarterPy,
  localFolderName,
  workspaceFiles,
  selectedFilePath,
  onSelectFile,
  onLinkLocalFolder,
  systemSkill,
  onSystemSkillChange,
  onResetSystemSkill,
}) => {
  const [promptInput, setPromptInput] = useState('');
  const [commitNote, setCommitNote] = useState('Update scripts/build.py from Apex 3D Studio');
  const [splitPercent, setSplitPercent] = useState(50);

  const scriptReport = useMemo(() => validateBlenderScript(buildPy), [buildPy]);
  const selectedFile = useMemo(
    () => workspaceFiles.find((f) => f.path === selectedFilePath) || null,
    [workspaceFiles, selectedFilePath]
  );

  if (!open) return null;

  const submitChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = promptInput.trim();
    if (!trimmed || chatBusy) return;
    setPromptInput('');
    await onSendMessage(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/35"
      role="dialog"
      aria-modal="true"
      aria-label="Apex 3D Studio Workbench Drawer"
    >
      <div className="w-full max-w-2xl h-full bg-white border-l border-[#cbd5e1] shadow-2xl flex flex-col overflow-hidden">
        {/* Drawer Header */}
        <div className="h-12 bg-[#f8f9fa] border-b border-[#dcdfe4] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded bg-[#111318] text-white">
              <span className="material-symbols-outlined text-[15px]">terminal</span>
            </span>
            <span className="text-xs font-bold uppercase tracking-wide text-[#111318]">
              Studio Pipeline &amp; Blender 4.2 CI
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#f0f2f5] border border-[#dcdfe4] font-mono text-[10px] text-[#111318]">
              {mode === 'cloud' ? 'CLOUD CI' : 'LOCAL 2FA'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded hover:bg-[#e5e8ec] text-[#64748b] hover:text-black flex items-center justify-center cursor-pointer"
            aria-label="Close Studio Drawer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Drawer Sub-Tabs */}
        <div className="h-10 bg-white border-b border-[#dcdfe4] px-3 flex items-center gap-1 shrink-0 overflow-x-auto">
          {(
            [
              { id: 'agent', icon: 'smart_toy', label: 'AI Builder & Tools' },
              { id: 'vision', icon: 'compare', label: 'Cycles Vision QA' },
              { id: 'script', icon: 'code', label: 'build.py Script' },
              { id: 'workspace', icon: 'folder_open', label: 'Local Files & Skill' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`px-2.5 py-1 rounded text-[11px] flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#111318] text-white font-semibold shadow-sm'
                  : 'text-[#64748b] hover:text-black hover:bg-[#f0f2f5] font-medium'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {localOfflineBanner && mode === 'local' && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs font-mono">
            Local Backup Offline ({localEndpoint}): {localOfflineBanner}
          </div>
        )}

        {/* TAB 1: GEMINI AI AGENT & FUNCTION CALLING */}
        {activeTab === 'agent' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f8f9fa]">
              {messages.length === 0 ? (
                <div className="p-4 rounded-xl bg-white border border-[#dcdfe4] space-y-3">
                  <div className="text-xs font-bold text-[#111318]">
                    Autonomous Blender 4.2 LTS Modeling &amp; Local File Agent
                  </div>
                  <p className="text-xs text-[#64748b] leading-relaxed">
                    Invoke Gemini Function Calling (`build_blend_cloud`, `read_local_file`, `write_local_file`, `list_local_files`) to generate Blender 4.2 scripts, commit directly to GitHub Actions CI, and run Cycles Vision QA automatically.
                  </p>
                  <div className="space-y-1.5">
                    {QUICK_PROMPTS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => void onSendMessage(q)}
                        className="w-full text-left p-2 rounded-lg bg-[#f8f9fa] hover:bg-[#f0f2f5] border border-[#dcdfe4] text-[11px] text-[#111318] transition-colors cursor-pointer"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-xl p-3 border text-xs ${
                      msg.role === 'user'
                        ? 'bg-[#111318] text-white border-[#111318] ml-8'
                        : 'bg-white text-[#111318] border-[#dcdfe4] mr-4 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono opacity-70 mb-1">
                      <span className="uppercase font-bold">{msg.role}</span>
                      <span>{msg.timestamp}</span>
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>

                    {msg.toolTraces && msg.toolTraces.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {msg.toolTraces.map((tr) => (
                          <div
                            key={tr.id}
                            className="p-2 rounded bg-[#f8f9fa] border border-[#dcdfe4] font-mono text-[10px] text-[#111318]"
                          >
                            <div className="flex items-center justify-between font-semibold">
                              <span>{tr.name}</span>
                              <span className="uppercase text-[9px] text-[#64748b]">{tr.status}</span>
                            </div>
                            <div className="text-[#64748b] truncate">{tr.summary}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {msg.buildProgress && (
                      <div className="mt-2 p-2 rounded bg-[#f0f2f5] border border-[#cbd5e1] font-mono text-[10px] text-[#111318] space-y-1">
                        <div className="flex items-center justify-between font-semibold">
                          <span>CI Pipeline: {msg.buildProgress.stage}</span>
                          {msg.buildProgress.runUrl && (
                            <a
                              href={msg.buildProgress.runUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="underline"
                            >
                              View Run
                            </a>
                          )}
                        </div>
                        <div className="text-[#475569]">{msg.buildProgress.detail}</div>
                      </div>
                    )}

                    {msg.diffProposalId && diffProposals[msg.diffProposalId] && (
                      <DiffApprovalCard
                        proposal={diffProposals[msg.diffProposalId]}
                        onApprove={(id) => void onApproveDiff(id)}
                        onReject={onRejectDiff}
                      />
                    )}

                    {msg.error && (
                      <div className="mt-2 p-2 rounded bg-red-50 border border-red-200 text-red-700 font-mono text-[11px]">
                        {msg.error}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={(e) => void submitChat(e)}
              className="p-3 bg-white border-t border-[#dcdfe4] flex items-center gap-2 shrink-0"
            >
              <input
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="Describe a 3D Blender asset to build or a local file to edit..."
                className="flex-1 px-3 py-2 rounded-lg bg-[#f8f9fa] border border-[#dcdfe4] text-xs text-[#111318] focus:border-[#111318] focus:outline-none"
              />
              <button
                type="submit"
                disabled={chatBusy || !promptInput.trim()}
                className="px-4 py-2 rounded-lg bg-[#111318] hover:bg-black disabled:opacity-40 text-white text-xs font-semibold cursor-pointer"
              >
                {chatBusy ? 'Working...' : 'Run'}
              </button>
            </form>
          </div>
        )}

        {/* TAB 2: CYCLES VISION QA (PASS 1 VS PASS 2) */}
        {activeTab === 'vision' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f8f9fa]">
            <div className="bg-white rounded-xl border border-[#dcdfe4] p-3 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[#111318] uppercase tracking-wide">
                    Cycles CPU Render Comparison (Pass 1 vs Pass 2)
                  </h3>
                  <p className="text-[11px] text-[#64748b]">
                    Drag the split curtain to inspect bevels, silhouette proportions, and PBR roughness refinements.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={visionBusy}
                  onClick={() => void onRunVisionCritique()}
                  className="px-3 py-1.5 rounded-lg bg-[#111318] hover:bg-black disabled:opacity-40 text-white text-[11px] font-semibold cursor-pointer"
                >
                  {visionBusy ? 'Auditing...' : 'Run Vision Audit'}
                </button>
              </div>

              {/* Interactive Pass 1 / Pass 2 Comparison Curtain */}
              <div className="relative w-full aspect-square max-h-[340px] rounded-lg overflow-hidden border border-[#cbd5e1] bg-[#0f172a]">
                <img
                  src={pass2ImageUrl}
                  alt="Cycles Render Pass 2"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ clipPath: `inset(0 ${100 - splitPercent}% 0 0)` }}
                >
                  <img
                    src={pass1ImageUrl}
                    alt="Cycles Render Pass 1"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white shadow"
                  style={{ left: `${splitPercent}%` }}
                />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/75 text-white font-mono text-[10px]">
                  PASS 1
                </span>
                <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/75 text-white font-mono text-[10px]">
                  PASS 2
                </span>
              </div>

              <div className="flex items-center gap-2 text-[10px] font-mono text-[#64748b]">
                <span>PASS 1</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={splitPercent}
                  onChange={(e) => setSplitPercent(Number(e.target.value))}
                  className="flex-1 custom-range"
                />
                <span>PASS 2</span>
              </div>
            </div>

            {latestVisionCritique && (
              <div className="bg-white rounded-xl border border-[#dcdfe4] p-3.5 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#111318]">Gemini Vision QA Findings</span>
                  {latestVisionCritique.refinedScript && (
                    <button
                      type="button"
                      onClick={() =>
                        void onApplyPass2Script(
                          latestVisionCritique.refinedScript,
                          latestVisionCritique.commitNote || 'Apply Gemini Vision Pass 2 refinement'
                        )
                      }
                      className="px-3 py-1 rounded bg-[#111318] text-white text-[11px] font-semibold cursor-pointer"
                    >
                      Apply &amp; Build Pass 2
                    </button>
                  )}
                </div>
                <p className="text-xs text-[#334155]">{latestVisionCritique.summary}</p>
                <div className="space-y-1.5">
                  {latestVisionCritique.defects.map((d, i) => (
                    <div key={i} className="p-2 rounded bg-[#f8f9fa] border border-[#dcdfe4] text-[11px]">
                      <div className="font-mono font-bold text-[#111318]">
                        [{d.severity.toUpperCase()}] {d.area}
                      </div>
                      <div className="text-[#475569]">{d.finding}</div>
                      <div className="text-[#111318] mt-0.5">Fix: {d.fix}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PYTHON SCRIPT STUDIO (scripts/build.py) */}
        {activeTab === 'script' && (
          <div className="flex-1 flex flex-col overflow-hidden p-4 gap-3 bg-[#f8f9fa]">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-2.5 rounded-lg border border-[#dcdfe4]">
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="font-bold text-[#111318]">scripts/build.py</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] border ${
                    scriptReport.valid
                      ? 'bg-[#f0f2f5] text-[#111318] border-[#dcdfe4]'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}
                >
                  {scriptReport.valid ? 'VALID BPY 4.2' : `${scriptReport.errors.length} ERRORS`}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onResetStarterPy}
                  className="px-2.5 py-1 rounded border border-[#dcdfe4] bg-[#f8f9fa] hover:bg-[#e5e8ec] text-[11px] font-medium text-[#111318] cursor-pointer"
                >
                  Reset Starter
                </button>
                <button
                  type="button"
                  disabled={buildBusy || !scriptReport.valid}
                  onClick={() => void onRunBuildPy(commitNote)}
                  className="px-3 py-1 rounded bg-[#111318] hover:bg-black disabled:opacity-40 text-white text-[11px] font-semibold cursor-pointer"
                >
                  {buildBusy
                    ? 'Building...'
                    : mode === 'cloud'
                      ? 'Commit & Build on GitHub CI'
                      : 'Send to Local Blender'}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-[#64748b] shrink-0">Commit Note:</span>
              <input
                type="text"
                value={commitNote}
                onChange={(e) => setCommitNote(e.target.value)}
                className="flex-1 px-2.5 py-1 rounded bg-white border border-[#dcdfe4] text-xs font-mono text-[#111318]"
              />
            </div>

            {(scriptReport.errors.length > 0 || scriptReport.warnings.length > 0) && (
              <div className="p-2.5 rounded-lg bg-white border border-[#dcdfe4] space-y-1 text-[11px] font-mono">
                {scriptReport.errors.map((e, i) => (
                  <div key={`e-${i}`} className="text-red-700">
                    ERROR: {e}
                  </div>
                ))}
                {scriptReport.warnings.map((w, i) => (
                  <div key={`w-${i}`} className="text-amber-700">
                    WARN: {w}
                  </div>
                ))}
              </div>
            )}

            <textarea
              value={buildPy}
              onChange={(e) => onBuildPyChange(e.target.value)}
              spellCheck={false}
              className="flex-1 w-full p-3 rounded-lg bg-white border border-[#cbd5e1] font-mono text-[11px] leading-relaxed text-[#111318] focus:border-[#111318] focus:outline-none resize-none"
            />

            {serverConfig?.pagesUrl && (
              <div className="flex items-center justify-between text-[11px] font-mono text-[#64748b]">
                <span>
                  CI Status: <strong className="text-[#111318] uppercase">{ciStatus?.state || 'idle'}</strong>
                </span>
                <a
                  href={serverConfig.pagesUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#111318] underline"
                >
                  Open Live GitHub Pages Viewer
                </a>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: LOCAL PC FILES & PERSISTENT BLENDER 4.2 SYSTEM SKILL */}
        {activeTab === 'workspace' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f8f9fa]">
            <div className="bg-white rounded-xl border border-[#dcdfe4] p-3.5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[#111318] uppercase tracking-wide">
                    Local PC Workspace (File System Access API)
                  </h3>
                  <p className="text-[11px] text-[#64748b]">
                    {localFolderName
                      ? `Linked folder: ${localFolderName}`
                      : 'Showing starter repo files. Link a local PC folder to allow diff-approved edits.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void onLinkLocalFolder()}
                  className="px-3 py-1.5 rounded-lg bg-[#111318] hover:bg-black text-white text-[11px] font-semibold cursor-pointer"
                >
                  {localFolderName ? 'Relink Folder' : 'Link Local Folder'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="max-h-48 overflow-y-auto border border-[#dcdfe4] rounded-lg bg-[#f8f9fa] p-1.5 space-y-0.5">
                  {workspaceFiles.map((f) => (
                    <button
                      key={f.path}
                      type="button"
                      onClick={() => onSelectFile(f.path)}
                      className={`w-full text-left px-2 py-1 rounded font-mono text-[11px] flex items-center justify-between cursor-pointer ${
                        selectedFilePath === f.path
                          ? 'bg-[#111318] text-white font-semibold'
                          : 'hover:bg-white text-[#111318]'
                      }`}
                    >
                      <span className="truncate">{f.path}</span>
                      <span className="text-[9px] opacity-70 shrink-0 ml-1">{f.source}</span>
                    </button>
                  ))}
                </div>
                <div className="max-h-48 overflow-y-auto border border-[#dcdfe4] rounded-lg bg-white p-2 font-mono text-[10px] text-[#334155] whitespace-pre-wrap">
                  {selectedFile?.content
                    ? selectedFile.content.slice(0, 2400)
                    : 'Select a file to inspect its contents.'}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#dcdfe4] p-3.5 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[#111318] uppercase tracking-wide">
                    Pinned Blender 4.2 LTS System Skill
                  </h3>
                  <p className="text-[11px] text-[#64748b]">
                    Persisted in localStorage and injected into Gemini Function Calling &amp; Vision QA.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onResetSystemSkill}
                  className="px-2.5 py-1 rounded border border-[#dcdfe4] bg-[#f8f9fa] hover:bg-[#e5e8ec] text-[11px] font-medium text-[#111318] cursor-pointer"
                >
                  Reset Default
                </button>
              </div>
              <textarea
                value={systemSkill}
                onChange={(e) => onSystemSkillChange(e.target.value)}
                rows={8}
                className="w-full p-2.5 rounded-lg bg-[#f8f9fa] border border-[#dcdfe4] font-mono text-[11px] text-[#111318] focus:border-[#111318] focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
