import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import {
  buildGitHubPagesUrl,
  buildGitHubReleaseUrl,
  buildLatestScreenshotFilename,
  buildLatestScreenshotsManifest,
  buildModelSubfolderPaths,
  isLatestScreenshotFilename,
  normalizeWorkspacePath,
  sanitizeModelSlug,
  validateGithubSlug,
  validateModelSlug,
  validateReleaseAsset,
  validateScreenshotFilename,
  validateTextureFilename,
  type LatestScreenshotsManifestBlock,
} from './src/utils/pathSafety.ts';
import {
  MAX_MODEL_UPLOAD_BYTES,
  VIEWABLE_3D_EXTENSIONS,
  validateModelUpload,
} from './src/utils/modelUploadValidation.ts';

const PORT = Number(process.env.PORT || 3000);
const MODEL_ID = 'gemini-4-hydrogen';
const WORKSPACE_ROOT = path.resolve(process.cwd());
const MAX_SCREENSHOT_BYTES = 6 * 1024 * 1024; // 6 MB per screenshot

const app = express();
app.use(express.json({ limit: '28mb' }));

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface GitHubEnv {
  configured: boolean;
  token: string;
  owner: string;
  repo: string;
  branch: string;
  pagesUrl: string | null;
  latestReleaseUrl: string | null;
}

function getGitHubEnv(): GitHubEnv {
  const token = process.env.GITHUB_TOKEN?.trim() || '';
  const owner = process.env.GITHUB_OWNER?.trim() || '';
  const repo = process.env.GITHUB_REPO?.trim() || '';
  const branch = process.env.GITHUB_BRANCH?.trim() || 'main';
  const validSlugs = validateGithubSlug(owner) && validateGithubSlug(repo);
  const configured = Boolean(token && validSlugs);

  return {
    configured,
    token,
    owner: validSlugs ? owner : '',
    repo: validSlugs ? repo : '',
    branch: validateGithubSlug(branch) ? branch : 'main',
    pagesUrl: validSlugs ? buildGitHubPagesUrl(owner, repo) : null,
    latestReleaseUrl: validSlugs ? buildGitHubReleaseUrl(owner, repo) : null,
  };
}

function githubHeaders(token: string, accept = 'application/vnd.github+json'): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: accept,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'BlendFactory-Studio',
  };
}

function decodeStrictBase64(raw: string, maxBytes: number): Buffer {
  const cleaned = raw.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
  if (!cleaned || !/^[A-Za-z0-9+/=]+$/.test(cleaned)) {
    throw new Error('Invalid base64 payload.');
  }
  const buf = Buffer.from(cleaned, 'base64');
  if (buf.length === 0 || buf.length > maxBytes) {
    throw new Error(`Decoded binary size is empty or exceeds ${Math.round(maxBytes / (1024 * 1024))}MB.`);
  }
  return buf;
}

/**
 * Commits or updates a single file in GitHub via the Contents API.
 */
async function commitGithubFile(
  gh: GitHubEnv,
  repoPath: string,
  contentBase64: string,
  commitMessage: string
): Promise<{ sha: string; htmlUrl: string | null; path: string }> {
  const safePath = normalizeWorkspacePath(repoPath);
  const encodedPath = safePath
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  const endpoint = `https://api.github.com/repos/${gh.owner}/${gh.repo}/contents/${encodedPath}`;

  let existingSha: string | undefined;
  const getRes = await fetch(`${endpoint}?ref=${encodeURIComponent(gh.branch)}`, {
    headers: githubHeaders(gh.token),
  });
  if (getRes.ok) {
    const existing = (await getRes.json()) as { sha?: string };
    existingSha = existing.sha;
  }

  const putRes = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      ...githubHeaders(gh.token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: commitMessage.slice(0, 140),
      content: contentBase64,
      branch: gh.branch,
      ...(existingSha ? { sha: existingSha } : {}),
    }),
  });

  if (!putRes.ok) {
    const errText = await putRes.text();
    throw new Error(`GitHub write failed for ${safePath} (${putRes.status}): ${errText.slice(0, 200)}`);
  }

  const putJson = (await putRes.json()) as {
    content?: { path?: string; html_url?: string };
    commit?: { sha?: string; html_url?: string };
  };
  return {
    sha: putJson.commit?.sha || '',
    htmlUrl: putJson.content?.html_url || putJson.commit?.html_url || null,
    path: putJson.content?.path || safePath,
  };
}

function guessMimeFromPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.glb')) return 'model/gltf-binary';
  if (lower.endsWith('.gltf')) return 'model/gltf+json';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.json')) return 'application/json;charset=utf-8';
  if (lower.endsWith('.dae') || lower.endsWith('.3mf')) return 'application/xml;charset=utf-8';
  if (
    lower.endsWith('.obj') ||
    lower.endsWith('.py') ||
    lower.endsWith('.fbx') ||
    lower.endsWith('.usda') ||
    lower.endsWith('.step') ||
    lower.endsWith('.stp') ||
    lower.endsWith('.dxf') ||
    lower.endsWith('.off')
  ) {
    return 'text/plain;charset=utf-8';
  }
  return 'application/octet-stream';
}

// 1. Safe server configuration summary (no secrets ever returned)
app.get('/api/config', (_req: Request, res: Response) => {
  const gh = getGitHubEnv();
  res.json({
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    githubConfigured: gh.configured,
    githubOwner: gh.owner || null,
    githubRepo: gh.repo || null,
    githubBranch: gh.branch,
    pagesUrl: gh.pagesUrl,
    latestReleaseUrl: gh.latestReleaseUrl,
  });
});

// 2. Starter repository files fallback (when GitHub secrets are not yet set)
const STARTER_REPO_PATHS = [
  'AGENTS.md',
  'AGENT.md',
  'scripts/build.py',
  'scripts/export_and_render.py',
  '.github/workflows/build-blend.yml',
  'preview/index.html',
  '.env.example',
] as const;

app.get('/api/workspace/starter', async (_req: Request, res: Response) => {
  try {
    const files: Array<{ path: string; content: string; size: number }> = [];
    for (const rel of STARTER_REPO_PATHS) {
      const resolved = path.resolve(WORKSPACE_ROOT, rel);
      if (!resolved.startsWith(WORKSPACE_ROOT + path.sep)) continue;
      try {
        const content = await fs.readFile(resolved, 'utf8');
        files.push({ path: rel, content, size: Buffer.byteLength(content, 'utf8') });
      } catch {
        // Skip missing files
      }
    }
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load starter files.' });
  }
});

// 3. Full GitHub Workspace Sync: Recursive repository file tree
app.get('/api/github/tree', async (_req: Request, res: Response) => {
  const gh = getGitHubEnv();
  if (!gh.configured) {
    res.json({ configured: false, files: [] });
    return;
  }

  try {
    const treeUrl = `https://api.github.com/repos/${gh.owner}/${gh.repo}/git/trees/${encodeURIComponent(gh.branch)}?recursive=1`;
    const treeRes = await fetch(treeUrl, { headers: githubHeaders(gh.token) });
    if (!treeRes.ok) {
      res.status(treeRes.status).json({
        configured: true,
        files: [],
        error: `Failed to fetch GitHub tree (${treeRes.status}).`,
      });
      return;
    }

    const treeJson = (await treeRes.json()) as {
      tree?: Array<{ path?: string; type?: string; size?: number; sha?: string }>;
    };

    const files: Array<{
      path: string;
      name: string;
      size: number;
      sha: string;
      source: 'github' | 'starter';
    }> = (treeJson.tree || [])
      .filter((item) => item.type === 'blob' && typeof item.path === 'string')
      .filter((item) => !item.path!.startsWith('node_modules/') && !item.path!.startsWith('dist/'))
      .slice(0, 400)
      .map((item) => ({
        path: item.path!,
        name: item.path!.split('/').pop() || item.path!,
        size: item.size || 0,
        sha: item.sha || '',
        source: 'github' as const,
      }));

    const existingPaths = new Set(files.map((f) => f.path));
    for (const rel of STARTER_REPO_PATHS) {
      if (existingPaths.has(rel)) continue;
      const resolved = path.resolve(WORKSPACE_ROOT, rel);
      if (!resolved.startsWith(WORKSPACE_ROOT + path.sep)) continue;
      try {
        const stat = await fs.stat(resolved);
        files.unshift({
          path: rel,
          name: rel.split('/').pop() || rel,
          size: stat.size,
          sha: '',
          source: 'starter',
        });
      } catch {
        // Ignore if not present locally
      }
    }

    res.json({
      configured: true,
      owner: gh.owner,
      repo: gh.repo,
      branch: gh.branch,
      files,
    });
  } catch (err) {
    res.status(502).json({
      configured: true,
      files: [],
      error: err instanceof Error ? err.message : 'Unable to sync GitHub repository tree.',
    });
  }
});

// 3b. Read any text file from GitHub Workspace (with starter fallback for newly added repo manuals)
app.get('/api/github/file', async (req: Request, res: Response) => {
  const gh = getGitHubEnv();
  if (!gh.configured) {
    res.status(400).json({ error: 'GitHub repository is not configured.' });
    return;
  }

  const rawPath = typeof req.query.path === 'string' ? req.query.path : '';
  let safePath: string;
  try {
    safePath = normalizeWorkspacePath(rawPath);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid path.' });
    return;
  }

  try {
    const encodedPath = safePath.split('/').map(encodeURIComponent).join('/');
    const endpoint = `https://api.github.com/repos/${gh.owner}/${gh.repo}/contents/${encodedPath}?ref=${encodeURIComponent(gh.branch)}`;
    const fileRes = await fetch(endpoint, { headers: githubHeaders(gh.token) });
    if (!fileRes.ok) {
      if ((STARTER_REPO_PATHS as readonly string[]).includes(safePath)) {
        const resolved = path.resolve(WORKSPACE_ROOT, safePath);
        if (resolved.startsWith(WORKSPACE_ROOT + path.sep)) {
          try {
            const localContent = await fs.readFile(resolved, 'utf8');
            res.json({
              path: safePath,
              sha: '',
              size: Buffer.byteLength(localContent, 'utf8'),
              htmlUrl: null,
              content: localContent,
              source: 'starter',
            });
            return;
          } catch {
            // Fall through to 404
          }
        }
      }
      res.status(fileRes.status).json({ error: `File ${safePath} not found in GitHub.` });
      return;
    }
    const json = (await fileRes.json()) as {
      content?: string;
      encoding?: string;
      sha?: string;
      size?: number;
      html_url?: string;
    };
    const decoded =
      json.encoding === 'base64' && typeof json.content === 'string'
        ? Buffer.from(json.content.replace(/\s+/g, ''), 'base64').toString('utf8')
        : '';

    res.json({
      path: safePath,
      sha: json.sha || '',
      size: json.size || decoded.length,
      htmlUrl: json.html_url || null,
      content: decoded,
    });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to read GitHub file.' });
  }
});

// 3c. Commit/save any text file directly back to GitHub Workspace
app.put('/api/github/file', async (req: Request, res: Response) => {
  const gh = getGitHubEnv();
  if (!gh.configured) {
    res.status(400).json({ error: 'GitHub repository is not configured.' });
    return;
  }

  const { path: rawPath, content, commitMessage, message } = req.body as {
    path?: unknown;
    content?: unknown;
    commitMessage?: unknown;
    message?: unknown;
  };
  if (typeof rawPath !== 'string' || typeof content !== 'string' || content.length > 500_000) {
    res.status(400).json({ error: 'Valid path and UTF-8 content under 500KB are required.' });
    return;
  }

  let safePath: string;
  try {
    safePath = normalizeWorkspacePath(rawPath);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid file path.' });
    return;
  }

  try {
    const rawNote =
      typeof commitMessage === 'string' && commitMessage.trim()
        ? commitMessage.trim()
        : typeof message === 'string' && message.trim()
          ? message.trim()
          : `Update ${safePath} from BlendFactory Studio`;
    const result = await commitGithubFile(
      gh,
      safePath,
      Buffer.from(content, 'utf8').toString('base64'),
      rawNote
    );
    res.json({ committed: true, ...result });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to commit file to GitHub.' });
  }
});

// 3d. Proxy raw binary/image/json asset strictly under models/<...> from GitHub
app.get('/api/github/raw', async (req: Request, res: Response) => {
  const gh = getGitHubEnv();
  if (!gh.configured) {
    res.status(404).json({ error: 'GitHub repository is not configured.' });
    return;
  }

  const rawPath = typeof req.query.path === 'string' ? req.query.path : '';
  let safePath: string;
  try {
    safePath = normalizeWorkspacePath(rawPath);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid asset path.' });
    return;
  }

  if (!safePath.startsWith('models/')) {
    res.status(403).json({ error: 'Raw proxy access is restricted to models/ asset folders.' });
    return;
  }

  try {
    const encodedPath = safePath.split('/').map(encodeURIComponent).join('/');
    const endpoint = `https://api.github.com/repos/${gh.owner}/${gh.repo}/contents/${encodedPath}?ref=${encodeURIComponent(gh.branch)}`;
    const fileRes = await fetch(endpoint, {
      headers: githubHeaders(gh.token, 'application/vnd.github.raw+json'),
    });
    if (!fileRes.ok) {
      res.status(fileRes.status).json({ error: `Asset ${safePath} not found.` });
      return;
    }
    const buf = Buffer.from(await fileRes.arrayBuffer());
    res.setHeader('Content-Type', guessMimeFromPath(safePath));
    res.setHeader('Cache-Control', 'no-store');
    res.send(buf);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to fetch asset.' });
  }
});

// 4. GitHub CI status & latest release metadata
app.get('/api/github/status', async (_req: Request, res: Response) => {
  const gh = getGitHubEnv();
  if (!gh.configured) {
    res.json({
      configured: false,
      state: 'unconfigured',
      message: 'Configure GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO in Settings > Secrets to sync with GitHub.',
      pagesUrl: null,
      latestReleaseUrl: null,
      latestRun: null,
      assets: [],
    });
    return;
  }

  try {
    const runsUrl = `https://api.github.com/repos/${gh.owner}/${gh.repo}/actions/workflows/build-blend.yml/runs?per_page=5`;
    const releaseUrl = `https://api.github.com/repos/${gh.owner}/${gh.repo}/releases/tags/latest`;

    const [runsRes, releaseRes] = await Promise.all([
      fetch(runsUrl, { headers: githubHeaders(gh.token) }),
      fetch(releaseUrl, { headers: githubHeaders(gh.token) }),
    ]);

    let latestRun: Record<string, unknown> | null = null;
    if (runsRes.ok) {
      const runsJson = (await runsRes.json()) as { workflow_runs?: Array<Record<string, unknown>> };
      const run = runsJson.workflow_runs?.[0];
      if (run) {
        latestRun = {
          id: run.id,
          status: run.status,
          conclusion: run.conclusion,
          headSha: run.head_sha,
          htmlUrl: run.html_url,
          createdAt: run.created_at,
          updatedAt: run.updated_at,
          displayTitle: run.display_title,
        };
      }
    } else if (runsRes.status === 401 || runsRes.status === 403) {
      res.status(runsRes.status).json({
        configured: true,
        state: 'error',
        message: 'GitHub token lacks required repository or Actions permissions.',
      });
      return;
    }

    let assets: Array<{ name: string; size: number; updatedAt: string }> = [];
    if (releaseRes.ok) {
      const relJson = (await releaseRes.json()) as {
        assets?: Array<{ name: string; size: number; updated_at: string }>;
      };
      assets = (relJson.assets || []).map((a) => ({
        name: a.name,
        size: a.size,
        updatedAt: a.updated_at,
      }));
    }

    let state: 'idle' | 'building' | 'success' | 'failed' = 'idle';
    if (latestRun) {
      if (latestRun.status === 'queued' || latestRun.status === 'in_progress') {
        state = 'building';
      } else if (latestRun.conclusion === 'success') {
        state = 'success';
      } else if (latestRun.conclusion) {
        state = 'failed';
      }
    }

    res.json({
      configured: true,
      state,
      owner: gh.owner,
      repo: gh.repo,
      branch: gh.branch,
      pagesUrl: gh.pagesUrl,
      latestReleaseUrl: gh.latestReleaseUrl,
      latestRun,
      assets,
    });
  } catch (err) {
    res.status(502).json({
      configured: true,
      state: 'error',
      message: err instanceof Error ? err.message : 'Unable to reach GitHub REST API.',
    });
  }
});

// 5. Commit scripts/build.py to GitHub repository via Contents API
app.post('/api/cloud/commit', async (req: Request, res: Response) => {
  const gh = getGitHubEnv();
  if (!gh.configured) {
    res.status(400).json({
      error: 'Cloud GitHub CI is not configured yet. Add GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO in Settings > Secrets.',
    });
    return;
  }

  const { bpy_script, commit_note, model_slug } = req.body as {
    bpy_script?: unknown;
    commit_note?: unknown;
    model_slug?: unknown;
  };
  if (typeof bpy_script !== 'string' || !bpy_script.trim() || bpy_script.length > 250_000) {
    res.status(400).json({ error: 'bpy_script must be a non-empty Python script under 250KB.' });
    return;
  }
  const safeNote =
    typeof commit_note === 'string' && commit_note.trim()
      ? commit_note.trim().slice(0, 140)
      : 'Update scripts/build.py from BlendFactory Studio';

  try {
    const encoded = Buffer.from(bpy_script, 'utf8').toString('base64');
    const result = await commitGithubFile(gh, 'scripts/build.py', encoded, safeNote);

    // Also mirror the source build.py into the model's dedicated subfolder if a slug is provided
    if (typeof model_slug === 'string' && model_slug.trim()) {
      const paths = buildModelSubfolderPaths(model_slug);
      await commitGithubFile(gh, paths.buildPy, encoded, `Archive ${paths.buildPy} — ${safeNote}`).catch(() => {});
    }

    res.json({
      committed: true,
      commitSha: result.sha,
      commitUrl: result.htmlUrl,
      branch: gh.branch,
      startedAt: new Date().toISOString(),
      pagesUrl: gh.pagesUrl,
    });
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Network error committing to GitHub.',
    });
  }
});

// 6. Poll GitHub Actions run for committed SHA
app.get('/api/cloud/poll', async (req: Request, res: Response) => {
  const gh = getGitHubEnv();
  if (!gh.configured) {
    res.status(400).json({ error: 'GitHub CI secrets are not configured.' });
    return;
  }

  const commitSha = typeof req.query.commitSha === 'string' ? req.query.commitSha.trim() : '';

  try {
    const runsUrl = `https://api.github.com/repos/${gh.owner}/${gh.repo}/actions/workflows/build-blend.yml/runs?per_page=10`;
    const runsRes = await fetch(runsUrl, { headers: githubHeaders(gh.token) });
    if (!runsRes.ok) {
      res.status(runsRes.status).json({ error: `Failed to poll GitHub Actions (${runsRes.status}).` });
      return;
    }

    const runsJson = (await runsRes.json()) as {
      workflow_runs?: Array<{
        id: number;
        status: string;
        conclusion: string | null;
        head_sha: string;
        html_url: string;
        updated_at: string;
      }>;
    };

    const runs = runsJson.workflow_runs || [];
    const matched = commitSha ? runs.find((r) => r.head_sha === commitSha) || runs[0] : runs[0];

    if (!matched) {
      res.json({ found: false, status: 'queued', conclusion: null, runId: null, htmlUrl: null });
      return;
    }

    res.json({
      found: true,
      status: matched.status,
      conclusion: matched.conclusion,
      runId: matched.id,
      headSha: matched.head_sha,
      htmlUrl: matched.html_url,
      updatedAt: matched.updated_at,
      pagesUrl: gh.pagesUrl,
    });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Polling error.' });
  }
});

// 7. Proxy latest GitHub Release artifacts (model.glb, preview.png, model.blend, hero/front/side/top.png, manifest.json)
const EXTENDED_RELEASE_ASSETS = new Set([
  'model.glb',
  'preview.png',
  'model.blend',
  'hero.png',
  'front.png',
  'side.png',
  'top.png',
  'manifest.json',
]);

app.get('/api/github/artifacts/:asset', async (req: Request, res: Response) => {
  const rawAsset = req.params.asset;
  const assetName = Array.isArray(rawAsset) ? rawAsset[0] : rawAsset;
  if (!assetName || (!validateReleaseAsset(assetName) && !EXTENDED_RELEASE_ASSETS.has(assetName))) {
    res.status(400).json({ error: 'Invalid artifact requested.' });
    return;
  }

  const gh = getGitHubEnv();
  if (!gh.configured) {
    res.status(404).json({ error: 'GitHub CI is not configured.' });
    return;
  }

  try {
    const releaseRes = await fetch(
      `https://api.github.com/repos/${gh.owner}/${gh.repo}/releases/tags/latest`,
      { headers: githubHeaders(gh.token) }
    );
    if (!releaseRes.ok) {
      res.status(releaseRes.status).json({ error: 'Latest GitHub Release not found yet.' });
      return;
    }

    const relJson = (await releaseRes.json()) as {
      assets?: Array<{ name: string; url: string }>;
    };
    const asset = (relJson.assets || []).find((a) => a.name === assetName);
    if (!asset) {
      res.status(404).json({ error: `Asset ${assetName} not present on latest release.` });
      return;
    }

    const fileRes = await fetch(asset.url, {
      headers: githubHeaders(gh.token, 'application/octet-stream'),
      redirect: 'follow',
    });
    if (!fileRes.ok) {
      res.status(fileRes.status).json({ error: `Failed to download ${assetName}.` });
      return;
    }

    const arrayBuffer = await fileRes.arrayBuffer();
    res.setHeader('Content-Type', guessMimeFromPath(assetName));
    res.setHeader('Cache-Control', 'no-store');
    if (assetName === 'model.blend') {
      res.setHeader('Content-Disposition', 'attachment; filename="model.blend"');
    }
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Failed to proxy GitHub release artifact.',
    });
  }
});

// 8. List organized 3D model bundles from GitHub `models/<slug>/...` + latest CI release
app.get('/api/github/models', async (_req: Request, res: Response) => {
  const gh = getGitHubEnv();
  if (!gh.configured) {
    res.json({ configured: false, models: [] });
    return;
  }

  try {
    const [releaseRes, treeRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}/releases/tags/latest`, {
        headers: githubHeaders(gh.token),
      }),
      fetch(
        `https://api.github.com/repos/${gh.owner}/${gh.repo}/git/trees/${encodeURIComponent(gh.branch)}?recursive=1`,
        { headers: githubHeaders(gh.token) }
      ),
    ]);

    const models: Array<Record<string, unknown>> = [];

    // Latest rolling release model.glb + its Cycles multi-angle screenshots
    if (releaseRes.ok) {
      const relJson = (await releaseRes.json()) as {
        html_url?: string;
        assets?: Array<{ name: string; size: number; updated_at: string }>;
      };
      const releaseAssets = relJson.assets || [];
      const glbAsset = releaseAssets.find((a) => a.name === 'model.glb');
      if (glbAsset) {
        const shots = releaseAssets
          .filter((a) => ['preview.png', 'hero.png', 'front.png', 'side.png', 'top.png'].includes(a.name))
          .map((a) => ({
            name: a.name,
            path: `release/${a.name}`,
            url: `/api/github/artifacts/${encodeURIComponent(a.name)}`,
            sizeBytes: a.size,
            kind: 'screenshot',
          }));

        models.push({
          id: 'gh-release:model.glb',
          slug: 'latest-ci-build',
          name: 'Latest CI Build (model.glb)',
          source: 'github-release',
          format: '.glb',
          group: 'Cloud_CI',
          sizeBytes: glbAsset.size,
          url: '/api/github/artifacts/model.glb',
          htmlUrl: relJson.html_url || gh.latestReleaseUrl || undefined,
          screenshots: shots,
          textures: [],
          viewable: true,
          updatedAt: glbAsset.updated_at,
          description: 'Headless Blender 4.2 LTS Cycles CI build with rolling release artifacts.',
        });
      }
    }

    // Parse organized `models/<slug>/...` folders & any legacy top-level `models/<file>`
    if (treeRes.ok) {
      const treeJson = (await treeRes.json()) as {
        tree?: Array<{ path?: string; type?: string; size?: number }>;
      };
      const blobs = (treeJson.tree || []).filter(
        (t) => t.type === 'blob' && typeof t.path === 'string' && t.path.startsWith('models/')
      );

      interface FolderBucket {
        slug: string;
        primaryFile?: { name: string; path: string; ext: string; size: number };
        buildPyPath?: string;
        manifestPath?: string;
        textures: Array<{ name: string; path: string; url: string; sizeBytes?: number; kind: 'texture' }>;
        screenshots: Array<{ name: string; path: string; url: string; sizeBytes?: number; kind: 'screenshot' }>;
      }

      const buckets = new Map<string, FolderBucket>();

      for (const blob of blobs) {
        const fullPath = blob.path!;
        const parts = fullPath.split('/');
        // Legacy flat file: models/foo.glb
        if (parts.length === 2) {
          const fname = parts[1];
          const check = validateModelUpload(fname, Math.max(1, blob.size || 1));
          if (!check.valid || !check.sanitizedName || !check.extension) continue;
          const slug = sanitizeModelSlug(fname);
          models.push({
            id: `gh-repo:${fullPath}`,
            slug,
            name: fname,
            source: 'github-repo',
            format: check.extension,
            group: 'Props',
            sizeBytes: blob.size,
            url: `/api/github/raw?path=${encodeURIComponent(fullPath)}`,
            repoFolderPath: 'models',
            textures: [],
            screenshots: [],
            viewable: VIEWABLE_3D_EXTENSIONS.has(check.extension),
          });
          continue;
        }

        // Structured subfolder: models/<slug>/...
        const slug = parts[1];
        if (!validateModelSlug(slug)) continue;
        let bucket = buckets.get(slug);
        if (!bucket) {
          bucket = { slug, textures: [], screenshots: [] };
          buckets.set(slug, bucket);
        }

        const fileName = parts[parts.length - 1];
        const rawUrl = `/api/github/raw?path=${encodeURIComponent(fullPath)}`;

        if (parts.length === 3 && fileName === 'manifest.json') {
          bucket.manifestPath = fullPath;
        } else if (parts.length === 3 && fileName === 'build.py') {
          bucket.buildPyPath = fullPath;
        } else if (parts[2] === 'textures' && validateTextureFilename(fileName)) {
          bucket.textures.push({
            name: fileName,
            path: fullPath,
            url: rawUrl,
            sizeBytes: blob.size,
            kind: 'texture',
          });
        } else if (parts[2] === 'screenshots' && validateScreenshotFilename(fileName)) {
          bucket.screenshots.push({
            name: fileName,
            path: fullPath,
            url: rawUrl,
            sizeBytes: blob.size,
            kind: 'screenshot',
          });
        } else if (parts.length === 3) {
          const check = validateModelUpload(fileName, Math.max(1, blob.size || 1));
          if (check.valid && check.extension) {
            // Prefer .glb as primary viewable mesh if multiple formats exist in the folder
            if (!bucket.primaryFile || check.extension === '.glb') {
              bucket.primaryFile = {
                name: fileName,
                path: fullPath,
                ext: check.extension,
                size: blob.size || 0,
              };
            }
          }
        }
      }

      // Enrich each folder bucket with optional manifest.json metadata
      for (const bucket of buckets.values()) {
        let displayName = bucket.slug
          .split(/[-_]/)
          .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
          .join(' ');
        let group = 'Architecture';
        let description = `GitHub folder models/${bucket.slug}/ (${bucket.textures.length} textures · ${bucket.screenshots.length} screenshots)`;
        let updatedAt: string | undefined;

        if (bucket.manifestPath) {
          try {
            const encoded = bucket.manifestPath.split('/').map(encodeURIComponent).join('/');
            const mRes = await fetch(
              `https://api.github.com/repos/${gh.owner}/${gh.repo}/contents/${encoded}?ref=${encodeURIComponent(gh.branch)}`,
              { headers: githubHeaders(gh.token, 'application/vnd.github.raw+json') }
            );
            if (mRes.ok) {
              const mJson = (await mRes.json()) as {
                name?: string;
                group?: string;
                description?: string;
                updatedAt?: string;
              };
              if (mJson.name) displayName = mJson.name;
              if (mJson.group) group = mJson.group;
              if (mJson.description) description = mJson.description;
              if (mJson.updatedAt) updatedAt = mJson.updatedAt;
            }
          } catch {
            // Fallback to folder defaults
          }
        }

        if (bucket.primaryFile || bucket.buildPyPath) {
          models.push({
            id: `gh-bundle:${bucket.slug}`,
            slug: bucket.slug,
            name: displayName,
            source: 'github-repo',
            format: bucket.primaryFile?.ext || '.glb',
            group,
            sizeBytes: bucket.primaryFile?.size,
            url: bucket.primaryFile
              ? `/api/github/raw?path=${encodeURIComponent(bucket.primaryFile.path)}`
              : undefined,
            repoFolderPath: `models/${bucket.slug}`,
            buildPyPath: bucket.buildPyPath,
            textures: bucket.textures,
            screenshots: bucket.screenshots,
            viewable: Boolean(
              bucket.primaryFile && VIEWABLE_3D_EXTENSIONS.has(bucket.primaryFile.ext)
            ),
            updatedAt,
            description,
          });
        }
      }
    }

    res.json({ configured: true, owner: gh.owner, repo: gh.repo, models });
  } catch (err) {
    res.status(502).json({
      configured: true,
      models: [],
      error: err instanceof Error ? err.message : 'Failed to list GitHub models.',
    });
  }
});

// 9. Default Organized Save: Save a complete 3D model bundle into GitHub `models/<slug>/`
app.post('/api/github/save-model-bundle', async (req: Request, res: Response) => {
  const gh = getGitHubEnv();
  if (!gh.configured) {
    res.status(400).json({ error: 'GitHub repository secrets are not configured.' });
    return;
  }

  const {
    modelSlug,
    displayName,
    group,
    fileName,
    modelFileName,
    modelBase64,
    buildPy,
    textures,
    screenshots,
    metadata,
    commitMessage,
  } = req.body as {
    modelSlug?: unknown;
    displayName?: unknown;
    group?: unknown;
    fileName?: unknown;
    modelFileName?: unknown;
    modelBase64?: unknown;
    buildPy?: unknown;
    textures?: unknown;
    screenshots?: unknown;
    metadata?: unknown;
    commitMessage?: unknown;
  };

  const resolvedFileName =
    typeof fileName === 'string' && fileName.trim()
      ? fileName.trim()
      : typeof modelFileName === 'string' && modelFileName.trim()
        ? modelFileName.trim()
        : '';

  if (!resolvedFileName || typeof modelBase64 !== 'string') {
    res.status(400).json({ error: 'fileName and modelBase64 are required.' });
    return;
  }

  let decodedModel: Buffer;
  try {
    decodedModel = decodeStrictBase64(modelBase64, MAX_MODEL_UPLOAD_BYTES);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid model binary.' });
    return;
  }

  const check = validateModelUpload(resolvedFileName, decodedModel.length);
  if (!check.valid || !check.sanitizedName) {
    res.status(400).json({ error: check.reason || 'Invalid model filename.' });
    return;
  }

  const slug = sanitizeModelSlug(typeof modelSlug === 'string' && modelSlug.trim() ? modelSlug : check.sanitizedName);
  const paths = buildModelSubfolderPaths(slug);
  const safeMsg =
    typeof commitMessage === 'string' && commitMessage.trim()
      ? commitMessage.trim().slice(0, 120)
      : `Save ${slug} asset bundle to ${paths.folder}/`;

  try {
    const committedFiles: string[] = [];
    const modelRepoPath = `${paths.folder}/${check.sanitizedName}`;
    const mainCommit = await commitGithubFile(
      gh,
      modelRepoPath,
      decodedModel.toString('base64'),
      safeMsg
    );
    committedFiles.push(modelRepoPath);

    const savedTextures: string[] = [];
    if (Array.isArray(textures)) {
      for (const tex of textures.slice(0, 12)) {
        const rawB64 =
          typeof tex?.contentBase64 === 'string'
            ? tex.contentBase64
            : typeof tex?.base64 === 'string'
              ? tex.base64
              : '';
        if (!tex || typeof tex.name !== 'string' || !rawB64) continue;
        if (!validateTextureFilename(tex.name)) continue;
        const buf = decodeStrictBase64(rawB64, MAX_SCREENSHOT_BYTES);
        const texPath = `${paths.texturesDir}/${tex.name}`;
        await commitGithubFile(gh, texPath, buf.toString('base64'), `Add texture ${tex.name} for ${slug}`);
        savedTextures.push(texPath);
        committedFiles.push(texPath);
      }
    }

    const savedScreenshots: string[] = [];
    if (Array.isArray(screenshots)) {
      for (const shot of screenshots.slice(0, 8)) {
        const rawB64 =
          typeof shot?.contentBase64 === 'string'
            ? shot.contentBase64
            : typeof shot?.base64 === 'string'
              ? shot.base64
              : '';
        if (!shot || typeof shot.name !== 'string' || !rawB64) continue;
        const latestName = buildLatestScreenshotFilename(shot.name);
        if (!validateScreenshotFilename(latestName)) continue;
        const buf = decodeStrictBase64(rawB64, MAX_SCREENSHOT_BYTES);
        const shotPath = `${paths.screenshotsDir}/${latestName}`;
        await commitGithubFile(gh, shotPath, buf.toString('base64'), `Save latest screenshot ${latestName} for ${slug}`);
        savedScreenshots.push(shotPath);
        committedFiles.push(shotPath);
      }
    }

    if (typeof buildPy === 'string' && buildPy.trim()) {
      await commitGithubFile(
        gh,
        paths.buildPy,
        Buffer.from(buildPy, 'utf8').toString('base64'),
        `Save Blender script for ${slug}`
      );
      committedFiles.push(paths.buildPy);
    }

    const nowIso = new Date().toISOString();
    const latestScreenshots = buildLatestScreenshotsManifest({
      savedPaths: savedScreenshots,
      updatedAt: nowIso,
    });

    const manifestObj = {
      slug,
      name: typeof displayName === 'string' && displayName.trim() ? displayName.trim().slice(0, 80) : slug,
      group: typeof group === 'string' && group.trim() ? group.trim().slice(0, 40) : 'Architecture',
      primaryFile: check.sanitizedName,
      format: check.extension,
      sizeBytes: decodedModel.length,
      textures: savedTextures,
      screenshots: savedScreenshots,
      latestScreenshots,
      updatedAt: nowIso,
      ...(metadata && typeof metadata === 'object' ? { telemetry: metadata } : {}),
    };

    await commitGithubFile(
      gh,
      paths.manifest,
      Buffer.from(JSON.stringify(manifestObj, null, 2), 'utf8').toString('base64'),
      `Update manifest for ${slug}`
    );
    committedFiles.push(paths.manifest);

    res.json({
      saved: true,
      slug,
      folder: paths.folder,
      modelPath: modelRepoPath,
      commitSha: mainCommit.sha,
      htmlUrl: mainCommit.htmlUrl,
      proxyUrl: `/api/github/raw?path=${encodeURIComponent(modelRepoPath)}`,
      committedFiles,
      texturesCount: savedTextures.length,
      screenshotsCount: savedScreenshots.length,
      latestScreenshots,
    });
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Failed to save model bundle to GitHub.',
    });
  }
});

// 9b. Backward-compatible upload endpoint (now stores neatly inside models/<slug>/)
app.post('/api/github/upload-model', async (req: Request, res: Response) => {
  const gh = getGitHubEnv();
  if (!gh.configured) {
    res.status(400).json({ error: 'GitHub repository secrets are not configured.' });
    return;
  }

  const { fileName, contentBase64, commitMessage, group } = req.body as {
    fileName?: unknown;
    contentBase64?: unknown;
    commitMessage?: unknown;
    group?: unknown;
  };
  if (typeof fileName !== 'string' || typeof contentBase64 !== 'string') {
    res.status(400).json({ error: 'fileName and base64 content are required.' });
    return;
  }

  try {
    const decoded = decodeStrictBase64(contentBase64, MAX_MODEL_UPLOAD_BYTES);
    const check = validateModelUpload(fileName, decoded.length);
    if (!check.valid || !check.sanitizedName) {
      res.status(400).json({ error: check.reason || 'Invalid model filename.' });
      return;
    }

    const slug = sanitizeModelSlug(check.sanitizedName);
    const paths = buildModelSubfolderPaths(slug);
    const repoPath = `${paths.folder}/${check.sanitizedName}`;
    const safeMsg =
      typeof commitMessage === 'string' && commitMessage.trim()
        ? commitMessage.trim().slice(0, 140)
        : `Upload 3D model ${check.sanitizedName} into ${paths.folder}/`;

    const result = await commitGithubFile(gh, repoPath, decoded.toString('base64'), safeMsg);

    const manifestObj = {
      slug,
      name: check.sanitizedName.replace(/\.[^.]+$/, ''),
      group: typeof group === 'string' && group.trim() ? group.trim() : 'Props',
      primaryFile: check.sanitizedName,
      format: check.extension,
      sizeBytes: decoded.length,
      updatedAt: new Date().toISOString(),
    };
    await commitGithubFile(
      gh,
      paths.manifest,
      Buffer.from(JSON.stringify(manifestObj, null, 2), 'utf8').toString('base64'),
      `Update manifest for ${slug}`
    );

    res.json({
      uploaded: true,
      slug,
      fileName: check.sanitizedName,
      path: result.path,
      commitSha: result.sha,
      htmlUrl: result.htmlUrl,
      proxyUrl: `/api/github/raw?path=${encodeURIComponent(repoPath)}`,
    });
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Network error uploading model to GitHub.',
    });
  }
});

// 10. REAL-TIME AI HARNESS PROTOCOL ENDPOINTS
// 10a. Harness submits a new or reformed Blender 4.2 build.py for a specific model slug
app.post('/api/harness/submit', async (req: Request, res: Response) => {
  const gh = getGitHubEnv();
  if (!gh.configured) {
    res.status(400).json({ error: 'GitHub repository secrets must be configured for Harness CI.' });
    return;
  }

  const { modelSlug, displayName, group, bpyScript, commitNote } = req.body as {
    modelSlug?: unknown;
    displayName?: unknown;
    group?: unknown;
    bpyScript?: unknown;
    commitNote?: unknown;
  };

  if (typeof bpyScript !== 'string' || !bpyScript.trim() || bpyScript.length > 250_000) {
    res.status(400).json({ error: 'bpyScript must be a non-empty Blender 4.2 Python script.' });
    return;
  }

  const slug = sanitizeModelSlug(typeof modelSlug === 'string' ? modelSlug : 'harness-model');
  const paths = buildModelSubfolderPaths(slug);
  const note =
    typeof commitNote === 'string' && commitNote.trim()
      ? commitNote.trim().slice(0, 140)
      : `[Harness] Build/reform ${slug}`;

  try {
    const scriptB64 = Buffer.from(bpyScript, 'utf8').toString('base64');
    await commitGithubFile(gh, paths.buildPy, scriptB64, `Archive ${paths.buildPy} — ${note}`);

    const manifestObj = {
      slug,
      name: typeof displayName === 'string' && displayName.trim() ? displayName.trim() : slug,
      group: typeof group === 'string' && group.trim() ? group.trim() : 'Architecture',
      buildPy: paths.buildPy,
      updatedAt: new Date().toISOString(),
      source: 'ai-harness',
    };
    await commitGithubFile(
      gh,
      paths.manifest,
      Buffer.from(JSON.stringify(manifestObj, null, 2), 'utf8').toString('base64'),
      `Update harness manifest for ${slug}`
    );

    const ciCommit = await commitGithubFile(gh, 'scripts/build.py', scriptB64, note);

    res.json({
      submitted: true,
      modelSlug: slug,
      folder: paths.folder,
      commitSha: ciCommit.sha,
      pollUrl: `/api/cloud/poll?commitSha=${encodeURIComponent(ciCommit.sha)}`,
      inspectUrl: `/api/harness/models/${encodeURIComponent(slug)}`,
      screenshotsUrl: `/api/harness/models/${encodeURIComponent(slug)}/screenshots`,
    });
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Harness submission failed.',
    });
  }
});

// 10b. Harness inspects a model's stored screenshots, manifest, GLB, and build.py so it can reform in real time
app.get('/api/harness/models/:slug', async (req: Request, res: Response) => {
  const gh = getGitHubEnv();
  if (!gh.configured) {
    res.status(400).json({ error: 'GitHub repository is not configured.' });
    return;
  }

  const rawSlug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const slug = sanitizeModelSlug(rawSlug || '');
  if (!validateModelSlug(slug)) {
    res.status(400).json({ error: 'Invalid model slug.' });
    return;
  }

  const includeBase64 = req.query.includeBase64 === '1';

  try {
    const treeUrl = `https://api.github.com/repos/${gh.owner}/${gh.repo}/git/trees/${encodeURIComponent(gh.branch)}?recursive=1`;
    const treeRes = await fetch(treeUrl, { headers: githubHeaders(gh.token) });
    if (!treeRes.ok) {
      res.status(treeRes.status).json({ error: 'Unable to inspect repository tree.' });
      return;
    }

    const prefix = `models/${slug}/`;
    const treeJson = (await treeRes.json()) as {
      tree?: Array<{ path?: string; type?: string; size?: number }>;
    };
    const matching = (treeJson.tree || []).filter(
      (i) => i.type === 'blob' && typeof i.path === 'string' && i.path.startsWith(prefix)
    );

    const screenshots: Array<{ name: string; path: string; url: string; base64?: string }> = [];
    const textures: Array<{ name: string; path: string; url: string }> = [];
    let modelUrl: string | null = null;
    let buildPy: string | null = null;
    let manifest: Record<string, unknown> | null = null;

    for (const item of matching) {
      const p = item.path!;
      const fname = p.split('/').pop() || '';
      const rawProxy = `/api/github/raw?path=${encodeURIComponent(p)}`;

      if (p.startsWith(`${prefix}screenshots/`) && validateScreenshotFilename(fname)) {
        const entry: { name: string; path: string; url: string; base64?: string } = {
          name: fname,
          path: p,
          url: rawProxy,
        };
        if (includeBase64 && screenshots.length < 6) {
          const encoded = p.split('/').map(encodeURIComponent).join('/');
          const imgRes = await fetch(
            `https://api.github.com/repos/${gh.owner}/${gh.repo}/contents/${encoded}?ref=${encodeURIComponent(gh.branch)}`,
            { headers: githubHeaders(gh.token, 'application/vnd.github.raw+json') }
          );
          if (imgRes.ok) {
            entry.base64 = Buffer.from(await imgRes.arrayBuffer()).toString('base64');
          }
        }
        screenshots.push(entry);
      } else if (p.startsWith(`${prefix}textures/`) && validateTextureFilename(fname)) {
        textures.push({ name: fname, path: p, url: rawProxy });
      } else if (p === `${prefix}manifest.json`) {
        const encoded = p.split('/').map(encodeURIComponent).join('/');
        const mRes = await fetch(
          `https://api.github.com/repos/${gh.owner}/${gh.repo}/contents/${encoded}?ref=${encodeURIComponent(gh.branch)}`,
          { headers: githubHeaders(gh.token, 'application/vnd.github.raw+json') }
        );
        if (mRes.ok) {
          try {
            manifest = (await mRes.json()) as Record<string, unknown>;
          } catch {
            manifest = null;
          }
        }
      } else if (p === `${prefix}build.py`) {
        const encoded = p.split('/').map(encodeURIComponent).join('/');
        const bRes = await fetch(
          `https://api.github.com/repos/${gh.owner}/${gh.repo}/contents/${encoded}?ref=${encodeURIComponent(gh.branch)}`,
          { headers: githubHeaders(gh.token, 'application/vnd.github.raw+json') }
        );
        if (bRes.ok) buildPy = await bRes.text();
      } else if (fname.toLowerCase().endsWith('.glb') || !modelUrl) {
        modelUrl = rawProxy;
      }
    }

    // Prioritize unambiguous `latest_*` screenshots first so AI models immediately read the newest views
    screenshots.sort((a, b) => {
      const aL = isLatestScreenshotFilename(a.name) ? 0 : 1;
      const bL = isLatestScreenshotFilename(b.name) ? 0 : 1;
      if (aL !== bL) return aL - bL;
      return a.name.localeCompare(b.name);
    });

    const latestScreenshots =
      (manifest?.latestScreenshots as LatestScreenshotsManifestBlock | undefined) || {
        updatedAt: (manifest?.updatedAt as string | undefined) || new Date().toISOString(),
        revision: 1,
        latestPrimary: screenshots[0]?.path || null,
        files: screenshots.map((s) => ({
          name: s.name,
          angle: s.name.replace(/\.[a-z0-9]+$/i, '').replace(/^latest[_-]/i, ''),
          path: s.path,
          updatedAt: (manifest?.updatedAt as string | undefined) || new Date().toISOString(),
        })),
      };

    res.json({
      slug,
      folder: `models/${slug}`,
      modelUrl,
      manifest,
      buildPy,
      textures,
      screenshots,
      latestScreenshots,
    });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to inspect harness model.' });
  }
});

// 10c. Store captured screenshots directly inside `models/<slug>/screenshots/latest_<angle>.png`
//      and update `models/<slug>/manifest.json` so AI harnesses know unambiguously which views are latest.
app.post('/api/harness/models/:slug/screenshots', async (req: Request, res: Response) => {
  const gh = getGitHubEnv();
  if (!gh.configured) {
    res.status(400).json({ error: 'GitHub repository is not configured.' });
    return;
  }

  const rawSlug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const slug = sanitizeModelSlug(rawSlug || '');
  if (!validateModelSlug(slug)) {
    res.status(400).json({ error: 'Invalid model slug.' });
    return;
  }

  const { screenshots, commitMessage } = req.body as {
    screenshots?: Array<{ name?: unknown; angle?: unknown; contentBase64?: unknown; base64?: unknown }>;
    commitMessage?: unknown;
  };
  if (!Array.isArray(screenshots) || screenshots.length === 0) {
    res.status(400).json({ error: 'Provide at least one screenshot { name, contentBase64 }.' });
    return;
  }

  const paths = buildModelSubfolderPaths(slug);
  const uploaded: Array<{ name: string; path: string; url: string; isLatest: boolean }> = [];
  const nowIso = new Date().toISOString();

  try {
    for (const shot of screenshots.slice(0, 8)) {
      const rawB64 =
        typeof shot.contentBase64 === 'string'
          ? shot.contentBase64
          : typeof shot.base64 === 'string'
            ? shot.base64
            : '';
      const rawLabel =
        typeof shot.name === 'string' && shot.name.trim()
          ? shot.name.trim()
          : typeof shot.angle === 'string' && shot.angle.trim()
            ? shot.angle.trim()
            : 'viewport';
      if (!rawB64) continue;

      const latestName = buildLatestScreenshotFilename(rawLabel);
      if (!validateScreenshotFilename(latestName)) continue;

      const buf = decodeStrictBase64(rawB64, MAX_SCREENSHOT_BYTES);
      const repoPath = `${paths.screenshotsDir}/${latestName}`;
      const note =
        typeof commitMessage === 'string' && commitMessage.trim()
          ? `${commitMessage.trim().slice(0, 95)} (${latestName})`
          : `Save latest screenshot ${latestName} for ${slug}`;

      await commitGithubFile(gh, repoPath, buf.toString('base64'), note);
      uploaded.push({
        name: latestName,
        path: repoPath,
        url: `/api/github/raw?path=${encodeURIComponent(repoPath)}`,
        isLatest: true,
      });
    }

    if (uploaded.length === 0) {
      res.status(400).json({ error: 'No valid screenshot payloads were provided.' });
      return;
    }

    // Read existing manifest.json if present and update latestScreenshots pointer + revision
    let existingManifest: Record<string, unknown> = {};
    try {
      const encodedManifest = paths.manifest.split('/').map(encodeURIComponent).join('/');
      const mRes = await fetch(
        `https://api.github.com/repos/${gh.owner}/${gh.repo}/contents/${encodedManifest}?ref=${encodeURIComponent(gh.branch)}`,
        { headers: githubHeaders(gh.token, 'application/vnd.github.raw+json') }
      );
      if (mRes.ok) {
        existingManifest = (await mRes.json()) as Record<string, unknown>;
      }
    } catch {
      existingManifest = {};
    }

    const latestScreenshots = buildLatestScreenshotsManifest({
      existing: existingManifest.latestScreenshots as Partial<LatestScreenshotsManifestBlock> | undefined,
      savedPaths: uploaded.map((u) => u.path),
      updatedAt: nowIso,
    });

    const mergedManifest = {
      slug,
      name: (existingManifest.name as string | undefined) || slug,
      group: (existingManifest.group as string | undefined) || 'Props',
      ...existingManifest,
      screenshots: latestScreenshots.files.map((f) => f.path),
      latestScreenshots,
      updatedAt: nowIso,
    };

    await commitGithubFile(
      gh,
      paths.manifest,
      Buffer.from(JSON.stringify(mergedManifest, null, 2), 'utf8').toString('base64'),
      `Update latestScreenshots manifest for ${slug}`
    );

    res.json({
      uploaded: true,
      stored: true,
      slug,
      count: uploaded.length,
      updatedAt: nowIso,
      latestPrimary: latestScreenshots.latestPrimary,
      latestScreenshots,
      screenshots: uploaded,
    });
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Failed to upload screenshots to GitHub.',
    });
  }
});

// 11. Real Multi-Angle Gemini Vision QA Critique + Pass 2 Script Reformer
app.post('/api/vision/critique', async (req: Request, res: Response) => {
  const ai = getGeminiClient();
  if (!ai) {
    res.status(503).json({
      error: 'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets to run real Gemini Vision QA.',
    });
    return;
  }

  const { imageBase64, mimeType, images, bpyScript, userGoal, passNumber, systemSkill } = req.body as {
    imageBase64?: unknown;
    mimeType?: unknown;
    images?: Array<{ angle?: unknown; label?: unknown; imageBase64?: unknown; base64?: unknown; mimeType?: unknown }>;
    bpyScript?: unknown;
    userGoal?: unknown;
    passNumber?: unknown;
    systemSkill?: unknown;
  };

  const visualParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
  if (Array.isArray(images) && images.length > 0) {
    for (const img of images.slice(0, 4)) {
      const raw =
        typeof img?.imageBase64 === 'string'
          ? img.imageBase64
          : typeof img?.base64 === 'string'
            ? img.base64
            : '';
      if (raw.length > 100 && raw.length < 8_500_000) {
        const cleaned = raw.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
        if (/^[A-Za-z0-9+/=]+$/.test(cleaned)) {
          const safeMime =
            img.mimeType === 'image/jpeg' || img.mimeType === 'image/png' || img.mimeType === 'image/webp'
              ? img.mimeType
              : 'image/png';
          visualParts.push({ inlineData: { mimeType: safeMime, data: cleaned } });
        }
      }
    }
  } else if (typeof imageBase64 === 'string' && imageBase64.length > 100 && imageBase64.length < 8_500_000) {
    const cleaned = imageBase64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
    if (/^[A-Za-z0-9+/=]+$/.test(cleaned)) {
      const safeMime =
        mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp'
          ? mimeType
          : 'image/png';
      visualParts.push({ inlineData: { mimeType: safeMime, data: cleaned } });
    }
  }

  if (visualParts.length === 0) {
    res.status(400).json({ error: 'At least one real captured screenshot or Cycles render is required for Vision QA.' });
    return;
  }

  const scriptStr = typeof bpyScript === 'string' ? bpyScript : '';
  const goalStr =
    typeof userGoal === 'string' && userGoal.trim()
      ? userGoal.trim()
      : 'Inspect these real rendered angles for geometry proportions, bevel quality, grounding, and Principled BSDF materials.';
  const passNum = typeof passNumber === 'number' && Number.isFinite(passNumber) ? passNumber : 1;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: [
        {
          role: 'user',
          parts: [
            ...visualParts,
            {
              text: [
                `Inspect these ${visualParts.length} real rendered view(s) of the 3D asset (Pass ${passNum}).`,
                `Design Goal: ${goalStr}`,
                '',
                'Current scripts/build.py:',
                '```python',
                scriptStr.slice(0, 40000),
                '```',
                '',
                'Identify concrete silhouette, proportion, bevel, grounding, or Principled BSDF material defects visible in the actual images.',
                'Provide a complete, drop-in refined Blender 4.2 LTS scripts/build.py for the next reform pass (no save/export/render boilerplate).',
              ].join('\n'),
            },
          ],
        },
      ],
      config: {
        systemInstruction:
          typeof systemSkill === 'string' && systemSkill.trim()
            ? systemSkill.trim()
            : 'You are a Principal Blender 4.2 LTS Look-Dev and Geometry QA Director.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            recommendPass2: { type: Type.BOOLEAN },
            commitNote: { type: Type.STRING },
            defects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  severity: { type: Type.STRING },
                  area: { type: Type.STRING },
                  finding: { type: Type.STRING },
                  fix: { type: Type.STRING },
                },
                required: ['severity', 'area', 'finding', 'fix'],
              },
            },
            refinedScript: { type: Type.STRING },
          },
          required: ['summary', 'recommendPass2', 'commitNote', 'defects', 'refinedScript'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json(parsed);
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Gemini Vision critique failed.',
    });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    const distDir = path.join(WORKSPACE_ROOT, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BlendFactory Studio] Server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[BlendFactory Studio] Fatal startup error:', err);
  process.exit(1);
});
