"""Converts Kenney's Graveyard Kit into Last Rites world props.

Every kit model shares one palette texture, so regrading that texture moves the
whole kit from its bright toy colours to the game's cold gothic look. Models are
also scaled to fit a 1.7 m player, and they keep their ground-level pivots.

Download the kit from https://kenney.nl/assets/graveyard-kit (CC0), unzip it, then run:
  blender -b --factory-startup -P tools/blender/prep_kenney_graveyard.py -- "KIT/Models/GLB format"
"""
import colorsys
import os
import sys

import bpy
import numpy as np
from mathutils import Matrix

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_DIR = os.path.join(ROOT, "public", "assets", "models", "world")

# Scale per group. Crypts are larger than the rest so the player fits through their doors.
GROUPS = {
    1.5: """grave grave-border gravestone-bevel gravestone-broken gravestone-cross gravestone-cross-large
            gravestone-debris gravestone-decorative gravestone-roof gravestone-round gravestone-wide cross
            cross-column cross-wood stone-wall stone-wall-column stone-wall-curve
            stone-wall-damaged iron-fence iron-fence-bar iron-fence-border iron-fence-border-column
            iron-fence-border-curve iron-fence-border-gate iron-fence-curve iron-fence-damaged fence
            fence-damaged fence-gate border-pillar altar-stone altar-wood bench bench-damaged candle
            candle-multiple lantern-candle lantern-glass fire-basket urn-round urn-square detail-bowl
            detail-chalice detail-plate debris debris-wood rocks rocks-tall trunk trunk-long shovel
            shovel-dirt road""",
    2.0: "coffin coffin-old",
    2.4: """crypt crypt-a crypt-b crypt-door crypt-large crypt-large-door crypt-large-roof crypt-small
            crypt-small-roof brick-wall brick-wall-curve brick-wall-curve-small brick-wall-end column-large
            pillar-large pillar-obelisk pillar-small pillar-square lightpost-all lightpost-double
            lightpost-single""",
    3.0: "pine pine-crooked pine-fall pine-fall-crooked",
}


def grade_pixel(r, g, b):
    """Cools and drains a palette colour. Warm colours stay faintly warm as rust and bark."""
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    warm = h < 0.14 or h > 0.92
    green = 0.2 < h < 0.5
    if warm:
        s, v = s * 0.55, v * 0.66
    elif green:
        h, s, v = 0.27, s * 0.3, v * 0.5
    else:
        h, s, v = 0.6, s * 0.2, v * 0.74
    return colorsys.hsv_to_rgb(h, s, v)


def graded(image):
    pixels = np.array(image.pixels[:], dtype=np.float32).reshape(-1, 4)
    cache = {}
    for i, p in enumerate(pixels):
        key = tuple(np.round(p[:3], 3))
        if key not in cache:
            cache[key] = grade_pixel(*key)
        pixels[i, :3] = cache[key]
    return pixels.ravel()


def convert(source, target, factor, palette):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=source)

    meshes_done = set()
    for obj in bpy.data.objects:
        obj.location = obj.location * factor
        if obj.type == "MESH" and obj.data.name not in meshes_done:
            obj.data.transform(Matrix.Scale(factor, 4))
            meshes_done.add(obj.data.name)

    for image in bpy.data.images:
        if image.size[0]:
            palette = palette if palette is not None else graded(image)
            image.pixels[:] = palette
            image.pack()
    for mat in bpy.data.materials:
        if mat.use_nodes:
            for node in mat.node_tree.nodes:
                if node.type == "BSDF_PRINCIPLED":
                    node.inputs["Metallic"].default_value = 0
                    node.inputs["Roughness"].default_value = 0.85

    bpy.ops.export_scene.gltf(
        filepath=target, export_format="GLB", export_yup=True, export_apply=True,
        export_image_format="WEBP", export_animations=False,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
    )
    return palette


def main():
    source_dir = sys.argv[sys.argv.index("--") + 1]
    os.makedirs(OUT_DIR, exist_ok=True)
    palette, count = None, 0
    for factor, names in GROUPS.items():
        for name in names.split():
            source = os.path.join(source_dir, f"{name}.glb")
            palette = convert(source, os.path.join(OUT_DIR, f"{name}.glb"), factor, palette)
            count += 1
    print(f"KIT_RESULT {count} models")


main()
