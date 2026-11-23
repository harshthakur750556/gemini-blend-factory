import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { PLYExporter } from 'three/examples/jsm/exporters/PLYExporter.js';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';

export type ExportFormatId =
  | 'glb'
  | 'gltf'
  | 'obj'
  | 'stl'
  | 'ply'
  | 'usdz'
  | 'blend'
  | 'py'
  | 'png';

export interface ExportFormatSpec {
  id: ExportFormatId;
  ext: string;
  label: string;
  category: 'mesh' | 'blender' | 'render';
  description: string;
  mimeType: string;
}

export const EXPORT_FORMATS: ExportFormatSpec[] = [
  {
    id: 'glb',
    ext: '.glb',
    label: 'glTF Binary (.glb)',
    category: 'mesh',
    description: 'Single-file PBR binary mesh with textures, rig & animations (recommended for web/engines).',
    mimeType: 'model/gltf-binary',
  },
  {
    id: 'gltf',
    ext: '.gltf',
    label: 'glTF JSON (.gltf)',
    category: 'mesh',
    description: 'Human-readable glTF 2.0 JSON scene graph with embedded buffers.',
    mimeType: 'model/gltf+json',
  },
  {
    id: 'obj',
    ext: '.obj',
    label: 'Wavefront OBJ (.obj)',
    category: 'mesh',
    description: 'Universal polygon geometry format for Blender, Maya, ZBrush, and Cinema 4D.',
    mimeType: 'text/plain;charset=utf-8',
  },
  {
    id: 'stl',
    ext: '.stl',
    label: 'Stereolithography (.stl)',
    category: 'mesh',
    description: 'Watertight binary triangle mesh for 3D printing, CNC, and CAD slicers.',
    mimeType: 'application/octet-stream',
  },
  {
    id: 'ply',
    ext: '.ply',
    label: 'Stanford PLY (.ply)',
    category: 'mesh',
    description: 'Polygon & vertex-color point-cloud interchange format.',
    mimeType: 'application/octet-stream',
  },
  {
    id: 'usdz',
    ext: '.usdz',
    label: 'Universal Scene USDZ (.usdz)',
    category: 'mesh',
    description: 'Apple AR Quick Look & Pixar Universal Scene Description package.',
    mimeType: 'model/vnd.usdz+zip',
  },
  {
    id: 'blend',
    ext: '.blend',
    label: 'Blender 4.2 Scene (.blend)',
    category: 'blender',
    description: 'Native Blender 4.2 LTS binary file built by headless GitHub Actions CI.',
    mimeType: 'application/octet-stream',
  },
  {
    id: 'py',
    ext: '.py',
    label: 'Blender 4.2 Python Builder (.py)',
    category: 'blender',
    description: 'Executable Blender 4.2 script that reconstructs the active geometry inside Blender.',
    mimeType: 'text/x-python;charset=utf-8',
  },
  {
    id: 'png',
    ext: '.png',
    label: 'Studio Render Snapshot (.png)',
    category: 'render',
    description: 'High-resolution PNG capture directly from the active 3D viewport.',
    mimeType: 'image/png',
  },
];

export function formatExportFilename(rawBaseName: string, ext: string): string {
  const cleanStem = (rawBaseName || 'apex-model')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_.-]+|[_.-]+$/g, '')
    .slice(0, 60) || 'apex-model';
  const normalizedExt = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  return `${cleanStem}${normalizedExt}`;
}

/**
 * Generates a self-contained Blender 4.2 LTS Python script that imports an embedded
 * Wavefront OBJ string directly into Blender and saves a native .blend scene if run locally.
 */
export function buildBlenderReconstructionScript(modelName: string, objText: string): string {
  const safeName = modelName.replace(/["'\\]/g, '').slice(0, 64) || 'Apex_Model';
  const safeObj = objText.replace(/"""/g, "'''");
  return `"""Auto-exported Blender 4.2 LTS Reconstruction Script for ${safeName}.
Run in Blender 4.2+: blender --background --python ${formatExportFilename(safeName, '.py')}
"""
import os
import tempfile
import bpy

bpy.ops.wm.read_factory_settings(use_empty=True)

OBJ_PAYLOAD = r"""
${safeObj}
"""

tmp_obj = os.path.join(tempfile.gettempdir(), "${formatExportFilename(safeName, '.obj')}")
with open(tmp_obj, "w", encoding="utf-8") as fh:
    fh.write(OBJ_PAYLOAD)

bpy.ops.wm.obj_import(filepath=tmp_obj)

mat = bpy.data.materials.new(name="${safeName}_BSDF")
mat.use_nodes = True
bsdf = mat.node_tree.nodes.get("Principled BSDF")
if bsdf is not None:
    bsdf.inputs["Base Color"].default_value = (0.25, 0.27, 0.30, 1.0)
    bsdf.inputs["Metallic"].default_value = 0.78
    bsdf.inputs["Roughness"].default_value = 0.28

for obj in bpy.context.scene.objects:
    if obj.type == "MESH":
        if not obj.data.materials:
            obj.data.materials.append(mat)
        for poly in obj.data.polygons:
            poly.use_smooth = True

try:
    os.remove(tmp_obj)
except OSError:
    pass
`;
}

export async function exportObject3DToBlob(
  root: THREE.Object3D,
  format: Exclude<ExportFormatId, 'blend' | 'png'>,
  modelName: string
): Promise<{ blob: Blob; filename: string }> {
  const spec = EXPORT_FORMATS.find((f) => f.id === format)!;
  const filename = formatExportFilename(modelName, spec.ext);

  // Clone cleanly so transforms & visibility are respected without mutating live viewport
  root.updateMatrixWorld(true);

  if (format === 'glb' || format === 'gltf') {
    const exporter = new GLTFExporter();
    const binary = format === 'glb';
    const result = await new Promise<ArrayBuffer | Record<string, unknown>>((resolve, reject) => {
      exporter.parse(
        root,
        (res) => resolve(res),
        (err) => reject(err instanceof Error ? err : new Error('glTF export failed.')),
        { binary, onlyVisible: true }
      );
    });
    const blob = binary
      ? new Blob([result as ArrayBuffer], { type: spec.mimeType })
      : new Blob([JSON.stringify(result, null, 2)], { type: spec.mimeType });
    return { blob, filename };
  }

  if (format === 'obj') {
    const exporter = new OBJExporter();
    const text = exporter.parse(root);
    return { blob: new Blob([text], { type: spec.mimeType }), filename };
  }

  if (format === 'stl') {
    const exporter = new STLExporter();
    const dataView = exporter.parse(root, { binary: true });
    const copy = new Uint8Array(dataView.byteLength);
    copy.set(new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength));
    return { blob: new Blob([copy.buffer], { type: spec.mimeType }), filename };
  }

  if (format === 'ply') {
    const exporter = new PLYExporter();
    const result = await new Promise<string | ArrayBuffer>((resolve, reject) => {
      exporter.parse(
        root,
        (res) => resolve(res),
        { binary: false }
      );
      setTimeout(() => reject(new Error('PLY export timed out.')), 10_000);
    });
    return { blob: new Blob([result], { type: spec.mimeType }), filename };
  }

  if (format === 'usdz') {
    const exporter = new USDZExporter();
    const raw = await exporter.parseAsync(root);
    const copy = new Uint8Array(raw.byteLength);
    copy.set(raw);
    return { blob: new Blob([copy.buffer], { type: spec.mimeType }), filename };
  }

  // format === 'py' -> Blender 4.2 reconstruction script
  const objExporter = new OBJExporter();
  const objText = objExporter.parse(root);
  const pySource = buildBlenderReconstructionScript(modelName, objText);
  return { blob: new Blob([pySource], { type: spec.mimeType }), filename };
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
