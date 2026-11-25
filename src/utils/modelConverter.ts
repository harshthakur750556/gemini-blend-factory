import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import { AMFLoader } from 'three/examples/jsm/loaders/AMFLoader.js';
import { exportObject3DToBlob, type ExportFormatId } from './modelExporters';

export type AxisConversionMode = 'preserve' | 'z-up-to-y-up' | 'y-up-to-z-up';

export interface ParsedModelSummary {
  group: THREE.Group;
  sourceFileName: string;
  sourceExt: string;
  meshCount: number;
  vertexCount: number;
  triangleCount: number;
  boundsSize: [number, number, number];
}

function defaultClayMaterial(name = 'Imported_Material_BSDF'): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    name,
    color: '#8C867C',
    roughness: 0.56,
    metalness: 0.08,
  });
}

/**
 * Pure parser for Geomview OFF (.off) polygon meshes.
 */
export function parseOffToGeometry(text: string): THREE.BufferGeometry {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*/, '').trim())
    .filter(Boolean);
  let idx = 0;
  if (lines[0]?.toUpperCase().startsWith('OFF')) {
    const rest = lines[0].slice(3).trim();
    if (rest) {
      lines[0] = rest;
    } else {
      idx = 1;
    }
  }
  const counts = (lines[idx++] || '').split(/\s+/).map(Number);
  const vCount = counts[0] || 0;
  const fCount = counts[1] || 0;

  const verts: number[] = [];
  for (let i = 0; i < vCount && idx < lines.length; i++, idx++) {
    const parts = lines[idx].split(/\s+/).map(Number);
    verts.push(parts[0] || 0, parts[1] || 0, parts[2] || 0);
  }

  const indices: number[] = [];
  for (let i = 0; i < fCount && idx < lines.length; i++, idx++) {
    const parts = lines[idx].split(/\s+/).map(Number);
    const n = parts[0] || 0;
    if (n >= 3) {
      for (let k = 1; k + 1 < n; k++) {
        indices.push(parts[1], parts[k + 1], parts[k + 2]);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Pure parser for AutoCAD DXF (.dxf) 3DFACE mesh entities.
 */
export function parseDxf3dFacesToGeometry(text: string): THREE.BufferGeometry {
  const raw = text.split(/\r?\n/);
  const positions: number[] = [];
  let i = 0;

  while (i + 1 < raw.length) {
    const code = raw[i].trim();
    const value = raw[i + 1].trim();
    i += 2;
    if (code === '0' && value.toUpperCase() === '3DFACE') {
      const pts: Record<number, number> = {};
      while (i + 1 < raw.length) {
        const c = raw[i].trim();
        const v = raw[i + 1].trim();
        if (c === '0') break;
        i += 2;
        const numCode = Number(c);
        if (
          (numCode >= 10 && numCode <= 13) ||
          (numCode >= 20 && numCode <= 23) ||
          (numCode >= 30 && numCode <= 33)
        ) {
          pts[numCode] = Number(v) || 0;
        }
      }
      const ax = pts[10] ?? 0, ay = pts[20] ?? 0, az = pts[30] ?? 0;
      const bx = pts[11] ?? 0, by = pts[21] ?? 0, bz = pts[31] ?? 0;
      const cx = pts[12] ?? 0, cy = pts[22] ?? 0, cz = pts[32] ?? 0;
      const dx = pts[13] ?? cx, dy = pts[23] ?? cy, dz = pts[33] ?? cz;

      positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
      if (dx !== cx || dy !== cy || dz !== cz) {
        positions.push(ax, ay, az, cx, cy, cz, dx, dy, dz);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Parses a local 3D model File (GLB, GLTF, OBJ, STL, PLY, FBX, DAE, 3MF, AMF, OFF, DXF)
 * into a clean Three.js Group with computed summary stats.
 */
export async function parseLocal3DFile(file: File): Promise<ParsedModelSummary> {
  const lower = file.name.toLowerCase();
  const dot = lower.lastIndexOf('.');
  const ext = dot >= 0 ? lower.slice(dot) : '';
  const root = new THREE.Group();
  root.name = file.name.replace(/\.[^.]+$/, '') || 'Imported_Model';

  if (ext === '.glb' || ext === '.gltf') {
    const buffer = await file.arrayBuffer();
    const loader = new GLTFLoader();
    const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
      loader.parse(buffer, '', (res) => resolve(res), (err) => reject(err));
    });
    root.add(gltf.scene);
  } else if (ext === '.obj') {
    const text = await file.text();
    const loader = new OBJLoader();
    const parsed = loader.parse(text);
    const mat = defaultClayMaterial();
    parsed.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        if (!m.material) m.material = mat;
        if (!m.geometry.getAttribute('normal')) m.geometry.computeVertexNormals();
      }
    });
    root.add(parsed);
  } else if (ext === '.stl') {
    const buffer = await file.arrayBuffer();
    const loader = new STLLoader();
    const geo = loader.parse(buffer);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, defaultClayMaterial('STL_Mesh_BSDF'));
    mesh.name = root.name;
    root.add(mesh);
  } else if (ext === '.ply') {
    const buffer = await file.arrayBuffer();
    const loader = new PLYLoader();
    const geo = loader.parse(buffer);
    geo.computeVertexNormals();
    const hasColors = Boolean(geo.getAttribute('color'));
    const mat = new THREE.MeshStandardMaterial({
      name: 'PLY_Mesh_BSDF',
      color: hasColors ? '#FFFFFF' : '#8C867C',
      vertexColors: hasColors,
      roughness: 0.58,
      metalness: 0.06,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = root.name;
    root.add(mesh);
  } else if (ext === '.fbx') {
    const buffer = await file.arrayBuffer();
    const loader = new FBXLoader();
    const parsed = loader.parse(buffer, '');
    root.add(parsed);
  } else if (ext === '.dae') {
    const text = await file.text();
    const loader = new ColladaLoader();
    const parsed = loader.parse(text, '');
    root.add(parsed.scene);
  } else if (ext === '.3mf') {
    const buffer = await file.arrayBuffer();
    const loader = new ThreeMFLoader();
    const parsed = loader.parse(buffer);
    root.add(parsed);
  } else if (ext === '.amf') {
    const buffer = await file.arrayBuffer();
    const loader = new AMFLoader();
    const parsed = loader.parse(buffer);
    root.add(parsed);
  } else if (ext === '.off') {
    const text = await file.text();
    const geo = parseOffToGeometry(text);
    const mesh = new THREE.Mesh(geo, defaultClayMaterial('OFF_Mesh_BSDF'));
    mesh.name = root.name;
    root.add(mesh);
  } else if (ext === '.dxf') {
    const text = await file.text();
    const geo = parseDxf3dFacesToGeometry(text);
    const mesh = new THREE.Mesh(geo, defaultClayMaterial('DXF_CAD_BSDF'));
    mesh.name = root.name;
    root.add(mesh);
  } else {
    throw new Error(
      `Client-side parser supports .glb, .gltf, .obj, .stl, .ply, .fbx, .dae, .3mf, .amf, .off, and .dxf. For native .blend files, run them through Cloud Blender CI.`
    );
  }

  let meshCount = 0;
  let vertexCount = 0;
  let triangleCount = 0;
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      meshCount += 1;
      const g = (o as THREE.Mesh).geometry;
      const p = g.getAttribute('position');
      if (p) {
        vertexCount += p.count;
        triangleCount += g.index ? Math.round(g.index.count / 3) : Math.round(p.count / 3);
      }
    }
  });

  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);

  return {
    group: root,
    sourceFileName: file.name,
    sourceExt: ext,
    meshCount,
    vertexCount,
    triangleCount,
    boundsSize: [size.x, size.y, size.z],
  };
}

/**
 * Converts a parsed Three.js Group into any target 3D format with optional scale & up-axis transform.
 */
export async function convertParsedModelToFormat(params: {
  sourceGroup: THREE.Group;
  sourceName: string;
  targetFormat: Exclude<ExportFormatId, 'blend' | 'png'>;
  scaleMultiplier: number;
  axisConversion: AxisConversionMode;
  centerAndGround: boolean;
}): Promise<{ blob: Blob; filename: string }> {
  const cloned = params.sourceGroup.clone(true);

  if (params.axisConversion === 'z-up-to-y-up') {
    cloned.rotation.x = -Math.PI / 2;
  } else if (params.axisConversion === 'y-up-to-z-up') {
    cloned.rotation.x = Math.PI / 2;
  }

  const safeScale =
    Number.isFinite(params.scaleMultiplier) && params.scaleMultiplier > 0
      ? params.scaleMultiplier
      : 1;
  cloned.scale.multiplyScalar(safeScale);
  cloned.updateMatrixWorld(true);

  if (params.centerAndGround) {
    const box = new THREE.Box3().setFromObject(cloned);
    const center = new THREE.Vector3();
    box.getCenter(center);
    cloned.position.x -= center.x;
    cloned.position.z -= center.z;
    cloned.position.y -= box.min.y;
    cloned.updateMatrixWorld(true);
  }

  return exportObject3DToBlob(cloned, params.targetFormat, params.sourceName);
}
