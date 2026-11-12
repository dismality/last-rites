"""Builds a model for every Last Rites item that has no hero model yet and exports them as .glb.

Run with Blender 4.4 or later:
  blender -b --factory-startup -P tools/blender/world_items.py

Covers the 11 materials, both ammo types, the 16 weapons, tools and consumables, the journal page
and the parish ledger. Same style as hero_items.py (its helpers and materials are reused): real-world
scale in metres, centred on the bounding box, vertex colours, Draco. Files land in
public/assets/models/items/<item id>.glb and docs/world-items.md lists them.
"""
import json
import os
import sys
from math import cos, pi, radians, sin

os.environ["HERO_ITEMS_NO_MAIN"] = "1"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hero_items as H  # noqa: E402
from hero_items import Model, at, Z_TO_Y, lathe, sweep, box, sphere, ring, smooth, cloth_layer  # noqa: E402

import bpy  # noqa: E402
from mathutils import Matrix, Vector, noise  # noqa: E402

DOC_PATH = os.path.join(H.ROOT, "docs", "world-items.md")

H.MATERIALS.update({
    "glass": dict(base=(0.20, 0.26, 0.24), grime=(0.09, 0.11, 0.09), metal=0.0, rough=0.12, relief=0.0),
    "green_glass": dict(base=(0.04, 0.13, 0.05), grime=(0.02, 0.06, 0.02), metal=0.0, rough=0.14, relief=0.0),
    "water": dict(base=(0.30, 0.40, 0.46), grime=(0.18, 0.26, 0.32), metal=0.0, rough=0.08, relief=0.0),
    "oil": dict(base=(0.42, 0.20, 0.02), grime=(0.24, 0.09, 0.01), metal=0.0, rough=0.1, relief=0.0),
    "wax": dict(base=(0.74, 0.66, 0.44), grime=(0.48, 0.40, 0.24), metal=0.0, rough=0.5, relief=0.0012),
    "paper": dict(base=(0.70, 0.60, 0.42), grime=(0.40, 0.28, 0.14), metal=0.0, rough=0.9, relief=0.0),
    "linen": dict(base=(0.74, 0.69, 0.58), grime=(0.50, 0.42, 0.32), metal=0.0, rough=0.95, relief=0.0),
    "salt": dict(base=(0.82, 0.82, 0.78), grime=(0.58, 0.57, 0.52), metal=0.0, rough=0.95, relief=0.006),
    "powder": dict(base=(0.035, 0.035, 0.035), grime=(0.09, 0.08, 0.07), metal=0.0, rough=0.95, relief=0.004),
    "lead": dict(base=(0.15, 0.16, 0.18), grime=(0.09, 0.09, 0.10), metal=0.5, rough=0.5, relief=0.0),
    "brass": dict(base=(0.46, 0.31, 0.10), grime=(0.20, 0.13, 0.05), metal=0.6, rough=0.4, relief=0.0),
    "tin": dict(base=(0.32, 0.33, 0.34), grime=(0.24, 0.13, 0.06), metal=0.5, rough=0.55, relief=0.0),
    "oak": dict(base=(0.22, 0.13, 0.065), grime=(0.10, 0.06, 0.03), metal=0.0, rough=0.75, relief=0.0008),
    "red_paper": dict(base=(0.34, 0.05, 0.04), grime=(0.16, 0.03, 0.02), metal=0.0, rough=0.8, relief=0.0),
    "red_wax": dict(base=(0.30, 0.02, 0.02), grime=(0.14, 0.01, 0.01), metal=0.0, rough=0.4, relief=0.0),
    "ember": dict(base=(0.95, 0.42, 0.08), grime=(0.60, 0.15, 0.02), metal=0.0, rough=0.6, relief=0.0),
})

MATS_DONE = set()


def new(item_id, name):
    m = Model(item_id, name, "")
    m.mark_at = Vector((0, 0, 0))
    return m


def cyl(m, z0, z1, r, mat, seg=16, matrix=None, r1=None):
    lathe(m, [(0, z0), (r, z0), (r if r1 is None else r1, z1), (0, z1)], mat, seg=seg, matrix=matrix)


def frame(p, direction):
    """Matrix that puts local +Z along direction at point p."""
    d = Vector(direction).normalized()
    return at(*p) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4()


def taper(pts, radii):
    """Spreads a short list of radii evenly over a path of any length."""
    n, k = len(pts), len(radii)
    out = []
    for i in range(n):
        t = i / max(1, n - 1) * (k - 1)
        a = int(t)
        b = min(k - 1, a + 1)
        out.append(radii[a] + (radii[b] - radii[a]) * (t - a))
    return out


def lumpy(profile, amp, seed):
    return [(r * (1 + amp * noise.noise(Vector((z * 40, seed, 0)))), z) for r, z in profile]


# ---------------------------------------------------------------- materials ---------------------------------------------

def bone():
    m = new("bone", "Bone")
    def femur(p, direction, length, seed):
        d = Vector(direction).normalized()
        side = d.cross(Vector((0, 0, 1))).normalized()
        a, b = Vector(p) - d * length / 2, Vector(p) + d * length / 2
        pts = [a.lerp(b, t) + side * 0.004 * sin(t * pi + seed) for t in (0, 0.15, 0.35, 0.5, 0.65, 0.85, 1)]
        sweep(m, pts, [0.016, 0.012, 0.0105, 0.010, 0.0105, 0.012, 0.016], "bone", seg=10)
        for end, s in ((a, -1), (b, 1)):
            for o in (-1, 1):
                sphere(m, end + d * s * 0.006 + side * o * 0.011, 0.016, "bone", seg=10, rings=7)
    femur((0, 0, 0.016), (1, 0.15, 0), 0.30, 1.0)
    femur((0.01, 0.02, 0.040), (0.55, -0.85, 0.05), 0.22, 2.0)
    return m


def iron_nail():
    m = new("iron-nail", "Iron Nails")
    spots = [(-0.03, 0.0, 0.2), (0.0, 0.018, 1.3), (0.028, -0.012, 2.4), (-0.012, -0.03, 3.6), (0.02, 0.035, 5.0)]
    for i, (x, y, turn) in enumerate(spots):
        lie = Matrix.Rotation(radians(90 + 6 * i), 4, "Y")
        M = at(x, y, 0.006 + 0.004 * (i % 2)) @ Matrix.Rotation(turn, 4, "Z") @ lie
        lathe(m, [(0, -0.055), (0.0016, -0.05), (0.0045, 0.03), (0.0045, 0.045)], "rust", seg=4, matrix=M)
        lathe(m, [(0, 0.045), (0.0095, 0.045), (0.009, 0.05), (0, 0.052)], "rust", seg=6, matrix=M)
    return m


def candle_wax():
    m = new("candle-wax", "Candle Wax")
    body = [(0, 0), (0.045, 0), (0.047, 0.006), (0.043, 0.024), (0.036, 0.042), (0.03, 0.052), (0.022, 0.058), (0, 0.057)]
    lathe(m, lumpy(body, 0.1, 3.0), "wax", seg=18)

    def radius_at(z):
        for (r0, z0), (r1, z1) in zip(body[1:], body[2:]):
            if z0 <= z <= z1:
                return r0 + (r1 - r0) * (z - z0) / max(1e-6, z1 - z0)
        return 0.03

    for a, length in ((0.3, 0.04), (1.9, 0.028), (3.7, 0.046), (5.1, 0.022)):
        d = Vector((cos(a), sin(a), 0))
        pts = []
        for t in (0.0, 0.35, 0.7, 1.0):
            z = 0.052 - length * t
            pts.append(d * (radius_at(z) - 0.001) + Vector((0, 0, z)))
        sweep(m, pts, [0.0035, 0.003, 0.0034, 0.0045], "wax", seg=8)
        sphere(m, pts[-1], 0.0048, "wax", seg=8, rings=5)
    sweep(m, [(0, 0, 0.056), (0.002, 0, 0.068), (0.004, 0.001, 0.076)], 0.0012, "ink", seg=4)
    return m


def holy_water():
    m = new("holy-water", "Holy Water")
    prof = [(0, 0), (0.016, 0), (0.018, 0.004), (0.018, 0.06), (0.01, 0.072), (0.007, 0.078), (0.007, 0.086), (0.0085, 0.088)]
    lathe(m, prof, "glass", seg=16)
    cyl(m, 0.004, 0.055, 0.0165, "water", seg=16)
    cyl(m, 0.084, 0.1, 0.0068, "oak", seg=10, r1=0.0076)
    sweep(m, [Vector((0.0072 * cos(a), 0.0072 * sin(a), 0.079)) for a in [2 * pi * i / 12 for i in range(12)]], 0.0009,
          "twine", seg=4, closed=True)
    sweep(m, [(0.007, 0, 0.079), (0.012, 0.002, 0.06), (0.019, 0.0, 0.045)], 0.0008, "twine", seg=4)
    box(m, (0.0195, 0, 0.038), (0.0012, 0.0016, 0.016), "silver", 0.0003)
    box(m, (0.0195, 0, 0.041), (0.0012, 0.009, 0.0016), "silver", 0.0003)
    return m


def cloth():
    m = new("cloth", "Cloth")
    turn = Matrix.Rotation(radians(90), 4, "X")
    m2 = Model("tmp", "", "")
    cloth_layer(m2, (0, 0, 0), (0.18, 0.02, 0.13), 3.0, radians(8))
    cloth_layer(m2, (0.01, 0.016, 0.004), (0.15, 0.018, 0.11), 6.0, radians(-14))
    m.add(m2.verts, [f for f, _ in m2.faces], "cloth", at(0, 0, 0.02) @ turn)
    return m


def lamp_oil():
    m = new("lamp-oil", "Lamp Oil")
    lathe(m, [(0, 0), (0.045, 0), (0.047, 0.004), (0.047, 0.1), (0.044, 0.104), (0.016, 0.125), (0.016, 0.13)], "tin", seg=22)
    cyl(m, 0.035, 0.075, 0.0478, "paper", seg=22)
    for z in (0.033, 0.077):
        cyl(m, z - 0.002, z + 0.002, 0.0485, "tin", seg=22)
    cyl(m, 0.128, 0.138, 0.018, "brass", seg=12)
    spout = smooth([(0.03, 0, 0.1), (0.06, 0, 0.12), (0.085, 0, 0.15), (0.095, 0, 0.162)], 2)
    sweep(m, spout, taper(spout, [0.007, 0.004, 0.003]), "tin", seg=8)
    sweep(m, smooth([(-0.04, 0, 0.09), (-0.07, 0, 0.11), (-0.06, 0, 0.15), (-0.01, 0, 0.14)], 2), 0.004, "tin", seg=6,
          flat=0.35, normal=(0, 1, 0))
    return m


def grave_salt():
    m = new("grave-salt", "Grave Salt")
    lathe(m, lumpy([(0, 0), (0.045, 0.0), (0.055, 0.03), (0.05, 0.07), (0.03, 0.09), (0.016, 0.1), (0.022, 0.118),
                    (0.014, 0.125), (0, 0.12)], 0.08, 4.0), "cloth", seg=16)
    sweep(m, [Vector((0.0175 * cos(a), 0.0175 * sin(a), 0.1)) for a in [2 * pi * i / 12 for i in range(12)]], 0.0022,
          "twine", seg=5, closed=True)
    lathe(m, [(0, 0), (0.05, 0), (0.03, 0.012), (0.012, 0.02), (0, 0.022)], "salt", seg=14, matrix=at(0.07, 0.02, 0))
    for i in range(10):
        a = i * 2.4
        sphere(m, (0.07 + 0.065 * cos(a) * (0.7 + 0.03 * i), 0.02 + 0.06 * sin(a), 0.002), 0.003, "salt", seg=5, rings=3)
    return m


def wood_plank():
    m = new("wood-plank", "Wood Planks")
    for i, (x, turn, w) in enumerate(((0, 0, 0.11), (0.01, 4, 0.1), (-0.008, -6, 0.12))):
        M = at(0, 0, 0.012 + 0.024 * i) @ Matrix.Rotation(radians(turn), 4, "Z")
        box(m, (x, 0, 0), (0.6, w, 0.022), "oak", 0.003, matrix=M)
        for dx in (-0.27, 0.27):
            for dy in (-0.03, 0.03):
                cyl(m, 0.011, 0.0125, 0.003, "rust", seg=6, matrix=M @ at(x + dx, dy, 0))
    return m


def black_powder():
    m = new("black-powder", "Black Powder")
    path = smooth([(-0.11, 0, 0.03), (-0.05, 0.01, 0.022), (0.02, 0.012, 0.03), (0.08, 0.0, 0.05), (0.11, -0.012, 0.075)], 3)
    radii = [0.034 - 0.028 * (i / (len(path) - 1)) ** 0.8 for i in range(len(path))]
    sweep(m, path, radii, "bone", seg=14)
    cyl(m, -0.006, 0.006, 0.036, "brass", seg=16, matrix=frame((-0.112, 0, 0.03), (-1, 0, 0)))
    cyl(m, 0, 0.022, 0.006, "brass", seg=8, matrix=frame((0.11, -0.012, 0.075), (0.6, -0.2, 0.75)))
    for t in (0.25, 0.65):
        p = path[int(t * (len(path) - 1))]
        r = radii[int(t * (len(path) - 1))] + 0.0015
        sweep(m, [p + Vector((0, r * cos(a), r * sin(a))) for a in [2 * pi * i / 14 for i in range(14)]], 0.002, "brass",
              seg=4, closed=True)
    sweep(m, smooth([(-0.1, 0, 0.065), (-0.02, 0.04, 0.12), (0.06, 0.03, 0.1), (0.1, 0, 0.09)], 3), 0.004, "leather",
          seg=6, flat=0.3, normal=(0, 0, 1))
    return m


def lead_shot():
    m = new("lead-shot", "Lead Shot")
    lathe(m, lumpy([(0, 0), (0.04, 0.002), (0.048, 0.025), (0.04, 0.05), (0.02, 0.06), (0.024, 0.07), (0, 0.068)], 0.07, 7.0),
          "leather", seg=16, matrix=Matrix.Rotation(radians(70), 4, "Y") @ at(0, 0, -0.03))
    for i in range(16):
        a = i * 2.39996
        r = 0.012 + 0.006 * (i ** 0.5)
        sphere(m, (0.055 + r * cos(a), r * sin(a), 0.006), 0.006, "lead", seg=8, rings=5)
    return m


def silver_filings():
    m = new("silver-filings", "Silver Filings")
    lathe(m, [(0, 0), (0.05, 0), (0.06, 0.012), (0.062, 0.016), (0.056, 0.016), (0.046, 0.006), (0, 0.006)], "tin", seg=20)
    for i in range(70):
        a = i * 2.39996
        r = 0.042 * (i / 70) ** 0.5
        z = 0.008 + 0.012 * (1 - (r / 0.042) ** 2)
        M = at(r * cos(a), r * sin(a), z) @ Matrix.Rotation(i * 0.7, 4, "Z") @ Matrix.Rotation(i * 1.3, 4, "X")
        box(m, (0, 0, 0), (0.007, 0.0016, 0.001), "silver", matrix=M)
    return m


# ---------------------------------------------------------------- ammunition ------------------------------------------

def cartridge(m, p, direction=(0, 0, 1), silver=False):
    M = frame(p, direction)
    lathe(m, [(0, 0), (0.0062, 0), (0.0062, 0.0012), (0.0056, 0.0014), (0.0056, 0.026)], "brass", seg=12, matrix=M)
    lathe(m, [(0.0054, 0.026), (0.0054, 0.03), (0.0044, 0.036), (0.0022, 0.0395), (0, 0.04)], "silver" if silver else "lead",
          seg=12, matrix=M)


def revolver_cartridge():
    m = new("revolver-cartridge", "Revolver Cartridges")
    box(m, (0, 0, 0.0125), (0.06, 0.042, 0.025), "paper", 0.001)
    box(m, (0, 0.035, 0.002), (0.06, 0.042, 0.004), "paper", 0.001)
    for ix in range(4):
        for iy in range(2):
            if (ix, iy) != (3, 1):
                cartridge(m, (-0.021 + 0.014 * ix, -0.008 + 0.016 * iy, 0.01))
    cartridge(m, (0.05, -0.01, 0.0062), (1, 0.3, 0))
    return m


def shotgun_shell():
    m = new("shotgun-shell", "Shotgun Shells")
    for i, (x, y, turn) in enumerate(((0, 0, 10), (0.004, 0.028, -8), (0.03, -0.02, 70))):
        M = at(x, y, 0.0105) @ Matrix.Rotation(radians(turn), 4, "Z") @ Matrix.Rotation(radians(90), 4, "Y")
        lathe(m, [(0, -0.035), (0.0118, -0.035), (0.0118, -0.033), (0.0105, -0.032), (0.0105, -0.016)], "brass", seg=16, matrix=M)
        lathe(m, [(0.0102, -0.016), (0.0102, 0.034), (0.008, 0.036), (0, 0.036)], "red_paper", seg=16, matrix=M)
    return m


def blessed_rounds():
    m = new("blessed-rounds", "Blessed Rounds")
    for i in range(6):
        a = 2 * pi * i / 6
        cartridge(m, (0.0082 * cos(a), 0.0082 * sin(a), 0), silver=True)
    cartridge(m, (0, 0, 0), silver=True)
    sweep(m, [Vector((0.016 * cos(a), 0.016 * sin(a), 0.016)) for a in [2 * pi * i / 18 for i in range(18)]], 0.0012,
          "twine", seg=4, closed=True)
    box(m, (0, -0.0175, 0.018), (0.016, 0.0012, 0.022), "paper", 0.0002)
    box(m, (0, -0.0183, 0.02), (0.0018, 0.0006, 0.013), "ink")
    box(m, (0, -0.0183, 0.023), (0.008, 0.0006, 0.0018), "ink")
    return m


# ---------------------------------------------------------------- weapons and tools -----------------------------------

def shovel_head(m, sharp):
    blade = []
    W, L = 0.105, 0.24
    rows, cols = 9, 7
    for i in range(rows):
        v = i / (rows - 1)
        for j in range(cols):
            u = j / (cols - 1) * 2 - 1
            half = W * (1 - 0.25 * v ** 2.2) if v < 0.86 else W * 0.82 * (1 - (v - 0.86) / 0.14 * 0.3)
            x = u * half
            z = -v * L - (0.02 * (1 - u * u) if v > 0.8 else 0) - 0.03 * (v ** 3) * (1 - abs(u))
            y = 0.012 * u * u
            blade.append((x, y, z))
    faces = [(i * cols + j, i * cols + j + 1, (i + 1) * cols + j + 1, (i + 1) * cols + j) for i in range(rows - 1) for j in range(cols - 1)]
    m.add(blade, faces, "rust")
    m.add([(x, y + 0.0035, z) for x, y, z in blade], [f[::-1] for f in faces], "rust")
    lathe(m, [(0.02, 0.0), (0.017, 0.07), (0.016, 0.09)], "rust", seg=10, matrix=at(0, 0.006, -0.06))
    if sharp:
        edge = [(x, y + 0.0018, z - 0.004) for (x, y, z) in blade[(rows - 1) * cols:]]
        sweep(m, edge, 0.0028, "silver", seg=4, flat=0.4, normal=(0, 1, 0))


def shovel(item_id, name, sharp):
    m = new(item_id, name)
    cyl(m, 0.02, 0.98, 0.016, "oak", seg=12, r1=0.0145)
    shovel_head(m, sharp)
    grip = [Vector((0.055 * cos(a), 0, 1.05 + 0.065 * sin(a))) for a in [pi * (i / 12) for i in range(13)]]
    sweep(m, [Vector((-0.055, 0, 1.0)), *grip[::-1], Vector((0.055, 0, 1.0))], 0.012, "oak", seg=8)
    cyl(m, -0.06, 0.06, 0.013, "oak", seg=10, matrix=at(0, 0, 1.05) @ Matrix.Rotation(radians(90), 4, "Y"))
    sweep(m, [(-0.05, 0, 0.99), (0, 0, 0.965), (0.05, 0, 0.99)], 0.008, "rust", seg=6)
    if sharp:
        for k in range(16):
            z = 0.5 + k * 0.012
            sweep(m, [Vector((0.0168 * cos(a), 0.0168 * sin(a), z + 0.004 * a / (2 * pi))) for a in [2 * pi * i / 10 for i in range(11)]],
                  0.0028, "twine", seg=4)
    return m


def bone_club():
    m = new("bone-club", "Bone Club")
    shaft = smooth([(0, 0, 0), (0.005, 0, 0.2), (0.0, 0.004, 0.42), (-0.006, 0, 0.55)], 2)
    sweep(m, shaft, taper(shaft, [0.016, 0.019, 0.026, 0.036]), "bone", seg=12)
    for o in (-1, 1):
        sphere(m, (o * 0.022 - 0.006, 0, 0.57), 0.032, "bone", seg=12, rings=8)
        sphere(m, (o * 0.012, 0, -0.012), 0.022, "bone", seg=10, rings=6)
    for k, (a, h) in enumerate(((0.4, 0.42), (2.3, 0.46), (4.2, 0.44), (5.6, 0.5))):
        base = Vector((0.03 * cos(a), 0.03 * sin(a), h))
        tip = base + Vector((0.05 * cos(a), 0.05 * sin(a), 0.03 + 0.01 * k))
        sweep(m, [base, base.lerp(tip, 0.6), tip], [0.009, 0.006, 0.0015], "bone", seg=6)
    for z0 in (0.03, 0.43):
        for k in range(8 if z0 < 0.1 else 5):
            z = z0 + k * 0.016
            r = 0.019 if z0 < 0.1 else 0.03
            sweep(m, [Vector((r * cos(a), r * sin(a), z + 0.006 * a / (2 * pi))) for a in [2 * pi * i / 12 for i in range(13)]],
                  0.004, "cloth", seg=5, flat=0.5)
    return m


def holy_water_flask():
    m = new("holy-water-flask", "Holy Water Flask")
    squash = Matrix.Diagonal((1, 0.45, 1, 1))
    lathe(m, [(0, 0), (0.05, 0.0), (0.06, 0.03), (0.062, 0.07), (0.05, 0.105), (0.02, 0.125), (0.014, 0.135), (0.014, 0.15),
              (0.017, 0.155)], "tin", seg=24, matrix=squash)
    cyl(m, 0.15, 0.172, 0.0125, "oak", seg=10, r1=0.014)
    box(m, (0, -0.029, 0.06), (0.014, 0.004, 0.06), "silver", 0.001)
    box(m, (0, -0.029, 0.072), (0.042, 0.004, 0.012), "silver", 0.001)
    sweep(m, smooth([(-0.055, 0, 0.09), (-0.05, 0, 0.17), (0, 0, 0.21), (0.05, 0, 0.17), (0.055, 0, 0.09)], 2), 0.0025,
          "leather", seg=5, flat=0.4, normal=(0, 1, 0))
    return m


def nail_bomb():
    m = new("nail-bomb", "Consecrated Nail Bomb")
    lathe(m, [(0, 0), (0.042, 0), (0.044, 0.004), (0.044, 0.1), (0.04, 0.104), (0, 0.104)], "tin", seg=20)
    for k in range(14):
        a = k * 2.39996
        r = 0.012 + 0.02 * ((k % 5) / 4)
        M = frame((r * cos(a), r * sin(a), 0.09), (0.35 * cos(a), 0.35 * sin(a), 1))
        lathe(m, [(0, -0.02), (0.002, -0.015), (0.0035, 0.03), (0.0035, 0.04)], "rust", seg=4, matrix=M)
        lathe(m, [(0, 0.04), (0.007, 0.04), (0, 0.044)], "rust", seg=6, matrix=M)
    sweep(m, smooth([(0, 0, 0.104), (0.005, 0.01, 0.13), (-0.01, 0.02, 0.15), (0.0, 0.03, 0.16)], 2), 0.0025, "twine", seg=5)
    box(m, (0, -0.0445, 0.055), (0.008, 0.002, 0.05), "silver", 0.0005)
    box(m, (0, -0.0445, 0.065), (0.03, 0.002, 0.008), "silver", 0.0005)
    sweep(m, [Vector((0.045 * cos(a), 0.045 * sin(a), 0.03)) for a in [2 * pi * i / 20 for i in range(20)]], 0.0022, "twine",
          seg=4, closed=True)
    return m


def lantern(m, z0=0.0, glow=True):
    lathe(m, [(0, z0), (0.065, z0), (0.065, z0 + 0.012), (0.055, z0 + 0.03), (0, z0 + 0.03)], "iron", seg=16)
    lathe(m, [(0.048, z0 + 0.03), (0.05, z0 + 0.09), (0.046, z0 + 0.15), (0.03, z0 + 0.17)], "glass", seg=16)
    if glow:
        lathe(m, [(0, z0 + 0.06), (0.009, z0 + 0.07), (0.006, z0 + 0.1), (0, z0 + 0.115)], "ember", seg=8)
    for k in range(4):
        a = pi / 4 + k * pi / 2
        sweep(m, [(0.056 * cos(a), 0.056 * sin(a), z0 + 0.025), (0.058 * cos(a), 0.058 * sin(a), z0 + 0.1),
                  (0.04 * cos(a), 0.04 * sin(a), z0 + 0.17)], 0.0035, "iron", seg=5)
    lathe(m, [(0.05, z0 + 0.165), (0.05, z0 + 0.175), (0.03, z0 + 0.2), (0.012, z0 + 0.215), (0, z0 + 0.22)], "iron", seg=16)
    ring(m, (0, 0, z0 + 0.25), 0.03, 0.003, "iron", axis="Y", seg=5, steps=20)


def lantern_trap():
    m = new("lantern-trap", "Lantern Trap")
    for k in range(3):
        a = 2 * pi * k / 3
        sweep(m, [(0.16 * cos(a), 0.16 * sin(a), 0), (0.04 * cos(a), 0.04 * sin(a), 0.28)], 0.008, "oak", seg=6)
    sweep(m, [Vector((0.06 * cos(a), 0.06 * sin(a), 0.27)) for a in [2 * pi * i / 16 for i in range(16)]], 0.004, "iron",
          seg=5, closed=True)
    lantern(m, 0.27)
    sweep(m, [(0.16, 0, 0.004), (0.32, 0.05, 0.02), (0.48, 0.1, 0.004)], 0.0012, "twine", seg=4)
    box(m, (0.49, 0.1, 0.025), (0.012, 0.012, 0.05), "oak", 0.002)
    return m


def salt_circle():
    m = new("salt-circle", "Salt Circle")
    R = 0.45
    for i in range(48):
        a = 2 * pi * i / 48
        r = R * (1 + 0.025 * noise.noise(Vector((a * 3, 1, 0))))
        lathe(m, [(0, 0), (0.035, 0), (0.018, 0.012), (0, 0.016)], "salt", seg=6, matrix=at(r * cos(a), r * sin(a), 0))
    lathe(m, lumpy([(0, 0), (0.04, 0.0), (0.05, 0.03), (0.04, 0.07), (0.016, 0.085), (0.02, 0.1), (0, 0.098)], 0.08, 9.0),
          "cloth", seg=14, matrix=at(R + 0.07, 0.04, 0))
    return m


def tallow_candle():
    m = new("tallow-candle", "Tallow Candle")
    lathe(m, [(0, 0), (0.07, 0), (0.075, 0.008), (0.07, 0.014), (0, 0.012)], "iron", seg=20)
    sweep(m, smooth([(0.07, 0, 0.012), (0.1, 0, 0.03), (0.105, 0, 0.05), (0.09, 0, 0.055)], 2), 0.006, "iron", seg=6)
    lathe(m, lumpy([(0, 0.01), (0.022, 0.01), (0.022, 0.2), (0.019, 0.215), (0.012, 0.22), (0, 0.218)], 0.05, 2.0), "wax", seg=14)
    for a in (0.6, 2.8, 4.4):
        p = Vector((0.02 * cos(a), 0.02 * sin(a), 0.21))
        sweep(m, [p, p + Vector((0.005 * cos(a), 0.005 * sin(a), -0.05)), p + Vector((0.004 * cos(a), 0.004 * sin(a), -0.12))],
              [0.005, 0.004, 0.0055], "wax", seg=6)
    sweep(m, [(0, 0, 0.215), (0.001, 0, 0.232)], 0.0012, "ink", seg=4)
    lathe(m, [(0, 0.232), (0.007, 0.24), (0.005, 0.255), (0, 0.27)], "ember", seg=8)
    return m


def bandage():
    m = new("bandage", "Bandage")
    pts = []
    for i in range(160):
        a = i / 160 * 2 * pi * 6
        r = 0.012 + 0.0024 * a / (2 * pi)
        pts.append(Vector((r * cos(a), 0, r * sin(a))))
    pts += [Vector((0.026 + 0.03 * t, -0.001, -0.026 - 0.006 * sin(t * 6))) for t in (0.2, 0.5, 0.8, 1.1, 1.4, 1.8)]
    sweep(m, pts, 0.03, "linen", seg=4, flat=0.06, normal=(0, 1, 0))
    return m


def lantern_refill():
    m = new("lantern-refill", "Lantern Refill")
    prof = [(0, 0), (0.03, 0), (0.033, 0.006), (0.033, 0.06), (0.025, 0.08), (0.01, 0.092), (0.01, 0.105), (0.012, 0.108)]
    lathe(m, prof, "glass", seg=18)
    cyl(m, 0.006, 0.05, 0.0318, "oil", seg=18)
    cyl(m, 0.1, 0.122, 0.0098, "oak", seg=10, r1=0.011)
    lathe(m, lumpy([(0, 0.112), (0.015, 0.11), (0.015, 0.124), (0, 0.128)], 0.2, 5.0), "red_wax", seg=12)
    box(m, (0, -0.0335, 0.033), (0.03, 0.002, 0.026), "paper", 0.0005)
    return m


def revolver():
    m = new("revolver", "Service Revolver")
    Y = Matrix.Rotation(radians(90), 4, "Y")
    lathe(m, [(0, 0.0), (0.0075, 0.0), (0.0075, 0.15), (0.009, 0.152), (0.009, 0.158), (0.004, 0.16), (0, 0.16)], "iron", seg=12,
          matrix=at(0.03, 0, 0.062) @ Y)
    box(m, (0.17, 0, 0.074), (0.004, 0.003, 0.008), "iron")
    lathe(m, [(0, -0.024), (0.018, -0.024), (0.019, -0.02), (0.019, 0.02), (0.018, 0.024), (0, 0.024)], "iron", seg=18,
          matrix=at(0.0, 0, 0.05) @ Y)
    for k in range(6):
        a = 2 * pi * k / 6 + pi / 6
        cyl(m, -0.0242, 0.0242, 0.0042, "steel" if "steel" in H.MATERIALS else "lead", seg=8,
            matrix=at(0.0, 0.0195 * cos(a), 0.05 + 0.0195 * sin(a)) @ Y)
    box(m, (0.004, 0, 0.074), (0.07, 0.016, 0.012), "iron", 0.002)
    box(m, (-0.035, 0, 0.05), (0.03, 0.016, 0.05), "iron", 0.002)
    box(m, (0.004, 0, 0.022), (0.07, 0.016, 0.01), "iron", 0.002)
    grip = smooth([(-0.04, 0, 0.03), (-0.055, 0, 0.0), (-0.07, 0, -0.04), (-0.08, 0, -0.07)], 2)
    sweep(m, grip, taper(grip, [0.016, 0.02, 0.019]), "oak", seg=10, flat=0.7, normal=(1, 0, 0))
    sphere(m, (-0.082, 0, -0.075), 0.012, "iron", seg=10, rings=6)
    sweep(m, smooth([(0.02, 0, 0.017), (0.02, 0, -0.01), (-0.01, 0, -0.022), (-0.035, 0, 0.0)], 2), 0.003, "iron", seg=6,
          flat=0.6, normal=(0, 1, 0))
    sweep(m, [(-0.002, 0, 0.017), (0.0, 0, 0.005), (-0.004, 0, -0.004)], 0.0025, "iron", seg=5)
    sweep(m, [(-0.045, 0, 0.07), (-0.058, 0, 0.088), (-0.066, 0, 0.092)], [0.005, 0.004, 0.003], "iron", seg=6)
    return m


def shotgun():
    m = new("shotgun", "Double-Barrel Shotgun")
    Y = Matrix.Rotation(radians(90), 4, "Y")
    for side in (-1, 1):
        lathe(m, [(0, 0), (0.0115, 0), (0.0115, 0.7), (0.0125, 0.702), (0.0125, 0.71), (0.009, 0.71), (0, 0.708)], "iron", seg=14,
              matrix=at(0.0, side * 0.0118, 0.0) @ Y)
    box(m, (0.36, 0, 0.014), (0.7, 0.006, 0.006), "iron")
    box(m, (0.15, 0, -0.016), (0.24, 0.026, 0.02), "oak", 0.004)
    box(m, (-0.04, 0, -0.004), (0.09, 0.03, 0.05), "iron", 0.003)
    stock = smooth([(-0.08, 0, -0.01), (-0.16, 0, -0.03), (-0.28, 0, -0.06), (-0.4, 0, -0.085)], 2)
    sweep(m, stock, taper(stock, [0.02, 0.028, 0.044, 0.052]), "oak", seg=12, flat=0.55, normal=(1, 0, 0))
    box(m, (-0.405, 0, -0.085), (0.012, 0.05, 0.11), "iron", 0.003)
    sweep(m, smooth([(-0.02, 0, -0.03), (-0.02, 0, -0.055), (-0.06, 0, -0.065), (-0.09, 0, -0.04)], 2), 0.003, "iron", seg=6,
          flat=0.6, normal=(0, 1, 0))
    for x in (-0.035, -0.05):
        sweep(m, [(x, 0, -0.03), (x - 0.004, 0, -0.045)], 0.0022, "iron", seg=5)
    for side in (-1, 1):
        sweep(m, [(-0.06, side * 0.008, 0.02), (-0.075, side * 0.01, 0.04), (-0.085, side * 0.012, 0.045)], [0.005, 0.004, 0.003],
              "iron", seg=5)
    return m


def wood_axe():
    m = new("wood-axe", "Wood Axe")
    haft = smooth([(0, 0, 0), (0.01, 0, 0.2), (0.0, 0, 0.45), (-0.015, 0, 0.62), (-0.005, 0, 0.72)], 3)
    sweep(m, haft, [0.02 - 0.003 * (i / (len(haft) - 1)) for i in range(len(haft))], "oak", seg=10, flat=0.7, normal=(1, 0, 0))
    top = Vector((-0.005, 0, 0.7))
    box(m, top, (0.05, 0.034, 0.06), "iron", 0.003)
    head = [(0.02, -0.016, 0.03), (0.13, -0.002, 0.075), (0.135, -0.002, -0.05), (0.02, -0.016, -0.028),
            (0.02, 0.016, 0.03), (0.13, 0.002, 0.075), (0.135, 0.002, -0.05), (0.02, 0.016, -0.028)]
    faces = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    m.add(head, faces, "iron", at(*top))
    sweep(m, [top + Vector((0.132, 0, 0.075)), top + Vector((0.14, 0, 0.01)), top + Vector((0.137, 0, -0.05))], 0.0022, "silver",
          seg=4)
    box(m, top + Vector((-0.04, 0, 0)), (0.03, 0.03, 0.04), "iron", 0.003)
    for k in range(10):
        z = 0.05 + k * 0.012
        sweep(m, [Vector((0.021 * cos(a), 0.016 * sin(a), z + 0.004 * a / (2 * pi))) for a in [2 * pi * i / 10 for i in range(11)]],
              0.0026, "leather", seg=4)
    return m


def silver_sabre():
    m = new("silver-sabre", "Silver Sabre")
    n = 20
    spine, edge = [], []
    for i in range(n + 1):
        t = i / n
        x = 0.06 * t ** 2
        z = 0.12 + 0.76 * t
        w = 0.03 * (1 - 0.35 * t) if t < 0.9 else 0.03 * 0.65 * (1 - (t - 0.9) / 0.1)
        spine.append(Vector((x, 0, z)))
        edge.append(Vector((x + w, 0, z - (0.02 if t > 0.92 else 0) * (t - 0.92) / 0.08)))
    verts, faces = [], []
    for i in range(n + 1):
        verts += [spine[i] + Vector((0, -0.003, 0)), spine[i] + Vector((0, 0.003, 0)), edge[i]]
    for i in range(n):
        a, b = i * 3, (i + 1) * 3
        faces += [(a, b, b + 2, a + 2), (a + 1, a + 2, b + 2, b + 1), (a, a + 1, b + 1, b)]
    faces += [(0, 2, 1), (n * 3, n * 3 + 1, n * 3 + 2)]
    m.add(verts, faces, "silver")
    box(m, (0.015, 0, 0.115), (0.07, 0.022, 0.008), "brass", 0.002)
    sweep(m, smooth([(0.045, 0, 0.115), (0.07, 0, 0.06), (0.06, 0, -0.02), (0.0, 0, -0.03)], 2), 0.004, "brass", seg=6, flat=0.5,
          normal=(0, 1, 0))
    cyl(m, 0.0, 0.11, 0.013, "leather", seg=10, r1=0.012)
    for k in range(9):
        z = 0.008 + k * 0.012
        sweep(m, [Vector((0.0135 * cos(a), 0.0135 * sin(a), z + 0.006 * a / (2 * pi))) for a in [2 * pi * i / 10 for i in range(11)]],
              0.0012, "silver", seg=4)
    sphere(m, (0, 0, -0.012), 0.016, "brass", seg=10, rings=7)
    return m


def kola_tonic():
    m = new("kola-tonic", "Kola Tonic")
    lathe(m, [(0, 0), (0.026, 0), (0.028, 0.004), (0.028, 0.1), (0.022, 0.115), (0.011, 0.125), (0.01, 0.15), (0.012, 0.153)],
          "green_glass", seg=18)
    cyl(m, 0.148, 0.168, 0.0092, "oak", seg=10, r1=0.0104)
    lathe(m, [(0.0285, 0.03), (0.0285, 0.085)], "paper", seg=18)
    lathe(m, [(0.0288, 0.05), (0.0288, 0.064)], "red_paper", seg=18)
    sweep(m, [(0.0, 0.011, 0.155), (0.0, 0.0, 0.17), (0.0, -0.011, 0.155)], 0.0012, "twine", seg=4)
    return m


# ---------------------------------------------------------------- lore -------------------------------------------------

def journal_page():
    m = new("journal-page", "Journal Page")
    W, Hh, cols, rows = 0.15, 0.2, 10, 13
    verts = []
    for i in range(rows + 1):
        for j in range(cols + 1):
            u, v = j / cols, i / rows
            tear = 0.012 * noise.noise(Vector((u * 9, 2.0, 0))) if i == rows else 0
            x = (u - 0.5) * W + (0.006 * noise.noise(Vector((v * 9, 4, 0))) if j in (0, cols) else 0)
            y = (v - 0.5) * Hh + tear
            z = 0.012 * (u - 0.5) ** 2 * 4 + 0.006 * sin(v * 3) + 0.004 * noise.noise(Vector((u * 3, v * 3, 1)))
            if i == 0 and j > cols - 3:
                z += 0.012 * (j - (cols - 3)) / 3
            verts.append(Vector((x, y, z)))
    faces = [(i * (cols + 1) + j, i * (cols + 1) + j + 1, (i + 1) * (cols + 1) + j + 1, (i + 1) * (cols + 1) + j)
             for i in range(rows) for j in range(cols)]
    m.add(verts, faces, "paper")
    m.add([v - Vector((0, 0, 0.0008)) for v in verts], [f[::-1] for f in faces], "paper")

    def on_page(x, y):
        u, v = x / W + 0.5, y / Hh + 0.5
        j, i = min(cols - 1, int(u * cols)), min(rows - 1, int(v * rows))
        fu, fv = u * cols - j, v * rows - i
        a = verts[i * (cols + 1) + j].lerp(verts[i * (cols + 1) + j + 1], fu)
        b = verts[(i + 1) * (cols + 1) + j].lerp(verts[(i + 1) * (cols + 1) + j + 1], fu)
        return a.lerp(b, fv) + Vector((0, 0, 0.0006))

    for line in range(11):
        y = 0.07 - line * 0.014
        x0 = -0.058 + (0.012 if line == 0 else 0)
        x1 = 0.058 - 0.02 * noise.noise(Vector((line, 0, 0))) - (0.05 if line == 10 else 0)
        pts = [on_page(x0 + (x1 - x0) * t / 12, y + 0.0015 * sin(t * 2.3 + line)) for t in range(13)]
        sweep(m, pts, 0.0006, "ink", seg=3, flat=0.3, normal=(0, 0, 1))
    blot = on_page(0.03, -0.075)
    sphere(m, blot, 0.004, "ink", seg=8, rings=3)
    return m


def parish_ledger():
    m = new("parish-ledger", "Parish Ledger")
    W, D, T = 0.22, 0.29, 0.06
    box(m, (0.004, 0, 0), (W - 0.01, D - 0.012, T - 0.008), "paper", 0.002)
    for z in (-T / 2 + 0.002, T / 2 - 0.002):
        box(m, (0, 0, z), (W, D, 0.005), "leather", 0.0015)
    spine = [Vector((-W / 2 - 0.004 * sin(a), 0, T / 2 * cos(a))) for a in [pi * i / 8 for i in range(9)]]
    for y in (-D / 2, D / 2):
        pass
    verts, faces = [], []
    for k, p in enumerate(spine):
        verts += [p + Vector((-0.002, -D / 2, 0)), p + Vector((-0.002, D / 2, 0))]
        if k:
            a = (k - 1) * 2
            faces.append((a, a + 2, a + 3, a + 1))
    m.add(verts, faces, "leather")
    m.add([v + Vector((0.003, 0, 0)) for v in verts], [f[::-1] for f in faces], "leather")
    for y in (-D / 2 + 0.03, -0.04, 0.04, D / 2 - 0.03):
        box(m, (-W / 2 - 0.004, y, 0), (0.006, 0.006, T + 0.004), "leather", 0.001)
    for sx in (-1, 1):
        for sy in (-1, 1):
            box(m, (sx * (W / 2 - 0.014), sy * (D / 2 - 0.014), T / 2 + 0.0005), (0.03, 0.03, 0.003), "brass", 0.001)
    box(m, (0.015, 0, T / 2 + 0.001), (0.014, 0.12, 0.003), "brass", 0.0008)
    box(m, (0.015, 0.02, T / 2 + 0.001), (0.07, 0.014, 0.003), "brass", 0.0008)
    box(m, (W / 2 + 0.002, 0, 0), (0.024, 0.04, 0.004), "brass", 0.001)
    box(m, (W / 2 - 0.01, 0, T / 2 + 0.001), (0.03, 0.03, 0.004), "brass", 0.001)
    sweep(m, [(0.06, D / 2 - 0.02, T / 2 - 0.01), (0.07, D / 2 + 0.02, T / 2 - 0.02), (0.065, D / 2 + 0.05, -T / 2)], 0.003,
          "thread", seg=4, flat=0.3, normal=(0, 0, 1))
    return m


BUILDERS = [
    bone, iron_nail, candle_wax, holy_water, cloth, lamp_oil, grave_salt, wood_plank, black_powder, lead_shot, silver_filings,
    revolver_cartridge, shotgun_shell, blessed_rounds,
    lambda: shovel("rusty-shovel", "Rusty Shovel", False), lambda: shovel("sharpened-shovel", "Sharpened Shovel", True),
    bone_club, holy_water_flask, nail_bomb, lantern_trap, salt_circle, tallow_candle, bandage, lantern_refill,
    revolver, shotgun, wood_axe, silver_sabre, kola_tonic,
    journal_page, parish_ledger,
]


def write_doc(results):
    lines = [
        "# World Items",
        "",
        "Generated by `tools/blender/world_items.py`; rerun that script instead of editing this table.",
        "Same conventions as `docs/hero-items.md`: files in `public/assets/models/items/<id>.glb`, metres, centred on the",
        "bounding box, glTF Y up, vertex colours (`COLOR_0`), Draco. Orientation (glTF axes): shovels stand along +Y with the D-grip at +Y and the blade at -Y; the bone club, wood axe "
        "and silver sabre stand along +Y with the grip at -Y; the revolver and shotgun point the barrel to +X with the "
        "top at +Y; everything else lies flat as it would rest on the ground. `journal-page` is one model shared by all five pages.",
        "",
        "| Item ID | Name | Size W x H x D (mm) | Triangles |",
        "|---|---|---|---|",
    ]
    for r in results:
        lines.append(f"| `{r['id']}` | {r['name']} | {' x '.join(str(v) for v in r['size_mm'])} | {r['tris']} |")
    with open(DOC_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines) + "\n")


def main():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    for name in H.MATERIALS:
        if name not in bpy.data.materials:
            H.make_material(name)
    only = os.environ.get("ONLY")
    results = []
    for build in BUILDERS:
        m = build()
        if only and m.id not in only.split(","):
            continue
        results.append(H.finish(m))
    if not only:
        write_doc(results)
    print("WORLD_RESULT " + json.dumps([[r["id"], r["tris"], r["size_mm"]] for r in results]))


main()
