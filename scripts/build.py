"""Starter Blender 4.2 LTS procedural model script.

Clears the scene and constructs a beveled stone-and-wood garden lantern using
bmesh geometry, clean bevel modifiers, and Principled BSDF materials.
(Save, GLB export, auto-camera, and Cycles rendering are handled automatically
by scripts/export_and_render.py.)
"""

import math
import bpy
import bmesh
from mathutils import Matrix, Vector


def clear_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def make_principled_material(
    name: str,
    base_color: tuple[float, float, float, float],
    roughness: float,
    metallic: float = 0.0,
    emission_color: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf is not None:
        bsdf.inputs["Base Color"].default_value = base_color
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if emission_color is not None and emission_strength > 0.0:
            bsdf.inputs["Emission Color"].default_value = emission_color
            bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


def create_beveled_box(
    name: str,
    size: tuple[float, float, float],
    location: tuple[float, float, float],
    bevel_width: float,
    bevel_segments: int,
    material: bpy.types.Material,
) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)

    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if bevel_width > 0.0:
        bmesh.ops.bevel(
            bm,
            geom=list(bm.edges),
            offset=bevel_width,
            segments=bevel_segments,
            profile=0.5,
            affect="EDGES",
            clamp_overlap=True,
        )
    bm.to_mesh(mesh)
    bm.free()

    for poly in mesh.polygons:
        poly.use_smooth = True

    obj.location = location
    obj.data.materials.append(material)
    return obj


def create_pagoda_roof(
    name: str,
    bottom_width: float,
    top_width: float,
    height: float,
    z_base: float,
    material: bpy.types.Material,
) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)

    bm = bmesh.new()
    hb = bottom_width * 0.5
    ht = top_width * 0.5
    eave_lip = 0.045

    # Bottom eave soffit ring
    v_b0 = bm.verts.new((-hb, -hb, 0.0))
    v_b1 = bm.verts.new((hb, -hb, 0.0))
    v_b2 = bm.verts.new((hb, hb, 0.0))
    v_b3 = bm.verts.new((-hb, hb, 0.0))

    # Eave outer shoulder ring
    v_e0 = bm.verts.new((-hb * 1.03, -hb * 1.03, eave_lip))
    v_e1 = bm.verts.new((hb * 1.03, -hb * 1.03, eave_lip))
    v_e2 = bm.verts.new((hb * 1.03, hb * 1.03, eave_lip))
    v_e3 = bm.verts.new((-hb * 1.03, hb * 1.03, eave_lip))

    # Mid slope flare for subtle architectural concavity
    hm = (hb + ht) * 0.44
    zm = height * 0.48
    v_m0 = bm.verts.new((-hm, -hm, zm))
    v_m1 = bm.verts.new((hm, -hm, zm))
    v_m2 = bm.verts.new((hm, hm, zm))
    v_m3 = bm.verts.new((-hm, hm, zm))

    # Top crown ring
    v_t0 = bm.verts.new((-ht, -ht, height))
    v_t1 = bm.verts.new((ht, -ht, height))
    v_t2 = bm.verts.new((ht, ht, height))
    v_t3 = bm.verts.new((-ht, ht, height))

    rings = [
        (v_b0, v_b1, v_b2, v_b3),
        (v_e0, v_e1, v_e2, v_e3),
        (v_m0, v_m1, v_m2, v_m3),
        (v_t0, v_t1, v_t2, v_t3),
    ]

    bm.faces.new((v_b3, v_b2, v_b1, v_b0))
    bm.faces.new((v_t0, v_t1, v_t2, v_t3))

    for r_idx in range(len(rings) - 1):
        low = rings[r_idx]
        high = rings[r_idx + 1]
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((low[i], low[j], high[j], high[i]))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.bevel(
        bm,
        geom=list(bm.edges),
        offset=0.014,
        segments=2,
        profile=0.5,
        affect="EDGES",
        clamp_overlap=True,
    )

    bm.to_mesh(mesh)
    bm.free()

    for poly in mesh.polygons:
        poly.use_smooth = True

    obj.location = (0.0, 0.0, z_base)
    obj.data.materials.append(material)
    return obj


def create_finial(z_base: float, material: bpy.types.Material) -> bpy.types.Object:
    mesh = bpy.data.meshes.new("Lantern_Finial_Mesh")
    obj = bpy.data.objects.new("Lantern_Finial", mesh)
    bpy.context.scene.collection.objects.link(obj)

    bm = bmesh.new()
    profile = [
        (0.11, 0.0),
        (0.10, 0.035),
        (0.055, 0.065),
        (0.08, 0.12),
        (0.055, 0.175),
        (0.015, 0.23),
        (0.0, 0.255),
    ]
    segments = 24
    rings = []
    for radius, z_val in profile:
        if radius == 0.0:
            rings.append([bm.verts.new((0.0, 0.0, z_val))])
        else:
            ring = []
            for s in range(segments):
                angle = (2.0 * math.pi * s) / segments
                ring.append(bm.verts.new((radius * math.cos(angle), radius * math.sin(angle), z_val)))
            rings.append(ring)

    # Bottom cap
    bm.faces.new(list(reversed(rings[0])))

    for idx in range(len(rings) - 1):
        r0 = rings[idx]
        r1 = rings[idx + 1]
        if len(r1) == 1:
            apex = r1[0]
            for s in range(segments):
                s_next = (s + 1) % segments
                bm.faces.new((r0[s], r0[s_next], apex))
        else:
            for s in range(segments):
                s_next = (s + 1) % segments
                bm.faces.new((r0[s], r0[s_next], r1[s_next], r1[s]))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    for poly in mesh.polygons:
        poly.use_smooth = True

    obj.location = (0.0, 0.0, z_base)
    obj.data.materials.append(material)
    return obj


def build_lantern() -> None:
    clear_scene()

    stone_mat = make_principled_material(
        name="ChiseledGranite",
        base_color=(0.34, 0.35, 0.37, 1.0),
        roughness=0.78,
        metallic=0.04,
    )
    slate_mat = make_principled_material(
        name="DarkSlateRoof",
        base_color=(0.16, 0.17, 0.19, 1.0),
        roughness=0.58,
        metallic=0.08,
    )
    wood_mat = make_principled_material(
        name="AgedCedarTimber",
        base_color=(0.24, 0.13, 0.075, 1.0),
        roughness=0.46,
        metallic=0.02,
    )
    bronze_mat = make_principled_material(
        name="PatinatedBronze",
        base_color=(0.38, 0.29, 0.18, 1.0),
        roughness=0.28,
        metallic=0.88,
    )
    shoji_mat = make_principled_material(
        name="WarmShojiPaper",
        base_color=(0.98, 0.89, 0.72, 1.0),
        roughness=0.62,
        metallic=0.0,
        emission_color=(1.0, 0.72, 0.34, 1.0),
        emission_strength=4.2,
    )

    # 1. Two-tier beveled granite plinth base
    create_beveled_box("Stone_Plinth_Lower", (0.78, 0.78, 0.12), (0.0, 0.0, 0.06), 0.022, 3, stone_mat)
    create_beveled_box("Stone_Plinth_Upper", (0.62, 0.62, 0.11), (0.0, 0.0, 0.175), 0.018, 3, stone_mat)

    # 2. Timber sill & top lintel frames
    create_beveled_box("Wood_Lower_Frame", (0.50, 0.50, 0.055), (0.0, 0.0, 0.258), 0.009, 2, wood_mat)
    create_beveled_box("Wood_Upper_Frame", (0.52, 0.52, 0.055), (0.0, 0.0, 0.885), 0.009, 2, wood_mat)

    # 3. Four beveled corner timber posts with bronze collars
    post_offset = 0.205
    for idx, (sx, sy) in enumerate([(-1, -1), (1, -1), (1, 1), (-1, 1)]):
        px = sx * post_offset
        py = sy * post_offset
        create_beveled_box(f"Wood_Post_{idx+1}", (0.062, 0.062, 0.60), (px, py, 0.57), 0.008, 2, wood_mat)
        create_beveled_box(f"Bronze_Collar_Low_{idx+1}", (0.072, 0.072, 0.032), (px, py, 0.30), 0.004, 2, bronze_mat)
        create_beveled_box(f"Bronze_Collar_High_{idx+1}", (0.072, 0.072, 0.032), (px, py, 0.84), 0.004, 2, bronze_mat)

    # 4. Horizontal kumiko wooden muntin rails on all four sides
    for z_rail in (0.47, 0.67):
        for side_idx, (rx, ry, rw, rd) in enumerate([
            (0.0, -0.205, 0.36, 0.024),
            (0.0, 0.205, 0.36, 0.024),
            (-0.205, 0.0, 0.024, 0.36),
            (0.205, 0.0, 0.024, 0.36),
        ]):
            create_beveled_box(
                f"Wood_Lattice_{int(z_rail*100)}_{side_idx+1}",
                (rw, rd, 0.022),
                (rx, ry, z_rail),
                0.003,
                2,
                wood_mat,
            )

    # 5. Glowing warm shoji paper core
    create_beveled_box("Shoji_Light_Core", (0.37, 0.37, 0.56), (0.0, 0.0, 0.57), 0.012, 2, shoji_mat)

    # 6. Stepped dark slate pagoda roof & turned stone finial
    create_pagoda_roof("Slate_Pagoda_Roof", bottom_width=0.96, top_width=0.28, height=0.28, z_base=0.91, material=slate_mat)
    create_beveled_box("Roof_Capstone", (0.30, 0.30, 0.055), (0.0, 0.0, 1.21), 0.012, 2, stone_mat)
    create_finial(z_base=1.235, material=stone_mat)


if __name__ == "__main__":
    build_lantern()
