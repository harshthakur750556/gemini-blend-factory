import React, { useState } from 'react';
import {
  CheckCircle2,
  CloudUpload,
  Download,
  ExternalLink,
  HardDrive,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import { EXPORT_FORMATS, formatExportFilename, type ExportFormatId } from '../utils/modelExporters';

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
  onDownloadFormat: (format: ExportFormatId) => Promise<void>;
  onBuildBlendViaCloudCi: () => Promise<void>;
  onPushCurrentToGithub: () => Promise<void>;
  onSaveCurrentToDrive: () => Promise<void>;
  onSignInDrive: () => Promise<void>;
}

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
  onDownloadFormat,
  onBuildBlendViaCloudCi,
  onPushCurrentToGithub,
  onSaveCurrentToDrive,
  onSignInDrive,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormatId>('glb');
  const [confirmDriveSave, setConfirmDriveSave] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [workingAction, setWorkingAction] = useState<string | null>(null);

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
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#E5E1DA] bg-white shadow-[0_24px_64px_-16px_rgba(28,27,25,0.22)] animate-atelier-modal">
        <div className="flex items-start justify-between gap-4 border-b border-[#EFECE6] px-6 py-5">
          <div>
            <h2
              id="export-dialog-title"
              className="font-display text-[20px] font-medium tracking-[-0.015em] text-[#1C1B19]"
            >
              Export Asset
            </h2>
            <p className="mt-0.5 text-[12px] text-[#5A564F]">
              {hasActiveModel
                ? `${activeModelName} · Choose a geometry, Blender, or render format.`
                : 'Viewport is in Point Cloud stage · Load a model to export meshes, or capture PNG.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export dialog"
            className="rounded-lg p-1.5 text-[#847E75] transition-colors hover:bg-[#F5F3EF] hover:text-[#1C1B19]"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {EXPORT_FORMATS.map((fmt) => {
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
                  <div className="mt-1.5 text-[12.5px] font-medium text-[#1C1B19]">{fmt.label}</div>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#6E6960]">
                    {fmt.description}
                  </p>
                </button>
              );
            })}
          </div>

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

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#EBE6DD] bg-white p-4">
              <div className="flex items-center gap-2 text-[12.5px] font-medium text-[#1C1B19]">
                <CloudUpload className="h-4 w-4 text-[#2D5A4C]" />
                Push to GitHub Repository
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-[#6E6960]">
                Saves the active model as a `.glb` under `models/` in your connected repository.
              </p>
              <button
                type="button"
                disabled={busy || !githubConfigured || !hasActiveModel}
                onClick={() => runAction('Uploaded model to GitHub repository.', onPushCurrentToGithub)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#D3CEC4] bg-[#FAF9F6] px-3 py-1.5 text-[11.5px] font-medium text-[#1C1B19] transition-colors hover:bg-[#F0EDE6] disabled:opacity-45"
              >
                <ExternalLink className="h-3.5 w-3.5 text-[#5A564F]" />
                {githubConfigured ? 'Push .glb to GitHub' : 'GitHub Not Configured'}
              </button>
            </div>

            <div className="rounded-xl border border-[#EBE6DD] bg-white p-4">
              <div className="flex items-center gap-2 text-[12.5px] font-medium text-[#1C1B19]">
                <HardDrive className="h-4 w-4 text-[#2D5A4C]" />
                Save to Google Drive
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-[#6E6960]">
                {driveSignedIn
                  ? `Connected as ${driveUserEmail || 'Google Account'}.`
                  : 'Sign in with Google to save exported .glb assets directly to Drive.'}
              </p>

              {!driveSignedIn ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => runAction('Signed in to Google Drive.', onSignInDrive)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#D3CEC4] bg-[#FAF9F6] px-3 py-1.5 text-[11.5px] font-medium text-[#1C1B19] transition-colors hover:bg-[#F0EDE6] disabled:opacity-45"
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
                      await runAction('Saved .glb to Google Drive.', onSaveCurrentToDrive);
                    }}
                    className="rounded-lg bg-[#2D5A4C] px-3 py-1.5 text-[11.5px] font-medium text-white hover:bg-[#22453A] disabled:opacity-45"
                  >
                    Confirm Upload
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDriveSave(false)}
                    className="rounded-lg border border-[#D3CEC4] px-3 py-1.5 text-[11.5px] text-[#5A564F] hover:text-[#1C1B19]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy || !hasActiveModel}
                  onClick={() => setConfirmDriveSave(true)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#D3CEC4] bg-[#FAF9F6] px-3 py-1.5 text-[11.5px] font-medium text-[#1C1B19] transition-colors hover:bg-[#F0EDE6] disabled:opacity-45"
                >
                  Save .glb to Drive
                </button>
              )}
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
