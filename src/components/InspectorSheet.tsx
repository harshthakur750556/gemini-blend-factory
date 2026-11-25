import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Bone,
  Box,
  Crosshair,
  Eye,
  EyeOff,
  Lock,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Scissors,
  Search,
  Sliders,
  Sparkles,
  Unlock,
  Wrench,
  X,
} from 'lucide-react';
import type {
  AnimationClipSummary,
  BoneControlInfo,
  InsideOutSide,
  InspectorTabId,
  MaterialChannelInfo,
  OutlinerNode,
  SceneTelemetry,
  SectionCutConfig,
  StudioLightingPreset,
  SurfaceParams,
  TopologyDiagnostics,
  TransformInfo,
} from '../types';

interface InspectorSheetProps {
  open: boolean;
  activeTab: InspectorTabId;
  onTabChange: (tab: InspectorTabId) => void;
  onClose: () => void;
  telemetry: SceneTelemetry;
  diagnostics: TopologyDiagnostics;
  outlinerNodes: OutlinerNode[];
  selectedNodeUuid: string | null;
  soloNodeUuid: string | null;
  transformInfo: TransformInfo;
  lightingPreset: StudioLightingPreset;
  lightAngleDeg: number;
  surfaceParams: SurfaceParams;
  insideOutSide: InsideOutSide;
  sectionCut: SectionCutConfig;
  materials: MaterialChannelInfo[];
  showSkeleton: boolean;
  bones: BoneControlInfo[];
  animationClips: AnimationClipSummary[];
  activeClipIndex: number;
  animationPlaying: boolean;
  animationTime: number;
  animationDuration: number;
  onSelectNode: (uuid: string | null) => void;
  onToggleNodeVisibility: (uuid: string) => void;
  onToggleNodeLock: (uuid: string) => void;
  onToggleSoloNode: (uuid: string) => void;
  onShowAllNodes: () => void;
  onTransformChange: (axis: 'posX' | 'posY' | 'posZ' | 'rotX' | 'rotY' | 'rotZ', value: number) => void;
  onSurfaceParamsChange: (next: SurfaceParams) => void;
  onInsideOutSideChange: (side: InsideOutSide) => void;
  onSectionCutChange: (next: SectionCutConfig) => void;
  onRecalculateNormals: () => void;
  onPurgeDegenerates: () => void;
  onToggleSkeleton: () => void;
  onSelectClip: (index: number) => void;
  onTogglePlayAnimation: () => void;
  onScrubAnimation: (timeSec: number) => void;
  onBoneRotationChange: (uuid: string, axis: 'x' | 'y' | 'z', deg: number) => void;
  onResetPose: () => void;
}

const SWATCHES = [
  { name: 'Granite', hex: '#7B7871' },
  { name: 'Hinoki Cedar', hex: '#73482D' },
  { name: 'Dark Slate', hex: '#32373C' },
  { name: 'Patinated Bronze', hex: '#8F7450' },
  { name: 'Warm Washi', hex: '#FFF3DE' },
  { name: 'Botanical Sage', hex: '#2D5A4C' },
];

const LIGHTING_LABELS: Record<StudioLightingPreset, string> = {
  'studio-4k': 'Studio Gallery 4K',
  architectural: 'Daylight Architectural',
  'high-contrast': 'Sculptural Rim',
  'soft-clay': 'Warm Soft Clay',
};

const MaterialPreviewSphere: React.FC<{ params: SurfaceParams }> = ({ params }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Subtle warm gallery backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#F5F3EF');
    bg.addColorStop(1, '#E8E4DC');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Contact shadow
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.84, w * 0.25, h * 0.06, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(28,27,25,0.14)';
    ctx.fill();
    ctx.restore();

    const cx = w * 0.5;
    const cy = h * 0.47;
    const r = Math.min(w, h) * 0.34;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    const baseGrad = ctx.createRadialGradient(
      cx - r * 0.34,
      cy - r * 0.36,
      r * 0.08,
      cx,
      cy,
      r * 1.15
    );
    baseGrad.addColorStop(0, '#FFFFFF');
    baseGrad.addColorStop(0.28, params.baseColor);
    baseGrad.addColorStop(0.88, '#1C1B19');
    baseGrad.addColorStop(1, '#141311');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // Metallic sheen + roughness specular lobe
    const gloss = Math.max(0.08, 1 - params.roughness);
    const specRadius = r * (0.14 + params.roughness * 0.48);
    const specGrad = ctx.createRadialGradient(
      cx - r * 0.32,
      cy - r * 0.34,
      0,
      cx - r * 0.32,
      cy - r * 0.34,
      specRadius
    );
    const specAlpha = Math.min(0.92, 0.25 + gloss * 0.55 + params.metallic * 0.22);
    specGrad.addColorStop(0, `rgba(255,252,246,${specAlpha.toFixed(2)})`);
    specGrad.addColorStop(1, 'rgba(255,252,246,0)');
    ctx.fillStyle = specGrad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // Subtle emissive lift
    if (params.emission > 0.01) {
      ctx.fillStyle = params.baseColor;
      ctx.globalAlpha = Math.min(0.6, params.emission * 0.35);
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }

    ctx.restore();
  }, [params]);

  return (
    <canvas
      ref={canvasRef}
      width={240}
      height={128}
      className="h-28 w-full rounded-xl border border-[#EAE6DF]"
      aria-label="Live material shader preview"
    />
  );
};

export const InspectorSheet: React.FC<InspectorSheetProps> = ({
  open,
  activeTab,
  onTabChange,
  onClose,
  telemetry,
  diagnostics,
  outlinerNodes,
  selectedNodeUuid,
  soloNodeUuid,
  transformInfo,
  lightingPreset,
  lightAngleDeg,
  surfaceParams,
  insideOutSide,
  sectionCut,
  materials,
  showSkeleton,
  bones,
  animationClips,
  activeClipIndex,
  animationPlaying,
  animationTime,
  animationDuration,
  onSelectNode,
  onToggleNodeVisibility,
  onToggleNodeLock,
  onToggleSoloNode,
  onShowAllNodes,
  onTransformChange,
  onSurfaceParamsChange,
  onInsideOutSideChange,
  onSectionCutChange,
  onRecalculateNormals,
  onPurgeDegenerates,
  onToggleSkeleton,
  onSelectClip,
  onTogglePlayAnimation,
  onScrubAnimation,
  onBoneRotationChange,
  onResetPose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [nodeFilter, setNodeFilter] = useState<'all' | 'mesh' | 'bone'>('all');

  const filteredNodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return outlinerNodes.filter((n) => {
      if (nodeFilter === 'mesh' && n.type !== 'Mesh' && n.type !== 'SkinnedMesh') return false;
      if (nodeFilter === 'bone' && n.type !== 'Bone') return false;
      if (q && !n.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [outlinerNodes, searchQuery, nodeFilter]);

  if (!open) return null;

  const tabs: Array<{ id: InspectorTabId; label: string; icon: React.ReactNode }> = [
    { id: 'outliner', label: 'Outliner', icon: <Box className="h-3.5 w-3.5" /> },
    { id: 'material', label: 'Shader', icon: <Sliders className="h-3.5 w-3.5" /> },
    { id: 'diagnostics', label: 'Topology', icon: <Activity className="h-3.5 w-3.5" /> },
    { id: 'rig', label: 'Rig', icon: <Bone className="h-3.5 w-3.5" /> },
  ];

  return (
    <aside
      aria-label="Scene Inspector"
      className="atelier-surface animate-atelier-sheet fixed top-16 right-4 bottom-20 z-30 flex w-[348px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#EFECE6] px-4 py-3.5">
        <div>
          <h2 className="font-display text-[16px] font-medium tracking-[-0.01em] text-[#1C1B19]">
            Inspector
          </h2>
          <p className="text-[11px] text-[#847E75]">
            {telemetry.modelName || 'Point Cloud Stage'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close inspector"
          className="rounded-lg p-1.5 text-[#847E75] transition-colors hover:bg-[#F5F3EF] hover:text-[#1C1B19]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tab Navigation */}
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

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* OUTLINER TAB */}
        {activeTab === 'outliner' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#847E75]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter parts or bones..."
                  className="w-full rounded-lg border border-[#E5E1DA] bg-[#FAF9F6] py-1.5 pr-3 pl-8 text-[12px] text-[#1C1B19] outline-none focus:border-[#2D5A4C] focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {(['all', 'mesh', 'bone'] as const).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setNodeFilter(kind)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
                        nodeFilter === kind
                          ? 'bg-[#EBF2EF] text-[#22453A]'
                          : 'text-[#6E6960] hover:bg-[#F5F3EF]'
                      }`}
                    >
                      {kind}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={onShowAllNodes}
                  className="text-[11px] font-medium text-[#2D5A4C] hover:underline"
                >
                  Show All
                </button>
              </div>
            </div>

            {/* Hierarchy Tree */}
            <div className="max-h-56 overflow-y-auto rounded-xl border border-[#ECE8E1] bg-[#FCFBF9] p-1">
              {filteredNodes.length === 0 ? (
                <div className="px-3 py-6 text-center text-[11.5px] text-[#847E75]">
                  No matching scene nodes.
                </div>
              ) : (
                filteredNodes.map((node) => {
                  const isSelected = node.uuid === selectedNodeUuid;
                  const isSolo = node.uuid === soloNodeUuid;
                  return (
                    <div
                      key={node.uuid}
                      className={`group flex items-center justify-between gap-1 rounded-lg px-2 py-1.5 transition-colors ${
                        isSelected ? 'bg-[#EBF2EF] text-[#1D4438]' : 'hover:bg-[#F2EFE9]'
                      }`}
                      style={{ paddingLeft: `${Math.min(node.depth, 5) * 12 + 8}px` }}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectNode(isSelected ? null : node.uuid)}
                        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                      >
                        {node.type === 'Bone' ? (
                          <Bone className="h-3 w-3 shrink-0 text-[#847E75]" />
                        ) : (
                          <Box className="h-3 w-3 shrink-0 text-[#847E75]" />
                        )}
                        <span className="truncate text-[11.5px] font-medium text-[#1C1B19]">
                          {node.name}
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => onToggleSoloNode(node.uuid)}
                          title={isSolo ? 'Exit Solo' : 'Solo Part'}
                          aria-label={`Solo ${node.name}`}
                          className={`rounded p-1 transition-colors ${
                            isSolo
                              ? 'bg-[#2D5A4C] text-white'
                              : 'text-[#847E75] hover:bg-white hover:text-[#1C1B19]'
                          }`}
                        >
                          <Crosshair className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleNodeVisibility(node.uuid)}
                          title={node.visible ? 'Hide' : 'Show'}
                          aria-label={`Toggle visibility for ${node.name}`}
                          className="rounded p-1 text-[#847E75] transition-colors hover:bg-white hover:text-[#1C1B19]"
                        >
                          {node.visible ? (
                            <Eye className="h-3 w-3" />
                          ) : (
                            <EyeOff className="h-3 w-3 text-[#B5AFA5]" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleNodeLock(node.uuid)}
                          title={node.locked ? 'Unlock' : 'Lock'}
                          aria-label={`Toggle lock for ${node.name}`}
                          className="rounded p-1 text-[#847E75] transition-colors hover:bg-white hover:text-[#1C1B19]"
                        >
                          {node.locked ? (
                            <Lock className="h-3 w-3 text-[#9A6316]" />
                          ) : (
                            <Unlock className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Editable Transform */}
            <div className="rounded-xl border border-[#ECE8E1] bg-[#FAF9F6] p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-[0.04em] text-[#5A564F] uppercase">
                  Transform
                </span>
                <span className="truncate font-mono text-[10.5px] text-[#847E75]">
                  {transformInfo.name}
                </span>
              </div>

              <div className="mt-3 space-y-2.5">
                <div>
                  <div className="mb-1 text-[10.5px] font-medium text-[#6E6960]">Position (m)</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['posX', 'posY', 'posZ'] as const).map((axis, idx) => (
                      <label key={axis} className="block">
                        <span className="sr-only">{axis}</span>
                        <div className="flex items-center rounded-lg border border-[#E2DDD4] bg-white px-2 py-1">
                          <span className="mr-1 font-mono text-[10px] font-semibold text-[#847E75]">
                            {['X', 'Y', 'Z'][idx]}
                          </span>
                          <input
                            type="number"
                            step="0.05"
                            value={Number(transformInfo[axis].toFixed(2))}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              if (Number.isFinite(v)) onTransformChange(axis, v);
                            }}
                            className="w-full bg-transparent font-mono text-[11px] text-[#1C1B19] tabular-nums outline-none"
                          />
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-[10.5px] font-medium text-[#6E6960]">Rotation (°)</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['rotX', 'rotY', 'rotZ'] as const).map((axis, idx) => (
                      <label key={axis} className="block">
                        <span className="sr-only">{axis}</span>
                        <div className="flex items-center rounded-lg border border-[#E2DDD4] bg-white px-2 py-1">
                          <span className="mr-1 font-mono text-[10px] font-semibold text-[#847E75]">
                            {['X', 'Y', 'Z'][idx]}
                          </span>
                          <input
                            type="number"
                            step="5"
                            value={Math.round(transformInfo[axis])}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              if (Number.isFinite(v)) onTransformChange(axis, v);
                            }}
                            className="w-full bg-transparent font-mono text-[11px] text-[#1C1B19] tabular-nums outline-none"
                          />
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Scene Readout */}
            <div className="rounded-xl border border-[#ECE8E1] bg-white p-3.5 text-[11.5px] space-y-2">
              <div className="flex items-center justify-between gap-3 text-[#5A564F]">
                <span className="shrink-0">Lighting</span>
                <span className="text-right font-medium text-[#1C1B19]">
                  {LIGHTING_LABELS[lightingPreset]} · {Math.round(lightAngleDeg)}°
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-[#5A564F]">
                <span className="shrink-0">Bounds (m)</span>
                <span className="text-right font-mono text-[11px] text-[#1C1B19] tabular-nums">
                  {telemetry.boundsSize.map((v) => v.toFixed(2)).join(' × ')}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3 text-[#5A564F]">
                <span className="shrink-0">Composition</span>
                <span className="text-right font-mono text-[11px] text-[#1C1B19] tabular-nums">
                  {telemetry.meshCount} meshes · {telemetry.materialCount} mats · {telemetry.boneCount} bones
                </span>
              </div>
            </div>
          </div>
        )}

        {/* SHADER & MATERIAL TAB */}
        {activeTab === 'material' && (
          <div className="space-y-4">
            <MaterialPreviewSphere params={surfaceParams} />

            {/* Mode Toggle */}
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-[#EAE6DF] bg-[#FAF9F6] p-1">
              <button
                type="button"
                onClick={() => onSurfaceParamsChange({ ...surfaceParams, overrideEnabled: false })}
                className={`rounded-lg py-1.5 text-[11.5px] font-medium transition-colors ${
                  !surfaceParams.overrideEnabled
                    ? 'bg-white text-[#1C1B19] shadow-[0_1px_3px_rgba(28,27,25,0.08)]'
                    : 'text-[#6E6960] hover:text-[#1C1B19]'
                }`}
              >
                Original PBR
              </button>
              <button
                type="button"
                onClick={() => onSurfaceParamsChange({ ...surfaceParams, overrideEnabled: true })}
                className={`rounded-lg py-1.5 text-[11.5px] font-medium transition-colors ${
                  surfaceParams.overrideEnabled
                    ? 'bg-[#2D5A4C] text-white'
                    : 'text-[#6E6960] hover:text-[#1C1B19]'
                }`}
              >
                BSDF Override
              </button>
            </div>

            {/* Color & Swatches */}
            <div className="rounded-xl border border-[#ECE8E1] bg-[#FAF9F6] p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-medium text-[#1C1B19]">Base Color</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-[#6E6960]">
                    {surfaceParams.baseColor.toUpperCase()}
                  </span>
                  <input
                    type="color"
                    value={surfaceParams.baseColor}
                    onChange={(e) =>
                      onSurfaceParamsChange({
                        ...surfaceParams,
                        overrideEnabled: true,
                        baseColor: e.target.value,
                      })
                    }
                    aria-label="Select base color"
                    className="h-6 w-7 cursor-pointer rounded border border-[#D8D3CA] bg-white p-0.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-6 gap-1.5">
                {SWATCHES.map((sw) => (
                  <button
                    key={sw.hex}
                    type="button"
                    title={sw.name}
                    aria-label={`Apply ${sw.name} swatch`}
                    onClick={() =>
                      onSurfaceParamsChange({
                        ...surfaceParams,
                        overrideEnabled: true,
                        baseColor: sw.hex,
                      })
                    }
                    className={`h-6 rounded-md border transition-transform hover:scale-105 ${
                      surfaceParams.baseColor.toLowerCase() === sw.hex.toLowerCase()
                        ? 'border-[#1C1B19] ring-1 ring-[#1C1B19]'
                        : 'border-[#DCD7CE]'
                    }`}
                    style={{ backgroundColor: sw.hex }}
                  />
                ))}
              </div>

              {/* BSDF Sliders */}
              {[
                { key: 'metallic' as const, label: 'Metallic', min: 0, max: 1, step: 0.02 },
                { key: 'roughness' as const, label: 'Roughness', min: 0.04, max: 1, step: 0.02 },
                { key: 'normalStrength' as const, label: 'Normal / Bump', min: 0, max: 2.5, step: 0.05 },
                { key: 'emission' as const, label: 'Emission', min: 0, max: 2.0, step: 0.05 },
              ].map((slider) => (
                <div key={slider.key}>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-[#5A564F]">{slider.label}</span>
                    <span className="font-mono text-[#1C1B19] tabular-nums">
                      {surfaceParams[slider.key].toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={slider.min}
                    max={slider.max}
                    step={slider.step}
                    value={surfaceParams[slider.key]}
                    onChange={(e) =>
                      onSurfaceParamsChange({
                        ...surfaceParams,
                        overrideEnabled: true,
                        [slider.key]: parseFloat(e.target.value),
                      })
                    }
                    className="atelier-range w-full"
                  />
                </div>
              ))}
            </div>

            {/* Face Culling (Inside-Out) */}
            <div className="rounded-xl border border-[#ECE8E1] bg-white p-3.5">
              <div className="text-[11px] font-semibold tracking-[0.04em] text-[#5A564F] uppercase">
                Face Culling
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {(['front', 'back', 'double'] as const).map((side) => (
                  <button
                    key={side}
                    type="button"
                    onClick={() => onInsideOutSideChange(side)}
                    className={`rounded-lg border py-1.5 text-[11.5px] font-medium capitalize transition-colors ${
                      insideOutSide === side
                        ? 'border-[#2D5A4C] bg-[#EBF2EF] text-[#22453A]'
                        : 'border-[#E5E1DA] bg-[#FAF9F6] text-[#5A564F] hover:text-[#1C1B19]'
                    }`}
                  >
                    {side}
                  </button>
                ))}
              </div>
            </div>

            {/* 3D Section Cut Slicer */}
            <div className="rounded-xl border border-[#ECE8E1] bg-white p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.04em] text-[#5A564F] uppercase">
                  <Scissors className="h-3.5 w-3.5 text-[#2D5A4C]" />
                  Section Slicer
                </div>
                <button
                  type="button"
                  onClick={() => onSectionCutChange({ ...sectionCut, enabled: !sectionCut.enabled })}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    sectionCut.enabled
                      ? 'bg-[#2D5A4C] text-white'
                      : 'border border-[#DCD7CE] bg-[#FAF9F6] text-[#5A564F]'
                  }`}
                >
                  {sectionCut.enabled ? 'Active' : 'Off'}
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {(['x', 'y', 'z'] as const).map((axis) => (
                  <button
                    key={axis}
                    type="button"
                    onClick={() => onSectionCutChange({ ...sectionCut, enabled: true, axis })}
                    className={`flex-1 rounded-lg border py-1 font-mono text-[11px] font-medium uppercase ${
                      sectionCut.axis === axis && sectionCut.enabled
                        ? 'border-[#2D5A4C] bg-[#EBF2EF] text-[#22453A]'
                        : 'border-[#E5E1DA] bg-[#FAF9F6] text-[#5A564F]'
                    }`}
                  >
                    {axis}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    onSectionCutChange({ ...sectionCut, enabled: true, invert: !sectionCut.invert })
                  }
                  className={`rounded-lg border px-3 py-1 text-[11px] font-medium ${
                    sectionCut.invert
                      ? 'border-[#2D5A4C] bg-[#EBF2EF] text-[#22453A]'
                      : 'border-[#E5E1DA] bg-[#FAF9F6] text-[#5A564F]'
                  }`}
                >
                  Flip
                </button>
              </div>

              <div>
                <div className="mb-1 flex justify-between text-[11px]">
                  <span className="text-[#5A564F]">Plane Offset</span>
                  <span className="font-mono text-[#1C1B19] tabular-nums">
                    {sectionCut.position.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.02}
                  value={sectionCut.position}
                  onChange={(e) =>
                    onSectionCutChange({
                      ...sectionCut,
                      enabled: true,
                      position: parseFloat(e.target.value),
                    })
                  }
                  className="atelier-range w-full"
                />
              </div>
            </div>

            {/* Active Material Slots */}
            <div className="rounded-xl border border-[#ECE8E1] bg-[#FAF9F6] p-3.5">
              <div className="text-[11px] font-semibold tracking-[0.04em] text-[#5A564F] uppercase">
                Material Slots ({materials.length})
              </div>
              <div className="mt-2.5 space-y-2">
                {materials.length === 0 ? (
                  <p className="text-[11.5px] text-[#847E75]">No mesh materials on stage.</p>
                ) : (
                  materials.map((mat) => {
                    const activeMaps = Object.entries(mat.maps)
                      .filter(([, present]) => present)
                      .map(([k]) => k);
                    return (
                      <div
                        key={mat.uuid}
                        className="rounded-lg border border-[#EAE5DC] bg-white px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-3 w-3 shrink-0 rounded-full border border-[#D3CEC4]"
                              style={{ backgroundColor: mat.colorHex }}
                            />
                            <span className="truncate text-[11.5px] font-medium text-[#1C1B19]">
                              {mat.name}
                            </span>
                          </div>
                          <span className="font-mono text-[10px] text-[#847E75] tabular-nums">
                            M {mat.metalness.toFixed(1)} · R {mat.roughness.toFixed(1)}
                          </span>
                        </div>
                        <div className="mt-1 text-[10.5px] text-[#847E75]">
                          {activeMaps.length > 0
                            ? `Maps: ${activeMaps.join(', ')}`
                            : 'Procedural BSDF'}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* DIAGNOSTICS TAB */}
        {activeTab === 'diagnostics' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#ECE8E1] bg-[#FAF9F6] p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-semibold tracking-[0.04em] text-[#5A564F] uppercase">
                  Mesh Health Grade
                </span>
                <span className="font-display text-[26px] font-medium text-[#2D5A4C]">
                  {diagnostics.grade}
                </span>
              </div>
              <p className="mt-1 text-[11.5px] text-[#6E6960]">
                {diagnostics.manifold
                  ? 'Watertight manifold geometry verified across active meshes.'
                  : 'Inspect mesh seams or recalculate outward normals.'}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2.5 text-[11.5px]">
                {[
                  { label: 'Vertices', value: telemetry.vertexCount.toLocaleString() },
                  { label: 'Triangles', value: telemetry.triangleCount.toLocaleString() },
                  { label: 'Edges', value: telemetry.edgeCount.toLocaleString() },
                  { label: 'Draw Calls', value: String(diagnostics.drawCalls) },
                  { label: 'Quads / Tris', value: `${diagnostics.quadPercent}% / ${diagnostics.triPercent}%` },
                  { label: 'Est. VRAM', value: `${diagnostics.estimatedVramMb.toFixed(1)} MB` },
                  { label: 'Non-Manifold', value: String(diagnostics.nonManifoldEdges) },
                  { label: 'UV Overlap', value: `${diagnostics.overlappingUvPercent.toFixed(1)}%` },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-lg border border-[#EAE5DC] bg-white px-3 py-2"
                  >
                    <div className="text-[10.5px] text-[#847E75]">{metric.label}</div>
                    <div className="mt-0.5 font-mono text-[12px] font-medium text-[#1C1B19] tabular-nums">
                      {metric.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={onRecalculateNormals}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#D8D3CA] bg-white px-4 py-2.5 text-[12px] font-medium text-[#1C1B19] transition-colors hover:bg-[#F5F3EF]"
              >
                <RefreshCw className="h-3.5 w-3.5 text-[#2D5A4C]" />
                Recalculate Normals Outside
              </button>
              <button
                type="button"
                onClick={onPurgeDegenerates}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#D8D3CA] bg-white px-4 py-2.5 text-[12px] font-medium text-[#1C1B19] transition-colors hover:bg-[#F5F3EF]"
              >
                <Wrench className="h-3.5 w-3.5 text-[#2D5A4C]" />
                Purge Degenerate Geometry
              </button>
            </div>
          </div>
        )}

        {/* RIG & MOTION TAB */}
        {activeTab === 'rig' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-[#ECE8E1] bg-[#FAF9F6] px-3.5 py-3">
              <div>
                <div className="text-[12px] font-medium text-[#1C1B19]">Skeleton Overlay</div>
                <div className="text-[11px] text-[#847E75]">
                  {bones.length} bone{bones.length === 1 ? '' : 's'} detected
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleSkeleton}
                className={`rounded-lg px-3 py-1.5 text-[11.5px] font-medium transition-colors ${
                  showSkeleton
                    ? 'bg-[#2D5A4C] text-white'
                    : 'border border-[#D8D3CA] bg-white text-[#5A564F]'
                }`}
              >
                {showSkeleton ? 'Visible' : 'Hidden'}
              </button>
            </div>

            {/* Animation Timeline */}
            <div className="rounded-xl border border-[#ECE8E1] bg-white p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-[0.04em] text-[#5A564F] uppercase">
                  Motion Clip
                </span>
                <span className="font-mono text-[11px] text-[#6E6960] tabular-nums">
                  {animationTime.toFixed(2)}s / {animationDuration.toFixed(2)}s
                </span>
              </div>

              {animationClips.length === 0 ? (
                <p className="text-[11.5px] text-[#847E75]">
                  No animation tracks embedded in this asset.
                </p>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onTogglePlayAnimation}
                      aria-label={animationPlaying ? 'Pause animation' : 'Play animation'}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2D5A4C] text-white transition-colors hover:bg-[#22453A]"
                    >
                      {animationPlaying ? (
                        <Pause className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <select
                      value={activeClipIndex}
                      onChange={(e) => onSelectClip(Number(e.target.value))}
                      aria-label="Select animation clip"
                      className="min-w-0 flex-1 rounded-lg border border-[#E5E1DA] bg-[#FAF9F6] px-2.5 py-1.5 text-[12px] text-[#1C1B19] outline-none focus:border-[#2D5A4C]"
                    >
                      {animationClips.map((clip) => (
                        <option key={clip.index} value={clip.index}>
                          {clip.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={Math.max(0.01, animationDuration)}
                    step={0.02}
                    value={animationTime}
                    onChange={(e) => onScrubAnimation(parseFloat(e.target.value))}
                    className="atelier-range w-full"
                    aria-label="Animation timeline scrubber"
                  />
                </>
              )}
            </div>

            {/* Bone Pose Sliders */}
            <div className="rounded-xl border border-[#ECE8E1] bg-[#FAF9F6] p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-[0.04em] text-[#5A564F] uppercase">
                  Pose Articulation
                </span>
                <button
                  type="button"
                  onClick={onResetPose}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2D5A4C] hover:underline"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset Pose
                </button>
              </div>

              {bones.length === 0 ? (
                <div className="flex items-center gap-2 text-[11.5px] text-[#847E75]">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Load a rigged model or the Stone Lantern to articulate joints.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {bones.slice(0, 12).map((bone) => (
                    <div
                      key={bone.uuid}
                      className="rounded-lg border border-[#EAE5DC] bg-white p-2.5 space-y-2"
                    >
                      <div className="truncate font-mono text-[11px] font-medium text-[#1C1B19]">
                        {bone.name}
                      </div>
                      {(['x', 'y', 'z'] as const).map((axis) => {
                        const val =
                          axis === 'x' ? bone.rotX : axis === 'y' ? bone.rotY : bone.rotZ;
                        return (
                          <div key={axis} className="flex items-center gap-2">
                            <span className="w-3 font-mono text-[10px] font-semibold uppercase text-[#847E75]">
                              {axis}
                            </span>
                            <input
                              type="range"
                              min={-180}
                              max={180}
                              step={1}
                              value={Math.round(val)}
                              onChange={(e) =>
                                onBoneRotationChange(bone.uuid, axis, parseFloat(e.target.value))
                              }
                              className="atelier-range flex-1"
                            />
                            <span className="w-9 text-right font-mono text-[10px] text-[#5A564F] tabular-nums">
                              {Math.round(val)}°
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
