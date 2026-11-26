import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  Box,
  Building2,
  Camera,
  CheckSquare,
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
  X,
} from 'lucide-react';
import type { AvailableModelItem, ModelGroupName } from '../types';

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
  onImportLocalFile: (file: File) => void;
  onUploadToGithub: (file: File, group: ModelGroupName) => void;
  onSaveActiveStageToGithub: (group: ModelGroupName) => Promise<void>;
  onBackupSelectedToDrive: (items: AvailableModelItem[]) => Promise<void>;
  onOpenConverter: () => void;
  onSignInDrive: () => void;
  onSignOutDrive: () => void;
  onRefreshAll: () => void;
  onLinkLocalFolder: () => void;
}

type GroupFilter =
  | 'all'
  | 'Sample'
  | 'Architecture'
  | 'Props'
  | 'Environment'
  | 'World_Assemblies'
  | 'Cloud_CI'
  | 'drive'
  | 'local';
type SortMode = 'recent' | 'name' | 'size';

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return 'Procedural';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getGroupIcon(group: ModelGroupName | GroupFilter) {
  switch (group) {
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
      return { label: 'Curated Sample', icon: <Sparkles className="h-3 w-3 text-[#2D5A4C]" /> };
    case 'github-release':
      return { label: 'GitHub CI', icon: <Cpu className="h-3 w-3 text-[#2D5A4C]" /> };
    case 'github-repo':
      return { label: 'GitHub models/', icon: <FolderGit2 className="h-3 w-3 text-[#2D5A4C]" /> };
    case 'google-drive':
      return { label: 'Google Drive', icon: <HardDrive className="h-3 w-3 text-[#436B95]" /> };
    case 'local-file':
      return { label: 'Local File', icon: <Box className="h-3 w-3 text-[#6E6960]" /> };
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
  const [filter, setFilter] = useState<GroupFilter>('all');
  const [sortBy, setSortBy] = useState<SortMode>('recent');
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saveGroup, setSaveGroup] = useState<ModelGroupName>('Props');
  const [isBackingUpDrive, setIsBackingUpDrive] = useState(false);
  const [isSavingStage, setIsSavingStage] = useState(false);

  const localInputRef = useRef<HTMLInputElement | null>(null);
  const githubInputRef = useRef<HTMLInputElement | null>(null);

  const filteredModels = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = models.filter((item) => {
      if (filter === 'drive' && item.source !== 'google-drive') return false;
      if (filter === 'local' && item.source !== 'local-file') return false;
      if (
        filter !== 'all' &&
        filter !== 'drive' &&
        filter !== 'local' &&
        item.group !== filter
      ) {
        return false;
      }
      if (q) {
        const hay = `${item.name} ${item.slug} ${item.group} ${item.format} ${item.description || ''}`.toLowerCase();
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

  const tabs: Array<{ id: GroupFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'Sample', label: 'Sample' },
    { id: 'Architecture', label: 'Architecture' },
    { id: 'Props', label: 'Props' },
    { id: 'Environment', label: 'Environment' },
    { id: 'World_Assemblies', label: 'Worlds' },
    { id: 'Cloud_CI', label: 'Cloud CI' },
    { id: 'drive', label: 'Drive' },
    { id: 'local', label: 'Local' },
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
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#1C1B19]/35 p-3 sm:p-4 animate-atelier-fade"
      role="dialog"
      aria-modal="true"
      aria-labelledby="library-modal-title"
    >
      <div className="flex h-[min(88vh,820px)] max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#E5E1DA] bg-white shadow-[0_24px_64px_-16px_rgba(28,27,25,0.22)] animate-atelier-modal">
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#EFECE6] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EBF2EF] text-[#2D5A4C]">
              <Layers className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2
                id="library-modal-title"
                className="font-display text-[20px] font-medium tracking-[-0.015em] text-[#1C1B19]"
              >
                Organized Model Library
              </h2>
              <p className="mt-0.5 text-[12px] text-[#5A564F]">
                Default storage in GitHub <span className="font-mono">models/&lt;slug&gt;/</span>{' '}
                (with textures & screenshots). Select any model or group to copy to Google Drive.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenConverter();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E1DA] bg-[#FAF9F6] px-3 py-1.5 text-[11.5px] font-medium text-[#1C1B19] transition-colors hover:bg-[#F0EDE6]"
            >
              <ArrowRightLeft className="h-3.5 w-3.5 text-[#2D5A4C]" />
              Converter
            </button>
            <button
              type="button"
              onClick={onRefreshAll}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E1DA] bg-[#FAF9F6] px-3 py-1.5 text-[11.5px] font-medium text-[#5A564F] transition-colors hover:bg-[#F0EDE6] hover:text-[#1C1B19] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isBusy ? 'animate-spin' : ''}`} />
              Sync
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

        {/* Actions Bar */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2.5 border-b border-[#EFECE6] bg-[#FAF9F6] px-6 py-3">
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
              accept=".glb,.gltf,.obj,.stl,.ply,.fbx,.dae,.3mf,.amf,.off,.dxf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImportLocalFile(f);
                e.target.value = '';
              }}
            />

            {githubConfigured && (
              <>
                <div className="flex items-center rounded-lg border border-[#D8D3CA] bg-white">
                  <select
                    value={saveGroup}
                    onChange={(e) => setSaveGroup(e.target.value as ModelGroupName)}
                    aria-label="Target GitHub model group"
                    className="rounded-l-lg border-r border-[#EAE5DC] bg-[#FAF9F6] px-2 py-1.5 text-[11.5px] text-[#5A564F] outline-none"
                  >
                    <option value="Props">Props</option>
                    <option value="Architecture">Architecture</option>
                    <option value="Environment">Environment</option>
                    <option value="World_Assemblies">Worlds</option>
                  </select>
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#1C1B19] transition-colors hover:bg-[#F5F3EF] disabled:opacity-45"
                  >
                    {isSavingStage ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#2D5A4C]" />
                    ) : (
                      <CloudUpload className="h-3.5 w-3.5 text-[#2D5A4C]" />
                    )}
                    Save Active to GitHub
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => githubInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8D3CA] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1C1B19] transition-colors hover:bg-[#F5F3EF]"
                >
                  <FolderGit2 className="h-3.5 w-3.5 text-[#2D5A4C]" />
                  Upload File to GitHub
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
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8D3CA] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1C1B19] transition-colors hover:bg-[#F5F3EF]"
              >
                <HardDrive className="h-3.5 w-3.5 text-[#436B95]" />
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
                {localFolderName ? localFolderName : 'Local Folder'}
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

        {/* Selective / Group Google Drive Copy Banner */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#EFECE6] bg-[#F7F6F2] px-6 py-2">
          <div className="flex items-center gap-3 text-[12px]">
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
              {allVisibleSelected ? 'Deselect Visible Group' : `Select Visible Group (${filteredModels.length})`}
            </button>
            {selectedModels.length > 0 && (
              <span className="font-mono text-[11px] text-[#2D5A4C]">
                {selectedModels.length} model{selectedModels.length === 1 ? '' : 's'} selected
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={selectedModels.length === 0 || isBackingUpDrive}
            onClick={handleDriveBackupClick}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1C1B19] px-3 py-1.5 text-[11.5px] font-medium text-white transition-colors hover:bg-[#2D5A4C] disabled:opacity-35"
          >
            {isBackingUpDrive ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <HardDrive className="h-3.5 w-3.5" />
            )}
            {driveSignedIn
              ? `Copy Selected (${selectedModels.length}) + Textures & Assets to Drive`
              : `Connect Drive to Copy Selected (${selectedModels.length})`}
          </button>
        </div>

        {/* Group Tabs & Search */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#EFECE6] px-6 py-2.5">
          <div className="flex flex-wrap items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium transition-colors ${
                  filter === tab.id
                    ? 'bg-[#EBF2EF] text-[#22453A]'
                    : 'text-[#5A564F] hover:bg-[#F5F3EF] hover:text-[#1C1B19]'
                }`}
              >
                {getGroupIcon(tab.id)}
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
                placeholder="Search models..."
                className="w-40 rounded-lg border border-[#E5E1DA] bg-[#FAF9F6] py-1.5 pr-3 pl-8 text-[12px] text-[#1C1B19] outline-none transition-colors focus:border-[#2D5A4C] focus:bg-white"
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
              <option value="size">Size</option>
            </select>
          </div>
        </div>

        {/* Asset Cards — Scrollable Region */}
        <div className="atelier-scrollbar min-h-0 flex-1 overflow-y-scroll px-5 py-4 sm:px-6 sm:py-5">
          {filteredModels.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#DDD8CF] bg-[#FAF9F6] py-12 text-center">
              <Layers className="h-6 w-6 text-[#A29B90]" />
              <p className="mt-2.5 text-[13px] font-medium text-[#1C1B19]">
                No models in this group yet
              </p>
              <p className="mt-1 max-w-sm text-[12px] text-[#6E6960]">
                Save the active stage to GitHub <span className="font-mono">models/&lt;slug&gt;/</span> or
                import a local 3D mesh to populate this group.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filteredModels.map((item) => {
                const isActive = item.id === activeModelId;
                const isChecked = selectedIds.has(item.id);
                const src = sourceBadge(item.source);
                const texCount = item.textures?.length || 0;
                const shotCount = item.screenshots?.length || 0;

                return (
                  <div
                    key={item.id}
                    className={`flex flex-col justify-between rounded-xl border p-4 transition-all ${
                      isActive
                        ? 'border-[#2D5A4C] bg-[#F5F9F7]'
                        : isChecked
                          ? 'border-[#436B95] bg-[#F4F7FA]'
                          : 'border-[#E8E4DD] bg-[#FCFBF9] hover:border-[#CFC9BE] hover:bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-2.5">
                          <button
                            type="button"
                            onClick={() => toggleSelectItem(item.id)}
                            aria-label={`Select ${item.name} for Google Drive copy`}
                            className="mt-0.5 shrink-0 text-[#6E6960] hover:text-[#2D5A4C]"
                          >
                            {isChecked ? (
                              <CheckSquare className="h-4 w-4 text-[#2D5A4C]" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              {getFormatIcon(item.format)}
                              <h3 className="truncate text-[14px] font-semibold text-[#1C1B19]">
                                {item.name}
                              </h3>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#6E6960]">
                              <span className="inline-flex items-center gap-1">
                                {src.icon}
                                {src.label}
                              </span>
                              <span>·</span>
                              <span className="inline-flex items-center gap-1">
                                {getGroupIcon(item.group)}
                                {item.group.replace('_', ' ')}
                              </span>
                              <span>·</span>
                              <span className="font-mono">{formatBytes(item.sizeBytes)}</span>
                            </div>
                          </div>
                        </div>

                        <span className="shrink-0 rounded-md border border-[#E5E1DA] bg-white px-2 py-0.5 font-mono text-[10.5px] font-medium text-[#5A564F]">
                          {item.format}
                        </span>
                      </div>

                      {item.repoFolderPath && (
                        <div className="mt-2 font-mono text-[10.5px] text-[#2D5A4C]">
                          {item.repoFolderPath}/
                        </div>
                      )}

                      {item.description && (
                        <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#5A564F]">
                          {item.description}
                        </p>
                      )}

                      {/* Bundle asset indicators (textures, screenshots, build.py) */}
                      {(texCount > 0 || shotCount > 0 || item.buildPyPath) && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[10.5px] text-[#5A564F]">
                          {texCount > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-[#E5E1DA] bg-white px-2 py-0.5">
                              <ImageIcon className="h-3 w-3 text-[#2D5A4C]" />
                              {texCount} texture{texCount === 1 ? '' : 's'}
                            </span>
                          )}
                          {shotCount > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-[#E5E1DA] bg-white px-2 py-0.5">
                              <Camera className="h-3 w-3 text-[#2D5A4C]" />
                              {shotCount} screenshot{shotCount === 1 ? '' : 's'}
                            </span>
                          )}
                          {item.buildPyPath && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-[#E5E1DA] bg-white px-2 py-0.5 font-mono">
                              <FileCode2 className="h-3 w-3 text-[#9A6316]" />
                              build.py
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-[#EFECE6] pt-3">
                      <span className="text-[11px] text-[#847E75]">
                        {isActive
                          ? 'Active on stage'
                          : item.viewable
                            ? 'Ready to inspect or kitbash'
                            : 'CAD / Archive asset'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {item.viewable && (
                          <button
                            type="button"
                            onClick={() => {
                              onAppendModelToWorld(item);
                              onClose();
                            }}
                            title="Append this model into the current 3D World assembly"
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
                          {isActive ? 'Reload' : 'Load'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {githubSlug && (
          <div className="flex shrink-0 items-center justify-between border-t border-[#EFECE6] bg-[#FAF9F6] px-6 py-2.5 text-[11px] text-[#6E6960]">
            <span>
              Default GitHub Model Storage:{' '}
              <span className="font-mono text-[#1C1B19]">{githubSlug}/models/&lt;slug&gt;/</span>
            </span>
            <span>Selective Google Drive Backup: BlendFactory_Backup/&lt;group&gt;/&lt;slug&gt;/</span>
          </div>
        )}
      </div>
    </div>
  );
};
