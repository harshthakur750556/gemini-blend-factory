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
  assert.equal(formatExportFilename('   ', 'stl'), 'apex-model.stl');

  const script = buildBlenderReconstructionScript('Apex_Titan_Mk4', 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n');
  assert.match(script, /bpy\.ops\.wm\.read_factory_settings\(use_empty=True\)/);
  assert.match(script, /bpy\.ops\.wm\.obj_import/);
  assert.match(script, /Principled BSDF/);
});



