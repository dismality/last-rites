"""Chapel interior furnishings for Last Rites.

  blender -b --factory-startup --python tools/blender/chapel_interior.py -- OUT_DIR PREVIEW_DIR [export|render|both]

Everything is in CHAPEL-LOCAL game coordinates (x east, y up, z south; origin = CHAPEL_CENTER [10, 0, 5]), so the game
mounts the GLB inside the chapel group with no transform. The walls, roof, doors and their colliders stay in the game;
this adds what is inside them.

Gameplay spots it serves (chapel-local):
  - journal page 5 at (0, 1.0, 0)        -> lectern, book rest at y 0.97
  - chapel-font loot at (1.5, 0.9, -2)   -> stone font with a wooden lid at y 0.88
  - chapel-pews loot at (-1, 0.4, 3)     -> west pew, seat at y 0.40
  - vestry cupboard item at (-2.1, 0.9, 2.6) -> cupboard shelf at y 0.88
  - altar at z 4.8 (trigger z 4.5)       -> altar table, top at y 1.0
Kept clear: the front door (z -6, |x| < 0.7) and the area inside it (z < -0.8), the congregation points
(+-1, -2) and (0, -3.5), the vestry door (x -2.5, z 3.8..5.2), the catacomb stair (0, 5.3) and the floor break (1.7, 4.6).
The floor over the stair is a separate mesh ("stair-cover") so it can be hidden when the stair opens.
"""
import bpy, bmesh, json, math, os, random, sys
from mathutils import Vector, Matrix, noise

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT_DIR, PREVIEW_DIR = ARGV[0], ARGV[1]
MODE = ARGV[2] if len(ARGV) > 2 else 'both'
R = random.Random(1849)

HALF_X, HALF_Z, H, T = 2.5, 6.0, 3.0, 0.3
IN_X, IN_Z = HALF_X - T / 2, HALF_Z - T / 2       # inner wall faces
WINDOW_Z = (-1.5, 1.5)
PILASTER_Z = (-3.0, 0.0, 3.0)
VESTRY_Z = (3.8, 5.2)
ALTAR_Z = 4.8


def B(x, z, y=0.0):
    return Vector((x, -z, y))


def srgb(r, g, b):
    return Vector(((r / 255) ** 2.2, (g / 255) ** 2.2, (b / 255) ** 2.2))


def lerp(a, b, t):
    t = max(0.0, min(1.0, t))
    return a * (1 - t) + b * t


# ------------------------------------------------------------------ batching -------------------------------------------
BATCHES, COLLIDERS = {}, []


def add(bm, M, mat, paint, seed=0.0, name=None, smooth=False):
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    bm.normal_update()
    key = name or mat
    b = BATCHES.setdefault(key, {'mat': mat, 'v': [], 'f': [], 'c': [], 's': []})
    base = len(b['v'])
    bm.verts.index_update()
    b['v'] += [v.co.copy() for v in bm.verts]
    for f in bm.faces:
        b['f'].append(tuple(base + v.index for v in f.verts))
        b['s'].append(smooth)
        for loop in f.loops:
            b['c'].append(paint(loop.vert.co, f.normal, seed))
    bm.free()


def collider(x, z, hx, hy, hz, rot=0.0, y=None, note=''):
    COLLIDERS.append({'center': [round(x, 3), round(hy if y is None else y, 3), round(z, 3)],
                      'half': [round(hx, 3), round(hy, 3), round(hz, 3)], 'rotY': round(rot, 4), 'note': note})


def place(x, z, y=0.0, rot=0.0):
    return Matrix.Translation(B(x, z, y)) @ Matrix.Rotation(rot, 4, 'Z')


# ------------------------------------------------------------------ painters -------------------------------------------
GRIME = srgb(40, 34, 28)


def stone(tone=(128, 122, 112)):
    base = srgb(*tone)

    def f(P, N, s):
        n = noise.noise(P * 1.6 + Vector((s, 0, 0)))
        c = base * (0.8 + 0.22 * n)
        c = lerp(c, GRIME, 0.5 * max(0.0, 1 - P.z / 0.45))
        if noise.noise(P * 7 + Vector((0, s, 0))) > 0.45:
            c = lerp(c, srgb(150, 146, 120), 0.3)
        return c
    return f


def wood(tone=(88, 58, 36)):
    base = srgb(*tone)

    def f(P, N, s):
        g = noise.noise(Vector((P.x * 3, P.y * 3, P.z * 22)) + Vector((s, 0, 0)))
        return base * (0.72 + 0.3 * g) * (0.75 if N.z > 0.7 else 1.0) ** 0.3
    return f


def flat(rgb, var=0.12):
    base = srgb(*rgb)
    return lambda P, N, s: base * (1 - var / 2 + var * (0.5 + 0.5 * noise.noise(P * 5 + Vector((s, 0, 0)))))


IRON = flat((40, 36, 34), 0.25)
BRASS = flat((150, 112, 48), 0.25)
RED_CLOTH = flat((96, 16, 18), 0.2)
GOLD = flat((190, 150, 70), 0.15)
WAX = flat((226, 214, 178), 0.1)
PAPER = flat((200, 184, 150), 0.15)
FLAME = flat((255, 190, 90), 0.05)


def glass(P, N, s):
    pick = [srgb(170, 60, 30), srgb(200, 150, 60), srgb(60, 80, 140), srgb(90, 120, 60), srgb(210, 180, 110)]
    k = int(abs(math.floor(P.y * 7) * 3 + math.floor(P.z * 6))) % len(pick)
    return pick[k]


# ------------------------------------------------------------------ mesh helpers ---------------------------------------
def box(bm, cx, cy, cz, sx, sy, sz):
    m = Matrix.Translation((cx, cy, cz)) @ Matrix.Diagonal((sx, sy, sz, 1))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def bevel(bm, off):
    try:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=off, segments=1, affect='EDGES', clamp_overlap=True, profile=0.5)
    except Exception:
        pass


def jitter(bm, amp, s):
    for v in bm.verts:
        v.co += noise.noise_vector(v.co * 4 + Vector((s, s * 2, 0))) * amp


def lathe(profile, segs=12, z0=0.0):
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        rings.append([bm.verts.new((0, 0, z0 + z))] if r < 1e-5 else
                     [bm.verts.new((r * math.cos(2 * math.pi * i / segs), r * math.sin(2 * math.pi * i / segs), z0 + z)) for i in range(segs)])
    for a, b in zip(rings, rings[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        for i in range(segs):
            j = (i + 1) % segs
            if len(a) == 1:
                bm.faces.new([a[0], b[i], b[j]])
            elif len(b) == 1:
                bm.faces.new([a[i], b[0], a[j]])
            else:
                bm.faces.new([a[i], a[j], b[j], b[i]])
    if len(rings[0]) > 1:
        bm.faces.new(list(reversed(rings[0])))
    if len(rings[-1]) > 1:
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def extrude(pts, t):
    """Extrudes an (x, z) outline along local Y, thickness t centred on 0."""
    bm = bmesh.new()
    fr = [bm.verts.new((x, -t / 2, z)) for x, z in pts]
    bk = [bm.verts.new((x, t / 2, z)) for x, z in pts]
    bm.faces.new(fr)
    bm.faces.new(list(reversed(bk)))
    for i in range(len(pts)):
        j = (i + 1) % len(pts)
        bm.faces.new([fr[i], fr[j], bk[j], bk[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def merge(*bms):
    out = bmesh.new()
    for b in bms:
        me = bpy.data.meshes.new('t')
        b.to_mesh(me)
        out.from_mesh(me)
        bpy.data.meshes.remove(me)
        b.free()
    return out


def pointed_arch(w, h_spring, h_top, n=8):
    hw = w / 2
    pts = [(-hw, 0), (-hw, h_spring)]
    r = w * 0.8
    for i in range(1, n):
        a = i / n
        x = -hw + hw * a
        pts.append((x, h_spring + (h_top - h_spring) * math.sin(a * math.pi / 2) ** 0.75))
    pts.append((0, h_top))
    for i in range(n - 1, 0, -1):
        a = i / n
        pts.append((hw - hw * a, h_spring + (h_top - h_spring) * math.sin(a * math.pi / 2) ** 0.75))
    return pts + [(hw, h_spring), (hw, 0)]


# ------------------------------------------------------------------ pieces ---------------------------------------------
def floor():
    main, cover = bmesh.new(), bmesh.new()
    z = -IN_Z
    row = 0
    while z < IN_Z - 0.01:
        d = min(IN_Z - z, R.uniform(0.42, 0.55))
        x = -IN_X + (0.0 if row % 2 else -0.25)
        while x < IN_X - 0.01:
            w = R.uniform(0.5, 0.75)
            x0, x1 = max(x, -IN_X), min(x + w, IN_X)
            if x1 - x0 > 0.05:
                cx, cz = (x0 + x1) / 2, z + d / 2
                target = cover if (abs(cx) < 0.65 and 4.75 < cz < 5.85) else main
                c = B(cx, cz, 0.012 + R.uniform(-0.004, 0.004))
                box(target, c.x, c.y, c.z, x1 - x0 - 0.018, d - 0.018, 0.024)
            x += w
        z += d
        row += 1
    for bm, name in ((main, 'floor'), (cover, 'stair-cover')):
        bevel(bm, 0.006)
        jitter(bm, 0.003, 2)
        add(bm, Matrix.Identity(4), 'stone', stone((112, 106, 98)), 1, name=name)


def pilasters_and_panelling():
    for side in (-1, 1):
        x_face = side * IN_X
        for z in PILASTER_Z:
            bm = bmesh.new()
            box(bm, 0, 0, H / 2, 0.36, 0.14, H)
            box(bm, 0, 0, 0.12, 0.44, 0.2, 0.24)
            box(bm, 0, 0, H - 0.1, 0.46, 0.22, 0.2)
            bevel(bm, 0.01)
            jitter(bm, 0.004, z)
            add(bm, place(x_face - side * 0.07, z, 0, math.pi / 2), 'stone', stone(), z)
            # Candle sconce on each pilaster (flame is emissive only; no light).
            s = bmesh.new()
            box(s, 0, -0.12, 1.75, 0.04, 0.16, 0.04)
            box(s, 0, -0.2, 1.78, 0.1, 0.1, 0.02)
            add(s, place(x_face - side * 0.07, z, 0, math.pi / 2 if side > 0 else -math.pi / 2), 'iron', IRON, z)
            cpos = B(x_face - side * 0.27, z, 1.79)
            cw = lathe([(0, 0), (0.018, 0), (0.018, 0.12), (0.012, 0.13), (0, 0.128)], 8)
            add(cw, Matrix.Translation(cpos), 'wax', WAX, z)
            fl = lathe([(0, 0.13), (0.008, 0.145), (0.005, 0.17), (0, 0.19)], 6)
            add(fl, Matrix.Translation(cpos), 'flame', FLAME, z, name='flames')
        # Oak wainscot along the wall below the windows, leaving the vestry door clear.
        spans = [(-IN_Z + 0.2, IN_Z - 0.2)]
        if side < 0:
            spans = [(-IN_Z + 0.2, VESTRY_Z[0] - 0.1), (VESTRY_Z[1] + 0.1, IN_Z - 0.2)]
        for z0, z1 in spans:
            bm = bmesh.new()
            n = max(1, int((z1 - z0) / 0.6))
            for i in range(n):
                a, b = z0 + (z1 - z0) * i / n, z0 + (z1 - z0) * (i + 1) / n
                box(bm, (a + b) / 2, 0, 0.5, (b - a) - 0.03, 0.025, 0.86)
            box(bm, (z0 + z1) / 2, -0.012, 0.96, z1 - z0, 0.05, 0.06)
            box(bm, (z0 + z1) / 2, -0.012, 0.06, z1 - z0, 0.04, 0.12)
            add(bm, place(x_face - side * 0.015, 0, 0, math.pi / 2 if side > 0 else -math.pi / 2), 'wood', wood((70, 46, 30)), z0)


def windows():
    for side in (-1, 1):
        for z in WINDOW_Z:
            w, y0, y1 = 0.62, 1.02, 2.5
            outer = extrude(pointed_arch(w + 0.24, (y1 - y0) * 0.62, (y1 - y0) + 0.14), 0.12)
            inner_cut = pointed_arch(w, (y1 - y0) * 0.6, (y1 - y0))
            # Surround: build as a frame of thin strips along the inner outline.
            fr = bmesh.new()
            for (ax, az), (bx, bz) in zip(inner_cut, inner_cut[1:]):
                mx, mz = (ax + bx) / 2, (az + bz) / 2
                L = math.hypot(bx - ax, bz - az)
                ang = math.atan2(bz - az, bx - ax)
                tmp = bmesh.new()
                box(tmp, 0, 0, 0, L + 0.02, 0.14, 0.1)
                bmesh.ops.transform(tmp, matrix=Matrix.Translation((mx, 0, mz)) @ Matrix.Rotation(-ang, 4, 'Y'), verts=tmp.verts)
                me = bpy.data.meshes.new('t'); tmp.to_mesh(me); fr.from_mesh(me); bpy.data.meshes.remove(me); tmp.free()
            box(fr, 0, -0.02, -0.04, w + 0.3, 0.2, 0.08)   # sill
            outer.free()
            rot = math.pi / 2 if side > 0 else -math.pi / 2
            add(fr, place(side * (IN_X - 0.03), z, y0, rot), 'stone', stone((140, 134, 122)), z)
            # Leaded glass: small panes with lead cames.
            gl, lead = bmesh.new(), bmesh.new()
            rows, cols = 7, 3
            for i in range(rows):
                for j in range(cols):
                    px = -w / 2 + w * (j + 0.5) / cols
                    pz = (y1 - y0) * (i + 0.5) / rows
                    inside = all(True for _ in [0])
                    top_limit = (y1 - y0) * 0.6 + ((y1 - y0) * 0.4) * (1 - (abs(px) / (w / 2)) ** 1.6)
                    if pz + (y1 - y0) / rows / 2 > top_limit + 0.02:
                        continue
                    box(gl, px, 0, pz, w / cols - 0.012, 0.012, (y1 - y0) / rows - 0.012)
            for j in range(1, cols):
                box(lead, -w / 2 + w * j / cols, -0.004, (y1 - y0) * 0.45, 0.012, 0.02, (y1 - y0) * 0.9)
            for i in range(1, rows):
                box(lead, 0, -0.004, (y1 - y0) * i / rows, w, 0.02, 0.012)
            add(gl, place(side * (IN_X + 0.02), z, y0, rot), 'glass', glass, z, name='window-glass')
            add(lead, place(side * (IN_X + 0.0), z, y0, rot), 'iron', IRON, z)


def beams():
    for z in (-4.5, -1.5, 1.5, 4.5):
        bm = bmesh.new()
        box(bm, 0, 0, H - 0.14, IN_X * 2, 0.2, 0.22)
        box(bm, 0, 0, H - 0.02, 0.18, 0.18, 0.04)
        for s in (-1, 1):  # curved braces drawn as two segments
            box(bm, s * (IN_X - 0.25), 0, H - 0.42, 0.12, 0.16, 0.42)
            box(bm, s * (IN_X - 0.45), 0, H - 0.3, 0.38, 0.16, 0.1)
        bevel(bm, 0.01)
        add(bm, place(0, z), 'wood', wood((60, 40, 26)), z)
    bm = bmesh.new()
    box(bm, 0, 0, H - 0.08, 0.18, IN_Z * 2, 0.14)
    add(bm, place(0, 0), 'wood', wood((60, 40, 26)), 9)


def pew(x0, x1, z, seed, broken=False):
    L = x1 - x0
    bm = bmesh.new()
    box(bm, 0, 0, 0.38, L, 0.42, 0.04)                 # seat, top at 0.40
    box(bm, 0, 0.19, 0.66, L, 0.04, 0.5)               # back
    box(bm, 0, 0.19, 0.93, L + 0.02, 0.07, 0.04)       # back rail
    box(bm, 0, -0.17, 0.2, L, 0.03, 0.2)               # kneeler board
    for s in (-1, 1):
        ex = s * (L / 2 + 0.02)
        box(bm, ex, 0.02, 0.48, 0.05, 0.5, 0.96)       # bench ends
        cap = lathe([(0, 0), (0.035, 0), (0.035, 0.06), (0, 0.1)], 8, 0.96)
        bmesh.ops.translate(cap, verts=cap.verts, vec=(ex, 0.06, 0))
        me = bpy.data.meshes.new('t'); cap.to_mesh(me); bm.from_mesh(me); bpy.data.meshes.remove(me); cap.free()
    bevel(bm, 0.006)
    if broken:
        for v in bm.verts:
            if v.co.x > L * 0.15:
                v.co.z -= (v.co.x - L * 0.15) * 0.35
    jitter(bm, 0.002, seed)
    cx = (x0 + x1) / 2
    add(bm, place(cx, z, 0, math.pi), 'wood', wood((82, 54, 34)), seed)
    collider(cx, z + 0.02, L / 2 + 0.05, 0.5, 0.27, 0, note='pew')
    # A hymn book or two on the seat.
    if R.random() < 0.5:
        hb = bmesh.new()
        box(hb, 0, 0, 0.42, 0.13, 0.18, 0.035)
        add(hb, place(cx + R.uniform(-L / 3, L / 3), z - 0.05, 0, R.uniform(-0.5, 0.5)), 'wood', flat((50, 30, 24)), seed)


def pews():
    rows = (1.0, 2.0, 3.0)
    for i, z in enumerate(rows):
        pew(0.7, IN_X - 0.25, z, i, broken=(i == 0))
        pew(-1.75, -0.7, z, i + 10)


def lectern():
    bm = bmesh.new()
    base = lathe([(0, 0), (0.24, 0), (0.24, 0.05), (0.16, 0.08), (0.06, 0.12), (0, 0.12)], 12)
    col = lathe([(0.055, 0.12), (0.05, 0.8), (0.07, 0.84), (0, 0.86)], 10)
    top = bmesh.new()
    box(top, 0, 0, 0, 0.5, 0.38, 0.04)
    box(top, 0, -0.2, 0.025, 0.5, 0.02, 0.04)          # lip at the low edge
    bmesh.ops.transform(top, matrix=Matrix.Translation((0, 0, 0.94)) @ Matrix.Rotation(math.radians(-14), 4, 'X'), verts=top.verts)
    brace = bmesh.new()
    box(brace, 0, 0, 0.885, 0.3, 0.22, 0.05)
    out = merge(base, col, top, brace)
    bevel(out, 0.004)
    add(out, place(0, 0, 0, math.pi), 'wood', wood((74, 48, 30)), 3)
    collider(0, 0, 0.25, 0.5, 0.22, note='lectern')


def font():
    x, z = 1.5, -2.0
    bm = lathe([(0, 0), (0.3, 0), (0.3, 0.1), (0.2, 0.14), (0.13, 0.2), (0.12, 0.55), (0.18, 0.6), (0.3, 0.72), (0.34, 0.8),
                (0.34, 0.86), (0.28, 0.86), (0.26, 0.78), (0, 0.76)], 8)
    jitter(bm, 0.004, 4)
    add(bm, place(x, z), 'stone', stone((150, 144, 132)), 4)
    lid = lathe([(0, 0.86), (0.33, 0.86), (0.33, 0.88), (0.12, 0.89), (0, 0.89)], 16)
    knob = lathe([(0, 0.89), (0.03, 0.89), (0.02, 0.95), (0.035, 0.98), (0, 1.0)], 8)
    add(merge(lid, knob), place(x, z), 'wood', wood((70, 46, 28)), 4)
    collider(x, z, 0.32, 0.45, 0.32, note='font')


def cupboard():
    x, z = -IN_X + 0.24, 2.6
    bm = bmesh.new()
    W, D, Hc = 0.95, 0.44, 1.85
    box(bm, 0, 0.2, Hc / 2, W, 0.03, Hc)                   # back (toward the wall, local +Y)
    for s in (-1, 1):
        box(bm, s * W / 2, 0, Hc / 2, 0.035, D, Hc)
    box(bm, 0, 0, Hc, W + 0.06, D + 0.04, 0.05)            # top
    box(bm, 0, 0, 0.05, W, D, 0.1)                         # plinth
    box(bm, 0, 0, 0.865, W - 0.04, D - 0.04, 0.03)         # shelf, top at 0.88
    box(bm, 0, 0, 1.35, W - 0.04, D - 0.04, 0.025)
    box(bm, 0, 0, 0.45, W - 0.04, D - 0.04, 0.025)
    for s in (-1, 1):  # doors hanging open
        door = bmesh.new()
        box(door, s * 0.235, 0, 0, 0.47, 0.025, Hc - 0.12)
        box(door, s * 0.235, -0.015, 0.4, 0.38, 0.01, 0.5)
        box(door, s * 0.235, -0.015, -0.3, 0.38, 0.01, 0.6)
        bmesh.ops.transform(door, matrix=Matrix.Translation((s * W / 2, -D / 2, Hc / 2)) @ Matrix.Rotation(s * math.radians(-105), 4, 'Z')
                            @ Matrix.Translation((-s * 0.0, 0, 0)), verts=door.verts)
        me = bpy.data.meshes.new('t'); door.to_mesh(me); bm.from_mesh(me); bpy.data.meshes.remove(me); door.free()
    bevel(bm, 0.004)
    # local -Y is the front; turn it to face +X (into the nave).
    add(bm, place(x, z, 0, math.pi / 2), 'wood', wood((66, 42, 26)), 7)
    collider(x + 0.0, z, D / 2 + 0.02, Hc / 2, W / 2 + 0.03, note='vestry cupboard')
    # Vestments and a candle box on the upper shelf.
    v = bmesh.new()
    box(v, 0, 0.05, 1.5, 0.5, 0.2, 0.25)
    add(v, place(x, z, 0, math.pi / 2), 'cloth', flat((210, 200, 180)), 7)


def altar():
    z = ALTAR_Z
    bm = bmesh.new()
    box(bm, 0, 0, 0.08, 1.9, 1.0, 0.16)
    box(bm, 0, 0, 0.55, 1.6, 0.7, 0.8)
    box(bm, 0, 0, 0.975, 1.8, 0.86, 0.05)                  # mensa, top at 1.0
    for s in (-1, 1):
        box(bm, s * 0.68, -0.36, 0.55, 0.12, 0.06, 0.78)
    bevel(bm, 0.008)
    jitter(bm, 0.003, 5)
    add(bm, place(0, z, 0, math.pi), 'stone', stone((150, 144, 132)), 5)
    cloth = bmesh.new()
    box(cloth, 0, -0.355, 0.62, 1.5, 0.02, 0.62)
    box(cloth, 0, 0, 1.004, 1.82, 0.88, 0.006)
    add(cloth, place(0, z, 0, math.pi), 'cloth', RED_CLOTH, 5)
    gold = bmesh.new()
    box(gold, 0, -0.368, 0.66, 0.07, 0.01, 0.42)
    box(gold, 0, -0.368, 0.74, 0.28, 0.01, 0.07)
    box(gold, 0, -0.368, 0.33, 1.5, 0.01, 0.04)
    add(gold, place(0, z, 0, math.pi), 'brass', GOLD, 5)
    for s in (-1, 1):
        cs = lathe([(0, 0), (0.08, 0), (0.08, 0.02), (0.03, 0.05), (0.02, 0.2), (0.045, 0.24), (0.05, 0.27), (0.02, 0.28), (0, 0.28)], 10)
        add(cs, place(s * 0.62, z + 0.1, 1.0), 'brass', BRASS, s)
        cw = lathe([(0, 0.28), (0.022, 0.28), (0.022, 0.52), (0.015, 0.535), (0, 0.53)], 8)
        add(cw, place(s * 0.62, z + 0.1, 1.0), 'wax', WAX, s)
        fl = lathe([(0, 0.535), (0.009, 0.55), (0.006, 0.58), (0, 0.6)], 6)
        add(fl, place(s * 0.62, z + 0.1, 1.0), 'flame', FLAME, s, name='flames')
    cross = extrude([(-0.03, 0), (-0.03, 0.3), (-0.12, 0.3), (-0.12, 0.36), (-0.03, 0.36), (-0.03, 0.46), (0.03, 0.46),
                     (0.03, 0.36), (0.12, 0.36), (0.12, 0.3), (0.03, 0.3), (0.03, 0)], 0.03)
    add(cross, place(0, z + 0.25, 1.0, math.pi), 'brass', GOLD, 6)
    collider(0, z, 0.95, 0.5, 0.5, note='altar')


def reredos():
    """Carved oak screen on the end wall above the stair, from 1.15 m up."""
    z = IN_Z - 0.04
    bm = bmesh.new()
    box(bm, 0, 0, 1.2, 2.6, 0.08, 0.1)
    box(bm, 0, 0, 2.85, 2.7, 0.1, 0.12)
    for i in range(5):
        x = -1.2 + i * 0.6
        box(bm, x, 0, 2.02, 0.08, 0.1, 1.66)
    for i in range(4):
        x = -0.9 + i * 0.6
        a = extrude(pointed_arch(0.5, 0.95, 1.4), 0.03)
        bmesh.ops.translate(a, verts=a.verts, vec=(x, 0.02, 1.27))
        me = bpy.data.meshes.new('t'); a.to_mesh(me); bm.from_mesh(me); bpy.data.meshes.remove(me); a.free()
    bevel(bm, 0.004)
    add(bm, place(0, z, 0, math.pi), 'wood', wood((60, 38, 24)), 8)
    panels = bmesh.new()
    for i in range(4):
        box(panels, -0.9 + i * 0.6, 0.035, 1.75, 0.42, 0.01, 0.9)
    add(panels, place(0, z, 0, math.pi), 'cloth', flat((40, 52, 70), 0.2), 8)


def hymn_board():
    """Stage 3 hymn board on the east wall by the altar: 4 · 19 · 2 · 41 · 23."""
    x, z = IN_X - 0.03, 3.7
    bm = bmesh.new()
    box(bm, 0, 0, 1.75, 0.5, 0.04, 1.1)
    top = extrude(pointed_arch(0.56, 0.0, 0.2), 0.05)
    bmesh.ops.translate(top, verts=top.verts, vec=(0, 0, 2.3))
    me = bpy.data.meshes.new('t'); top.to_mesh(me); bm.from_mesh(me); bpy.data.meshes.remove(me); top.free()
    bevel(bm, 0.004)
    add(bm, place(x, z, 0, -math.pi / 2), 'wood', wood((50, 32, 22)), 11)
    SEG = {'0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '9': 'abcdfg'}
    tiles, digits = bmesh.new(), bmesh.new()
    for row, num in enumerate(('4', '19', '2', '41', '23')):
        zc = 2.15 - row * 0.19
        box(tiles, 0, -0.03, zc, 0.36, 0.015, 0.15)
        for k, ch in enumerate(num):
            cx = (k - (len(num) - 1) / 2) * 0.085
            w, h, t = 0.05, 0.1, 0.012
            segs = {'a': (cx, zc + h / 2, w, t), 'd': (cx, zc - h / 2, w, t), 'g': (cx, zc, w, t),
                    'f': (cx - w / 2, zc + h / 4, t, h / 2), 'b': (cx + w / 2, zc + h / 4, t, h / 2),
                    'e': (cx - w / 2, zc - h / 4, t, h / 2), 'c': (cx + w / 2, zc - h / 4, t, h / 2)}
            for sname in SEG[ch]:
                sx, sz, sw, sh = segs[sname]
                box(digits, sx, -0.04, sz, sw, 0.006, sh)
    add(tiles, place(x, z, 0, -math.pi / 2), 'paper', PAPER, 11)
    add(digits, place(x, z, 0, -math.pi / 2), 'iron', flat((20, 16, 14), 0.05), 11)


def memorials_and_rope():
    for x, z, rot in ((IN_X - 0.03, -4.4, math.pi / 2), (-IN_X + 0.03, -4.4, -math.pi / 2), (-IN_X + 0.03, 1.5 - 0.8, -math.pi / 2)):
        bm = bmesh.new()
        box(bm, 0, 0, 1.6, 0.5, 0.04, 0.36)
        box(bm, 0, -0.02, 1.4, 0.56, 0.06, 0.05)
        top = extrude(pointed_arch(0.5, 0.0, 0.14), 0.04)
        bmesh.ops.translate(top, verts=top.verts, vec=(0, 0, 1.78))
        me = bpy.data.meshes.new('t'); top.to_mesh(me); bm.from_mesh(me); bpy.data.meshes.remove(me); top.free()
        add(bm, place(x, z, 0, rot), 'stone', stone((176, 170, 156)), z)
    # Bell rope hanging from the belfry by the door, tied off on a wall cleat.
    rope = bmesh.new()
    pts = [B(-1.7, -5.3, H), B(-1.72, -5.3, 1.6), B(-1.85, -5.35, 1.0), B(-2.15, -5.4, 1.05)]
    for a, b in zip(pts, pts[1:]):
        d = b - a
        tmp = lathe([(0.012, 0), (0.012, d.length)], 6)
        q = d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
        bmesh.ops.transform(tmp, matrix=Matrix.Translation(a) @ q, verts=tmp.verts)
        me = bpy.data.meshes.new('t'); tmp.to_mesh(me); rope.from_mesh(me); bpy.data.meshes.remove(me); tmp.free()
    add(rope, Matrix.Identity(4), 'cloth', flat((120, 96, 60), 0.15), 1)


def debris():
    """Low clutter by the walls (no colliders, under 0.15 m), kept off doors and spots."""
    bm = bmesh.new()
    spots = [(2.0, -5.2), (-2.0, -0.6), (2.05, 0.4), (-1.95, 5.6), (1.9, 5.5), (0.9, -5.4)]
    for x, z in spots:
        for k in range(4):
            c = B(x + R.uniform(-0.2, 0.2), z + R.uniform(-0.2, 0.2), 0.03)
            box(bm, c.x, c.y, c.z, R.uniform(0.05, 0.14), R.uniform(0.04, 0.1), R.uniform(0.02, 0.05))
    add(bm, Matrix.Identity(4), 'stone', stone((100, 94, 86)), 3)
    books = bmesh.new()
    for x, z in ((0.3, -0.9), (-0.45, 0.55)):
        c = B(x, z, 0.03)
        box(books, c.x, c.y, c.z, 0.14, 0.19, 0.035)
    add(books, Matrix.Identity(4), 'wood', flat((50, 30, 24)), 2)


# ------------------------------------------------------------------ build, export, preview -----------------------------
MATS = {  # rough, metal, emissive strength
    'stone': (0.92, 0.0, 0), 'wood': (0.7, 0.0, 0), 'iron': (0.55, 0.6, 0), 'brass': (0.4, 0.6, 0), 'cloth': (0.95, 0.0, 0),
    'wax': (0.5, 0.0, 0), 'paper': (0.9, 0.0, 0), 'glass': (0.2, 0.0, 0.9), 'flame': (0.6, 0.0, 3.0),
}


def material(name):
    if 'lr-' + name in bpy.data.materials:
        return bpy.data.materials['lr-' + name]
    rough, metal, emit = MATS[name]
    m = bpy.data.materials.new('lr-' + name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    vc = nt.nodes.new('ShaderNodeVertexColor')
    vc.layer_name = 'Col'
    nt.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if emit:
        bsdf.inputs['Emission Color'].default_value = (1.0, 0.62, 0.28, 1) if name == 'flame' else (0.9, 0.55, 0.3, 1)
        bsdf.inputs['Emission Strength'].default_value = emit
    return m


def build():
    floor()
    pilasters_and_panelling()
    windows()
    beams()
    pews()
    lectern()
    font()
    cupboard()
    altar()
    reredos()
    hymn_board()
    memorials_and_rope()
    debris()


def make_objects(coll):
    tris = 0
    for key, b in BATCHES.items():
        me = bpy.data.meshes.new(key)
        me.from_pydata([tuple(v) for v in b['v']], [], b['f'])
        me.update()
        attr = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
        flat_c = []
        for c in b['c']:
            flat_c += [c.x, c.y, c.z, 1.0]
        attr.data.foreach_set('color', flat_c)
        me.polygons.foreach_set('use_smooth', b['s'])
        me.materials.append(material(b['mat']))
        ob = bpy.data.objects.new('chapel-' + key, me)
        coll.objects.link(ob)
        tris += sum(len(f) - 2 for f in b['f'])
    return tris


def export(coll):
    os.makedirs(OUT_DIR, exist_ok=True)
    for ob in bpy.context.scene.objects:
        ob.select_set(coll in ob.users_collection)
    path = os.path.join(OUT_DIR, 'chapel-interior.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                              export_vertex_color='ACTIVE', export_draco_mesh_compression_enable=True,
                              export_draco_mesh_compression_level=6, export_cameras=False, export_lights=False)
    json.dump({'note': 'Chapel-local game coordinates (add CHAPEL_CENTER [10, 0, 5]). Boxes: centre, half extents, rotY.',
               'surfaces': {'lectern-book-rest-y': 0.97, 'font-lid-y': 0.88, 'pew-seat-y': 0.40, 'cupboard-shelf-y': 0.88,
                            'altar-top-y': 1.0, 'stair-cover-mesh': 'chapel-stair-cover'},
               'boxes': COLLIDERS}, open(os.path.join(OUT_DIR, 'chapel-interior-colliders.json'), 'w'), indent=1)
    return os.path.getsize(path)


def preview(coll):
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.eevee.taa_render_samples = 32
    sc.view_settings.view_transform = 'AgX'
    sc.render.resolution_x, sc.render.resolution_y = 1280, 720
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.02, 0.02, 0.03, 1)
    # Stand-in shell: walls with the door, vestry and window openings, a flat ceiling (preview only).
    shell = bmesh.new()
    box(shell, -(HALF_X + 0.7) / 2 - 0.35, HALF_Z, H / 2, HALF_X - 0.7, T, H)
    box(shell, (HALF_X + 0.7) / 2 + 0.35, HALF_Z, H / 2, HALF_X - 0.7, T, H)
    box(shell, 0, HALF_Z, 2.6, 1.4, T, 0.8)
    box(shell, 0, -HALF_Z, H / 2, HALF_X * 2, T, H)
    for s in (-1, 1):
        for z0, z1 in ((-HALF_Z, -1.8), (-1.2, 1.2), (1.8, HALF_Z)):
            if s < 0 and z1 > 0:
                for a, b in ((z0, min(z1, VESTRY_Z[0])), (max(z0, VESTRY_Z[1]), z1)):
                    if b > a:
                        box(shell, s * HALF_X, -(a + b) / 2, H / 2, T, b - a, H)
                continue
            box(shell, s * HALF_X, -(z0 + z1) / 2, H / 2, T, z1 - z0, H)
        for z in WINDOW_Z:
            box(shell, s * HALF_X, -z, 0.5, T, 0.6, 1.0)
            box(shell, s * HALF_X, -z, 2.75, T, 0.6, 0.5)
    box(shell, 0, 0, H + 0.1, HALF_X * 2 + 0.4, HALF_Z * 2 + 0.4, 0.2)
    me = bpy.data.meshes.new('shell'); shell.to_mesh(me); shell.free()
    ob = bpy.data.objects.new('shell', me)
    mat = bpy.data.materials.new('shell'); mat.use_nodes = True
    mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.2, 0.19, 0.17, 1)
    me.materials.append(mat); sc.collection.objects.link(ob)
    for p, e, c in (((0.62, -(ALTAR_Z + 0.1), 1.6), 30, (1, 0.6, 0.3)), ((-0.62, -(ALTAR_Z + 0.1), 1.6), 30, (1, 0.6, 0.3)),
                    ((0, 2, 2.4), 60, (1, 0.7, 0.45)), ((0, -2.5, 2.4), 50, (1, 0.7, 0.45)), ((0, 5.5, 1.6), 40, (0.6, 0.7, 1.0))):
        L = bpy.data.lights.new('l', 'POINT'); L.energy = e; L.color = c; L.shadow_soft_size = 0.3
        o = bpy.data.objects.new('l', L); o.location = p; sc.collection.objects.link(o)
    cd = bpy.data.cameras.new('c'); cam = bpy.data.objects.new('c', cd); sc.collection.objects.link(cam); sc.camera = cam
    shots = {'from-door': ((0.2, -5.4, 1.65), (0, 4.5, 1.0), 22), 'from-altar': ((-0.4, 3.9, 1.65), (0.3, -4, 0.9), 22),
             'cupboard-pews': ((0.6, 0.3, 1.5), (-2.0, 2.6, 0.9), 26), 'font-lectern': ((-1.2, -4.2, 1.6), (0.9, -1.0, 0.8), 26),
             'hymn-board': ((0.4, 2.4, 1.6), (2.3, 3.7, 1.8), 30)}
    for name, (pos, tgt, lens) in shots.items():
        cd.lens = lens
        cam.location = B(pos[0], pos[1], pos[2])
        cam.rotation_euler = (B(tgt[0], tgt[1], tgt[2]) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(PREVIEW_DIR, f'chapel-{name}.png')
        bpy.ops.render.render(write_still=True)


bpy.ops.wm.read_factory_settings(use_empty=True)
build()
coll = bpy.data.collections.new('chapel')
bpy.context.scene.collection.children.link(coll)
tris = make_objects(coll)
size = export(coll) if MODE in ('export', 'both') else 0
if MODE in ('render', 'both'):
    preview(coll)
print('CHAPEL_STATS ' + json.dumps({'tris': tris, 'objects': len(coll.objects), 'colliders': len(COLLIDERS), 'glb_bytes': size}))
