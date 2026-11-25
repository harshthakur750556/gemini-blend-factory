import * as THREE from 'three';
import type { WorldPrimitiveKind } from '../types';

/**
 * Creates Blender-inspired architectural & 3D world-building primitives, terrain,
 * water planes, architectural prefabs, lights, and Unreal/Unity UCX collision volumes.
 */
export function createWorldPrimitive(
  kind: WorldPrimitiveKind,
  indexSuffix: number
): THREE.Object3D {
  const stoneMat = new THREE.MeshStandardMaterial({
    name: `Atelier_Stone_${indexSuffix}`,
    color: '#9C968B',
    roughness: 0.72,
    metalness: 0.05,
  });

  switch (kind) {
    case 'cube': {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), stoneMat);
      mesh.name = `Cube_${indexSuffix}`;
      mesh.position.set(0, 0.35, 0);
      return mesh;
    }
    case 'sphere': {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 24), stoneMat);
      mesh.name = `UV_Sphere_${indexSuffix}`;
      mesh.position.set(0, 0.42, 0);
      return mesh;
    }
    case 'cylinder': {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.1, 28), stoneMat);
      mesh.name = `Pillar_Cylinder_${indexSuffix}`;
      mesh.position.set(0, 0.55, 0);
      return mesh;
    }
    case 'cone': {
      const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.95, 24), stoneMat);
      mesh.name = `Cone_${indexSuffix}`;
      mesh.position.set(0, 0.475, 0);
      return mesh;
    }
    case 'torus': {
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.12, 20, 42), stoneMat);
      mesh.name = `Torus_${indexSuffix}`;
      mesh.position.set(0, 0.5, 0);
      return mesh;
    }
    case 'plane': {
      const geo = new THREE.PlaneGeometry(4, 4, 8, 8);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshStandardMaterial({
        name: `Courtyard_Tile_${indexSuffix}`,
        color: '#D8D2C7',
        roughness: 0.85,
        metalness: 0.02,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = `Ground_Plane_${indexSuffix}`;
      mesh.position.set(0, 0.01, 0);
      return mesh;
    }
    case 'arch': {
      const group = new THREE.Group();
      group.name = `Architectural_Arch_${indexSuffix}`;
      const colGeo = new THREE.BoxGeometry(0.26, 1.35, 0.3);
      const left = new THREE.Mesh(colGeo, stoneMat);
      left.name = `Arch_Pillar_L_${indexSuffix}`;
      left.position.set(-0.56, 0.675, 0);
      const right = new THREE.Mesh(colGeo, stoneMat);
      right.name = `Arch_Pillar_R_${indexSuffix}`;
      right.position.set(0.56, 0.675, 0);
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.24, 0.36), stoneMat);
      lintel.name = `Arch_Lintel_${indexSuffix}`;
      lintel.position.set(0, 1.47, 0);
      const crown = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.12, 0.44), stoneMat);
      crown.name = `Arch_Cornice_${indexSuffix}`;
      crown.position.set(0, 1.65, 0);
      group.add(left, right, lintel, crown);
      return group;
    }
    case 'stairs': {
      const group = new THREE.Group();
      group.name = `Stone_Staircase_${indexSuffix}`;
      const steps = 6;
      for (let i = 0; i < steps; i++) {
        const h = (i + 1) * 0.16;
        const step = new THREE.Mesh(new THREE.BoxGeometry(1.1, h, 0.24), stoneMat);
        step.name = `Stair_Step_${i + 1}`;
        step.position.set(0, h / 2, -i * 0.24);
        group.add(step);
      }
      return group;
    }
    case 'terrain': {
      const geo = new THREE.PlaneGeometry(7.5, 7.5, 36, 36);
      geo.rotateX(-Math.PI / 2);
      const pos = geo.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const dist = Math.hypot(x, z);
        const ridge =
          Math.sin(x * 0.72) * Math.cos(z * 0.68) * 0.38 +
          Math.sin((x + z) * 1.15) * 0.14;
        const flatCenter = THREE.MathUtils.smoothstep(dist, 0.9, 2.5);
        pos.setY(i, Math.max(0, (ridge + 0.32) * flatCenter));
      }
      geo.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({
        name: `Sculpted_Terrain_${indexSuffix}`,
        color: '#8D957E',
        roughness: 0.92,
        metalness: 0.0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = `Terrain_Patch_${indexSuffix}`;
      return mesh;
    }
    case 'water': {
      const geo = new THREE.PlaneGeometry(4.5, 4.5, 16, 16);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshStandardMaterial({
        name: `Reflecting_Pool_${indexSuffix}`,
        color: '#4F7A74',
        roughness: 0.08,
        metalness: 0.22,
        transparent: true,
        opacity: 0.78,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = `Water_Plane_${indexSuffix}`;
      mesh.position.set(0, 0.04, 0);
      return mesh;
    }
    case 'point-light': {
      const group = new THREE.Group();
      group.name = `World_PointLight_${indexSuffix}`;
      group.position.set(0, 1.4, 0);
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 16, 12),
        new THREE.MeshStandardMaterial({
          name: `Lamp_Emitter_${indexSuffix}`,
          color: '#FFF5E0',
          emissive: new THREE.Color('#FFBE6B'),
          emissiveIntensity: 2.2,
          roughness: 0.2,
        })
      );
      bulb.name = `Light_Proxy_${indexSuffix}`;
      const light = new THREE.PointLight('#FFCE8A', 2.4, 8, 1.6);
      light.name = `Light_Emitter_${indexSuffix}`;
      group.add(bulb, light);
      return group;
    }
    case 'collider': {
      const mat = new THREE.MeshStandardMaterial({
        name: `UCX_Collider_Mat_${indexSuffix}`,
        color: '#2D5A4C',
        wireframe: true,
        transparent: true,
        opacity: 0.72,
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 1.1), mat);
      mesh.name = `UCX_Collision_${indexSuffix}`;
      mesh.position.set(0, 0.7, 0);
      return mesh;
    }
  }
}

/**
 * Generates an Array Modifier copy group for any selected 3D object along X/Y/Z offsets.
 */
export function buildArrayModifierClones(
  source: THREE.Object3D,
  count: number,
  offset: [number, number, number]
): THREE.Group {
  const safeCount = Math.max(1, Math.min(24, Math.round(count)));
  const group = new THREE.Group();
  group.name = `${source.name || 'Object'}_Array_${safeCount}x`;
  for (let i = 1; i < safeCount; i++) {
    const clone = source.clone(true);
    clone.name = `${source.name || 'Object'}_Arr_${i}`;
    clone.position.set(
      source.position.x + offset[0] * i,
      source.position.y + offset[1] * i,
      source.position.z + offset[2] * i
    );
    group.add(clone);
  }
  return group;
}

/**
 * Generates deterministic radial scatter instances around the world stage for level dressing.
 */
export function buildScatterInstances(
  source: THREE.Object3D,
  count: number,
  radius: number,
  seed = 104729
): THREE.Group {
  const safeCount = Math.max(1, Math.min(32, Math.round(count)));
  const safeRadius = Math.max(0.8, Math.min(12, radius));
  const group = new THREE.Group();
  group.name = `${source.name || 'Prop'}_Scatter_${safeCount}`;

  let s = Math.abs(Math.floor(seed)) || 1337;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  for (let i = 0; i < safeCount; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 0.7 + Math.sqrt(rand()) * safeRadius;
    const clone = source.clone(true);
    clone.name = `${source.name || 'Prop'}_Inst_${i + 1}`;
    clone.position.set(Math.cos(angle) * dist, source.position.y, Math.sin(angle) * dist);
    clone.rotation.y = rand() * Math.PI * 2;
    const scaleJitter = 0.8 + rand() * 0.4;
    clone.scale.multiplyScalar(scaleJitter);
    group.add(clone);
  }
  return group;
}

/**
 * Extracts canvas/image textures used by materials in a Three.js Object3D as PNG Blobs
 * so GitHub & Google Drive bundle backups include textures alongside the 3D mesh!
 */
export async function extractTexturesFromObject3D(
  root: THREE.Object3D
): Promise<Array<{ name: string; blob: Blob; base64: string }>> {
  const seen = new Set<string>();
  const outputs: Array<{ name: string; blob: Blob; base64: string }> = [];

  const toPng = async (tex: THREE.Texture, slotLabel: string, matName: string) => {
    if (!tex || seen.has(tex.uuid)) return;
    seen.add(tex.uuid);
    const img = tex.image as HTMLCanvasElement | HTMLImageElement | ImageBitmap | undefined;
    if (!img) return;

    const canvas = document.createElement('canvas');
    const w = ('width' in img && img.width) || 256;
    const h = ('height' in img && img.height) || 256;
    canvas.width = Math.min(1024, w);
    canvas.height = Math.min(1024, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    try {
      ctx.drawImage(img as CanvasImageSource, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1] || '';
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const safeMat = (matName || 'material').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 32);
      outputs.push({
        name: `${safeMat}_${slotLabel}.png`,
        blob,
        base64,
      });
    } catch {
      // Skip tainted cross-origin images safely
    }
  };

  const tasks: Array<Promise<void>> = [];
  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mats = Array.isArray((obj as THREE.Mesh).material)
      ? ((obj as THREE.Mesh).material as THREE.Material[])
      : [(obj as THREE.Mesh).material];
    for (const m of mats) {
      const std = m as THREE.MeshStandardMaterial;
      if (!std) continue;
      if (std.map) tasks.push(toPng(std.map, 'albedo', std.name));
      if (std.normalMap) tasks.push(toPng(std.normalMap, 'normal', std.name));
      if (std.roughnessMap) tasks.push(toPng(std.roughnessMap, 'roughness', std.name));
      if (std.metalnessMap) tasks.push(toPng(std.metalnessMap, 'metalness', std.name));
      if (std.bumpMap) tasks.push(toPng(std.bumpMap, 'bump', std.name));
      if (std.emissiveMap) tasks.push(toPng(std.emissiveMap, 'emissive', std.name));
      if (std.aoMap) tasks.push(toPng(std.aoMap, 'ao', std.name));
    }
  });

  await Promise.all(tasks);
  return outputs;
}
