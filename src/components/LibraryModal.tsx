import React, { useMemo, useRef, useState } from 'react';
import {
  CloudUpload,
  FolderOpen,
  HardDrive,
  Layers,
  LogOut,
  RefreshCw,
  Search,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import type { AvailableModelItem } from '../types';

interface LibraryModalProps {
  open: boolean;
  onClose: () => void;
  models: AvailableModelItem[];
  activeModelId: string | null;
  githubConfigured: boolean;
  githubSlug: string | null;
  driveSignedIn: boolean;
  driveUserEmail: string | null;
  localFolderName: string | null;
  fsSupported: boolean;
  isBusy: boolean;
  onSelectModel: (item: AvailableModelItem) => void;
  onClearToPointCloud: () => void;
  onImportLocalFile: (file: File) => void;
  onUploadToGithub: (file: File) => void;
  onUploadToDrive: (file: File) => void;
  onSignInDrive: () => void;
  onSignOutDrive: () => void;
  onRefreshAll: () => void;
  onLinkLocalFolder: () => void;
}

type SourceFilter = 'all' | 'sample' | 'github' | 'drive' | 'local';
type SortMode = 'recent' | 'name' | 'size';

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return 'Procedural';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function sourceLabel(source: AvailableModelItem['source']): string {
  switch (source) {
    case 'specimen':
      return 'Curated Sample';
    case 'github-release':
      return 'GitHub CI';
    case 'github-repo':
      return 'GitHub Repo';
    case 'google-drive':
      return 'Google Drive';
    case 'local-file':
      return 'Local File';
  }
}

export const LibraryModal: React.FC<LibraryModalProps> = ({
  open,
  onClose,
  models,
  activeModelId,
  githubConfigured,
  githubSlug,
  driveSignedIn,
  driveUserEmail,
  localFolderName,
  fsSupported,
  isBusy,
  onSelectModel,
  onClearToPointCloud,
  onImportLocalFile,
  onUploadToGithub,
  onUploadToDrive,
  onSignInDrive,
  onSignOutDrive,
  onRefreshAll,
  onLinkLocalFolder,
}) => {
  const [filter, setFilter] = useState<SourceFilter>('all');
  const [sortBy, setSortBy] = useState<SortMode>('recent');
  const [query, setQuery] = useState('');
  const [pendingDriveFile, setPendingDriveFile] = useState<File | null>(null);

  const localInputRef = useRef<HTMLInputElement | null>(null);
  const githubInputRef = useRef<HTMLInputElement | null>(null);
  const driveInputRef = useRef<HTMLInputElement | null>(null);

  const filteredModels = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = models.filter((item) => {
      if (filter === 'sample' && item.source !== 'specimen') return false;
      if (filter === 'github' && item.source !== 'github-release' && item.source !== 'github-repo')
        return false;
      if (filter === 'drive' && item.source !== 'google-drive') return false;
      if (filter === 'local' && item.source !== 'local-file') return false;
      if (q) {
        const hay = `${item.name} ${item.format} ${item.description || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'size') return (b.sizeBytes || 0) - (a.sizeBytes || 0);
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });
  }, [models, filter, query, sortBy]);

  if (!open) return null;

  const tabs: Array<{ id: SourceFilter; label: string }> = [
    { id: 'all', label: 'All Assets' },
    { id: 'sample', label: 'Sample' },
    { id: 'github', label: 'GitHub' },
    { id: 'drive', label: 'Google Drive' },
    { id: 'local', label: 'Local' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1B19]/35 p-4 animate-atelier-fade"
      role="dialog"
      aria-modal="true"
      aria-labelledby="library-modal-title"
    >
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#E5E1DA] bg-white shadow-[0_24px_64px_-16px_rgba(28,27,25,0.22)] animate-atelier-modal">
        <div className="flex items-start justify-between gap-4 border-b border-[#EFECE6] px-6 py-5">
          <div>
            <h2
              id="library-modal-title"
              className="font-display text-[20px] font-medium tracking-[-0.015em] text-[#1C1B19]"
            >
              Asset Library
            </h2>
            <p className="mt-0.5 text-[12px] text-[#5A564F]">
              Load the curated architectural lantern, import local 3D meshes, or pull builds from
              GitHub and Google Drive.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefreshAll}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E1DA] bg-[#FAF9F6] px-3 py-1.5 text-[11.5px] font-medium text-[#5A564F] transition-colors hover:bg-[#F0EDE6] hover:text-[#1C1B19] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isBusy ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close asset library"
              className="rounded-lg p-1.5 text-[#847E75] transition-colors hover:bg-[#F5F3EF] hover:text-[#1C1B19]"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Actions bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFECE6] bg-[#FAF9F6] px-6 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => localInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2D5A4C] px-3.5 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#22453A]"
            >
              <Upload className="h-3.5 w-3.5" />
              Import 3D File
            </button>
            <input
              ref={localInputRef}
              type="file"
              accept=".glb,.gltf,.obj,.stl"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImportLocalFile(f);
                e.target.value = '';
              }}
            />

            {githubConfigured && (
              <>
                <button
                  type="button"
                  onClick={() => githubInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8D3CA] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1C1B19] transition-colors hover:bg-[#F5F3EF]"
                >
                  <CloudUpload className="h-3.5 w-3.5 text-[#2D5A4C]" />
                  Push to GitHub
                </button>
                <input
                  ref={githubInputRef}
                  type="file"
                  accept=".glb,.gltf,.obj,.stl,.blend"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUploadToGithub(f);
                    e.target.value = '';
                  }}
                />
              </>
            )}

            {driveSignedIn ? (
              <>
                <button
                  type="button"
                  onClick={() => driveInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8D3CA] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1C1B19] transition-colors hover:bg-[#F5F3EF]"
                >
                  <HardDrive className="h-3.5 w-3.5 text-[#2D5A4C]" />
                  Upload to Drive
                </button>
                <input
                  ref={driveInputRef}
                  type="file"
                  accept=".glb,.gltf,.obj,.stl,.blend"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setPendingDriveFile(f);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={onSignOutDrive}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E1DA] bg-white px-2.5 py-1.5 text-[11.5px] text-[#5A564F] transition-colors hover:text-[#1C1B19]"
                  title={driveUserEmail || 'Sign out of Google Drive'}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out Drive
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onSignInDrive}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8D3CA] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1C1B19] transition-colors hover:bg-[#F5F3EF]"
              >
                <HardDrive className="h-3.5 w-3.5 text-[#5A564F]" />
                Connect Google Drive
              </button>
            )}

            {fsSupported && (
              <button
                type="button"
                onClick={onLinkLocalFolder}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8D3CA] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1C1B19] transition-colors hover:bg-[#F5F3EF]"
              >
                <FolderOpen className="h-3.5 w-3.5 text-[#5A564F]" />
                {localFolderName ? `Folder: ${localFolderName}` : 'Link Local Folder'}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              onClearToPointCloud();
              onClose();
            }}
            className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[#5A564F] transition-colors hover:text-[#1C1B19]"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#2D5A4C]" />
            Point Cloud Stage
          </button>
        </div>

        {pendingDriveFile && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#CFE2DA] bg-[#F2F8F5] px-6 py-2.5 text-[12px] text-[#1D4438]">
            <span>
              Upload <span className="font-mono font-medium">{pendingDriveFile.name}</span> to
              Google Drive ({driveUserEmail || 'connected account'})?
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const file = pendingDriveFile;
                  setPendingDriveFile(null);
                  onUploadToDrive(file);
                }}
                className="rounded-md bg-[#2D5A4C] px-3 py-1 text-[11.5px] font-medium text-white hover:bg-[#22453A]"
              >
                Confirm Upload
              </button>
              <button
                type="button"
                onClick={() => setPendingDriveFile(null)}
                className="rounded-md border border-[#C5D9D1] bg-white px-2.5 py-1 text-[11.5px] text-[#5A564F]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFECE6] px-6 py-3">
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  filter === tab.id
                    ? 'bg-[#EBF2EF] text-[#22453A]'
                    : 'text-[#5A564F] hover:bg-[#F5F3EF] hover:text-[#1C1B19]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#847E75]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search assets..."
                className="w-44 rounded-lg border border-[#E5E1DA] bg-[#FAF9F6] py-1.5 pr-3 pl-8 text-[12px] text-[#1C1B19] outline-none transition-colors focus:border-[#2D5A4C] focus:bg-white"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortMode)}
              aria-label="Sort assets"
              className="rounded-lg border border-[#E5E1DA] bg-[#FAF9F6] px-2.5 py-1.5 text-[12px] text-[#5A564F] outline-none focus:border-[#2D5A4C]"
            >
              <option value="recent">Recent</option>
              <option value="name">Name</option>
              <option value="size">File Size</option>
            </select>
          </div>
        </div>

        {/* Asset Grid */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {filteredModels.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#DDD8CF] bg-[#FAF9F6] py-12 text-center">
              <Layers className="h-6 w-6 text-[#A29B90]" />
              <p className="mt-2.5 text-[13px] font-medium text-[#1C1B19]">
                No assets match this view
              </p>
              <p className="mt-1 max-w-sm text-[12px] text-[#6E6960]">
                {filter === 'github' && !githubConfigured
                  ? 'Connect GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO to browse cloud CI builds.'
                  : filter === 'drive' && !driveSignedIn
                    ? 'Connect Google Drive above to browse your stored .glb, .gltf, .obj, and .stl models.'
                    : 'Import a local 3D mesh (.glb, .gltf, .obj, .stl) or switch back to All Assets.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filteredModels.map((item) => {
                const isActive = item.id === activeModelId;
                return (
                  <div
                    key={item.id}
                    className={`flex flex-col justify-between rounded-xl border p-4 transition-all ${
                      isActive
                        ? 'border-[#2D5A4C] bg-[#F5F9F7]'
                        : 'border-[#E8E4DD] bg-[#FCFBF9] hover:border-[#CFC9BE] hover:bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-[14px] font-semibold text-[#1C1B19]">{item.name}</h3>
                        <span className="font-mono text-[11px] text-[#6E6960]">{item.format}</span>
                      </div>
                      <div className="mt-1 text-[11.5px] text-[#847E75]">
                        {sourceLabel(item.source)} · {formatBytes(item.sizeBytes)}
                      </div>
                      {item.description && (
                        <p className="mt-2 text-[12px] leading-relaxed text-[#5A564F]">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#EFECE6] pt-3">
                      <span className="text-[11px] text-[#847E75]">
                        {isActive ? 'Currently on stage' : item.viewable ? 'Ready to inspect' : 'Download only'}
                      </span>
                      <button
                        type="button"
                        disabled={!item.viewable}
                        onClick={() => {
                          onSelectModel(item);
                          onClose();
                        }}
                        className={`rounded-lg px-3.5 py-1.5 text-[11.5px] font-medium transition-colors ${
                          isActive
                            ? 'bg-[#EBF2EF] text-[#22453A]'
                            : 'bg-[#1C1B19] text-white hover:bg-[#2D5A4C] disabled:opacity-40'
                        }`}
                      >
                        {isActive ? 'Reload' : 'Load on Stage'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {githubSlug && (
          <div className="border-t border-[#EFECE6] bg-[#FAF9F6] px-6 py-2.5 text-[11px] text-[#6E6960]">
            Connected Repository: <span className="font-mono text-[#1C1B19]">{githubSlug}</span>
          </div>
        )}
      </div>
    </div>
  );
};
