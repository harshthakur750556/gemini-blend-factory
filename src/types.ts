export type ExecutionMode = 'cloud' | 'local';

export type CiHealthState = 'idle' | 'building' | 'success' | 'failed' | 'unconfigured' | 'error';

export type ShadingPass =
  | 'combined'
  | 'wireframe'
  | 'albedo'
  | 'normal'
  | 'roughness'
  | 'matcap'
  | 'xray'
  | 'uv'
  | 'points';

export type InsideOutSide = 'front' | 'back' | 'double';

export type DragMouseMode = 'orbit' | 'pan' | 'zoom';

export type ViewportToolMode =
  | 'orbit'
  | 'select'
  | 'measure'
  | 'terrain-sculpt'
  | 'terrain-paint'
  | 'scatter-brush';

export type GizmoMode = 'none' | 'translate' | 'rotate' | 'scale';

export type GizmoSpace = 'world' | 'local';

export type StudioLightingPreset = 'studio-4k' | 'architectural' | 'high-contrast' | 'soft-clay';

export type WorldEnvironmentPreset = 'alabaster' | 'courtyard' | 'meadow' | 'desert' | 'celestial';

export type TerrainBrushMode = 'raise' | 'lower' | 'smooth' | 'flatten' | 'noise';

export type TerrainPaintLayer = 'grass' | 'moss' | 'basalt' | 'sand' | 'snow' | 'cave_dirt';

export interface TerrainBrushConfig {
  mode: TerrainBrushMode;
  paintLayer: TerrainPaintLayer;
  radius: number;
  strength: number;
  flattenTargetY: number;
}

export type ScatterBrushPreset = 'pine-tree' | 'boulder' | 'crystal' | 'grass-tuft' | 'pillar' | 'selected';

export interface ScatterBrushConfig {
  preset: ScatterBrushPreset;
  radius: number;
  density: number;
  minScale: number;
  maxScale: number;
  alignToNormal: boolean;
}

export interface ViewportOverlayFlags {
  showGrid: boolean;
  showAxes: boolean;
  showBounds: boolean;
  showColliders: boolean;
}

export interface PhysicsConfig {
  gravityEnabled: boolean;
  gravityStrength: number;
  liveSimulation: boolean;
}

export interface PlayModeStatus {
  active: boolean;
  cameraMode: 'third-person' | 'first-person';
  playerX: number;
  playerY: number;
  playerZ: number;
  grounded: boolean;
  sprinting: boolean;
  flying?: boolean;
  avatarSource?: 'glb' | 'procedural';
}

export interface HistoryStateSummary {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  undoCount: number;
  redoCount: number;
}

export interface ViewportTelemetryHudState {
  fps: number;
  objectCount: number;
  triangleCount: number;
  vertexCount: number;
  selectedName: string | null;
  selectedDimensions: [number, number, number];
  cursorPosition: [number, number, number];
}

export interface MaterialEditPayload {
  materialUuid?: string;
  colorHex: string;
  metalness: number;
  roughness: number;
  emissiveHex: string;
  emissiveIntensity: number;
  bumpScale: number;
  proceduralPattern?: 'none' | 'stone' | 'wood' | 'runic-bronze' | 'moss-grass';
}

export type WorldPrimitiveKind =
  | 'cube'
  | 'sphere'
  | 'cylinder'
  | 'cone'
  | 'torus'
  | 'plane'
  | 'arch'
  | 'stairs'
  | 'terrain'
  | 'water'
  | 'point-light'
  | 'sun-light'
  | 'spot-light'
  | 'area-light'
  | 'scene-camera'
  | 'collider';

export type SceneLightKind = 'point' | 'sun' | 'spot' | 'area';

export interface SelectedLightInfo {
  uuid: string;
  name: string;
  lightKind: SceneLightKind;
  color: string;
  intensity: number;
  distance: number;
  decay: number;
  angleDeg: number;
  penumbra: number;
  width: number;
  height: number;
  castShadow: boolean;
}

export interface SelectedCameraInfo {
  uuid: string;
  name: string;
  focalLengthMm: number;
  fov: number;
  near: number;
  far: number;
  isActiveCamera: boolean;
  lookingThrough: boolean;
}

export type WorkspaceModeId = 'inspect' | 'world' | 'lookdev' | 'pipeline';

export type InspectorTabId = 'outliner' | 'world' | 'material' | 'diagnostics' | 'rig';

export type WorkbenchTabId = 'harness' | 'vision' | 'script' | 'workspace';

export type ModelGroupName =
  | 'Female_Characters'
  | 'Male_Characters'
  | 'Characters'
  | 'Sample'
  | 'Architecture'
  | 'Props'
  | 'Environment'
  | 'World_Assemblies'
  | 'Cloud_CI';

export interface SectionCutConfig {
  enabled: boolean;
  axis: 'x' | 'y' | 'z';
  position: number;
  invert: boolean;
}

export interface SurfaceParams {
  overrideEnabled: boolean;
  baseColor: string;
  metallic: number;
  roughness: number;
  normalStrength: number;
  emission: number;
}

export interface TransformInfo {
  uuid: string | null;
  name: string;
  posX: number;
  posY: number;
  posZ: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
}

export interface TopologyDiagnostics {
  grade: 'A+' | 'A' | 'B' | 'EMPTY';
  quadPercent: number;
  triPercent: number;
  ngons: number;
  nonManifoldEdges: number;
  overlappingUvPercent: number;
  uvMarginPx: number;
  drawCalls: number;
  estimatedVramMb: number;
  manifold: boolean;
}

export interface CapturedScreenshot {
  id: string;
  angle: 'hero' | 'front' | 'side' | 'top' | 'camera' | 'viewport' | 'cycles' | 'custom';
  label: string;
  dataUrl: string;
  createdAt: string;
  githubPath?: string;
  isLatest?: boolean;
  source: 'viewport' | 'cycles' | 'github';
}

export interface ModelBundleAssetFile {
  name: string;
  path: string;
  url: string;
  sizeBytes?: number;
  kind: 'model' | 'texture' | 'screenshot' | 'script' | 'manifest';
}

export interface AvailableModelItem {
  id: string;
  slug: string;
  name: string;
  source: 'github-release' | 'github-repo' | 'google-drive' | 'local-file' | 'specimen';
  format:
    | '.glb'
    | '.gltf'
    | '.obj'
    | '.stl'
    | '.ply'
    | '.fbx'
    | '.dae'
    | '.usdz'
    | '.usda'
    | '.step'
    | '.dxf'
    | '.3mf'
    | '.off'
    | '.blend'
    | 'procedural';
  group: ModelGroupName;
  sizeBytes?: number;
  url?: string;
  previewUrl?: string;
  driveFileId?: string;
  specimenKind?: 'stone-lantern';
  htmlUrl?: string;
  repoFolderPath?: string;
  buildPyPath?: string;
  textures?: ModelBundleAssetFile[];
  screenshots?: ModelBundleAssetFile[];
  viewable: boolean;
  updatedAt?: string;
  description?: string;
}

export interface OutlinerNode {
  uuid: string;
  parentUuid?: string | null;
  name: string;
  type: 'Mesh' | 'SkinnedMesh' | 'Bone' | 'Group' | 'Light' | 'Camera';
  lightKind?: SceneLightKind;
  isActiveCamera?: boolean;
  depth: number;
  visible: boolean;
  locked: boolean;
  vertices: number;
  triangles: number;
}

export interface BoneControlInfo {
  uuid: string;
  name: string;
  rotX: number;
  rotY: number;
  rotZ: number;
}

export interface MaterialChannelInfo {
  uuid: string;
  name: string;
  type: string;
  colorHex: string;
  emissiveHex?: string;
  emissiveIntensity?: number;
  metalness: number;
  roughness: number;
  bumpScale?: number;
  maps: {
    albedo: boolean;
    normal: boolean;
    roughness: boolean;
    metalness: boolean;
    emissive: boolean;
    ao: boolean;
    bump: boolean;
  };
}

export interface AnimationClipSummary {
  index: number;
  name: string;
  duration: number;
}

export interface CameraTelemetry {
  x: number;
  y: number;
  z: number;
  pitchDeg: number;
  yawDeg: number;
  isOrtho: boolean;
  fov: number;
  activePreset: string;
}

export interface SceneTelemetry {
  modelName: string | null;
  meshCount: number;
  boneCount: number;
  materialCount: number;
  vertexCount: number;
  edgeCount: number;
  triangleCount: number;
  boundsSize: [number, number, number];
  hasAnimations: boolean;
}

export interface ServerConfig {
  geminiConfigured: boolean;
  githubConfigured: boolean;
  githubOwner: string | null;
  githubRepo: string | null;
  githubBranch: string;
  pagesUrl: string | null;
  latestReleaseUrl: string | null;
}

export interface GitHubCiStatus {
  configured: boolean;
  state: CiHealthState;
  message?: string;
  owner?: string;
  repo?: string;
  branch?: string;
  pagesUrl?: string | null;
  latestReleaseUrl?: string | null;
  latestRun?: {
    id: number;
    status: string;
    conclusion: string | null;
    headSha: string;
    htmlUrl: string;
    createdAt: string;
    updatedAt: string;
    displayTitle?: string;
  } | null;
  assets?: Array<{
    name: string;
    size: number;
    updatedAt: string;
  }>;
}

export interface WorkspaceFileEntry {
  path: string;
  name: string;
  size: number;
  source: 'github' | 'local' | 'starter';
  sha?: string;
  content?: string;
}

export interface VisionDefect {
  severity: 'high' | 'medium' | 'low';
  area: string;
  finding: string;
  fix: string;
}

export interface VisionCritiqueResult {
  summary: string;
  recommendPass2: boolean;
  commitNote: string;
  defects: VisionDefect[];
  refinedScript: string;
}

export interface HarnessActivityItem {
  id: string;
  timestamp: string;
  stage: 'sync' | 'build' | 'screenshot' | 'vision' | 'reform';
  title: string;
  detail: string;
  modelSlug?: string;
  commitSha?: string;
  status: 'completed' | 'running' | 'error';
}
