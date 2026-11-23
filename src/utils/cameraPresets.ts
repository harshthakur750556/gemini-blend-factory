export type BlenderCameraPreset =
  | 'front'
  | 'back'
  | 'right'
  | 'left'
  | 'top'
  | 'bottom'
  | 'hero';

export interface Vec3Tuple {
  x: number;
  y: number;
  z: number;
}

/**
 * Returns the camera offset direction (normalized unit vector) for each standard
 * Blender Numpad camera preset (1=Front, Ctrl+1=Back, 3=Right, Ctrl+3=Left,
 * 7=Top, Ctrl+7=Bottom, 0=Hero 3/4).
 */
export function getBlenderPresetOffset(
  preset: BlenderCameraPreset,
  distance: number
): Vec3Tuple {
  const d = Math.max(0.5, distance);
  switch (preset) {
    case 'front':
      return { x: 0, y: 0, z: d };
    case 'back':
      return { x: 0, y: 0, z: -d };
    case 'right':
      return { x: d, y: 0, z: 0 };
    case 'left':
      return { x: -d, y: 0, z: 0 };
    case 'top':
      // Slight +Z epsilon avoids gimbal lock with Y-up OrbitControls
      return { x: 0, y: d, z: 0.001 };
    case 'bottom':
      return { x: 0, y: -d, z: 0.001 };
    case 'hero':
    default: {
      const len = Math.hypot(0.72, 0.44, 0.8);
      return {
        x: (0.72 / len) * d,
        y: (0.44 / len) * d,
        z: (0.8 / len) * d,
      };
    }
  }
}

/**
 * Rotates an offset vector around Y (azimuth) or elevation (polar) by Blender's
 * 15-degree Numpad 4/6/8/2 incremental orbit step.
 */
export function applyBlenderOrbitStep(
  offset: Vec3Tuple,
  direction: 'left' | 'right' | 'up' | 'down',
  stepDeg = 15
): Vec3Tuple {
  const rad = (stepDeg * Math.PI) / 180;
  const r = Math.hypot(offset.x, offset.y, offset.z) || 1;
  let theta = Math.atan2(offset.x, offset.z);
  let phi = Math.acos(Math.max(-1, Math.min(1, offset.y / r)));

  if (direction === 'left') theta -= rad;
  if (direction === 'right') theta += rad;
  if (direction === 'up') phi = Math.max(0.08, phi - rad);
  if (direction === 'down') phi = Math.min(Math.PI - 0.08, phi + rad);

  return {
    x: r * Math.sin(phi) * Math.sin(theta),
    y: r * Math.cos(phi),
    z: r * Math.sin(phi) * Math.cos(theta),
  };
}
