import * as THREE from 'three';

export interface AabbCollider {
  id: string;
  name: string;
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
  isStatic: boolean;
  isWalkableSurface: boolean;
}

export interface RigidBodyState {
  uuid: string;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  halfExtents: { x: number; y: number; z: number };
  bottomOffset: number;
  isStatic: boolean;
  sleeping: boolean;
}

export interface TransformSnapshotItem {
  uuid: string;
  position: [number, number, number];
  quaternion: [number, number, number, number];
  scale: [number, number, number];
}

export interface PlayerControllerState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  facingYaw: number;
  radius: number;
  height: number;
  grounded: boolean;
  sprinting: boolean;
  walkCycle: number;
  coyoteTimer: number;
  jumpBufferTimer: number;
  spawnX: number;
  spawnY: number;
  spawnZ: number;
  respawnedThisStep?: boolean;
}

export interface PlayerInputState {
  forward: number; // -1..1
  right: number; // -1..1
  jump: boolean;
  descend?: boolean;
  sprint: boolean;
}

/**
 * Captures an exact pre-play or pre-physics transform snapshot of every child in a root group
 * so clicking Stop restores the scene cleanly without residue.
 */
export function captureSceneTransformSnapshot(root: THREE.Object3D): TransformSnapshotItem[] {
  const items: TransformSnapshotItem[] = [];
  root.traverse((obj) => {
    if (obj === root || obj.userData?.isEditorHelper || obj.userData?.isPlayModeAvatar) return;
    items.push({
      uuid: obj.uuid,
      position: [obj.position.x, obj.position.y, obj.position.z],
      quaternion: [obj.quaternion.x, obj.quaternion.y, obj.quaternion.z, obj.quaternion.w],
      scale: [obj.scale.x, obj.scale.y, obj.scale.z],
    });
  });
  return items;
}

export function restoreSceneTransformSnapshot(
  root: THREE.Object3D,
  snapshot: TransformSnapshotItem[]
): number {
  const byId = new Map<string, TransformSnapshotItem>();
  for (const s of snapshot) byId.set(s.uuid, s);
  let restored = 0;
  root.traverse((obj) => {
    const item = byId.get(obj.uuid);
    if (!item) return;
    obj.position.set(item.position[0], item.position[1], item.position[2]);
    obj.quaternion.set(item.quaternion[0], item.quaternion[1], item.quaternion[2], item.quaternion[3]);
    obj.scale.set(item.scale[0], item.scale[1], item.scale[2]);
    obj.updateMatrixWorld(true);
    restored++;
  });
  return restored;
}

/**
 * Collects walkable & solid scene meshes for accurate raycast surface grounding in Play Mode.
 */
export function collectWalkableMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    if (!obj.visible) return;
    if (
      obj.userData?.isEditorHelper ||
      obj.userData?.isPlayModeAvatar ||
      obj.userData?.noCollision ||
      obj.userData?.isColliderOverlay ||
      obj.userData?.isScenicTraveler
    ) {
      return;
    }
    const lower = (obj.name || '').toLowerCase();
    if (
      lower.includes('skydome') ||
      lower.includes('sky_sphere') ||
      lower.includes('cloud') ||
      lower.includes('halo') ||
      lower.includes('aura') ||
      lower.includes('grass_blade') ||
      lower.includes('wildflower') ||
      lower.includes('mountain') ||
      lower.includes('water_mist') ||
      lower.startsWith('ucx_')
    ) {
      return;
    }
    meshes.push(obj as THREE.Mesh);
  });
  return meshes;
}

/**
 * Extracts world-space AABB colliders from scene meshes (including UCX_ explicit colliders,
 * terrain platforms, architectural floors, and props) while skipping helpers and transparent sky domes.
 */
export function collectWorldColliders(root: THREE.Object3D): AabbCollider[] {
  const colliders: AabbCollider[] = [];
  const box = new THREE.Box3();
  const size = new THREE.Vector3();

  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    if (!obj.visible) return;
    if (
      obj.userData?.isEditorHelper ||
      obj.userData?.isPlayModeAvatar ||
      obj.userData?.noCollision ||
      obj.userData?.isScenicTraveler
    ) {
      return;
    }

    const lower = (obj.name || '').toLowerCase();
    if (
      lower.includes('skydome') ||
      lower.includes('sky_sphere') ||
      lower.includes('cloud') ||
      lower.includes('halo') ||
      lower.includes('aura') ||
      lower.includes('grass_blade') ||
      lower.includes('wildflower') ||
      lower.includes('mountain') ||
      lower.includes('water_mist')
    ) {
      return;
    }

    box.setFromObject(obj);
    if (box.isEmpty()) return;
    box.getSize(size);
    if (size.x < 0.04 && size.y < 0.04 && size.z < 0.04) return;

    const isStatic =
      Boolean(obj.userData?.isTerrain) ||
      Boolean(obj.userData?.isStaticCollider) ||
      lower.startsWith('ucx_') ||
      lower.includes('terrain') ||
      lower.includes('ground') ||
      lower.includes('cliff') ||
      lower.includes('island') ||
      lower.includes('meadow') ||
      lower.includes('floor') ||
      lower.includes('platform') ||
      lower.includes('bridge') ||
      lower.includes('step') ||
      lower.includes('stair');

    colliders.push({
      id: obj.uuid,
      name: obj.name || 'Mesh',
      minX: box.min.x,
      minY: box.min.y,
      minZ: box.min.z,
      maxX: box.max.x,
      maxY: box.max.y,
      maxZ: box.max.z,
      isStatic,
      isWalkableSurface: size.x >= 0.4 && size.z >= 0.4,
    });
  });

  return colliders;
}

/**
 * Steps rigid-body physics for dynamic objects under gravity with AABB stacking & floor/surface collision.
 * Pure math function so it can be deterministically unit-tested without WebGL.
 */
export function stepRigidBodies(
  bodies: RigidBodyState[],
  staticColliders: AabbCollider[],
  dt: number,
  options?: { gravity?: number; floorY?: number | null; restitution?: number }
): void {
  const safeDt = Math.max(0.001, Math.min(0.05, dt));
  const gravity = options?.gravity ?? 9.81;
  const floorY = options?.floorY ?? null;
  const restitution = options?.restitution ?? 0.16;

  // Build sorted list of dynamic bodies (lowest first so stacking settles cleanly)
  const dynamicIndices = bodies
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => !b.isStatic)
    .sort((a, b) => a.b.position.y - b.b.position.y);

  for (const { b } of dynamicIndices) {
    if (b.sleeping) continue;

    b.velocity.y -= gravity * safeDt;
    // Clamp terminal velocity for numerical stability
    b.velocity.y = Math.max(-36, Math.min(36, b.velocity.y));

    const prevBottom = b.position.y - b.bottomOffset;
    const nextY = b.position.y + b.velocity.y * safeDt;
    const nextBottom = nextY - b.bottomOffset;
    let landed = false;

    const minX = b.position.x - b.halfExtents.x;
    const maxX = b.position.x + b.halfExtents.x;
    const minZ = b.position.z - b.halfExtents.z;
    const maxZ = b.position.z + b.halfExtents.z;

    let highestSupportY = floorY !== null ? floorY : -Infinity;

    // Check static world colliders
    for (const col of staticColliders) {
      if (col.id === b.uuid) continue;
      if (maxX <= col.minX || minX >= col.maxX || maxZ <= col.minZ || minZ >= col.maxZ) continue;
      if (prevBottom >= col.maxY - 0.22 && nextBottom <= col.maxY) {
        if (col.maxY > highestSupportY) {
          highestSupportY = col.maxY;
        }
      }
    }

    // Check other bodies below for rigid-body stacking
    for (const other of bodies) {
      if (other.uuid === b.uuid) continue;
      const oMinX = other.position.x - other.halfExtents.x;
      const oMaxX = other.position.x + other.halfExtents.x;
      const oMinZ = other.position.z - other.halfExtents.z;
      const oMaxZ = other.position.z + other.halfExtents.z;
      if (maxX <= oMinX || minX >= oMaxX || maxZ <= oMinZ || minZ >= oMaxZ) continue;
      const otherTop = other.position.y - other.bottomOffset + other.halfExtents.y * 2;
      if (prevBottom >= otherTop - 0.22 && nextBottom <= otherTop) {
        if (otherTop > highestSupportY) {
          highestSupportY = otherTop;
        }
      }
    }

    if (nextBottom <= highestSupportY) {
      b.position.y = highestSupportY + b.bottomOffset;
      if (Math.abs(b.velocity.y) < 0.35) {
        b.velocity.y = 0;
        landed = true;
      } else {
        b.velocity.y = -b.velocity.y * restitution;
      }
      b.velocity.x *= 0.82;
      b.velocity.z *= 0.82;
    } else {
      b.position.y = nextY;
    }

    b.position.x += b.velocity.x * safeDt;
    b.position.z += b.velocity.z * safeDt;

    if (landed && Math.hypot(b.velocity.x, b.velocity.z) < 0.02) {
      b.velocity.x = 0;
      b.velocity.z = 0;
      b.sleeping = true;
    }
  }
}

export function createPlayerState(spawn: { x: number; y: number; z: number; yaw?: number }): PlayerControllerState {
  const yaw = spawn.yaw ?? 0;
  return {
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw,
    pitch: -0.14,
    facingYaw: yaw,
    radius: 0.32,
    height: 1.72,
    grounded: false,
    sprinting: false,
    walkCycle: 0,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    spawnX: spawn.x,
    spawnY: spawn.y,
    spawnZ: spawn.z,
    respawnedThisStep: false,
  };
}

/**
 * Finds a clean, unobstructed spawn position on a walkable surface or at the stage origin
 * so the Play Mode player spawns standing firmly on the world rather than trapped inside a wall.
 */
export function findSafePlayerSpawn(
  colliders: AabbCollider[],
  preferred?: { x: number; y: number; z: number },
  sampleSurfaceY?: (x: number, z: number, refY: number) => number | null
): { x: number; y: number; z: number } {
  const base = preferred ?? { x: 0, y: 0.05, z: 2.2 };

  if (sampleSurfaceY) {
    const exactY = sampleSurfaceY(base.x, base.z, base.y + 3.0);
    if (exactY !== null) {
      return { x: base.x, y: exactY + 0.02, z: base.z };
    }
  }

  let bestTopY: number | null = null;
  for (const c of colliders) {
    if (!c.isWalkableSurface) continue;
    if (base.x >= c.minX + 0.25 && base.x <= c.maxX - 0.25 && base.z >= c.minZ + 0.25 && base.z <= c.maxZ - 0.25) {
      if (bestTopY === null || c.maxY > bestTopY) {
        bestTopY = c.maxY;
      }
    }
  }
  if (bestTopY !== null) {
    return { x: base.x, y: bestTopY + 0.04, z: base.z };
  }
  return { x: base.x, y: Math.max(0.04, base.y), z: base.z };
}

/**
 * Shortest signed angle difference between two yaw angles in radians (-PI..PI).
 */
function lerpAngle(current: number, target: number, alpha: number): number {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * alpha;
}

/**
 * Steps the Unity/Unreal-style Play Mode player controller with refined gravity,
 * coyote time, jump buffering, Zero-G sky flight (ascend/descend), accurate mesh surface
 * grounding, step-up climbing, AABB obstacle collision, and safe void respawn.
 */
export function stepPlayerController(
  player: PlayerControllerState,
  input: PlayerInputState,
  colliders: AabbCollider[],
  dt: number,
  options?: {
    gravityEnabled?: boolean;
    gravityStrength?: number;
    floorY?: number | null;
    voidRespawnY?: number;
    sampleTerrainY?: (x: number, z: number) => number | null;
    sampleSurfaceY?: (x: number, z: number, fromY: number) => number | null;
  }
): PlayerControllerState {
  const safeDt = Math.max(0.001, Math.min(0.05, dt));
  const gravityEnabled = options?.gravityEnabled ?? true;
  // Scale gravity sensibly so real-world 9.81 m/s² feels responsive and snappy in 3D space
  const rawG = options?.gravityStrength ?? 9.81;
  const effectiveGravity = gravityEnabled ? Math.max(1.2, rawG * 1.55) : 0;
  const walkSpeed = 4.6;
  const sprintSpeed = 8.2;
  const flySpeed = input.sprint ? 11.5 : 6.5;
  const jumpVelocity = Math.sqrt(2 * Math.max(4.5, effectiveGravity) * 1.65); // ~1.65m jump height scaled to gravity
  const maxStepHeight = 0.55;
  const voidRespawnY = options?.voidRespawnY ?? -20;

  player.respawnedThisStep = false;

  const moveSpeed = gravityEnabled ? (input.sprint ? sprintSpeed : walkSpeed) : flySpeed;
  player.sprinting = Boolean(input.sprint && (Math.abs(input.forward) > 0.05 || Math.abs(input.right) > 0.05));

  // Camera-relative horizontal movement vectors (Three.js right-handed Y-up)
  const sinY = Math.sin(player.yaw);
  const cosY = Math.cos(player.yaw);
  const fwdX = -sinY;
  const fwdZ = -cosY;
  const rightX = cosY;
  const rightZ = -sinY;

  let wishX = fwdX * input.forward + rightX * input.right;
  let wishZ = fwdZ * input.forward + rightZ * input.right;
  const wishLen = Math.hypot(wishX, wishZ);
  if (wishLen > 1e-4) {
    wishX /= wishLen;
    wishZ /= wishLen;
    const targetFacing = Math.atan2(wishX, wishZ);
    player.facingYaw = lerpAngle(player.facingYaw, targetFacing, Math.min(1, 14 * safeDt));
    player.walkCycle += safeDt * (player.sprinting ? 12.5 : 7.8);
  }

  // Smooth horizontal acceleration (crisp on ground, controllable in air / Zero-G)
  const accel = !gravityEnabled ? 9.5 : player.grounded ? 18 : 6.5;
  const targetVx = wishX * moveSpeed;
  const targetVz = wishZ * moveSpeed;
  player.vx += (targetVx - player.vx) * Math.min(1, accel * safeDt);
  player.vz += (targetVz - player.vz) * Math.min(1, accel * safeDt);

  // Coyote time & jump buffer for responsive platforming off floating islands
  if (player.grounded) {
    player.coyoteTimer = 0.14;
  } else {
    player.coyoteTimer = Math.max(0, (player.coyoteTimer ?? 0) - safeDt);
  }

  if (input.jump) {
    player.jumpBufferTimer = 0.12;
  } else {
    player.jumpBufferTimer = Math.max(0, (player.jumpBufferTimer ?? 0) - safeDt);
  }

  if (gravityEnabled) {
    if (player.jumpBufferTimer > 0 && player.coyoteTimer > 0) {
      player.vy = jumpVelocity;
      player.grounded = false;
      player.coyoteTimer = 0;
      player.jumpBufferTimer = 0;
    }
    player.vy = Math.max(-28, player.vy - effectiveGravity * safeDt);
  } else {
    // Zero-G Sky Flight: Space ascends, Shift/C/descend descends smoothly
    const verticalWish = (input.jump ? 1 : 0) - (input.descend ? 1 : 0);
    const targetVy = verticalWish * (input.sprint ? 7.2 : 4.8);
    player.vy += (targetVy - player.vy) * Math.min(1, 9 * safeDt);
    player.grounded = false;
  }

  // Proposed horizontal move with AABB wall push-out & step-up
  let nextX = player.x + player.vx * safeDt;
  let nextZ = player.z + player.vz * safeDt;
  const feetY = player.y;
  const headY = player.y + player.height;
  const r = player.radius;

  for (const col of colliders) {
    // Ignore walkable ground plates or low steps when checking side walls
    if (headY <= col.minY + 0.08 || feetY >= col.maxY - maxStepHeight) continue;
    // Skip very large sculpted cliff bodies from AABB wall blocking when mesh raycast handles them
    if (options?.sampleSurfaceY && col.isStatic && col.maxX - col.minX > 3.0 && col.maxZ - col.minZ > 3.0) {
      continue;
    }

    const closestX = Math.max(col.minX, Math.min(nextX, col.maxX));
    const closestZ = Math.max(col.minZ, Math.min(nextZ, col.maxZ));
    const dx = nextX - closestX;
    const dz = nextZ - closestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < r * r) {
      const dist = Math.sqrt(distSq);
      if (dist > 1e-5) {
        const push = r - dist;
        nextX += (dx / dist) * push;
        nextZ += (dz / dist) * push;
      } else {
        const penLeft = Math.abs(nextX - col.minX);
        const penRight = Math.abs(col.maxX - nextX);
        const penBack = Math.abs(nextZ - col.minZ);
        const penFront = Math.abs(col.maxZ - nextZ);
        const minPen = Math.min(penLeft, penRight, penBack, penFront);
        if (minPen === penLeft) nextX = col.minX - r;
        else if (minPen === penRight) nextX = col.maxX + r;
        else if (minPen === penBack) nextZ = col.minZ - r;
        else nextZ = col.maxZ + r;
      }
    }
  }

  player.x = nextX;
  player.z = nextZ;

  // Vertical integration & exact mesh / terrain / AABB ground support detection
  const nextY = player.y + player.vy * safeDt;
  let supportY = options?.floorY !== undefined && options.floorY !== null ? options.floorY : -Infinity;

  // 1. Exact downward raycast against real 3D island/bridge/cliff meshes
  let meshSurfaceFound = false;
  if (options?.sampleSurfaceY) {
    const sy = options.sampleSurfaceY(player.x, player.z, player.y + maxStepHeight + 0.45);
    if (sy !== null && sy <= player.y + maxStepHeight + 0.2 && sy > supportY) {
      supportY = sy;
      meshSurfaceFound = true;
    }
  }

  // 2. Heightmap terrain fallback
  if (options?.sampleTerrainY) {
    const ty = options.sampleTerrainY(player.x, player.z);
    if (ty !== null && ty <= player.y + maxStepHeight + 0.2 && ty > supportY) {
      supportY = ty;
    }
  }

  // 3. AABB colliders (only when mesh raycast isn't provided, or for dynamic/UCX platforms)
  if (!options?.sampleSurfaceY || !meshSurfaceFound) {
    for (const col of colliders) {
      if (options?.sampleSurfaceY && col.isStatic && col.maxX - col.minX > 3.0) continue;
      if (
        player.x + r * 0.72 > col.minX &&
        player.x - r * 0.72 < col.maxX &&
        player.z + r * 0.72 > col.minZ &&
        player.z - r * 0.72 < col.maxZ
      ) {
        if (player.y >= col.maxY - maxStepHeight - 0.1 && col.maxY > supportY) {
          supportY = col.maxY;
        }
      }
    }
  }

  // Snap cleanly to ground when walking downhill or landing
  const snapDownEpsilon = player.grounded && gravityEnabled && player.vy <= 0.05 ? 0.24 : 0.04;
  if (gravityEnabled && supportY > -Infinity && nextY <= supportY + snapDownEpsilon && player.vy <= 0.1) {
    player.y = supportY;
    player.vy = 0;
    player.grounded = true;
  } else if (!gravityEnabled && supportY > -Infinity && nextY < supportY) {
    player.y = supportY;
    player.vy = Math.max(0, player.vy);
    player.grounded = true;
  } else {
    player.y = nextY;
    player.grounded = false;
  }

  // Safety respawn onto island overlook if player falls into the sky abyss
  if (player.y < voidRespawnY) {
    player.x = player.spawnX;
    player.y = Math.max(player.spawnY + 0.45, supportY > voidRespawnY ? supportY + 0.8 : 0.5);
    player.z = player.spawnZ;
    player.vx = 0;
    player.vy = 0;
    player.vz = 0;
    player.grounded = false;
    player.respawnedThisStep = true;
  }

  return player;
}

/**
 * Builds an articulated stylized explorer avatar fallback for Play Mode
 * (used momentarily while /models/player-character.glb loads or if offline).
 */
export function createPlayerAvatarMesh(): THREE.Group {
  const root = new THREE.Group();
  root.name = '__PlayModeAvatar';
  root.userData.isPlayModeAvatar = true;
  root.userData.isEditorHelper = true;

  const coatMat = new THREE.MeshStandardMaterial({
    color: '#1E2C3E',
    roughness: 0.72,
    metalness: 0.08,
  });
  const scarfMat = new THREE.MeshStandardMaterial({
    color: '#25678C',
    emissive: '#144466',
    emissiveIntensity: 0.35,
    roughness: 0.52,
    metalness: 0.06,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: '#5CE6FF',
    emissive: '#1F9CC4',
    emissiveIntensity: 0.85,
    roughness: 0.32,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: '#E7C8B1',
    roughness: 0.65,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: '#232024',
    roughness: 0.8,
  });

  // Left & Right Legs (pivoted at hips)
  const leftLegPivot = new THREE.Group();
  leftLegPivot.name = 'LeftLegPivot';
  leftLegPivot.position.set(-0.11, 0.7, 0);
  const legGeo = new THREE.CapsuleGeometry(0.075, 0.46, 6, 10);
  const leftLeg = new THREE.Mesh(legGeo, bootMat);
  leftLeg.position.y = -0.31;
  leftLeg.castShadow = true;
  leftLegPivot.add(leftLeg);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.name = 'RightLegPivot';
  rightLegPivot.position.set(0.11, 0.7, 0);
  const rightLeg = new THREE.Mesh(legGeo, bootMat);
  rightLeg.position.y = -0.31;
  rightLeg.castShadow = true;
  rightLegPivot.add(rightLeg);

  // Torso & Tunic
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.21, 0.58, 12), coatMat);
  torso.position.y = 1.0;
  torso.castShadow = true;

  // Flowing Explorer Cape
  const cape = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.76, 10, 1, true), scarfMat);
  cape.position.set(0, 0.94, -0.11);
  cape.rotation.x = 0.26;
  cape.scale.set(0.95, 1, 0.52);
  cape.castShadow = true;

  // Glowing Shoulder Collar
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 8, 16), trimMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.28;

  // Arms
  const leftArmPivot = new THREE.Group();
  leftArmPivot.name = 'LeftArmPivot';
  leftArmPivot.position.set(-0.23, 1.22, 0);
  const armGeo = new THREE.CapsuleGeometry(0.06, 0.38, 6, 8);
  const leftArm = new THREE.Mesh(armGeo, coatMat);
  leftArm.position.y = -0.21;
  leftArm.castShadow = true;
  leftArmPivot.add(leftArm);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.name = 'RightArmPivot';
  rightArmPivot.position.set(0.23, 1.22, 0);
  const rightArm = new THREE.Mesh(armGeo, coatMat);
  rightArm.position.y = -0.21;
  rightArm.castShadow = true;
  rightArmPivot.add(rightArm);

  // Head & Hair
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 14), skinMat);
  head.position.y = 1.48;
  head.castShadow = true;

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.172, 16, 14, 0, Math.PI * 2, 0, Math.PI * 0.68),
    new THREE.MeshStandardMaterial({ color: '#1B202C', roughness: 0.78 })
  );
  hair.position.set(0, 1.5, -0.02);
  hair.castShadow = true;

  // Subtle ground contact shadow disc beneath feet
  const footShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.36, 18),
    new THREE.MeshBasicMaterial({
      color: '#0B1826',
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    })
  );
  footShadow.rotation.x = -Math.PI / 2;
  footShadow.position.y = 0.015;
  footShadow.name = 'AvatarContactShadow';

  root.add(leftLegPivot, rightLegPivot, torso, cape, collar, leftArmPivot, rightArmPivot, head, hair, footShadow);
  root.traverse((c) => {
    c.userData.isPlayModeAvatar = true;
    c.userData.isEditorHelper = true;
  });
  return root;
}

export function animatePlayerAvatar(avatar: THREE.Group, player: PlayerControllerState): void {
  avatar.position.set(player.x, player.y, player.z);
  avatar.rotation.y = player.facingYaw;

  // If this is the GLB skinned character, animation is driven by THREE.AnimationMixer in StudioViewport
  if (avatar.userData?.isGlbPlayerCharacter) {
    return;
  }

  const speed = Math.hypot(player.vx, player.vz);
  const swing = player.grounded ? Math.sin(player.walkCycle) * Math.min(0.68, speed * 0.14) : 0.35;

  const leftLeg = avatar.getObjectByName('LeftLegPivot');
  const rightLeg = avatar.getObjectByName('RightLegPivot');
  const leftArm = avatar.getObjectByName('LeftArmPivot');
  const rightArm = avatar.getObjectByName('RightArmPivot');

  if (leftLeg) leftLeg.rotation.x = swing;
  if (rightLeg) rightLeg.rotation.x = -swing;
  if (leftArm) leftArm.rotation.x = -swing * 0.75;
  if (rightArm) rightArm.rotation.x = swing * 0.75;
}
