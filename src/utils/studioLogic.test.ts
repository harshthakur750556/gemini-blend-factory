import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGitHubPagesUrl,
  buildGitHubReleaseUrl,
  normalizeWorkspacePath,
  resolveStaticPagesAssetUrl,
  validateGithubSlug,
  validateLocalBlenderEndpoint,
  validateReleaseAsset,
} from './pathSafety';
import { computeLineDiff, extractDiffHunks } from './diffEngine';
import { STARTER_BUILD_PY, validateBlenderScript } from './blenderSkill';
import {
  generateTwoFactorChallenge,
  verifyTwoFactorPermission,
} from './twoFactorGate';
import {
  applyBlenderOrbitStep,
  getBlenderPresetOffset,
} from './cameraPresets';
import {
  MAX_MODEL_UPLOAD_BYTES,
  validateModelUpload,
} from './modelUploadValidation';

test('normalizeWorkspacePath cleans valid relative paths', () => {
  assert.equal(normalizeWorkspacePath('scripts/build.py'), 'scripts/build.py');
  assert.equal(normalizeWorkspacePath('./scripts/./build.py'), 'scripts/build.py');
  assert.equal(normalizeWorkspacePath('  preview/index.html '), 'preview/index.html');
});

test('normalizeWorkspacePath rejects traversal, absolute paths, and backslashes', () => {
  assert.throws(() => normalizeWorkspacePath('../etc/passwd'), /traversal/i);
  assert.throws(() => normalizeWorkspacePath('scripts/../../secret.txt'), /traversal/i);
  assert.throws(() => normalizeWorkspacePath('/etc/passwd'), /Absolute paths/i);
  assert.throws(() => normalizeWorkspacePath('scripts\\build.py'), /Backslashes/i);
  assert.throws(() => normalizeWorkspacePath(''), /empty/i);
});

test('validateLocalBlenderEndpoint enforces loopback http and valid user port', () => {
  const ok = validateLocalBlenderEndpoint('http://127.0.0.1:8787/blender');
  assert.equal(ok.valid, true);
  assert.equal(ok.normalized, 'http://127.0.0.1:8787/blender');

  const okLocalhost = validateLocalBlenderEndpoint('http://localhost:9000/run');
  assert.equal(okLocalhost.valid, true);

  assert.equal(validateLocalBlenderEndpoint('http://169.254.169.254:80/latest/meta-data').valid, false);
  assert.equal(validateLocalBlenderEndpoint('https://evil.example.com:8787/blender').valid, false);
  assert.equal(validateLocalBlenderEndpoint('http://127.0.0.1:22/ssh').valid, false);
  assert.equal(validateLocalBlenderEndpoint('file:///etc/passwd').valid, false);
});

test('GitHub slug, release asset, and Pages URL helpers validate inputs strictly', () => {
  assert.equal(validateGithubSlug('octocat'), true);
  assert.equal(validateGithubSlug('gemini-blend-factory'), true);
  assert.equal(validateGithubSlug('../evil'), false);
  assert.equal(validateGithubSlug('bad/slug'), false);

  assert.equal(validateReleaseAsset('model.glb'), true);
  assert.equal(validateReleaseAsset('preview.png'), true);
  assert.equal(validateReleaseAsset('model.blend'), true);
  assert.equal(validateReleaseAsset('secrets.env'), false);

  assert.equal(resolveStaticPagesAssetUrl('model.glb'), './model.glb');
  assert.equal(resolveStaticPagesAssetUrl('preview.png'), './preview.png');
  assert.equal(resolveStaticPagesAssetUrl('../secret.txt'), null);

  assert.equal(
    buildGitHubPagesUrl('MyOrg', 'gemini-blend-factory'),
    'https://myorg.github.io/gemini-blend-factory/'
  );
  assert.equal(buildGitHubPagesUrl('../bad', 'repo'), null);
  assert.equal(
    buildGitHubReleaseUrl('MyOrg', 'gemini-blend-factory'),
    'https://github.com/MyOrg/gemini-blend-factory/releases/tag/latest'
  );
});

test('computeLineDiff produces accurate additions, deletions, and unchanged state', () => {
  const unchanged = computeLineDiff('a\nb', 'a\nb');
  assert.equal(unchanged.changed, false);
  assert.equal(unchanged.additions, 0);
  assert.equal(unchanged.deletions, 0);

  const diff = computeLineDiff('import bpy\nx = 1\ny = 2', 'import bpy\nx = 2\ny = 2\nz = 3');
  assert.equal(diff.changed, true);
  assert.equal(diff.additions, 2);
  assert.equal(diff.deletions, 1);
  assert.equal(diff.lines.some((l) => l.type === 'remove' && l.content === 'x = 1'), true);
  assert.equal(diff.lines.some((l) => l.type === 'add' && l.content === 'x = 2'), true);
  assert.equal(diff.lines.some((l) => l.type === 'add' && l.content === 'z = 3'), true);
});

test('validateBlenderScript accepts clean starter script and flags boilerplate/errors', () => {
  const starterReport = validateBlenderScript(STARTER_BUILD_PY);
  assert.equal(starterReport.valid, true);
  assert.equal(starterReport.errors.length, 0);
  assert.equal(starterReport.warnings.length, 0);

  const badReport = validateBlenderScript('print("hello")');
  assert.equal(badReport.valid, false);
  assert.equal(badReport.errors.length, 1);

  const boilerplateReport = validateBlenderScript(
    'import bpy\nbpy.ops.wm.read_factory_settings(use_empty=True)\nbpy.ops.render.render(write_still=True)'
  );
  assert.equal(boilerplateReport.valid, true);
  assert.equal(boilerplateReport.warnings.length, 1);
});

test('extractDiffHunks collapses unchanged prefix lines and surfaces changed hunks', () => {
  const before = Array.from({ length: 40 }, (_, i) => `line_${i + 1}`).join('\n');
  const after = `${before}\n# new trailing line`;
  const diff = computeLineDiff(before, after);
  const hunks = extractDiffHunks(diff, 2);

  assert.equal(hunks[0].kind, 'separator');
  if (hunks[0].kind === 'separator') {
    assert.equal(hunks[0].skippedCount, 38);
  }
  const addedRow = hunks.find((r) => r.kind === 'line' && r.line.type === 'add');
  assert.ok(addedRow);
});

test('twoFactorGate enforces risk acknowledgment, exact 6-digit code, and expiry', () => {
  const challenge = generateTwoFactorChallenge(60_000);
  assert.match(challenge.code, /^\d{6}$/);

  const missingFactor1 = verifyTwoFactorPermission({
    challenge,
    enteredCode: challenge.code,
    acknowledgedRisk: false,
    now: challenge.issuedAt + 1000,
  });
  assert.equal(missingFactor1.ok, false);

  const wrongCode = verifyTwoFactorPermission({
    challenge,
    enteredCode: challenge.code === '000000' ? '111111' : '000000',
    acknowledgedRisk: true,
    now: challenge.issuedAt + 1000,
  });
  assert.equal(wrongCode.ok, false);

  const expired = verifyTwoFactorPermission({
    challenge,
    enteredCode: challenge.code,
    acknowledgedRisk: true,
    now: challenge.expiresAt + 1,
  });
  assert.equal(expired.ok, false);

  const valid = verifyTwoFactorPermission({
    challenge,
    enteredCode: `${challenge.code.slice(0, 3)}-${challenge.code.slice(3)}`,
    acknowledgedRisk: true,
    now: challenge.issuedAt + 1000,
  });
  assert.equal(valid.ok, true);
});

test('cameraPresets returns orthogonal axis offsets and preserves radius on 15-degree orbit steps', () => {
  const front = getBlenderPresetOffset('front', 4);
  assert.deepEqual(front, { x: 0, y: 0, z: 4 });

  const top = getBlenderPresetOffset('top', 5);
  assert.equal(top.y, 5);
  assert.ok(Math.abs(top.z) < 0.01);

  const stepped = applyBlenderOrbitStep({ x: 0, y: 0, z: 4 }, 'right', 15);
  const radius = Math.hypot(stepped.x, stepped.y, stepped.z);
  assert.ok(Math.abs(radius - 4) < 1e-6);
  assert.ok(stepped.x > 0.9);
});

test('validateModelUpload sanitizes valid 3D model names and rejects unsafe types or oversized payloads', () => {
  const ok = validateModelUpload('C:\\models\\My Mech Rig (v2).GLB', 1024 * 500);
  assert.equal(ok.valid, true);
  assert.equal(ok.sanitizedName, 'My-Mech-Rig-v2.glb');
  assert.equal(ok.extension, '.glb');

  const objOk = validateModelUpload('chassis_part.OBJ', 42_000);
  assert.equal(objOk.valid, true);
  assert.equal(objOk.extension, '.obj');

  const stlOk = validateModelUpload('bracket-v3.stl', 84_000);
  assert.equal(stlOk.valid, true);
  assert.equal(stlOk.extension, '.stl');

  assert.equal(validateModelUpload('malware.exe', 1024).valid, false);
  assert.equal(validateModelUpload('huge.glb', MAX_MODEL_UPLOAD_BYTES + 1).valid, false);
  assert.equal(validateModelUpload('empty.blend', 0).valid, false);
  assert.equal(validateModelUpload('...glb', 500).valid, false);
});

test('export helpers sanitize filenames and emit valid Blender 4.2 reconstruction scripts', async () => {
  const { formatExportFilename, buildBlenderReconstructionScript } = await import('./modelExporters');
  assert.equal(formatExportFilename('Apex Titan Mk4 (Final).glb', '.obj'), 'Apex_Titan_Mk4_Final.obj');
  assert.equal(formatExportFilename('   ', 'stl'), 'studio-model.stl');

  const script = buildBlenderReconstructionScript('Apex_Titan_Mk4', 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n');
  assert.match(script, /bpy\.ops\.wm\.read_factory_settings\(use_empty=True\)/);
  assert.match(script, /bpy\.ops\.wm\.obj_import/);
  assert.match(script, /Principled BSDF/);
});

test('pathSafety latest_* screenshot naming, manifest block, and subfolder paths work strictly', async () => {
  const {
    sanitizeModelSlug,
    validateModelSlug,
    validateScreenshotFilename,
    validateTextureFilename,
    buildModelSubfolderPaths,
    buildLatestScreenshotFilename,
    isLatestScreenshotFilename,
    buildLatestScreenshotsManifest,
  } = await import('./pathSafety');

  assert.equal(sanitizeModelSlug('Stone & Cedar Lantern.glb'), 'stone-cedar-lantern');
  assert.equal(validateModelSlug('stone-cedar-lantern'), true);
  assert.equal(validateModelSlug('../escape'), false);

  assert.equal(validateScreenshotFilename('latest_hero.png'), true);
  assert.equal(validateScreenshotFilename('../evil.png'), false);
  assert.equal(validateTextureFilename('cedar_albedo.png'), true);
  assert.equal(validateTextureFilename('script.js'), false);

  const sub = buildModelSubfolderPaths('stone-cedar-lantern');
  assert.equal(sub.folder, 'models/stone-cedar-lantern');
  assert.equal(sub.screenshotsDir, 'models/stone-cedar-lantern/screenshots');
  assert.equal(sub.manifest, 'models/stone-cedar-lantern/manifest.json');

  assert.equal(buildLatestScreenshotFilename('hero'), 'latest_hero.png');
  assert.equal(buildLatestScreenshotFilename('latest_camera.png'), 'latest_camera.png');
  assert.equal(buildLatestScreenshotFilename('Viewport'), 'latest_viewport.png');
  assert.equal(isLatestScreenshotFilename('latest_front.png'), true);
  assert.equal(isLatestScreenshotFilename('hero.png'), false);

  const m1 = buildLatestScreenshotsManifest({
    savedPaths: [
      'models/stone-cedar-lantern/screenshots/latest_hero.png',
      'models/stone-cedar-lantern/screenshots/latest_camera.png',
    ],
  });
  assert.equal(m1.revision, 1);
  assert.equal(m1.latestPrimary, 'models/stone-cedar-lantern/screenshots/latest_camera.png');
  assert.equal(
    m1.files.find((f) => f.angle === 'hero')?.path,
    'models/stone-cedar-lantern/screenshots/latest_hero.png'
  );

  const m2 = buildLatestScreenshotsManifest({
    existing: m1,
    savedPaths: ['models/stone-cedar-lantern/screenshots/latest_viewport.png'],
  });
  assert.equal(m2.revision, 2);
  assert.equal(m2.latestPrimary, 'models/stone-cedar-lantern/screenshots/latest_viewport.png');
  assert.equal(
    m2.files.find((f) => f.angle === 'hero')?.path,
    'models/stone-cedar-lantern/screenshots/latest_hero.png'
  );
});

test('validateModelUpload supports expanded CAD and game engine extensions', () => {
  for (const name of ['rig.fbx', 'scene.dae', 'print.3mf', 'mesh.amf', 'poly.off', 'cad.dxf', 'asset.gltf']) {
    const res = validateModelUpload(name, 2048);
    assert.equal(res.valid, true, `Expected ${name} to be valid`);
  }
});

test('Blender Lights, Scene Camera focal length math, and editor helper exclusion work reliably', async () => {
  const THREE = await import('three');
  const {
    createWorldPrimitive,
    focalLengthMmToFovDeg,
    fovDegToFocalLengthMm,
  } = await import('./worldPrimitives');
  const { exportObject3DToBlob } = await import('./modelExporters');

  const fov50 = focalLengthMmToFovDeg(50);
  assert.ok(fov50 > 26 && fov50 < 28, `Expected 50mm vertical FOV ~27 deg, got ${fov50}`);
  const roundTrip = fovDegToFocalLengthMm(fov50);
  assert.ok(Math.abs(roundTrip - 50) < 0.05);

  const point = createWorldPrimitive('point-light', 1);
  const sun = createWorldPrimitive('sun-light', 2);
  const spot = createWorldPrimitive('spot-light', 3);
  const areaGpu = createWorldPrimitive('area-light', 4, { isSoftwareGl: false });
  const areaSw = createWorldPrimitive('area-light', 5, { isSoftwareGl: true });
  const cam = createWorldPrimitive('scene-camera', 6);

  assert.equal(point.userData.studioElementType, 'light');
  assert.equal(point.userData.lightKind, 'point');
  assert.equal(sun.userData.lightKind, 'sun');
  assert.equal(spot.userData.lightKind, 'spot');
  assert.equal(areaGpu.userData.lightKind, 'area');
  assert.equal(areaSw.userData.lightKind, 'area');
  assert.equal(cam.userData.studioElementType, 'camera');
  assert.equal(cam.userData.focalLengthMm, 50);

  // Verify editor helper meshes inside lights/cameras are excluded from ALL mesh exports
  const stage = new THREE.Group();
  const realCube = createWorldPrimitive('cube', 1);
  stage.add(realCube, point, spot, areaGpu, cam);

  const objExport = await exportObject3DToBlob(stage, 'obj', 'lantern-world');
  const objText = await objExport.blob.text();
  const vertexLines = objText.split('\n').filter((line) => line.startsWith('v '));
  assert.equal(vertexLines.length, 24, `Expected only cube's 24 vertices, got ${vertexLines.length}`);
  assert.doesNotMatch(objText, /__LightHelper|__CameraFrustumHelper|__SpotConeHelper/);

  const stepExport = await exportObject3DToBlob(stage, 'step', 'lantern-world');
  const stepText = await stepExport.blob.text();
  assert.match(stepText, /ISO-10303-21;/);

  const usdaExport = await exportObject3DToBlob(stage, 'usda', 'lantern-world');
  const usdaText = await usdaExport.blob.text();
  assert.match(usdaText, /#usda 1\.0/);
});

test('OFF and DXF geometry parsers reconstruct valid BufferGeometries', async () => {
  const { parseOffToGeometry, parseDxf3dFacesToGeometry } = await import('./modelConverter');

  const offGeo = parseOffToGeometry(`OFF\n3 1 0\n0 0 0\n1 0 0\n0 1 0\n3 0 1 2\n`);
  assert.equal(offGeo.getAttribute('position').count, 3);

  const dxfGeo = parseDxf3dFacesToGeometry(
    ['0', 'SECTION', '2', 'ENTITIES', '0', '3DFACE', '10', '0', '20', '0', '30', '0', '11', '1', '21', '0', '31', '0', '12', '0', '22', '1', '32', '0', '13', '0', '23', '1', '33', '0', '0', 'ENDSEC', '0', 'EOF'].join('\n')
  );
  assert.equal(dxfGeo.getAttribute('position').count, 3);
});



