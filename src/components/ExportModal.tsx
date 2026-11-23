import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import type { GitHubCiStatus, ServerConfig } from '../types';
import {
  EXPORT_FORMATS,
  formatExportFilename,
  triggerBlobDownload,
  type ExportFormatId,
} from '../utils/modelExporters';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  modelName: string | null;
  hasActiveModel: boolean;
  serverConfig: ServerConfig | null;
  ciStatus: GitHubCiStatus | null;
  driveUser: User | null;
  onExportGeometry: (format: Exclude<ExportFormatId, 'blend' | 'png'>) => Promise<{ blob: Blob; filename: string }>;
  onCaptureSnapshotPng: () => Promise<Blob>;
  onTriggerCloudBlendBuild: (pyScript: string, commitNote: string) => Promise<void>;
  onPushExportToGitHub: (blob: Blob, filename: string) => Promise<void>;
  onPushExportToDrive: (blob: Blob, filename: string) => Promise<void>;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  open,
  onClose,
  modelName,
  hasActiveModel,
  serverConfig,
  ciStatus,
  driveUser,
  onExportGeometry,
  onCaptureSnapshotPng,
  onTriggerCloudBlendBuild,
  onPushExportToGitHub,
  onPushExportToDrive,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormatId>('glb');
  const [busyFormat, setBusyFormat] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [confirmDrivePublish, setConfirmDrivePublish] = useState(false);

  if (!open) return null;

  const baseName = modelName || 'Apex_Model';
  const hasLatestBlendRelease = Boolean(ciStatus?.assets?.some((a) => a.name === 'model.blend'));
  const selectedSpec = EXPORT_FORMATS.find((f) => f.id === selectedFormat)!;

  const handleDownload = async (format: ExportFormatId) => {
    setBusyFormat(format);
    setFeedback(null);
    try {
      if (format === 'png') {
        const blob = await onCaptureSnapshotPng();
        const filename = formatExportFilename(baseName, '.png');
        triggerBlobDownload(blob, filename);
        setFeedback({ kind: 'success', text: `Saved viewport snapshot ${filename} (${(blob.size / 1024).toFixed(1)} KB).` });
        return;
      }

      if (format === 'blend') {
        if (!hasLatestBlendRelease) {
          throw new Error(
            'No latest CI model.blend release found yet. Click "Build Native .blend via Cloud CI" below to generate one with Blender 4.2 LTS.'
          );
        }
        const res = await fetch('/api/github/artifacts/model.blend');
        if (!res.ok) {
          throw new Error(`Failed to fetch model.blend (${res.status}).`);
        }
        const blob = await res.blob();
        const filename = formatExportFilename(baseName, '.blend');
        triggerBlobDownload(blob, filename);
        setFeedback({ kind: 'success', text: `Downloaded native Blender 4.2 file ${filename}.` });
        return;
      }

      const { blob, filename } = await onExportGeometry(format);
      triggerBlobDownload(blob, filename);
      setFeedback({
        kind: 'success',
        text: `Exported ${filename} (${(blob.size / 1024).toFixed(1)} KB) directly from live 3D scene.`,
      });
    } catch (err) {
      setFeedback({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Export failed.',
      });
    } finally {
      setBusyFormat(null);
    }
  };

  const handleBuildBlendInCi = async () => {
    setBusyFormat('ci-blend');
    setFeedback(null);
    try {
      const { blob } = await onExportGeometry('py');
      const pyScript = await blob.text();
      await onTriggerCloudBlendBuild(pyScript, `Export ${baseName} to native .blend via Blender 4.2 CI`);
      setFeedback({
        kind: 'success',
        text: 'Committed Blender 4.2 reconstruction script to GitHub Actions CI. Your native .blend release is building.',
      });
    } catch (err) {
      setFeedback({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Could not trigger Cloud CI .blend build.',
      });
    } finally {
      setBusyFormat(null);
    }
  };

  const handleCloudPublish = async (dest: 'github' | 'drive') => {
    if (dest === 'drive' && !confirmDrivePublish) {
      setConfirmDrivePublish(true);
      return;
    }
    setConfirmDrivePublish(false);
    setBusyFormat(`publish-${dest}`);
    setFeedback(null);
    try {
      const exportFmt: Exclude<ExportFormatId, 'blend' | 'png'> =
        selectedFormat === 'obj' || selectedFormat === 'stl' || selectedFormat === 'gltf' ? selectedFormat : 'glb';
      const { blob, filename } = await onExportGeometry(exportFmt);
      if (dest === 'github') {
        await onPushExportToGitHub(blob, filename);
        setFeedback({ kind: 'success', text: `Pushed ${filename} to GitHub repository models/ directory.` });
      } else {
        await onPushExportToDrive(blob, filename);
        setFeedback({ kind: 'success', text: `Uploaded ${filename} to your Google Drive.` });
      }
    } catch (err) {
      setFeedback({ kind: 'error', text: err instanceof Error ? err.message : 'Cloud publish failed.' });
    } finally {
      setBusyFormat(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45"
      role="dialog"
      aria-modal="true"
      aria-label="Export 3D Model"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-[#cbd5e1] w-full max-w-3xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="h-12 bg-[#f8f9fa] border-b border-[#dcdfe4] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded bg-[#111318] text-white">
              <span className="material-symbols-outlined text-[15px]">ios_share</span>
            </span>
            <div>
              <h2 className="text-xs font-bold text-[#111318] uppercase tracking-wide">
                Multi-Format 3D Export Pipeline
              </h2>
              <p className="text-[10px] font-mono text-[#64748b]">
                Active Target: {hasActiveModel ? baseName : 'Point Cloud Stage (Load a model for mesh export)'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-md hover:bg-[#e5e8ec] text-[#64748b] hover:text-black flex items-center justify-center cursor-pointer"
            aria-label="Close Export Dialog"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Format Selection Grid */}
        <div className="p-4 overflow-y-auto space-y-4">
          {feedback && (
            <div
              className={`p-2.5 rounded-lg border text-xs font-mono ${
                feedback.kind === 'error'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-[#f0f2f5] border-[#cbd5e1] text-[#111318]'
              }`}
            >
              {feedback.text}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {EXPORT_FORMATS.map((fmt) => {
              const active = selectedFormat === fmt.id;
              return (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => {
                    setSelectedFormat(fmt.id);
                    setFeedback(null);
                  }}
                  className={`p-3 rounded-lg text-left border transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    active
                      ? 'bg-[#111318] text-white border-[#111318] shadow-sm'
                      : 'bg-[#f8f9fa] hover:bg-white text-[#111318] border-[#dcdfe4] hover:border-[#111318]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold uppercase">{fmt.ext}</span>
                    <span
                      className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded ${
                        active ? 'bg-white/20 text-white' : 'bg-[#e5e8ec] text-[#64748b]'
                      }`}
                    >
                      {fmt.category}
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold leading-tight">{fmt.label}</div>
                  <div className={`text-[10px] leading-snug ${active ? 'text-slate-300' : 'text-[#64748b]'}`}>
                    {fmt.description}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Format Action Box */}
          <div className="bg-[#f8f9fa] rounded-lg border border-[#dcdfe4] p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-[#111318]">
                  Output File: <span className="font-mono">{formatExportFilename(baseName, selectedSpec.ext)}</span>
                </div>
                <div className="text-[11px] text-[#64748b]">{selectedSpec.description}</div>
              </div>
              <button
                type="button"
                disabled={Boolean(busyFormat) || (!hasActiveModel && selectedFormat !== 'png' && selectedFormat !== 'blend')}
                onClick={() => void handleDownload(selectedFormat)}
                className="px-4 py-2 rounded-lg bg-[#111318] hover:bg-black disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">
                  {busyFormat === selectedFormat ? 'progress_activity' : 'download'}
                </span>
                <span>
                  {busyFormat === selectedFormat ? 'Exporting...' : `Export ${selectedSpec.ext.toUpperCase()}`}
                </span>
              </button>
            </div>

            {selectedFormat === 'blend' && (
              <div className="pt-2.5 border-t border-[#dcdfe4] flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="text-[#64748b]">
                  {hasLatestBlendRelease
                    ? 'Latest GitHub Release model.blend is ready to download, or rebuild from current viewport mesh.'
                    : 'Generate a native Blender 4.2 LTS .blend binary via headless GitHub Actions CI.'}
                </span>
                <button
                  type="button"
                  disabled={!hasActiveModel || !serverConfig?.githubConfigured || Boolean(busyFormat)}
                  onClick={() => void handleBuildBlendInCi()}
                  className="px-3 py-1.5 rounded-md bg-white hover:bg-[#111318] hover:text-white border border-[#111318] text-[#111318] font-semibold text-[11px] disabled:opacity-40 transition-colors cursor-pointer"
                >
                  {busyFormat === 'ci-blend' ? 'Submitting to CI...' : 'Build Native .blend via Cloud CI'}
                </button>
              </div>
            )}

            {/* Direct Publish to GitHub / Google Drive */}
            <div className="pt-2.5 border-t border-[#dcdfe4] flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-mono text-[#64748b]">
                Cloud Publish (.glb / .gltf / .obj / .stl):
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!hasActiveModel || !serverConfig?.githubConfigured || Boolean(busyFormat)}
                  onClick={() => void handleCloudPublish('github')}
                  className="px-3 py-1 rounded bg-white hover:bg-[#f0f2f5] border border-[#dcdfe4] text-[#111318] text-[11px] font-medium disabled:opacity-40 cursor-pointer"
                >
                  {busyFormat === 'publish-github' ? 'Pushing...' : 'Push to GitHub Repo'}
                </button>
                <button
                  type="button"
                  disabled={!hasActiveModel || !driveUser || Boolean(busyFormat)}
                  onClick={() => void handleCloudPublish('drive')}
                  className="px-3 py-1 rounded bg-white hover:bg-[#f0f2f5] border border-[#dcdfe4] text-[#111318] text-[11px] font-medium disabled:opacity-40 cursor-pointer"
                  title={driveUser ? 'Upload exported model to Google Drive' : 'Sign in to Google Drive in Model Assets first'}
                >
                  {busyFormat === 'publish-drive' ? 'Uploading...' : 'Save to Google Drive'}
                </button>
              </div>
            </div>

            {confirmDrivePublish && (
              <div className="p-2.5 rounded bg-white border border-[#111318] flex items-center justify-between gap-2 text-xs">
                <span className="text-[#111318]">
                  Confirm saving exported model to your connected Google Drive account?
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setConfirmDrivePublish(false)}
                    className="px-2 py-1 rounded border border-[#dcdfe4] text-[11px] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCloudPublish('drive')}
                    className="px-2.5 py-1 rounded bg-[#111318] text-white text-[11px] font-semibold cursor-pointer"
                  >
                    Confirm Drive Save
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
