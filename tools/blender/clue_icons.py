"""Renders a picture of each clue model for the clue reveal and the journal's Clues tab.

Reads public/assets/models/props/clue-<id>.glb and writes public/assets/icons/clues/clue-<id>.png
(512 px, transparent background, lit like a lantern at night, cropped tight to the object).
  blender -b --factory-startup -P tools/blender/clue_icons.py
"""
import glob
import math
import os

import bpy
import numpy as np
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "public", "assets", "models", "props")
OUT = os.path.join(ROOT, "public", "assets", "icons", "clues")
os.makedirs(OUT, exist_ok=True)


def scene_setup():
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.render.resolution_x = sc.render.resolution_y = 512
    sc.render.film_transparent = True
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'
    w = bpy.data.worlds.new('w'); sc.world = w; w.color = (0.015, 0.017, 0.02)
    key = bpy.data.objects.new('key', bpy.data.lights.new('key', 'AREA'))
    key.data.energy = 260; key.data.size = 1.2; key.data.color = (1.0, 0.72, 0.45)
    rim = bpy.data.objects.new('rim', bpy.data.lights.new('rim', 'AREA'))
    rim.data.energy = 120; rim.data.size = 2.0; rim.data.color = (0.55, 0.65, 0.85)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); cam.data.lens = 50
    for o in (key, rim, cam):
        sc.collection.objects.link(o)
    sc.camera = cam
    return key, rim, cam


def autocrop(path, size=512, pad=0.08):
    """Crops the render to the object (alpha) with a little padding, square, back to `size` px."""
    img = bpy.data.images.load(path, check_existing=False)
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    ys, xs = np.nonzero(px[:, :, 3] > 0.02)
    if len(xs) == 0:
        bpy.data.images.remove(img)
        return
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    side = int(max(x1 - x0, y1 - y0) * (1 + 2 * pad))
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    canvas = np.zeros((side, side, 4), dtype=np.float32)
    sx0, sy0 = cx - side // 2, cy - side // 2
    for yy in range(side):
        sy = sy0 + yy
        if 0 <= sy < h:
            lo, hi = max(sx0, 0), min(sx0 + side, w)
            if lo < hi:
                canvas[yy, lo - sx0:hi - sx0] = px[sy, lo:hi]
    out = bpy.data.images.new('crop', side, side, alpha=True)
    out.pixels[:] = canvas.ravel()
    out.scale(size, size)
    out.filepath_raw = path
    out.file_format = 'PNG'
    out.save()
    bpy.data.images.remove(out)
    bpy.data.images.remove(img)


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


bpy.ops.wm.read_factory_settings(use_empty=True)
key, rim, cam = scene_setup()
for path in sorted(glob.glob(os.path.join(SRC, "clue-*.glb"))):
    for o in [o for o in bpy.data.objects if o.type not in ('LIGHT', 'CAMERA')]:
        bpy.data.objects.remove(o)
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    name = os.path.splitext(os.path.basename(path))[0]
    # The boots' muddy prints trail 1 m away and would shrink the boots to a speck; picture the boots.
    for o in meshes:
        if name == 'clue-hut-boots' and o.name.endswith('-mud'):
            o.hide_render = True
    meshes = [o for o in meshes if not o.hide_render]
    pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    lo = Vector([min(p[i] for p in pts) for i in range(3)]); hi = Vector([max(p[i] for p in pts) for i in range(3)])
    c = (lo + hi) / 2; r = max((hi - lo).length / 2, 0.15)
    d = r / math.tan(math.radians(36) / 2) * 1.05
    # Front three-quarter view from above. Most clues face +Z in game (-Y in Blender); the two wall
    # pieces in the catacombs face along X, so they are shot from that side.
    view = {'clue-cat-names': (-0.85, -0.35, 0.3), 'clue-cat-scratches': (0.85, -0.35, 0.3)}.get(name, (0.55, -0.75, 0.55))
    cam.location = c + Vector(view).normalized() * d
    aim(cam, c)
    key.location = c + Vector((-0.6, -0.8, 0.9)).normalized() * d; aim(key, c)
    rim.location = c + Vector((0.8, 0.9, 0.5)).normalized() * d; aim(rim, c)
    bpy.context.scene.render.filepath = os.path.join(OUT, name + ".png")
    bpy.ops.render.render(write_still=True)
    autocrop(bpy.context.scene.render.filepath)
    print("rendered", name)
