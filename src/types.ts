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
  | 'explode'
  | 'light'
  | 'slice';

export type StudioLightingPreset = 'studio-4k' | 'architectural' | 'high-contrast' | 'soft-clay';

export type WorkspaceModeId = 'inspect' | 'topology' | 'lookdev' | 'pipeline';

export type InspectorTabId = 'outliner' | 'material' | 'diagnostics' | 'rig';

export type WorkbenchTabId = 'agent' | 'vision' | 'script' | 'workspace';

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

export interface AvailableModelItem {
  id: string;
  name: string;
  source: 'github-release' | 'github-repo' | 'google-drive' | 'local-file' | 'specimen';
  format: '.glb' | '.gltf' | '.obj' | '.stl' | '.blend' | 'procedural';
  category?: 'Sample' | 'Cloud_CI' | 'Local_Workstation';
  sizeBytes?: number;
  url?: string;
  driveFileId?: string;
  specimenKind?: 'stone-lantern';
  htmlUrl?: string;
  viewable: boolean;
  updatedAt?: string;
  description?: string;
}

export interface OutlinerNode {
  uuid: string;
  name: string;
  type: 'Mesh' | 'SkinnedMesh' | 'Bone' | 'Group';
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
  source: 'local' | 'starter';
  content?: string;
}

export interface PendingDiffProposal {
  id: string;
  path: string;
  beforeContent: string;
  afterContent: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  createdAt: string;
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

export interface ToolTrace {
  id: string;
  name: string;
  argsPreview: string;
  status: 'running' | 'completed' | 'awaiting_approval' | 'error';
  summary: string;
}

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  toolTraces?: ToolTrace[];
  diffProposalId?: string;
  visionCritique?: VisionCritiqueResult;
  buildProgress?: {
    mode: ExecutionMode;
    stage: 'committing' | 'queued' | 'in_progress' | 'fetching_preview' | 'vision_audit' | 'completed' | 'failed';
    commitSha?: string;
    runUrl?: string;
    detail: string;
  };
  error?: string;
}

export interface GeminiContentPart {
  text?: string;
  functionCall?: {
    id?: string;
    name: string;
    args?: Record<string, unknown>;
  };
  functionResponse?: {
    id?: string;
    name: string;
    response: Record<string, unknown>;
  };
  thoughtSignature?: string;
  [key: string]: unknown;
}

export interface GeminiContentTurn {
  role: 'user' | 'model';
  parts: GeminiContentPart[];
}
