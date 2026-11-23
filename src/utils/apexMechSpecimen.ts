import * as THREE from 'three';

function createArmorPanelTexture(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 256;
  const cCol = document.createElement('canvas');
  const cRough = document.createElement('canvas');
  cCol.width = cRough.width = size;
  cCol.height = cRough.height = size;
  const ctxC = cCol.getContext('2d');
  const ctxR = cRough.getContext('2d');

  if (ctxC && ctxR) {
    ctxC.fillStyle = '#40444c';
    ctxC.fillRect(0, 0, size, size);
    ctxR.fillStyle = '#5a5a5a';
    ctxR.fillRect(0, 0, size, size);

    for (let y = 0; y < size; y++) {
      const grain = Math.sin(y * 1.3) * 6 + Math.cos(y * 0.45) * 5;
      const v = Math.max(46, Math.min(115, Math.round(68 + grain)));
      ctxC.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
      ctxC.fillRect(0, y, size, 1);

      const r = Math.max(40, Math.min(170, Math.round(78 - grain * 1.5)));
      ctxR.fillStyle = `rgb(${r},${r},${r})`;
      ctxR.fillRect(0, y, size, 1);
    }

    // Crisp monochrome CNC armor seams & fastener rivets
    ctxC.strokeStyle = '#181c22';
    ctxC.lineWidth = 3;
    ctxC.strokeRect(12, 12, size - 24, size - 24);
    ctxC.beginPath();
    ctxC.moveTo(12, size * 0.5);
    ctxC.lineTo(size - 12, size * 0.5);
    ctxC.stroke();

    ctxR.strokeStyle = '#b4b4b4';
    ctxR.lineWidth = 3;
    ctxR.strokeRect(12, 12, size - 24, size - 24);

    for (const [rx, ry] of [
      [26, 26],
      [size - 26, 26],
      [26, size - 26],
      [size - 26, size - 26],
    ]) {
      ctxC.fillStyle = '#111318';
      ctxC.beginPath();
      ctxC.arc(rx, ry, 4, 0, Math.PI * 2);
      ctxC.fill();
    }
  }

  const map = new THREE.CanvasTexture(cCol);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(cRough);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = maxAnisotropy;

  return { map, roughnessMap, bumpMap: roughnessMap };
}

/**
 * Builds the signature multi-part hard-surface `Apex_Titan_Mk4` mechanical rig
 * with the exact 5 inspectable assemblies from the Apex 3D Outliner:
 *   - Sub_Chassis_Hull
 *   - Cockpit_Canopy_Armor
 *   - Hydraulic_Pistons_Rig
 *   - Shoulder_Gatling_Pods
 *   - Bipedal_Leg_Struts
 * Complete with 4 real `THREE.Bone` articulation joints, PBR textures, and an idle scan AnimationClip.
 */
export function createApexMechSpecimen(maxAnisotropy: number): {
  group: THREE.Group;
  animations: THREE.AnimationClip[];
  bones: THREE.Bone[];
  dispose: () => void;
} {
  const root = new THREE.Group();
  root.name = 'Apex_Titan_Mk4';

  const tex = createArmorPanelTexture(maxAnisotropy);

  const hullMat = new THREE.MeshStandardMaterial({
    name: 'M_Titanium_Apex_Composite',
    color: 0x40444c,
    map: tex.map,
    roughnessMap: tex.roughnessMap,
    bumpMap: tex.bumpMap,
    bumpScale: 0.012,
    metalness: 0.82,
    roughness: 0.24,
  });

  const frameMat = new THREE.MeshStandardMaterial({
    name: 'M_Obsidian_Frame_Alloy',
    color: 0x1e242d,
    metalness: 0.72,
    roughness: 0.38,
  });

  const chromePistonMat = new THREE.MeshStandardMaterial({
    name: 'M_Hydraulic_Chrome',
    color: 0xcbd5e1,
    metalness: 0.94,
    roughness: 0.14,
  });

  const canopyMat = new THREE.MeshStandardMaterial({
    name: 'M_Optic_Canopy_Glass',
    color: 0x334155,
    emissive: new THREE.Color(0x64748b),
    emissiveIntensity: 0.65,
    metalness: 0.25,
    roughness: 0.12,
  });

  // Bone Rig Hierarchy
  const pelvisBone = new THREE.Bone();
  pelvisBone.name = 'Bone_Pelvis_Core';
  pelvisBone.position.set(0, 0.88, 0);

  const torsoBone = new THREE.Bone();
  torsoBone.name = 'Bone_Torso_Yaw';
  torsoBone.position.set(0, 0.28, 0);
  pelvisBone.add(torsoBone);

  const leftPodBone = new THREE.Bone();
  leftPodBone.name = 'Bone_Gatling_Pod_L';
  leftPodBone.position.set(-0.62, 0.24, 0.02);
  torsoBone.add(leftPodBone);

  const rightPodBone = new THREE.Bone();
  rightPodBone.name = 'Bone_Gatling_Pod_R';
  rightPodBone.position.set(0.62, 0.24, 0.02);
  torsoBone.add(rightPodBone);

  root.add(pelvisBone);

  // 1. Sub_Chassis_Hull
  const chassisGroup = new THREE.Group();
  chassisGroup.name = 'Sub_Chassis_Hull';

  const coreBlock = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.56, 0.68), hullMat);
  coreBlock.name = 'Chassis_Core_Block';
  coreBlock.position.set(0, 0.18, -0.04);
  coreBlock.castShadow = true;

  const upperDeck = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.14, 0.74), hullMat);
  upperDeck.name = 'Chassis_Upper_Deck';
  upperDeck.position.set(0, 0.48, -0.02);
  upperDeck.castShadow = true;

  const rearReactor = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.42, 8), frameMat);
  rearReactor.name = 'Chassis_Rear_Reactor';
  rearReactor.rotation.x = Math.PI / 2;
  rearReactor.position.set(0, 0.22, -0.44);
  chassisGroup.add(coreBlock, upperDeck, rearReactor);
  torsoBone.add(chassisGroup);

  // 2. Cockpit_Canopy_Armor
  const cockpitGroup = new THREE.Group();
  cockpitGroup.name = 'Cockpit_Canopy_Armor';

  const cowlMain = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.32, 0.42), hullMat);
  cowlMain.name = 'Cockpit_Armor_Cowl';
  cowlMain.position.set(0, 0.22, 0.34);
  cowlMain.rotation.x = 0.16;

  const visorGlass = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.14), canopyMat);
  visorGlass.name = 'Cockpit_Optic_Visor';
  visorGlass.position.set(0, 0.25, 0.52);
  visorGlass.rotation.x = 0.16;

  const sensorFin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.22), frameMat);
  sensorFin.name = 'Cockpit_Sensor_Fin';
  sensorFin.position.set(0, 0.62, 0.08);
  cockpitGroup.add(cowlMain, visorGlass, sensorFin);
  torsoBone.add(cockpitGroup);

  // 3. Hydraulic_Pistons_Rig
  const hydraulicsGroup = new THREE.Group();
  hydraulicsGroup.name = 'Hydraulic_Pistons_Rig';

  const waistColumn = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.32, 20), frameMat);
  waistColumn.name = 'Pelvis_Gyro_Column';
  waistColumn.position.set(0, 0.06, 0);
  hydraulicsGroup.add(waistColumn);

  for (const side of [-1, 1]) {
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.34, 14), frameMat);
    sleeve.name = `Hydraulic_Sleeve_${side < 0 ? 'L' : 'R'}`;
    sleeve.position.set(side * 0.28, 0.08, 0.14);
    sleeve.rotation.z = side * 0.18;

    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.42, 14), chromePistonMat);
    rod.name = `Hydraulic_Rod_${side < 0 ? 'L' : 'R'}`;
    rod.position.set(side * 0.28, 0.12, 0.14);
    rod.rotation.z = side * 0.18;

    hydraulicsGroup.add(sleeve, rod);
  }
  pelvisBone.add(hydraulicsGroup);

  // 4. Shoulder_Gatling_Pods (mounted on left & right pod bones)
  const buildPod = (label: string, mirror: number, parentBone: THREE.Bone) => {
    const pod = new THREE.Group();
    pod.name = `Shoulder_Gatling_Pod_${label}`;

    const mount = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, 0.42), hullMat);
    mount.name = `Gatling_Housing_${label}`;
    mount.castShadow = true;

    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.36, 0.48), hullMat);
    shield.name = `Shoulder_Shield_${label}`;
    shield.position.set(mirror * 0.17, 0.04, 0);

    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.52, 16), frameMat);
    drum.name = `Gatling_Barrel_Assembly_${label}`;
    drum.rotation.x = Math.PI / 2;
    drum.position.set(0, -0.02, 0.36);

    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.098, 0.08, 16), chromePistonMat);
    muzzle.name = `Gatling_Muzzle_Ring_${label}`;
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, -0.02, 0.60);

    pod.add(mount, shield, drum, muzzle);
    parentBone.add(pod);
  };
  buildPod('L', -1, leftPodBone);
  buildPod('R', 1, rightPodBone);

  // 5. Bipedal_Leg_Struts
  const legsGroup = new THREE.Group();
  legsGroup.name = 'Bipedal_Leg_Struts';

  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'L' : 'R';
    const hipJoint = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.22, 18), frameMat);
    hipJoint.name = `Hip_Servo_${tag}`;
    hipJoint.rotation.z = Math.PI / 2;
    hipJoint.position.set(side * 0.34, 0.84, 0);

    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.46, 0.26), hullMat);
    thigh.name = `Upper_Thigh_Strut_${tag}`;
    thigh.position.set(side * 0.44, 0.64, 0.06);
    thigh.rotation.x = -0.24;
    thigh.castShadow = true;

    const knee = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.24, 16), chromePistonMat);
    knee.name = `Knee_Actuator_${tag}`;
    knee.rotation.z = Math.PI / 2;
    knee.position.set(side * 0.44, 0.42, 0.14);

    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.42, 0.22), hullMat);
    shin.name = `Lower_Shin_Strut_${tag}`;
    shin.position.set(side * 0.44, 0.24, 0.04);
    shin.rotation.x = 0.22;
    shin.castShadow = true;

    const footPad = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.09, 0.48), frameMat);
    footPad.name = `Ground_Foot_Pad_${tag}`;
    footPad.position.set(side * 0.44, 0.045, 0.08);
    footPad.castShadow = true;

    const toeGuard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.18), hullMat);
    toeGuard.name = `Foot_Toe_Guard_${tag}`;
    toeGuard.position.set(side * 0.44, 0.065, 0.32);

    legsGroup.add(hipJoint, thigh, knee, shin, footPad, toeGuard);
  }
  root.add(legsGroup);

  // Subtle Combat Idle Scan Animation Clip
  const scanClip = new THREE.AnimationClip('Apex_Tactical_Scan', 4.5, [
    new THREE.NumberKeyframeTrack('Bone_Torso_Yaw.rotation[y]', [0, 1.1, 2.25, 3.4, 4.5], [0, 0.32, 0, -0.32, 0]),
    new THREE.NumberKeyframeTrack('Bone_Gatling_Pod_L.rotation[x]', [0, 1.1, 2.25, 3.4, 4.5], [0, -0.18, 0.06, -0.14, 0]),
    new THREE.NumberKeyframeTrack('Bone_Gatling_Pod_R.rotation[x]', [0, 1.1, 2.25, 3.4, 4.5], [0, 0.08, -0.16, 0.05, 0]),
  ]);

  const bones = [pelvisBone, torsoBone, leftPodBone, rightPodBone];

  const dispose = () => {
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        (obj as THREE.Mesh).geometry.dispose();
      }
    });
    hullMat.dispose();
    frameMat.dispose();
    chromePistonMat.dispose();
    canopyMat.dispose();
    tex.map.dispose();
    tex.roughnessMap.dispose();
  };

  return { group: root, animations: [scanClip], bones, dispose };
}
