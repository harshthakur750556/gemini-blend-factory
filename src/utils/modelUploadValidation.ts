export const ALLOWED_MODEL_EXTENSIONS = [
  '.glb',
  '.gltf',
  '.obj',
  '.stl',
  '.ply',
  '.fbx',
  '.dae',
  '.usdz',
  '.usda',
  '.step',
  '.stp',
  '.dxf',
  '.3mf',
  '.off',
  '.amf',
  '.blend',
] as const;

export const VIEWABLE_3D_EXTENSIONS = new Set<string>([
  '.glb',
  '.gltf',
  '.obj',
  '.stl',
  '.ply',
  '.fbx',
  '.dae',
  '.3mf',
  '.amf',
  '.off',
  '.dxf',
]);

export const MAX_MODEL_UPLOAD_BYTES = 18 * 1024 * 1024; // 18 MB

export interface ModelUploadValidation {
  valid: boolean;
  sanitizedName?: string;
  extension?: string;
  reason?: string;
}

/**
 * Validates and sanitizes a custom 3D model filename before importing locally,
 * converting formats, or uploading to GitHub (`models/<slug>/<sanitizedName>`) or Google Drive.
 */
export function validateModelUpload(
  rawFileName: string,
  sizeBytes: number
): ModelUploadValidation {
  if (typeof rawFileName !== 'string' || !rawFileName.trim()) {
    return { valid: false, reason: 'Filename is required.' };
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return { valid: false, reason: 'Model file appears to be empty.' };
  }
  if (sizeBytes > MAX_MODEL_UPLOAD_BYTES) {
    return {
      valid: false,
      reason: `File exceeds the ${Math.round(MAX_MODEL_UPLOAD_BYTES / (1024 * 1024))}MB upload limit.`,
    };
  }

  const baseName = rawFileName.split(/[\\/]/).pop()?.trim() || '';
  const dotIdx = baseName.lastIndexOf('.');
  if (dotIdx <= 0) {
    return {
      valid: false,
      reason: 'File must include a supported 3D extension (.glb, .gltf, .obj, .stl, .fbx, .dae, .ply, .usdz, .step, .dxf, .3mf, .off, .blend).',
    };
  }

  const ext = baseName.slice(dotIdx).toLowerCase();
  if (!(ALLOWED_MODEL_EXTENSIONS as readonly string[]).includes(ext)) {
    return {
      valid: false,
      reason: `Unsupported file type "${ext}". Supported formats: ${ALLOWED_MODEL_EXTENSIONS.join(', ')}.`,
    };
  }

  const stem = baseName
    .slice(0, dotIdx)
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 64);

  if (!stem) {
    return { valid: false, reason: 'Filename contains no valid alphanumeric characters.' };
  }

  return {
    valid: true,
    sanitizedName: `${stem}${ext}`,
    extension: ext,
  };
}
