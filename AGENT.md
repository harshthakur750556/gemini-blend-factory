# AGENT.md — BlendFactory Studio AI Harness Guide

> **Canonical Full Specification**: See [`AGENTS.md`](./AGENTS.md) in the repository root for complete JSON request/response schemas, Blender 4.2 LTS look-dev rules, and security boundaries.

## Quick-Start Protocol for AI Models & External Harnesses

1. **Check Studio Configuration**:
   - `GET /api/config` → verifies `githubConfigured`, `geminiConfigured`, `githubOwner`, `githubRepo`, `pagesUrl`.
2. **Submit or Reform a 3D Model (`scripts/build.py`)**:
   - `POST /api/harness/submit` with `{ modelSlug, displayName, group, bpyScript, commitNote }`.
   - Archives `models/<slug>/build.py` + `models/<slug>/manifest.json` and triggers headless Blender 4.2 LTS GitHub Actions CI.
3. **Wait for Build Completion**:
   - Poll `GET /api/cloud/poll?commitSha=<sha>` until `status === "completed"` and `conclusion === "success"`.
4. **Inspect the Latest Screenshots (Unambiguous `latest_*` Naming)**:
   - Call `GET /api/harness/models/<slug>?includeBase64=1`.
   - Look for **`latest_*`** files in `models/<slug>/screenshots/`:
     - `latest_hero.png` (primary 3/4 view)
     - `latest_front.png`, `latest_side.png`, `latest_top.png` (orthographic inspection angles)
     - `latest_camera.png` (rendered from the active Blender Scene Camera)
     - `latest_viewport.png` (direct Studio viewport capture via `F12` / Capture button)
   - Verify freshness using `manifest.json → latestScreenshots.updatedAt` and `latestScreenshots.revision`.
5. **Save Updated Captures or Full Bundles Without Browser Downloads**:
   - `POST /api/harness/models/<slug>/screenshots` saves `latest_<angle>.png` directly into the repo and increments `latestScreenshots.revision`.
   - `POST /api/github/save-model-bundle` commits `<slug>.glb`, `textures/*`, `screenshots/latest_*.png`, `build.py`, and `manifest.json` in one organized folder.
6. **Run Multi-Angle Vision QA & Reform**:
   - `POST /api/vision/critique` analyzes up to 4 real rendered images + `bpyScript` and returns structured `defects[]` and a drop-in `refinedScript` for the next reform pass.
7. **Full Studio Capabilities**:
   - Full Blender-style World Builder (`Point`, `Sun`, `Spot`, `Area` Lights + `Scene Camera` with focal length `18–200mm`, `Numpad 0` Look-Through, `Ctrl+Alt+0` Align to View, primitives, terrain, water, UCX colliders, Array & Scatter modifiers).
   - Universal 16-format export (`.glb`, `.gltf`, `.fbx`, `.dae`, `.usdz`, `.usda`, `.obj`, `.stl`, `.step`, `.dxf`, `.3mf`, `.ply`, `.off`, `.blend`, `.py`, `.png`) and 11-format local 3D converter.
   - Live GitHub Workspace sync (`GET /api/github/tree`, `GET/PUT /api/github/file`) and selective/group Google Drive bundle backup.
