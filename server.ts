import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import { GoogleGenAI, Type, type FunctionDeclaration } from '@google/genai';
import {
  buildGitHubPagesUrl,
  buildGitHubReleaseUrl,
  validateGithubSlug,
  validateReleaseAsset,
} from './src/utils/pathSafety.ts';
import { MAX_MODEL_UPLOAD_BYTES, validateModelUpload } from './src/utils/modelUploadValidation.ts';

const PORT = Number(process.env.PORT || 3000);
const MODEL_ID = 'gemini-4-hydrogen';
const WORKSPACE_ROOT = path.resolve(process.cwd());

const app = express();
app.use(express.json({ limit: '18mb' }));

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

const STUDIO_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'build_blend_cloud',
    description:
      'Commits a complete Blender 4.2 LTS Python modeling script to scripts/build.py in Cloud GitHub CI (or routes to Local Blender Backup if active), runs headless Blender to generate model.blend, model.glb, and Cycles preview.png, and triggers automated Gemini Vision inspection.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        bpy_script: {
          type: Type.STRING,
          description:
            'Complete standalone Blender 4.2 LTS Python script using bmesh, modifiers, and Principled BSDF. Must start with bpy.ops.wm.read_factory_settings(use_empty=True) and omit save/export/render calls.',
        },
        commit_note: {
          type: Type.STRING,
          description: 'Concise git commit note describing the 3D asset or visual refinement pass.',
        },
      },
      required: ['bpy_script', 'commit_note'],
    },
  },
  {
    name: 'read_local_file',
    description:
      'Reads a text file from the user’s linked local PC workspace folder using a relative POSIX path (e.g. "scripts/build.py" or "README.md").',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: {
          type: Type.STRING,
          description: 'Relative POSIX path inside the linked local folder.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_local_file',
    description:
      'Proposes writing or updating a file in the user’s linked local PC workspace folder. The UI displays a line-by-line diff card and waits for explicit user approval before writing to disk.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: {
          type: Type.STRING,
          description: 'Relative POSIX path inside the linked local folder.',
        },
        content: {
          type: Type.STRING,
          description: 'Complete new UTF-8 file contents.',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_local_files',
    description:
      'Lists files available in the user’s linked local PC workspace folder (or starter repository files if no local folder is linked).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        subdir: {
          type: Type.STRING,
          description: 'Optional relative subdirectory prefix to filter results (e.g. "scripts").',
        },
      },
    },
  },
];

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

// 2. Starter repository files for the Left Workspace Pane before linking a local folder
const STARTER_REPO_PATHS = [
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
        // Skip if file does not exist
      }
    }
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load starter files.' });
  }
});

// 3. GitHub CI status & latest release metadata
app.get('/api/github/status', async (_req: Request, res: Response) => {
  const gh = getGitHubEnv();
  if (!gh.configured) {
    res.json({
      configured: false,
      state: 'unconfigured',
      message: 'Configure GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO in Settings > Secrets to run Cloud GitHub CI.',
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
      assets = (relJson.assets || [])
        .filter((a) => validateReleaseAsset(a.name))
        .map((a) => ({
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

// 4. Commit scripts/build.py to GitHub repository via Contents API
app.post('/api/cloud/commit', async (req: Request, res: Response) => {
  const gh = getGitHubEnv();
  if (!gh.configured) {
    res.status(400).json({
      error:
        'Cloud GitHub CI is not configured yet. Add GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO in Settings > Secrets.',
    });
    return;
  }

  const { bpy_script, commit_note } = req.body as { bpy_script?: unknown; commit_note?: unknown };
  if (typeof bpy_script !== 'string' || !bpy_script.trim() || bpy_script.length > 250_000) {
    res.status(400).json({ error: 'bpy_script must be a non-empty Python script under 250KB.' });
    return;
  }
  const safeNote =
    typeof commit_note === 'string' && commit_note.trim()
      ? commit_note.trim().slice(0, 140)
      : 'Update scripts/build.py from BlendFactory Studio';

  try {
    const contentEndpoint = `https://api.github.com/repos/${gh.owner}/${gh.repo}/contents/scripts/build.py`;
    let existingSha: string | undefined;

    const getRes = await fetch(`${contentEndpoint}?ref=${encodeURIComponent(gh.branch)}`, {
      headers: githubHeaders(gh.token),
    });
    if (getRes.ok) {
      const existing = (await getRes.json()) as { sha?: string };
      existingSha = existing.sha;
    }

    const putRes = await fetch(contentEndpoint, {
      method: 'PUT',
      headers: {
        ...githubHeaders(gh.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: safeNote,
        content: Buffer.from(bpy_script, 'utf8').toString('base64'),
        branch: gh.branch,
        ...(existingSha ? { sha: existingSha } : {}),
      }),
    });

    if (!putRes.ok) {
      const errBody = await putRes.text();
      res.status(putRes.status).json({
        error: `GitHub commit failed (${putRes.status}): ${errBody.slice(0, 240)}`,
      });
      return;
    }

    const putJson = (await putRes.json()) as {
      commit?: { sha?: string; html_url?: string };
    };

    res.json({
      committed: true,
      commitSha: putJson.commit?.sha || '',
      commitUrl: putJson.commit?.html_url || null,
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

// 5. Poll GitHub Actions run for committed SHA
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
    const matched = commitSha
      ? runs.find((r) => r.head_sha === commitSha) || runs[0]
      : runs[0];

    if (!matched) {
      res.json({
        found: false,
        status: 'queued',
        conclusion: null,
        runId: null,
        htmlUrl: null,
      });
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

// 6. Proxy latest GitHub Release artifacts (model.glb, preview.png, model.blend)
app.get('/api/github/artifacts/:asset', async (req: Request, res: Response) => {
  const rawAsset = req.params.asset;
  const assetName = Array.isArray(rawAsset) ? rawAsset[0] : rawAsset;
  if (!assetName || !validateReleaseAsset(assetName)) {
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
      assets?: Array<{ name: string; url: string; browser_download_url: string }>;
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
    const contentType =
      assetName === 'preview.png'
        ? 'image/png'
        : assetName === 'model.glb'
          ? 'model/gltf-binary'
          : 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
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

// 6b. List available 3D models from GitHub latest release + repo models/ directory
app.get('/api/github/models', async (_req: Request, res: Response) => {
  const gh = getGitHubEnv();
  if (!gh.configured) {
    res.json({ configured: false, models: [] });
    return;
  }

  try {
    const [releaseRes, contentsRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}/releases/tags/latest`, {
        headers: githubHeaders(gh.token),
      }),
      fetch(
        `https://api.github.com/repos/${gh.owner}/${gh.repo}/contents/models?ref=${encodeURIComponent(gh.branch)}`,
        { headers: githubHeaders(gh.token) }
      ),
    ]);

    const models: Array<{
      id: string;
      name: string;
      source: 'github-release' | 'github-repo';
      format: string;
      sizeBytes?: number;
      url?: string;
      htmlUrl?: string;
      viewable: boolean;
      updatedAt?: string;
    }> = [];

    if (releaseRes.ok) {
      const relJson = (await releaseRes.json()) as {
        html_url?: string;
        assets?: Array<{ name: string; size: number; updated_at: string }>;
      };
      for (const a of relJson.assets || []) {
        if (a.name === 'model.glb') {
          models.push({
            id: `gh-release:${a.name}`,
            name: 'Latest CI Build (model.glb)',
            source: 'github-release',
            format: '.glb',
            sizeBytes: a.size,
            url: '/api/github/artifacts/model.glb',
            htmlUrl: relJson.html_url || gh.latestReleaseUrl || undefined,
            viewable: true,
            updatedAt: a.updated_at,
          });
        }
      }
    }

    if (contentsRes.ok) {
      const list = (await contentsRes.json()) as Array<{
        type?: string;
        name?: string;
        size?: number;
        path?: string;
        html_url?: string;
      }>;
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item.type !== 'file' || !item.name) continue;
          const lower = item.name.toLowerCase();
          const ext = lower.endsWith('.glb')
            ? '.glb'
            : lower.endsWith('.gltf')
              ? '.gltf'
              : lower.endsWith('.obj')
                ? '.obj'
                : lower.endsWith('.stl')
                  ? '.stl'
                  : lower.endsWith('.blend')
                    ? '.blend'
                    : null;
          if (!ext) continue;
          const check = validateModelUpload(item.name, Math.max(1, item.size || 1));
          if (!check.valid || !check.sanitizedName) continue;
          models.push({
            id: `gh-repo:${check.sanitizedName}`,
            name: item.name,
            source: 'github-repo',
            format: ext,
            sizeBytes: item.size,
            url: `/api/github/repo-model/${encodeURIComponent(check.sanitizedName)}`,
            htmlUrl: item.html_url,
            viewable: ext === '.glb' || ext === '.gltf' || ext === '.obj' || ext === '.stl',
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

// 6c. Proxy a custom 3D model stored in models/<filename> on GitHub
app.get('/api/github/repo-model/:filename', async (req: Request, res: Response) => {
  const gh = getGitHubEnv();
  if (!gh.configured) {
    res.status(404).json({ error: 'GitHub repository is not configured.' });
    return;
  }

  const rawName = req.params.filename;
  const filename = Array.isArray(rawName) ? rawName[0] : rawName;
  const check = validateModelUpload(filename || '', 1);
  if (!check.valid || !check.sanitizedName || check.sanitizedName !== filename) {
    res.status(400).json({ error: 'Invalid model filename.' });
    return;
  }

  try {
    const endpoint = `https://api.github.com/repos/${gh.owner}/${gh.repo}/contents/models/${encodeURIComponent(check.sanitizedName)}?ref=${encodeURIComponent(gh.branch)}`;
    const fileRes = await fetch(endpoint, {
      headers: githubHeaders(gh.token, 'application/vnd.github.raw+json'),
    });
    if (!fileRes.ok) {
      res.status(fileRes.status).json({ error: `Model ${check.sanitizedName} not found in repo.` });
      return;
    }

    const buf = Buffer.from(await fileRes.arrayBuffer());
    const contentType =
      check.extension === '.glb'
        ? 'model/gltf-binary'
        : check.extension === '.gltf'
          ? 'model/gltf+json'
          : check.extension === '.obj'
            ? 'text/plain;charset=utf-8'
            : 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buf);
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Failed to proxy repository model.',
    });
  }
});

// 6d. Upload a custom 3D model (.glb, .gltf, .blend) to GitHub repo under models/<sanitizedName>
app.post('/api/github/upload-model', async (req: Request, res: Response) => {
  const gh = getGitHubEnv();
  if (!gh.configured) {
    res.status(400).json({
      error: 'GitHub repository secrets are not configured.',
    });
    return;
  }

  const { fileName, contentBase64, commitMessage } = req.body as {
    fileName?: unknown;
    contentBase64?: unknown;
    commitMessage?: unknown;
  };

  if (typeof fileName !== 'string' || typeof contentBase64 !== 'string' || !contentBase64.trim()) {
    res.status(400).json({ error: 'fileName and base64 content are required.' });
    return;
  }

  const cleanedBase64 = contentBase64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/=]+$/.test(cleanedBase64)) {
    res.status(400).json({ error: 'Invalid base64 payload.' });
    return;
  }

  const decoded = Buffer.from(cleanedBase64, 'base64');
  if (decoded.length === 0 || decoded.length > MAX_MODEL_UPLOAD_BYTES) {
    res.status(400).json({ error: 'Model binary size is empty or exceeds the 12MB limit.' });
    return;
  }

  const check = validateModelUpload(fileName, decoded.length);
  if (!check.valid || !check.sanitizedName) {
    res.status(400).json({ error: check.reason || 'Invalid model filename.' });
    return;
  }

  const repoPath = `models/${check.sanitizedName}`;
  const safeMsg =
    typeof commitMessage === 'string' && commitMessage.trim()
      ? commitMessage.trim().slice(0, 140)
      : `Upload 3D model ${check.sanitizedName} from BlendFactory Studio`;

  try {
    const contentEndpoint = `https://api.github.com/repos/${gh.owner}/${gh.repo}/contents/${repoPath}`;
    let existingSha: string | undefined;

    const existingRes = await fetch(`${contentEndpoint}?ref=${encodeURIComponent(gh.branch)}`, {
      headers: githubHeaders(gh.token),
    });
    if (existingRes.ok) {
      const existingJson = (await existingRes.json()) as { sha?: string };
      existingSha = existingJson.sha;
    }

    const putRes = await fetch(contentEndpoint, {
      method: 'PUT',
      headers: {
        ...githubHeaders(gh.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: safeMsg,
        content: decoded.toString('base64'),
        branch: gh.branch,
        ...(existingSha ? { sha: existingSha } : {}),
      }),
    });

    if (!putRes.ok) {
      const errBody = await putRes.text();
      res.status(putRes.status).json({
        error: `GitHub model upload failed (${putRes.status}): ${errBody.slice(0, 220)}`,
      });
      return;
    }

    const putJson = (await putRes.json()) as {
      content?: { path?: string; html_url?: string };
      commit?: { sha?: string; html_url?: string };
    };

    res.json({
      uploaded: true,
      fileName: check.sanitizedName,
      path: putJson.content?.path || repoPath,
      commitSha: putJson.commit?.sha || '',
      htmlUrl: putJson.content?.html_url || putJson.commit?.html_url || null,
      proxyUrl: `/api/github/repo-model/${encodeURIComponent(check.sanitizedName)}`,
    });
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Network error uploading model to GitHub.',
    });
  }
});

// 7. Gemini Function Calling Chat Endpoint
app.post('/api/chat', async (req: Request, res: Response) => {
  const ai = getGeminiClient();
  if (!ai) {
    res.status(503).json({
      error: 'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets.',
    });
    return;
  }

  const { contents, systemSkill, mode, localFiles, currentBuildPy } = req.body as {
    contents?: unknown;
    systemSkill?: unknown;
    mode?: unknown;
    localFiles?: unknown;
    currentBuildPy?: unknown;
  };

  if (!Array.isArray(contents) || contents.length === 0) {
    res.status(400).json({ error: 'contents must be a non-empty array of conversation turns.' });
    return;
  }

  const skillText = typeof systemSkill === 'string' && systemSkill.trim() ? systemSkill.trim() : '';
  const filesList = Array.isArray(localFiles)
    ? localFiles.filter((f): f is string => typeof f === 'string').slice(0, 120)
    : [];
  const activeMode = mode === 'local' ? 'Local Blender Backup' : 'Cloud GitHub CI [Primary]';

  const systemInstruction = [
    skillText,
    '',
    `Active Execution Mode: ${activeMode}`,
    `Visible Workspace Files (${filesList.length}): ${filesList.length ? filesList.join(', ') : 'None linked yet'}`,
    typeof currentBuildPy === 'string' && currentBuildPy.trim()
      ? `Current scripts/build.py length: ${currentBuildPy.length} chars.`
      : '',
    'When asked to build or modify a 3D model, invoke build_blend_cloud with a complete, valid Blender 4.2 LTS script.',
    'When asked to inspect or edit files in the user’s local folder, invoke list_local_files, read_local_file, or write_local_file.',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: contents as Parameters<typeof ai.models.generateContent>[0]['contents'],
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: STUDIO_FUNCTION_DECLARATIONS }],
      },
    });

    const modelContent = response.candidates?.[0]?.content ?? null;
    const functionCalls = (response.functionCalls || []).map((fc) => ({
      id: fc.id,
      name: fc.name,
      args: fc.args || {},
    }));

    res.json({
      text: response.text ?? '',
      functionCalls,
      modelContent,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gemini API call failed.';
    res.status(502).json({ error: message });
  }
});

// 8. Autonomous Gemini Vision Critique + Pass 2 Script Generator
app.post('/api/vision/critique', async (req: Request, res: Response) => {
  const ai = getGeminiClient();
  if (!ai) {
    res.status(503).json({
      error: 'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets.',
    });
    return;
  }

  const { imageBase64, mimeType, bpyScript, userGoal, passNumber, systemSkill } = req.body as {
    imageBase64?: unknown;
    mimeType?: unknown;
    bpyScript?: unknown;
    userGoal?: unknown;
    passNumber?: unknown;
    systemSkill?: unknown;
  };

  if (typeof imageBase64 !== 'string' || imageBase64.length < 100) {
    res.status(400).json({ error: 'Valid base64 image data is required for Vision inspection.' });
    return;
  }

  const safeMime =
    mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp'
      ? mimeType
      : 'image/png';
  const scriptStr = typeof bpyScript === 'string' ? bpyScript : '';
  const goalStr = typeof userGoal === 'string' && userGoal.trim() ? userGoal.trim() : 'Inspect the rendered 3D model for silhouette, bevel, proportion, and material defects.';
  const passNum = typeof passNumber === 'number' && Number.isFinite(passNumber) ? passNumber : 1;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: safeMime,
                data: imageBase64,
              },
            },
            {
              text: [
                `Inspect this Blender 4.2 LTS Cycles CPU render (Pass ${passNum}).`,
                `User Design Goal: ${goalStr}`,
                '',
                'Current scripts/build.py:',
                '```python',
                scriptStr.slice(0, 40000),
                '```',
                '',
                'Identify concrete geometry, proportion, bevel, grounding, or Principled BSDF material defects visible in the render.',
                'If improvements are warranted, provide a complete, drop-in refined Blender 4.2 LTS scripts/build.py for Pass 2 (no save/export/render boilerplate).',
              ].join('\n'),
            },
          ],
        },
      ],
      config: {
        systemInstruction:
          typeof systemSkill === 'string' && systemSkill.trim()
            ? systemSkill.trim()
            : 'You are a Blender 4.2 LTS Look-Dev and Geometry QA Director.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: 'Concise technical assessment of the rendered model.',
            },
            recommendPass2: {
              type: Type.BOOLEAN,
              description: 'True if a refined Pass 2 build will noticeably improve visual quality.',
            },
            commitNote: {
              type: Type.STRING,
              description: 'Short git commit note for the Pass 2 refinement.',
            },
            defects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  severity: {
                    type: Type.STRING,
                    description: 'high, medium, or low',
                  },
                  area: {
                    type: Type.STRING,
                    description: 'Component or visual region inspected.',
                  },
                  finding: {
                    type: Type.STRING,
                    description: 'Concrete defect observed in the Cycles render.',
                  },
                  fix: {
                    type: Type.STRING,
                    description: 'Exact Blender 4.2 bmesh/modifier/material fix applied in Pass 2.',
                  },
                },
                required: ['severity', 'area', 'finding', 'fix'],
              },
            },
            refinedScript: {
              type: Type.STRING,
              description: 'Complete refined Blender 4.2 LTS Python script for Pass 2.',
            },
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
