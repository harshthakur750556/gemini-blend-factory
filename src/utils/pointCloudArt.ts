import * as THREE from 'three';

function createSoftPointTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 3, 32, 32, 28);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.8, 'rgba(255,255,255,0.2)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates a calm sculptural 3D Point Cloud centerpiece displayed when the
 * user clears the stage. Styled in deep botanical sage, warm espresso charcoal,
 * and mineral stone to harmonize with the Atelier gallery theme.
 */
export function createPointCloudArtGroup(): {
  group: THREE.Group;
  update: (elapsedSec: number) => void;
  dispose: () => void;
} {
  const group = new THREE.Group();
  group.name = 'Sculptural_Point_Cloud';

  const spriteTex = createSoftPointTexture();

  const primaryCount = 2600;
  const primaryPos = new Float32Array(primaryCount * 3);
  const primaryColors = new Float32Array(primaryCount * 3);

  const colorA = new THREE.Color('#2D5A4C');
  const colorB = new THREE.Color('#1C1B19');
  const colorC = new THREE.Color('#8E867B');
  const tmpColor = new THREE.Color();

  let seed = 4201;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < primaryCount; i++) {
    const t = (i / primaryCount) * Math.PI * 2 * 3;
    const p = 2;
    const q = 3;
    const rTube = 0.24 + 0.1 * Math.sin(t * 2.5);
    const radial = 1.0 + 0.34 * Math.cos(q * t);

    const bx = radial * Math.cos(p * t);
    const by = 0.4 * Math.sin(q * t) + 1.0;
    const bz = radial * Math.sin(p * t);

    const ang = rand() * Math.PI * 2;
    const spread = Math.pow(rand(), 0.65) * rTube;

    primaryPos[i * 3] = bx + Math.cos(ang) * spread;
    primaryPos[i * 3 + 1] = by + (rand() - 0.5) * spread * 1.1;
    primaryPos[i * 3 + 2] = bz + Math.sin(ang) * spread;

    const blend = (Math.sin(t * 1.5) + 1) * 0.5;
    if (blend < 0.5) {
      tmpColor.copy(colorC).lerp(colorA, blend * 2);
    } else {
      tmpColor.copy(colorA).lerp(colorB, (blend - 0.5) * 2);
    }
    primaryColors[i * 3] = tmpColor.r;
    primaryColors[i * 3 + 1] = tmpColor.g;
    primaryColors[i * 3 + 2] = tmpColor.b;
  }

  const primaryGeo = new THREE.BufferGeometry();
  primaryGeo.setAttribute('position', new THREE.BufferAttribute(primaryPos, 3));
  primaryGeo.setAttribute('color', new THREE.BufferAttribute(primaryColors, 3));

  const primaryMat = new THREE.PointsMaterial({
    size: 0.042,
    map: spriteTex,
    vertexColors: true,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    blending: THREE.NormalBlending,
    sizeAttenuation: true,
  });

  const primaryCloud = new THREE.Points(primaryGeo, primaryMat);
  primaryCloud.name = 'Harmonic_Point_Sculpture';
  group.add(primaryCloud);

  const haloCount = 600;
  const haloPos = new Float32Array(haloCount * 3);
  const haloColors = new Float32Array(haloCount * 3);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < haloCount; i++) {
    const yNorm = 1 - (i / (haloCount - 1)) * 2;
    const radiusAtY = Math.sqrt(Math.max(0, 1 - yNorm * yNorm));
    const theta = goldenAngle * i;
    const rad = 1.85;

    haloPos[i * 3] = Math.cos(theta) * radiusAtY * rad;
    haloPos[i * 3 + 1] = yNorm * 1.14 + 1.0;
    haloPos[i * 3 + 2] = Math.sin(theta) * radiusAtY * rad;

    tmpColor.copy(colorC).lerp(colorA, (yNorm + 1) * 0.35);
    haloColors[i * 3] = tmpColor.r;
    haloColors[i * 3 + 1] = tmpColor.g;
    haloColors[i * 3 + 2] = tmpColor.b;
  }

  const haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute('position', new THREE.BufferAttribute(haloPos, 3));
  haloGeo.setAttribute('color', new THREE.BufferAttribute(haloColors, 3));

  const haloMat = new THREE.PointsMaterial({
    size: 0.025,
    map: spriteTex,
    vertexColors: true,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    blending: THREE.NormalBlending,
    sizeAttenuation: true,
  });

  const haloCloud = new THREE.Points(haloGeo, haloMat);
  haloCloud.name = 'Fibonacci_Reference_Halo';
  group.add(haloCloud);

  const ringMat = new THREE.LineBasicMaterial({
    color: 0xa49d92,
    transparent: true,
    opacity: 0.36,
  });

  const makeRing = (name: string, radius: number, yPos: number, tiltX: number, tiltZ: number) => {
    const pts: THREE.Vector3[] = [];
    const segs = 96;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, ringMat);
    line.name = name;
    line.position.y = yPos;
    line.rotation.set(tiltX, 0, tiltZ);
    return { line, geo };
  };

  const ringA = makeRing('Meridian_Ring_Outer', 1.6, 1.0, 0.28, -0.18);
  const ringB = makeRing('Meridian_Ring_Inner', 1.32, 1.0, -0.45, 0.35);
  group.add(ringA.line, ringB.line);

  const update = (elapsedSec: number) => {
    primaryCloud.rotation.y = elapsedSec * 0.14;
    primaryCloud.rotation.x = Math.sin(elapsedSec * 0.25) * 0.06;
    haloCloud.rotation.y = -elapsedSec * 0.05;
    ringA.line.rotation.y = elapsedSec * 0.08;
    ringB.line.rotation.y = -elapsedSec * 0.06;
  };

  const dispose = () => {
    primaryGeo.dispose();
    primaryMat.dispose();
    haloGeo.dispose();
    haloMat.dispose();
    ringA.geo.dispose();
    ringB.geo.dispose();
    ringMat.dispose();
    spriteTex.dispose();
  };

  return { group, update, dispose };
}
