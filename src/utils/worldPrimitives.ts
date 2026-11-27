import * as THREE from 'three';
import type { ScatterBrushPreset, SceneLightKind, WorldPrimitiveKind } from '../types';
import { createOpenWorldTerrainMesh } from './terrainEngine';

/**
 * Converts a Blender 36x24mm full-frame focal length (mm) to Three.js vertical FOV (degrees).
 */
export function focalLengthMmToFovDeg(focalMm: number, sensorHeightMm = 24): number {
  const safeFocal = Math.max(8, Math.min(300, Number.isFinite(focalMm) ? focalMm : 50));
  const rad = 2 * Math.atan(sensorHeightMm / (2 * safeFocal));
  return Number(THREE.MathUtils.radToDeg(rad).toFixed(2));
}

/**
 * Converts Three.js vertical FOV (degrees) back to Blender 36x24mm full-frame focal length (mm).
 */
export function fovDegToFocalLengthMm(fovDeg: number, sensorHeightMm = 24): number {
  const safeFov = Math.max(5, Math.min(135, Number.isFinite(fovDeg) ? fovDeg : 27));
  const rad = THREE.MathUtils.degToRad(safeFov);
  const focal = sensorHeightMm / (2 * Math.tan(rad / 2));
  return Number(focal.toFixed(1));
}

function markAsEditorHelper(obj: THREE.Object3D): void {
  obj.userData.isEditorHelper = true;
  obj.traverse((c) => {
    c.userData.isEditorHelper = true;
    c.castShadow = false;
    c.receiveShadow = false;
  });
}

function createDashedRing(radius: number, color: string, plane: 'xy' | 'xz' | 'yz'): THREE.LineLoop {
  const pts: THREE.Vector3[] = [];
  const segs = 32;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const c = Math.cos(a) * radius;
    const s = Math.sin(a) * radius;
    if (plane === 'xy') pts.push(new THREE.Vector3(c, s, 0));
    else if (plane === 'xz') pts.push(new THREE.Vector3(c, 0, s));
    else pts.push(new THREE.Vector3(0, c, s));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.72 });
  return new THREE.LineLoop(geo, mat);
}

/**
 * Rebuilds the wireframe cone helper inside a Blender-style Spot Light group.
 */
export function rebuildSpotLightConeHelper(group: THREE.Object3D): void {
  const existing = group.getObjectByName('__SpotConeHelper');
  if (existing) {
    group.remove(existing);
    existing.traverse((o) => {
      if ((o as THREE.LineSegments).isLineSegments) {
        (o as THREE.LineSegments).geometry.dispose();
        ((o as THREE.LineSegments).material as THREE.Material).dispose();
      }
    });
  }

  const spot = group.children.find((c) => (c as THREE.SpotLight).isSpotLight) as THREE.SpotLight | undefined;
  const angle = spot ? spot.angle : Math.PI / 5;
  const len = Math.min(3.2, Math.max(1.1, (spot?.distance || 8) * 0.24));
  const radius = Math.tan(Math.min(Math.PI / 2.2, angle)) * len;
  const col = spot ? `#${spot.color.getHexString()}` : '#B8863B';

  const verts: number[] = [];
  const segs = 24;
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    const x0 = Math.cos(a0) * radius;
    const z0 = Math.sin(a0) * radius;
    const x1 = Math.cos(a1) * radius;
    const z1 = Math.sin(a1) * radius;
    // Rim circle at y = -len
    verts.push(x0, -len, z0, x1, -len, z1);
    // 4 primary cone ribs
    if (i % 6 === 0) {
      verts.push(0, 0, 0, x0, -len, z0);
    }
  }
  // Center aim axis
  verts.push(0, 0, 0, 0, -len * 1.12, 0);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  const lines = new THREE.LineSegments(
    geo,
    new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.78 })
  );
  lines.name = '__SpotConeHelper';
  markAsEditorHelper(lines);
  group.add(lines);
}

/**
 * Rebuilds the rectangular softbox frame helper inside a Blender-style Area Light group.
 */
export function rebuildAreaLightFrameHelper(group: THREE.Object3D, width: number, height: number, colorHex: string): void {
  const existing = group.getObjectByName('__AreaFrameHelper');
  if (existing) {
    group.remove(existing);
    existing.traverse((o) => {
      if ((o as THREE.Mesh).isMesh || (o as THREE.LineSegments).isLineSegments) {
        (o as THREE.Mesh).geometry.dispose();
        const m = (o as THREE.Mesh).material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }
    });
  }

  const hw = Math.max(0.15, width) * 0.5;
  const hh = Math.max(0.15, height) * 0.5;
  const holder = new THREE.Group();
  holder.name = '__AreaFrameHelper';

  // Soft translucent emitter pane facing -Z (Three.js RectAreaLight shines along -Z)
  const pane = new THREE.Mesh(
    new THREE.PlaneGeometry(hw * 2, hh * 2),
    new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  holder.add(pane);

  // Outer rectangle + normal direction stem pointing along -Z
  const pts = [
    -hw, -hh, 0,  hw, -hh, 0,
     hw, -hh, 0,  hw,  hh, 0,
     hw,  hh, 0, -hw,  hh, 0,
    -hw,  hh, 0, -hw, -hh, 0,
      0,   0, 0,   0,   0, -0.75,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const frame = new THREE.LineSegments(
    geo,
    new THREE.LineBasicMaterial({ color: '#B8863B', transparent: true, opacity: 0.9 })
  );
  holder.add(frame);

  markAsEditorHelper(holder);
  group.add(holder);
}

/**
 * Rebuilds the iconic Blender-style Camera frustum pyramid + top orientation triangle.
 */
export function rebuildCameraFrustumHelper(group: THREE.Object3D, fovDeg: number, isActive = false): void {
  const existing = group.getObjectByName('__CameraFrustumHelper');
  if (existing) {
    group.remove(existing);
    existing.traverse((o) => {
      if ((o as THREE.Mesh).isMesh || (o as THREE.LineSegments).isLineSegments) {
        (o as THREE.Mesh).geometry.dispose();
        const m = (o as THREE.Mesh).material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }
    });
  }

  const holder = new THREE.Group();
  holder.name = '__CameraFrustumHelper';

  const depth = 0.62;
  const aspect = 16 / 9;
  const halfH = Math.min(0.45, Math.max(0.11, Math.tan(THREE.MathUtils.degToRad(fovDeg * 0.5)) * depth));
  const halfW = halfH * aspect;

  // Pyramid frustum pointing along -Z (standard Three.js PerspectiveCamera forward direction)
  const verts = [
    // Apex to 4 corners
    0, 0, 0, -halfW,  halfH, -depth,
    0, 0, 0,  halfW,  halfH, -depth,
    0, 0, 0,  halfW, -halfH, -depth,
    0, 0, 0, -halfW, -halfH, -depth,
    // Front film-gate frame
    -halfW,  halfH, -depth,  halfW,  halfH, -depth,
     halfW,  halfH, -depth,  halfW, -halfH, -depth,
     halfW, -halfH, -depth, -halfW, -halfH, -depth,
    -halfW, -halfH, -depth, -halfW,  halfH, -depth,
  ];
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  const strokeColor = isActive ? '#2D5A4C' : '#5A564F';
  const frustumLines = new THREE.LineSegments(
    lineGeo,
    new THREE.LineBasicMaterial({ color: strokeColor, transparent: true, opacity: 0.92 })
  );
  holder.add(frustumLines);

  // Blender-style upward orientation triangle above the camera lens frame (filled when active!)
  const triW = halfW * 0.56;
  const triBaseY = halfH + 0.04;
  const triTipY = triBaseY + Math.max(0.11, halfH * 0.48);
  const triGeo = new THREE.BufferGeometry();
  triGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [-triW, triBaseY, -depth, triW, triBaseY, -depth, 0, triTipY, -depth],
      3
    )
  );
  triGeo.computeVertexNormals();
  const upTriangle = new THREE.Mesh(
    triGeo,
    new THREE.MeshBasicMaterial({
      color: isActive ? '#2D5A4C' : '#847E75',
      wireframe: !isActive,
      side: THREE.DoubleSide,
    })
  );
  holder.add(upTriangle);

  // Subtle camera body proxy box behind apex so raycast clicking is effortless
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.12, 0.18),
    new THREE.MeshStandardMaterial({
      color: isActive ? '#2D5A4C' : '#3B3935',
      roughness: 0.45,
      metalness: 0.2,
    })
  );
  body.position.set(0, 0, 0.09);
  holder.add(body);

  markAsEditorHelper(holder);
  group.add(holder);
}

/**
 * Creates Blender-inspired architectural & 3D world-building primitives, terrain,
 * water planes, architectural prefabs, full Blender Lights (Point, Sun, Spot, Area),
 * Scene Cameras, and Unreal/Unity UCX collision volumes.
 */
export function createWorldPrimitive(
  kind: WorldPrimitiveKind,
  indexSuffix: number,
  options?: { isSoftwareGl?: boolean }
): THREE.Object3D {
  const isSw = Boolean(options?.isSoftwareGl);
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
      return createOpenWorldTerrainMesh(indexSuffix, {
        size: 32,
        segments: 64,
        includeBasin: true,
      });
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
      group.name = `Point_Light_${indexSuffix}`;
      group.position.set(0.9, 1.55, 0.9);
      group.userData.studioElementType = 'light';
      group.userData.lightKind = 'point' as SceneLightKind;

      const helper = new THREE.Group();
      helper.name = '__PointLightHelper';
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.085, 16, 12),
        new THREE.MeshBasicMaterial({ color: '#FFCE8A' })
      );
      bulb.name = '__LightBulbCore';
      helper.add(
        bulb,
        createDashedRing(0.18, '#B8863B', 'xy'),
        createDashedRing(0.18, '#B8863B', 'xz')
      );
      markAsEditorHelper(helper);

      const light = new THREE.PointLight('#FFCE8A', 2.6, 10, 1.6);
      light.name = `Point_Emitter_${indexSuffix}`;
      light.castShadow = !isSw;
      group.add(helper, light);
      return group;
    }
    case 'sun-light': {
      const group = new THREE.Group();
      group.name = `Sun_Light_${indexSuffix}`;
      group.position.set(2.2, 3.2, 1.8);
      group.rotation.set(-0.55, 0.45, 0);
      group.userData.studioElementType = 'light';
      group.userData.lightKind = 'sun' as SceneLightKind;

      const helper = new THREE.Group();
      helper.name = '__SunLightHelper';
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 16, 12),
        new THREE.MeshBasicMaterial({ color: '#FFE4A8' })
      );
      core.name = '__LightBulbCore';
      const rayVerts: number[] = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        rayVerts.push(Math.cos(a) * 0.16, 0, Math.sin(a) * 0.16, Math.cos(a) * 0.28, 0, Math.sin(a) * 0.28);
      }
      // Parallel sun direction vector pointing straight down local -Y
      rayVerts.push(0, 0, 0, 0, -1.35, 0);
      rayVerts.push(-0.1, -0.1, 0, -0.1, -1.1, 0);
      rayVerts.push(0.1, -0.1, 0, 0.1, -1.1, 0);
      const rayGeo = new THREE.BufferGeometry();
      rayGeo.setAttribute('position', new THREE.Float32BufferAttribute(rayVerts, 3));
      const rays = new THREE.LineSegments(
        rayGeo,
        new THREE.LineBasicMaterial({ color: '#B8863B', transparent: true, opacity: 0.88 })
      );
      helper.add(core, rays);
      markAsEditorHelper(helper);

      const light = new THREE.DirectionalLight('#FFF3D6', 2.2);
      light.name = `Sun_Emitter_${indexSuffix}`;
      light.castShadow = !isSw;
      const target = new THREE.Object3D();
      target.name = '__LightTarget';
      target.position.set(0, -2.5, 0);
      light.target = target;
      group.add(helper, light, target);
      return group;
    }
    case 'spot-light': {
      const group = new THREE.Group();
      group.name = `Spot_Light_${indexSuffix}`;
      group.position.set(1.4, 2.35, 1.3);
      group.rotation.set(-0.42, 0.2, 0.35);
      group.userData.studioElementType = 'light';
      group.userData.lightKind = 'spot' as SceneLightKind;

      const core = new THREE.Mesh(
        new THREE.ConeGeometry(0.1, 0.18, 12),
        new THREE.MeshBasicMaterial({ color: '#FFD9A0' })
      );
      core.name = '__LightBulbCore';
      core.rotation.x = Math.PI;
      markAsEditorHelper(core);

      const light = new THREE.SpotLight('#FFD9A0', 4.5, 12, Math.PI / 5, 0.35, 1.5);
      light.name = `Spot_Emitter_${indexSuffix}`;
      light.castShadow = !isSw;
      const target = new THREE.Object3D();
      target.name = '__LightTarget';
      target.position.set(0, -2.5, 0);
      light.target = target;
      group.add(core, light, target);
      rebuildSpotLightConeHelper(group);
      return group;
    }
    case 'area-light': {
      const group = new THREE.Group();
      group.name = `Area_Light_${indexSuffix}`;
      group.position.set(-1.5, 1.85, 1.35);
      // RectAreaLight emits along local -Z, so use camera-style Matrix4.lookAt
      const areaLook = new THREE.Matrix4().lookAt(
        group.position,
        new THREE.Vector3(0, 0.65, 0),
        new THREE.Vector3(0, 1, 0)
      );
      group.quaternion.setFromRotationMatrix(areaLook);
      group.userData.studioElementType = 'light';
      group.userData.lightKind = 'area' as SceneLightKind;
      group.userData.areaWidth = 1.4;
      group.userData.areaHeight = 0.9;

      if (!isSw) {
        const rectLight = new THREE.RectAreaLight('#FFF6E8', 4.2, 1.4, 0.9);
        rectLight.name = `Area_Emitter_${indexSuffix}`;
        group.add(rectLight);
      } else {
        // Calibrated software-WebGL safe fill proxy so CPU render stays instant
        const proxy = new THREE.PointLight('#FFF6E8', 2.4, 9, 1.5);
        proxy.name = `Area_Emitter_${indexSuffix}`;
        group.add(proxy);
      }
      rebuildAreaLightFrameHelper(group, 1.4, 0.9, '#FFF6E8');
      return group;
    }
    case 'scene-camera': {
      const group = new THREE.Group();
      group.name = `Scene_Camera_${indexSuffix}`;
      // Left-front 3/4 hero position so the frustum sits cleanly in view without blocking the main orbit lens
      group.position.set(-2.4, 1.5, 2.55);
      // PerspectiveCamera & frustum helper face local -Z, so use Matrix4.lookAt
      const camLook = new THREE.Matrix4().lookAt(
        group.position,
        new THREE.Vector3(0, 0.72, 0),
        new THREE.Vector3(0, 1, 0)
      );
      group.quaternion.setFromRotationMatrix(camLook);
      group.userData.studioElementType = 'camera';
      const defaultFocalMm = 50;
      const defaultFov = focalLengthMmToFovDeg(defaultFocalMm);
      group.userData.focalLengthMm = defaultFocalMm;

      const cam = new THREE.PerspectiveCamera(defaultFov, 16 / 9, 0.08, 120);
      cam.name = `Camera_Lens_${indexSuffix}`;
      group.add(cam);
      rebuildCameraFrustumHelper(group, defaultFov, false);
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
    if (!(obj as THREE.Mesh).isMesh || obj.userData?.isEditorHelper) return;
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

/**
 * Generates procedural scatter props for interactive brush-based open-world painting.
 */
export function createScatterBrushProp(
  preset: ScatterBrushPreset,
  indexSuffix: number,
  selectedSource?: THREE.Object3D | null
): THREE.Object3D {
  if (preset === 'selected' && selectedSource && !selectedSource.userData?.isEditorHelper) {
    const clone = selectedSource.clone(true);
    clone.name = `${selectedSource.name || 'Prop'}_Brush_${indexSuffix}`;
    return clone;
  }

  switch (preset) {
    case 'pine-tree': {
      const g = new THREE.Group();
      g.name = `Scatter_Pine_${indexSuffix}`;
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.13, 0.55, 7),
        new THREE.MeshStandardMaterial({ color: '#5D4433', roughness: 0.92 })
      );
      trunk.position.y = 0.275;
      trunk.castShadow = true;
      const foliageMat = new THREE.MeshStandardMaterial({ color: '#2F614B', roughness: 0.86 });
      const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.78, 7), foliageMat);
      c1.position.y = 0.78;
      c1.castShadow = true;
      const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.65, 7), foliageMat);
      c2.position.y = 1.2;
      c2.castShadow = true;
      const c3 = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.5, 7), foliageMat);
      c3.position.y = 1.54;
      c3.castShadow = true;
      g.add(trunk, c1, c2, c3);
      return g;
    }
    case 'boulder': {
      const mesh = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.38, 1),
        new THREE.MeshStandardMaterial({ color: '#6E747B', roughness: 0.88, metalness: 0.05 })
      );
      mesh.name = `Scatter_Boulder_${indexSuffix}`;
      mesh.scale.set(1.2, 0.72, 1.0);
      mesh.position.y = 0.2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    }
    case 'crystal': {
      const g = new THREE.Group();
      g.name = `Scatter_Crystal_${indexSuffix}`;
      const mat = new THREE.MeshStandardMaterial({
        color: '#4FD6FF',
        emissive: '#1687C4',
        emissiveIntensity: 0.75,
        roughness: 0.15,
        metalness: 0.25,
      });
      const main = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), mat);
      main.scale.set(0.65, 1.7, 0.65);
      main.position.y = 0.35;
      const side = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), mat);
      side.scale.set(0.65, 1.4, 0.65);
      side.position.set(0.18, 0.22, 0.08);
      side.rotation.z = -0.35;
      g.add(main, side);
      return g;
    }
    case 'grass-tuft': {
      const g = new THREE.Group();
      g.name = `Scatter_Grass_${indexSuffix}`;
      const mat = new THREE.MeshStandardMaterial({
        color: '#5B8A42',
        roughness: 0.88,
        side: THREE.DoubleSide,
      });
      for (let i = 0; i < 4; i++) {
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.42, 4), mat);
        const a = (i / 4) * Math.PI * 2;
        blade.position.set(Math.cos(a) * 0.09, 0.18, Math.sin(a) * 0.09);
        blade.rotation.set(Math.sin(a) * 0.28, a, -Math.cos(a) * 0.28);
        g.add(blade);
      }
      return g;
    }
    case 'pillar':
    default: {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.26, 1.6, 10),
        new THREE.MeshStandardMaterial({ color: '#9D9587', roughness: 0.78, metalness: 0.05 })
      );
      mesh.name = `Scatter_Pillar_${indexSuffix}`;
      mesh.position.y = 0.8;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    }
  }
}

/**
 * Generates procedural PBR albedo + bump CanvasTextures for the in-app Material Editor.
 */
export function createProceduralMaterialMaps(
  pattern: 'stone' | 'wood' | 'runic-bronze' | 'moss-grass',
  baseHex: string,
  size = 256
): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } | null {
  if (typeof document === 'undefined') return null;
  const cMap = document.createElement('canvas');
  cMap.width = size;
  cMap.height = size;
  const ctx = cMap.getContext('2d');

  const cBump = document.createElement('canvas');
  cBump.width = size;
  cBump.height = size;
  const bCtx = cBump.getContext('2d');
  if (!ctx || !bCtx) return null;

  ctx.fillStyle = baseHex || '#9C968B';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  let s = 7331;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  if (pattern === 'wood') {
    for (let y = 0; y < size; y += 3) {
      const alpha = 0.08 + rand() * 0.16;
      ctx.fillStyle = rand() > 0.5 ? `rgba(45,28,16,${alpha})` : `rgba(210,175,130,${alpha * 0.7})`;
      ctx.fillRect(0, y, size, 2 + rand() * 3);
      const bv = Math.round(105 + Math.sin(y * 0.25) * 35 + rand() * 20);
      bCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
      bCtx.fillRect(0, y, size, 3);
    }
  } else if (pattern === 'runic-bronze') {
    ctx.strokeStyle = 'rgba(130, 225, 255, 0.55)';
    ctx.lineWidth = 2;
    bCtx.strokeStyle = '#E5E5E5';
    bCtx.lineWidth = 3;
    for (let y = 24; y < size; y += 48) {
      ctx.strokeRect(8, y, size - 16, 30);
      bCtx.strokeRect(8, y, size - 16, 30);
      for (let x = 20; x < size - 20; x += 28) {
        ctx.beginPath();
        ctx.arc(x, y + 15, 7, 0, Math.PI * 2);
        ctx.stroke();
        bCtx.beginPath();
        bCtx.arc(x, y + 15, 7, 0, Math.PI * 2);
        bCtx.stroke();
      }
    }
  } else if (pattern === 'moss-grass') {
    for (let i = 0; i < 1600; i++) {
      const x = rand() * size;
      const y = rand() * size;
      ctx.fillStyle = rand() > 0.45 ? 'rgba(62,112,56,0.45)' : 'rgba(148,186,88,0.38)';
      ctx.fillRect(x, y, 2 + rand() * 3, 2 + rand() * 4);
      const bv = Math.round(90 + rand() * 110);
      bCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
      bCtx.fillRect(x, y, 3, 3);
    }
  } else {
    // Stone grain & strata
    for (let i = 0; i < 1400; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 1.5 + rand() * 4.5;
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.09)' : 'rgba(20,20,24,0.14)';
      ctx.fillRect(x, y, r, r);
      const bv = Math.round(85 + rand() * 95);
      bCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
      bCtx.fillRect(x, y, r, r);
    }
  }

  const map = new THREE.CanvasTexture(cMap);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 2);

  const bump = new THREE.CanvasTexture(cBump);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(2, 2);

  return { map, bump };
}
