"""Converts two CC0 Quaternius zombies from Poly Pizza into Last Rites enemies.

The bright cartoon skin is regraded to a cold corpse look, duplicate animation
clips are removed, clip names are shortened and each model is scaled to human height.

The .glb files are edited directly. Exporting these models through Blender breaks
clips that only animate some bones, because the other bones fall back to a T-pose.
Blender is used only to read and write the texture.

Download the .glb files from https://poly.pizza/m/VlXjG0N8Eg (saved as zombie-a.glb)
and https://poly.pizza/m/JoBvxIUpZP (saved as zombie-b.glb), then run:
  blender -b --factory-startup -P tools/blender/prep_zombies.py -- DOWNLOAD_FOLDER
"""
import colorsys
import json
import os
import struct
import sys
import tempfile

import bpy
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_DIR = os.path.join(ROOT, "public", "assets", "models", "enemies")

# source file, output name, root scale, clips to keep as {source name: game name}
# Scales were measured in three.js and give heights of 1.75 m and 1.95 m.
MODELS = (
    ("zombie-a.glb", "zombie", 1.407, {
        "Idle": "Idle", "Walk": "Walk", "Run": "Run", "Crawl": "Crawl", "Punch": "Attack",
        "Run_Attack": "Lunge", "Idle_Attack": "Threaten", "HitReact": "HitReact", "Death": "Death",
    }),
    ("zombie-b.glb", "zombie-brute", 0.713, {
        "Idle": "Idle", "Walk": "Walk", "Run": "Run", "Attack": "Attack", "HitRecieve": "HitReact", "Death": "Death",
    }),
)


def grade_pixel(r, g, b):
    """Green skin becomes grey-green corpse. Reds become dried blood, everything else cold cloth."""
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    if 0.14 <= h <= 0.45:
        return colorsys.hsv_to_rgb(0.22, s * 0.2, min(1.0, v * 0.74))
    if h < 0.06 or h > 0.8:
        return colorsys.hsv_to_rgb(0.0, s * 0.6, v * 0.5)
    return colorsys.hsv_to_rgb(0.6, s * 0.2, v * 0.55)


def grade_texture(data, suffix):
    """Regrades encoded image bytes and returns them as PNG bytes."""
    with tempfile.TemporaryDirectory() as folder:
        source = os.path.join(folder, "source" + suffix)
        target = os.path.join(folder, "graded.png")
        with open(source, "wb") as f:
            f.write(data)
        image = bpy.data.images.load(source)
        pixels = np.array(image.pixels[:], dtype=np.float32).reshape(-1, 4)
        unique, inverse = np.unique(np.round(pixels[:, :3], 2), axis=0, return_inverse=True)
        graded = np.array([grade_pixel(*c) for c in unique], dtype=np.float32)
        pixels[:, :3] = graded[inverse.ravel()]
        image.pixels[:] = pixels.ravel()
        image.filepath_raw = target
        image.file_format = "PNG"
        image.save()
        bpy.data.images.remove(image)
        with open(target, "rb") as f:
            return f.read()


def read_glb(path):
    with open(path, "rb") as f:
        data = f.read()
    json_size = struct.unpack("<I", data[12:16])[0]
    doc = json.loads(data[20:20 + json_size])
    return doc, data[20 + json_size + 8:]


def write_glb(path, doc, binary):
    text = json.dumps(doc, separators=(",", ":")).encode("utf-8")
    text += b" " * (-len(text) % 4)
    binary += b"\0" * (-len(binary) % 4)
    total = 12 + 8 + len(text) + 8 + len(binary)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<I4s", len(text), b"JSON") + text)
        f.write(struct.pack("<I4s", len(binary), b"BIN\0") + binary)


def keep_clips(doc, clips):
    """Keeps the first copy of each wanted clip, under its game name."""
    kept = {}
    for animation in doc["animations"]:
        short = animation.get("name", "").split("|")[-1]
        if short in clips and clips[short] not in kept:
            animation["name"] = clips[short]
            kept[clips[short]] = animation
    missing = set(clips.values()) - set(kept)
    if missing:
        raise SystemExit(f"Missing clips: {sorted(missing)}")
    doc["animations"] = list(kept.values())


def used_accessors(doc):
    used = set()
    for mesh in doc["meshes"]:
        for primitive in mesh["primitives"]:
            used.update(primitive["attributes"].values())
            if "indices" in primitive:
                used.add(primitive["indices"])
            for target in primitive.get("targets", []):
                used.update(target.values())
    for skin in doc.get("skins", []):
        if "inverseBindMatrices" in skin:
            used.add(skin["inverseBindMatrices"])
    for animation in doc["animations"]:
        for sampler in animation["samplers"]:
            used.update((sampler["input"], sampler["output"]))
    return sorted(used)


def repack(doc, binary):
    """Rebuilds the binary chunk with only the data the kept clips still use."""
    old_views, old_accessors = doc["bufferViews"], doc["accessors"]
    used = used_accessors(doc)
    accessor_map = {old: new for new, old in enumerate(used)}
    doc["accessors"] = [old_accessors[i] for i in used]

    out, views, view_map = bytearray(), [], {}

    def copy_view(index, payload=None):
        if index not in view_map:
            view = dict(old_views[index])
            chunk = payload
            if chunk is None:
                start = view.get("byteOffset", 0)
                chunk = binary[start:start + view["byteLength"]]
            out.extend(b"\0" * (-len(out) % 4))
            view.update(buffer=0, byteOffset=len(out), byteLength=len(chunk))
            out.extend(chunk)
            view_map[index] = len(views)
            views.append(view)
        return view_map[index]

    for accessor in doc["accessors"]:
        accessor["bufferView"] = copy_view(accessor["bufferView"])
    for image in doc.get("images", []):
        view = old_views[image["bufferView"]]
        start = view.get("byteOffset", 0)
        data = binary[start:start + view["byteLength"]]
        suffix = ".png" if image.get("mimeType") == "image/png" else ".jpg"
        image["bufferView"] = copy_view(image["bufferView"], grade_texture(data, suffix))
        image["mimeType"] = "image/png"

    for mesh in doc["meshes"]:
        for primitive in mesh["primitives"]:
            primitive["attributes"] = {k: accessor_map[v] for k, v in primitive["attributes"].items()}
            if "indices" in primitive:
                primitive["indices"] = accessor_map[primitive["indices"]]
            if "targets" in primitive:
                primitive["targets"] = [{k: accessor_map[v] for k, v in t.items()} for t in primitive["targets"]]
    for skin in doc.get("skins", []):
        if "inverseBindMatrices" in skin:
            skin["inverseBindMatrices"] = accessor_map[skin["inverseBindMatrices"]]
    for animation in doc["animations"]:
        for sampler in animation["samplers"]:
            sampler["input"] = accessor_map[sampler["input"]]
            sampler["output"] = accessor_map[sampler["output"]]

    doc["bufferViews"] = views
    doc["buffers"] = [{"byteLength": len(out)}]
    return bytes(out)


def scale_root(doc, factor):
    scene = doc["scenes"][doc.get("scene", 0)]
    doc["nodes"].append({"name": "Root", "scale": [factor] * 3, "children": scene["nodes"]})
    scene["nodes"] = [len(doc["nodes"]) - 1]


def convert(source, target, factor, clips):
    doc, binary = read_glb(source)
    keep_clips(doc, clips)
    binary = repack(doc, binary)
    scale_root(doc, factor)
    for material in doc.get("materials", []):
        pbr = material.setdefault("pbrMetallicRoughness", {})
        pbr["metallicFactor"], pbr["roughnessFactor"] = 0, 0.8
    write_glb(target, doc, binary)
    print(f"ZOMBIE_RESULT {os.path.basename(target)} {os.path.getsize(target)} bytes, clips {list(clips.values())}")


def main():
    source_dir = sys.argv[sys.argv.index("--") + 1]
    os.makedirs(OUT_DIR, exist_ok=True)
    for source, name, factor, clips in MODELS:
        convert(os.path.join(source_dir, source), os.path.join(OUT_DIR, f"{name}.glb"), factor, clips)


main()
