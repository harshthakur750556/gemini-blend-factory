import * as THREE from 'three';

function createBrushedMetalTexture(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const cColor = document.createElement('canvas');
  const cRough = document.createElement('canvas');
  cColor.width = cRough.width = 256;
  cColor.height = cRough.height = 256;

  const ctxC = cColor.getContext('2d');
  const ctxR = cRough.getContext('2d');
  if (ctxC && ctxR) {
    ctxC.fillStyle = '#3d4554';
    ctxC.fillRect(0, 0, 256, 256);
    ctxR.fillStyle = '#686868';
    ctxR.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y++) {
      const streak = Math.sin(y * 1.7) * 10 + Math.cos(y * 0.43) * 8;
      const v = Math.max(40, Math.min(200, Math.round(78 + streak)));
      ctxC.fillStyle = `rgb(${v},${v + 5},${v + 12})`;
      ctxC.fillRect(0, y, 256, 1);
      const r = Math.max(55, Math.min(180, Math.round(98 - streak * 1.4)));
      ctxR.fillStyle = `rgb(${r},${r},${r})`;
      ctxR.fillRect(0, y, 256, 1);
    }
    // Crisp technical panel seam lines
    ctxC.strokeStyle = '#1d222b';
    ctxC.lineWidth = 2;
    ctxC.strokeRect(10, 10, 236, 236);
  }

  const map = new THREE.CanvasTexture(cColor);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(cRough);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = maxAnisotropy;

  return { map, roughnessMap, bumpMap: roughnessMap };
}

/**
 * Builds an articulated, genuinely rigged 5-Bone Kinetic Studio Lamp / Robotic Arm
 * (`THREE.Bone` hierarchy + `THREE.Skeleton` + `AnimationClip`s + PBR texture maps)
 * so users selecting this on-demand specimen can immediately inspect:
 *   - SkeletonHelper & Bone Pose Rotation Sliders
 *   - Keyframed AnimationClip Playback & Timeline Scrubbing
 *   - Texture Channel Inspector (Albedo, Roughness, Bump, Emissive)
 *   - Inside-Out Cross-Section Cut & Outliner Per-Asset Hide/Show
 */
export function createRiggedArmSpecimen(maxAnisotropy: number): {
  group: THREE.Group;
  animations: THREE.AnimationClip[];
  bones: THREE.Bone[];
  dispose: () => void;
} {
  const root = new THREE.Group();
  root.name = 'Rigged_Studio_Arm';

  const metalTex = createBrushedMetalTexture(maxAnisotropy);

  const chassisMat = new THREE.MeshStandardMaterial({
    name: 'BrushedTitaniumChassis',
    color: 0xffffff,
    map: metalTex.map,
    roughnessMap: metalTex.roughnessMap,
    bumpMap: metalTex.bumpMap,
    bumpScale: 0.008,
    metalness: 0.78,
    roughness: 0.36,
  });

  const copperJointMat = new THREE.MeshStandardMaterial({
    name: 'MachinedCopperServo',
    color: 0xc9793d,
    metalness: 0.88,
    roughness: 0.24,
  });

  const carbonMat = new THREE.MeshStandardMaterial({
    name: 'MatteCarbonHousing',
    color: 0x1c2028,
    metalness: 0.18,
    roughness: 0.72,
  });

  const lensMat = new THREE.MeshStandardMaterial({
    name: 'OpticalEmitterRing',
    color: 0xfff2dc,
    emissive: new THREE.Color(0xff9b42),
    emissiveIntensity: 1.65,
    metalness: 0.1,
    roughness: 0.2,
  });

  // Grounded circular heavy plinth
  const basePlinth = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.52, 0.12, 32), carbonMat);
  basePlinth.name = 'Base_Plinth';
  basePlinth.position.y = 0.06;
  basePlinth.castShadow = true;
  basePlinth.receiveShadow = true;
  root.add(basePlinth);

  const baseRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.022, 16, 48), copperJointMat);
  baseRing.name = 'Base_Copper_Trim';
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.y = 0.125;
  root.add(baseRing);

  // Articulated 5-bone kinematic chain
  const rootBone = new THREE.Bone();
  rootBone.name = 'Bone_Root_Turret';
  rootBone.position.set(0, 0.12, 0);

  const shoulderBone = new THREE.Bone();
  shoulderBone.name = 'Bone_Shoulder';
  shoulderBone.position.set(0, 0.24, 0);
  rootBone.add(shoulderBone);

  const elbowBone = new THREE.Bone();
  elbowBone.name = 'Bone_Elbow';
  elbowBone.position.set(0, 0.62, 0);
  shoulderBone.add(elbowBone);

  const wristBone = new THREE.Bone();
  wristBone.name = 'Bone_Wrist';
  wristBone.position.set(0, 0.52, 0);
  elbowBone.add(wristBone);

  const headBone = new THREE.Bone();
  headBone.name = 'Bone_OpticalHead';
  headBone.position.set(0, 0.18, 0.12);
  wristBone.add(headBone);

  root.add(rootBone);

  // Attach articulated mechanical meshes directly to their controlling bones
  const turretHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.30, 0.22, 24), chassisMat);
  turretHousing.name = 'Turret_Housing';
  turretHousing.position.y = 0.11;
  turretHousing.castShadow = true;
  rootBone.add(turretHousing);

  const shoulderDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.28, 24), copperJointMat);
  shoulderDrum.name = 'Shoulder_Servo_Drum';
  shoulderDrum.rotation.z = Math.PI / 2;
  shoulderDrum.castShadow = true;
  shoulderBone.add(shoulderDrum);

  const lowerStrutL = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.58, 0.11), chassisMat);
  lowerStrutL.name = 'Lower_Arm_Strut_L';
  lowerStrutL.position.set(-0.095, 0.31, 0);
  lowerStrutL.castShadow = true;
  const lowerStrutR = lowerStrutL.clone();
  lowerStrutR.name = 'Lower_Arm_Strut_R';
  lowerStrutR.position.set(0.095, 0.31, 0);
  const hydraulicCore = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.52, 16), carbonMat);
  hydraulicCore.name = 'Lower_Hydraulic_Core';
  hydraulicCore.position.set(0, 0.31, 0);
  shoulderBone.add(lowerStrutL, lowerStrutR, hydraulicCore);

  const elbowDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.24, 24), copperJointMat);
  elbowDrum.name = 'Elbow_Servo_Drum';
  elbowDrum.rotation.z = Math.PI / 2;
  elbowDrum.castShadow = true;
  elbowBone.add(elbowDrum);

  const upperBoom = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.48, 0.095), chassisMat);
  upperBoom.name = 'Upper_Arm_Boom';
  upperBoom.position.set(0, 0.26, 0);
  upperBoom.castShadow = true;
  elbowBone.add(upperBoom);

  const wristJoint = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 16), copperJointMat);
  wristJoint.name = 'Wrist_Ball_Joint';
  wristJoint.castShadow = true;
  wristBone.add(wristJoint);

  // Hollow optical scanner head (great for Inside-Out & Section Cut inspection!)
  const headShell = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.21, 0.24, 28, 1, false), carbonMat);
  headShell.name = 'Optical_Head_Cowl';
  headShell.rotation.x = Math.PI / 2;
  headShell.castShadow = true;
  const headInnerCore = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.18, 20), copperJointMat);
  headInnerCore.name = 'Optical_Inner_Core';
  headInnerCore.rotation.x = Math.PI / 2;
  const emitterRing = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.018, 14, 32), lensMat);
  emitterRing.name = 'Optical_Emitter_Ring';
  emitterRing.position.z = 0.118;
  headBone.add(headShell, headInnerCore, emitterRing);

  // Default poised posture
  shoulderBone.rotation.x = -0.32;
  elbowBone.rotation.x = 0.85;
  wristBone.rotation.x = 0.25;

  // Build 2 real Three.js AnimationClips for timeline playback & scrubbing
  const scanClip = new THREE.AnimationClip('Studio_Scan_Cycle', 4.0, [
    new THREE.NumberKeyframeTrack('Bone_Root_Turret.rotation[y]', [0, 1, 2, 3, 4], [0, 0.85, 0, -0.85, 0]),
    new THREE.NumberKeyframeTrack('Bone_Shoulder.rotation[x]', [0, 1, 2, 3, 4], [-0.32, -0.52, -0.22, -0.52, -0.32]),
    new THREE.NumberKeyframeTrack('Bone_Elbow.rotation[x]', [0, 1, 2, 3, 4], [0.85, 1.12, 0.65, 1.12, 0.85]),
    new THREE.NumberKeyframeTrack('Bone_Wrist.rotation[z]', [0, 1, 2, 3, 4], [0, 0.35, 0, -0.35, 0]),
  ]);

  const inspectClip = new THREE.AnimationClip('Precision_Focus_Nod', 3.0, [
    new THREE.NumberKeyframeTrack('Bone_Shoulder.rotation[x]', [0, 1.5, 3], [-0.25, -0.62, -0.25]),
    new THREE.NumberKeyframeTrack('Bone_Elbow.rotation[x]', [0, 1.5, 3], [0.7, 1.25, 0.7]),
    new THREE.NumberKeyframeTrack('Bone_OpticalHead.rotation[x]', [0, 1.5, 3], [0.1, -0.35, 0.1]),
  ]);

  const bones = [rootBone, shoulderBone, elbowBone, wristBone, headBone];

  const dispose = () => {
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        (obj as THREE.Mesh).geometry.dispose();
      }
    });
    chassisMat.dispose();
    copperJointMat.dispose();
    carbonMat.dispose();
    lensMat.dispose();
    metalTex.map.dispose();
    metalTex.roughnessMap.dispose();
  };

  return { group: root, animations: [scanClip, inspectClip], bones, dispose };
}
