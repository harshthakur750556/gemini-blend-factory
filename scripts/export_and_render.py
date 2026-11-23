"""Headless Blender 4.2 LTS export and Cycles CPU preview renderer.

Runs immediately after scripts/build.py:
  1. Packs all external images/textures into the .blend file.
  2. Saves outputs/model.blend.
  3. Exports outputs/model.glb with modifiers applied (export_apply=True).
  4. Computes the world-space bounding box of all MESH objects, adds an
     auto-framed camera and studio area key light if missing, and renders a
     512x512 Cycles CPU preview (16 samples, OpenImageDenoise) to outputs/preview.png.
"""

import math
import os
import bpy
from mathutils import Vector


OUTPUT_DIR = os.path.abspath("outputs")
BLEND_PATH = os.path.join(OUTPUT_DIR, "model.blend")
GLB_PATH = os.path.join(OUTPUT_DIR, "model.glb")
PREVIEW_PATH = os.path.join(OUTPUT_DIR, "preview.png")


def ensure_output_dir() -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)


def compute_scene_mesh_bounds():
    """Return (center, size, radius) across all visible MESH objects in world space."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    min_co = Vector((float("inf"), float("inf"), float("inf")))
    max_co = Vector((float("-inf"), float("-inf"), float("-inf")))
    found_mesh = False

    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.hide_render:
            continue
        eval_obj = obj.evaluated_get(depsgraph)
        for corner in eval_obj.bound_box:
            world_pt = eval_obj.matrix_world @ Vector(corner)
            min_co.x = min(min_co.x, world_pt.x)
            min_co.y = min(min_co.y, world_pt.y)
            min_co.z = min(min_co.z, world_pt.z)
            max_co.x = max(max_co.x, world_pt.x)
            max_co.y = max(max_co.y, world_pt.y)
            max_co.z = max(max_co.z, world_pt.z)
            found_mesh = True

    if not found_mesh:
        return Vector((0.0, 0.0, 0.5)), Vector((1.0, 1.0, 1.0)), 1.0

    center = (min_co + max_co) * 0.5
    size = max_co - min_co
    radius = max(size.length * 0.5, 0.25)
    return center, size, radius


def ensure_camera(center: Vector, radius: float) -> bpy.types.Object:
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

    fov_rad = 2.0 * math.atan(cam_data.sensor_width / (2.0 * cam_data.lens))
    distance = (radius / math.sin(fov_rad * 0.5)) * 1.18
    azim = math.radians(38.0)
    elev = math.radians(24.0)

    offset = Vector((
        distance * math.cos(elev) * math.sin(azim),
        -distance * math.cos(elev) * math.cos(azim),
        distance * math.sin(elev),
    ))
    cam_obj.location = center + offset

    direction = (center - cam_obj.location).normalized()
    cam_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

    scene.camera = cam_obj
    return cam_obj


def ensure_studio_lighting(center: Vector, radius: float) -> None:
    scene = bpy.context.scene
    existing_lights = [obj for obj in scene.objects if obj.type == "LIGHT"]

    if not existing_lights:
        # Warm directional Area key light
        key_data = bpy.data.lights.new(name="AutoAreaKeyLight", type="AREA")
        key_data.shape = "RECTANGLE"
        key_data.size = radius * 1.8
        key_data.size_y = radius * 1.2
        key_data.energy = max(120.0, (radius ** 2) * 85.0)
        key_data.color = (1.0, 0.94, 0.86)
        key_obj = bpy.data.objects.new(name="AutoAreaKeyLight", object_data=key_data)
        scene.collection.objects.link(key_obj)
        key_obj.location = center + Vector((radius * 2.2, -radius * 1.9, radius * 2.4))
        key_obj.rotation_euler = (center - key_obj.location).normalized().to_track_quat("-Z", "Y").to_euler()

        # Subtle cool fill/rim area light so dark silhouettes separate cleanly
        rim_data = bpy.data.lights.new(name="AutoAreaRimLight", type="AREA")
        rim_data.shape = "RECTANGLE"
        rim_data.size = radius * 1.5
        rim_data.size_y = radius * 1.0
        rim_data.energy = max(45.0, (radius ** 2) * 32.0)
        rim_data.color = (0.76, 0.86, 1.0)
        rim_obj = bpy.data.objects.new(name="AutoAreaRimLight", object_data=rim_data)
        scene.collection.objects.link(rim_obj)
        rim_obj.location = center + Vector((-radius * 2.4, radius * 1.8, radius * 1.6))
        rim_obj.rotation_euler = (center - rim_obj.location).normalized().to_track_quat("-Z", "Y").to_euler()

    # Configure subtle dark charcoal studio world background if none configured
    if scene.world is None:
        world = bpy.data.worlds.new("StudioWorld")
        scene.world = world
    scene.world.use_nodes = True
    bg_node = scene.world.node_tree.nodes.get("Background")
    if bg_node is not None:
        bg_node.inputs[0].default_value = (0.045, 0.052, 0.068, 1.0)
        bg_node.inputs[1].default_value = 0.55


def configure_and_render_cycles() -> None:
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
    scene.render.filepath = PREVIEW_PATH

    scene.view_settings.view_transform = "AgX" if "AgX" in [
        item.identifier for item in scene.view_settings.bl_rna.properties["view_transform"].enum_items
    ] else "Filmic"
    scene.view_settings.exposure = 0.15

    bpy.ops.render.render(write_still=True)


def main() -> None:
    ensure_output_dir()

    # 1. Pack all textures/assets before saving .blend
    try:
        bpy.ops.file.pack_all()
    except RuntimeError as exc:
        print(f"[export_and_render] pack_all skipped: {exc}")

    # 2. Save outputs/model.blend
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    print(f"[export_and_render] Saved {BLEND_PATH}")

    # 3. Export outputs/model.glb with modifiers applied
    bpy.ops.export_scene.gltf(
        filepath=GLB_PATH,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
    )
    print(f"[export_and_render] Exported {GLB_PATH}")

    # 4. Auto-frame camera & lighting from all MESH objects, then render Cycles CPU preview
    center, size, radius = compute_scene_mesh_bounds()
    print(f"[export_and_render] Mesh bounds center={tuple(round(v, 3) for v in center)} size={tuple(round(v, 3) for v in size)}")
    ensure_camera(center, radius)
    ensure_studio_lighting(center, radius)
    configure_and_render_cycles()
    print(f"[export_and_render] Rendered {PREVIEW_PATH}")


if __name__ == "__main__":
    main()
