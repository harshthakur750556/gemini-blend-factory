"""Auto-generated Blender 4.2 LTS import & GitHub compute render script.
Model: Duck
Category: Core
Source: https://github.com/KhronosGroup/glTF-Sample-Assets
Repo Asset: models/duck/duck.glb
"""

import os
import bpy
from mathutils import Vector

MODEL_REL_PATH = "models/duck/duck.glb"
MODEL_PATH = os.path.abspath(MODEL_REL_PATH)

if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(f"Marketplace model not found in repository: {MODEL_PATH}")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=MODEL_PATH)

# Normalize mesh grounding so the imported asset sits cleanly at Z = 0 for Cycles studio renders
mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
if mesh_objects:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    min_co = Vector((float("inf"), float("inf"), float("inf")))
    max_co = Vector((float("-inf"), float("-inf"), float("-inf")))
    for obj in mesh_objects:
        eval_obj = obj.evaluated_get(depsgraph)
        for corner in eval_obj.bound_box:
            pt = eval_obj.matrix_world @ Vector(corner)
            min_co.x = min(min_co.x, pt.x)
            min_co.y = min(min_co.y, pt.y)
            min_co.z = min(min_co.z, pt.z)
            max_co.x = max(max_co.x, pt.x)
            max_co.y = max(max_co.y, pt.y)
            max_co.z = max(max_co.z, pt.z)

    center_x = (min_co.x + max_co.x) * 0.5
    center_y = (min_co.y + max_co.y) * 0.5
    offset = Vector((-center_x, -center_y, -min_co.z))

    root_objects = [obj for obj in bpy.context.scene.objects if obj.parent is None and obj.type in {"MESH", "EMPTY", "ARMATURE"}]
    for root in root_objects:
        root.location = root.location + offset
