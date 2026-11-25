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

export type ViewportToolMode = 'orbit' | 'select' | 'measure';

export type GizmoMode = 'none' | 'translate' | 'rotate' | 'scale';

export type GizmoSpace = 'world' | 'local';

export type StudioLightingPreset = 'studio-4k' | 'architectural' | 'high-contrast' | 'soft-clay';

export type WorldEnvironmentPreset = 'alabaster' | 'courtyard' | 'meadow' | 'desert';

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
  | 'collider';

export type WorkspaceModeId = 'inspect' | 'world' | 'lookdev' | 'pipeline';

export type InspectorTabId = 'outliner' | 'world' | 'material' | 'diagnostics' | 'rig';

export type WorkbenchTabId = 'harness' | 'vision' | 'script' | 'workspace';

export type ModelGroupName =
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
  angle: 'hero' | 'front' | 'side' | 'top' | 'cycles' | 'custom';
  label: string;
  dataUrl: string;
  createdAt: string;
  githubPath?: string;
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
  name: string;
  type: 'Mesh' | 'SkinnedMesh' | 'Bone' | 'Group' | 'Light';
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
  metalness: number;
  roughness: number;
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
