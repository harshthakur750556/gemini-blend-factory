import * as THREE from 'three';
import type { TerrainBrushMode, TerrainPaintLayer } from '../types';

export const TERRAIN_PAINT_PALETTE: Record<
  TerrainPaintLayer,
  { label: string; hex: string; rgb: [number, number, number] }
> = {
  grass: { label: 'Meadow Grass', hex: '#5F8448', rgb: [0.115, 0.232, 0.068] },
  moss: { label: 'Emerald Moss', hex: '#3D6E49', rgb: [0.052, 0.162, 0.072] },
  basalt: { label: 'Basalt Rock', hex: '#545B66', rgb: [0.092, 0.108, 0.135] },
  sand: { label: 'Warm Sand', hex: '#C6B083', rgb: [0.565, 0.435, 0.228] },
  snow: { label: 'Alpine Snow', hex: '#E4EAF0', rgb: [0.88, 0.91, 0.94] },
  cave_dirt: { label: 'Cave Earth', hex: '#4B3C31', rgb: [0.074, 0.048, 0.032] },
};

export interface TerrainGeometrySnapshot {
  positions: Float32Array;
  colors: Float32Array | null;
}

/**
 * Generates a tileable procedural bump texture for terrain surfaces so sculpted hills,
 * caves, and painted ground layers retain crisp micro-relief.
 */
export function createTerrainDetailBumpTexture(size = 128): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const img = ctx.createImageData(size, size);
  let seed = 4219;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const wave =
        Math.sin((x / size) * Math.PI * 6) * Math.cos((y / size) * Math.PI * 6) * 28 +
        Math.sin(((x + y) / size) * Math.PI * 10) * 18;
      const grain = (rand() - 0.5) * 44;
      const v = Math.max(0, Math.min(255, Math.round(128 + wave + grain)));
      img.data[idx] = v;
      img.data[idx + 1] = v;
      img.data[idx + 2] = v;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Ensures a terrain BufferGeometry has a mutable RGB vertex color attribute
 * initialized from height/slope so multi-layer painting blends smoothly.
 */
export function ensureTerrainVertexColors(geometry: THREE.BufferGeometry): THREE.BufferAttribute {
  const existing = geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  if (existing && existing.count === pos.count) {
    return existing;
  }

  const colors = new Float32Array(pos.count * 3);
  const grass = TERRAIN_PAINT_PALETTE.grass.rgb;
  const basalt = TERRAIN_PAINT_PALETTE.basalt.rgb;
  const cave = TERRAIN_PAINT_PALETTE.cave_dirt.rgb;

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    let rgb = grass;
    if (y < -0.25) rgb = cave;
    else if (y > 1.8) rgb = basalt;
    colors[i * 3] = rgb[0];
    colors[i * 3 + 1] = rgb[1];
    colors[i * 3 + 2] = rgb[2];
  }
  const attr = new THREE.BufferAttribute(colors, 3);
  geometry.setAttribute('color', attr);
  return attr;
}

/**
 * Builds an unbounded open-world sculptable terrain mesh with vertex colors,
 * supporting elevation sculpting both above (Y > 0) and below (Y < 0) the grid plane.
 */
export function createOpenWorldTerrainMesh(
  indexSuffix: number,
  options?: { size?: number; segments?: number; includeBasin?: boolean }
): THREE.Mesh {
  const size = options?.size ?? 32;
  const segments = options?.segments ?? 64;
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const dist = Math.hypot(x, z);
    const ridge =
      Math.sin(x * 0.24) * Math.cos(z * 0.22) * 1.15 +
      Math.sin((x + z) * 0.42) * 0.35 +
      Math.cos((x - z) * 0.14) * 0.65;
    const flatCenter = THREE.MathUtils.smoothstep(dist, 2.2, 7.5);
    let y = ridge * flatCenter;
    if (options?.includeBasin && x < -4 && z > 3) {
      // Subtle subterranean valley / canyon dip demonstrating Y < 0 support
      const basinDist = Math.hypot(x + 7.5, z - 6.5);
      if (basinDist < 5.5) {
        const t = 1 - basinDist / 5.5;
        y -= t * t * 2.4;
      }
    }
    pos.setY(i, y);
  }
  geo.computeVertexNormals();
  ensureTerrainVertexColors(geo);

  const bump = createTerrainDetailBumpTexture(128);
  const mat = new THREE.MeshStandardMaterial({
    name: `OpenWorld_Terrain_Mat_${indexSuffix}`,
    color: '#FFFFFF',
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.02,
    bumpMap: bump,
    bumpScale: 0.045,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = `Terrain_Patch_${indexSuffix}`;
  mesh.userData.isTerrain = true;
  mesh.userData.terrainSize = size;
  mesh.userData.terrainSegments = segments;
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}

export function captureTerrainSnapshot(mesh: THREE.Mesh): TerrainGeometrySnapshot {
  const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  const col = mesh.geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
  return {
    positions: new Float32Array(pos.array as Float32Array),
    colors: col ? new Float32Array(col.array as Float32Array) : null,
  };
}

export function restoreTerrainSnapshot(mesh: THREE.Mesh, snap: TerrainGeometrySnapshot): void {
  const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (pos && pos.array.length === snap.positions.length) {
    (pos.array as Float32Array).set(snap.positions);
    pos.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
  }
  if (snap.colors) {
    const col = ensureTerrainVertexColors(mesh.geometry);
    if (col.array.length === snap.colors.length) {
      (col.array as Float32Array).set(snap.colors);
      col.needsUpdate = true;
    }
  }
}

function deterministicHash2D(x: number, z: number): number {
  const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return h - Math.floor(h);
}

/**
 * Applies a terrain heightmap sculpt brush directly to a terrain Mesh's vertices.
 * Allows unrestricted negative Y (< 0) carving for caves, rivers, canyons, and underwater floors.
 * Returns the number of modified vertices.
 */
export function applyTerrainSculptBrush(
  mesh: THREE.Mesh,
  worldHitPoint: THREE.Vector3,
  options: {
    mode: TerrainBrushMode;
    radius: number;
    strength: number;
    flattenTargetY?: number;
  }
): number {
  const geo = mesh.geometry as THREE.BufferGeometry;
  const pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!pos) return 0;

  mesh.updateMatrixWorld(true);
  const invMatrix = mesh.matrixWorld.clone().invert();
  const localHit = worldHitPoint.clone().applyMatrix4(invMatrix);

  const safeRadius = Math.max(0.2, options.radius);
  const safeStrength = Math.max(0.01, Math.min(3.0, options.strength));
  const targetY = options.flattenTargetY ?? localHit.y;

  // Gather impacted indices and average height for smooth brush
  const impacted: Array<{ idx: number; falloff: number }> = [];
  let sumY = 0;
  let weightSum = 0;

  for (let i = 0; i < pos.count; i++) {
    const dx = pos.getX(i) - localHit.x;
    const dz = pos.getZ(i) - localHit.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= safeRadius) {
      const normalized = 1 - dist / safeRadius;
      // Smooth cubic falloff
      const falloff = normalized * normalized * (3 - 2 * normalized);
      impacted.push({ idx: i, falloff });
      sumY += pos.getY(i) * falloff;
      weightSum += falloff;
    }
  }

  if (impacted.length === 0) return 0;
  const avgY = weightSum > 1e-6 ? sumY / weightSum : localHit.y;

  for (const { idx, falloff } of impacted) {
    const curY = pos.getY(idx);
    let nextY = curY;

    switch (options.mode) {
      case 'raise':
        nextY = curY + falloff * safeStrength * 0.42;
        break;
      case 'lower':
        // Explicitly unbounded below Y = 0 for caves/canyons/underwater basins
        nextY = curY - falloff * safeStrength * 0.42;
        break;
      case 'smooth':
        nextY = THREE.MathUtils.lerp(curY, avgY, Math.min(0.85, falloff * safeStrength * 0.65));
        break;
      case 'flatten':
        nextY = THREE.MathUtils.lerp(curY, targetY, Math.min(0.9, falloff * safeStrength * 0.72));
        break;
      case 'noise': {
        const n = (deterministicHash2D(pos.getX(idx) * 2.1 + curY, pos.getZ(idx) * 2.1) - 0.5) * 2;
        nextY = curY + n * falloff * safeStrength * 0.35;
        break;
      }
    }

    // Generous open-world vertical bounds [-120, +240]
    pos.setY(idx, Math.max(-120, Math.min(240, nextY)));
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return impacted.length;
}

/**
 * Multi-layer vertex-color ground texture painter for sculpted terrains.
 * Automatically enables vertexColors on the target mesh material.
 */
export function applyTerrainPaintBrush(
  mesh: THREE.Mesh,
  worldHitPoint: THREE.Vector3,
  options: {
    layer: TerrainPaintLayer;
    radius: number;
    strength: number;
  }
): number {
  const geo = mesh.geometry as THREE.BufferGeometry;
  const pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!pos) return 0;

  const col = ensureTerrainVertexColors(geo);
  const mat = mesh.material as THREE.MeshStandardMaterial;
  if (mat && !mat.vertexColors) {
    mat.vertexColors = true;
    mat.color.set('#FFFFFF');
    mat.needsUpdate = true;
  }

  mesh.updateMatrixWorld(true);
  const invMatrix = mesh.matrixWorld.clone().invert();
  const localHit = worldHitPoint.clone().applyMatrix4(invMatrix);

  const safeRadius = Math.max(0.2, options.radius);
  const safeStrength = Math.max(0.05, Math.min(1.0, options.strength));
  const targetRgb = TERRAIN_PAINT_PALETTE[options.layer].rgb;

  let touched = 0;
  for (let i = 0; i < pos.count; i++) {
    const dx = pos.getX(i) - localHit.x;
    const dz = pos.getZ(i) - localHit.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= safeRadius) {
      const n = 1 - dist / safeRadius;
      const blend = Math.min(1, n * n * (3 - 2 * n) * safeStrength);
      const r = THREE.MathUtils.lerp(col.getX(i), targetRgb[0], blend);
      const g = THREE.MathUtils.lerp(col.getY(i), targetRgb[1], blend);
      const b = THREE.MathUtils.lerp(col.getZ(i), targetRgb[2], blend);
      col.setXYZ(i, r, g, b);
      touched++;
    }
  }

  if (touched > 0) {
    col.needsUpdate = true;
  }
  return touched;
}

/**
 * Samples the approximate world-space Y height of a terrain mesh at (worldX, worldZ)
 * using nearest vertex interpolation for fast physics/player traversal without raycast overhead.
 */
export function sampleTerrainHeightAt(
  mesh: THREE.Mesh,
  worldX: number,
  worldZ: number
): number | null {
  const geo = mesh.geometry as THREE.BufferGeometry;
  const pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!pos || pos.count === 0) return null;

  mesh.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(mesh);
  if (worldX < box.min.x - 0.5 || worldX > box.max.x + 0.5 || worldZ < box.min.z - 0.5 || worldZ > box.max.z + 0.5) {
    return null;
  }

  const invMatrix = mesh.matrixWorld.clone().invert();
  const localQuery = new THREE.Vector3(worldX, 0, worldZ).applyMatrix4(invMatrix);

  let bestDistSq = Infinity;
  let bestLocalY = 0;
  for (let i = 0; i < pos.count; i++) {
    const dx = pos.getX(i) - localQuery.x;
    const dz = pos.getZ(i) - localQuery.z;
    const dSq = dx * dx + dz * dz;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestLocalY = pos.getY(i);
    }
  }

  const worldSample = new THREE.Vector3(localQuery.x, bestLocalY, localQuery.z).applyMatrix4(mesh.matrixWorld);
  return worldSample.y;
}
