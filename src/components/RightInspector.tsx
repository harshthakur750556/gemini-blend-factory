import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AnimationClipSummary,
  BoneControlInfo,
  InsideOutSide,
  InspectorTabId,
  MaterialChannelInfo,
  OutlinerNode,
  SectionCutConfig,
  SurfaceParams,
  TopologyDiagnostics,
  TransformInfo,
} from '../types';

interface RightInspectorProps {
  activeTab: InspectorTabId;
  onTabChange: (tab: InspectorTabId) => void;
  modelName: string | null;
  outlinerNodes: OutlinerNode[];
  selectedNodeUuid: string | null;
  onSelectNode: (uuid: string | null) => void;
  onToggleNodeVisibility: (uuid: string) => void;
  onToggleNodeLock: (uuid: string) => void;
  onSoloNode: (uuid: string) => void;
  onShowAllNodes: () => void;
  transformInfo: TransformInfo;
  onTransformChange: (field: keyof Omit<TransformInfo, 'uuid' | 'name'>, value: number) => void;
  surfaceParams: SurfaceParams;
  onSurfaceParamsChange: (next: SurfaceParams) => void;
  materials: MaterialChannelInfo[];
  insideOutSide: InsideOutSide;
  onInsideOutChange: (side: InsideOutSide) => void;
  sectionCut: SectionCutConfig;
  onSectionCutChange: (cfg: SectionCutConfig) => void;
  diagnostics: TopologyDiagnostics;
  onRecalculateNormals: () => void;
  onPurgeDegenerates: () => void;
  bones: BoneControlInfo[];
  showSkeleton: boolean;
  onToggleSkeleton: () => void;
  onSetBoneRotation: (uuid: string, axis: 'x' | 'y' | 'z', deg: number) => void;
  onResetPose: () => void;
  clips: AnimationClipSummary[];
  activeClipIdx: number;
  animPlaying: boolean;
  animTime: number;
  onPlayClip: (idx: number) => void;
  onToggleAnimPlay: () => void;
  onSeekAnim: (t: number) => void;
  onOpenAssetModal: () => void;
}

const SWATCHES = [
  { hex: '#111318', label: 'Obsidian Charcoal' },
  { hex: '#334155', label: 'Slate Gray' },
  { hex: '#64748b', label: 'Medium Graphite' },
  { hex: '#94a3b8', label: 'Silver Gray' },
  { hex: '#f1f5f9', label: 'Pure Architectural White' },
];

export const RightInspector: React.FC<RightInspectorProps> = ({
  activeTab,
  onTabChange,
  modelName,
  outlinerNodes,
  selectedNodeUuid,
  onSelectNode,
  onToggleNodeVisibility,
  onToggleNodeLock,
  onSoloNode,
  onShowAllNodes,
  transformInfo,
  onTransformChange,
  surfaceParams,
  onSurfaceParamsChange,
  materials,
  insideOutSide,
  onInsideOutChange,
  sectionCut,
  onSectionCutChange,
  diagnostics,
  onRecalculateNormals,
  onPurgeDegenerates,
  bones,
  showSkeleton,
  onToggleSkeleton,
  onSetBoneRotation,
  onResetPose,
  clips,
  activeClipIdx,
  animPlaying,
  animTime,
  onPlayClip,
  onToggleAnimPlay,
  onSeekAnim,
  onOpenAssetModal,
}) => {
  const [filterText, setFilterText] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'Mesh' | 'Bone'>('ALL');
  const matBallRef = useRef<HTMLCanvasElement | null>(null);

  const filteredNodes = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return outlinerNodes.filter((n) => {
      if (typeFilter === 'Mesh' && n.type !== 'Mesh' && n.type !== 'SkinnedMesh') return false;
      if (typeFilter === 'Bone' && n.type !== 'Bone') return false;
      if (q && !n.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [outlinerNodes, filterText, typeFilter]);

  // Live Material Preview Ball Canvas
  useEffect(() => {
    const canvas = matBallRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const grad = ctx.createRadialGradient(w * 0.35, h * 0.3, 2, w * 0.5, h * 0.5, w * 0.5);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.24, surfaceParams.baseColor);
    grad.addColorStop(0.8, '#1e293b');
    grad.addColorStop(1, '#090d16');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
    ctx.fill();

    const specSize = Math.max(4, 15 * (1.1 - surfaceParams.roughness));
    const specAlpha = Math.min(0.95, (0.35 + surfaceParams.metallic * 0.65) * (1.1 - surfaceParams.roughness));
    const specGrad = ctx.createRadialGradient(w * 0.35, h * 0.28, 1, w * 0.35, h * 0.28, specSize);
    specGrad.addColorStop(0, `rgba(255, 255, 255, ${specAlpha})`);
    specGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = specGrad;
    ctx.beginPath();
    ctx.arc(w * 0.35, h * 0.28, 14, 0, Math.PI * 2);
    ctx.fill();
  }, [surfaceParams, activeTab]);

  const primaryMat = materials[0];

  return (
    <aside
      className="w-80 xl:w-96 bg-[#f8f9fa] border-l border-[#dcdfe4] flex flex-col shrink-0 z-30 select-none overflow-hidden"
      id="right-inspector"
    >
      {/* Inspector Panel Header Tabs */}
      <div className="h-9 bg-white border-b border-[#dcdfe4] flex items-center px-1 gap-0.5 overflow-x-auto shrink-0">
        {(
          [
            { id: 'outliner', icon: 'account_tree', label: 'Outliner' },
            { id: 'material', icon: 'palette', label: 'Shader & BSDF' },
            { id: 'diagnostics', icon: 'troubleshoot', label: 'Diagnostics' },
            { id: 'rig', icon: 'accessibility_new', label: 'Rig' },
          ] as const
        ).map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`px-2 py-1 rounded text-[11px] flex items-center gap-1 transition-all whitespace-nowrap cursor-pointer ${
                active
                  ? 'font-semibold text-white bg-[#111318] shadow-sm'
                  : 'font-medium text-[#64748b] hover:text-black hover:bg-[#f0f2f5]'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OUTLINER SCENE HIERARCHY */}
      {activeTab === 'outliner' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-[#dcdfe4] flex items-center gap-1.5 bg-[#f8f9fa]">
            <div className="flex-1 flex items-center bg-white px-2 py-1 rounded-md border border-[#dcdfe4] text-xs">
              <span className="material-symbols-outlined text-[13px] text-[#64748b] mr-1.5">search</span>
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter hierarchy..."
                className="w-full bg-transparent text-[#111318] text-[11px] focus:outline-none placeholder:text-[#94a3b8]"
              />
            </div>
            <button
              type="button"
              onClick={() => setTypeFilter((prev) => (prev === 'ALL' ? 'Mesh' : prev === 'Mesh' ? 'Bone' : 'ALL'))}
              className={`px-1.5 h-6 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                typeFilter !== 'ALL'
                  ? 'bg-[#111318] text-white border-[#111318]'
                  : 'text-[#64748b] hover:text-black hover:bg-white border-transparent hover:border-[#dcdfe4]'
              }`}
              title={`Filter Type: ${typeFilter}`}
            >
              {typeFilter}
            </button>
            <button
              type="button"
              onClick={onShowAllNodes}
              className="w-6 h-6 rounded flex items-center justify-center text-[#64748b] hover:text-black hover:bg-white border border-transparent hover:border-[#dcdfe4] cursor-pointer"
              title="Show All Scene Objects"
            >
              <span className="material-symbols-outlined text-[14px]">visibility</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 text-xs">
            {/* Root Scene */}
            <div
              onClick={() => onSelectNode(null)}
              className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer border ${
                selectedNodeUuid === null
                  ? 'bg-white border-[#111318] text-[#111318] shadow-sm'
                  : 'text-[#111318] hover:bg-white border-transparent hover:border-[#dcdfe4]'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <span className="material-symbols-outlined text-[12px] text-[#64748b]">arrow_drop_down</span>
                <span className="material-symbols-outlined text-[14px] text-[#111318]">cloud_circle</span>
                <span className="font-semibold text-[11px] truncate">Apex_Master_Scene</span>
              </div>
              <span className="text-[9px] font-mono text-[#64748b]">{outlinerNodes.length} nodes</span>
            </div>

            {/* Loaded Asset Collection */}
            <div className="ml-3 pl-2 border-l border-[#dcdfe4] space-y-0.5">
              <div className="flex items-center justify-between px-2 py-1 rounded text-[#111318]">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="material-symbols-outlined text-[12px] text-[#64748b]">arrow_drop_down</span>
                  <span className="material-symbols-outlined text-[14px] text-[#111318]">folder</span>
                  <span className="font-bold text-[11px] truncate">
                    {modelName || 'Point_Cloud_Stage'}
                  </span>
                </div>
                {!modelName && (
                  <button
                    type="button"
                    onClick={onOpenAssetModal}
                    className="text-[10px] font-mono underline text-[#111318] hover:text-[#64748b] cursor-pointer"
                  >
                    Load
                  </button>
                )}
              </div>

              {filteredNodes.length === 0 ? (
                <div className="px-2.5 py-3 text-[11px] text-[#64748b] bg-white border border-dashed border-[#dcdfe4] rounded-md">
                  {modelName
                    ? 'No scene nodes match your current filter.'
                    : 'Stage is clear (Point Cloud Art active). Open Model Assets to inspect a 3D hierarchy.'}
                </div>
              ) : (
                <div className="ml-2 pl-2 border-l border-[#dcdfe4] space-y-0.5">
                  {filteredNodes.map((node) => {
                    const isSelected = selectedNodeUuid === node.uuid;
                    return (
                      <div
                        key={node.uuid}
                        onClick={() => onSelectNode(node.uuid)}
                        className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer border transition-colors ${
                          isSelected
                            ? 'bg-white border-[#111318] text-[#111318] shadow-sm'
                            : 'hover:bg-white text-[#111318] border-transparent hover:border-[#dcdfe4]'
                        } ${!node.visible ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="material-symbols-outlined text-[14px] text-[#64748b] shrink-0">
                            {node.type === 'Bone'
                              ? 'accessibility_new'
                              : node.type === 'Group'
                                ? 'folder_open'
                                : 'view_in_ar'}
                          </span>
                          <span className={`truncate text-[11px] ${isSelected ? 'font-semibold' : ''}`}>
                            {node.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[#64748b] shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSoloNode(node.uuid);
                            }}
                            className="hover:text-black px-0.5 cursor-pointer"
                            title={`Solo ${node.name}`}
                            aria-label={`Solo ${node.name}`}
                          >
                            <span className="material-symbols-outlined text-[12px]">filter_center_focus</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleNodeVisibility(node.uuid);
                            }}
                            className="hover:text-black cursor-pointer"
                            title={`Toggle visibility for ${node.name}`}
                            aria-label={`Toggle visibility for ${node.name}`}
                          >
                            <span className="material-symbols-outlined text-[13px]">
                              {node.visible ? 'visibility' : 'visibility_off'}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleNodeLock(node.uuid);
                            }}
                            className="hover:text-black cursor-pointer"
                            title={`Toggle lock for ${node.name}`}
                            aria-label={`Toggle lock for ${node.name}`}
                          >
                            <span className="material-symbols-outlined text-[13px]">
                              {node.locked ? 'lock' : 'lock_open'}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Studio Lighting Rig Collection */}
            <div className="ml-3 pl-2 border-l border-[#dcdfe4] space-y-0.5 pt-1.5">
              <div className="flex items-center justify-between px-2 py-1 rounded text-[#111318]">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[12px] text-[#64748b]">arrow_drop_down</span>
                  <span className="material-symbols-outlined text-[14px] text-[#111318]">lightbulb</span>
                  <span className="font-medium text-[11px]">Studio_Lighting_Rig</span>
                </div>
              </div>
              <div className="ml-3 pl-2 border-l border-[#dcdfe4] space-y-0.5">
                <div className="flex items-center justify-between px-2 py-0.5 rounded text-[10px] text-[#111318]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#111318]" />
                    Key_Rim_5600K
                  </span>
                  <span className="font-mono text-[#111318] font-semibold">1200 lx</span>
                </div>
                <div className="flex items-center justify-between px-2 py-0.5 rounded text-[10px] text-[#111318]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#64748b]" />
                    Fill_Neutral
                  </span>
                  <span className="font-mono text-[#64748b] font-semibold">450 lx</span>
                </div>
              </div>
            </div>
          </div>

          {/* Transform Coordinates Quick-Card (Docked Bottom) */}
          <div className="p-2.5 bg-white border-t border-[#dcdfe4] space-y-2 shrink-0">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#111318]">
              <span className="flex items-center gap-1 truncate">
                <span className="material-symbols-outlined text-[14px] text-[#111318]">transform</span>
                Transform (World)
              </span>
              <span className="font-mono text-[10px] text-[#64748b]">Euler XYZ</span>
            </div>
            <div className="space-y-1 font-mono text-[10px]">
              <div className="flex items-center gap-1">
                <span className="w-6 text-[#64748b]">Pos</span>
                <div className="flex-1 grid grid-cols-3 gap-1">
                  {(
                    [
                      { key: 'posX', axis: 'X', border: 'border-[#111318]', val: transformInfo.posX },
                      { key: 'posY', axis: 'Y', border: 'border-[#64748b]', val: transformInfo.posY },
                      { key: 'posZ', axis: 'Z', border: 'border-[#94a3b8]', val: transformInfo.posZ },
                    ] as const
                  ).map((item) => (
                    <label
                      key={item.key}
                      className={`bg-[#f0f2f5] px-1 py-0.5 rounded border-l-2 ${item.border} flex items-center justify-between gap-1`}
                    >
                      <span className="text-[#64748b]">{item.axis}</span>
                      <input
                        type="number"
                        step="0.05"
                        value={item.val}
                        onChange={(e) => onTransformChange(item.key, parseFloat(e.target.value) || 0)}
                        className="w-full bg-transparent text-right text-[#111318] font-semibold focus:outline-none"
                      />
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-6 text-[#64748b]">Rot</span>
                <div className="flex-1 grid grid-cols-3 gap-1">
                  {(
                    [
                      { key: 'rotX', axis: 'X', border: 'border-[#111318]', val: transformInfo.rotX },
                      { key: 'rotY', axis: 'Y', border: 'border-[#64748b]', val: transformInfo.rotY },
                      { key: 'rotZ', axis: 'Z', border: 'border-[#94a3b8]', val: transformInfo.rotZ },
                    ] as const
                  ).map((item) => (
                    <label
                      key={item.key}
                      className={`bg-[#f0f2f5] px-1 py-0.5 rounded border-l-2 ${item.border} flex items-center justify-between gap-1`}
                    >
                      <span className="text-[#64748b]">{item.axis}</span>
                      <input
                        type="number"
                        step="5"
                        value={item.val}
                        onChange={(e) => onTransformChange(item.key, parseFloat(e.target.value) || 0)}
                        className="w-full bg-transparent text-right text-[#111318] font-semibold focus:outline-none"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SHADER & BSDF INSPECTOR + INSIDE-OUT / SECTION CUT */}
      {activeTab === 'material' && (
        <div className="flex-1 flex flex-col overflow-y-auto p-3 space-y-3">
          {/* Material Ball Preview Card */}
          <div className="bg-white rounded-lg p-2.5 border border-[#dcdfe4] flex items-center gap-3 shadow-sm">
            <div className="w-14 h-14 rounded-lg bg-[#e2e8f0] relative overflow-hidden flex items-center justify-center border border-[#dcdfe4] shrink-0">
              <canvas ref={matBallRef} width={48} height={48} className="rounded-full shadow-md" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-[#111318] truncate">
                {primaryMat?.name || 'M_Titanium_Apex_Composite'}
              </div>
              <div className="text-[10px] font-mono text-[#64748b]">Principled BSDF Monochrome</div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[9px] bg-[#f0f2f5] text-[#111318] px-1.5 py-0.5 rounded font-mono border border-[#dcdfe4]">
                  PBR METALLIC
                </span>
                <span className="text-[9px] bg-[#f0f2f5] text-[#64748b] px-1.5 py-0.5 rounded font-mono border border-[#dcdfe4]">
                  {materials.length || 1} MATS
                </span>
              </div>
            </div>
          </div>

          {/* Realtime BSDF Sliders */}
          <div className="bg-white rounded-lg p-2.5 border border-[#dcdfe4] space-y-2.5 shadow-sm">
            <div className="text-[11px] font-bold text-[#111318] uppercase tracking-wider flex items-center justify-between">
              <span>Surface Parameters</span>
              <button
                type="button"
                onClick={() =>
                  onSurfaceParamsChange({
                    ...surfaceParams,
                    overrideEnabled: !surfaceParams.overrideEnabled,
                  })
                }
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded border cursor-pointer transition-colors ${
                  surfaceParams.overrideEnabled
                    ? 'bg-[#111318] text-white border-[#111318]'
                    : 'bg-[#f0f2f5] text-[#111318] border-[#dcdfe4]'
                }`}
              >
                {surfaceParams.overrideEnabled ? 'OVERRIDE ON' : 'ORIGINAL PBR'}
              </button>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-[#64748b]">Base Value Tint</span>
                <span className="font-mono text-[#111318] font-semibold">{surfaceParams.baseColor}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={surfaceParams.baseColor}
                  onChange={(e) =>
                    onSurfaceParamsChange({ ...surfaceParams, overrideEnabled: true, baseColor: e.target.value })
                  }
                  className="w-8 h-6 rounded bg-transparent cursor-pointer border border-[#dcdfe4]"
                  aria-label="Base Value Tint Color"
                />
                <div className="flex-1 flex gap-1.5">
                  {SWATCHES.map((sw) => (
                    <button
                      key={sw.hex}
                      type="button"
                      onClick={() =>
                        onSurfaceParamsChange({ ...surfaceParams, overrideEnabled: true, baseColor: sw.hex })
                      }
                      style={{ backgroundColor: sw.hex }}
                      title={sw.label}
                      className="w-5 h-5 rounded-full border border-[#cbd5e1] hover:scale-110 transition-transform cursor-pointer"
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-[#64748b]">Metallic</span>
                <span className="font-mono text-[#111318] font-semibold">{surfaceParams.metallic.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(surfaceParams.metallic * 100)}
                onChange={(e) =>
                  onSurfaceParamsChange({
                    ...surfaceParams,
                    overrideEnabled: true,
                    metallic: Number(e.target.value) / 100,
                  })
                }
                className="w-full custom-range"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-[#64748b]">Roughness / Gloss</span>
                <span className="font-mono text-[#111318] font-semibold">{surfaceParams.roughness.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(surfaceParams.roughness * 100)}
                onChange={(e) =>
                  onSurfaceParamsChange({
                    ...surfaceParams,
                    overrideEnabled: true,
                    roughness: Number(e.target.value) / 100,
                  })
                }
                className="w-full custom-range"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-[#64748b]">Normal Map Depth</span>
                <span className="font-mono text-[#111318] font-semibold">
                  {surfaceParams.normalStrength.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={200}
                value={Math.round(surfaceParams.normalStrength * 100)}
                onChange={(e) =>
                  onSurfaceParamsChange({
                    ...surfaceParams,
                    overrideEnabled: true,
                    normalStrength: Number(e.target.value) / 100,
                  })
                }
                className="w-full custom-range"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-[#64748b]">Optic Emission Glow</span>
                <span className="font-mono text-[#111318] font-semibold">{surfaceParams.emission.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={200}
                value={Math.round(surfaceParams.emission * 100)}
                onChange={(e) =>
                  onSurfaceParamsChange({
                    ...surfaceParams,
                    overrideEnabled: true,
                    emission: Number(e.target.value) / 100,
                  })
                }
                className="w-full custom-range"
              />
            </div>
          </div>

          {/* Inside-Out Culling & 3D Section Cut */}
          <div className="bg-white rounded-lg p-2.5 border border-[#dcdfe4] space-y-2.5 shadow-sm">
            <div className="text-[11px] font-bold text-[#111318] uppercase tracking-wider">
              Inside-Out &amp; Section Cut
            </div>
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  { id: 'front', label: 'Outer Shell' },
                  { id: 'back', label: 'Inside-Out' },
                  { id: 'double', label: 'Double-Sided' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onInsideOutChange(opt.id)}
                  className={`py-1 rounded text-[10px] font-medium border transition-colors cursor-pointer ${
                    insideOutSide === opt.id
                      ? 'bg-[#111318] text-white border-[#111318]'
                      : 'bg-[#f8f9fa] text-[#111318] border-[#dcdfe4] hover:bg-[#f0f2f5]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="pt-1 border-t border-[#e5e8ec] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[#111318]">3D Section Slicer</span>
                <button
                  type="button"
                  onClick={() => onSectionCutChange({ ...sectionCut, enabled: !sectionCut.enabled })}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono border cursor-pointer ${
                    sectionCut.enabled
                      ? 'bg-[#111318] text-white border-[#111318]'
                      : 'bg-[#f0f2f5] text-[#64748b] border-[#dcdfe4]'
                  }`}
                >
                  {sectionCut.enabled ? 'ACTIVE' : 'OFF'}
                </button>
              </div>
              {sectionCut.enabled && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    {(['x', 'y', 'z'] as const).map((ax) => (
                      <button
                        key={ax}
                        type="button"
                        onClick={() => onSectionCutChange({ ...sectionCut, axis: ax })}
                        className={`flex-1 py-0.5 rounded text-[10px] font-mono uppercase border cursor-pointer ${
                          sectionCut.axis === ax
                            ? 'bg-[#111318] text-white border-[#111318]'
                            : 'bg-[#f8f9fa] text-[#111318] border-[#dcdfe4]'
                        }`}
                      >
                        {ax}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => onSectionCutChange({ ...sectionCut, invert: !sectionCut.invert })}
                      className="px-2 py-0.5 rounded text-[10px] font-mono border border-[#dcdfe4] bg-[#f8f9fa] text-[#111318] hover:bg-[#e5e8ec] cursor-pointer"
                    >
                      Flip
                    </button>
                  </div>
                  <input
                    type="range"
                    min={-150}
                    max={250}
                    value={Math.round(sectionCut.position * 100)}
                    onChange={(e) =>
                      onSectionCutChange({ ...sectionCut, position: Number(e.target.value) / 100 })
                    }
                    className="w-full custom-range"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Loaded Texture Maps Slot Table */}
          <div className="bg-white rounded-lg p-2.5 border border-[#dcdfe4] space-y-2 shadow-sm">
            <div className="text-[11px] font-bold text-[#111318] uppercase tracking-wider">Texture Slots</div>
            <div className="space-y-1.5 font-mono text-[10px]">
              {materials.length > 0 ? (
                materials.map((m) => (
                  <div key={m.uuid} className="p-1.5 rounded bg-[#f8f9fa] border border-[#dcdfe4] space-y-1">
                    <div className="flex items-center justify-between text-[#111318] font-semibold">
                      <span className="flex items-center gap-1.5 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-sm border border-[#cbd5e1] shrink-0"
                          style={{ backgroundColor: m.colorHex }}
                        />
                        <span className="truncate">{m.name}</span>
                      </span>
                      <span className="text-[#64748b] text-[9px]">M:{m.metalness.toFixed(1)} R:{m.roughness.toFixed(1)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 text-[9px]">
                      {(['albedo', 'normal', 'roughness', 'bump', 'ao', 'emissive'] as const).map((ch) => (
                        <span
                          key={ch}
                          className={`px-1 py-0.2 rounded border ${
                            m.maps[ch]
                              ? 'bg-[#111318] text-white border-[#111318]'
                              : 'bg-white text-[#94a3b8] border-[#e2e8f0]'
                          }`}
                        >
                          {ch}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <>
                  <div className="flex items-center justify-between p-1.5 rounded bg-[#f8f9fa] border border-[#dcdfe4]">
                    <span className="flex items-center gap-1.5 text-[#111318]">
                      <span className="w-2 h-2 rounded bg-[#111318]" />
                      Base_Color.png
                    </span>
                    <span className="text-[#64748b]">Procedural 2K</span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded bg-[#f8f9fa] border border-[#dcdfe4]">
                    <span className="flex items-center gap-1.5 text-[#111318]">
                      <span className="w-2 h-2 rounded bg-[#64748b]" />
                      Normal_Mono.exr
                    </span>
                    <span className="text-[#111318] font-semibold">32-bit</span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded bg-[#f8f9fa] border border-[#dcdfe4]">
                    <span className="flex items-center gap-1.5 text-[#111318]">
                      <span className="w-2 h-2 rounded bg-[#94a3b8]" />
                      Rough_Metal_AO.png
                    </span>
                    <span className="text-[#111318] font-semibold">Packed ORM</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DIAGNOSTICS & TOPOLOGY CHECKER */}
      {activeTab === 'diagnostics' && (
        <div className="flex-1 flex flex-col overflow-y-auto p-3 space-y-3">
          <div className="bg-white rounded-lg p-3 border border-[#dcdfe4] flex items-center justify-between shadow-sm">
            <div>
              <div className="text-xs font-semibold text-[#111318]">Engine Compatibility</div>
              <div className="text-[10px] text-[#64748b]">Blender 4.2 / UE5 / glTF 2.0 Verified</div>
            </div>
            <span className="px-2 py-1 rounded bg-[#111318] text-white border border-black text-[10px] font-bold font-mono">
              {diagnostics.grade === 'EMPTY' ? 'STANDBY' : `GRADE ${diagnostics.grade}`}
            </span>
          </div>

          <div className="bg-white rounded-lg p-2.5 border border-[#dcdfe4] space-y-2 shadow-sm">
            <div className="text-[11px] font-bold text-[#111318] uppercase tracking-wider">Topology Audit</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between py-1 border-b border-[#dcdfe4] text-[11px]">
                <span className="text-[#64748b]">Quad Percentage:</span>
                <span className="text-[#111318] font-mono font-bold">{diagnostics.quadPercent.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#dcdfe4] text-[11px]">
                <span className="text-[#64748b]">Tris (Joints Only):</span>
                <span className="text-[#111318] font-mono font-medium">{diagnostics.triPercent.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#dcdfe4] text-[11px]">
                <span className="text-[#64748b]">N-Gons:</span>
                <span className="text-[#111318] font-mono font-bold">{diagnostics.ngons} (Clean)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#dcdfe4] text-[11px]">
                <span className="text-[#64748b]">Non-Manifold Edges:</span>
                <span className="text-[#111318] font-mono font-bold">{diagnostics.nonManifoldEdges}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#dcdfe4] text-[11px]">
                <span className="text-[#64748b]">Overlapping UVs:</span>
                <span className="text-[#111318] font-mono font-medium">
                  {diagnostics.overlappingUvPercent.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between py-1 text-[11px]">
                <span className="text-[#64748b]">UV Island Margin:</span>
                <span className="text-[#111318] font-mono font-medium">{diagnostics.uvMarginPx} px (Good)</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <button
              type="button"
              onClick={onRecalculateNormals}
              className="w-full py-1.5 rounded-md bg-white hover:bg-[#f0f2f5] text-[#111318] text-xs font-semibold border border-[#dcdfe4] flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">auto_fix_high</span>
              <span>Recalculate Normals Outside</span>
            </button>
            <button
              type="button"
              onClick={onPurgeDegenerates}
              className="w-full py-1.5 rounded-md bg-white hover:bg-[#f0f2f5] text-[#111318] text-xs font-semibold border border-[#dcdfe4] flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">cleaning_services</span>
              <span>Purge Degenerate Dissolves</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: RIG & ANIMATION */}
      {activeTab === 'rig' && (
        <div className="flex-1 flex flex-col overflow-y-auto p-3 space-y-3">
          <div className="bg-white rounded-lg p-2.5 border border-[#dcdfe4] space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#111318] uppercase tracking-wider">Armature &amp; Clips</span>
              <button
                type="button"
                onClick={onToggleSkeleton}
                className={`px-2 py-0.5 rounded text-[10px] font-mono border cursor-pointer ${
                  showSkeleton
                    ? 'bg-[#111318] text-white border-[#111318]'
                    : 'bg-[#f0f2f5] text-[#64748b] border-[#dcdfe4]'
                }`}
              >
                {showSkeleton ? 'BONES ON' : 'BONES OFF'}
              </button>
            </div>

            {clips.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <select
                    value={activeClipIdx}
                    onChange={(e) => onPlayClip(Number(e.target.value))}
                    className="flex-1 bg-[#f8f9fa] border border-[#dcdfe4] rounded px-2 py-1 text-[11px] font-mono text-[#111318]"
                  >
                    {clips.map((c) => (
                      <option key={c.index} value={c.index}>
                        {c.name} ({c.duration}s)
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={onToggleAnimPlay}
                    className="px-2.5 py-1 rounded bg-[#111318] text-white text-[11px] font-semibold cursor-pointer"
                  >
                    {animPlaying ? 'Pause' : 'Play'}
                  </button>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0.1, clips[activeClipIdx]?.duration || 1)}
                  step={0.05}
                  value={Math.min(animTime, clips[activeClipIdx]?.duration || 1)}
                  onChange={(e) => onSeekAnim(Number(e.target.value))}
                  className="w-full custom-range"
                />
              </div>
            ) : (
              <p className="text-[11px] text-[#64748b]">
                No animation clips on current asset. Load <span className="font-mono text-[#111318]">Apex_Titan_Mk4</span> or{' '}
                <span className="font-mono text-[#111318]">Articulated_Rigged_Arm</span> to test rig playback.
              </p>
            )}
          </div>

          <div className="bg-white rounded-lg p-2.5 border border-[#dcdfe4] space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#111318] uppercase tracking-wider">
                Bone Pose Controls ({bones.length})
              </span>
              {bones.length > 0 && (
                <button
                  type="button"
                  onClick={onResetPose}
                  className="text-[10px] font-mono text-[#111318] underline cursor-pointer"
                >
                  Reset Pose
                </button>
              )}
            </div>
            {bones.length === 0 ? (
              <p className="text-[11px] text-[#64748b]">No skeletal bones detected in active scene.</p>
            ) : (
              <div className="space-y-2.5">
                {bones.map((bone) => (
                  <div key={bone.uuid} className="p-2 rounded bg-[#f8f9fa] border border-[#dcdfe4] space-y-1.5">
                    <div className="text-[11px] font-mono font-semibold text-[#111318] truncate">{bone.name}</div>
                    {(['x', 'y', 'z'] as const).map((ax) => {
                      const val = ax === 'x' ? bone.rotX : ax === 'y' ? bone.rotY : bone.rotZ;
                      return (
                        <div key={ax} className="flex items-center gap-2 text-[10px] font-mono">
                          <span className="w-4 uppercase text-[#64748b]">{ax}</span>
                          <input
                            type="range"
                            min={-90}
                            max={90}
                            value={val}
                            onChange={(e) => onSetBoneRotation(bone.uuid, ax, Number(e.target.value))}
                            className="flex-1 custom-range"
                          />
                          <span className="w-8 text-right text-[#111318]">{val}°</span>
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
    </aside>
  );
};
