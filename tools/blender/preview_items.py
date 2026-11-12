"""Renders contact sheets of item models so they can be reviewed without the game.

  blender -b --factory-startup -P tools/blender/preview_items.py -- OUT_DIR id1,id2,...

Each model is imported from public/assets/models/items, scaled to fit one grid cell (the real size is
printed under it), and lit with a warm key light and a cool rim, like the lantern at night.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
args = sys.argv[sys.argv.index("--") + 1:]
OUT, IDS = args[0], args[1].split(",")
COLS, CELL = 4, 1.6
SHEET = int(args[2]) if len(args) > 2 else 8

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE_NEXT"
sc.eevee.taa_render_samples = 32
sc.view_settings.view_transform = "AgX"
world = bpy.data.worlds.new("w")
sc.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.05, 0.05, 0.06, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0


def light(kind, energy, color, rot):
    d = bpy.data.lights.new(kind, kind)
    d.energy, d.color = energy, color
    if kind == "SUN":
        d.angle = 0.2
    o = bpy.data.objects.new(kind, d)
    o.rotation_euler = rot
    sc.collection.objects.link(o)


light("SUN", 3.2, (1.0, 0.82, 0.62), (math.radians(50), 0, math.radians(30)))
light("SUN", 1.3, (0.6, 0.7, 1.0), (math.radians(60), 0, math.radians(200)))

os.makedirs(OUT, exist_ok=True)
for page in range(0, len(IDS), SHEET):
    for o in list(bpy.data.objects):
        if o.type in ("MESH", "EMPTY", "FONT", "CAMERA"):
            bpy.data.objects.remove(o)
    batch = IDS[page:page + SHEET]
    rows = math.ceil(len(batch) / COLS)
    for i, item in enumerate(batch):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, "public", "assets", "models", "items", item + ".glb"))
        objs = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
        lo = Vector((1e9,) * 3)
        hi = Vector((-1e9,) * 3)
        for o in objs:
            for c in o.bound_box:
                w = o.matrix_world @ Vector(c)
                lo = Vector(map(min, lo, w))
                hi = Vector(map(max, hi, w))
        size = max(hi - lo)
        s = 0.95 / size
        cx, cy = (i % COLS) * CELL, -(i // COLS) * CELL
        for o in [o for o in bpy.data.objects if o not in before and o.parent is None]:
            o.scale *= s
            o.location = (o.location - (lo + hi) / 2) * s + Vector((cx, cy, 0))
            o.rotation_euler.z += math.radians(-25)
        t = bpy.data.curves.new("t", "FONT")
        t.body = f"{item}  {round((hi - lo).x * 1000)}x{round((hi - lo).y * 1000)}x{round((hi - lo).z * 1000)}mm"
        t.size = 0.075
        t.align_x = "CENTER"
        to = bpy.data.objects.new("label", t)
        to.location = (cx, cy - 0.7, -0.5)
        to.rotation_euler = (math.radians(35), 0, 0)
        sc.collection.objects.link(to)
    cam_d = bpy.data.cameras.new("cam")
    cam_d.type = "ORTHO"
    cam_d.ortho_scale = COLS * CELL + 0.2
    cam = bpy.data.objects.new("cam", cam_d)
    cam.location = ((COLS - 1) * CELL / 2, -(rows - 1) * CELL / 2 - 4.2, 3.0)
    cam.rotation_euler = (math.radians(55), 0, 0)
    sc.collection.objects.link(cam)
    sc.camera = cam
    sc.render.resolution_x = 1600
    sc.render.resolution_y = int(1600 * rows / COLS * 0.95)
    sc.render.filepath = os.path.join(OUT, f"items-{page // SHEET + 1}.png")
    bpy.ops.render.render(write_still=True)
