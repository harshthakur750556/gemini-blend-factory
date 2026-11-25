import * as THREE from 'three';

function createStoneBumpTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);
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
  name: string,
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
  geom.rotateX(-Math.PI / 2);
  geom.translate(0, -extrudeDepth * 0.5, 0);
  geom.computeVertexNormals();

  const mesh = new THREE.Mesh(geom, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds the curated architectural sample model: Stone & Cedar Garden Lantern.
 * Matches scripts/build.py with named sub-assemblies, calibrated PBR materials
 * (granite, dark slate, hinoki cedar, patinated bronze, warm shoji core), and a
 * subtle two-bone architectural canopy articulation rig for testing pose & motion.
 */
export function createStarterLanternGroup(maxAnisotropy: number): {
  group: THREE.Group;
  animations: THREE.AnimationClip[];
  dispose: () => void;
} {
  const group = new THREE.Group();
  group.name = 'Stone_Cedar_Lantern';

  const stoneBump = createStoneBumpTexture(maxAnisotropy);
  const woodBump = createWoodGrainTexture(maxAnisotropy);

  const stoneMat = new THREE.MeshStandardMaterial({
    name: 'Granite_Plinth_BSDF',
    color: 0x7b7871,
    roughness: 0.86,
    metalness: 0.04,
    bumpMap: stoneBump,
    bumpScale: 0.012,
  });

  const slateMat = new THREE.MeshStandardMaterial({
    name: 'Charcoal_Slate_BSDF',
    color: 0x32373c,
    roughness: 0.54,
    metalness: 0.14,
    bumpMap: stoneBump,
    bumpScale: 0.008,
  });

  const woodMat = new THREE.MeshStandardMaterial({
    name: 'Hinoki_Cedar_BSDF',
    color: 0x73482d,
    roughness: 0.46,
    metalness: 0.04,
    bumpMap: woodBump,
    bumpScale: 0.006,
  });

  const bronzeMat = new THREE.MeshStandardMaterial({
    name: 'Patinated_Bronze_BSDF',
    color: 0x8f7450,
    roughness: 0.24,
    metalness: 0.9,
  });

  const shojiMat = new THREE.MeshStandardMaterial({
    name: 'Washi_Shoji_Core_BSDF',
    color: 0xfff3de,
    emissive: new THREE.Color(0xf6a957),
    emissiveIntensity: 1.25,
    roughness: 0.72,
    metalness: 0.0,
  });

  // Architectural 2-bone hierarchy so Rig & Animation tools work organically
  const baseBone = new THREE.Bone();
  baseBone.name = 'Plinth_Foundation_Bone';
  baseBone.position.set(0, 0, 0);
  group.add(baseBone);

  const canopyBone = new THREE.Bone();
  canopyBone.name = 'Pagoda_Canopy_Bone';
  canopyBone.position.set(0, 0.92, 0);
  baseBone.add(canopyBone);

  // 1. Two-tier beveled granite plinth
  const plinthAssembly = new THREE.Group();
  plinthAssembly.name = 'Granite_Plinth_Assembly';
  const lowerPlinth = createBeveledRectMesh('Granite_Plinth_Lower', 0.84, 0.13, 0.84, 0.022, stoneMat);
  lowerPlinth.position.y = 0.065;
  plinthAssembly.add(lowerPlinth);

  const upperPlinth = createBeveledRectMesh('Granite_Plinth_Upper', 0.66, 0.11, 0.66, 0.018, stoneMat);
  upperPlinth.position.y = 0.185;
  plinthAssembly.add(upperPlinth);
  baseBone.add(plinthAssembly);

  // 2. Timber frame, bronze collars, and Kumiko lattice
  const frameAssembly = new THREE.Group();
  frameAssembly.name = 'Cedar_Timber_Frame';

  const lowerFrame = createBeveledRectMesh('Cedar_Sill_Frame', 0.54, 0.058, 0.54, 0.008, woodMat);
  lowerFrame.position.y = 0.268;
  frameAssembly.add(lowerFrame);

  const upperFrame = createBeveledRectMesh('Cedar_Lintel_Frame', 0.56, 0.058, 0.56, 0.008, woodMat);
  upperFrame.position.y = 0.91;
  frameAssembly.add(upperFrame);

  const postOffset = 0.215;
  const corners: Array<[number, number]> = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  corners.forEach(([sx, sz], idx) => {
    const px = sx * postOffset;
    const pz = sz * postOffset;

    const post = createBeveledRectMesh(`Cedar_Corner_Post_${idx + 1}`, 0.066, 0.62, 0.066, 0.007, woodMat);
    post.position.set(px, 0.588, pz);
    frameAssembly.add(post);

    const lowCollar = createBeveledRectMesh(`Bronze_Collar_Lower_${idx + 1}`, 0.078, 0.036, 0.078, 0.004, bronzeMat);
    lowCollar.position.set(px, 0.312, pz);
    frameAssembly.add(lowCollar);

    const highCollar = createBeveledRectMesh(`Bronze_Collar_Upper_${idx + 1}`, 0.078, 0.036, 0.078, 0.004, bronzeMat);
    highCollar.position.set(px, 0.865, pz);
    frameAssembly.add(highCollar);
  });

  const muntinGeoH = new THREE.BoxGeometry(0.39, 0.02, 0.022);
  const muntinGeoV = new THREE.BoxGeometry(0.018, 0.56, 0.018);
  const latticeAssembly = new THREE.Group();
  latticeAssembly.name = 'Kumiko_Lattice_Mullions';

  [0.47, 0.69].forEach((railY, rIdx) => {
    const front = new THREE.Mesh(muntinGeoH, woodMat);
    front.name = `Kumiko_Rail_North_${rIdx + 1}`;
    front.position.set(0, railY, 0.212);
    const back = new THREE.Mesh(muntinGeoH, woodMat);
    back.name = `Kumiko_Rail_South_${rIdx + 1}`;
    back.position.set(0, railY, -0.212);
    const left = new THREE.Mesh(muntinGeoH, woodMat);
    left.name = `Kumiko_Rail_West_${rIdx + 1}`;
    left.rotation.y = Math.PI / 2;
    left.position.set(-0.212, railY, 0);
    const right = new THREE.Mesh(muntinGeoH, woodMat);
    right.name = `Kumiko_Rail_East_${rIdx + 1}`;
    right.rotation.y = Math.PI / 2;
    right.position.set(0.212, railY, 0);
    latticeAssembly.add(front, back, left, right);
  });

  [-1, 1].forEach((side, sIdx) => {
    const vZ = new THREE.Mesh(muntinGeoV, woodMat);
    vZ.name = `Kumiko_Stile_Z_${sIdx + 1}`;
    vZ.position.set(0, 0.585, side * 0.212);
    const vX = new THREE.Mesh(muntinGeoV, woodMat);
    vX.name = `Kumiko_Stile_X_${sIdx + 1}`;
    vX.position.set(side * 0.212, 0.585, 0);
    latticeAssembly.add(vZ, vX);
  });
  frameAssembly.add(latticeAssembly);
  baseBone.add(frameAssembly);

  // 3. Glowing shoji diffuser core
  const shojiCore = createBeveledRectMesh('Washi_Shoji_Diffuser', 0.39, 0.57, 0.39, 0.01, shojiMat);
  shojiCore.position.y = 0.588;
  baseBone.add(shojiCore);

  // 4. Stepped pagoda slate roof + capstone + lathe finial (mounted to canopyBone relative to y = 0.92)
  const roofAssembly = new THREE.Group();
  roofAssembly.name = 'Pagoda_Slate_Roof';

  const eaveTrim = createBeveledRectMesh('Slate_Eave_Cornice', 1.02, 0.036, 1.02, 0.008, slateMat);
  eaveTrim.position.y = 0.022;
  roofAssembly.add(eaveTrim);

  const lowerRoofGeo = new THREE.CylinderGeometry(0.42, 0.72, 0.14, 4, 1);
  lowerRoofGeo.rotateY(Math.PI / 4);
  const lowerRoof = new THREE.Mesh(lowerRoofGeo, slateMat);
  lowerRoof.name = 'Slate_Roof_Tier_Lower';
  lowerRoof.position.y = 0.09;
  lowerRoof.castShadow = true;
  lowerRoof.receiveShadow = true;
  roofAssembly.add(lowerRoof);

  const upperRoofGeo = new THREE.CylinderGeometry(0.18, 0.44, 0.16, 4, 1);
  upperRoofGeo.rotateY(Math.PI / 4);
  const upperRoof = new THREE.Mesh(upperRoofGeo, slateMat);
  upperRoof.name = 'Slate_Roof_Tier_Upper';
  upperRoof.position.y = 0.235;
  upperRoof.castShadow = true;
  upperRoof.receiveShadow = true;
  roofAssembly.add(upperRoof);

  const capstone = createBeveledRectMesh('Granite_Capstone', 0.28, 0.055, 0.28, 0.01, stoneMat);
  capstone.position.y = 0.335;
  roofAssembly.add(capstone);

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
  finial.name = 'Turned_Granite_Finial';
  finial.position.y = 0.36;
  finial.castShadow = true;
  finial.receiveShadow = true;
  roofAssembly.add(finial);

  canopyBone.add(roofAssembly);

  // Warm subtle inner point light casting amber bounce onto cedar mullions
  const lanternGlow = new THREE.PointLight(0xffb45c, 1.6, 3.0, 1.6);
  lanternGlow.position.set(0, 0.58, 0);
  baseBone.add(lanternGlow);

  // Subtle architectural canopy lift/inspect clip for the Rig & Animation timeline
  const times = [0, 1.5, 3.0, 4.5, 6.0];
  const canopyLift = new THREE.VectorKeyframeTrack(
    'Pagoda_Canopy_Bone.position',
    times,
    [0, 0.92, 0, 0, 1.04, 0, 0, 0.92, 0, 0, 0.96, 0, 0, 0.92, 0]
  );
  const canopyTurn = new THREE.QuaternionKeyframeTrack(
    'Pagoda_Canopy_Bone.quaternion',
    times,
    [
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.06, 0)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -0.06, 0)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),
    ]
  );
  const animations = [new THREE.AnimationClip('Canopy_Inspection_Motion', 6.0, [canopyLift, canopyTurn])];

  const dispose = () => {
    const seenGeo = new Set<THREE.BufferGeometry>();
    group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const g = (obj as THREE.Mesh).geometry;
        if (!seenGeo.has(g)) {
          seenGeo.add(g);
          g.dispose();
        }
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

  return { group, animations, dispose };
}
