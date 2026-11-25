import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { PLYExporter } from 'three/examples/jsm/exporters/PLYExporter.js';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';

export type ExportFormatId =
  | 'glb'
  | 'gltf'
  | 'fbx'
  | 'dae'
  | 'usdz'
  | 'usda'
  | 'obj'
  | 'stl'
  | 'step'
  | 'dxf'
  | '3mf'
  | 'ply'
  | 'off'
  | 'blend'
  | 'py'
  | 'png';

export interface ExportFormatSpec {
  id: ExportFormatId;
  ext: string;
  label: string;
  category: 'engine' | 'cad' | 'mesh' | 'blender' | 'render';
  description: string;
  mimeType: string;
}

export const EXPORT_FORMATS: ExportFormatSpec[] = [
  {
    id: 'glb',
    ext: '.glb',
    label: 'glTF Binary (.glb)',
    category: 'engine',
    description: 'Single-file PBR binary with textures, rigs & animations for web, Three.js, Godot & Unreal.',
    mimeType: 'model/gltf-binary',
  },
  {
    id: 'fbx',
    ext: '.fbx',
    label: 'Autodesk FBX 7.4 (.fbx)',
    category: 'engine',
    description: 'ASCII FBX 7.4 scene with mesh topology, normals, UVs & materials for Unreal Engine, Unity & Maya.',
    mimeType: 'text/plain;charset=utf-8',
  },
  {
    id: 'dae',
    ext: '.dae',
    label: 'COLLADA 1.4.1 (.dae)',
    category: 'engine',
    description: 'Open-standard XML 3D interchange for Godot, Unreal Engine, Cinema 4D, and SketchUp.',
    mimeType: 'model/vnd.collada+xml;charset=utf-8',
  },
  {
    id: 'usdz',
    ext: '.usdz',
    label: 'Universal Scene USDZ (.usdz)',
    category: 'engine',
    description: 'Apple AR Quick Look, RealityKit, Unreal Engine & Pixar USD packaged scene.',
    mimeType: 'model/vnd.usdz+zip',
  },
  {
    id: 'usda',
    ext: '.usda',
    label: 'Pixar USD ASCII (.usda)',
    category: 'engine',
    description: 'Human-readable Universal Scene Description layer for NVIDIA Omniverse, Houdini & Unreal.',
    mimeType: 'text/plain;charset=utf-8',
  },
  {
    id: 'gltf',
    ext: '.gltf',
    label: 'glTF 2.0 JSON (.gltf)',
    category: 'mesh',
    description: 'Inspectable glTF 2.0 JSON scene graph with embedded geometry buffers.',
    mimeType: 'model/gltf+json',
  },
  {
    id: 'obj',
    ext: '.obj',
    label: 'Wavefront OBJ (.obj)',
    category: 'mesh',
    description: 'Universal polygon geometry format for Blender, Maya, ZBrush, and 3ds Max.',
    mimeType: 'text/plain;charset=utf-8',
  },
  {
    id: 'stl',
    ext: '.stl',
    label: 'Stereolithography (.stl)',
    category: 'cad',
    description: 'Watertight binary triangle mesh for 3D printing, CNC milling, and CAD slicers.',
    mimeType: 'application/octet-stream',
  },
  {
    id: 'step',
    ext: '.step',
    label: 'ISO STEP CAD (.step)',
    category: 'cad',
    description: 'ISO-10303-21 AP214 faceted CAD boundary representation for Fusion 360, SolidWorks & FreeCAD.',
    mimeType: 'application/step;charset=utf-8',
  },
  {
    id: 'dxf',
    ext: '.dxf',
    label: 'AutoCAD DXF (.dxf)',
    category: 'cad',
    description: 'AutoCAD 3DFACE vector geometry exchange for Rhino, AutoCAD, and Revit.',
    mimeType: 'application/dxf;charset=utf-8',
  },
  {
    id: '3mf',
    ext: '.3mf',
    label: '3D Manufacturing (.3mf)',
    category: 'cad',
    description: 'Modern XML 3D printing & additive manufacturing mesh model definition.',
    mimeType: 'model/3mf+xml;charset=utf-8',
  },
  {
    id: 'ply',
    ext: '.ply',
    label: 'Stanford PLY (.ply)',
    category: 'mesh',
    description: 'Polygon & vertex-color point-cloud interchange format for scanning & photogrammetry.',
    mimeType: 'application/octet-stream',
  },
  {
    id: 'off',
    ext: '.off',
    label: 'Object File Format (.off)',
    category: 'mesh',
    description: 'Clean indexed polygon mesh format for MeshLab, CGAL, and geometry processing.',
    mimeType: 'text/plain;charset=utf-8',
  },
  {
    id: 'blend',
    ext: '.blend',
    label: 'Blender 4.2 Scene (.blend)',
    category: 'blender',
    description: 'Native Blender 4.2 LTS binary file compiled by headless GitHub Actions CI.',
    mimeType: 'application/octet-stream',
  },
  {
    id: 'py',
    ext: '.py',
    label: 'Blender 4.2 Script (.py)',
    category: 'blender',
    description: 'Executable Blender 4.2 Python script that reconstructs the active geometry in Blender.',
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
  const cleanStem =
    (rawBaseName || 'studio-model')
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[^A-Za-z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^[_.-]+|[_.-]+$/g, '')
      .slice(0, 60) || 'studio-model';
  const normalizedExt = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  return `${cleanStem}${normalizedExt}`;
}

export interface FlattenedMeshData {
  name: string;
  vertices: number[]; // flat xyz in world space
  normals: number[]; // flat xyz per triangle corner
  uvs: number[]; // flat uv per triangle corner
  triangles: number[]; // flat i0,i1,i2 vertex indices
  colorRgb: [number, number, number];
}

/**
 * Extracts all visible mesh geometry in world space from any Three.js Object3D hierarchy.
 */
export function extractFlattenedMeshes(root: THREE.Object3D): FlattenedMeshData[] {
  root.updateMatrixWorld(true);
  const results: FlattenedMeshData[] = [];
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const normalMat = new THREE.Matrix3();

  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh || !obj.visible) return;
    const mesh = obj as THREE.Mesh;
    const geom = mesh.geometry;
    const pos = geom.getAttribute('position');
    if (!pos || pos.count === 0) return;

    const normAttr = geom.getAttribute('normal');
    const uvAttr = geom.getAttribute('uv');
    const index = geom.index;

    normalMat.getNormalMatrix(mesh.matrixWorld);

    const vertices: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      vertices.push(
        Number(v.x.toFixed(6)),
        Number(v.y.toFixed(6)),
        Number(v.z.toFixed(6))
      );
    }

    const triangles: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];

    const pushCorner = (idx: number) => {
      if (normAttr) {
        n.fromBufferAttribute(normAttr, idx).applyMatrix3(normalMat).normalize();
        normals.push(Number(n.x.toFixed(5)), Number(n.y.toFixed(5)), Number(n.z.toFixed(5)));
      } else {
        normals.push(0, 1, 0);
      }
      if (uvAttr) {
        uvs.push(Number(uvAttr.getX(idx).toFixed(5)), Number(uvAttr.getY(idx).toFixed(5)));
      } else {
        uvs.push(0, 0);
      }
    };

    if (index) {
      for (let i = 0; i + 2 < index.count; i += 3) {
        const a = index.getX(i);
        const b = index.getX(i + 1);
        const c = index.getX(i + 2);
        triangles.push(a, b, c);
        pushCorner(a);
        pushCorner(b);
        pushCorner(c);
      }
    } else {
      for (let i = 0; i + 2 < pos.count; i += 3) {
        triangles.push(i, i + 1, i + 2);
        pushCorner(i);
        pushCorner(i + 1);
        pushCorner(i + 2);
      }
    }

    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const std = mat as THREE.MeshStandardMaterial | undefined;
    const col = std?.color ? std.color : new THREE.Color('#808080');

    results.push({
      name: (mesh.name || `Mesh_${results.length + 1}`).replace(/[^A-Za-z0-9_]/g, '_'),
      vertices,
      normals,
      uvs,
      triangles,
      colorRgb: [
        Number(col.r.toFixed(4)),
        Number(col.g.toFixed(4)),
        Number(col.b.toFixed(4)),
      ],
    });
  });

  return results;
}

/**
 * Serializes flattened meshes to valid Autodesk FBX 7.4 ASCII (Unreal Engine, Unity, Maya, Blender).
 */
export function serializeMeshesToFbxAscii(modelName: string, meshes: FlattenedMeshData[]): string {
  const safeTitle = modelName.replace(/[^A-Za-z0-9_ -]/g, '_') || 'StudioModel';
  const lines: string[] = [
    '; FBX 7.4.0 project file',
    `; Generated by BlendFactory Studio (${safeTitle})`,
    'FBXHeaderExtension:  {',
    '  FBXHeaderVersion: 1003',
    '  FBXVersion: 7400',
    '  Creator: "BlendFactory Studio"',
    '}',
    'GlobalSettings:  {',
    '  Version: 1000',
    '  Properties70:  {',
    '    P: "UpAxis", "int", "Integer", "",1',
    '    P: "UpAxisSign", "int", "Integer", "",1',
    '    P: "FrontAxis", "int", "Integer", "",2',
    '    P: "FrontAxisSign", "int", "Integer", "",1',
    '    P: "UnitScaleFactor", "double", "Number", "",100',
    '  }',
    '}',
    'Objects:  {',
  ];

  const connections: string[] = [];
  let nextId = 100001;

  for (const m of meshes) {
    const geoId = nextId++;
    const modelId = nextId++;
    const matId = nextId++;

    const polyIndices: number[] = [];
    for (let i = 0; i + 2 < m.triangles.length; i += 3) {
      polyIndices.push(m.triangles[i], m.triangles[i + 1], -(m.triangles[i + 2] + 1));
    }

    lines.push(`  Geometry: ${geoId}, "Geometry::${m.name}", "Mesh" {`);
    lines.push(`    Vertices: *${m.vertices.length} {`);
    lines.push(`      a: ${m.vertices.join(',')}`);
    lines.push('    }');
    lines.push(`    PolygonVertexIndex: *${polyIndices.length} {`);
    lines.push(`      a: ${polyIndices.join(',')}`);
    lines.push('    }');
    lines.push('    GeometryVersion: 124');
    lines.push('    LayerElementNormal: 0 {');
    lines.push('      Version: 101');
    lines.push('      Name: ""');
    lines.push('      MappingInformationType: "ByPolygonVertex"');
    lines.push('      ReferenceInformationType: "Direct"');
    lines.push(`      Normals: *${m.normals.length} {`);
    lines.push(`        a: ${m.normals.join(',')}`);
    lines.push('      }');
    lines.push('    }');
    lines.push('    LayerElementUV: 0 {');
    lines.push('      Version: 101');
    lines.push('      Name: "UVMap"');
    lines.push('      MappingInformationType: "ByPolygonVertex"');
    lines.push('      ReferenceInformationType: "Direct"');
    lines.push(`      UV: *${m.uvs.length} {`);
    lines.push(`        a: ${m.uvs.join(',')}`);
    lines.push('      }');
    lines.push('    }');
    lines.push('    Layer: 0 {');
    lines.push('      Version: 100');
    lines.push('      LayerElement:  { Type: "LayerElementNormal", TypedIndex: 0 }');
    lines.push('      LayerElement:  { Type: "LayerElementUV", TypedIndex: 0 }');
    lines.push('    }');
    lines.push('  }');

    lines.push(`  Model: ${modelId}, "Model::${m.name}", "Mesh" {`);
    lines.push('    Version: 232');
    lines.push('    Properties70:  {');
    lines.push('      P: "Lcl Translation", "Lcl Translation", "", "A",0,0,0');
    lines.push('      P: "Lcl Rotation", "Lcl Rotation", "", "A",0,0,0');
    lines.push('      P: "Lcl Scaling", "Lcl Scaling", "", "A",1,1,1');
    lines.push('    }');
    lines.push('    Shading: T');
    lines.push('    Culling: "CullingOff"');
    lines.push('  }');

    lines.push(`  Material: ${matId}, "Material::${m.name}_Mat", "" {`);
    lines.push('    Version: 102');
    lines.push('    ShadingModel: "phong"');
    lines.push('    Properties70:  {');
    lines.push(
      `      P: "DiffuseColor", "Color", "", "A",${m.colorRgb[0]},${m.colorRgb[1]},${m.colorRgb[2]}`
    );
    lines.push('    }');
    lines.push('  }');

    connections.push(`  C: "OO",${geoId},${modelId}`);
    connections.push(`  C: "OO",${matId},${modelId}`);
    connections.push(`  C: "OO",${modelId},0`);
  }

  lines.push('}');
  lines.push('Connections:  {');
  lines.push(...connections);
  lines.push('}');
  return lines.join('\n') + '\n';
}

/**
 * Serializes flattened meshes to valid COLLADA 1.4.1 (.dae) XML (Godot, Unreal, Maya, SketchUp).
 */
export function serializeMeshesToColladaDae(modelName: string, meshes: FlattenedMeshData[]): string {
  const esc = (s: string) => s.replace(/[<>&"']/g, '_');
  const effects: string[] = [];
  const materials: string[] = [];
  const geometries: string[] = [];
  const sceneNodes: string[] = [];

  meshes.forEach((m, idx) => {
    const id = `${esc(m.name)}_${idx}`;
    const triCount = Math.floor(m.triangles.length / 3);

    effects.push(`    <effect id="${id}_fx">
      <profile_COMMON>
        <technique sid="common">
          <lambert>
            <diffuse><color>${m.colorRgb[0]} ${m.colorRgb[1]} ${m.colorRgb[2]} 1</color></diffuse>
          </lambert>
        </technique>
      </profile_COMMON>
    </effect>`);

    materials.push(
      `    <material id="${id}_mat" name="${id}_mat"><instance_effect url="#${id}_fx"/></material>`
    );

    geometries.push(`    <geometry id="${id}_geo" name="${esc(m.name)}">
      <mesh>
        <source id="${id}_pos">
          <float_array id="${id}_pos_arr" count="${m.vertices.length}">${m.vertices.join(' ')}</float_array>
          <technique_common>
            <accessor source="#${id}_pos_arr" count="${Math.floor(m.vertices.length / 3)}" stride="3">
              <param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/>
            </accessor>
          </technique_common>
        </source>
        <vertices id="${id}_verts"><input semantic="POSITION" source="#${id}_pos"/></vertices>
        <triangles material="${id}_mat" count="${triCount}">
          <input semantic="VERTEX" source="#${id}_verts" offset="0"/>
          <p>${m.triangles.join(' ')}</p>
        </triangles>
      </mesh>
    </geometry>`);

    sceneNodes.push(`      <node id="${id}_node" name="${esc(m.name)}" type="NODE">
        <instance_geometry url="#${id}_geo">
          <bind_material><technique_common><instance_material symbol="${id}_mat" target="#${id}_mat"/></technique_common></bind_material>
        </instance_geometry>
      </node>`);
  });

  return `<?xml version="1.0" encoding="utf-8"?>
<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">
  <asset>
    <contributor><authoring_tool>BlendFactory Studio</authoring_tool></contributor>
    <created>${new Date().toISOString()}</created>
    <modified>${new Date().toISOString()}</modified>
    <unit name="meter" meter="1"/>
    <up_axis>Y_UP</up_axis>
  </asset>
  <library_effects>
${effects.join('\n')}
  </library_effects>
  <library_materials>
${materials.join('\n')}
  </library_materials>
  <library_geometries>
${geometries.join('\n')}
  </library_geometries>
  <library_visual_scenes>
    <visual_scene id="Scene" name="${esc(modelName)}">
${sceneNodes.join('\n')}
    </visual_scene>
  </library_visual_scenes>
  <scene><instance_visual_scene url="#Scene"/></scene>
</COLLADA>
`;
}

/**
 * Serializes flattened meshes to Pixar Universal Scene Description ASCII (.usda).
 */
export function serializeMeshesToUsda(modelName: string, meshes: FlattenedMeshData[]): string {
  const rootName = (modelName || 'StudioScene').replace(/[^A-Za-z0-9_]/g, '_');
  const lines: string[] = [
    '#usda 1.0',
    '(',
    `    defaultPrim = "${rootName}"`,
    '    metersPerUnit = 1',
    '    upAxis = "Y"',
    ')',
    '',
    `def Xform "${rootName}"`,
    '{',
  ];

  meshes.forEach((m, idx) => {
    const meshName = `${m.name}_${idx}`;
    const pts: string[] = [];
    for (let i = 0; i + 2 < m.vertices.length; i += 3) {
      pts.push(`(${m.vertices[i]}, ${m.vertices[i + 1]}, ${m.vertices[i + 2]})`);
    }
    const faceCounts = new Array(Math.floor(m.triangles.length / 3)).fill(3);
    lines.push(`    def Mesh "${meshName}"`);
    lines.push('    {');
    lines.push(`        int[] faceVertexCounts = [${faceCounts.join(', ')}]`);
    lines.push(`        int[] faceVertexIndices = [${m.triangles.join(', ')}]`);
    lines.push(`        point3f[] points = [${pts.join(', ')}]`);
    lines.push(
      `        color3f[] primvars:displayColor = [(${m.colorRgb[0]}, ${m.colorRgb[1]}, ${m.colorRgb[2]})]`
    );
    lines.push('        uniform token subdivisionScheme = "none"');
    lines.push('    }');
  });

  lines.push('}');
  return lines.join('\n') + '\n';
}

/**
 * Serializes flattened meshes to ISO-10303-21 STEP (.step) AP214 faceted CAD boundary representation.
 */
export function serializeMeshesToStepCad(modelName: string, meshes: FlattenedMeshData[]): string {
  const safeName = (modelName || 'StudioCAD').replace(/[^A-Za-z0-9_ -]/g, '_');
  const ts = new Date().toISOString().replace(/\.\d+Z$/, '');
  const entities: string[] = [];
  let eid = 10;

  const faceRefs: string[] = [];
  const maxFaces = 18000; // keep CAD STEP export crisp and responsive in-browser
  let faceCount = 0;

  for (const m of meshes) {
    const vertIds: number[] = [];
    for (let i = 0; i + 2 < m.vertices.length; i += 3) {
      const id = eid++;
      // CAD STEP coordinates in millimeters (standard CAD unit)
      const x = (m.vertices[i] * 1000).toFixed(3);
      const y = (m.vertices[i + 1] * 1000).toFixed(3);
      const z = (m.vertices[i + 2] * 1000).toFixed(3);
      entities.push(`#${id}=CARTESIAN_POINT('',(${x},${y},${z}));`);
      vertIds.push(id);
    }

    for (let i = 0; i + 2 < m.triangles.length && faceCount < maxFaces; i += 3) {
      const a = vertIds[m.triangles[i]];
      const b = vertIds[m.triangles[i + 1]];
      const c = vertIds[m.triangles[i + 2]];
      if (!a || !b || !c) continue;
      const loopId = eid++;
      const boundId = eid++;
      const faceId = eid++;
      entities.push(`#${loopId}=POLY_LOOP('',(#${a},#${b},#${c}));`);
      entities.push(`#${boundId}=FACE_OUTER_BOUND('',#${loopId},.T.);`);
      entities.push(`#${faceId}=FACE_SURFACE('',(#${boundId}),#5,.T.);`);
      faceRefs.push(`#${faceId}`);
      faceCount += 1;
    }
  }

  const shellId = eid++;
  const brepId = eid++;
  entities.push(`#${shellId}=CLOSED_SHELL('${safeName}',(${faceRefs.join(',')}));`);
  entities.push(`#${brepId}=FACETED_BREP('${safeName}',#${shellId});`);

  return `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('BlendFactory Studio CAD Faceted B-Rep'),'2;1');
FILE_NAME('${safeName}.step','${ts}',('BlendFactory'),('BlendFactory Studio'),'STEP AP214','BlendFactory','');
FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));
ENDSEC;
DATA;
#1=APPLICATION_CONTEXT('automotive design');
#2=CARTESIAN_POINT('',(0.,0.,0.));
#3=DIRECTION('',(0.,0.,1.));
#4=DIRECTION('',(1.,0.,0.));
#5=PLANE('',#6);
#6=AXIS2_PLACEMENT_3D('',#2,#3,#4);
${entities.join('\n')}
ENDSEC;
END-ISO-10303-21;
`;
}

/**
 * Serializes flattened meshes to AutoCAD DXF (.dxf) 3DFACE entities.
 */
export function serializeMeshesToDxf(meshes: FlattenedMeshData[]): string {
  const lines: string[] = ['0', 'SECTION', '2', 'ENTITIES'];
  for (const m of meshes) {
    const layer = m.name.slice(0, 32) || '0';
    for (let i = 0; i + 2 < m.triangles.length; i += 3) {
      const ia = m.triangles[i] * 3;
      const ib = m.triangles[i + 1] * 3;
      const ic = m.triangles[i + 2] * 3;
      const ax = m.vertices[ia], ay = m.vertices[ia + 1], az = m.vertices[ia + 2];
      const bx = m.vertices[ib], by = m.vertices[ib + 1], bz = m.vertices[ib + 2];
      const cx = m.vertices[ic], cy = m.vertices[ic + 1], cz = m.vertices[ic + 2];
      lines.push(
        '0', '3DFACE', '8', layer,
        '10', String(ax), '20', String(ay), '30', String(az),
        '11', String(bx), '21', String(by), '31', String(bz),
        '12', String(cx), '22', String(cy), '32', String(cz),
        '13', String(cx), '23', String(cy), '33', String(cz)
      );
    }
  }
  lines.push('0', 'ENDSEC', '0', 'EOF');
  return lines.join('\n') + '\n';
}

/**
 * Serializes flattened meshes to 3MF XML model format (.3mf).
 */
export function serializeMeshesTo3mfXml(meshes: FlattenedMeshData[]): string {
  const verticesXml: string[] = [];
  const trianglesXml: string[] = [];
  let offset = 0;

  for (const m of meshes) {
    const vCount = Math.floor(m.vertices.length / 3);
    for (let i = 0; i + 2 < m.vertices.length; i += 3) {
      verticesXml.push(
        `          <vertex x="${m.vertices[i]}" y="${m.vertices[i + 1]}" z="${m.vertices[i + 2]}" />`
      );
    }
    for (let i = 0; i + 2 < m.triangles.length; i += 3) {
      trianglesXml.push(
        `          <triangle v1="${m.triangles[i] + offset}" v2="${m.triangles[i + 1] + offset}" v3="${m.triangles[i + 2] + offset}" />`
      );
    }
    offset += vCount;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="meter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>
${verticesXml.join('\n')}
        </vertices>
        <triangles>
${trianglesXml.join('\n')}
        </triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="1" />
  </build>
</model>
`;
}

/**
 * Serializes flattened meshes to Geomview Object File Format (.off).
 */
export function serializeMeshesToOff(meshes: FlattenedMeshData[]): string {
  const verts: string[] = [];
  const faces: string[] = [];
  let offset = 0;
  for (const m of meshes) {
    const vCount = Math.floor(m.vertices.length / 3);
    for (let i = 0; i + 2 < m.vertices.length; i += 3) {
      verts.push(`${m.vertices[i]} ${m.vertices[i + 1]} ${m.vertices[i + 2]}`);
    }
    for (let i = 0; i + 2 < m.triangles.length; i += 3) {
      faces.push(
        `3 ${m.triangles[i] + offset} ${m.triangles[i + 1] + offset} ${m.triangles[i + 2] + offset}`
      );
    }
    offset += vCount;
  }
  return `OFF\n${verts.length} ${faces.length} 0\n${verts.join('\n')}\n${faces.join('\n')}\n`;
}

/**
 * Generates a self-contained Blender 4.2 LTS Python script that imports an embedded
 * Wavefront OBJ string directly into Blender and sets up Principled BSDF materials.
 */
export function buildBlenderReconstructionScript(modelName: string, objText: string): string {
  const safeName = modelName.replace(/["'\\]/g, '').slice(0, 64) || 'Studio_Model';
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
    bsdf.inputs["Base Color"].default_value = (0.48, 0.47, 0.44, 1.0)
    bsdf.inputs["Metallic"].default_value = 0.12
    bsdf.inputs["Roughness"].default_value = 0.56

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
      exporter.parse(root, (res) => resolve(res), { binary: false });
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

  if (format === 'py') {
    const objExporter = new OBJExporter();
    const objText = objExporter.parse(root);
    const pySource = buildBlenderReconstructionScript(modelName, objText);
    return { blob: new Blob([pySource], { type: spec.mimeType }), filename };
  }

  const meshes = extractFlattenedMeshes(root);
  if (meshes.length === 0) {
    throw new Error('No visible mesh geometry found to export.');
  }

  if (format === 'fbx') {
    return { blob: new Blob([serializeMeshesToFbxAscii(modelName, meshes)], { type: spec.mimeType }), filename };
  }
  if (format === 'dae') {
    return { blob: new Blob([serializeMeshesToColladaDae(modelName, meshes)], { type: spec.mimeType }), filename };
  }
  if (format === 'usda') {
    return { blob: new Blob([serializeMeshesToUsda(modelName, meshes)], { type: spec.mimeType }), filename };
  }
  if (format === 'step') {
    return { blob: new Blob([serializeMeshesToStepCad(modelName, meshes)], { type: spec.mimeType }), filename };
  }
  if (format === 'dxf') {
    return { blob: new Blob([serializeMeshesToDxf(meshes)], { type: spec.mimeType }), filename };
  }
  if (format === '3mf') {
    return { blob: new Blob([serializeMeshesTo3mfXml(meshes)], { type: spec.mimeType }), filename };
  }

  // format === 'off'
  return { blob: new Blob([serializeMeshesToOff(meshes)], { type: spec.mimeType }), filename };
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
