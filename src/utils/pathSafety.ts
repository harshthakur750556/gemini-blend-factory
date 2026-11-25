export type AllowedReleaseAsset = 'model.glb' | 'preview.png' | 'model.blend';

const ALLOWED_RELEASE_ASSETS = new Set<string>(['model.glb', 'preview.png', 'model.blend']);
const GITHUB_SLUG_RE = /^[A-Za-z0-9_.-]{1,100}$/;
const MODEL_SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const SCREENSHOT_NAME_RE = /^[A-Za-z0-9._-]{1,80}\.(png|jpg|jpeg|webp)$/i;
const TEXTURE_NAME_RE = /^[A-Za-z0-9._-]{1,80}\.(png|jpg|jpeg|webp|ktx2|hdr|exr)$/i;

/**
 * Normalizes a relative path inside the linked local or GitHub workspace and rejects any
 * traversal attempt, absolute path, null byte, or Windows drive/backslash prefix.
 */
export function normalizeWorkspacePath(inputPath: string): string {
  if (typeof inputPath !== 'string') {
    throw new Error('Path must be a string.');
  }
  const trimmed = inputPath.trim();
  if (!trimmed) {
    throw new Error('Path cannot be empty.');
  }
  if (trimmed.includes('\0')) {
    throw new Error('Path contains invalid null byte.');
  }
  if (trimmed.includes('\\')) {
    throw new Error('Backslashes are not allowed in workspace paths; use forward slashes.');
  }
  if (trimmed.startsWith('/') || /^[A-Za-z]:/.test(trimmed)) {
    throw new Error('Absolute paths are not allowed; use a path relative to the workspace root.');
  }

  const rawSegments = trimmed.split('/');
  const cleanSegments: string[] = [];
  for (const seg of rawSegments) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      throw new Error('Directory traversal ("..") is not permitted outside the linked folder.');
    }
    cleanSegments.push(seg);
  }

  if (cleanSegments.length === 0) {
    throw new Error('Path resolves to workspace root rather than a file.');
  }
  return cleanSegments.join('/');
}

/**
 * Sanitizes any human model title or filename into a safe lowercase subfolder slug
 * used under GitHub `models/<slug>/`.
 */
export function sanitizeModelSlug(rawName: string): string {
  const stem = String(rawName || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[_-]+|[_-]+$/g, '')
    .slice(0, 64);
  return stem || 'untitled-model';
}

export function validateModelSlug(slug: string): boolean {
  return typeof slug === 'string' && MODEL_SLUG_RE.test(slug);
}

export function validateScreenshotFilename(fileName: string): boolean {
  return (
    typeof fileName === 'string' &&
    !fileName.includes('/') &&
    !fileName.includes('\\') &&
    !fileName.includes('..') &&
    SCREENSHOT_NAME_RE.test(fileName)
  );
}

export function validateTextureFilename(fileName: string): boolean {
  return (
    typeof fileName === 'string' &&
    !fileName.includes('/') &&
    !fileName.includes('\\') &&
    !fileName.includes('..') &&
    TEXTURE_NAME_RE.test(fileName)
  );
}

export function buildModelSubfolderPaths(rawSlug: string): {
  slug: string;
  folder: string;
  modelGlb: string;
  manifest: string;
  buildPy: string;
  texturesDir: string;
  screenshotsDir: string;
} {
  const slug = sanitizeModelSlug(rawSlug);
  const folder = `models/${slug}`;
  return {
    slug,
    folder,
    modelGlb: `${folder}/${slug}.glb`,
    manifest: `${folder}/manifest.json`,
    buildPy: `${folder}/build.py`,
    texturesDir: `${folder}/textures`,
    screenshotsDir: `${folder}/screenshots`,
  };
}

/**
 * Validates the configurable Local Blender Backup endpoint.
 * Restricts strictly to http://127.0.0.1:<port>/... or http://localhost:<port>/...
 * on non-privileged user ports (1024-65535) to prevent non-local or unsafe URLs.
 */
export function validateLocalBlenderEndpoint(rawUrl: string): {
  valid: boolean;
  normalized?: string;
  reason?: string;
} {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return { valid: false, reason: 'Local endpoint URL is required.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { valid: false, reason: 'Invalid URL format. Expected http://127.0.0.1:8787/blender' };
  }

  if (parsed.protocol !== 'http:') {
    return { valid: false, reason: 'Local Blender endpoint must use http:// protocol.' };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== '127.0.0.1' && hostname !== 'localhost') {
    return {
      valid: false,
      reason: 'Local Blender endpoint must target 127.0.0.1 or localhost only.',
    };
  }

  const portNum = Number(parsed.port);
  if (!parsed.port || !Number.isInteger(portNum) || portNum < 1024 || portNum > 65535) {
    return {
      valid: false,
      reason: 'Local Blender endpoint must specify a valid port between 1024 and 65535.',
    };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, reason: 'Credentials in endpoint URL are not permitted.' };
  }

  return {
    valid: true,
    normalized: `${parsed.protocol}//${hostname}:${portNum}${parsed.pathname}`,
  };
}

export function validateGithubSlug(value: string): boolean {
  return typeof value === 'string' && GITHUB_SLUG_RE.test(value) && value !== '.' && value !== '..';
}

export function validateReleaseAsset(asset: string): asset is AllowedReleaseAsset {
  return ALLOWED_RELEASE_ASSETS.has(asset);
}

export function buildGitHubPagesUrl(owner: string | null, repo: string | null): string | null {
  if (!owner || !repo || !validateGithubSlug(owner) || !validateGithubSlug(repo)) {
    return null;
  }
  return `https://${owner.toLowerCase()}.github.io/${repo}/`;
}

export function buildGitHubReleaseUrl(owner: string | null, repo: string | null): string | null {
  if (!owner || !repo || !validateGithubSlug(owner) || !validateGithubSlug(repo)) {
    return null;
  }
  return `https://github.com/${owner}/${repo}/releases/tag/latest`;
}

/**
 * Resolves a validated GitHub Pages static release artifact path relative to
 * the current site base path (e.g. "/repo/" -> "./model.glb"), rejecting any
 * non-whitelisted filenames.
 */
export function resolveStaticPagesAssetUrl(asset: string): string | null {
  if (!validateReleaseAsset(asset)) return null;
  return `./${asset}`;
}
