import * as THREE from 'three';

function createStoneBumpTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);
    // Deterministic pseudo-random speckled granite micro-relief
    let seed = 1337;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 4200; i++) {
      const x = Math.floor(rand() * 256);
      const y = Math.floor(rand() * 256);
      const v = Math.floor(70 + rand() * 125);
      const sz = rand() > 0.85 ? 2 : 1;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, sz, sz);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createWoodGrainTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#7e7e7e';
    ctx.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x++) {
      const wave = Math.sin(x * 0.35) * 18 + Math.sin(x * 0.11) * 14;
      const tone = Math.max(40, Math.min(220, Math.round(128 + wave)));
      ctx.fillStyle = `rgb(${tone},${tone},${tone})`;
      ctx.fillRect(x, 0, 1, 256);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createBeveledRectMesh(
  w: number,
  h: number,
  d: number,
  bevel: number,
  material: THREE.Material
): THREE.Mesh {
  const hw = Math.max(0.01, (w - bevel * 2) * 0.5);
  const hd = Math.max(0.01, (d - bevel * 2) * 0.5);
  const shape = new THREE.Shape();
  shape.moveTo(-hw, -hd);
  shape.lineTo(hw, -hd);
  shape.lineTo(hw, hd);
  shape.lineTo(-hw, hd);
  shape.closePath();

  const extrudeDepth = Math.max(0.008, h - bevel * 2);
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: extrudeDepth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 8,
  });
  // Rotate so extrusion lies along +Y and centers around origin
  geom.rotateX(-Math.PI / 2);
  geom.translate(0, -extrudeDepth * 0.5, 0);
  geom.computeVertexNormals();

  const mesh = new THREE.Mesh(geom, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds a composite 24-part beveled Japanese Stone-and-Wood Garden Lantern
 * matching scripts/build.py so the Three.js Live 3D Viewer renders a rich,
 * physically grounded starter asset prior to the first Cloud CI GLB download.
 */
export function createStarterLanternGroup(maxAnisotropy: number): {
  group: THREE.Group;
  dispose: () => void;
} {
  const group = new THREE.Group();
  group.name = 'Starter_StoneWood_Lantern';

  const stoneBump = createStoneBumpTexture(maxAnisotropy);
  const woodBump = createWoodGrainTexture(maxAnisotropy);

  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x676b72,
    roughness: 0.84,
    metalness: 0.05,
    bumpMap: stoneBump,
    bumpScale: 0.012,
  });

  const slateMat = new THREE.MeshStandardMaterial({
    color: 0x30353e,
    roughness: 0.56,
    metalness: 0.12,
    bumpMap: stoneBump,
    bumpScale: 0.008,
  });

  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x5c3621,
    roughness: 0.48,
    metalness: 0.04,
    bumpMap: woodBump,
    bumpScale: 0.006,
  });

  const bronzeMat = new THREE.MeshStandardMaterial({
    color: 0x8b6b43,
    roughness: 0.24,
    metalness: 0.9,
  });

  const shojiMat = new THREE.MeshStandardMaterial({
    color: 0xfff0d4,
    emissive: new THREE.Color(0xff9a38),
    emissiveIntensity: 1.45,
    roughness: 0.68,
    metalness: 0.0,
  });

  // 1. Two-tier beveled granite plinth
  const lowerPlinth = createBeveledRectMesh(0.84, 0.13, 0.84, 0.022, stoneMat);
  lowerPlinth.position.y = 0.065;
  group.add(lowerPlinth);

  const upperPlinth = createBeveledRectMesh(0.66, 0.11, 0.66, 0.018, stoneMat);
  upperPlinth.position.y = 0.185;
  group.add(upperPlinth);

  // 2. Cedar sill & top lintel frames
  const lowerFrame = createBeveledRectMesh(0.54, 0.058, 0.54, 0.008, woodMat);
  lowerFrame.position.y = 0.268;
  group.add(lowerFrame);

  const upperFrame = createBeveledRectMesh(0.56, 0.058, 0.56, 0.008, woodMat);
  upperFrame.position.y = 0.91;
  group.add(upperFrame);

  // 3. Four corner cedar timber posts + patinated bronze collars
  const postOffset = 0.215;
  const corners: Array<[number, number]> = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  for (const [sx, sz] of corners) {
    const px = sx * postOffset;
    const pz = sz * postOffset;

    const post = createBeveledRectMesh(0.066, 0.62, 0.066, 0.007, woodMat);
    post.position.set(px, 0.588, pz);
    group.add(post);

    const lowCollar = createBeveledRectMesh(0.078, 0.036, 0.078, 0.004, bronzeMat);
    lowCollar.position.set(px, 0.312, pz);
    group.add(lowCollar);

    const highCollar = createBeveledRectMesh(0.078, 0.036, 0.078, 0.004, bronzeMat);
    highCollar.position.set(px, 0.865, pz);
    group.add(highCollar);
  }

  // 4. Kumiko horizontal and vertical muntin rails
  const muntinGeoH = new THREE.BoxGeometry(0.39, 0.02, 0.022);
  const muntinGeoV = new THREE.BoxGeometry(0.018, 0.56, 0.018);

  for (const railY of [0.47, 0.69]) {
    const front = new THREE.Mesh(muntinGeoH, woodMat);
    front.position.set(0, railY, 0.212);
    const back = new THREE.Mesh(muntinGeoH, woodMat);
    back.position.set(0, railY, -0.212);
    const left = new THREE.Mesh(muntinGeoH, woodMat);
    left.rotation.y = Math.PI / 2;
    left.position.set(-0.212, railY, 0);
    const right = new THREE.Mesh(muntinGeoH, woodMat);
    right.rotation.y = Math.PI / 2;
    right.position.set(0.212, railY, 0);
    group.add(front, back, left, right);
  }

  for (const side of [-1, 1]) {
    const vZ = new THREE.Mesh(muntinGeoV, woodMat);
    vZ.position.set(0, 0.585, side * 0.212);
    const vX = new THREE.Mesh(muntinGeoV, woodMat);
    vX.position.set(side * 0.212, 0.585, 0);
    group.add(vZ, vX);
  }

  // 5. Glowing shoji paper core
  const shojiCore = createBeveledRectMesh(0.39, 0.57, 0.39, 0.01, shojiMat);
  shojiCore.position.y = 0.588;
  group.add(shojiCore);

  // 6. Stepped curved pagoda slate roof (2 tiers + ridge ribs)
  const lowerRoofGeo = new THREE.CylinderGeometry(0.42, 0.72, 0.14, 4, 1);
  lowerRoofGeo.rotateY(Math.PI / 4);
  const lowerRoof = new THREE.Mesh(lowerRoofGeo, slateMat);
  lowerRoof.position.y = 1.01;
  lowerRoof.castShadow = true;
  lowerRoof.receiveShadow = true;
  group.add(lowerRoof);

  const upperRoofGeo = new THREE.CylinderGeometry(0.18, 0.44, 0.16, 4, 1);
  upperRoofGeo.rotateY(Math.PI / 4);
  const upperRoof = new THREE.Mesh(upperRoofGeo, slateMat);
  upperRoof.position.y = 1.155;
  upperRoof.castShadow = true;
  upperRoof.receiveShadow = true;
  group.add(upperRoof);

  const eaveTrim = createBeveledRectMesh(1.02, 0.036, 1.02, 0.008, slateMat);
  eaveTrim.position.y = 0.942;
  group.add(eaveTrim);

  // 7. Capstone & LatheGeometry turned granite finial
  const capstone = createBeveledRectMesh(0.28, 0.055, 0.28, 0.01, stoneMat);
  capstone.position.y = 1.255;
  group.add(capstone);

  const finialPoints = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.105, 0.0),
    new THREE.Vector2(0.095, 0.035),
    new THREE.Vector2(0.052, 0.068),
    new THREE.Vector2(0.082, 0.125),
    new THREE.Vector2(0.068, 0.178),
    new THREE.Vector2(0.022, 0.228),
    new THREE.Vector2(0.0, 0.255),
  ];
  const finialGeo = new THREE.LatheGeometry(finialPoints, 24);
  const finial = new THREE.Mesh(finialGeo, stoneMat);
  finial.position.y = 1.28;
  finial.castShadow = true;
  finial.receiveShadow = true;
  group.add(finial);

  // Warm subtle inner point light casting amber bounce onto wood posts
  const lanternGlow = new THREE.PointLight(0xffa245, 1.8, 3.2, 1.6);
  lanternGlow.position.set(0, 0.58, 0);
  group.add(lanternGlow);

  const dispose = () => {
    group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        (obj as THREE.Mesh).geometry.dispose();
      }
    });
    stoneMat.dispose();
    slateMat.dispose();
    woodMat.dispose();
    bronzeMat.dispose();
    shojiMat.dispose();
    stoneBump.dispose();
    woodBump.dispose();
  };

  return { group, dispose };
}
