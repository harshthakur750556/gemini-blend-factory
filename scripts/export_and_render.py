"""Headless Blender 4.2 LTS export and multi-angle Cycles CPU preview renderer.

Runs immediately after scripts/build.py:
  1. Packs all external images/textures into the .blend file.
  2. Saves outputs/model.blend.
  3. Exports outputs/model.glb with modifiers applied (export_apply=True).
  4. Computes world-space mesh bounds and renders 4 real Cycles CPU angles
     (hero.png, front.png, side.png, top.png) into outputs/screenshots/, plus
     outputs/preview.png (hero view) and outputs/manifest.json so external AI
     harnesses and the BlendFactory Vision QA inspector can inspect every angle.
"""

import json
import math
import os
import shutil
import time
import bpy
from mathutils import Vector


OUTPUT_DIR = os.path.abspath("outputs")
SCREENSHOTS_DIR = os.path.join(OUTPUT_DIR, "screenshots")
BLEND_PATH = os.path.join(OUTPUT_DIR, "model.blend")
GLB_PATH = os.path.join(OUTPUT_DIR, "model.glb")
PREVIEW_PATH = os.path.join(OUTPUT_DIR, "preview.png")
MANIFEST_PATH = os.path.join(OUTPUT_DIR, "manifest.json")


def ensure_output_dirs() -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(SCREENSHOTS_DIR, exist_ok=True)


def compute_scene_mesh_bounds():
    """Return (center, size, radius, mesh_count, tri_count) across visible MESH objects."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    min_co = Vector((float("inf"), float("inf"), float("inf")))
    max_co = Vector((float("-inf"), float("-inf"), float("-inf")))
    mesh_count = 0
    tri_count = 0

    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.hide_render:
            continue
        mesh_count += 1
        eval_obj = obj.evaluated_get(depsgraph)
        mesh_data = eval_obj.to_mesh()
        if mesh_data is not None:
            mesh_data.calc_loop_triangles()
            tri_count += len(mesh_data.loop_triangles)
            eval_obj.to_mesh_clear()
        for corner in eval_obj.bound_box:
            world_pt = eval_obj.matrix_world @ Vector(corner)
            min_co.x = min(min_co.x, world_pt.x)
            min_co.y = min(min_co.y, world_pt.y)
            min_co.z = min(min_co.z, world_pt.z)
            max_co.x = max(max_co.x, world_pt.x)
            max_co.y = max(max_co.y, world_pt.y)
            max_co.z = max(max_co.z, world_pt.z)

    if mesh_count == 0:
        return Vector((0.0, 0.0, 0.5)), Vector((1.0, 1.0, 1.0)), 1.0, 0, 0

    center = (min_co + max_co) * 0.5
    size = max_co - min_co
    radius = max(size.length * 0.5, 0.25)
    return center, size, radius, mesh_count, tri_count


def ensure_camera(radius: float) -> bpy.types.Object:
    scene = bpy.context.scene
    if scene.camera is not None:
        return scene.camera

    existing_cameras = [obj for obj in scene.objects if obj.type == "CAMERA"]
    if existing_cameras:
        scene.camera = existing_cameras[0]
        return scene.camera

    cam_data = bpy.data.cameras.new(name="AutoPreviewCamera")
    cam_data.lens = 50.0
    cam_data.clip_start = 0.05
    cam_data.clip_end = max(250.0, radius * 40.0)
    cam_obj = bpy.data.objects.new(name="AutoPreviewCamera", object_data=cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj
    return cam_obj


def aim_camera(cam_obj: bpy.types.Object, center: Vector, radius: float, azim_deg: float, elev_deg: float) -> None:
    cam_data = cam_obj.data
    fov_rad = 2.0 * math.atan(cam_data.sensor_width / (2.0 * cam_data.lens))
    distance = (radius / math.sin(fov_rad * 0.5)) * 1.24
    azim = math.radians(azim_deg)
    elev = math.radians(elev_deg)

    offset = Vector((
        distance * math.cos(elev) * math.sin(azim),
        -distance * math.cos(elev) * math.cos(azim),
        distance * math.sin(elev),
    ))
    cam_obj.location = center + offset
    direction = (center - cam_obj.location).normalized()
    cam_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def ensure_studio_lighting(center: Vector, radius: float) -> None:
    scene = bpy.context.scene
    existing_lights = [obj for obj in scene.objects if obj.type == "LIGHT"]

    if not existing_lights:
        key_data = bpy.data.lights.new(name="AutoAreaKeyLight", type="AREA")
        key_data.shape = "RECTANGLE"
        key_data.size = radius * 1.8
        key_data.size_y = radius * 1.2
        key_data.energy = max(120.0, (radius ** 2) * 85.0)
        key_data.color = (1.0, 0.95, 0.88)
        key_obj = bpy.data.objects.new(name="AutoAreaKeyLight", object_data=key_data)
        scene.collection.objects.link(key_obj)
        key_obj.location = center + Vector((radius * 2.2, -radius * 1.9, radius * 2.4))
        key_obj.rotation_euler = (center - key_obj.location).normalized().to_track_quat("-Z", "Y").to_euler()

        rim_data = bpy.data.lights.new(name="AutoAreaRimLight", type="AREA")
        rim_data.shape = "RECTANGLE"
        rim_data.size = radius * 1.5
        rim_data.size_y = radius * 1.0
        rim_data.energy = max(50.0, (radius ** 2) * 34.0)
        rim_data.color = (0.82, 0.90, 1.0)
        rim_obj = bpy.data.objects.new(name="AutoAreaRimLight", object_data=rim_data)
        scene.collection.objects.link(rim_obj)
        rim_obj.location = center + Vector((-radius * 2.4, radius * 1.8, radius * 1.6))
        rim_obj.rotation_euler = (center - rim_obj.location).normalized().to_track_quat("-Z", "Y").to_euler()

    if scene.world is None:
        world = bpy.data.worlds.new("StudioWorld")
        scene.world = world
    scene.world.use_nodes = True
    bg_node = scene.world.node_tree.nodes.get("Background")
    if bg_node is not None:
        # Warm alabaster gallery studio tone matching BlendFactory Studio
        bg_node.inputs[0].default_value = (0.86, 0.85, 0.82, 1.0)
        bg_node.inputs[1].default_value = 0.72


def configure_cycles() -> None:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 16
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.use_denoising = True
    if hasattr(scene.cycles, "denoiser"):
        scene.cycles.denoiser = "OPENIMAGEDENOISE"
    scene.cycles.max_bounces = 6
    scene.cycles.diffuse_bounces = 3
    scene.cycles.glossy_bounces = 3

    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"

    scene.view_settings.view_transform = "AgX" if "AgX" in [
        item.identifier for item in scene.view_settings.bl_rna.properties["view_transform"].enum_items
    ] else "Filmic"
    scene.view_settings.exposure = 0.05


def main() -> None:
    ensure_output_dirs()

    try:
        bpy.ops.file.pack_all()
    except RuntimeError as exc:
        print(f"[export_and_render] pack_all skipped: {exc}")

    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    print(f"[export_and_render] Saved {BLEND_PATH}")

    bpy.ops.export_scene.gltf(
        filepath=GLB_PATH,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
    )
    print(f"[export_and_render] Exported {GLB_PATH}")

    center, size, radius, mesh_count, tri_count = compute_scene_mesh_bounds()
    cam_obj = ensure_camera(radius)
    ensure_studio_lighting(center, radius)
    configure_cycles()

    angles = [
        ("hero", 38.0, 24.0),
        ("front", 0.0, 8.0),
        ("side", 90.0, 12.0),
        ("top", 0.0, 78.0),
    ]

    rendered_files = []
    for name, azim, elev in angles:
        aim_camera(cam_obj, center, radius, azim, elev)
        out_file = os.path.join(SCREENSHOTS_DIR, f"{name}.png")
        bpy.context.scene.render.filepath = out_file
        bpy.ops.render.render(write_still=True)
        rendered_files.append(f"screenshots/{name}.png")
        print(f"[export_and_render] Rendered {out_file}")

    hero_path = os.path.join(SCREENSHOTS_DIR, "hero.png")
    if os.path.exists(hero_path):
        shutil.copyfile(hero_path, PREVIEW_PATH)

    manifest = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "meshCount": mesh_count,
        "triangleCount": tri_count,
        "boundsSize": [round(size.x, 4), round(size.y, 4), round(size.z, 4)],
        "screenshots": rendered_files,
        "artifacts": ["model.glb", "model.blend", "preview.png"],
    }
    with open(MANIFEST_PATH, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)
    print(f"[export_and_render] Wrote {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
