import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  Box,
  CheckCircle2,
  CloudUpload,
  Compass,
  Cpu,
  Download,
  Eye,
  FileCode2,
  FolderUp,
  Gamepad2,
  Layers,
  Loader2,
  Printer,
  Ruler,
  X,
} from 'lucide-react';
import {
  EXPORT_FORMATS,
  formatExportFilename,
  triggerBlobDownload,
  type ExportFormatId,
} from '../utils/modelExporters';
import {
  convertParsedModelToFormat,
  parseLocal3DFile,
  type AxisConversionMode,
  type ParsedModelSummary,
} from '../utils/modelConverter';
import { sanitizeModelSlug } from '../utils/pathSafety';
import type { ModelGroupName } from '../types';

type ConvertibleTargetFormat = Exclude<ExportFormatId, 'blend' | 'png'>;

interface ConverterModalProps {
  open: boolean;
  onClose: () => void;
  githubConfigured: boolean;
  onPreviewParsedModel: (summary: ParsedModelSummary) => void;
  onSaveConvertedToGithub: (params: {
    blob: Blob;
    filename: string;
    slug: string;
    group: ModelGroupName;
    sourceGroup: ParsedModelSummary['group'];
  }) => Promise<void>;
  onNotify: (msg: string) => void;
}

const INPUT_ACCEPT = '.glb,.gltf,.obj,.stl,.ply,.fbx,.dae,.3mf,.amf,.off,.dxf';

const CONVERTIBLE_FORMATS = EXPORT_FORMATS.filter(
  (f): f is (typeof EXPORT_FORMATS)[number] & { id: ConvertibleTargetFormat } =>
    f.id !== 'blend' && f.id !== 'png'
);

const GROUPS: ModelGroupName[] = ['Props', 'Architecture', 'Environment', 'World_Assemblies'];

function categoryIcon(cat: string) {
  if (cat === 'engine') return <Gamepad2 className="h-3.5 w-3.5 text-[#2D5A4C]" />;
  if (cat === 'cad') return <Printer className="h-3.5 w-3.5 text-[#436B95]" />;
  if (cat === 'blender') return <FileCode2 className="h-3.5 w-3.5 text-[#9A6316]" />;
  return <Box className="h-3.5 w-3.5 text-[#6E6960]" />;
}

export const ConverterModal: React.FC<ConverterModalProps> = ({
  open,
  onClose,
  githubConfigured,
  onPreviewParsedModel,
  onSaveConvertedToGithub,
  onNotify,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [parsed, setParsed] = useState<ParsedModelSummary | null>(null);
  const [targetFormat, setTargetFormat] = useState<ConvertibleTargetFormat>('fbx');
  const [scaleMultiplier, setScaleMultiplier] = useState<number>(1);
  const [axisConversion, setAxisConversion] = useState<AxisConversionMode>('preserve');
  const [centerAndGround, setCenterAndGround] = useState<boolean>(true);
  const [targetGroup, setTargetGroup] = useState<ModelGroupName>('Props');
  const [targetSlug, setTargetSlug] = useState<string>('');
  const [isParsing, setIsParsing] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedSpec = useMemo(
    () => CONVERTIBLE_FORMATS.find((f) => f.id === targetFormat) || CONVERTIBLE_FORMATS[0],
    [targetFormat]
  );

  if (!open) return null;

  const handlePickFile = async (file: File) => {
    setIsParsing(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const summary = await parseLocal3DFile(file);
      setParsed(summary);
      setTargetSlug(sanitizeModelSlug(summary.group.name || file.name));
      setStatusMessage(
        `Parsed ${file.name} (${summary.meshCount} meshes, ${summary.triangleCount.toLocaleString()} tris).`
      );
    } catch (err) {
      setParsed(null);
      setErrorMessage(err instanceof Error ? err.message : 'Unable to parse 3D model.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleConvertDownload = async () => {
    if (!parsed) return;
    setIsConverting(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const { blob, filename } = await convertParsedModelToFormat({
        sourceGroup: parsed.group,
        sourceName: targetSlug || parsed.group.name,
        targetFormat,
        scaleMultiplier,
        axisConversion,
        centerAndGround,
      });
      triggerBlobDownload(blob, filename);
      setStatusMessage(`Converted & downloaded ${filename} (${(blob.size / 1024).toFixed(1)} KB).`);
      onNotify(`Converted to ${filename}`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Conversion failed.');
    } finally {
      setIsConverting(false);
    }
  };

  const handleConvertAndSaveGithub = async () => {
    if (!parsed) return;
    setIsConverting(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const slug = sanitizeModelSlug(targetSlug || parsed.group.name);
      const { blob, filename } = await convertParsedModelToFormat({
        sourceGroup: parsed.group,
        sourceName: slug,
        targetFormat,
        scaleMultiplier,
        axisConversion,
        centerAndGround,
      });
      await onSaveConvertedToGithub({
        blob,
        filename,
        slug,
        group: targetGroup,
        sourceGroup: parsed.group,
      });
      setStatusMessage(`Saved ${filename} into GitHub models/${slug}/`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to save to GitHub.');
    } finally {
      setIsConverting(false);
    }
  };

  const outputPreviewName = parsed
    ? formatExportFilename(targetSlug || parsed.group.name, selectedSpec.ext)
    : `converted-asset${selectedSpec.ext}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1B19]/35 p-4 animate-atelier-fade"
      role="dialog"
      aria-modal="true"
      aria-labelledby="converter-modal-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#E5E1DA] bg-white shadow-[0_24px_64px_-16px_rgba(28,27,25,0.22)] animate-atelier-modal">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#EFECE6] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EBF2EF] text-[#2D5A4C]">
              <ArrowRightLeft className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2
                id="converter-modal-title"
                className="font-display text-[20px] font-medium tracking-[-0.015em] text-[#1C1B19]"
              >
                3D File Format Converter
              </h2>
              <p className="mt-0.5 text-[12px] text-[#5A564F]">
                Convert any local 3D mesh across CAD, Game Engine (Unreal / Unity / Godot), USD,
                and Blender formats.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close 3D converter"
            className="rounded-lg p-1.5 text-[#847E75] transition-colors hover:bg-[#F5F3EF] hover:text-[#1C1B19]"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Step 1: Source File Drop / Picker */}
          <div className="rounded-xl border border-[#E5E1DA] bg-[#FAF9F6] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold tracking-[0.04em] text-[#5A564F] uppercase">
                  1. Source 3D Model
                </div>
                <p className="mt-0.5 text-[12px] text-[#6E6960]">
                  Accepts <span className="font-mono">.glb, .gltf, .obj, .stl, .ply, .fbx, .dae, .3mf, .amf, .off, .dxf</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isParsing}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#2D5A4C] px-3.5 py-2 text-[12px] font-medium text-white transition-colors hover:bg-[#22453A] disabled:opacity-50"
                >
                  {isParsing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FolderUp className="h-3.5 w-3.5" />
                  )}
                  {parsed ? 'Pick Different File' : 'Pick Local 3D File'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={INPUT_ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handlePickFile(f);
                    e.target.value = '';
                  }}
                />
                {parsed && (
                  <button
                    type="button"
                    onClick={() => {
                      onPreviewParsedModel(parsed);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#D3CEC4] bg-white px-3 py-2 text-[12px] font-medium text-[#1C1B19] transition-colors hover:bg-[#F5F3EF]"
                  >
                    <Eye className="h-3.5 w-3.5 text-[#2D5A4C]" />
                    Preview on Stage
                  </button>
                )}
              </div>
            </div>

            {parsed && (
              <div className="mt-3.5 grid grid-cols-2 gap-2.5 border-t border-[#EAE5DC] pt-3 sm:grid-cols-4">
                <div className="rounded-lg border border-[#EAE5DC] bg-white px-3 py-2">
                  <div className="text-[10.5px] text-[#847E75]">Source File</div>
                  <div className="mt-0.5 truncate font-mono text-[11.5px] font-medium text-[#1C1B19]">
                    {parsed.sourceFileName}
                  </div>
                </div>
                <div className="rounded-lg border border-[#EAE5DC] bg-white px-3 py-2">
                  <div className="text-[10.5px] text-[#847E75]">Meshes</div>
                  <div className="mt-0.5 font-mono text-[11.5px] font-medium text-[#1C1B19] tabular-nums">
                    {parsed.meshCount}
                  </div>
                </div>
                <div className="rounded-lg border border-[#EAE5DC] bg-white px-3 py-2">
                  <div className="text-[10.5px] text-[#847E75]">Triangles</div>
                  <div className="mt-0.5 font-mono text-[11.5px] font-medium text-[#1C1B19] tabular-nums">
                    {parsed.triangleCount.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-lg border border-[#EAE5DC] bg-white px-3 py-2">
                  <div className="text-[10.5px] text-[#847E75]">Bounds (m)</div>
                  <div className="mt-0.5 font-mono text-[11px] font-medium text-[#1C1B19] tabular-nums">
                    {parsed.boundsSize.map((v) => v.toFixed(2)).join(' × ')}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Transform & Axis Conversion Options */}
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-[#ECE8E1] bg-white p-4 sm:grid-cols-3">
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5A564F] uppercase">
                <Ruler className="h-3.5 w-3.5 text-[#2D5A4C]" />
                Scale Factor
              </label>
              <div className="mt-2 flex items-center gap-1.5">
                {[0.01, 0.1, 1, 10, 100].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setScaleMultiplier(s)}
                    className={`rounded-md border px-2 py-1 font-mono text-[11px] transition-colors ${
                      scaleMultiplier === s
                        ? 'border-[#2D5A4C] bg-[#EBF2EF] font-medium text-[#1D4438]'
                        : 'border-[#E5E1DA] bg-[#FAF9F6] text-[#5A564F] hover:text-[#1C1B19]'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5A564F] uppercase">
                <Compass className="h-3.5 w-3.5 text-[#2D5A4C]" />
                Up-Axis Conversion
              </label>
              <select
                value={axisConversion}
                onChange={(e) => setAxisConversion(e.target.value as AxisConversionMode)}
                className="mt-2 w-full rounded-lg border border-[#E2DDD4] bg-[#FAF9F6] px-2.5 py-1.5 text-[12px] text-[#1C1B19] outline-none focus:border-[#2D5A4C]"
              >
                <option value="preserve">Preserve Original Axis</option>
                <option value="z-up-to-y-up">Z-Up (Blender/CAD) → Y-Up (glTF/Unity)</option>
                <option value="y-up-to-z-up">Y-Up (glTF) → Z-Up (Unreal/Blender/CAD)</option>
              </select>
            </div>

            <div className="flex flex-col justify-between">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5A564F] uppercase">
                <Layers className="h-3.5 w-3.5 text-[#2D5A4C]" />
                Origin Alignment
              </label>
              <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-lg border border-[#E5E1DA] bg-[#FAF9F6] px-3 py-1.5 text-[12px] text-[#1C1B19]">
                <input
                  type="checkbox"
                  checked={centerAndGround}
                  onChange={(e) => setCenterAndGround(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[#2D5A4C]"
                />
                Center X/Z & Snap to Floor (Y = 0)
              </label>
            </div>
          </div>

          {/* Step 3: Target Extension Selector */}
          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-[0.04em] text-[#5A564F] uppercase">
                2. Target Extension ({CONVERTIBLE_FORMATS.length} Formats)
              </span>
              <span className="font-mono text-[11.5px] text-[#2D5A4C]">
                Output: {outputPreviewName}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {CONVERTIBLE_FORMATS.map((fmt) => {
                const active = targetFormat === fmt.id;
                return (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setTargetFormat(fmt.id)}
                    className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                      active
                        ? 'border-[#2D5A4C] bg-[#F2F8F5]'
                        : 'border-[#E8E4DD] bg-[#FCFBF9] hover:border-[#CFC9BE] hover:bg-white'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between gap-1.5">
                      <span className="inline-flex items-center gap-1.5 font-mono text-[12px] font-semibold text-[#1C1B19]">
                        {categoryIcon(fmt.category)}
                        {fmt.ext}
                      </span>
                      <span className="text-[10px] capitalize text-[#847E75]">{fmt.category}</span>
                    </div>
                    <div className="mt-1 truncate text-[11.5px] font-medium text-[#5A564F]">
                      {fmt.label.replace(/\s*\([^)]+\)/, '')}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 4: Output Actions */}
          <div className="rounded-xl border border-[#EBE6DD] bg-[#FAF9F6] p-4 space-y-3">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                <label className="text-[10.5px] font-semibold text-[#6E6960] uppercase">
                  Model Subfolder Slug
                </label>
                <input
                  type="text"
                  value={targetSlug}
                  onChange={(e) => setTargetSlug(e.target.value)}
                  placeholder="e.g. architectural-arch"
                  className="mt-1 w-full rounded-lg border border-[#E2DDD4] bg-white px-3 py-1.5 font-mono text-[12px] text-[#1C1B19] outline-none focus:border-[#2D5A4C]"
                />
              </div>
              <div>
                <label className="text-[10.5px] font-semibold text-[#6E6960] uppercase">
                  Library Group (for GitHub Save)
                </label>
                <select
                  value={targetGroup}
                  onChange={(e) => setTargetGroup(e.target.value as ModelGroupName)}
                  className="mt-1 w-full rounded-lg border border-[#E2DDD4] bg-white px-3 py-1.5 text-[12px] text-[#1C1B19] outline-none focus:border-[#2D5A4C]"
                >
                  {GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {g.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              {githubConfigured && (
                <button
                  type="button"
                  disabled={!parsed || isConverting}
                  onClick={handleConvertAndSaveGithub}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#D3CEC4] bg-white px-3.5 py-2 text-[12px] font-medium text-[#1C1B19] transition-colors hover:bg-[#F5F3EF] disabled:opacity-45"
                >
                  <CloudUpload className="h-3.5 w-3.5 text-[#2D5A4C]" />
                  Convert & Save to GitHub models/{sanitizeModelSlug(targetSlug || 'asset')}/
                </button>
              )}

              <button
                type="button"
                disabled={!parsed || isConverting}
                onClick={handleConvertDownload}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#2D5A4C] px-4 py-2 text-[12px] font-medium text-white transition-colors hover:bg-[#22453A] disabled:opacity-45"
              >
                {isConverting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Convert & Download {selectedSpec.ext}
              </button>
            </div>
          </div>

          {statusMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-[#CFE2DA] bg-[#F2F8F5] px-3.5 py-2.5 text-[12px] text-[#22453A]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-[#F0D0D1] bg-[#FDF4F4] px-3.5 py-2.5 text-[12px] text-[#9E3134]">
              <Cpu className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
