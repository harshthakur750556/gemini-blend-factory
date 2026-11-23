import React, { useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { AvailableModelItem, GitHubCiStatus, ServerConfig } from '../types';
import { validateModelUpload } from '../utils/modelUploadValidation';

interface AssetRepositoryModalProps {
  open: boolean;
  onClose: () => void;
  models: AvailableModelItem[];
  activeModelId: string | null;
  serverConfig: ServerConfig | null;
  ciStatus: GitHubCiStatus | null;
  driveUser: User | null;
  localFolderName: string | null;
  onSelectModel: (model: AvailableModelItem) => Promise<void>;
  onRefreshModels: () => Promise<void>;
  onImportLocalFile: (file: File) => Promise<void>;
  onUploadToGitHub: (file: File, sanitizedName: string) => Promise<void>;
  onUploadToGoogleDrive: (file: File, sanitizedName: string) => Promise<void>;
  onSignInGoogleDrive: () => Promise<void>;
  onSignOutGoogleDrive: () => Promise<void>;
  onLinkLocalFolder: () => Promise<void>;
  onClearToPointCloud: () => void;
}

type SourceTab = 'all' | 'github' | 'drive' | 'local' | 'specimens';

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return 'Procedural';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const AssetRepositoryModal: React.FC<AssetRepositoryModalProps> = ({
  open,
  onClose,
  models,
  activeModelId,
  serverConfig,
  ciStatus,
  driveUser,
  localFolderName,
  onSelectModel,
  onRefreshModels,
  onImportLocalFile,
  onUploadToGitHub,
  onUploadToGoogleDrive,
  onSignInGoogleDrive,
  onSignOutGoogleDrive,
  onLinkLocalFolder,
  onClearToPointCloud,
}) => {
  const [sourceTab, setSourceTab] = useState<SourceTab>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'size'>('recent');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const [pendingDriveUpload, setPendingDriveUpload] = useState<{ file: File; sanitizedName: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadTarget, setUploadTarget] = useState<'github' | 'drive'>('github');

  const filteredModels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = models.filter((m) => {
      if (sourceTab === 'github' && m.source !== 'github-release' && m.source !== 'github-repo') return false;
      if (sourceTab === 'drive' && m.source !== 'google-drive') return false;
      if (sourceTab === 'local' && m.source !== 'local-file') return false;
      if (sourceTab === 'specimens' && m.source !== 'specimen') return false;
      if (categoryFilter !== 'ALL' && (m.category || 'Cloud_CI') !== categoryFilter) return false;
      if (q) {
        const hay = `${m.name} ${m.format} ${m.description || ''} ${m.source}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sortBy === 'name') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sortBy === 'size') {
      return [...list].sort((a, b) => (a.sizeBytes || 0) - (b.sizeBytes || 0));
    }
    return list;
  }, [models, sourceTab, categoryFilter, searchQuery, sortBy]);

  if (!open) return null;

  const handleLoadCard = async (model: AvailableModelItem) => {
    setBusyId(model.id);
    setStatusBanner(null);
    try {
      await onSelectModel(model);
      onClose();
    } catch (err) {
      setStatusBanner({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Failed to load selected 3D model.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleLocalImportPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const check = validateModelUpload(file.name, file.size);
    if (!check.valid) {
      setStatusBanner({ kind: 'error', text: check.reason || 'Unsupported 3D file.' });
      return;
    }
    setUploadBusy(true);
    setStatusBanner(null);
    try {
      await onImportLocalFile(file);
      onClose();
    } catch (err) {
      setStatusBanner({ kind: 'error', text: err instanceof Error ? err.message : 'Import failed.' });
    } finally {
      setUploadBusy(false);
    }
  };

  const handleCloudUploadPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const check = validateModelUpload(file.name, file.size);
    if (!check.valid || !check.sanitizedName) {
      setStatusBanner({ kind: 'error', text: check.reason || 'Invalid 3D model file.' });
      return;
    }
    if (uploadTarget === 'drive') {
      setPendingDriveUpload({ file, sanitizedName: check.sanitizedName });
      return;
    }
    setUploadBusy(true);
    setStatusBanner(null);
    try {
      await onUploadToGitHub(file, check.sanitizedName);
      setStatusBanner({ kind: 'info', text: `Uploaded ${check.sanitizedName} to GitHub models/ repository.` });
    } catch (err) {
      setStatusBanner({ kind: 'error', text: err instanceof Error ? err.message : 'GitHub upload failed.' });
    } finally {
      setUploadBusy(false);
    }
  };

  const confirmDriveUpload = async () => {
    if (!pendingDriveUpload) return;
    const { file, sanitizedName } = pendingDriveUpload;
    setPendingDriveUpload(null);
    setUploadBusy(true);
    setStatusBanner(null);
    try {
      await onUploadToGoogleDrive(file, sanitizedName);
      setStatusBanner({ kind: 'info', text: `Uploaded ${sanitizedName} to Google Drive.` });
    } catch (err) {
      setStatusBanner({ kind: 'error', text: err instanceof Error ? err.message : 'Google Drive upload failed.' });
    } finally {
      setUploadBusy(false);
    }
  };

  const ghCount = models.filter((m) => m.source === 'github-release' || m.source === 'github-repo').length;
  const driveCount = models.filter((m) => m.source === 'google-drive').length;
  const localCount = models.filter((m) => m.source === 'local-file').length;
  const specimenCount = models.filter((m) => m.source === 'specimen').length;
  const shortSha = ciStatus?.latestRun?.headSha ? ciStatus.latestRun.headSha.slice(0, 7) : 'main';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/45"
      role="dialog"
      aria-modal="true"
      aria-label="3D Asset Repository"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-[#cbd5e1] w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden select-none">
        {/* Top Modal Bar */}
        <div className="h-12 bg-[#f8f9fa] border-b border-[#dcdfe4] px-4 flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#111318] text-white font-bold text-xs shadow-sm shrink-0">
              <span className="material-symbols-outlined text-[16px]">folder_special</span>
              <span className="uppercase text-[10px] tracking-wide">Asset Repository</span>
            </div>
            <div className="h-4 w-px bg-[#dcdfe4]" />
            <div className="flex items-center bg-[#eef1f5] p-0.5 rounded-lg border border-[#dcdfe4] text-xs overflow-x-auto">
              {(
                [
                  { id: 'all', icon: 'apps', label: 'All', count: models.length },
                  { id: 'github', icon: 'source_environment', label: 'GitHub Repo', count: ghCount },
                  { id: 'drive', icon: 'add_to_drive', label: 'Google Drive', count: driveCount },
                  { id: 'local', icon: 'folder_open', label: 'Local', count: localCount },
                  { id: 'specimens', icon: 'precision_manufacturing', label: 'Specimens', count: specimenCount },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSourceTab(tab.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    sourceTab === tab.id
                      ? 'font-semibold bg-white text-black shadow-sm'
                      : 'font-medium text-[#64748b] hover:text-black'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">{tab.icon}</span>
                  <span>{tab.label}</span>
                  <span className="text-[9px] bg-[#111318] text-white px-1 rounded font-mono">{tab.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {serverConfig?.githubConfigured && (
              <div className="hidden lg:flex items-center gap-1.5 text-xs font-mono bg-white px-2.5 py-1 rounded-md border border-[#dcdfe4]">
                <span className="text-[#64748b]">
                  {serverConfig.githubOwner}/{serverConfig.githubRepo}:
                </span>
                <span className="font-semibold text-black">{serverConfig.githubBranch}</span>
                <span className="text-[10px] bg-[#f0f2f5] px-1 rounded border border-[#dcdfe4]">{shortSha}</span>
                <button
                  type="button"
                  onClick={() => void onRefreshModels()}
                  className="ml-1 text-black hover:text-[#64748b] transition-colors cursor-pointer"
                  title="Sync Repository & Drive Models"
                >
                  <span className="material-symbols-outlined text-[14px]">sync</span>
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-md hover:bg-[#e2e8f0] text-[#64748b] hover:text-black flex items-center justify-center transition-colors cursor-pointer"
              title="Close Asset Repository"
              aria-label="Close Asset Repository"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* Search, Sort & Direct Upload Controls */}
        <div className="p-3 bg-white border-b border-[#dcdfe4] flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex-1 min-w-[220px] flex items-center bg-[#f8f9fa] px-3 py-1.5 rounded-lg border border-[#dcdfe4] text-xs">
            <span className="material-symbols-outlined text-[16px] text-[#64748b] mr-2">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter models, tags, formats .glb, .gltf, .obj, .stl, .blend..."
              className="w-full bg-transparent text-black text-xs focus:outline-none placeholder:text-[#94a3b8]"
            />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 bg-[#f8f9fa] px-2.5 py-1 rounded-lg border border-[#dcdfe4]">
              <span className="text-[#64748b] text-[11px]">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'recent' | 'name' | 'size')}
                className="bg-transparent text-black font-semibold text-[11px] focus:outline-none cursor-pointer"
              >
                <option value="recent">Recently Updated</option>
                <option value="name">Name (A - Z)</option>
                <option value="size">File Size (Small-Large)</option>
              </select>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".glb,.gltf,.obj,.stl"
              onChange={handleLocalImportPick}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadBusy}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#f8f9fa] hover:bg-[#111318] hover:text-white border border-[#dcdfe4] text-[11px] font-medium transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">file_upload</span>
              <span>Import File</span>
            </button>
            <input
              ref={uploadInputRef}
              type="file"
              accept=".glb,.gltf,.obj,.stl,.blend"
              onChange={handleCloudUploadPick}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploadBusy || !serverConfig?.githubConfigured}
              onClick={() => {
                setUploadTarget('github');
                uploadInputRef.current?.click();
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#111318] text-white hover:bg-black disabled:opacity-40 text-[11px] font-medium transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">cloud_upload</span>
              <span>Push to GitHub</span>
            </button>
          </div>
        </div>

        {/* Status / Error Banner */}
        {statusBanner && (
          <div
            className={`px-4 py-2 text-xs font-mono border-b flex items-center justify-between ${
              statusBanner.kind === 'error'
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-[#f0f2f5] border-[#dcdfe4] text-[#111318]'
            }`}
          >
            <span>{statusBanner.text}</span>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-[11px] underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Explicit Google Drive Upload Confirmation Banner */}
        {pendingDriveUpload && (
          <div className="px-4 py-2.5 bg-[#f8f9fa] border-b border-[#111318] flex items-center justify-between gap-3 text-xs">
            <div className="text-[#111318]">
              Confirm upload of <strong className="font-mono">{pendingDriveUpload.sanitizedName}</strong> (
              {formatBytes(pendingDriveUpload.file.size)}) to your Google Drive?
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setPendingDriveUpload(null)}
                className="px-2.5 py-1 rounded border border-[#dcdfe4] bg-white text-[#111318] text-[11px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDriveUpload()}
                className="px-3 py-1 rounded bg-[#111318] text-white text-[11px] font-semibold cursor-pointer"
              >
                Confirm Upload to Drive
              </button>
            </div>
          </div>
        )}

        {/* Main Body: Category Sidebar + Asset Grid */}
        <div className="flex-1 flex overflow-hidden">
          <div className="w-56 bg-[#f8f9fa] border-r border-[#dcdfe4] p-3 flex flex-col gap-3 shrink-0 overflow-y-auto">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] font-mono">
              Repositories &amp; Groups
            </div>
            <div className="space-y-1 text-xs">
              {(
                [
                  { id: 'ALL', icon: 'apps', label: 'All Models', count: models.length },
                  {
                    id: 'Cloud_CI',
                    icon: 'cloud_done',
                    label: 'Cloud_CI',
                    count: models.filter((m) => (m.category || 'Cloud_CI') === 'Cloud_CI').length,
                  },
                  {
                    id: 'Mech_Frames',
                    icon: 'folder',
                    label: 'Mech_Frames',
                    count: models.filter((m) => m.category === 'Mech_Frames').length,
                  },
                  {
                    id: 'Rigged_Assets',
                    icon: 'folder',
                    label: 'Rigged_Assets',
                    count: models.filter((m) => m.category === 'Rigged_Assets').length,
                  },
                  {
                    id: 'Environment_Props',
                    icon: 'folder',
                    label: 'Environment_Props',
                    count: models.filter((m) => m.category === 'Environment_Props').length,
                  },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors cursor-pointer ${
                    categoryFilter === cat.id
                      ? 'bg-[#111318] text-white font-semibold shadow-sm'
                      : 'hover:bg-white text-black font-medium'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="material-symbols-outlined text-[15px]">{cat.icon}</span>
                    <span className="truncate">{cat.label}</span>
                  </span>
                  <span className="text-[10px] font-mono opacity-80">{cat.count}</span>
                </button>
              ))}
            </div>

            {/* Google Drive OAuth Block (Official GSI Button) */}
            <div className="pt-3 border-t border-[#dcdfe4] space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] font-mono">
                Google Drive Sync
              </div>
              {driveUser ? (
                <div className="p-2 rounded bg-white border border-[#dcdfe4] space-y-2 text-[10px]">
                  <div className="font-semibold text-[#111318] truncate">{driveUser.email || driveUser.displayName}</div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setUploadTarget('drive');
                        uploadInputRef.current?.click();
                      }}
                      className="flex-1 py-1 rounded bg-[#111318] text-white font-semibold cursor-pointer"
                    >
                      Upload to Drive
                    </button>
                    <button
                      type="button"
                      onClick={() => void onSignOutGoogleDrive()}
                      className="px-2 py-1 rounded border border-[#dcdfe4] text-[#64748b] hover:text-black cursor-pointer"
                    >
                      Out
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void onSignInGoogleDrive()}
                  className="gsi-material-button w-full"
                >
                  <div className="gsi-material-button-state" />
                  <div className="gsi-material-button-content-wrapper">
                    <div className="gsi-material-button-icon">
                      <svg
                        version="1.1"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 48 48"
                        width="18"
                        height="18"
                        className="w-[18px] h-[18px] block"
                      >
                        <path
                          fill="#EA4335"
                          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                        />
                        <path
                          fill="#4285F4"
                          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                        />
                        <path
                          fill="#34A853"
                          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                        />
                      </svg>
                    </div>
                    <span className="gsi-material-button-contents">Sign in with Google</span>
                  </div>
                </button>
              )}
            </div>

            {/* Storage Path & Local Folder Link */}
            <div className="mt-auto pt-3 border-t border-[#dcdfe4] space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] font-mono">
                Storage Path
              </div>
              <div className="p-2 rounded bg-white border border-[#dcdfe4] text-[10px] font-mono text-[#64748b] break-all">
                <span className="text-black font-medium block">
                  {localFolderName ? `local://${localFolderName}` : '/workspace/models/'}
                </span>
                {serverConfig?.githubOwner
                  ? `github.com/${serverConfig.githubOwner}/${serverConfig.githubRepo}`
                  : 'GitHub Secrets Ready'}
              </div>
              <button
                type="button"
                onClick={() => void onLinkLocalFolder()}
                className="w-full py-1.5 rounded bg-white hover:bg-[#111318] hover:text-white border border-[#dcdfe4] text-[11px] font-medium text-[#111318] transition-colors cursor-pointer"
              >
                {localFolderName ? 'Change Local Folder' : 'Link Local PC Folder'}
              </button>
            </div>
          </div>

          {/* Asset Cards Grid */}
          <div className="flex-1 bg-[#f1f5f9] p-4 overflow-y-auto">
            {filteredModels.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-[#64748b]">
                <span className="material-symbols-outlined text-4xl text-[#94a3b8]">inventory_2</span>
                <div className="text-sm font-semibold text-[#111318]">No matching 3D assets</div>
                <p className="text-xs max-w-sm">
                  Import a local .glb/.gltf/.obj/.stl file, switch source tabs, or load a Studio Specimen.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredModels.map((model) => {
                  const isActive = activeModelId === model.id;
                  const isLoading = busyId === model.id;
                  const iconName =
                    model.specimenKind === 'apex-mech'
                      ? 'smart_toy'
                      : model.specimenKind === 'rigged-arm'
                        ? 'precision_manufacturing'
                        : model.specimenKind === 'stone-lantern'
                          ? 'architecture'
                          : model.source === 'google-drive'
                            ? 'add_to_drive'
                            : 'deployed_code';

                  return (
                    <div
                      key={model.id}
                      className={`bg-white rounded-lg p-3 flex flex-col justify-between shadow-sm relative transition-all ${
                        isActive
                          ? 'border-2 border-[#111318]'
                          : 'border border-[#cbd5e1] hover:border-[#111318] hover:shadow-md'
                      }`}
                    >
                      {isActive && (
                        <div className="absolute top-2.5 right-2.5 z-10">
                          <span className="px-1.5 py-0.5 rounded bg-[#111318] text-white text-[9px] font-bold font-mono tracking-wide shadow-sm">
                            ACTIVE IN VIEWPORT
                          </span>
                        </div>
                      )}

                      <div className="h-28 bg-[#0f172a] rounded-md border border-[#334155] relative flex items-center justify-center overflow-hidden mb-2.5">
                        <div className="w-14 h-14 rounded-full border border-dashed border-white/35 flex items-center justify-center">
                          <span className="material-symbols-outlined text-white text-3xl">{iconName}</span>
                        </div>
                        <div className="absolute bottom-1.5 left-2 text-[9px] font-mono text-white/90 bg-black/65 px-1.5 py-0.5 rounded">
                          {model.format}
                        </div>
                        <div className="absolute bottom-1.5 right-2 text-[9px] font-mono text-slate-300 bg-black/50 px-1.5 py-0.5 rounded uppercase">
                          {model.source.replace('-', ' ')}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-bold text-[#111318] truncate">{model.name}</h4>
                          <span className="text-[10px] font-mono text-[#64748b] shrink-0">
                            {formatBytes(model.sizeBytes)}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#64748b] mt-1 line-clamp-2 min-h-[28px]">
                          {model.description || 'Verified 3D asset ready for interactive inspection & multi-format export.'}
                        </p>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-[#dcdfe4] flex items-center gap-2">
                        {model.viewable ? (
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => void handleLoadCard(model)}
                            className={`flex-1 py-1.5 rounded text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                              isActive
                                ? 'bg-[#111318] text-white'
                                : 'bg-[#f0f2f5] hover:bg-[#111318] hover:text-white text-[#111318]'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[13px]">
                              {isLoading ? 'progress_activity' : isActive ? 'visibility' : 'download'}
                            </span>
                            <span>{isLoading ? 'Loading...' : isActive ? 'Loaded' : 'Load Model'}</span>
                          </button>
                        ) : (
                          <a
                            href={model.url || model.htmlUrl || '#'}
                            download
                            className="flex-1 py-1.5 rounded bg-[#f0f2f5] hover:bg-[#111318] hover:text-white text-[#111318] text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[13px]">download</span>
                            <span>Download .blend</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Bar */}
        <div className="h-9 bg-[#f8f9fa] border-t border-[#dcdfe4] px-4 flex items-center justify-between shrink-0 text-xs font-mono text-[#64748b]">
          <div className="flex items-center gap-2">
            <span>
              Showing {filteredModels.length} of {models.length} Models
            </span>
            <span className="text-[#dcdfe4]">|</span>
            <span className="text-emerald-700 font-semibold">
              ● {serverConfig?.githubConfigured ? 'Remote Git Repository Connected' : 'Local & Specimens Ready'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClearToPointCloud();
                onClose();
              }}
              className="px-2.5 py-1 rounded border border-[#dcdfe4] bg-white hover:bg-[#f0f2f5] text-[#111318] text-[11px] font-sans font-medium cursor-pointer"
            >
              Unload to Point Cloud
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 rounded bg-[#111318] text-white text-[11px] font-sans font-semibold hover:bg-black transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
