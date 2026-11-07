"""Builds the eight Last Rites hero items and exports them as .glb.

Run with Blender 4.4 or later:
  blender -b --factory-startup -P tools/blender/hero_items.py

Models use real-world scale in metres, are centred on their bounding box, and
keep their hidden mark on the back. In glTF space that face looks along -Z.
"""
import json
import os
from math import cos, pi, radians, sin, sqrt

import bmesh
import bpy
from mathutils import Matrix, Vector, kdtree, noise

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_DIR = os.path.join(ROOT, "public", "assets", "models", "items")
DOC_PATH = os.path.join(ROOT, "docs", "hero-items.md")

BACK_RIGHT = Vector((-1, 0, 0))
UP = Vector((0, 0, 1))

# base and grime are linear RGB. relief is surface roughness as a share of model size.
# Metal stays well below 1 because the game has no environment map to reflect.
MATERIALS = {
    "rust": dict(base=(0.20, 0.095, 0.05), grime=(0.42, 0.17, 0.05), metal=0.3, rough=0.85, relief=0.0016),
    "iron": dict(base=(0.075, 0.075, 0.08), grime=(0.24, 0.10, 0.04), metal=0.5, rough=0.58, relief=0.0009),
    "silver": dict(base=(0.50, 0.50, 0.47), grime=(0.27, 0.26, 0.24), metal=0.55, rough=0.42, relief=0.0),
    "gold": dict(base=(0.62, 0.43, 0.16), grime=(0.26, 0.19, 0.07), metal=0.6, rough=0.38, relief=0.0),
    "bone": dict(base=(0.70, 0.60, 0.42), grime=(0.27, 0.17, 0.08), metal=0.0, rough=0.62, relief=0.0022),
    "leather": dict(base=(0.09, 0.05, 0.03), grime=(0.04, 0.025, 0.018), metal=0.0, rough=0.75, relief=0.0),
    "wood": dict(base=(0.05, 0.026, 0.015), grime=(0.13, 0.07, 0.035), metal=0.0, rough=0.32, relief=0.0),
    "cloth": dict(base=(0.56, 0.50, 0.38), grime=(0.36, 0.30, 0.21), metal=0.0, rough=0.96, relief=0.0),
    "twine": dict(base=(0.27, 0.19, 0.10), grime=(0.13, 0.09, 0.05), metal=0.0, rough=0.9, relief=0.0),
    "thread": dict(base=(0.16, 0.015, 0.015), grime=(0.08, 0.01, 0.01), metal=0.0, rough=0.85, relief=0.0),
    "scratch": dict(base=(0.88, 0.83, 0.72), grime=(0.68, 0.62, 0.52), metal=0.25, rough=0.5, relief=0.0),
    "ink": dict(base=(0.035, 0.022, 0.015), grime=(0.02, 0.012, 0.01), metal=0.0, rough=0.8, relief=0.0),
    "garnet": dict(base=(0.28, 0.008, 0.02), grime=(0.10, 0.003, 0.01), metal=0.0, rough=0.14, relief=0.0),
}

# Strokes drawn by hand instead of a font, so marks look scratched and need no font licence.
GLYPHS = {
    "A": (0.8, [[(0, 0), (0.35, 1), (0.7, 0)], [(0.14, 0.4), (0.56, 0.4)]]),
    "C": (0.8, [[(0.7, 0.85), (0.5, 1), (0.2, 1), (0, 0.75), (0, 0.25), (0.2, 0), (0.5, 0), (0.7, 0.15)]]),
    "E": (0.75, [[(0.65, 1), (0, 1), (0, 0), (0.65, 0)], [(0, 0.5), (0.5, 0.5)]]),
    "I": (0.4, [[(0.15, 0), (0.15, 1)]]),
    "M": (0.85, [[(0, 0), (0, 1), (0.35, 0.4), (0.7, 1), (0.7, 0)]]),
    "N": (0.85, [[(0, 0), (0, 1), (0.7, 0), (0.7, 1)]]),
    "R": (0.8, [[(0, 0), (0, 1), (0.5, 1), (0.68, 0.85), (0.68, 0.62), (0.5, 0.5), (0, 0.5)], [(0.35, 0.5), (0.7, 0)]]),
    "T": (0.8, [[(0, 1), (0.7, 1)], [(0.35, 1), (0.35, 0)]]),
    "X": (0.85, [[(0, 0), (0.7, 1)], [(0, 1), (0.7, 0)]]),
    ".": (0.4, [[(0.08, 0), (0.18, 0.04)]]),
    "1": (0.55, [[(0.1, 0.8), (0.3, 1), (0.3, 0)]]),
    "4": (0.8, [[(0.55, 0), (0.55, 1), (0, 0.3), (0.7, 0.3)]]),
    "8": (0.8, [[(0.35, 0.52), (0.12, 0.7), (0.12, 0.88), (0.35, 1), (0.58, 0.88), (0.58, 0.7), (0.35, 0.52),
                 (0.08, 0.3), (0.08, 0.12), (0.35, 0), (0.62, 0.12), (0.62, 0.3), (0.35, 0.52)]]),
    "9": (0.8, [[(0.6, 0.6), (0.35, 0.45), (0.1, 0.6), (0.1, 0.85), (0.35, 1), (0.6, 0.85), (0.6, 0.6),
                 (0.55, 0.2), (0.3, 0), (0.1, 0.1)]]),
}


class Model:
    def __init__(self, item_id, name, clue):
        self.id, self.name, self.clue = item_id, name, clue
        self.verts, self.faces, self.mark_at = [], [], None

    def add(self, verts, faces, mat, matrix=None):
        base = len(self.verts)
        m = matrix or Matrix.Identity(4)
        self.verts += [m @ Vector(v) for v in verts]
        self.faces += [(tuple(i + base for i in f), mat) for f in faces]


def at(x=0, y=0, z=0):
    return Matrix.Translation((x, y, z))


Z_TO_Y = Matrix.Rotation(radians(-90), 4, "X")


def lathe(m, profile, mat, seg=24, matrix=None, closed=False):
    """Revolves (radius, height) pairs around Z. Run the profile bottom to top."""
    verts, rings = [], []
    for r, z in profile:
        if r < 1e-7:
            rings.append([len(verts)])
            verts.append((0, 0, z))
        else:
            rings.append(list(range(len(verts), len(verts) + seg)))
            verts += [(r * cos(2 * pi * k / seg), r * sin(2 * pi * k / seg), z) for k in range(seg)]
    faces = []
    pairs = list(zip(rings, rings[1:])) + ([(rings[-1], rings[0])] if closed else [])
    for a, b in pairs:
        for k in range(seg):
            k1 = (k + 1) % seg
            if len(a) == 1:
                faces.append((a[0], b[k1], b[k]))
            elif len(b) == 1:
                faces.append((a[k], a[k1], b[0]))
            else:
                faces.append((a[k], a[k1], b[k1], b[k]))
    if not closed:
        if len(rings[0]) > 1:
            faces.append(tuple(reversed(rings[0])))
        if len(rings[-1]) > 1:
            faces.append(tuple(rings[-1]))
    m.add(verts, faces, mat, matrix)


def sweep(m, pts, radius, mat, seg=8, closed=False, flat=1.0, normal=None):
    """Runs a tube along a path. flat squashes it to make straps."""
    pts = [Vector(p) for p in pts]
    n_pts = len(pts)
    radii = radius if isinstance(radius, (list, tuple)) else [radius] * n_pts
    tangents = []
    for i in range(n_pts):
        a = pts[(i - 1) % n_pts] if closed or i > 0 else pts[i]
        b = pts[(i + 1) % n_pts] if closed or i < n_pts - 1 else pts[i]
        tangents.append((b - a).normalized())
    n = Vector(normal) if normal else tangents[0].orthogonal()
    verts, rings = [], []
    for i, p in enumerate(pts):
        t = tangents[i]
        n = (n - t * n.dot(t)).normalized()
        b = t.cross(n)
        ring = []
        for k in range(seg):
            a = 2 * pi * k / seg
            ring.append(len(verts))
            verts.append(p + radii[i] * (cos(a) * n + sin(a) * flat * b))
        rings.append(ring)
    faces = []
    pairs = list(zip(rings, rings[1:])) + ([(rings[-1], rings[0])] if closed else [])
    for a, b in pairs:
        for k in range(seg):
            k1 = (k + 1) % seg
            faces.append((a[k], a[k1], b[k1], b[k]))
    if not closed:
        faces.append(tuple(reversed(rings[0])))
        faces.append(tuple(rings[-1]))
    m.add(verts, faces, mat)


def box(m, center, size, mat, bevel=0.0, matrix=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.edges) + list(bm.verts), offset=bevel, segments=1,
                        profile=0.5, affect="EDGES", clamp_overlap=True)
    bm.verts.index_update()
    verts = [v.co.copy() for v in bm.verts]
    faces = [tuple(v.index for v in f.verts) for f in bm.faces]
    bm.free()
    m.add(verts, faces, mat, (matrix or Matrix.Identity(4)) @ at(*center))


def sphere(m, center, r, mat, seg=12, rings=8):
    profile = [(r * sin(pi * i / rings), -r * cos(pi * i / rings)) for i in range(rings + 1)]
    lathe(m, profile, mat, seg=seg, matrix=at(*center))


def ring(m, center, big, small, mat, axis="Y", seg=8, steps=32, stretch=1.0):
    """Closed loop around an axis, used for rings, bails and chain links."""
    c = Vector(center)
    pts = []
    for i in range(steps):
        a = 2 * pi * i / steps
        u, v = big * cos(a), big * stretch * sin(a)
        pts.append(c + {"Y": Vector((u, 0, v)), "Z": Vector((u, v, 0)), "X": Vector((0, u, v))}[axis])
    sweep(m, pts, small, mat, seg=seg, closed=True)


def chain(m, pts, length, width, wire, mat, normal=(0, 1, 0)):
    """Places alternating links along a path at link spacing."""
    pts = [Vector(p) for p in pts]
    side = Vector(normal)
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        d = (b - a).normalized()
        s = d.cross(side).normalized() if i % 2 == 0 else side.normalized()
        c = (a + b) / 2
        loop = [c + d * (length / 2 * cos(2 * pi * k / 10)) + s * (width / 2 * sin(2 * pi * k / 10)) for k in range(10)]
        sweep(m, loop, wire, mat, seg=5, closed=True)


def text(m, s, center, right, up, height, r, mat, surface=None, offset=0.0, seed=1):
    """Draws hand-scratched strokes. surface pushes them onto a bumpy mesh."""
    center, right, up = Vector(center), Vector(right), Vector(up)
    normal = right.cross(up).normalized()
    width = sum(GLYPHS[c][0] for c in s) * height
    x = -width / 2
    for ci, ch in enumerate(s):
        advance, strokes = GLYPHS[ch]
        for si, stroke in enumerate(strokes):
            pts = []
            for (ax, ay), (bx, by) in zip(stroke, stroke[1:]):
                steps = max(1, int(((ax - bx) ** 2 + (ay - by) ** 2) ** 0.5 / 0.18))
                for i in range(steps):
                    t = i / steps
                    pts.append((ax + (bx - ax) * t, ay + (by - ay) * t))
            pts.append(stroke[-1])
            path = []
            for gi, (gx, gy) in enumerate(pts):
                wob = noise.noise(Vector((seed + ci * 3.1, si * 1.7, gi * 0.6))) * 0.035 * height
                p = center + right * (x + gx * height + wob) + up * ((gy - 0.5) * height - wob)
                if surface:
                    co = surface.find(p)[0]
                    p += normal * (co - p).dot(normal)
                path.append(p + normal * offset)
            sweep(m, path, r, mat, seg=4)
        x += advance * height
    m.mark_at = center.copy()


def smooth(pts, passes=2):
    """Rounds a polyline with Chaikin corner cutting, keeping both ends."""
    pts = [Vector(p) for p in pts]
    for _ in range(passes):
        out = [pts[0]]
        for a, b in zip(pts, pts[1:]):
            out += [a.lerp(b, 0.25), a.lerp(b, 0.75)]
        pts = out + [pts[-1]]
    return pts


def resample(pts, pitch):
    """Returns points spaced evenly along a path."""
    pts = [Vector(p) for p in pts]
    out, walked, target = [pts[0]], 0.0, pitch
    for a, b in zip(pts, pts[1:]):
        length = (b - a).length
        while walked + length >= target:
            out.append(a.lerp(b, (target - walked) / length))
            target += pitch
        walked += length
    return out


def surface_of(verts):
    tree = kdtree.KDTree(len(verts))
    for i, v in enumerate(verts):
        tree.insert(v, i)
    tree.balance()
    return tree


def subtract(m, cutters):
    """Boolean-cuts the current geometry. Each cutter is (kind, centre, size)."""
    obj = to_object(m, "cut_target")
    for i, (kind, center, size) in enumerate(cutters):
        c = Model("cutter", "", "")
        if kind == "box":
            box(c, center, size, "iron")
        else:
            lathe(c, [(size[0], -size[1]), (size[0], size[1])], "iron", seg=16, matrix=at(*center) @ Z_TO_Y)
        cutter = to_object(c, f"cutter{i}")
        mod = obj.modifiers.new(f"cut{i}", "BOOLEAN")
        mod.operation, mod.solver, mod.object = "DIFFERENCE", "EXACT", cutter
    bpy.context.view_layer.update()
    mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    names = [s.name for s in obj.data.materials]
    m.verts = [v.co.copy() for v in mesh.vertices]
    m.faces = [(tuple(p.vertices), names[p.material_index]) for p in mesh.polygons]
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)


def to_object(m, name):
    names = list(dict.fromkeys(mat for _, mat in m.faces))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v) for v in m.verts], [], [f for f, _ in m.faces])
    for n in names:
        mesh.materials.append(bpy.data.materials.get(n) or bpy.data.materials.new(n))
    for poly, (_, mat) in zip(mesh.polygons, m.faces):
        poly.material_index = names.index(mat)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def make_material(name):
    spec = MATERIALS[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Metallic"].default_value = spec["metal"]
    bsdf.inputs["Roughness"].default_value = spec["rough"]
    col = mat.node_tree.nodes.new("ShaderNodeVertexColor")
    col.layer_name = "Col"
    mat.node_tree.links.new(col.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def octaves(p):
    return noise.noise(p) * 0.6 + noise.noise(p * 2.3) * 0.28 + noise.noise(p * 5.1) * 0.12


def finish(m):
    """Centres the model, adds surface wear and exports it."""
    lo = Vector(min(v[i] for v in m.verts) for i in range(3))
    hi = Vector(max(v[i] for v in m.verts) for i in range(3))
    centre = (lo + hi) / 2
    size = (hi - lo).length
    m.verts = [v - centre for v in m.verts]

    for name in dict.fromkeys(mat for _, mat in m.faces):
        if name not in bpy.data.materials:
            make_material(name)
    obj = to_object(m, m.id)
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    vert_mat = {}
    for f, mat in m.faces:
        for i in f:
            vert_mat[i] = mat

    freq = 16.0 / size
    for i, v in enumerate(mesh.vertices):
        relief = MATERIALS[vert_mat.get(i, "iron")]["relief"] * size
        if relief:
            v.co += v.normal * octaves(v.co * freq * 1.6) * relief
    mesh.update()

    colors = mesh.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    for i, v in enumerate(mesh.vertices):
        spec = MATERIALS[vert_mat.get(i, "iron")]
        t = min(1.0, max(0.0, octaves(v.co * freq) * 1.6 + 0.42))
        rgb = [a + (b - a) * t for a, b in zip(spec["base"], spec["grime"])]
        colors.data[i].color = (*rgb, 1.0)
    mesh.color_attributes.active_color = colors
    mesh.color_attributes.render_color_index = mesh.color_attributes.find("Col")

    for p in mesh.polygons:
        p.use_smooth = True
    mesh.set_sharp_from_angle(angle=radians(38))

    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    os.makedirs(OUT_DIR, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT_DIR, f"{m.id}.glb"), export_format="GLB", use_selection=True,
        export_yup=True, export_apply=True, export_vertex_color="ACTIVE",
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14, export_draco_normal_quantization=10,
        export_draco_color_quantization=10, export_animations=False,
    )
    tris = sum(len(p.vertices) - 2 for p in mesh.polygons)
    mark = m.mark_at - centre
    dims = hi - lo
    bpy.data.objects.remove(obj)
    return dict(id=m.id, name=m.name, clue=m.clue, tris=tris,
                size_mm=[round(dims.x * 1000), round(dims.z * 1000), round(dims.y * 1000)],
                mark_gltf=[round(mark.x, 4), round(mark.z, 4), round(-mark.y, 4)])


def rusted_crypt_key():
    m = Model("rusted-crypt-key", "Rusted Crypt Key", "Scratched CRANE on the back of the bow")
    lathe(m, [(0, -0.047), (0.0026, -0.0466), (0.003, -0.045), (0.003, 0.0), (0.0033, 0.012), (0.0052, 0.0132),
              (0.0052, 0.0156), (0.0036, 0.0168), (0.0036, 0.0215), (0.0048, 0.0226), (0.0048, 0.0244),
              (0.003, 0.0256), (0.003, 0.03)], "rust", seg=14)
    for x, z in ((-0.0098, 0.0345), (0.0098, 0.0345), (0, 0.0478)):
        ring(m, (x, 0, z), 0.0086, 0.0017, "rust", seg=8)
    lathe(m, [(0, -0.0013), (0.0088, -0.0013), (0.0094, 0), (0.0088, 0.0013), (0, 0.0013)], "rust", seg=24,
          matrix=at(0, 0, 0.0345) @ Z_TO_Y)
    box(m, (0.0052, 0, -0.0385), (0.0052, 0.0028, 0.0152), "rust", 0.0003)
    for z, reach in ((-0.0442, 0.0138), (-0.0385, 0.0118), (-0.0328, 0.0138)):
        box(m, (0.0052 + reach / 2, 0, z), (reach, 0.0028, 0.0034), "rust", 0.0003)
    text(m, "CRANE", (0, 0.00138, 0.0345), BACK_RIGHT, UP, 0.0031, 0.00015, "scratch")
    return m


def iron_ossuary_key():
    m = Model("iron-ossuary-key", "Iron Ossuary Key", "Struck XXXI on the back of the bow")
    lathe(m, [(0, -0.066), (0.0042, -0.065), (0.0046, -0.063), (0.0046, 0.018), (0.0072, 0.0195), (0.0072, 0.0225),
              (0.0048, 0.024), (0.0048, 0.03), (0.0064, 0.031), (0.0064, 0.033), (0.0046, 0.034), (0.0046, 0.04)],
          "iron", seg=6)
    for x, z in ((-0.0155, 0.051), (0.0155, 0.051), (0, 0.0665), (0, 0.0355)):
        ring(m, (x, 0, z), 0.0098, 0.0021, "iron", seg=6, steps=20)
    rot = Matrix.Rotation(radians(45), 4, "Y")
    box(m, (0, 0, 0), (0.0205, 0.0036, 0.0205), "iron", 0.0005, matrix=at(0, 0, 0.051) @ rot)
    box(m, (0.0088, 0, -0.054), (0.0092, 0.0042, 0.0235), "iron", 0.0005)
    box(m, (0.0205, 0, -0.0642), (0.0145, 0.0042, 0.0042), "iron", 0.0004)
    box(m, (0.0205, 0, -0.0438), (0.0145, 0.0042, 0.0042), "iron", 0.0004)
    box(m, (0.0262, 0, -0.054), (0.0042, 0.0042, 0.0235), "iron", 0.0004)
    box(m, (0.0165, 0, -0.054), (0.0065, 0.0042, 0.0042), "iron", 0.0004)
    text(m, "XXXI", (0, 0.00188, 0.051), BACK_RIGHT, UP, 0.0062, 0.00019, "scratch")
    return m


def bone_whistle():
    m = Model("bone-whistle", "Sexton's Bone Whistle", "31 tally scratches run down the back")
    outer = [(0.0075, -0.043), (0.0084, -0.0415), (0.0092, -0.036), (0.0086, -0.026), (0.0072, -0.01),
             (0.0066, 0.01), (0.0067, 0.026), (0.0073, 0.036), (0.0068, 0.0415), (0.0058, 0.043)]
    inner = [(0.0038, 0.043), (0.0042, 0.03), (0.0042, -0.03), (0.0048, -0.043)]
    lathe(m, outer + inner, "bone", seg=20, closed=True)
    subtract(m, [("box", (0, -0.0078, 0.021), (0.0084, 0.0072, 0.0062)),
                 ("hole", (0, -0.0066, -0.002), (0.0019, 0.006)),
                 ("hole", (0, -0.0066, -0.015), (0.0019, 0.006)),
                 ("hole", (0, 0, -0.0345), (0.0014, 0.012))])
    loop = [(0.0015 * sin(a) + 0.0, 0.0115 * cos(a), -0.0345 + 0.0015 * sin(a * 2)) for a in
            [2 * pi * i / 16 for i in range(16)]]
    sweep(m, loop, 0.0007, "leather", seg=6, closed=True)
    tail = [(0, 0.0118, -0.0345), (0.003, 0.0152, -0.04), (0.0015, 0.0166, -0.05), (0.0045, 0.0158, -0.06),
            (0.0028, 0.0142, -0.069)]
    sweep(m, smooth(tail, 3), 0.00075, "leather", seg=6)
    for i in range(31):
        group, tick = divmod(i, 5)
        z = 0.029 - group * 0.0088 - tick * 0.0013
        radius = 0.0068 + 0.0023 * max(0.0, (-z - 0.01) / 0.026)
        a, h = 0.5 + noise.noise(Vector((i * 0.7, 0, 0))) * 0.08, 0.0024
        pts = [(-a * radius * t, sqrt(max(0.0, radius ** 2 - (a * radius * t) ** 2)) + 0.00002, z + h * 0.06 * t)
               for t in (-1, -0.5, 0, 0.5, 1)]
        sweep(m, pts, 0.00011, "ink", seg=4)
    m.mark_at = Vector((0, 0.007, 0.002))
    return m


def crane_rosary():
    m = Model("crane-rosary", "Crane's Rosary", "A.C. is scratched into the back of the cross")
    samples = []
    for i in range(400):
        t = -pi / 2 + 2 * pi * i / 400
        r = 0.076 * (1 + 0.17 * sin(2 * t + 0.7) + 0.07 * sin(5 * t))
        samples.append(Vector((r * cos(t), 0.0045 * sin(3 * t), 0.052 + 1.06 * r * sin(t))))
    total = sum((b - a).length for a, b in zip(samples, samples[1:] + samples[:1]))
    count = 40
    step, nodes, walked, target = total / count, [], 0.0, 0.0
    for a, b in zip(samples, samples[1:] + samples[:1]):
        seg_len = (b - a).length
        while walked + seg_len >= target and len(nodes) < count:
            nodes.append(a.lerp(b, (target - walked) / seg_len))
            target += step
        walked += seg_len
    for i, p in enumerate(nodes):
        if i == 0:
            continue
        big = i % 8 == 0
        sphere(m, p, 0.0058 if big else 0.0043, "wood", seg=10, rings=7)
    for a, b in zip(nodes, nodes[1:] + nodes[:1]):
        chain(m, [a.lerp(b, 0.18), a.lerp(b, 0.5), a.lerp(b, 0.82)], 0.0058, 0.0028, 0.00042, "silver")
    join = nodes[0]
    lathe(m, [(0, -0.0009), (0.0078, -0.0009), (0.0086, 0), (0.0078, 0.0009), (0, 0.0009)], "silver", seg=20,
          matrix=at(*join) @ Z_TO_Y)
    tail = [join + Vector((0.0034 * sin(i * 0.9), 0, -0.0145 * i)) for i in range(5)]
    for i, p in enumerate(tail[1:], 1):
        sphere(m, p, 0.0058 if i in (1, 4) else 0.0043, "wood", seg=10, rings=7)
    for a, b in zip(tail, tail[1:]):
        chain(m, [a.lerp(b, 0.18), a.lerp(b, 0.5), a.lerp(b, 0.82)], 0.0058, 0.0028, 0.00042, "silver")
    top = tail[-1] + Vector((0, 0, -0.0088))
    ring(m, top, 0.0026, 0.0005, "silver", axis="Y", seg=6, steps=14)
    c = top + Vector((0, 0, -0.0262))
    box(m, c, (0.0072, 0.0036, 0.0436), "silver", 0.0006)
    box(m, c + Vector((0, 0, 0.0082)), (0.0296, 0.0041, 0.0072), "silver", 0.0006)
    for off in ((0.0158, 0.0082), (-0.0158, 0.0082), (0, 0.0232), (0, -0.0232)):
        box(m, c + Vector((off[0], 0, off[1])), (0.0088, 0.0042, 0.0088) if off[0] else (0.0088, 0.0042, 0.0042),
            "silver", 0.0007)
    text(m, "A.C.", c + Vector((0, 0.00184, -0.008)), BACK_RIGHT, UP, 0.0044, 0.00016, "ink")
    return m


def sextons_bell_clapper():
    m = Model("sextons-bell-clapper", "Sexton's Bell Clapper", "E.T. is scratched into the flat of the shaft")
    profile = [(0, -0.112), (0.008, -0.1115), (0.0105, -0.108), (0.0105, -0.101), (0.0085, -0.098)]
    profile += [(0.032 * cos(a), -0.066 + 0.032 * sin(a)) for a in [radians(d) for d in range(-68, 69, 12)]]
    profile += [(0.0098, -0.03), (0.0088, -0.012), (0.0088, 0.048), (0.0105, 0.05), (0.0105, 0.056),
                (0.0088, 0.058), (0.0088, 0.074)]
    lathe(m, profile, "rust", seg=24)
    box(m, (0, 0, 0.018), (0.024, 0.016, 0.052), "rust", 0.0016)
    ring(m, (0, 0, 0.0925), 0.0165, 0.0052, "rust", axis="Y", seg=10, steps=26)
    strap = [(-0.024, 0.009, 0.128), (-0.018, 0.0085, 0.116), (-0.009, 0.0065, 0.108), (0, 0.0045, 0.1085),
             (0.012, 0.0, 0.112), (0.0225, -0.003, 0.1085), (0.0245, -0.0045, 0.093), (0.021, -0.0065, 0.08)]
    sweep(m, smooth(strap, 3), 0.0078, "leather", seg=10, flat=0.2, normal=(0, 0, 1))
    text(m, "E.T.", (0, 0.0081, 0.018), BACK_RIGHT, UP, 0.0098, 0.00046, "scratch")
    return m


def childs_locket():
    m = Model("childs-locket", "Child's Locket", "M.M. 1849 is engraved on the back")
    squash = Matrix.Diagonal((0.82, 1, 1, 1))
    profile = [(0, -0.0041), (0.0108, -0.0041), (0.0142, -0.0034), (0.0164, -0.0014), (0.0166, -0.0004),
               (0.0158, -0.00025), (0.0158, 0.00025), (0.0166, 0.0004), (0.0164, 0.0014), (0.0142, 0.0034),
               (0.0108, 0.0041), (0, 0.0041)]
    lathe(m, profile, "gold", seg=36, matrix=squash @ Z_TO_Y)
    ring_pts = [(0.0142 * 0.82 * cos(2 * pi * i / 40), -0.0036, 0.0142 * sin(2 * pi * i / 40)) for i in range(40)]
    sweep(m, ring_pts, 0.00034, "gold", seg=5, closed=True)
    for i in range(6):
        a = 2 * pi * i / 6 + pi / 6
        tip = Vector((0.0074 * cos(a), -0.0042, 0.0074 * sin(a)))
        mid = Vector((0.0033 * cos(a + 0.5), -0.0042, 0.0033 * sin(a + 0.5)))
        mid2 = Vector((0.0033 * cos(a - 0.5), -0.0042, 0.0033 * sin(a - 0.5)))
        sweep(m, [Vector((0, -0.0042, 0)), mid, tip, mid2, Vector((0, -0.0042, 0))], 0.00024, "gold", seg=4)
    sphere(m, (0, -0.0043, 0), 0.0011, "gold", seg=10, rings=6)
    box(m, (0, 0, 0.0172), (0.0034, 0.0030, 0.0020), "gold", 0.0003)
    ring(m, (0, 0, 0.0204), 0.0027, 0.0006, "gold", axis="X", seg=6, steps=16)
    path = smooth([(0, 0, 0.0228), (0.0075, 0.0005, 0.0262), (0.0155, 0.0012, 0.0225), (0.0192, 0.0006, 0.0115),
                   (0.0205, -0.0006, -0.0015), (0.0232, 0.0003, -0.0105), (0.0262, 0.0, -0.0128)], 3)
    path = resample(path, 0.0026)
    chain(m, path, 0.0034, 0.0018, 0.00027, "gold")
    text(m, "M.M.", (0, 0.00412, 0.0031), BACK_RIGHT, UP, 0.0034, 0.00013, "ink")
    text(m, "1849", (0, 0.00412, -0.0026), BACK_RIGHT, UP, 0.0034, 0.00013, "ink")
    m.mark_at = Vector((0, 0.00412, 0.0))
    return m


def cloth_layer(m, center, size, seed, turn=0.0):
    """One folded fabric slab, thin along Y, with ridged fold wrinkles."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=19, use_grid_fill=True)
    bm.verts.index_update()
    verts = []
    for v in bm.verts:
        u, w, h = v.co
        rounding = (1 - 0.26 * abs(w) ** 5)
        x = u * (1 - 0.10 * abs(w) ** 4) * size[0] / 2
        z = h * (1 - 0.10 * abs(w) ** 4) * size[2] / 2
        wrinkle = (sin(u * 7.5 + noise.noise(Vector((u, h, seed))) * 3.6) * 0.2
                   + sin((u + h) * 15 + seed) * 0.07 + noise.noise(Vector((u * 2.2, h * 2.2, seed))) * 0.34)
        y = (w * rounding + wrinkle * (0.9 - 0.25 * abs(w))) * size[1] / 2
        fold = sin(w * pi * 1.5 + seed) * 0.03 * (abs(u) ** 8 + abs(h) ** 8)
        verts.append(Vector((x + fold * size[0], y, z + fold * size[2])))
    faces = [tuple(v.index for v in f.verts) for f in bm.faces]
    bm.free()
    m.add(verts, faces, "cloth", at(*center) @ Matrix.Rotation(turn, 4, "Y"))
    return [at(*center) @ Matrix.Rotation(turn, 4, "Y") @ v for v in verts]


def burial_shroud():
    m = Model("burial-shroud", "Burial Shroud", "1849 is stitched in red thread on the underside")
    cloth_layer(m, (0, -0.016, 0), (0.205, 0.024, 0.142), 2.0, radians(4))
    cloth_layer(m, (0.004, 0.005, 0.002), (0.218, 0.026, 0.152), 5.0, radians(-3))
    back = cloth_layer(m, (-0.002, 0.026, -0.001), (0.226, 0.026, 0.158), 8.0, radians(1.5))
    flap = []
    for i in range(9):
        for j in range(19):
            u, t = j / 18, i / 8
            flap.append(Vector((-0.1 + 0.2 * u + 0.012 * sin(u * 9 + t * 3) * t, -0.031 - 0.012 * t + 0.008 * sin(u * 8) * t,
                                -0.072 - 0.062 * t - (0.016 * noise.noise(Vector((u * 7, 3.3, 0))) + 0.011) * t ** 3)))
    grid = [(i * 19 + j, i * 19 + j + 1, (i + 1) * 19 + j + 1, (i + 1) * 19 + j) for i in range(8) for j in range(18)]
    m.add(flap, grid, "cloth")
    m.add([v + Vector((0, 0.0012, 0)) for v in flap], [f[::-1] for f in grid], "cloth")
    for x in (-0.058, 0.062):
        pts = []
        for i in range(36):
            a = 2 * pi * i / 36
            pts.append((x + 0.0022 * sin(a * 3), 0.0065 + 0.0455 * cos(a), 0.0855 * sin(a) ** 0.6 if sin(a) > 0
                        else -0.0855 * (-sin(a)) ** 0.6))
        sweep(m, pts, 0.0021, "twine", seg=6, closed=True)
    text(m, "1849", (0.008, 0.043, 0.01), BACK_RIGHT, UP, 0.036, 0.0009, "thread",
         surface=surface_of([v for v in back if v.y > 0.03]), offset=0.0006)
    return m


def reliquary_heart():
    m = Model("reliquary-heart", "Reliquary Heart", "A.C. 1849 is engraved on the back")
    scale, depth, outline = 0.0031, 0.0172, []
    for i in range(72):
        t = 2 * pi * i / 72
        outline.append(Vector((16 * sin(t) ** 3 * scale, 0,
                               (13 * cos(t) - 5 * cos(2 * t) - 2 * cos(3 * t) - cos(4 * t)) * scale)))
    centre = Vector((0, 0, 0.003))
    count = len(outline)
    verts, faces = [], []
    rings_n = 12
    for side in (-1, 1):
        base = len(verts)
        verts.append(centre + Vector((0, side * depth, 0)))
        for k in range(1, rings_n + 1):
            s = sin(pi / 2 * k / rings_n)
            y = side * depth * sqrt(max(0.0, 1 - s * s))
            verts += [centre + (o - centre) * s + Vector((0, y, 0)) for o in outline]
        for i in range(count):
            i1 = (i + 1) % count
            tri = (base, base + 1 + i, base + 1 + i1)
            faces.append(tri if side > 0 else tri[::-1])
            for k in range(rings_n - 1):
                a, b = base + 1 + k * count, base + 1 + (k + 1) * count
                quad = (a + i, b + i, b + i1, a + i1)
                faces.append(quad if side > 0 else quad[::-1])
    body = list(verts)
    m.add(verts, faces, "silver")
    sweep(m, outline, 0.0024, "gold", seg=8, closed=True)
    for i in range(0, 72, 6):
        p = centre + (outline[i] - centre) * 0.86
        y = depth * sqrt(max(0.0, 1 - 0.86 ** 2))
        sphere(m, p - Vector((0, y + 0.0002, 0)), 0.00125, "gold", seg=8, rings=5)
    gem = at(0, -depth - 0.0004, 0.003) @ Z_TO_Y
    lathe(m, [(0, -0.0048), (0.0078, -0.0002), (0.0052, 0.0034), (0, 0.0036)][::-1], "garnet", seg=8,
          matrix=gem @ Matrix.Rotation(pi, 4, "X"))
    ring(m, (0, -depth - 0.0004, 0.003), 0.0086, 0.00085, "gold", axis="Y", seg=6, steps=28)
    box(m, (0, 0, 0.0292), (0.0042, 0.0042, 0.0335), "gold", 0.0005)
    box(m, (0, 0, 0.0372), (0.0138, 0.0048, 0.0038), "gold", 0.0005)
    ring(m, (0, 0, 0.0486), 0.0031, 0.00072, "gold", axis="X", seg=6, steps=16)
    tree = surface_of(body)
    text(m, "A.C.", (0, depth, 0.0088), BACK_RIGHT, UP, 0.0072, 0.00024, "scratch", surface=tree, offset=0.00002)
    text(m, "1849", (0, depth, -0.0028), BACK_RIGHT, UP, 0.0072, 0.00024, "scratch", surface=tree, offset=0.00002)
    m.mark_at = Vector((0, depth, 0.003))
    return m


def write_doc(results):
    lines = [
        "# Hero Items",
        "",
        "Generated by `tools/blender/hero_items.py`; rerun that script instead of editing this table.",
        "",
        "Files are in `public/assets/models/items/`, named after the item ID, at real-world scale in metres.",
        "They use Draco compression, so load them with drei `useGLTF`. Colour is stored as vertex colours.",
        "",
        "Every hidden mark faces **-Z** in the model's own space. Use `[0, 0, -1]` as the `ClueDef` normal.",
        "",
        "| Item ID | Name | Size W x H x D (mm) | Triangles | Hidden mark | Mark position (x, y, z) |",
        "|---|---|---|---|---|---|",
    ]
    for r in results:
        size = " x ".join(str(v) for v in r["size_mm"])
        lines.append(f"| `{r['id']}` | {r['name']} | {size} | {r['tris']} | {r['clue']} | {r['mark_gltf']} |")
    with open(DOC_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines) + "\n")


def main():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    for name in MATERIALS:
        make_material(name)
    builders = (rusted_crypt_key, iron_ossuary_key, bone_whistle, crane_rosary, sextons_bell_clapper,
                childs_locket, burial_shroud, reliquary_heart)
    results = [finish(build()) for build in builders]
    write_doc(results)
    print("HERO_RESULT " + json.dumps(results))


main()
