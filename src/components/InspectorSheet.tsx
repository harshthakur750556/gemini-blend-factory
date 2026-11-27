import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowDownToLine,
  Bone,
  Box,
  Camera,
  Circle,
  CloudUpload,
  Columns3,
  Copy,
  Crosshair,
  Cylinder,
  Eye,
  EyeOff,
  Flashlight,
  FlipHorizontal2,
  FolderPlus,
  Globe,
  Grid2X2,
  Landmark,
  Lightbulb,
  Lock,
  Maximize2,
  Mountain,
  Move,
  Paintbrush,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Scissors,
  Search,
  ShieldCheck,
  Sliders,
  Sparkles,
  Square,
  Sun,
  Trash2,
  Trees,
  Triangle,
  Ungroup,
  Unlock,
  Video,
  Waves,
  Wrench,
  X,
} from 'lucide-react';
import type {
  AnimationClipSummary,
  BoneControlInfo,
  GizmoMode,
  GizmoSpace,
  InsideOutSide,
  InspectorTabId,
  MaterialChannelInfo,
  MaterialEditPayload,
  OutlinerNode,
  PhysicsConfig,
  ScatterBrushConfig,
  ScatterBrushPreset,
  SceneTelemetry,
  SectionCutConfig,
  SelectedCameraInfo,
  SelectedLightInfo,
  StudioLightingPreset,
  SurfaceParams,
  TerrainBrushConfig,
  TerrainBrushMode,
  TerrainPaintLayer,
  TopologyDiagnostics,
  TransformInfo,
  ViewportToolMode,
  WorldEnvironmentPreset,
  WorldPrimitiveKind,
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
  // World Assembly & Blender Creation Suite props
  gizmoMode: GizmoMode;
  gizmoSpace: GizmoSpace;
  snapGrid: number;
  snapRotateDeg: number;
  snapScale: number;
  worldEnvPreset: WorldEnvironmentPreset;
  worldFogDensity: number;
  worldFogHeight: number;
  sunElevationDeg: number;
  shadowsEnabled: boolean;
  cameraFov: number;
  cameraSpeed: number;
  activeToolMode: ViewportToolMode;
  terrainBrush: TerrainBrushConfig;
  scatterBrush: ScatterBrushConfig;
  physicsConfig: PhysicsConfig;
  playModeActive: boolean;
  onGizmoModeChange: (mode: GizmoMode) => void;
  onGizmoSpaceChange: (space: GizmoSpace) => void;
  onSnapGridChange: (snap: number) => void;
  onSnapRotateChange: (deg: number) => void;
  onSnapScaleChange: (snap: number) => void;
  onSunElevationChange: (deg: number) => void;
  onToggleShadows: () => void;
  onWorldFogHeightChange: (h: number) => void;
  onCameraFovChange: (fov: number) => void;
  onCameraSpeedChange: (speed: number) => void;
  onActiveToolModeChange: (mode: ViewportToolMode) => void;
  onTerrainBrushChange: (cfg: TerrainBrushConfig) => void;
  onScatterBrushChange: (cfg: ScatterBrushConfig) => void;
  onPhysicsConfigChange: (cfg: PhysicsConfig) => void;
  onResetPhysics: () => void;
  onTogglePlayMode: () => void;
  onEditMaterial: (payload: MaterialEditPayload) => void;
  onSaveTexturesToRepo: () => void;
  onGroupSelected: () => void;
  onUnparentNode: (uuid: string) => void;
  onAddPrimitive: (kind: WorldPrimitiveKind) => void;
  onOpenLibraryToAppend: () => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onMirrorSelected: (axis: 'x' | 'y' | 'z') => void;
  onSnapSelectedToGround: () => void;
  onToggleFlatShading: () => void;
  onApplyArrayModifier: (count: number, offset: [number, number, number]) => void;
  onApplyScatterModifier: (count: number, radius: number) => void;
  onWorldEnvChange: (preset: WorldEnvironmentPreset, fogDensity: number) => void;
  // Outliner / Shader / Topology / Rig callbacks
  onSelectNode: (uuid: string | null) => void;
  onToggleNodeVisibility: (uuid: string) => void;
  onToggleNodeLock: (uuid: string) => void;
  onToggleSoloNode: (uuid: string) => void;
  onShowAllNodes: () => void;
  onTransformChange: (
    axis: 'posX' | 'posY' | 'posZ' | 'rotX' | 'rotY' | 'rotZ' | 'scaleX' | 'scaleY' | 'scaleZ',
    value: number
  ) => void;
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
  // Blender Light & Scene Camera Properties
  selectedLightInfo: SelectedLightInfo | null;
  selectedCameraInfo: SelectedCameraInfo | null;
  onUpdateLightProperties: (
    uuid: string,
    patch: Partial<Omit<SelectedLightInfo, 'uuid' | 'name' | 'lightKind'>>
  ) => void;
  onUpdateCameraProperties: (
    uuid: string,
    patch: Partial<Pick<SelectedCameraInfo, 'focalLengthMm' | 'near' | 'far'>>
  ) => void;
  onSetActiveSceneCamera: (uuid: string | null) => void;
  onToggleLookThroughCamera: (uuid?: string) => void;
  onAlignCameraToView: (uuid?: string) => void;
  onCaptureCameraToRepo: () => void;
}

const SWATCHES = [
  { name: 'Granite', hex: '#7B7871' },
  { name: 'Hinoki Cedar', hex: '#73482D' },
  { name: 'Dark Slate', hex: '#32373C' },
  { name: 'Patinated Bronze', hex: '#8F7450' },
  { name: 'Warm Washi', hex: '#FFF3DE' },
  { name: 'Botanical Sage', hex: '#2D5A4C' },
];

const LIGHT_COLOR_PRESETS = [
  { name: 'Warm Tungsten', hex: '#FFE4B8' },
  { name: 'Daylight', hex: '#FFF7EA' },
  { name: 'Pure White', hex: '#FFFFFF' },
  { name: 'Cool Sky', hex: '#DCEBFF' },
  { name: 'Amber Rim', hex: '#FFB76B' },
];

const LIGHTING_LABELS: Record<StudioLightingPreset, string> = {
  'studio-4k': 'Studio Gallery 4K',
  architectural: 'Daylight Architectural',
  'high-contrast': 'Sculptural Rim',
  'soft-clay': 'Warm Soft Clay',
};

const LIGHT_CAMERA_BUTTONS: Array<{
  kind: WorldPrimitiveKind;
  label: string;
  accent: 'light' | 'camera';
  icon: React.ReactNode;
}> = [
  { kind: 'point-light', label: 'Point', accent: 'light', icon: <Lightbulb className="h-3.5 w-3.5" /> },
  { kind: 'sun-light', label: 'Sun', accent: 'light', icon: <Sun className="h-3.5 w-3.5" /> },
  { kind: 'spot-light', label: 'Spot', accent: 'light', icon: <Flashlight className="h-3.5 w-3.5" /> },
  { kind: 'area-light', label: 'Area', accent: 'light', icon: <Square className="h-3.5 w-3.5" /> },
  { kind: 'scene-camera', label: 'Camera', accent: 'camera', icon: <Video className="h-3.5 w-3.5" /> },
];

const PRIMITIVE_BUTTONS: Array<{
  kind: WorldPrimitiveKind;
  label: string;
  icon: React.ReactNode;
}> = [
  { kind: 'cube', label: 'Cube', icon: <Box className="h-3.5 w-3.5" /> },
  { kind: 'sphere', label: 'Sphere', icon: <Circle className="h-3.5 w-3.5" /> },
  { kind: 'cylinder', label: 'Pillar', icon: <Cylinder className="h-3.5 w-3.5" /> },
  { kind: 'cone', label: 'Cone', icon: <Triangle className="h-3.5 w-3.5" /> },
  { kind: 'torus', label: 'Torus', icon: <Circle className="h-3.5 w-3.5" /> },
  { kind: 'plane', label: 'Floor', icon: <Square className="h-3.5 w-3.5" /> },
  { kind: 'arch', label: 'Arch', icon: <Landmark className="h-3.5 w-3.5" /> },
  { kind: 'stairs', label: 'Stairs', icon: <Columns3 className="h-3.5 w-3.5" /> },
  { kind: 'terrain', label: 'Terrain', icon: <Mountain className="h-3.5 w-3.5" /> },
  { kind: 'water', label: 'Water', icon: <Waves className="h-3.5 w-3.5" /> },
  { kind: 'collider', label: 'UCX Box', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
];

const WORLD_ENV_OPTIONS: Array<{ id: WorldEnvironmentPreset; label: string }> = [
  { id: 'alabaster', label: 'Alabaster' },
  { id: 'courtyard', label: 'Courtyard' },
  { id: 'meadow', label: 'Meadow' },
  { id: 'desert', label: 'Desert' },
  { id: 'celestial', label: 'Celestial Sky' },
];

const TERRAIN_SCULPT_MODES: Array<{ id: TerrainBrushMode; label: string }> = [
  { id: 'raise', label: 'Raise' },
  { id: 'lower', label: 'Lower (Y<0)' },
  { id: 'smooth', label: 'Smooth' },
  { id: 'flatten', label: 'Flatten' },
  { id: 'noise', label: 'Noise' },
];

const TERRAIN_PAINT_LAYERS: Array<{ id: TerrainPaintLayer; label: string; hex: string }> = [
  { id: 'grass', label: 'Grass', hex: '#5D8742' },
  { id: 'moss', label: 'Moss', hex: '#3D7856' },
  { id: 'basalt', label: 'Basalt', hex: '#4B5563' },
  { id: 'sand', label: 'Sand', hex: '#D4B483' },
  { id: 'snow', label: 'Snow', hex: '#EAF2F8' },
  { id: 'cave_dirt', label: 'Cave', hex: '#4A3B31' },
];

const SCATTER_PRESETS: Array<{ id: ScatterBrushPreset; label: string }> = [
  { id: 'pine-tree', label: 'Pine' },
  { id: 'boulder', label: 'Boulder' },
  { id: 'crystal', label: 'Crystal' },
  { id: 'grass-tuft', label: 'Grass' },
  { id: 'pillar', label: 'Pillar' },
];

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

    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#F5F3EF');
    bg.addColorStop(1, '#E8E4DC');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

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
  gizmoMode,
  gizmoSpace,
  snapGrid,
  snapRotateDeg,
  snapScale,
  worldEnvPreset,
  worldFogDensity,
  worldFogHeight,
  sunElevationDeg,
  shadowsEnabled,
  cameraFov,
  cameraSpeed,
  activeToolMode,
  terrainBrush,
  scatterBrush,
  physicsConfig,
  playModeActive,
  onGizmoModeChange,
  onGizmoSpaceChange,
  onSnapGridChange,
  onSnapRotateChange,
  onSnapScaleChange,
  onSunElevationChange,
  onToggleShadows,
  onWorldFogHeightChange,
  onCameraFovChange,
  onCameraSpeedChange,
  onActiveToolModeChange,
  onTerrainBrushChange,
  onScatterBrushChange,
  onPhysicsConfigChange,
  onResetPhysics,
  onTogglePlayMode,
  onEditMaterial,
  onSaveTexturesToRepo,
  onGroupSelected,
  onUnparentNode,
  onAddPrimitive,
  onOpenLibraryToAppend,
  onDuplicateSelected,
  onDeleteSelected,
  onMirrorSelected,
  onSnapSelectedToGround,
  onToggleFlatShading,
  onApplyArrayModifier,
  onApplyScatterModifier,
  onWorldEnvChange,
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
  selectedLightInfo,
  selectedCameraInfo,
  onUpdateLightProperties,
  onUpdateCameraProperties,
  onSetActiveSceneCamera,
  onToggleLookThroughCamera,
  onAlignCameraToView,
  onCaptureCameraToRepo,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [nodeFilter, setNodeFilter] = useState<'all' | 'mesh' | 'studio' | 'bone'>('all');
  const [arrayCount, setArrayCount] = useState(4);
  const [arrayOffsetX, setArrayOffsetX] = useState(1.25);
  const [arrayOffsetY, setArrayOffsetY] = useState(0);
  const [arrayOffsetZ, setArrayOffsetZ] = useState(0);
  const [scatterCount, setScatterCount] = useState(6);
  const [scatterRadius, setScatterRadius] = useState(3.2);
  const [editingMaterialUuid, setEditingMaterialUuid] = useState<string | null>(null);

  const filteredNodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return outlinerNodes.filter((n) => {
      if (nodeFilter === 'mesh' && n.type !== 'Mesh' && n.type !== 'SkinnedMesh') return false;
      if (nodeFilter === 'studio' && n.type !== 'Light' && n.type !== 'Camera') return false;
      if (nodeFilter === 'bone' && n.type !== 'Bone') return false;
      if (q && !n.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [outlinerNodes, searchQuery, nodeFilter]);

  if (!open) return null;

  const renderLightPropertiesCard = () => {
    if (!selectedLightInfo) return null;
    const isSpot = selectedLightInfo.lightKind === 'spot';
    const isPoint = selectedLightInfo.lightKind === 'point';
    const isArea = selectedLightInfo.lightKind === 'area';
    return (
      <div className="rounded-xl border border-[#E7D8BE] bg-[#FBF8F1] p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.04em] text-[#7D5516] uppercase">
            {selectedLightInfo.lightKind === 'sun' ? (
              <Sun className="h-3.5 w-3.5" />
            ) : selectedLightInfo.lightKind === 'spot' ? (
              <Flashlight className="h-3.5 w-3.5" />
            ) : (
              <Lightbulb className="h-3.5 w-3.5" />
            )}
            {selectedLightInfo.lightKind} Light Properties
          </div>
          <span className="truncate font-mono text-[10.5px] text-[#6E6960]">
            {selectedLightInfo.name}
          </span>
        </div>

        {/* Color & Presets */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#5A564F]">Light Color</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10.5px] text-[#6E6960]">
                {selectedLightInfo.color.toUpperCase()}
              </span>
              <input
                type="color"
                aria-label="Light color"
                value={selectedLightInfo.color}
                onChange={(e) =>
                  onUpdateLightProperties(selectedLightInfo.uuid, { color: e.target.value })
                }
                className="h-6 w-7 cursor-pointer rounded border border-[#D8D3CA] bg-white p-0.5"
              />
            </div>
          </div>
          <div className="grid grid-cols-5 gap-1">
            {LIGHT_COLOR_PRESETS.map((p) => (
              <button
                key={p.hex}
                type="button"
                title={p.name}
                aria-label={`Apply ${p.name} light color`}
                onClick={() =>
                  onUpdateLightProperties(selectedLightInfo.uuid, { color: p.hex })
                }
                className="h-5 rounded border border-[#DCD4C6] transition-transform hover:scale-105"
                style={{ backgroundColor: p.hex }}
              />
            ))}
          </div>
        </div>

        {/* Power / Intensity */}
        <div>
          <div className="mb-1 flex justify-between text-[11px]">
            <span className="text-[#5A564F]">Power / Intensity</span>
            <span className="font-mono text-[#1C1B19] tabular-nums">
              {selectedLightInfo.intensity.toFixed(1)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={25}
            step={0.2}
            aria-label="Light intensity"
            value={selectedLightInfo.intensity}
            onChange={(e) =>
              onUpdateLightProperties(selectedLightInfo.uuid, {
                intensity: parseFloat(e.target.value),
              })
            }
            className="atelier-range w-full"
          />
        </div>

        {/* Distance (Point & Spot) */}
        {(isPoint || isSpot) && typeof selectedLightInfo.distance === 'number' && (
          <div>
            <div className="mb-1 flex justify-between text-[11px]">
              <span className="text-[#5A564F]">Range / Distance</span>
              <span className="font-mono text-[#1C1B19] tabular-nums">
                {selectedLightInfo.distance.toFixed(1)} m
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={30}
              step={0.5}
              aria-label="Light distance"
              value={selectedLightInfo.distance}
              onChange={(e) =>
                onUpdateLightProperties(selectedLightInfo.uuid, {
                  distance: parseFloat(e.target.value),
                })
              }
              className="atelier-range w-full"
            />
          </div>
        )}

        {/* Spot Cone Angle & Penumbra */}
        {isSpot && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="mb-1 flex justify-between text-[10.5px]">
                <span className="text-[#5A564F]">Cone</span>
                <span className="font-mono text-[#1C1B19]">{selectedLightInfo.angleDeg ?? 32}°</span>
              </div>
              <input
                type="range"
                min={10}
                max={80}
                step={1}
                aria-label="Spot cone angle"
                value={selectedLightInfo.angleDeg ?? 32}
                onChange={(e) =>
                  onUpdateLightProperties(selectedLightInfo.uuid, {
                    angleDeg: parseInt(e.target.value, 10),
                  })
                }
                className="atelier-range w-full"
              />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[10.5px]">
                <span className="text-[#5A564F]">Blend</span>
                <span className="font-mono text-[#1C1B19]">
                  {Math.round((selectedLightInfo.penumbra ?? 0.35) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                aria-label="Spot penumbra blend"
                value={selectedLightInfo.penumbra ?? 0.35}
                onChange={(e) =>
                  onUpdateLightProperties(selectedLightInfo.uuid, {
                    penumbra: parseFloat(e.target.value),
                  })
                }
                className="atelier-range w-full"
              />
            </div>
          </div>
        )}

        {/* Area Width & Height */}
        {isArea && (
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[10.5px] text-[#5A564F]">Width (m)</span>
              <input
                type="number"
                min={0.2}
                max={10}
                step={0.2}
                value={Number((selectedLightInfo.width ?? 2.0).toFixed(1))}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (Number.isFinite(v) && v >= 0.2) {
                    onUpdateLightProperties(selectedLightInfo.uuid, { width: v });
                  }
                }}
                className="mt-1 w-full rounded-lg border border-[#E2DDD4] bg-white px-2 py-1 font-mono text-[11px]"
              />
            </label>
            <label className="block">
              <span className="text-[10.5px] text-[#5A564F]">Height (m)</span>
              <input
                type="number"
                min={0.2}
                max={10}
                step={0.2}
                value={Number((selectedLightInfo.height ?? 1.2).toFixed(1))}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (Number.isFinite(v) && v >= 0.2) {
                    onUpdateLightProperties(selectedLightInfo.uuid, { height: v });
                  }
                }}
                className="mt-1 w-full rounded-lg border border-[#E2DDD4] bg-white px-2 py-1 font-mono text-[11px]"
              />
            </label>
          </div>
        )}

        {/* Cast Shadow Toggle */}
        {!isArea && (
          <label className="flex cursor-pointer items-center justify-between pt-0.5 text-[11.5px] text-[#1C1B19]">
            <span>Cast Shadows</span>
            <input
              type="checkbox"
              checked={selectedLightInfo.castShadow}
              onChange={(e) =>
                onUpdateLightProperties(selectedLightInfo.uuid, { castShadow: e.target.checked })
              }
              className="h-4 w-4 accent-[#2D5A4C]"
            />
          </label>
        )}
      </div>
    );
  };

  const renderCameraPropertiesCard = () => {
    if (!selectedCameraInfo) return null;
    return (
      <div className="rounded-xl border border-[#CFE2DA] bg-[#F3F8F6] p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.04em] text-[#1D4438] uppercase">
            <Video className="h-3.5 w-3.5" />
            Scene Camera
          </div>
          <span className="truncate font-mono text-[10.5px] text-[#4C5C56]">
            {selectedCameraInfo.name}
          </span>
        </div>

        {/* Focal Length & Live FOV */}
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="text-[#4C5C56]">Focal Length</span>
            <span className="font-mono text-[#1C1B19] tabular-nums">
              {Math.round(selectedCameraInfo.focalLengthMm)} mm · {selectedCameraInfo.fov}° FOV
            </span>
          </div>
          <input
            type="range"
            min={18}
            max={200}
            step={1}
            aria-label="Camera focal length mm"
            value={Math.round(selectedCameraInfo.focalLengthMm)}
            onChange={(e) =>
              onUpdateCameraProperties(selectedCameraInfo.uuid, {
                focalLengthMm: parseInt(e.target.value, 10),
              })
            }
            className="atelier-range w-full"
          />
          <div className="mt-1.5 grid grid-cols-4 gap-1">
            {[24, 35, 50, 85].map((mm) => (
              <button
                key={mm}
                type="button"
                onClick={() =>
                  onUpdateCameraProperties(selectedCameraInfo.uuid, { focalLengthMm: mm })
                }
                className={`rounded-md border py-0.5 font-mono text-[10px] transition-colors ${
                  Math.round(selectedCameraInfo.focalLengthMm) === mm
                    ? 'border-[#2D5A4C] bg-[#2D5A4C] text-white'
                    : 'border-[#D4E2DC] bg-white text-[#4C5C56] hover:text-[#1C1B19]'
                }`}
              >
                {mm}mm
              </button>
            ))}
          </div>
        </div>

        {/* Clip Start / End */}
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[10.5px] text-[#4C5C56]">Clip Start (m)</span>
            <input
              type="number"
              min={0.01}
              max={10}
              step={0.05}
              value={Number(selectedCameraInfo.near.toFixed(2))}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isFinite(v) && v >= 0.01) {
                  onUpdateCameraProperties(selectedCameraInfo.uuid, { near: v });
                }
              }}
              className="mt-1 w-full rounded-lg border border-[#D4E2DC] bg-white px-2 py-1 font-mono text-[11px]"
            />
          </label>
          <label className="block">
            <span className="text-[10.5px] text-[#4C5C56]">Clip End (m)</span>
            <input
              type="number"
              min={5}
              max={1000}
              step={10}
              value={Math.round(selectedCameraInfo.far)}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isFinite(v) && v >= 5) {
                  onUpdateCameraProperties(selectedCameraInfo.uuid, { far: v });
                }
              }}
              className="mt-1 w-full rounded-lg border border-[#D4E2DC] bg-white px-2 py-1 font-mono text-[11px]"
            />
          </label>
        </div>

        {/* Blender Camera Actions */}
        <div className="grid grid-cols-1 gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={() => onToggleLookThroughCamera(selectedCameraInfo.uuid)}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11.5px] font-medium transition-colors ${
              selectedCameraInfo.lookingThrough
                ? 'bg-[#1C1B19] text-white hover:bg-[#33312E]'
                : 'bg-[#2D5A4C] text-white hover:bg-[#22453A]'
            }`}
          >
            <Video className="h-3.5 w-3.5" />
            {selectedCameraInfo.lookingThrough
              ? 'Exit Camera View (Numpad 0)'
              : 'Look Through Camera (Numpad 0)'}
          </button>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => onAlignCameraToView(selectedCameraInfo.uuid)}
              className="flex items-center justify-center gap-1 rounded-lg border border-[#C9DBD3] bg-white py-1.5 text-[11px] font-medium text-[#1D4438] hover:bg-[#EBF2EF]"
            >
              <Crosshair className="h-3 w-3" />
              Align to View
            </button>
            <button
              type="button"
              onClick={() => {
                onSetActiveSceneCamera(selectedCameraInfo.uuid);
                onCaptureCameraToRepo();
              }}
              className="flex items-center justify-center gap-1 rounded-lg border border-[#C9DBD3] bg-white py-1.5 text-[11px] font-medium text-[#1D4438] hover:bg-[#EBF2EF]"
            >
              <CloudUpload className="h-3 w-3" />
              Save to Repo
            </button>
          </div>
        </div>
      </div>
    );
  };

  const tabs: Array<{ id: InspectorTabId; label: string; icon: React.ReactNode }> = [
    { id: 'outliner', label: 'Scene', icon: <Box className="h-3.5 w-3.5" /> },
    { id: 'world', label: 'World', icon: <Globe className="h-3.5 w-3.5" /> },
    { id: 'material', label: 'Shader', icon: <Sliders className="h-3.5 w-3.5" /> },
    { id: 'diagnostics', label: 'Mesh', icon: <Activity className="h-3.5 w-3.5" /> },
    { id: 'rig', label: 'Rig', icon: <Bone className="h-3.5 w-3.5" /> },
  ];

  return (
    <aside
      aria-label="Scene & World Inspector"
      className="atelier-surface animate-atelier-sheet fixed inset-x-2 top-14 bottom-2 z-30 flex flex-col overflow-hidden rounded-2xl sm:left-auto sm:top-16 sm:right-3 sm:bottom-20 sm:w-[360px]"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#EFECE6] px-4 py-3">
        <div>
          <h2 className="font-display text-[16px] font-medium tracking-[-0.01em] text-[#1C1B19]">
            Studio Inspector
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

      {/* 5-Tab Navigation */}
      <div className="grid grid-cols-5 gap-1 border-b border-[#EFECE6] bg-[#FAF9F6] p-1.5">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[10.5px] font-medium transition-colors ${
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
                  placeholder="Filter parts, lights, or bones..."
                  className="w-full rounded-lg border border-[#E5E1DA] bg-[#FAF9F6] py-1.5 pr-3 pl-8 text-[12px] text-[#1C1B19] outline-none focus:border-[#2D5A4C] focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'mesh', label: 'Mesh' },
                      { id: 'studio', label: 'Lights/Cam' },
                      { id: 'bone', label: 'Bone' },
                    ] as const
                  ).map((kind) => (
                    <button
                      key={kind.id}
                      type="button"
                      onClick={() => setNodeFilter(kind.id)}
                      className={`rounded-md px-2 py-1 text-[10.5px] font-medium transition-colors ${
                        nodeFilter === kind.id
                          ? 'bg-[#EBF2EF] text-[#22453A]'
                          : 'text-[#6E6960] hover:bg-[#F5F3EF]'
                      }`}
                    >
                      {kind.label}
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
            <div className="max-h-52 overflow-y-auto rounded-xl border border-[#ECE8E1] bg-[#FCFBF9] p-1">
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
                        ) : node.type === 'Camera' ? (
                          <Video
                            className={`h-3 w-3 shrink-0 ${
                              node.isActiveCamera ? 'text-[#2D5A4C]' : 'text-[#6E6960]'
                            }`}
                          />
                        ) : node.type === 'Light' ? (
                          node.lightKind === 'sun' ? (
                            <Sun className="h-3 w-3 shrink-0 text-[#9A6316]" />
                          ) : node.lightKind === 'spot' ? (
                            <Flashlight className="h-3 w-3 shrink-0 text-[#9A6316]" />
                          ) : (
                            <Lightbulb className="h-3 w-3 shrink-0 text-[#9A6316]" />
                          )
                        ) : (
                          <Box className="h-3 w-3 shrink-0 text-[#847E75]" />
                        )}
                        <span className="truncate text-[11.5px] font-medium text-[#1C1B19]">
                          {node.name}
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center gap-0.5">
                        {node.type === 'Camera' && (
                          <button
                            type="button"
                            onClick={() => onToggleLookThroughCamera(node.uuid)}
                            title="Look Through Camera (Numpad 0)"
                            aria-label={`Look through ${node.name}`}
                            className={`rounded p-1 transition-colors ${
                              node.isActiveCamera
                                ? 'bg-[#EBF2EF] text-[#2D5A4C]'
                                : 'text-[#847E75] hover:bg-white hover:text-[#1C1B19]'
                            }`}
                          >
                            <Camera className="h-3 w-3" />
                          </button>
                        )}
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

            {/* Outliner Hierarchy Quick Actions (Group / Unparent / Duplicate / Delete) */}
            <div className="grid grid-cols-4 gap-1">
              <button
                type="button"
                onClick={onGroupSelected}
                disabled={!selectedNodeUuid}
                title="Wrap selected node in a parent Group"
                className="flex items-center justify-center gap-1 rounded-lg border border-[#E5E1DA] bg-white py-1.5 text-[10.5px] font-medium text-[#1C1B19] transition-colors hover:border-[#2D5A4C] hover:bg-[#F4F9F6] disabled:opacity-40"
              >
                <FolderPlus className="h-3 w-3 text-[#2D5A4C]" />
                Group
              </button>
              <button
                type="button"
                onClick={() => selectedNodeUuid && onUnparentNode(selectedNodeUuid)}
                disabled={!selectedNodeUuid}
                title="Unparent selected node to scene root"
                className="flex items-center justify-center gap-1 rounded-lg border border-[#E5E1DA] bg-white py-1.5 text-[10.5px] font-medium text-[#1C1B19] transition-colors hover:border-[#2D5A4C] hover:bg-[#F4F9F6] disabled:opacity-40"
              >
                <Ungroup className="h-3 w-3 text-[#2D5A4C]" />
                Unparent
              </button>
              <button
                type="button"
                onClick={onDuplicateSelected}
                title="Duplicate selected node (Shift+D)"
                className="flex items-center justify-center gap-1 rounded-lg border border-[#E5E1DA] bg-white py-1.5 text-[10.5px] font-medium text-[#1C1B19] transition-colors hover:border-[#2D5A4C] hover:bg-[#F4F9F6]"
              >
                <Copy className="h-3 w-3 text-[#2D5A4C]" />
                Clone
              </button>
              <button
                type="button"
                onClick={onDeleteSelected}
                disabled={!selectedNodeUuid}
                title="Delete selected node (Delete)"
                className="flex items-center justify-center gap-1 rounded-lg border border-[#EBD2D3] bg-[#FDF6F6] py-1.5 text-[10.5px] font-medium text-[#9E3134] transition-colors hover:bg-[#FAEAEA] disabled:opacity-40"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            </div>

            {renderLightPropertiesCard()}
            {renderCameraPropertiesCard()}

            {/* Editable Transform (Position, Rotation, Scale) */}
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

                <div>
                  <div className="mb-1 text-[10.5px] font-medium text-[#6E6960]">Scale (×)</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['scaleX', 'scaleY', 'scaleZ'] as const).map((axis, idx) => (
                      <label key={axis} className="block">
                        <span className="sr-only">{axis}</span>
                        <div className="flex items-center rounded-lg border border-[#E2DDD4] bg-white px-2 py-1">
                          <span className="mr-1 font-mono text-[10px] font-semibold text-[#847E75]">
                            {['X', 'Y', 'Z'][idx]}
                          </span>
                          <input
                            type="number"
                            step="0.1"
                            min="0.05"
                            value={Number(transformInfo[axis].toFixed(2))}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              if (Number.isFinite(v) && v > 0.01) onTransformChange(axis, v);
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
            <div className="space-y-2 rounded-xl border border-[#ECE8E1] bg-white p-3.5 text-[11.5px]">
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

        {/* WORLD & GAME ASSEMBLY TAB (Blender-Inspired Creation Suite) */}
        {activeTab === 'world' && (
          <div className="space-y-4">
            {/* Transform Gizmo Controls */}
            <div className="rounded-xl border border-[#ECE8E1] bg-[#FAF9F6] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-[0.04em] text-[#5A564F] uppercase">
                  Transform Gizmo (G / R / S)
                </span>
                <span className="font-mono text-[10.5px] text-[#2D5A4C]">
                  {transformInfo.name}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1">
                {(
                  [
                    { id: 'none', label: 'Off', icon: <X className="h-3.5 w-3.5" /> },
                    { id: 'translate', label: 'Move', icon: <Move className="h-3.5 w-3.5" /> },
                    { id: 'rotate', label: 'Rotate', icon: <RotateCw className="h-3.5 w-3.5" /> },
                    { id: 'scale', label: 'Scale', icon: <Maximize2 className="h-3.5 w-3.5" /> },
                  ] as const
                ).map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => onGizmoModeChange(g.id)}
                    className={`flex flex-col items-center gap-0.5 rounded-lg border py-1.5 text-[10.5px] font-medium transition-colors ${
                      gizmoMode === g.id
                        ? 'border-[#2D5A4C] bg-[#2D5A4C] text-white'
                        : 'border-[#E5E1DA] bg-white text-[#5A564F] hover:text-[#1C1B19]'
                    }`}
                  >
                    {g.icon}
                    {g.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                <div className="flex items-center gap-1 rounded-lg border border-[#E5E1DA] bg-white p-1">
                  {(['world', 'local'] as const).map((sp) => (
                    <button
                      key={sp}
                      type="button"
                      onClick={() => onGizmoSpaceChange(sp)}
                      className={`flex-1 rounded-md py-1 text-[10.5px] font-medium capitalize transition-colors ${
                        gizmoSpace === sp
                          ? 'bg-[#EBF2EF] text-[#1D4438]'
                          : 'text-[#6E6960] hover:text-[#1C1B19]'
                      }`}
                    >
                      {sp}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  <select
                    value={snapGrid}
                    onChange={(e) => onSnapGridChange(Number(e.target.value))}
                    aria-label="Grid snap increment"
                    className="flex-1 rounded-lg border border-[#E5E1DA] bg-white px-1.5 py-1.5 font-mono text-[10px] text-[#1C1B19] outline-none focus:border-[#2D5A4C]"
                  >
                    <option value={0}>Grid: Free</option>
                    <option value={0.1}>0.1m</option>
                    <option value={0.25}>0.25m</option>
                    <option value={0.5}>0.5m</option>
                    <option value={1}>1.0m</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => onSnapRotateChange(snapRotateDeg === 15 ? 0 : 15)}
                    title="Toggle 15° rotation snap"
                    className={`rounded-lg border px-1.5 py-1.5 font-mono text-[10px] font-medium transition-colors ${
                      snapRotateDeg === 15
                        ? 'border-[#2D5A4C] bg-[#EBF2EF] text-[#1D4438]'
                        : 'border-[#E5E1DA] bg-white text-[#6E6960]'
                    }`}
                  >
                    15°
                  </button>
                  <button
                    type="button"
                    onClick={() => onSnapScaleChange(snapScale > 0 ? 0 : 0.25)}
                    title="Toggle 0.25× scale snap"
                    className={`rounded-lg border px-1.5 py-1.5 font-mono text-[10px] font-medium transition-colors ${
                      snapScale > 0
                        ? 'border-[#2D5A4C] bg-[#EBF2EF] text-[#1D4438]'
                        : 'border-[#E5E1DA] bg-white text-[#6E6960]'
                    }`}
                  >
                    .25×
                  </button>
                </div>
              </div>
            </div>

            {/* Blender Lights & Scene Cameras Creation Strip */}
            <div className="rounded-xl border border-[#ECE8E1] bg-white p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-[0.04em] text-[#5A564F] uppercase">
                  Lights & Cameras
                </span>
                <span className="font-mono text-[10px] text-[#847E75]">Numpad 0 · View</span>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {LIGHT_CAMERA_BUTTONS.map((item) => (
                  <button
                    key={item.kind}
                    type="button"
                    onClick={() => onAddPrimitive(item.kind)}
                    className={`flex flex-col items-center justify-center gap-1 rounded-lg border px-1 py-2 text-[10.5px] font-medium transition-colors ${
                      item.accent === 'camera'
                        ? 'border-[#CFE2DA] bg-[#F4F9F6] text-[#1D4438] hover:border-[#2D5A4C] hover:bg-[#E7F2ED]'
                        : 'border-[#EAE0CE] bg-[#FCF9F2] text-[#5E4518] hover:border-[#B8863B] hover:bg-[#F7EFE0]'
                    }`}
                  >
                    <span className={item.accent === 'camera' ? 'text-[#2D5A4C]' : 'text-[#9A6316]'}>
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {renderLightPropertiesCard()}
            {renderCameraPropertiesCard()}

            {/* Add Mesh / World Prefabs (Shift+A style) */}
            <div className="rounded-xl border border-[#ECE8E1] bg-white p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-[0.04em] text-[#5A564F] uppercase">
                  Add Mesh & World Prefabs
                </span>
                <button
                  type="button"
                  onClick={onOpenLibraryToAppend}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2D5A4C] hover:underline"
                >
                  <Plus className="h-3 w-3" />
                  Kitbash Model
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {PRIMITIVE_BUTTONS.map((p) => (
                  <button
                    key={p.kind}
                    type="button"
                    onClick={() => onAddPrimitive(p.kind)}
                    className="flex items-center gap-1.5 rounded-lg border border-[#E8E4DD] bg-[#FAF9F6] px-2.5 py-2 text-[11px] font-medium text-[#1C1B19] transition-colors hover:border-[#2D5A4C] hover:bg-[#F2F8F5]"
                  >
                    <span className="text-[#2D5A4C]">{p.icon}</span>
                    <span className="truncate">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Object & Level Dressing Ops */}
            <div className="rounded-xl border border-[#ECE8E1] bg-white p-3.5 space-y-2">
              <div className="text-[11px] font-semibold tracking-[0.04em] text-[#5A564F] uppercase">
                Object & Assembly Ops
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={onDuplicateSelected}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-[#E2DDD4] bg-[#FAF9F6] py-1.5 text-[11.5px] font-medium text-[#1C1B19] hover:border-[#2D5A4C] hover:bg-white"
                >
                  <Copy className="h-3.5 w-3.5 text-[#2D5A4C]" />
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={onSnapSelectedToGround}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-[#E2DDD4] bg-[#FAF9F6] py-1.5 text-[11.5px] font-medium text-[#1C1B19] hover:border-[#2D5A4C] hover:bg-white"
                >
                  <ArrowDownToLine className="h-3.5 w-3.5 text-[#2D5A4C]" />
                  Snap Floor
                </button>
                <button
                  type="button"
                  onClick={() => onMirrorSelected('x')}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-[#E2DDD4] bg-[#FAF9F6] py-1.5 text-[11.5px] font-medium text-[#1C1B19] hover:border-[#2D5A4C] hover:bg-white"
                >
                  <FlipHorizontal2 className="h-3.5 w-3.5 text-[#2D5A4C]" />
                  Mirror X
                </button>
                <button
                  type="button"
                  onClick={() => onMirrorSelected('z')}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-[#E2DDD4] bg-[#FAF9F6] py-1.5 text-[11.5px] font-medium text-[#1C1B19] hover:border-[#2D5A4C] hover:bg-white"
                >
                  <FlipHorizontal2 className="h-3.5 w-3.5 rotate-90 text-[#2D5A4C]" />
                  Mirror Z
                </button>
                <button
                  type="button"
                  onClick={onToggleFlatShading}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-[#E2DDD4] bg-[#FAF9F6] py-1.5 text-[11.5px] font-medium text-[#1C1B19] hover:border-[#2D5A4C] hover:bg-white"
                >
                  <Sparkles className="h-3.5 w-3.5 text-[#2D5A4C]" />
                  Flat / Smooth
                </button>
                <button
                  type="button"
                  onClick={onDeleteSelected}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-[#EBD2D3] bg-[#FDF6F6] py-1.5 text-[11.5px] font-medium text-[#9E3134] hover:bg-[#FAEAEA]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Node
                </button>
              </div>
            </div>

            {/* Array Modifier & Scatter Cloner */}
            <div className="rounded-xl border border-[#ECE8E1] bg-[#FAF9F6] p-3.5 space-y-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.04em] text-[#5A564F] uppercase">
                <Grid2X2 className="h-3.5 w-3.5 text-[#2D5A4C]" />
                Array & Scatter Modifiers
              </div>

              <div className="rounded-lg border border-[#EAE5DC] bg-white p-2.5 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-medium text-[#1C1B19]">
                  <span>Linear Array Modifier</span>
                  <span className="font-mono text-[#6E6960]">{arrayCount}× copies</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <label className="block">
                    <span className="text-[9.5px] text-[#847E75]">Count</span>
                    <input
                      type="number"
                      min={2}
                      max={16}
                      value={arrayCount}
                      onChange={(e) => setArrayCount(Math.max(2, Math.min(16, Number(e.target.value) || 2)))}
                      className="w-full rounded border border-[#E2DDD4] px-1.5 py-1 font-mono text-[11px]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[9.5px] text-[#847E75]">dX (m)</span>
                    <input
                      type="number"
                      step="0.25"
                      value={arrayOffsetX}
                      onChange={(e) => setArrayOffsetX(Number(e.target.value) || 0)}
                      className="w-full rounded border border-[#E2DDD4] px-1.5 py-1 font-mono text-[11px]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[9.5px] text-[#847E75]">dY (m)</span>
                    <input
                      type="number"
                      step="0.25"
                      value={arrayOffsetY}
                      onChange={(e) => setArrayOffsetY(Number(e.target.value) || 0)}
                      className="w-full rounded border border-[#E2DDD4] px-1.5 py-1 font-mono text-[11px]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[9.5px] text-[#847E75]">dZ (m)</span>
                    <input
                      type="number"
                      step="0.25"
                      value={arrayOffsetZ}
                      onChange={(e) => setArrayOffsetZ(Number(e.target.value) || 0)}
                      className="w-full rounded border border-[#E2DDD4] px-1.5 py-1 font-mono text-[11px]"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onApplyArrayModifier(arrayCount, [arrayOffsetX, arrayOffsetY, arrayOffsetZ])
                  }
                  className="w-full rounded-lg bg-[#2D5A4C] py-1.5 text-[11.5px] font-medium text-white hover:bg-[#22453A]"
                >
                  Apply Array Modifier
                </button>
              </div>

              <div className="rounded-lg border border-[#EAE5DC] bg-white p-2.5 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-medium text-[#1C1B19]">
                  <span>World Scatter / Instancer</span>
                  <span className="font-mono text-[#6E6960]">
                    {scatterCount} · {scatterRadius}m
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <label className="block">
                    <span className="text-[9.5px] text-[#847E75]">Instances</span>
                    <input
                      type="number"
                      min={2}
                      max={24}
                      value={scatterCount}
                      onChange={(e) =>
                        setScatterCount(Math.max(2, Math.min(24, Number(e.target.value) || 2)))
                      }
                      className="w-full rounded border border-[#E2DDD4] px-1.5 py-1 font-mono text-[11px]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[9.5px] text-[#847E75]">Radius (m)</span>
                    <input
                      type="number"
                      step="0.5"
                      min={1}
                      max={10}
                      value={scatterRadius}
                      onChange={(e) => setScatterRadius(Math.max(1, Number(e.target.value) || 2))}
                      className="w-full rounded border border-[#E2DDD4] px-1.5 py-1 font-mono text-[11px]"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => onApplyScatterModifier(scatterCount, scatterRadius)}
                  className="w-full rounded-lg border border-[#2D5A4C] bg-[#F2F8F5] py-1.5 text-[11.5px] font-medium text-[#1D4438] hover:bg-[#E4F0EB]"
                >
                  Scatter Around Stage
                </button>
              </div>
            </div>

            {/* Open-World Terrain Sculpting & Multi-Layer Ground Paint */}
            <div className="rounded-xl border border-[#ECE8E1] bg-white p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.04em] text-[#5A564F] uppercase">
                  <Mountain className="h-3.5 w-3.5 text-[#2D5A4C]" />
                  Terrain Sculpt & Paint
                </span>
                <button
                  type="button"
                  onClick={() => onAddPrimitive('terrain')}
                  className="text-[10.5px] font-medium text-[#2D5A4C] hover:underline"
                >
                  + Spawn Terrain
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() =>
                    onActiveToolModeChange(
                      activeToolMode === 'terrain-sculpt' ? 'orbit' : 'terrain-sculpt'
                    )
                  }
                  className={`flex items-center justify-center gap-1 rounded-lg border py-1.5 text-[11px] font-medium transition-colors ${
                    activeToolMode === 'terrain-sculpt'
                      ? 'border-[#2D5A4C] bg-[#2D5A4C] text-white'
                      : 'border-[#E5E1DA] bg-[#FAF9F6] text-[#1C1B19] hover:border-[#2D5A4C]'
                  }`}
                >
                  <Mountain className="h-3 w-3" />
                  Sculpt
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onActiveToolModeChange(
                      activeToolMode === 'terrain-paint' ? 'orbit' : 'terrain-paint'
                    )
                  }
                  className={`flex items-center justify-center gap-1 rounded-lg border py-1.5 text-[11px] font-medium transition-colors ${
                    activeToolMode === 'terrain-paint'
                      ? 'border-[#2D5A4C] bg-[#2D5A4C] text-white'
                      : 'border-[#E5E1DA] bg-[#FAF9F6] text-[#1C1B19] hover:border-[#2D5A4C]'
                  }`}
                >
                  <Paintbrush className="h-3 w-3" />
                  Paint
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onActiveToolModeChange(
                      activeToolMode === 'scatter-brush' ? 'orbit' : 'scatter-brush'
                    )
                  }
                  className={`flex items-center justify-center gap-1 rounded-lg border py-1.5 text-[11px] font-medium transition-colors ${
                    activeToolMode === 'scatter-brush'
                      ? 'border-[#2D5A4C] bg-[#2D5A4C] text-white'
                      : 'border-[#E5E1DA] bg-[#FAF9F6] text-[#1C1B19] hover:border-[#2D5A4C]'
                  }`}
                >
                  <Trees className="h-3 w-3" />
                  Scatter
                </button>
              </div>

              {activeToolMode === 'terrain-sculpt' && (
                <div className="space-y-2 rounded-lg border border-[#EAE5DC] bg-[#FAF9F6] p-2.5">
                  <div className="grid grid-cols-3 gap-1">
                    {TERRAIN_SCULPT_MODES.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onTerrainBrushChange({ ...terrainBrush, mode: m.id })}
                        className={`rounded-md border py-1 text-[10.5px] font-medium transition-colors ${
                          terrainBrush.mode === m.id
                            ? 'border-[#2D5A4C] bg-[#EBF2EF] text-[#1D4438]'
                            : 'border-[#E2DDD4] bg-white text-[#5A564F]'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="mb-0.5 flex justify-between text-[10px] text-[#5A564F]">
                        <span>Radius</span>
                        <span className="font-mono">{terrainBrush.radius.toFixed(1)}m</span>
                      </div>
                      <input
                        type="range"
                        min={0.6}
                        max={12}
                        step={0.2}
                        value={terrainBrush.radius}
                        onChange={(e) =>
                          onTerrainBrushChange({ ...terrainBrush, radius: parseFloat(e.target.value) })
                        }
                        className="atelier-range w-full"
                      />
                    </div>
                    <div>
                      <div className="mb-0.5 flex justify-between text-[10px] text-[#5A564F]">
                        <span>Strength</span>
                        <span className="font-mono">{terrainBrush.strength.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min={0.05}
                        max={1.5}
                        step={0.05}
                        value={terrainBrush.strength}
                        onChange={(e) =>
                          onTerrainBrushChange({ ...terrainBrush, strength: parseFloat(e.target.value) })
                        }
                        className="atelier-range w-full"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-[#6E6960]">
                    Drag on terrain to sculpt (supports caves & valleys below Y = 0). Press Esc to exit.
                  </p>
                </div>
              )}

              {activeToolMode === 'terrain-paint' && (
                <div className="space-y-2 rounded-lg border border-[#EAE5DC] bg-[#FAF9F6] p-2.5">
                  <div className="grid grid-cols-3 gap-1">
                    {TERRAIN_PAINT_LAYERS.map((layer) => (
                      <button
                        key={layer.id}
                        type="button"
                        onClick={() => onTerrainBrushChange({ ...terrainBrush, paintLayer: layer.id })}
                        className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10.5px] font-medium transition-colors ${
                          terrainBrush.paintLayer === layer.id
                            ? 'border-[#2D5A4C] bg-[#EBF2EF] text-[#1D4438]'
                            : 'border-[#E2DDD4] bg-white text-[#5A564F]'
                        }`}
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full border border-[#C6C0B6]"
                          style={{ backgroundColor: layer.hex }}
                        />
                        {layer.label}
                      </button>
                    ))}
                  </div>
                  <div>
                    <div className="mb-0.5 flex justify-between text-[10px] text-[#5A564F]">
                      <span>Paint Radius</span>
                      <span className="font-mono">{terrainBrush.radius.toFixed(1)}m</span>
                    </div>
                    <input
                      type="range"
                      min={0.6}
                      max={12}
                      step={0.2}
                      value={terrainBrush.radius}
                      onChange={(e) =>
                        onTerrainBrushChange({ ...terrainBrush, radius: parseFloat(e.target.value) })
                      }
                      className="atelier-range w-full"
                    />
                  </div>
                </div>
              )}

              {activeToolMode === 'scatter-brush' && (
                <div className="space-y-2 rounded-lg border border-[#EAE5DC] bg-[#FAF9F6] p-2.5">
                  <div className="grid grid-cols-5 gap-1">
                    {SCATTER_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onScatterBrushChange({ ...scatterBrush, preset: p.id })}
                        className={`rounded-md border py-1 text-[10px] font-medium transition-colors ${
                          scatterBrush.preset === p.id
                            ? 'border-[#2D5A4C] bg-[#EBF2EF] text-[#1D4438]'
                            : 'border-[#E2DDD4] bg-white text-[#5A564F]'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="mb-0.5 flex justify-between text-[10px] text-[#5A564F]">
                        <span>Brush Radius</span>
                        <span className="font-mono">{scatterBrush.radius.toFixed(1)}m</span>
                      </div>
                      <input
                        type="range"
                        min={0.5}
                        max={8}
                        step={0.25}
                        value={scatterBrush.radius}
                        onChange={(e) =>
                          onScatterBrushChange({ ...scatterBrush, radius: parseFloat(e.target.value) })
                        }
                        className="atelier-range w-full"
                      />
                    </div>
                    <div>
                      <div className="mb-0.5 flex justify-between text-[10px] text-[#5A564F]">
                        <span>Density</span>
                        <span className="font-mono">{scatterBrush.density}×</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={5}
                        step={1}
                        value={scatterBrush.density}
                        onChange={(e) =>
                          onScatterBrushChange({ ...scatterBrush, density: parseInt(e.target.value, 10) })
                        }
                        className="atelier-range w-full"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-[#6E6960]">
                    Paint directly on terrain or surfaces to scatter foliage & rocks (Ctrl+Z undoes strokes).
                  </p>
                </div>
              )}
            </div>

            {/* Gravity, Physics & Temporary Play Mode */}
            <div className="rounded-xl border border-[#ECE8E1] bg-[#FAF9F6] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-[0.04em] text-[#5A564F] uppercase">
                  Physics, Gravity & Play
                </span>
                <button
                  type="button"
                  onClick={onResetPhysics}
                  className="text-[10.5px] font-medium text-[#2D5A4C] hover:underline"
                >
                  Reset Sim
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[#E5E1DA] bg-white px-2.5 py-1.5 text-[11px]">
                  <span className="text-[#1C1B19]">Gravity</span>
                  <input
                    type="checkbox"
                    checked={physicsConfig.gravityEnabled}
                    onChange={(e) =>
                      onPhysicsConfigChange({ ...physicsConfig, gravityEnabled: e.target.checked })
                    }
                    className="h-3.5 w-3.5 accent-[#2D5A4C]"
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[#E5E1DA] bg-white px-2.5 py-1.5 text-[11px]">
                  <span className="text-[#1C1B19]">Live Sim</span>
                  <input
                    type="checkbox"
                    checked={physicsConfig.liveSimulation}
                    onChange={(e) =>
                      onPhysicsConfigChange({ ...physicsConfig, liveSimulation: e.target.checked })
                    }
                    className="h-3.5 w-3.5 accent-[#2D5A4C]"
                  />
                </label>
              </div>

              <div>
                <div className="mb-0.5 flex justify-between text-[10px] text-[#5A564F]">
                  <span>Gravity Strength</span>
                  <span className="font-mono">-{physicsConfig.gravityStrength.toFixed(1)} m/s²</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={24}
                  step={0.5}
                  value={physicsConfig.gravityStrength}
                  onChange={(e) =>
                    onPhysicsConfigChange({
                      ...physicsConfig,
                      gravityStrength: parseFloat(e.target.value),
                    })
                  }
                  className="atelier-range w-full"
                />
              </div>

              <button
                type="button"
                onClick={onTogglePlayMode}
                className={`flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11.5px] font-medium transition-colors ${
                  playModeActive
                    ? 'bg-[#9E3134] text-white hover:bg-[#822528]'
                    : 'bg-[#2D5A4C] text-white hover:bg-[#22453A]'
                }`}
              >
                <Play className="h-3.5 w-3.5" />
                {playModeActive ? 'Stop Play Mode & Restore Scene' : 'Enter Temporary Play Mode'}
              </button>
            </div>

            {/* World Atmosphere, Sun, Fog & Camera Speed/FOV */}
            <div className="rounded-xl border border-[#ECE8E1] bg-white p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-[0.04em] text-[#5A564F] uppercase">
                  World Sky, Sun & Camera
                </span>
                <label className="flex cursor-pointer items-center gap-1.5 text-[10.5px] text-[#5A564F]">
                  <span>Shadows</span>
                  <input
                    type="checkbox"
                    checked={shadowsEnabled}
                    onChange={onToggleShadows}
                    className="h-3.5 w-3.5 accent-[#2D5A4C]"
                  />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {WORLD_ENV_OPTIONS.map((env) => (
                  <button
                    key={env.id}
                    type="button"
                    onClick={() => onWorldEnvChange(env.id, worldFogDensity)}
                    className={`rounded-lg border py-1.5 text-[11px] font-medium transition-colors ${
                      worldEnvPreset === env.id
                        ? 'border-[#2D5A4C] bg-[#EBF2EF] text-[#1D4438]'
                        : 'border-[#E5E1DA] bg-[#FAF9F6] text-[#5A564F] hover:text-[#1C1B19]'
                    }`}
                  >
                    {env.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="mb-0.5 flex justify-between text-[10.5px]">
                    <span className="text-[#5A564F]">Sun Pitch</span>
                    <span className="font-mono text-[#1C1B19]">{Math.round(sunElevationDeg)}°</span>
                  </div>
                  <input
                    type="range"
                    min={6}
                    max={85}
                    step={1}
                    value={sunElevationDeg}
                    onChange={(e) => onSunElevationChange(parseInt(e.target.value, 10))}
                    className="atelier-range w-full"
                  />
                </div>
                <div>
                  <div className="mb-0.5 flex justify-between text-[10.5px]">
                    <span className="text-[#5A564F]">Distance Fog</span>
                    <span className="font-mono text-[#1C1B19]">{(worldFogDensity * 1000).toFixed(0)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={0.09}
                    step={0.002}
                    value={worldFogDensity}
                    onChange={(e) => onWorldEnvChange(worldEnvPreset, parseFloat(e.target.value))}
                    className="atelier-range w-full"
                  />
                </div>
                <div>
                  <div className="mb-0.5 flex justify-between text-[10.5px]">
                    <span className="text-[#5A564F]">Height Fog</span>
                    <span className="font-mono text-[#1C1B19]">{worldFogHeight.toFixed(0)}m</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={60}
                    step={2}
                    value={worldFogHeight}
                    onChange={(e) => onWorldFogHeightChange(parseFloat(e.target.value))}
                    className="atelier-range w-full"
                  />
                </div>
                <div>
                  <div className="mb-0.5 flex justify-between text-[10.5px]">
                    <span className="text-[#5A564F]">Camera FOV</span>
                    <span className="font-mono text-[#1C1B19]">{Math.round(cameraFov)}°</span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={95}
                    step={1}
                    value={cameraFov}
                    onChange={(e) => onCameraFovChange(parseInt(e.target.value, 10))}
                    className="atelier-range w-full"
                  />
                </div>
              </div>
              <div>
                <div className="mb-0.5 flex justify-between text-[10.5px]">
                  <span className="text-[#5A564F]">Camera Navigation Speed</span>
                  <span className="font-mono text-[#1C1B19]">{cameraSpeed.toFixed(1)}×</span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={3.0}
                  step={0.1}
                  value={cameraSpeed}
                  onChange={(e) => onCameraSpeedChange(parseFloat(e.target.value))}
                  className="atelier-range w-full"
                />
              </div>
            </div>
          </div>
        )}

        {/* SHADER & MATERIAL TAB */}
        {activeTab === 'material' && (
          <div className="space-y-4">
            <MaterialPreviewSphere params={surfaceParams} />

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

            <div className="space-y-3 rounded-xl border border-[#ECE8E1] bg-[#FAF9F6] p-3.5">
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

            <div className="space-y-3 rounded-xl border border-[#ECE8E1] bg-white p-3.5">
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

            <div className="rounded-xl border border-[#ECE8E1] bg-[#FAF9F6] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold tracking-[0.04em] text-[#5A564F] uppercase">
                  PBR Material Slots ({materials.length})
                </span>
                <button
                  type="button"
                  onClick={onSaveTexturesToRepo}
                  className="inline-flex items-center gap-1 rounded-md border border-[#CFE2DA] bg-[#F2F8F5] px-2 py-0.5 text-[10.5px] font-medium text-[#1D4438] hover:bg-[#E4F0EB]"
                >
                  <CloudUpload className="h-3 w-3" />
                  Save Textures
                </button>
              </div>
              <div className="space-y-2">
                {materials.length === 0 ? (
                  <p className="text-[11.5px] text-[#847E75]">No mesh materials on stage.</p>
                ) : (
                  materials.map((mat) => {
                    const activeMaps = Object.entries(mat.maps)
                      .filter(([, present]) => present)
                      .map(([k]) => k);
                    const isEditing = editingMaterialUuid === mat.uuid;
                    return (
                      <div
                        key={mat.uuid}
                        className={`rounded-lg border px-3 py-2 transition-colors ${
                          isEditing
                            ? 'border-[#2D5A4C] bg-white'
                            : 'border-[#EAE5DC] bg-white hover:border-[#CFC9BE]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setEditingMaterialUuid(isEditing ? null : mat.uuid)}
                          className="flex w-full items-center justify-between gap-2 text-left"
                        >
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
                        </button>
                        <div className="mt-1 text-[10.5px] text-[#847E75]">
                          {activeMaps.length > 0
                            ? `Maps: ${activeMaps.join(', ')}`
                            : 'Procedural BSDF · Click to edit'}
                        </div>

                        {isEditing && (
                          <div className="mt-2.5 space-y-2 border-t border-[#EFECE6] pt-2.5">
                            <div className="grid grid-cols-2 gap-2">
                              <label className="flex items-center justify-between text-[10.5px] text-[#5A564F]">
                                <span>Albedo</span>
                                <input
                                  type="color"
                                  value={mat.colorHex}
                                  onChange={(e) =>
                                    onEditMaterial({
                                      materialUuid: mat.uuid,
                                      colorHex: e.target.value,
                                      metalness: mat.metalness,
                                      roughness: mat.roughness,
                                      emissiveHex: mat.emissiveHex || '#000000',
                                      emissiveIntensity: mat.emissiveIntensity || 0,
                                      bumpScale: mat.bumpScale || 0,
                                    })
                                  }
                                  className="h-5 w-7 cursor-pointer rounded border border-[#D8D3CA]"
                                />
                              </label>
                              <label className="flex items-center justify-between text-[10.5px] text-[#5A564F]">
                                <span>Emissive</span>
                                <input
                                  type="color"
                                  value={mat.emissiveHex || '#000000'}
                                  onChange={(e) =>
                                    onEditMaterial({
                                      materialUuid: mat.uuid,
                                      colorHex: mat.colorHex,
                                      metalness: mat.metalness,
                                      roughness: mat.roughness,
                                      emissiveHex: e.target.value,
                                      emissiveIntensity: Math.max(0.4, mat.emissiveIntensity || 0),
                                      bumpScale: mat.bumpScale || 0,
                                    })
                                  }
                                  className="h-5 w-7 cursor-pointer rounded border border-[#D8D3CA]"
                                />
                              </label>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <div className="flex justify-between text-[10px] text-[#5A564F]">
                                  <span>Metallic</span>
                                  <span className="font-mono">{mat.metalness.toFixed(2)}</span>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={1}
                                  step={0.02}
                                  value={mat.metalness}
                                  onChange={(e) =>
                                    onEditMaterial({
                                      materialUuid: mat.uuid,
                                      colorHex: mat.colorHex,
                                      metalness: parseFloat(e.target.value),
                                      roughness: mat.roughness,
                                      emissiveHex: mat.emissiveHex || '#000000',
                                      emissiveIntensity: mat.emissiveIntensity || 0,
                                      bumpScale: mat.bumpScale || 0,
                                    })
                                  }
                                  className="atelier-range w-full"
                                />
                              </div>
                              <div>
                                <div className="flex justify-between text-[10px] text-[#5A564F]">
                                  <span>Roughness</span>
                                  <span className="font-mono">{mat.roughness.toFixed(2)}</span>
                                </div>
                                <input
                                  type="range"
                                  min={0.04}
                                  max={1}
                                  step={0.02}
                                  value={mat.roughness}
                                  onChange={(e) =>
                                    onEditMaterial({
                                      materialUuid: mat.uuid,
                                      colorHex: mat.colorHex,
                                      metalness: mat.metalness,
                                      roughness: parseFloat(e.target.value),
                                      emissiveHex: mat.emissiveHex || '#000000',
                                      emissiveIntensity: mat.emissiveIntensity || 0,
                                      bumpScale: mat.bumpScale || 0,
                                    })
                                  }
                                  className="atelier-range w-full"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <div className="flex justify-between text-[10px] text-[#5A564F]">
                                  <span>Glow</span>
                                  <span className="font-mono">
                                    {(mat.emissiveIntensity || 0).toFixed(2)}
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={2.5}
                                  step={0.05}
                                  value={mat.emissiveIntensity || 0}
                                  onChange={(e) =>
                                    onEditMaterial({
                                      materialUuid: mat.uuid,
                                      colorHex: mat.colorHex,
                                      metalness: mat.metalness,
                                      roughness: mat.roughness,
                                      emissiveHex: mat.emissiveHex || '#000000',
                                      emissiveIntensity: parseFloat(e.target.value),
                                      bumpScale: mat.bumpScale || 0,
                                    })
                                  }
                                  className="atelier-range w-full"
                                />
                              </div>
                              <div>
                                <div className="flex justify-between text-[10px] text-[#5A564F]">
                                  <span>Bump</span>
                                  <span className="font-mono">{(mat.bumpScale || 0).toFixed(2)}</span>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={0.2}
                                  step={0.01}
                                  value={mat.bumpScale || 0}
                                  onChange={(e) =>
                                    onEditMaterial({
                                      materialUuid: mat.uuid,
                                      colorHex: mat.colorHex,
                                      metalness: mat.metalness,
                                      roughness: mat.roughness,
                                      emissiveHex: mat.emissiveHex || '#000000',
                                      emissiveIntensity: mat.emissiveIntensity || 0,
                                      bumpScale: parseFloat(e.target.value),
                                    })
                                  }
                                  className="atelier-range w-full"
                                />
                              </div>
                            </div>

                            <div>
                              <div className="mb-1 text-[10px] text-[#6E6960]">Procedural PBR Map</div>
                              <div className="grid grid-cols-5 gap-1">
                                {(
                                  [
                                    { id: 'stone', label: 'Stone' },
                                    { id: 'wood', label: 'Wood' },
                                    { id: 'runic-bronze', label: 'Bronze' },
                                    { id: 'moss-grass', label: 'Moss' },
                                    { id: 'none', label: 'Clear' },
                                  ] as const
                                ).map((p) => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() =>
                                      onEditMaterial({
                                        materialUuid: mat.uuid,
                                        colorHex: mat.colorHex,
                                        metalness: mat.metalness,
                                        roughness: mat.roughness,
                                        emissiveHex: mat.emissiveHex || '#000000',
                                        emissiveIntensity: mat.emissiveIntensity || 0,
                                        bumpScale: mat.bumpScale || 0.04,
                                        proceduralPattern: p.id,
                                      })
                                    }
                                    className="rounded border border-[#E2DDD4] bg-[#FAF9F6] py-0.5 text-[10px] font-medium text-[#1C1B19] hover:border-[#2D5A4C] hover:bg-[#EBF2EF]"
                                  >
                                    {p.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
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

            <div className="space-y-3 rounded-xl border border-[#ECE8E1] bg-white p-3.5">
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

            <div className="space-y-3 rounded-xl border border-[#ECE8E1] bg-[#FAF9F6] p-3.5">
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
                  <span>Load a rigged model to articulate skeletal joints.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {bones.slice(0, 12).map((bone) => (
                    <div
                      key={bone.uuid}
                      className="space-y-2 rounded-lg border border-[#EAE5DC] bg-white p-2.5"
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
