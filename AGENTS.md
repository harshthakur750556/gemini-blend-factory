# AGENTS.md — BlendFactory Studio AI Agent & Harness Operating Manual

Welcome, AI Agent. This repository powers **BlendFactory Studio**: an interactive 3D world-building viewport, universal 3D format exporter/converter, GitHub-synced model asset factory, and headless **Blender 4.2 LTS Cycles** build & visual-reform pipeline.

Read this document in full to utilize every capability of this project autonomously—including creating procedural 3D assets, staging Blender-style **Lights** and **Cameras**, storing and reading **`latest_*` screenshots**, running **Multi-Angle Vision QA**, and executing the real-time **Create → Preview → Inspect → Reform** loop.

---

## 1. Core Capabilities at a Glance

| Capability | What You Can Do |
| :--- | :--- |
| **Headless Blender 4.2 CI** | Submit a Blender 4.2 Python script (`scripts/build.py`) to compile `.glb`, native `.blend`, and multi-angle Cycles CPU renders via GitHub Actions. |
| **Organized GitHub Model Bundles** | Store every 3D asset cleanly in `models/<slug>/` alongside `manifest.json`, `build.py`, `textures/*`, and `screenshots/latest_*.png`. |
| **Repo-First Latest Screenshots** | Viewport and camera captures are saved directly into `models/<slug>/screenshots/` with explicit `latest_*` filenames (no auto-downloads) and tracked in `manifest.json` (`latestScreenshots`). |
| **Real-Time AI Harness Loop** | Submit a model via API, poll CI status, fetch `latest_*.png` renders as base64, critique defects visually, and push Pass 2 / Pass 3 reforms automatically. |
| **Blender World Builder (UI)** | Place and transform meshes, architectural prefabs, terrain, water, UCX colliders, **4 Blender Light types** (`Point`, `Sun`, `Spot`, `Area`), and **Scene Cameras** with frustum helpers and `Numpad 0` Look-Through-Camera mode. |
| **Universal 16-Format Export & 11-Format Converter** | Export scenes to `.glb`, `.gltf`, `.fbx`, `.dae`, `.usdz`, `.usda`, `.obj`, `.stl`, `.step`, `.dxf`, `.3mf`, `.ply`, `.off`, `.blend`, `.py`, `.png`; convert local 3D files across engines & CAD tools. |
| **GitHub Workspace Sync & Drive Copy** | Browse/read/commit any repo file via `/api/github/tree` and `/api/github/file`; users can selectively back up individual models or entire groups (with textures & screenshots) to Google Drive. |

---

## 2. Model Asset Repository Structure & `latest_*` Screenshot Contract

Every 3D model stored in GitHub lives under its own sanitized lowercase slug folder (`^[a-z0-9][a-z0-9_-]{0,63}$`):

```text
models/
  <slug>/
    <slug>.glb                     # Primary viewable PBR binary mesh (or other 3D format)
    build.py                       # Archived Blender 4.2 LTS generator script for this asset
    manifest.json                  # Canonical metadata + `latestScreenshots` pointer block
    textures/
      <material>_albedo.png        # Extracted PBR texture maps (albedo, normal, roughness, etc.)
    screenshots/
      latest_hero.png              # Latest 3/4 hero studio render (PRIMARY default view)
      latest_front.png             # Latest orthographic-aligned front elevation
      latest_side.png              # Latest right-side elevation
      latest_top.png               # Latest top-down plan view
      latest_camera.png            # Latest render framed through the active Blender Scene Camera
      latest_viewport.png          # Latest direct viewport capture (F12 / Capture button)
```

### How to Know Which Screenshot Is the Latest

1. **Filename Prefix Convention (`latest_*`)**:
   - Every screenshot saved by the Studio UI, Scene Camera capture, or Harness API is written with a deterministic **`latest_<angle>.png`** name (`latest_hero.png`, `latest_front.png`, `latest_side.png`, `latest_top.png`, `latest_camera.png`, `latest_viewport.png`).
   - Saving a new capture **overwrites** the corresponding `latest_<angle>.png` in place so there is zero ambiguity.
2. **Manifest Pointer (`models/<slug>/manifest.json`)**:
   - Every screenshot save automatically increments `latestScreenshots.revision`, stamps `latestScreenshots.updatedAt` (ISO-8601 UTC), sets `latestScreenshots.latestPrimary`, and updates `latestScreenshots.files[]`:
   ```json
   {
     "slug": "stone-lantern",
     "name": "Stone & Cedar Lantern",
     "group": "Architecture",
     "latestScreenshots": {
       "updatedAt": "2026-11-25T16:30:00.000Z",
       "revision": 4,
       "latestPrimary": "models/stone-lantern/screenshots/latest_hero.png",
       "files": [
         {
           "name": "latest_hero.png",
           "angle": "hero",
           "path": "models/stone-lantern/screenshots/latest_hero.png",
           "updatedAt": "2026-11-25T16:30:00.000Z"
         }
       ]
     }
   }
   ```
3. **Sorted API Output**:
   - Calling `GET /api/harness/models/:slug?includeBase64=1` always sorts `latest_*` images **first** in the `screenshots` array and returns the top-level `latestScreenshots` object alongside base64 PNG data ready for multimodal inspection.

---

## 3. Complete HTTP API Reference

All routes are served by `server.ts` on the Studio origin (`http://localhost:3000` in development or the deployed Studio URL). GitHub and Gemini credentials are held strictly server-side via environment secrets (`GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`, `GEMINI_API_KEY`).

### A. Discovery & Workspace Sync

| Method & Path | Purpose | Key Params / Body |
| :--- | :--- | :--- |
| `GET /api/config` | Check whether GitHub CI and Gemini Vision are configured and get `owner`, `repo`, `branch`, `pagesUrl`. | — |
| `GET /api/github/status` | Check latest GitHub Actions `build-blend.yml` workflow status (`idle`, `building`, `success`, `failed`) and release assets. | — |
| `GET /api/github/tree` | List up to 400 repository files (excludes `node_modules/` and `dist/`). | — |
| `GET /api/github/file?path=<relPath>` | Read any UTF-8 repository file (e.g. `AGENTS.md`, `scripts/build.py`, `models/<slug>/manifest.json`). | `path` (relative, no `..`) |
| `PUT /api/github/file` | Commit edits to any repository text file directly to GitHub. | `{ "path", "content", "commitMessage" }` |
| `GET /api/github/models` | List all organized model bundles in `models/<slug>/` plus the latest CI release build. | — |
| `GET /api/github/raw?path=models/...` | Stream any raw binary/image/json file strictly inside `models/`. | `path` (must start with `models/`) |
| `GET /api/github/artifacts/:asset` | Fetch rolling CI release artifacts (`model.glb`, `model.blend`, `preview.png`, `hero.png`, `front.png`, `side.png`, `top.png`, `manifest.json`). | `:asset` |

### B. Real-Time AI Harness Protocol

#### 1. Submit a New or Reformed Blender 4.2 Script
`POST /api/harness/submit`

Archives `bpyScript` into `models/<slug>/build.py`, updates `models/<slug>/manifest.json`, and commits `scripts/build.py` to trigger the headless Blender 4.2 LTS GitHub Actions CI build.

```json
{
  "modelSlug": "stone-courtyard-lantern",
  "displayName": "Stone Courtyard Lantern",
  "group": "Architecture",
  "bpyScript": "import bpy\n...",
  "commitNote": "Pass 1: Initial granite & hinoki lantern geometry"
}
```

Response:
```json
{
  "submitted": true,
  "modelSlug": "stone-courtyard-lantern",
  "folder": "models/stone-courtyard-lantern",
  "commitSha": "abc123...",
  "pollUrl": "/api/cloud/poll?commitSha=abc123...",
  "inspectUrl": "/api/harness/models/stone-courtyard-lantern",
  "screenshotsUrl": "/api/harness/models/stone-courtyard-lantern/screenshots"
}
```

#### 2. Poll Headless Blender CI Completion
`GET /api/cloud/poll?commitSha=<sha>`

Returns `{ found, status, conclusion, runId, headSha, htmlUrl, updatedAt, pagesUrl }`. Wait until `status === "completed"` and `conclusion === "success"`.

#### 3. Inspect Model Assets & Fetch Latest Screenshots (With Base64)
`GET /api/harness/models/:slug?includeBase64=1`

Returns the model's `modelUrl`, `manifest`, `buildPy`, `textures[]`, `latestScreenshots`, and up to 6 `screenshots[]` (with `latest_*` sorted first and inline `base64` PNG payloads when `includeBase64=1`).

#### 4. Push Latest Screenshots Into Model Assets
`POST /api/harness/models/:slug/screenshots`

Writes each image to `models/<slug>/screenshots/latest_<angle>.png` and updates `models/<slug>/manifest.json` (`latestScreenshots.revision` & `updatedAt`).

```json
{
  "screenshots": [
    { "name": "latest_hero.png", "contentBase64": "<base64-png>" },
    { "name": "latest_camera.png", "contentBase64": "<base64-png>" }
  ],
  "commitMessage": "Store latest multi-angle captures"
}
```

#### 5. Save a Complete Organized Model Bundle (Mesh + Textures + Latest Screenshots + Script)
`POST /api/github/save-model-bundle`

```json
{
  "modelSlug": "stone-courtyard-lantern",
  "displayName": "Stone Courtyard Lantern",
  "group": "Architecture",
  "fileName": "stone-courtyard-lantern.glb",
  "modelBase64": "<base64-glb>",
  "buildPy": "import bpy\n...",
  "textures": [{ "name": "granite_albedo.png", "contentBase64": "<base64-png>" }],
  "screenshots": [
    { "name": "latest_hero.png", "contentBase64": "<base64-png>" },
    { "name": "latest_front.png", "contentBase64": "<base64-png>" }
  ],
  "commitMessage": "Save organized model bundle"
}
```

#### 6. Multi-Angle Gemini Vision QA Critique & Automatic Script Reform
`POST /api/vision/critique`

Sends up to 4 real rendered images + current `bpyScript` + `userGoal` to Gemini Vision and receives structured `{ summary, recommendPass2, commitNote, defects[], refinedScript }`.

```json
{
  "images": [
    { "angle": "hero", "imageBase64": "<base64-png>", "mimeType": "image/png" },
    { "angle": "front", "imageBase64": "<base64-png>", "mimeType": "image/png" }
  ],
  "bpyScript": "import bpy\n...",
  "userGoal": "Verify roof overhang proportions, chamfer bevels, and stone roughness",
  "passNumber": 1
}
```

---

## 4. Autonomous Create → Preview → Inspect → Reform Playbook

When operating BlendFactory Studio as an AI agent, execute this exact closed loop:

1. **Check Environment**: Call `GET /api/config` to confirm `githubConfigured: true` (and `geminiConfigured` if delegating critique to `/api/vision/critique`).
2. **Author Clean Blender 4.2 Script (Pass 1)**: Write procedural `bpy` geometry following Section 5 below.
3. **Submit Build**: `POST /api/harness/submit` with a clean `modelSlug` (e.g., `cedar-torii-gate`).
4. **Wait for Compilation**: Poll `GET /api/cloud/poll?commitSha=<sha>` every 5–10 seconds until `status === "completed"`.
   - Meanwhile, the BlendFactory Studio web app (with 12s Auto-Sync enabled) automatically loads the compiled `model.glb` on stage.
5. **Inspect Latest Visuals**:
   - Call `GET /api/harness/models/<slug>?includeBase64=1` to retrieve `latest_hero.png`, `latest_front.png`, `latest_side.png`, `latest_top.png`, and `latest_camera.png` (or fetch `/api/github/artifacts/hero.png`, `front.png`, `side.png`, `top.png` from the rolling CI release).
   - Check `latestScreenshots.updatedAt` and `latestScreenshots.revision` to confirm you are looking at the newest render.
6. **Critique & Reform (Pass 2+)**:
   - Inspect proportions, silhouette balance, grounding (`Z = 0`), edge bevels, PBR roughness contrast, and lighting readability across all angles.
   - Submit an improved script to `POST /api/harness/submit` with `commitNote: "Pass 2: ..."`.
   - Repeat until zero high-severity visual defects remain!

---

## 5. Blender 4.2 LTS Scripting & Light/Camera Staging Rules

`scripts/build.py` is executed inside headless **Blender 4.2 LTS** by `scripts/export_and_render.py`, which automatically handles saving `.blend`, exporting `.glb`, and rendering multi-angle Cycles PNGs.

- **DO**:
  - Start with `import bpy` (and `import bmesh, math` as needed).
  - Build composite multi-part assemblies with distinct PBR `Principled BSDF` materials (Blender 4.2 socket names: `"Base Color"`, `"Metallic"`, `"Roughness"`, `"Coat Weight"`, `"Emission Color"`, `"Emission Strength"`).
  - Ground every prop/structure cleanly at `Z = 0.0` (bottom-center pivot) in real-world meters.
  - Add bevel modifiers (`bmesh.ops.bevel` or `BEVEL` modifier) to architectural/hard-surface edges so highlights read sharply.
  - Name every mesh, light, and camera semantically (e.g., `Lantern_Roof`, `Key_Sun_Light`, `Hero_Scene_Camera`).
  - When authoring full 3D worlds or lit scenes, you may include Blender Lights (`POINT`, `SUN`, `SPOT`, `AREA`) and Cameras (`bpy.data.cameras.new(...)`) positioned cleanly to frame the subject.
- **DO NOT**:
  - Do NOT call `bpy.ops.wm.save_as_mainfile()`, `bpy.ops.export_scene.gltf()`, or `bpy.ops.render.render()` inside `scripts/build.py` — `scripts/export_and_render.py` handles all saving, exporting, and multi-angle Cycles rendering automatically.
  - Do NOT use deprecated Blender 3.x sockets like `"Specular"` or `"Subsurface"` directly; use Blender 4.2 names (`"Specular IOR Level"`, `"Subsurface Weight"`).

---

## 6. Interactive Studio Features & Shortcuts Reference

Humans and browser-automation agents interacting with the Studio UI can use:

- **Blender Transform Gizmos**: `G` (Move), `R` (Rotate), `S` (Scale), `Shift+D` (Duplicate), `Delete` (Delete selected node), `Escape` (Clear gizmo/close modals).
- **Blender Lights & Cameras (Inspector → World)**:
  - **Lights**: Spawn `Point`, `Sun`, `Spot`, or `Area` lights with live 3D wireframe helpers and edit color, energy/intensity, range, spot cone angle & penumbra, area softbox width/height, and shadows.
  - **Scene Cameras**: Spawn `Scene Camera` objects with 3D frustum pyramid helpers, edit focal length (`18mm`–`200mm`) & clip planes, press **`Numpad 0`** (or click **Look Through**) to frame directly through the camera, press **`Ctrl+Alt+0`** (or click **Align to View**) to match the current viewport, and click **Capture to Repo** to store `latest_camera.png` directly into `models/<slug>/screenshots/`.
- **Zero-Download Repo Capture**: Clicking the bottom dock Camera button or pressing **`F12`** captures the active stage (hiding all editor helpers/gizmos) and saves `latest_viewport.png` (or `latest_camera.png` when looking through a Scene Camera) directly into `models/<slug>/screenshots/`—never triggering unwanted browser downloads. Manual PNG downloads remain strictly opt-in inside the **Export** dialog.
- **Blender Viewport Navigation**: `Numpad 1/3/7` (Front/Right/Top), `Ctrl+Numpad 1/3/7` (Back/Left/Bottom), `Numpad 5` (Perspective/Ortho), `Numpad 0` (Toggle Look Through Scene Camera, or Reset View if no Scene Camera exists), `Alt+Ctrl+Q` (Quad View), `H` (Zen mode).

---

## 7. Security & Validation Boundaries

- **Path Confinement**: All repository paths are validated against directory traversal (`..`), absolute paths, null bytes, and backslashes. Raw proxy reads (`/api/github/raw`) are strictly confined to `models/`.
- **Strict Slug & Filename Rules**: Model slugs must match `^[a-z0-9][a-z0-9_-]{0,63}$`. Screenshots must be `.png`, `.jpg`, `.jpeg`, or `.webp` under `6 MB`; 3D uploads must match allowed 3D extensions and stay under `25 MB`.
- **Server-Only Secrets**: Never place `GITHUB_TOKEN` or `GEMINI_API_KEY` in client code, browser storage, or committed files.
