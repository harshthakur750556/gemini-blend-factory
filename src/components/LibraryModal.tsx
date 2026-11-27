import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  Box,
  Building2,
  Camera,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudUpload,
  Cpu,
  FileBox,
  FileCode2,
  FolderGit2,
  FolderOpen,
  Gamepad2,
  Globe,
  HardDrive,
  Image as ImageIcon,
  Layers,
  Loader2,
  LogOut,
  Package,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Sparkles,
  Square,
  Trees,
  Upload,
  User,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import type { AvailableModelItem, ModelGroupName } from '../types';
import {
  filterAndGroupLibraryModels,
  getCategoryLabel,
  LIBRARY_CATEGORIES,
  type LibraryFilterKey,
  type LibrarySortMode,
} from '../utils/libraryCategories';

interface LibraryModalProps {
  open: boolean;
  onClose: () => void;
  models: AvailableModelItem[];
  activeModelId: string | null;
  hasActiveModel: boolean;
  githubConfigured: boolean;
  githubSlug: string | null;
  driveSignedIn: boolean;
  driveUserEmail: string | null;
  localFolderName: string | null;
  fsSupported: boolean;
  isBusy: boolean;
  onSelectModel: (item: AvailableModelItem) => void;
  onAppendModelToWorld: (item: AvailableModelItem) => void;
  onClearToPointCloud: () => void;
  onImportLocalFile: (file: File, group?: ModelGroupName) => void;
  onUploadToGithub: (file: File, group: ModelGroupName) => void;
  onSaveActiveStageToGithub: (group: ModelGroupName) => Promise<void>;
  onBackupSelectedToDrive: (items: AvailableModelItem[]) => Promise<void>;
  onOpenConverter: () => void;
  onSignInDrive: () => void;
  onSignOutDrive: () => void;
  onRefreshAll: () => void;
  onLinkLocalFolder: () => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return 'Procedural';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getGroupIcon(group: LibraryFilterKey) {
  switch (group) {
    case 'Female_Characters':
      return <UserRound className="h-3.5 w-3.5" />;
    case 'Male_Characters':
      return <User className="h-3.5 w-3.5" />;
    case 'Characters':
      return <Users className="h-3.5 w-3.5" />;
    case 'Sample':
      return <Sparkles className="h-3.5 w-3.5" />;
    case 'Architecture':
      return <Building2 className="h-3.5 w-3.5" />;
    case 'Props':
      return <Package className="h-3.5 w-3.5" />;
    case 'Environment':
      return <Trees className="h-3.5 w-3.5" />;
    case 'World_Assemblies':
      return <Globe className="h-3.5 w-3.5" />;
    case 'Cloud_CI':
      return <Cloud className="h-3.5 w-3.5" />;
    case 'drive':
      return <HardDrive className="h-3.5 w-3.5" />;
    case 'local':
      return <FolderOpen className="h-3.5 w-3.5" />;
    default:
      return <Layers className="h-3.5 w-3.5" />;
  }
}

function getFormatIcon(format: AvailableModelItem['format']) {
  if (format === '.fbx' || format === '.dae' || format === '.usdz' || format === '.usda') {
    return <Gamepad2 className="h-3.5 w-3.5 text-[#2D5A4C]" />;
  }
  if (format === '.step' || format === '.dxf' || format === '.stl' || format === '.3mf') {
    return <Printer className="h-3.5 w-3.5 text-[#436B95]" />;
  }
  if (format === '.blend') {
    return <FileCode2 className="h-3.5 w-3.5 text-[#9A6316]" />;
  }
  if (format === 'procedural') {
    return <Sparkles className="h-3.5 w-3.5 text-[#2D5A4C]" />;
  }
  return <FileBox className="h-3.5 w-3.5 text-[#5A564F]" />;
}

function sourceBadge(source: AvailableModelItem['source']): { label: string; icon: React.ReactNode } {
  switch (source) {
    case 'specimen':
      return { label: 'Repository Asset', icon: <FolderGit2 className="h-3 w-3 text-[#2D5A4C]" /> };
    case 'github-release':
      return { label: 'GitHub CI', icon: <Cpu className="h-3 w-3 text-[#2D5A4C]" /> };
    case 'github-repo':
      return { label: 'GitHub models/', icon: <FolderGit2 className="h-3 w-3 text-[#2D5A4C]" /> };
    case 'google-drive':
      return { label: 'Google Drive', icon: <HardDrive className="h-3 w-3 text-[#436B95]" /> };
    case 'local-file':
      return { label: 'Local Import', icon: <Box className="h-3 w-3 text-[#6E6960]" /> };
  }
}

function getCategoryAccentBg(group: ModelGroupName): string {
  switch (group) {
    case 'Female_Characters':
      return 'from-[#F4EFEA] via-[#ECE7E2] to-[#E2ECE8]';
    case 'Male_Characters':
      return 'from-[#EDF1F4] via-[#E8EDF0] to-[#E2EBE7]';
    case 'Characters':
      return 'from-[#F1EFEA] via-[#EAE7E0] to-[#E5ECE9]';
    default:
      return 'from-[#F5F3EF] via-[#EEEBE4] to-[#E8E4DC]';
  }
}

export const LibraryModal: React.FC<LibraryModalProps> = ({
  open,
  onClose,
  models,
  activeModelId,
  hasActiveModel,
  githubConfigured,
  githubSlug,
  driveSignedIn,
  driveUserEmail,
  localFolderName,
  fsSupported,
  isBusy,
  onSelectModel,
  onAppendModelToWorld,
  onClearToPointCloud,
  onImportLocalFile,
  onUploadToGithub,
  onSaveActiveStageToGithub,
  onBackupSelectedToDrive,
  onOpenConverter,
  onSignInDrive,
  onSignOutDrive,
  onRefreshAll,
  onLinkLocalFolder,
}) => {
  const [filter, setFilter] = useState<LibraryFilterKey>('all');
  const [sortBy, setSortBy] = useState<LibrarySortMode>('recent');
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saveGroup, setSaveGroup] = useState<ModelGroupName>('Female_Characters');
  const [isBackingUpDrive, setIsBackingUpDrive] = useState(false);
  const [isSavingStage, setIsSavingStage] = useState(false);
  const [storageToolsOpen, setStorageToolsOpen] = useState(false);
  const [brokenPreviewIds, setBrokenPreviewIds] = useState<Record<string, boolean>>({});

  const localInputRef = useRef<HTMLInputElement | null>(null);
  const githubInputRef = useRef<HTMLInputElement | null>(null);

  const { flat: filteredModels, sections } = useMemo(
    () => filterAndGroupLibraryModels(models, filter, query, sortBy),
    [models, filter, query, sortBy]
  );

  const countsByFilter = useMemo(() => {
    const counts: Record<string, number> = { all: models.length, drive: 0, local: 0 };
    for (const m of models) {
      counts[m.group] = (counts[m.group] || 0) + 1;
      if (m.source === 'google-drive') counts.drive += 1;
      if (m.source === 'local-file') counts.local += 1;
    }
    return counts;
  }, [models]);

  if (!open) return null;

  const tabs: Array<{ id: LibraryFilterKey; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'Female_Characters', label: 'Female Characters' },
    { id: 'Male_Characters', label: 'Male Characters' },
    { id: 'Characters', label: 'Stylized & Robots' },
    { id: 'Props', label: 'Props' },
    { id: 'Architecture', label: 'Architecture' },
    { id: 'Environment', label: 'Environment' },
    { id: 'local', label: 'Local' },
    { id: 'drive', label: 'Drive' },
  ];

  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectVisibleGroup = () => {
    const visibleIds = filteredModels.map((m) => m.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const selectedModels = models.filter((m) => selectedIds.has(m.id));
  const allVisibleSelected =
    filteredModels.length > 0 && filteredModels.every((m) => selectedIds.has(m.id));

  const handleDriveBackupClick = async () => {
    if (selectedModels.length === 0) return;
    if (!driveSignedIn) {
      onSignInDrive();
      return;
    }
    setIsBackingUpDrive(true);
    try {
      await onBackupSelectedToDrive(selectedModels);
      setSelectedIds(new Set());
    } finally {
      setIsBackingUpDrive(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1B19]/35 p-2 sm:p-4 animate-atelier-fade"
      role="dialog"
      aria-modal="true"
      aria-labelledby="library-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-[94dvh] max-h-[900px] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#E5E1DA] bg-white shadow-[0_24px_64px_-16px_rgba(28,27,25,0.22)] animate-atelier-modal">
        {/* Single Slim Fixed Header (~56px) — never blocks scrolling on mobile or small screens */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#EFECE6] bg-white px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#EBF2EF] text-[#2D5A4C]">
              <Layers className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2
                id="library-modal-title"
                className="font-display text-[16px] font-medium tracking-[-0.015em] text-[#1C1B19] sm:text-[19px]"
              >
                <span className="hidden sm:inline">Model </span>Library
              </h2>
            </div>
            <span className="hidden rounded-md bg-[#F3F0EA] px-2 py-0.5 font-mono text-[10.5px] text-[#5A564F] sm:inline-block">
              {models.length} models
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#847E75]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                aria-label="Search models"
                className="w-28 rounded-lg border border-[#E5E1DA] bg-[#FAF9F6] py-1.5 pr-2.5 pl-8 text-[12px] text-[#1C1B19] outline-none transition-colors focus:w-36 focus:border-[#2D5A4C] focus:bg-white sm:w-48 sm:focus:w-56"
              />
            </div>

            <button
              type="button"
              onClick={onRefreshAll}
              disabled={isBusy}
              title="Sync repository models"
              aria-label="Sync repository models"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E1DA] bg-[#FAF9F6] text-[#5A564F] transition-colors hover:bg-[#F0EDE6] hover:text-[#1C1B19] disabled:opacity-50 sm:w-auto sm:gap-1.5 sm:px-2.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isBusy ? 'animate-spin' : ''}`} />
              <span className="hidden text-[11.5px] font-medium sm:inline">Sync</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close asset library"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#847E75] transition-colors hover:bg-[#F5F3EF] hover:text-[#1C1B19]"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Full-Height Smooth Scrollable Body (Categories + Optional Import Bar + Categorized Previews) */}
        <div
          className="atelier-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3.5 sm:px-5 sm:py-4"
          data-testid="library-scroll-region"
        >
          {/* Horizontally Scrollable Category Filter Strip + Sort */}
          <div className="flex flex-col gap-2.5 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              {tabs.map((tab) => {
                const count = countsByFilter[tab.id] || 0;
                const active = filter === tab.id;
                // Show primary character & populated tabs cleanly without clutter
                if (
                  count === 0 &&
                  tab.id !== 'all' &&
                  tab.id !== 'Female_Characters' &&
                  tab.id !== 'Male_Characters' &&
                  tab.id !== 'Characters' &&
                  tab.id !== 'local'
                ) {
                  return null;
                }
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilter(tab.id)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-[#2D5A4C] text-white'
                        : 'border border-[#ECE8E0] bg-[#FAF9F6] text-[#5A564F] hover:bg-[#F0EDE6] hover:text-[#1C1B19]'
                    }`}
                  >
                    {getGroupIcon(tab.id)}
                    <span>{tab.label}</span>
                    <span
                      className={`rounded px-1 font-mono text-[10px] ${
                        active ? 'bg-white/20 text-white' : 'bg-[#EAE5DC] text-[#5A564F]'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => localInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#2D5A4C] px-3 py-1.5 text-[11.5px] font-medium text-white transition-colors hover:bg-[#22453A]"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Import 3D
                </button>
                <input
                  ref={localInputRef}
                  type="file"
                  accept=".glb,.gltf,.obj,.stl,.ply,.fbx,.dae,.3mf,.amf,.off,.dxf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onImportLocalFile(f, saveGroup);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setStorageToolsOpen((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#E5E1DA] bg-[#FAF9F6] px-2.5 py-1.5 text-[11.5px] font-medium text-[#5A564F] transition-colors hover:bg-[#F0EDE6] hover:text-[#1C1B19]"
                >
                  Tools
                  {storageToolsOpen ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as LibrarySortMode)}
                aria-label="Sort assets"
                className="rounded-lg border border-[#E5E1DA] bg-[#FAF9F6] px-2 py-1.5 text-[11.5px] text-[#5A564F] outline-none focus:border-[#2D5A4C]"
              >
                <option value="recent">Recent</option>
                <option value="name">Name</option>
                <option value="size">Size</option>
              </select>
            </div>
          </div>

          {/* Collapsible Storage, Category Upload, GitHub & Google Drive Tools (Scrolls away, never fixed!) */}
          {storageToolsOpen && (
            <div className="mb-4 space-y-2.5 rounded-xl border border-[#E5E1DA] bg-[#FAF9F6] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[#5A564F]">
                  Category:
                  <select
                    value={saveGroup}
                    onChange={(e) => setSaveGroup(e.target.value as ModelGroupName)}
                    aria-label="Target model category"
                    className="rounded-lg border border-[#D8D3CA] bg-white px-2 py-1 text-[11.5px] text-[#1C1B19] outline-none focus:border-[#2D5A4C]"
                  >
                    {LIBRARY_CATEGORIES.filter((c) => c.id !== 'Cloud_CI' && c.id !== 'Sample').map(
                      (cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      )
                    )}
                  </select>
                </label>

                {githubConfigured && (
                  <>
                    <button
                      type="button"
                      disabled={!hasActiveModel || isSavingStage}
                      onClick={async () => {
                        setIsSavingStage(true);
                        try {
                          await onSaveActiveStageToGithub(saveGroup);
                        } finally {
                          setIsSavingStage(false);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8D3CA] bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-[#1C1B19] transition-colors hover:bg-[#F0EDE6] disabled:opacity-45"
                    >
                      {isSavingStage ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#2D5A4C]" />
                      ) : (
                        <CloudUpload className="h-3.5 w-3.5 text-[#2D5A4C]" />
                      )}
                      Save Stage to Repo
                    </button>

                    <button
                      type="button"
                      onClick={() => githubInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8D3CA] bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-[#1C1B19] transition-colors hover:bg-[#F0EDE6]"
                    >
                      <FolderGit2 className="h-3.5 w-3.5 text-[#2D5A4C]" />
                      Upload to GitHub
                    </button>
                    <input
                      ref={githubInputRef}
                      type="file"
                      accept=".glb,.gltf,.obj,.stl,.ply,.fbx,.dae,.usdz,.usda,.step,.dxf,.3mf,.off,.blend"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onUploadToGithub(f, saveGroup);
                        e.target.value = '';
                      }}
                    />
                  </>
                )}

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenConverter();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8D3CA] bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-[#1C1B19] transition-colors hover:bg-[#F0EDE6]"
                >
                  <ArrowRightLeft className="h-3.5 w-3.5 text-[#2D5A4C]" />
                  Converter
                </button>

                {fsSupported && (
                  <button
                    type="button"
                    onClick={onLinkLocalFolder}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8D3CA] bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-[#1C1B19] transition-colors hover:bg-[#F0EDE6]"
                  >
                    <FolderOpen className="h-3.5 w-3.5 text-[#5A564F]" />
                    {localFolderName ? localFolderName : 'Link Folder'}
                  </button>
                )}

                {driveSignedIn ? (
                  <button
                    type="button"
                    onClick={onSignOutDrive}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E1DA] bg-white px-2.5 py-1.5 text-[11.5px] text-[#5A564F] transition-colors hover:text-[#1C1B19]"
                    title={driveUserEmail || 'Sign out of Google Drive'}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Drive Connected
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onSignInDrive}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8D3CA] bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-[#1C1B19] transition-colors hover:bg-[#F0EDE6]"
                  >
                    <HardDrive className="h-3.5 w-3.5 text-[#436B95]" />
                    Connect Drive
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    onClearToPointCloud();
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E1DA] bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-[#5A564F] transition-colors hover:text-[#1C1B19]"
                >
                  <Sparkles className="h-3.5 w-3.5 text-[#2D5A4C]" />
                  Point Cloud Stage
                </button>
              </div>

              {/* Bulk Drive Selection Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EAE5DC] pt-2 text-[11.5px]">
                <button
                  type="button"
                  onClick={toggleSelectVisibleGroup}
                  className="inline-flex items-center gap-1.5 font-medium text-[#1C1B19] hover:text-[#2D5A4C]"
                >
                  {allVisibleSelected ? (
                    <CheckSquare className="h-4 w-4 text-[#2D5A4C]" />
                  ) : (
                    <Square className="h-4 w-4 text-[#847E75]" />
                  )}
                  {allVisibleSelected
                    ? 'Deselect Visible'
                    : `Select Visible (${filteredModels.length})`}
                </button>

                <button
                  type="button"
                  disabled={selectedModels.length === 0 || isBackingUpDrive}
                  onClick={handleDriveBackupClick}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1C1B19] px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-[#2D5A4C] disabled:opacity-35"
                >
                  {isBackingUpDrive ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <HardDrive className="h-3.5 w-3.5" />
                  )}
                  Copy Selected ({selectedModels.length}) to Drive
                </button>
              </div>

              {githubSlug && (
                <div className="border-t border-[#EAE5DC] pt-2 font-mono text-[10.5px] text-[#6E6960]">
                  Repo storage: {githubSlug}/models/&lt;slug&gt;/
                </div>
              )}
            </div>
          )}

          {/* Categorized Model Preview Grid */}
          {sections.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#DDD8CF] bg-[#FAF9F6] py-12 text-center">
              <Layers className="h-6 w-6 text-[#A29B90]" />
              <p className="mt-2.5 text-[13px] font-medium text-[#1C1B19]">
                No models match this category or search
              </p>
              <p className="mt-1 max-w-sm text-[12px] text-[#6E6960]">
                Switch back to All categories or click <strong className="text-[#1C1B19]">Import 3D</strong> to
                load a local <span className="font-mono">.glb/.gltf/.fbx/.obj</span> model.
              </p>
            </div>
          ) : (
            <div className="space-y-6 pb-4">
              {sections.map((section) => (
                <section key={section.group} aria-label={section.label}>
                  <div className="mb-3 flex items-center justify-between border-b border-[#EFECE6] pb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#EBF2EF] text-[#2D5A4C]">
                        {getGroupIcon(section.group)}
                      </span>
                      <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-[#1C1B19]">
                        {section.label}
                      </h3>
                      <span className="rounded bg-[#F3F0EA] px-1.5 py-0.5 font-mono text-[10.5px] text-[#5A564F]">
                        {section.items.length}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                    {section.items.map((item) => {
                      const isActive = item.id === activeModelId;
                      const isChecked = selectedIds.has(item.id);
                      const src = sourceBadge(item.source);
                      const texCount = item.textures?.length || 0;
                      const shotCount = item.screenshots?.length || 0;
                      const previewSrc = !brokenPreviewIds[item.id]
                        ? item.previewUrl || item.screenshots?.[0]?.url || null
                        : null;

                      return (
                        <div
                          key={item.id}
                          className={`group flex flex-col overflow-hidden rounded-xl border transition-all ${
                            isActive
                              ? 'border-[#2D5A4C] bg-[#F5F9F7] ring-1 ring-[#2D5A4C]/25'
                              : isChecked
                                ? 'border-[#436B95] bg-[#F4F7FA]'
                                : 'border-[#E8E4DD] bg-[#FCFBF9] hover:border-[#C9C2B6] hover:bg-white hover:shadow-[0_8px_24px_-12px_rgba(28,27,25,0.16)]'
                          }`}
                        >
                          {/* Clickable Visual Preview Area */}
                          <div
                            className={`relative aspect-[16/10] w-full overflow-hidden border-b border-[#EFECE6] bg-gradient-to-br ${getCategoryAccentBg(item.group)}`}
                          >
                            <button
                              type="button"
                              disabled={!item.viewable}
                              onClick={() => {
                                onSelectModel(item);
                                onClose();
                              }}
                              className="block h-full w-full cursor-pointer text-left disabled:cursor-default"
                              aria-label={`Open ${item.name} in 3D viewport`}
                            >
                              {previewSrc ? (
                                <img
                                  src={previewSrc}
                                  alt={`${item.name} 3D model preview`}
                                  loading="lazy"
                                  onError={() =>
                                    setBrokenPreviewIds((prev) => ({ ...prev, [item.id]: true }))
                                  }
                                  className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
                                />
                              ) : (
                                <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-[#5A564F]">
                                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#DDD8CF] bg-white/90 text-[#2D5A4C] shadow-sm">
                                    {getGroupIcon(item.group)}
                                  </div>
                                  <span className="font-mono text-[10.5px] uppercase tracking-wider text-[#6E6960]">
                                    {item.format} · 3D Asset
                                  </span>
                                </div>
                              )}
                            </button>

                            {/* Top-Left Selection Checkbox */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelectItem(item.id);
                              }}
                              aria-label={`Select ${item.name} for Drive copy`}
                              className="absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-md border border-[#E5E1DA] bg-white/95 text-[#6E6960] shadow-xs transition-colors hover:text-[#2D5A4C]"
                            >
                              {isChecked ? (
                                <CheckSquare className="h-3.5 w-3.5 text-[#2D5A4C]" />
                              ) : (
                                <Square className="h-3.5 w-3.5" />
                              )}
                            </button>

                            {/* Top-Right Format & Active Badges */}
                            <div className="pointer-events-none absolute top-2 right-2 flex items-center gap-1">
                              {isActive && (
                                <span className="rounded-md bg-[#2D5A4C] px-1.5 py-0.5 text-[10px] font-medium text-white shadow-xs">
                                  Active
                                </span>
                              )}
                              <span className="rounded-md border border-[#E5E1DA] bg-white/95 px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#1C1B19] shadow-xs">
                                {item.format}
                              </span>
                            </div>

                            {/* Bottom-Left Category Label */}
                            <div className="pointer-events-none absolute bottom-2 left-2">
                              <span className="inline-flex items-center gap-1 rounded-md border border-[#E5E1DA] bg-white/95 px-2 py-0.5 text-[10px] font-medium text-[#1C1B19] shadow-xs">
                                {getGroupIcon(item.group)}
                                {getCategoryLabel(item.group)}
                              </span>
                            </div>
                          </div>

                          {/* Card Info & Actions */}
                          <div className="flex flex-1 flex-col justify-between p-3.5">
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-1.5">
                                  {getFormatIcon(item.format)}
                                  <h4 className="truncate text-[13.5px] font-semibold text-[#1C1B19]">
                                    {item.name}
                                  </h4>
                                </div>
                                <span className="shrink-0 font-mono text-[10.5px] text-[#6E6960]">
                                  {formatBytes(item.sizeBytes)}
                                </span>
                              </div>

                              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px] text-[#6E6960]">
                                <span className="inline-flex items-center gap-1">
                                  {src.icon}
                                  {src.label}
                                </span>
                                {item.repoFolderPath && (
                                  <>
                                    <span>·</span>
                                    <span className="truncate font-mono text-[#2D5A4C]">
                                      {item.repoFolderPath}/
                                    </span>
                                  </>
                                )}
                              </div>

                              {item.description && (
                                <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-relaxed text-[#5A564F]">
                                  {item.description}
                                </p>
                              )}

                              {(texCount > 0 || shotCount > 0 || item.buildPyPath) && (
                                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-[#5A564F]">
                                  {texCount > 0 && (
                                    <span className="inline-flex items-center gap-1 rounded border border-[#E5E1DA] bg-white px-1.5 py-0.5">
                                      <ImageIcon className="h-3 w-3 text-[#2D5A4C]" />
                                      {texCount}
                                    </span>
                                  )}
                                  {shotCount > 0 && (
                                    <span className="inline-flex items-center gap-1 rounded border border-[#E5E1DA] bg-white px-1.5 py-0.5">
                                      <Camera className="h-3 w-3 text-[#2D5A4C]" />
                                      {shotCount}
                                    </span>
                                  )}
                                  {item.buildPyPath && (
                                    <span className="inline-flex items-center gap-1 rounded border border-[#E5E1DA] bg-white px-1.5 py-0.5 font-mono">
                                      <FileCode2 className="h-3 w-3 text-[#9A6316]" />
                                      build.py
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-[#EFECE6] pt-2.5">
                              {item.viewable && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onAppendModelToWorld(item);
                                    onClose();
                                  }}
                                  title="Append this model into the active 3D scene"
                                  className="inline-flex items-center gap-1 rounded-lg border border-[#D8D3CA] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#1C1B19] transition-colors hover:border-[#2D5A4C] hover:text-[#2D5A4C]"
                                >
                                  <Plus className="h-3 w-3" />
                                  Append
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={!item.viewable}
                                onClick={() => {
                                  onSelectModel(item);
                                  onClose();
                                }}
                                className={`rounded-lg px-3 py-1.5 text-[11.5px] font-medium transition-colors ${
                                  isActive
                                    ? 'bg-[#EBF2EF] text-[#22453A]'
                                    : 'bg-[#1C1B19] text-white hover:bg-[#2D5A4C] disabled:opacity-40'
                                }`}
                              >
                                {isActive ? 'Reload' : 'Open Model'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
