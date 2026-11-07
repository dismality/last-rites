"""Prepares a third-party model for Last Rites: fixes scale, cuts triangles,
tints it towards the game's palette and exports a compressed .glb.

Run with Blender 4.4 or later:
  blender -b --factory-startup -P tools/blender/prep_model.py -- IN OUT [options]

IN can be .glb, .gltf, .fbx or .obj. Options:
  --height METRES   scale so the model is this tall
  --max-tris N      reduce to at most N triangles (default 20000)
  --tint NAME       stone, iron, wood or none (default none)
  --strength 0-1    how far to pull colours towards the tint (default 0.6)
"""
import argparse
import os
import sys

import bpy

# Linear RGB tints taken from the cold, weathered side of the visual style guide.
TINTS = {
    "stone": (0.20, 0.21, 0.23),
    "iron": (0.07, 0.07, 0.08),
    "wood": (0.11, 0.075, 0.05),
}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("source")
    parser.add_argument("target")
    parser.add_argument("--height", type=float)
    parser.add_argument("--max-tris", type=int, default=20000)
    parser.add_argument("--tint", choices=[*TINTS, "none"], default="none")
    parser.add_argument("--strength", type=float, default=0.6)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1:])


def import_model(path):
    ext = os.path.splitext(path)[1].lower()
    if ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=path)
    elif ext == ".obj":
        bpy.ops.wm.obj_import(filepath=path)
    else:
        raise SystemExit(f"Unsupported format: {ext}")


def triangles(meshes):
    return sum(len(p.vertices) - 2 for o in meshes for p in o.data.polygons)


def bounds(meshes):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    points = []
    for o in meshes:
        evaluated = o.evaluated_get(depsgraph)
        points += [evaluated.matrix_world @ v.co for v in evaluated.to_mesh().vertices]
        evaluated.to_mesh_clear()
    return ([min(p[i] for p in points) for i in range(3)], [max(p[i] for p in points) for i in range(3)])


def rescale(roots, meshes, height):
    lo, hi = bounds(meshes)
    factor = height / (hi[2] - lo[2])
    for o in roots:
        o.scale = [s * factor for s in o.scale]
        o.location = [v * factor for v in o.location]
    bpy.context.view_layer.update()


def reduce(meshes, limit):
    total = triangles(meshes)
    if total <= limit:
        return
    for o in meshes:
        mod = o.modifiers.new("reduce", "DECIMATE")
        mod.ratio = limit / total
        mod.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=mod.name)


def tint(meshes, name, strength):
    done = set()
    target = TINTS[name]
    for o in meshes:
        for mat in o.data.materials:
            if not mat or mat.name in done or not mat.use_nodes:
                continue
            done.add(mat.name)
            bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
            if not bsdf:
                continue
            base = bsdf.inputs["Base Color"]
            if not base.is_linked:
                base.default_value = [*(a + (b - a) * strength for a, b in zip(base.default_value[:3], target)), 1]
            bsdf.inputs["Roughness"].default_value = max(bsdf.inputs["Roughness"].default_value, 0.7)


def main():
    args = parse_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    import_model(args.source)
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    roots = [o for o in bpy.data.objects if o.parent is None]
    before = triangles(meshes)
    if args.height:
        rescale(roots, meshes, args.height)
    reduce(meshes, args.max_tris)
    if args.tint != "none":
        tint(meshes, args.tint, args.strength)
    os.makedirs(os.path.dirname(os.path.abspath(args.target)), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=args.target, export_format="GLB", export_yup=True, export_apply=True,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
    )
    lo, hi = bounds(meshes)
    print(f"PREP_RESULT triangles {before} -> {triangles(meshes)}, height {hi[2] - lo[2]:.3f} m, "
          f"materials {len({m.name for o in meshes for m in o.data.materials if m})}")


main()
