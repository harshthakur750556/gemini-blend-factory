import React, { useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Box,
  Camera,
  CheckCircle2,
  CloudUpload,
  Download,
  FileCode2,
  Gamepad2,
  HardDrive,
  Loader2,
  Printer,
  Sparkles,
  X,
} from 'lucide-react';
import {
  EXPORT_FORMATS,
  formatExportFilename,
  type ExportFormatId,
  type ExportFormatSpec,
} from '../utils/modelExporters';
import type { ModelGroupName } from '../types';

interface ExportDialogProps {
  open: boolean;
  activeModelName: string | null;
  hasActiveModel: boolean;
  githubConfigured: boolean;
  hasLatestBlendArtifact: boolean;
  driveSignedIn: boolean;
  driveUserEmail: string | null;
  isBusy: boolean;
  onClose: () => void;
  onOpenConverter: () => void;
  onDownloadFormat: (format: ExportFormatId) => Promise<void>;
  onBuildBlendViaCloudCi: () => Promise<void>;
  onPushBundleToGithub: (group: ModelGroupName) => Promise<void>;
  onBackupBundleToDrive: (group: ModelGroupName) => Promise<void>;
  onSignInDrive: () => Promise<void>;
}

type CategoryTab = 'all' | ExportFormatSpec['category'];

const CATEGORY_TABS: Array<{ id: CategoryTab; label: string; icon: React.ReactNode }> = [
  { id: 'all', label: 'All (16)', icon: <Box className="h-3.5 w-3.5" /> },
  { id: 'engine', label: 'Game Engines', icon: <Gamepad2 className="h-3.5 w-3.5" /> },
  { id: 'cad', label: 'CAD & Print', icon: <Printer className="h-3.5 w-3.5" /> },
  { id: 'mesh', label: '3D Mesh', icon: <Box className="h-3.5 w-3.5" /> },
  { id: 'blender', label: 'Blender', icon: <FileCode2 className="h-3.5 w-3.5" /> },
  { id: 'render', label: 'Render', icon: <Camera className="h-3.5 w-3.5" /> },
];

export const ExportDialog: React.FC<ExportDialogProps> = ({
  open,
  activeModelName,
  hasActiveModel,
  githubConfigured,
  hasLatestBlendArtifact,
  driveSignedIn,
  driveUserEmail,
  isBusy,
  onClose,
  onOpenConverter,
  onDownloadFormat,
  onBuildBlendViaCloudCi,
  onPushBundleToGithub,
  onBackupBundleToDrive,
  onSignInDrive,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormatId>('glb');
  const [categoryFilter, setCategoryFilter] = useState<CategoryTab>('all');
  const [bundleGroup, setBundleGroup] = useState<ModelGroupName>('Props');
  const [confirmDriveSave, setConfirmDriveSave] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [workingAction, setWorkingAction] = useState<string | null>(null);

  const visibleFormats = useMemo(() => {
    if (categoryFilter === 'all') return EXPORT_FORMATS;
    return EXPORT_FORMATS.filter((f) => f.category === categoryFilter);
  }, [categoryFilter]);

  if (!open) return null;

  const activeSpec = EXPORT_FORMATS.find((f) => f.id === selectedFormat) || EXPORT_FORMATS[0];
  const previewFilename = formatExportFilename(activeModelName || 'stone-lantern', activeSpec.ext);
  const needsModel = selectedFormat !== 'png' && selectedFormat !== 'blend';
  const busy = isBusy || Boolean(workingAction);

  const runAction = async (label: string, fn: () => Promise<void>) => {
    setErrorMessage(null);
    setStatusMessage(null);
    setWorkingAction(label);
    try {
      await fn();
      setStatusMessage(label);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setWorkingAction(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1B19]/35 p-4 animate-atelier-fade"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-dialog-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#E5E1DA] bg-white shadow-[0_24px_64px_-16px_rgba(28,27,25,0.22)] animate-atelier-modal">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#EFECE6] px-6 py-4">
          <div>
            <h2
              id="export-dialog-title"
              className="font-display text-[20px] font-medium tracking-[-0.015em] text-[#1C1B19]"
            >
              Universal 3D Export & Cloud Bundle
            </h2>
            <p className="mt-0.5 text-[12px] text-[#5A564F]">
              {hasActiveModel
                ? `${activeModelName} · Export for Unreal, Unity, Godot, CAD (STEP/DXF/STL/3MF), USD, or native Blender.`
                : 'Viewport is in Point Cloud stage · Load or assemble a model to export geometry.'}
            </p>
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
              Convert Local File
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close export dialog"
              className="rounded-lg p-1.5 text-[#847E75] transition-colors hover:bg-[#F5F3EF] hover:text-[#1C1B19]"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1 border-b border-[#EFECE6] bg-[#FAF9F6] px-6 py-2.5">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategoryFilter(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium transition-colors ${
                categoryFilter === tab.id
                  ? 'bg-[#EBF2EF] text-[#1D4438]'
                  : 'text-[#5A564F] hover:bg-white hover:text-[#1C1B19]'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {visibleFormats.map((fmt) => {
              const selected = selectedFormat === fmt.id;
              return (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => {
                    setSelectedFormat(fmt.id);
                    setErrorMessage(null);
                    setStatusMessage(null);
                  }}
                  className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition-all ${
                    selected
                      ? 'border-[#2D5A4C] bg-[#F4F8F6] shadow-[0_2px_10px_-4px_rgba(45,90,76,0.2)]'
                      : 'border-[#E8E4DD] bg-[#FCFBF9] hover:border-[#CFC9BE] hover:bg-white'
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="font-mono text-[12px] font-semibold text-[#1C1B19]">
                      {fmt.ext}
                    </span>
                    <span className="text-[10px] font-medium capitalize text-[#847E75]">
                      {fmt.category}
                    </span>
                  </div>
                  <div className="mt-1 text-[12.5px] font-medium text-[#1C1B19]">{fmt.label}</div>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#6E6960]">
                    {fmt.description}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Direct Download Bar */}
          <div className="mt-5 rounded-xl border border-[#EBE6DD] bg-[#FAF9F6] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-medium text-[#847E75]">Output File</div>
                <div className="mt-0.5 font-mono text-[13px] font-medium text-[#1C1B19]">
                  {previewFilename}
                </div>
              </div>
              <button
                type="button"
                disabled={busy || (needsModel && !hasActiveModel)}
                onClick={() =>
                  runAction(`Exported ${previewFilename}`, () => onDownloadFormat(selectedFormat))
                }
                className="inline-flex items-center gap-2 rounded-lg bg-[#2D5A4C] px-4 py-2 text-[12px] font-medium text-white transition-colors hover:bg-[#22453A] disabled:opacity-45"
              >
                {workingAction ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Download {activeSpec.ext}
              </button>
            </div>

            {selectedFormat === 'blend' && (
              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-[#EAE5DC] pt-3 text-[11.5px] text-[#5A564F]">
                <span>
                  {hasLatestBlendArtifact
                    ? 'A native Blender 4.2 .blend build is ready on your latest Cloud CI release.'
                    : 'Trigger headless Blender 4.2 Cloud CI to compile a native .blend from the active geometry.'}
                </span>
                <button
                  type="button"
                  disabled={busy || !githubConfigured || !hasActiveModel}
                  onClick={() =>
                    runAction('Triggered native .blend Cloud CI build.', onBuildBlendViaCloudCi)
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#D3CEC4] bg-white px-3 py-1.5 text-[11px] font-medium text-[#1C1B19] transition-colors hover:bg-[#F5F3EF] disabled:opacity-45"
                >
                  <Sparkles className="h-3.5 w-3.5 text-[#2D5A4C]" />
                  Build Native .blend via Cloud CI
                </button>
              </div>
            )}
          </div>

          {/* Full Bundle Cloud Sync (GitHub Default + Optional Drive Copy) */}
          <div className="mt-4 rounded-xl border border-[#EBE6DD] bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[12.5px] font-medium text-[#1C1B19]">
                Save Full Model Bundle (Mesh + Extracted Textures + 4-Angle Screenshots + Manifest)
              </div>
              <select
                value={bundleGroup}
                onChange={(e) => setBundleGroup(e.target.value as ModelGroupName)}
                aria-label="Model bundle group"
                className="rounded-lg border border-[#E2DDD4] bg-[#FAF9F6] px-2.5 py-1 text-[11.5px] text-[#1C1B19] outline-none focus:border-[#2D5A4C]"
              >
                <option value="Props">Group: Props</option>
                <option value="Architecture">Group: Architecture</option>
                <option value="Environment">Group: Environment</option>
                <option value="World_Assemblies">Group: World Assemblies</option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#ECE8E1] bg-[#FAF9F6] p-3.5">
                <div className="flex items-center gap-2 text-[12px] font-medium text-[#1C1B19]">
                  <CloudUpload className="h-4 w-4 text-[#2D5A4C]" />
                  GitHub Subfolder (Default Storage)
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-[#6E6960]">
                  Commits `.glb`, `textures/*`, `screenshots/*`, and `manifest.json` under{' '}
                  <span className="font-mono">models/&lt;slug&gt;/</span>.
                </p>
                <button
                  type="button"
                  disabled={busy || !githubConfigured || !hasActiveModel}
                  onClick={() =>
                    runAction('Saved complete model bundle to GitHub models/ subfolder.', () =>
                      onPushBundleToGithub(bundleGroup)
                    )
                  }
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#2D5A4C] px-3 py-1.5 text-[11.5px] font-medium text-white transition-colors hover:bg-[#22453A] disabled:opacity-45"
                >
                  <CloudUpload className="h-3.5 w-3.5" />
                  {githubConfigured ? 'Save Bundle to GitHub' : 'GitHub Not Configured'}
                </button>
              </div>

              <div className="rounded-xl border border-[#ECE8E1] bg-[#FAF9F6] p-3.5">
                <div className="flex items-center gap-2 text-[12px] font-medium text-[#1C1B19]">
                  <HardDrive className="h-4 w-4 text-[#436B95]" />
                  Google Drive Copy (With Textures & Screenshots)
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-[#6E6960]">
                  {driveSignedIn
                    ? `Connected as ${driveUserEmail || 'Google Account'}. Copies to BlendFactory_Backup/${bundleGroup}/.`
                    : 'Sign in with Google to save an organized folder copy to Drive.'}
                </p>

                {!driveSignedIn ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runAction('Signed in to Google Drive.', onSignInDrive)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#D3CEC4] bg-white px-3 py-1.5 text-[11.5px] font-medium text-[#1C1B19] transition-colors hover:bg-[#F0EDE6] disabled:opacity-45"
                  >
                    Sign in with Google
                  </button>
                ) : confirmDriveSave ? (
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busy || !hasActiveModel}
                      onClick={async () => {
                        setConfirmDriveSave(false);
                        await runAction('Backed up full model bundle to Google Drive.', () =>
                          onBackupBundleToDrive(bundleGroup)
                        );
                      }}
                      className="rounded-lg bg-[#2D5A4C] px-3 py-1.5 text-[11.5px] font-medium text-white hover:bg-[#22453A] disabled:opacity-45"
                    >
                      Confirm Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDriveSave(false)}
                      className="rounded-lg border border-[#D3CEC4] bg-white px-3 py-1.5 text-[11.5px] text-[#5A564F] hover:text-[#1C1B19]"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={busy || !hasActiveModel}
                    onClick={() => setConfirmDriveSave(true)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#D3CEC4] bg-white px-3 py-1.5 text-[11.5px] font-medium text-[#1C1B19] transition-colors hover:bg-[#F0EDE6] disabled:opacity-45"
                  >
                    Copy Full Bundle to Drive
                  </button>
                )}
              </div>
            </div>
          </div>

          {statusMessage && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#CFE2DA] bg-[#F2F8F5] px-3.5 py-2.5 text-[12px] text-[#22453A]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="mt-4 rounded-lg border border-[#F0D0D1] bg-[#FDF4F4] px-3.5 py-2.5 text-[12px] text-[#9E3134]">
              {errorMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
