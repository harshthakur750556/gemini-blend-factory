import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import {
  clearHistoryStack,
  createHistoryStack,
  getHistorySummary,
  pushHistoryCommand,
  stepRedo,
  stepUndo,
} from './undoHistory';
import {
  applyTerrainPaintBrush,
  applyTerrainSculptBrush,
  captureTerrainSnapshot,
  createOpenWorldTerrainMesh,
  restoreTerrainSnapshot,
  sampleTerrainHeightAt,
} from './terrainEngine';
import {
  captureSceneTransformSnapshot,
  collectWorldColliders,
  createPlayerState,
  findSafePlayerSpawn,
  restoreSceneTransformSnapshot,
  stepPlayerController,
  stepRigidBodies,
  type AabbCollider,
  type RigidBodyState,
} from './physicsEngine';
import {
  filterAndGroupLibraryModels,
  getCategoryLabel,
} from './libraryCategories';
import type { AvailableModelItem } from '../types';

// ---------------------------------------------------------------------------
// 1. Undo / Redo Command History Engine
// ---------------------------------------------------------------------------
test('undoHistory pushes, undoes, redoes, and truncates future branch on new edit', () => {
  let value = 0;
  let stack = createHistoryStack(3);

  stack = pushHistoryCommand(stack, {
    label: 'Set 1',
    undo: () => {
      value = 0;
    },
    redo: () => {
      value = 1;
    },
  });
  value = 1;

  stack = pushHistoryCommand(stack, {
    label: 'Set 2',
    undo: () => {
      value = 1;
    },
    redo: () => {
      value = 2;
    },
  });
  value = 2;

  assert.equal(getHistorySummary(stack).canUndo, true);
  assert.equal(getHistorySummary(stack).canRedo, false);
  assert.equal(getHistorySummary(stack).undoLabel, 'Set 2');

  const u1 = stepUndo(stack);
  stack = u1.stack;
  assert.equal(value, 1);
  assert.equal(u1.command?.label, 'Set 2');
  assert.equal(getHistorySummary(stack).canRedo, true);
  assert.equal(getHistorySummary(stack).redoLabel, 'Set 2');

  const r1 = stepRedo(stack);
  stack = r1.stack;
  assert.equal(value, 2);
  assert.equal(getHistorySummary(stack).canRedo, false);

  // Undo once then push a new command — future stack must be cleared
  stack = stepUndo(stack).stack;
  assert.equal(value, 1);
  stack = pushHistoryCommand(stack, {
    label: 'Branch 10',
    undo: () => {
      value = 1;
    },
    redo: () => {
      value = 10;
    },
  });
  value = 10;
  assert.equal(getHistorySummary(stack).canRedo, false);
  assert.equal(getHistorySummary(stack).undoLabel, 'Branch 10');

  // Max depth enforcement (maxDepth = 3)
  stack = pushHistoryCommand(stack, { label: 'A', undo: () => {}, redo: () => {} });
  stack = pushHistoryCommand(stack, { label: 'B', undo: () => {}, redo: () => {} });
  assert.equal(getHistorySummary(stack).undoCount, 3);

  stack = clearHistoryStack(stack);
  assert.equal(getHistorySummary(stack).canUndo, false);
  assert.equal(getHistorySummary(stack).undoCount, 0);
});

// ---------------------------------------------------------------------------
// 2. Open-World Terrain Sculpting (including Y < 0) & Multi-Layer Painting
// ---------------------------------------------------------------------------
test('terrainEngine sculpts above and below Y=0, paints layers, and restores snapshots cleanly', () => {
  const terrain = createOpenWorldTerrainMesh(1, { size: 16, segments: 24 });
  const initialSnap = captureTerrainSnapshot(terrain);

  const center = new THREE.Vector3(0, 0, 0);
  const startY = sampleTerrainHeightAt(terrain, 0, 0);
  assert.notEqual(startY, null);

  // Raise hill
  const raisedVerts = applyTerrainSculptBrush(terrain, center, {
    mode: 'raise',
    radius: 3.0,
    strength: 1.5,
  });
  assert.ok(raisedVerts > 5, 'Should displace vertices inside brush radius');
  const afterRaiseY = sampleTerrainHeightAt(terrain, 0, 0)!;
  assert.ok(afterRaiseY > startY!, `Expected raised height (${afterRaiseY}) > start (${startY})`);

  // Carve deeply below Y = 0 (cave / canyon trench)
  for (let i = 0; i < 6; i++) {
    applyTerrainSculptBrush(terrain, center, {
      mode: 'lower',
      radius: 3.0,
      strength: 1.8,
    });
  }
  const afterLowerY = sampleTerrainHeightAt(terrain, 0, 0)!;
  assert.ok(afterLowerY < -0.5, `Terrain must allow carving well below Y=0, got ${afterLowerY}`);

  // Flatten back to target Y = -2.0
  for (let i = 0; i < 8; i++) {
    applyTerrainSculptBrush(terrain, center, {
      mode: 'flatten',
      radius: 2.5,
      strength: 1.2,
      flattenTargetY: -2.0,
    });
  }
  const flattenedY = sampleTerrainHeightAt(terrain, 0, 0)!;
  assert.ok(Math.abs(flattenedY - -2.0) < 0.25, `Expected flattened Y near -2.0, got ${flattenedY}`);

  // Multi-layer vertex-color painting
  const painted = applyTerrainPaintBrush(terrain, center, {
    layer: 'snow',
    radius: 3.0,
    strength: 1.0,
  });
  assert.ok(painted > 5);
  const colAttr = terrain.geometry.getAttribute('color') as THREE.BufferAttribute;
  let foundSnow = false;
  for (let i = 0; i < colAttr.count; i++) {
    if (colAttr.getX(i) > 0.85 && colAttr.getZ(i) > 0.88) {
      foundSnow = true;
      break;
    }
  }
  assert.equal(foundSnow, true, 'Vertex color attribute should contain painted snow tone');

  // Restore snapshot (Undo)
  restoreTerrainSnapshot(terrain, initialSnap);
  const restoredY = sampleTerrainHeightAt(terrain, 0, 0)!;
  assert.ok(Math.abs(restoredY - startY!) < 1e-4, 'Restoring snapshot must revert terrain height exactly');
});

// ---------------------------------------------------------------------------
// 3. Physics Engine (Gravity, Stacking) & Play Mode Player Controller
// ---------------------------------------------------------------------------
test('physicsEngine drops rigid bodies under gravity and stacks them cleanly', () => {
  const bodies: RigidBodyState[] = [
    {
      uuid: 'box-bottom',
      position: { x: 0, y: 2.0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
      bottomOffset: 0.5,
      isStatic: false,
      sleeping: false,
    },
    {
      uuid: 'box-top',
      position: { x: 0, y: 4.0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
      bottomOffset: 0.5,
      isStatic: false,
      sleeping: false,
    },
  ];

  for (let step = 0; step < 180; step++) {
    stepRigidBodies(bodies, [], 1 / 60, { gravity: 9.81, floorY: 0 });
  }

  // Bottom box rests on floor (center Y = 0.5)
  assert.ok(Math.abs(bodies[0].position.y - 0.5) < 0.05, `Expected bottom box at y=0.5, got ${bodies[0].position.y}`);
  // Top box stacks atop bottom box (center Y = 1.5)
  assert.ok(Math.abs(bodies[1].position.y - 1.5) < 0.08, `Expected top box stacked at y=1.5, got ${bodies[1].position.y}`);
});

test('physicsEngine Play Mode player moves, jumps, collides with walls, and restores pre-play scene', () => {
  const wall: AabbCollider = {
    id: 'wall-1',
    name: 'Wall',
    minX: -2,
    maxX: 2,
    minY: 0,
    maxY: 3,
    minZ: -1.5,
    maxZ: -0.5,
    isStatic: true,
    isWalkableSurface: false,
  };

  const spawn = findSafePlayerSpawn([wall], { x: 0, y: 0, z: 2 });
  const player = createPlayerState({ ...spawn, yaw: 0 }); // yaw=0 faces -Z toward wall

  // Settle on floor
  for (let i = 0; i < 20; i++) {
    stepPlayerController(player, { forward: 0, right: 0, jump: false, sprint: false }, [wall], 1 / 60, {
      gravityEnabled: true,
      floorY: 0,
    });
  }
  assert.equal(player.grounded, true);

  // Jump upward
  stepPlayerController(player, { forward: 0, right: 0, jump: true, sprint: false }, [wall], 1 / 60, {
    gravityEnabled: true,
    floorY: 0,
  });
  assert.ok(player.vy > 4.0, 'Jump must impart positive vertical velocity');
  assert.equal(player.grounded, false);

  // Walk forward into the wall repeatedly — player must be blocked at wall maxZ + radius (-0.5 + 0.32 = -0.18)
  for (let i = 0; i < 120; i++) {
    stepPlayerController(player, { forward: 1, right: 0, jump: false, sprint: true }, [wall], 1 / 60, {
      gravityEnabled: true,
      floorY: 0,
    });
  }
  assert.ok(player.z >= -0.22, `Wall collider must block player at z >= -0.18, got ${player.z}`);

  // Pre-play scene transform snapshot & restore
  const world = new THREE.Group();
  const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  cube.position.set(1, 2, -3);
  world.add(cube);

  const snap = captureSceneTransformSnapshot(world);
  cube.position.set(99, -15, 42);
  restoreSceneTransformSnapshot(world, snap);
  assert.equal(cube.position.x, 1);
  assert.equal(cube.position.y, 2);
  assert.equal(cube.position.z, -3);
});

test('physicsEngine supports coyote time, Zero-G flight ascend/descend, surface grounding, and void respawn', () => {
  // 1. Exact mesh surface grounding via sampleSurfaceY
  const spawn = findSafePlayerSpawn([], { x: -1.2, y: 0.5, z: 3.5 }, () => 0.42);
  assert.ok(Math.abs(spawn.y - 0.44) < 0.02, `Spawn should sit cleanly on sampled surface, got ${spawn.y}`);

  const player = createPlayerState({ ...spawn, yaw: 0 });
  for (let i = 0; i < 12; i++) {
    stepPlayerController(player, { forward: 0, right: 0, jump: false, sprint: false }, [], 1 / 60, {
      gravityEnabled: true,
      gravityStrength: 9.81,
      floorY: null,
      sampleSurfaceY: () => 0.42,
    });
  }
  assert.equal(player.grounded, true);
  assert.ok(Math.abs(player.y - 0.42) < 0.05);

  // 2. Coyote time: step off ledge (no floor), jump 0.05s later should still succeed
  stepPlayerController(player, { forward: 1, right: 0, jump: false, sprint: false }, [], 0.05, {
    gravityEnabled: true,
    gravityStrength: 9.81,
    floorY: null,
  });
  assert.equal(player.grounded, false);
  assert.ok(player.coyoteTimer > 0, 'Coyote timer must remain positive right after leaving a ledge');
  stepPlayerController(player, { forward: 1, right: 0, jump: true, sprint: false }, [], 1 / 60, {
    gravityEnabled: true,
    gravityStrength: 9.81,
    floorY: null,
  });
  assert.ok(player.vy > 4.0, 'Jump during coyote time window must impart upward velocity');

  // 3. Zero-G Sky Flight: Space ascends, descend lowers
  const beforeFlyY = player.y;
  for (let i = 0; i < 20; i++) {
    stepPlayerController(player, { forward: 0, right: 0, jump: true, sprint: false }, [], 1 / 60, {
      gravityEnabled: false,
      floorY: null,
    });
  }
  assert.ok(player.y > beforeFlyY + 0.5, 'Zero-G Space should ascend cleanly');
  const peakY = player.y;
  for (let i = 0; i < 25; i++) {
    stepPlayerController(
      player,
      { forward: 0, right: 0, jump: false, sprint: false, descend: true },
      [],
      1 / 60,
      { gravityEnabled: false, floorY: null }
    );
  }
  assert.ok(player.y < peakY - 0.5, 'Zero-G descend should lower altitude cleanly');

  // 4. Void-fall safety respawn back onto island overlook
  player.y = -21.5;
  player.vy = -12;
  stepPlayerController(player, { forward: 0, right: 0, jump: false, sprint: false }, [], 1 / 60, {
    gravityEnabled: true,
    floorY: null,
    voidRespawnY: -20,
  });
  assert.equal(player.respawnedThisStep, true);
  assert.ok(player.y >= player.spawnY, 'Player should safely respawn onto island overlook');
});

// ---------------------------------------------------------------------------
// 4. Model Library Category Grouping, Filtering & Search
// ---------------------------------------------------------------------------
test('libraryCategories filters, sorts, and groups models cleanly into ordered category sections', () => {
  const sampleModels: AvailableModelItem[] = [
    {
      id: 'repo:xbot-rig',
      slug: 'xbot-rig',
      name: 'Xbot Articulated Rig',
      source: 'specimen',
      format: '.glb',
      group: 'Characters',
      sizeBytes: 2936012,
      url: '/models/xbot.glb',
      previewUrl: '/models/previews/xbot.png',
      viewable: true,
      updatedAt: '2026-11-26T18:07:00.000Z',
    },
    {
      id: 'repo:michelle',
      slug: 'michelle',
      name: 'Michelle',
      source: 'specimen',
      format: '.glb',
      group: 'Female_Characters',
      sizeBytes: 3340928,
      url: '/models/michelle.glb',
      previewUrl: '/models/previews/michelle.png',
      viewable: true,
      updatedAt: '2026-11-26T18:10:00.000Z',
    },
    {
      id: 'repo:tactical-soldier',
      slug: 'tactical-soldier',
      name: 'Tactical Soldier',
      source: 'specimen',
      format: '.glb',
      group: 'Male_Characters',
      sizeBytes: 2160468,
      url: '/models/player-character.glb',
      previewUrl: '/models/previews/player-character.png',
      viewable: true,
      updatedAt: '2026-11-26T18:09:00.000Z',
    },
  ];

  const allGrouped = filterAndGroupLibraryModels(sampleModels, 'all', '', 'recent');
  assert.equal(allGrouped.flat.length, 3);
  assert.deepEqual(
    allGrouped.sections.map((s) => s.group),
    ['Female_Characters', 'Male_Characters', 'Characters'],
    'Categories should be ordered Female -> Male -> Stylized Characters'
  );
  assert.equal(getCategoryLabel('Female_Characters'), 'Female Characters');
  assert.equal(getCategoryLabel('Male_Characters'), 'Male Characters');

  const femaleOnly = filterAndGroupLibraryModels(sampleModels, 'Female_Characters', '', 'name');
  assert.equal(femaleOnly.flat.length, 1);
  assert.equal(femaleOnly.flat[0].slug, 'michelle');

  const searchMale = filterAndGroupLibraryModels(sampleModels, 'all', 'male', 'name');
  assert.equal(searchMale.flat.length, 2, 'Category label search should match Female and Male Characters');
});
