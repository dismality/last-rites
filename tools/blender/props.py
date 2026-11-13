"""Props for Last Rites: everything still drawn with primitives or stock Kenney models outside the big scenes.

  blender -b --factory-startup --python tools/blender/props.py -- OUT_DIR PREVIEW_DIR [only,ids]

Each prop is its own Draco GLB in OUT_DIR (public/assets/models/props/), in its own game space: origin on the ground
at the footprint centre, front facing +Z, unless the PROPS table says otherwise. A JSON beside a GLB carries its
colliders and anchors (light positions, pivots, surfaces). docs/scenery-models.md lists them for the game.
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sclib import *  # noqa
import sclib
import bpy

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT, PREVIEW = ARGV[0], ARGV[1]
ONLY = set(ARGV[2].split(',')) if len(ARGV) > 2 and ARGV[2] else None

OAK = wood((92, 62, 38), 0.32)
DARK = wood((58, 40, 28), 0.3)
GREY = wood((104, 92, 78), 0.35, weather=0.6, grime_h=0.4)
GRAVE_STONE = stone((128, 122, 112), moss=0.55, grime_h=0.6, streak=0.35)
BONEP = bone()
EARTH = earth()
IRONP = iron(0.4)


def skull(bm, dk, pos, yaw=0.0, s=1.0, tilt=0.0):
    x, y, z = pos
    M = T(x, y, z) @ RY(yaw) @ RX(tilt)
    cr = sphere(0.085 * s, (0, 0.085 * s, -0.01 * s), 8, 5)
    for v in cr.verts:
        v.co.y *= 1.18
    append(bm, cr, M)
    f = new()
    box(f, (0, 0.045 * s, 0.07 * s), (0.11 * s, 0.07 * s, 0.06 * s))
    box(f, (0, 0.012 * s, 0.065 * s), (0.08 * s, 0.03 * s, 0.05 * s))
    append(bm, f, M)
    for ex in (-0.028, 0.028):
        append(dk, sphere(0.021 * s, (ex * s, 0.09 * s, 0.093 * s), 5, 3), M)


# ------------------------------------------------------------------ props ----------------------------------------------
def workbench(k):
    """Bench-local: footprint centre on the floor, top surface 0.86, back (splash) toward -Z. Matches Workbench.tsx."""
    W, D, TOP = 1.4, 0.8, 0.86
    top = new()
    n = 4
    for i in range(n):
        d = (D - 0.2) / n
        box(top, (0, TOP - 0.045, -D / 2 + 0.2 + d * (i + 0.5)), (W, 0.09, d - 0.004))
    box(top, (0, TOP - 0.035, -D / 2 + 0.1), (W, 0.07, 0.2 - 0.004))                           # tool well floor sits lower
    box(top, (0, TOP + 0.13, -D / 2 + 0.025), (W, 0.26, 0.05))                                   # back splash
    for sx in (-1, 1):
        for sz in (-1, 1):
            box(top, (sx * (W / 2 - 0.09), (TOP - 0.09) / 2, sz * (D / 2 - 0.08)), (0.1, TOP - 0.09, 0.1))
        box(top, (sx * (W / 2 - 0.09), 0.18, 0), (0.07, 0.08, D - 0.2))
    box(top, (0, 0.18, -D / 2 + 0.08), (W - 0.2, 0.08, 0.06))
    box(top, (0, 0.24, 0), (W - 0.24, 0.035, D - 0.24))                                          # lower shelf
    box(top, (0, TOP - 0.17, D / 2 - 0.02), (W - 0.1, 0.16, 0.05))                                # apron
    bevel(top, 0.006)
    k.add(top, Matrix.Identity(4), 'wood', wood((104, 72, 44), 0.35, grime_h=0.3), 1, name='bench')
    # Front vice: wooden chop, iron screw and tommy bar, at the front-left.
    v = new()
    box(v, (-W / 2 + 0.25, TOP - 0.13, D / 2 + 0.04), (0.36, 0.26, 0.06))
    k.add(v, Matrix.Identity(4), 'wood', DARK, 2, name='bench')
    sc = new()
    append(sc, tube([(-W / 2 + 0.25, TOP - 0.12, D / 2 - 0.05), (-W / 2 + 0.25, TOP - 0.12, D / 2 + 0.12)], 0.022, 8))
    append(sc, tube([(-W / 2 + 0.12, TOP - 0.12, D / 2 + 0.12), (-W / 2 + 0.38, TOP - 0.12, D / 2 + 0.12)], 0.01, 5))
    k.add(sc, Matrix.Identity(4), 'iron', IRONP, 3, name='iron')
    # Bench dog holes, a hand plane and a mallet at the back, shavings on the shelf.
    dk = new()
    for x in (-0.45, -0.15, 0.15, 0.45):
        box(dk, (x, TOP + 0.001, D / 2 - 0.08), (0.025, 0.004, 0.025))
    k.add(dk, Matrix.Identity(4), 'stone', const((20, 16, 12)), 4, name='dark')
    tl = new()
    box(tl, (0.4, TOP - 0.07 + 0.035, -D / 2 + 0.1), (0.26, 0.06, 0.07))
    append(tl, cyl(0.02, 0.06, 6), T(0.33, TOP - 0.035 + 0.06, -D / 2 + 0.1))
    box(tl, (-0.3, TOP - 0.07 + 0.05, -D / 2 + 0.1), (0.13, 0.09, 0.09))
    append(tl, tube([(-0.3, TOP - 0.03 + 0.05, -D / 2 + 0.1), (-0.05, TOP - 0.03 + 0.02, -D / 2 + 0.12)], 0.014, 6))
    k.add(tl, Matrix.Identity(4), 'wood', OAK, 5, name='bench')
    blade = new()
    box(blade, (0.4, TOP - 0.035 + 0.065, -D / 2 + 0.1), (0.05, 0.012, 0.072))
    k.add(blade, Matrix.Identity(4), 'iron', iron(0.2, (90, 90, 92)), 6, name='iron')
    sh = new()
    for i in range(14):
        a = R.uniform(0, 6.28)
        r = R.uniform(0.03, 0.05)
        append(sh, tube([(R.uniform(-0.5, 0.5) + r * math.cos(t / 3 + a), 0.27 + 0.01 * t, R.uniform(-0.2, 0.2) + r * math.sin(t / 3 + a)) for t in range(7)], 0.006, 4))
    k.add(sh, Matrix.Identity(4), 'wood', wood((190, 150, 100), 0.2), 7, name='bench')
    k.collider(0, 0, W / 2, TOP / 2, D / 2, note='bench (same as the game collider)')
    k.anchor('top-surface', 0, TOP, 0.05, surfaceY=TOP, clearArea=[W - 0.1, D - 0.3])


def lamp_post(k):
    """Cast-iron lamp post, 3 m. The lamp arm points +Z (the path side; the game's rotationY turns it)."""
    bm = new()
    append(bm, lathe([(0, 0), (0.2, 0), (0.2, 0.08), (0.15, 0.12), (0.15, 0.3), (0.1, 0.36), (0.065, 0.5), (0.055, 2.5), (0.075, 2.55),
                      (0.075, 2.62), (0.04, 2.66), (0.0, 2.7)], 10))
    for y in (0.62, 1.4):
        append(bm, lathe([(0.055, y - 0.03), (0.085, y), (0.055, y + 0.03)], 10, cap=False))
    append(bm, tube([(0, 2.55, 0), (0, 2.62, 0.25), (0, 2.6, 0.45), (0, 2.5, 0.55)], 0.022, 6))
    append(bm, tube([(0, 2.3, 0.0), (0, 2.42, 0.2), (0, 2.58, 0.28)], 0.012, 5))
    for a in range(0, 360, 30):
        r = 0.09
        pass
    k.add(bm, Matrix.Identity(4), 'iron', iron(0.35, (28, 28, 30)), 11, name='iron')
    c = lantern(k, (0, 2.06, 0.55), 12, 1.15)
    k.anchor('light', c[0], c[1], c[2], note='the lamp post light goes here')
    k.collider(0, 0, 0.12, 1.35, 0.12, note='post')


def coffin_broken(k):
    """Old coffin dug up and split, lid knocked aside. Long axis along Z. Walk-over (no collider), as before."""
    L, Wd, Ht = 1.9, 0.56, 0.36
    sides = new()
    outline = [(-0.2, -L / 2), (0.2, -L / 2), (Wd / 2, -L / 2 + 0.55), (0.22, L / 2), (-0.22, L / 2), (-Wd / 2, -L / 2 + 0.55)]
    for (ax, az), (bx, bz) in zip(outline, outline[1:] + outline[:1]):
        mx, mz = (ax + bx) / 2, (az + bz) / 2
        Ls = math.hypot(bx - ax, bz - az)
        ang = math.atan2(bx - ax, bz - az)
        bmesh.ops.create_cube(sides, size=1.0, matrix=T(mx, Ht / 2, mz) @ RY(ang) @ S(0.03, Ht, Ls + 0.02))
    # Base boards and a broken side.
    for i in range(4):
        box(sides, (0, 0.015, -L / 2 + 0.1 + i * 0.46), (0.42, 0.03, 0.44))
    for v in sides.verts:
        if v.co.x > 0.18 and v.co.z > 0.2:          # splintered top edge on one side
            v.co.z -= 0.1 * (noise.noise(v.co * 9) + 1)
    k.add(sides, Matrix.Identity(4), 'wood', wood((70, 52, 38), 0.35, weather=0.3, grime_h=0.4), 21, name='wood')
    lid = new()
    for i in range(3):
        box(lid, (-0.13 + i * 0.13, 0.0, 0), (0.125, 0.03, L * 0.92))
    box(lid, (0, -0.02, -0.2), (0.4, 0.03, 0.06))
    box(lid, (0, -0.02, 0.4), (0.4, 0.03, 0.06))
    k.add(lid, T(0.62, 0.12, 0.15) @ RY(0.35) @ RZ(0.22), 'wood', wood((70, 52, 38), 0.35, weather=0.4), 22, name='wood')
    dirt = new()
    for i in range(6):
        s = sphere(R.uniform(0.12, 0.22), (R.uniform(-0.25, 0.25), 0.02, R.uniform(-0.8, 0.8)), 7, 4, 0.35)
        append(dirt, s)
    k.add(dirt, Matrix.Identity(4), 'earth', EARTH, 23, name='earth', smooth=True)
    bn, dk = new(), new()
    skull(bn, dk, (0.05, 0.03, -0.62), yaw=0.4, tilt=-0.5)
    for a, b in (((-0.1, 0.05, -0.2), (0.12, 0.05, 0.25)), ((0.1, 0.05, 0.1), (-0.05, 0.05, 0.55))):
        append(bn, tube([a, b], 0.018, 5))
    k.add(bn, Matrix.Identity(4), 'bone', BONEP, 24, name='bone', smooth=True)
    k.add(dk, Matrix.Identity(4), 'stone', const((18, 15, 12)), 25, name='dark')
    nl = new()
    for i in range(5):
        append(nl, tube([(R.uniform(-0.25, 0.25), 0.36, R.uniform(-0.8, 0.8)), (R.uniform(-0.25, 0.25), 0.4, R.uniform(-0.8, 0.8))], 0.005, 4))
    k.add(nl, Matrix.Identity(4), 'iron', iron(0.8), 26, name='iron')


def iron_gate(k, w, h):
    """Wrought-iron double gate in the plane z = 0, origin bottom centre, w wide x h high. Lifts as one piece."""
    bm = new()
    for sx in (-1, 1):
        box(bm, (sx * (w / 2 - 0.04), h / 2, 0), (0.07, h, 0.07))                               # hanging stiles
    box(bm, (0, h / 2, 0.0), (0.05, h, 0.05))                                                   # meeting stiles
    for y in (0.12, h * 0.32, h - 0.35):
        box(bm, (0, y, 0), (w - 0.04, 0.05, 0.04))
    x = -w / 2 + 0.15
    while x < w / 2 - 0.1:
        if abs(x) > 0.06:
            append(bm, tube([(x, 0.1, 0), (x, h - 0.1, 0)], 0.013, 6))
            spear = lathe([(0, 0), (0.028, 0.04), (0.012, 0.13), (0, 0.17)], 4)
            append(bm, spear, T(x, h - 0.12, 0))
            append(bm, lathe([(0.02, -0.015), (0.024, 0), (0.02, 0.015)], 6, cap=False), T(x, h * 0.32 + 0.12, 0))
        x += 0.13
    # Scrolls between the mid rail and the top rail on each leaf.
    for sx in (-1, 1):
        for j in range(2):
            cx = sx * (0.35 + j * (w / 4 - 0.15)) if w > 3 else sx * (0.25 + j * 0.55)
            cy = (h * 0.32 + h - 0.35) / 2
            pts = []
            for t in range(28):
                a = t / 27 * math.pi * 2.6
                r = 0.03 + 0.12 * t / 27
                pts.append((cx + sx * r * math.cos(a), cy + r * math.sin(a), 0.0))
            append(bm, tube(pts, 0.009, 5))
            append(bm, tube([(cx + sx * (-0.15 + 0.3 * t / 9), cy - 0.25 + 0.04 * math.sin(t), 0) for t in range(10)], 0.008, 5))
    # Arched cresting on the top rail.
    crest = [(0.9 * (w / 2) * math.cos(math.pi * (1 - t / 24)), h - 0.33 + 0.25 * math.sin(math.pi * t / 24), 0) for t in range(25)]
    append(bm, tube(crest, 0.014, 5))
    k.add(bm, Matrix.Identity(4), 'iron', iron(0.45, (26, 26, 28)), 31, name='iron')
    # Chain and padlock at the meeting stiles.
    ch = new()
    for i in range(8):
        y = 1.05 + i * 0.06
        L = lathe([(0.018, -0.028), (0.026, -0.028), (0.026, 0.028), (0.018, 0.028)], 6)
        append(ch, L, T(0.0 + (0.05 if i % 2 else -0.05), y, 0.06) @ (RX(math.pi / 2) if i % 2 else RZ(math.pi / 2)))
    box(ch, (0, 0.95, 0.07), (0.1, 0.12, 0.04))
    append(ch, tube([(-0.035, 1.0, 0.07), (-0.035, 1.06, 0.07), (0.035, 1.06, 0.07), (0.035, 1.0, 0.07)], 0.008, 5))
    k.add(ch, Matrix.Identity(4), 'iron', iron(0.6, (60, 52, 40)), 32, name='iron')
    k.anchor('lock', 0, 1.0, 0.08)


def gate_catacombs(k):
    iron_gate(k, 3.3, 2.2)


def gate_mausoleum(k):
    iron_gate(k, 4.3, 4.0)


def iron_railing(k):
    """One 1.5 m railing panel, 1.3 m high, origin bottom centre, in the plane z = 0. A post at the -X end only."""
    w, h = 1.5, 1.3
    bm = new()
    box(bm, (-w / 2, h / 2 + 0.05, 0), (0.07, h + 0.1, 0.07))
    append(bm, lathe([(0, 0), (0.05, 0), (0.05, 0.03), (0.02, 0.08), (0.035, 0.12), (0, 0.17)], 6), T(-w / 2, h + 0.1, 0))
    box(bm, (-w / 2, 0.06, 0), (0.12, 0.12, 0.12))
    for y in (0.12, h - 0.15):
        box(bm, (0, y, 0), (w, 0.035, 0.035))
    x = -w / 2 + 0.12
    while x < w / 2 - 0.05:
        append(bm, tube([(x, 0.1, 0), (x, h - 0.05, 0)], 0.011, 5))
        append(bm, lathe([(0, 0), (0.024, 0.035), (0.01, 0.1), (0, 0.13)], 4), T(x, h - 0.06, 0))
        x += 0.125
    k.add(bm, Matrix.Identity(4), 'iron', iron(0.45, (26, 26, 28)), 41, name='iron')


def grave_mound(k):
    """Fresh earth over a grave, cross at the head (-Z), spade stuck in. Footprint 1.6 x 2.6 (Interactable size)."""
    bm = new()
    nx, nz = 10, 16
    verts = []
    for i in range(nz + 1):
        row = []
        for j in range(nx + 1):
            u, v = j / nx * 2 - 1, i / nz * 2 - 1
            x, z = u * 0.82, v * 1.32
            r = math.sqrt(u * u * 0.9 + v * v * 0.6)
            y = max(0.0, 0.42 * (1 - r * r)) + noise.noise(Vector((x * 4, z * 4, 0.3))) * 0.035
            row.append(bm.verts.new(G(x, max(-0.02, y - 0.02), z)))
        verts.append(row)
    for i in range(nz):
        for j in range(nx):
            bm.faces.new([verts[i][j], verts[i][j + 1], verts[i + 1][j + 1], verts[i + 1][j]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    k.add(bm, Matrix.Identity(4), 'earth', earth((52, 38, 26)), 51, name='earth', smooth=True)
    cl = new()
    for i in range(14):
        append(cl, sphere(R.uniform(0.04, 0.08), (R.uniform(-0.6, 0.6), R.uniform(0.0, 0.2), R.uniform(-1.1, 1.1)), 6, 4, 0.7))
    k.add(cl, Matrix.Identity(4), 'earth', earth((40, 30, 22)), 52, name='earth')
    cr = new()
    box(cr, (0, 0.8, -1.35), (0.09, 1.6, 0.07))
    box(cr, (0, 1.18, -1.35), (0.62, 0.09, 0.07))
    bevel(cr, 0.008)
    k.add(cr, T(0, 0, 0) @ RZ(0.0), 'wood', wood((110, 86, 60), 0.35, weather=0.6), 53, name='wood')
    tag = new()
    box(tag, (0, 1.0, -1.31), (0.2, 0.13, 0.008))
    k.add(tag, Matrix.Identity(4), 'paper', PAPER, 54, name='paper')
    nl = new()
    box(nl, (0, 1.18, -1.31), (0.02, 0.02, 0.02))
    k.add(nl, Matrix.Identity(4), 'iron', iron(0.8), 55, name='iron')
    # Spade: handle, shaft and blade, driven in at an angle.
    sp = new()
    append(sp, tube([(0, 0.0, 0), (0, 0.95, 0)], 0.022, 6))
    box(sp, (0, 1.0, 0), (0.16, 0.035, 0.035))
    for sx in (-1, 1):
        append(sp, tube([(sx * 0.07, 1.0, 0), (sx * 0.02, 0.9, 0)], 0.012, 5))
    k.add(sp, T(0.3, 0.12, 0.25) @ RZ(-0.18) @ RX(0.22), 'wood', wood((120, 92, 60), 0.3), 56, name='wood')
    bl = prism([(-0.12, 0.0), (0.12, 0.0), (0.12, -0.24), (0.0, -0.3), (-0.12, -0.24)], 0.012)
    k.add(bl, T(0.3, 0.12, 0.25) @ RZ(-0.18) @ RX(0.22), 'iron', iron(0.5, (80, 80, 82)), 57, name='iron')


def grave_dug(k):
    """The same grave once dug today: a dark open pit with an earth rim, the spoil heap beside it and a plank."""
    pit = new()
    box(pit, (0, 0.008, 0), (0.9, 0.012, 1.75))
    k.add(pit, Matrix.Identity(4), 'stone', const((12, 9, 7)), 61, name='dark')
    wall = new()
    for sx in (-1, 1):
        box(wall, (sx * 0.47, 0.05, 0), (0.06, 0.1, 1.85))
    for sz in (-1, 1):
        box(wall, (0, 0.05, sz * 0.9), (1.0, 0.1, 0.06))
    jitter(wall, 0.03, 2, 4)
    k.add(wall, Matrix.Identity(4), 'earth', earth((48, 36, 24)), 62, name='earth')
    sp = sphere(1.0, (0.95, 0.0, 0.1), 12, 6)
    for v in sp.verts:
        v.co = Vector((v.co.x * 0.42, v.co.y * 0.95, max(0.0, v.co.z) * 0.32))
    jitter(sp, 0.04, 3, 3)
    k.add(sp, Matrix.Identity(4), 'earth', earth((56, 42, 28)), 63, name='earth', smooth=True)
    pl = new()
    box(pl, (-0.05, 0.11, 0.35), (1.3, 0.04, 0.24))
    k.add(pl, T(0, 0, 0) @ RY(0.25), 'wood', GREY, 64, name='wood')
    cr = new()
    box(cr, (0, 0.8, -1.35), (0.09, 1.6, 0.07))
    box(cr, (0, 1.18, -1.35), (0.62, 0.09, 0.07))
    k.add(cr, T(-0.1, 0, 0) @ RZ(-0.12), 'wood', wood((110, 86, 60), 0.35, weather=0.6), 65, name='wood')


def merchant_cart(k):
    """Silas's covered cart. Faces +Z (shafts), wheels on the X sides, as in Merchant.tsx. Lantern anchor on its pole."""
    w = new()
    box(w, (0, 0.76, 0), (1.3, 0.08, 2.6))
    for sx in (-1, 1):
        plank_run(w, 'z', -1.3, 1.3, sx * 0.62, 0.8, 1.25, 0.04, 0.15)
        for z in (-1.2, -0.4, 0.4, 1.2):
            box(w, (sx * 0.65, 1.0, z), (0.06, 0.5, 0.06))
    plank_run(w, 'x', -0.65, 0.65, -1.27, 0.8, 1.25, 0.04, 0.15)
    for sx in (-1, 1):
        append(w, tube([(sx * 0.35, 0.72, 1.1), (sx * 0.33, 0.7, 2.3), (sx * 0.3, 0.62, 2.7)], 0.03, 6))
    box(w, (0, 0.7, 2.25), (0.75, 0.05, 0.05))
    for sx in (-1, 1):
        box(w, (sx * 0.55, 0.55, 0.8), (0.08, 0.1, 0.12))
        box(w, (sx * 0.55, 0.55, -0.8), (0.08, 0.1, 0.12))
    k.add(w, Matrix.Identity(4), 'wood', wood((70, 50, 34), 0.35, weather=0.4), 71, name='wood')
    # Wheels: rim, 10 spokes, hub, iron tyre.
    wh, tyre = new(), new()
    for sx in (-1, 1):
        for z in (-0.8, 0.8):
            M = T(sx * 0.75, 0.5, z) @ RZ(math.pi / 2)
            append(wh, lathe([(0.42, -0.03), (0.48, -0.03), (0.48, 0.03), (0.42, 0.03)], 20, cap=False), M)
            append(tyre, lathe([(0.48, -0.035), (0.5, -0.035), (0.5, 0.035), (0.48, 0.035)], 20, cap=False), M)
            append(wh, lathe([(0, -0.09), (0.08, -0.09), (0.09, 0.0), (0.08, 0.09), (0, 0.09)], 10), M)
            for s in range(10):
                a = s * math.pi / 5
                append(wh, tube([(0, 0, 0), (0.43 * math.cos(a), 0, 0.43 * math.sin(a))], 0.018, 4), M)
    k.add(wh, Matrix.Identity(4), 'wood', wood((80, 58, 38), 0.3, weather=0.3), 72, name='wood')
    k.add(tyre, Matrix.Identity(4), 'iron', iron(0.6), 73, name='iron')
    # Canvas tilt on hoops.
    hp, cv = new(), new()
    zs = [-1.25, -0.6, 0.05, 0.7, 1.25]
    for z in zs:
        pts = [(0.66 * math.cos(math.pi * t / 12), 1.25 + 0.7 * math.sin(math.pi * t / 12), z) for t in range(13)]
        append(hp, tube(pts, 0.02, 5))
    for layer, dr in ((0, 0.0), (1, -0.012)):
        rings = []
        for i, z in enumerate([zs[0] - 0.05] + zs[1:-1] + [zs[-1] + 0.05]):
            ring = []
            for t in range(13):
                a = math.pi * t / 12
                edge = i in (0, len(zs) - 1)
                r = 0.68 + (0.0 if edge else -0.02) + dr
                ring.append(cv.verts.new(G(r * math.cos(a), 1.25 + (r + 0.04 + (0.0 if edge else -0.03)) * math.sin(a), z)))
            rings.append(ring)
        for a, b in zip(rings, rings[1:]):
            for t in range(12):
                q = [a[t], a[t + 1], b[t + 1], b[t]]
                cv.faces.new(q if layer == 0 else list(reversed(q)))
    jitter(cv, 0.01, 4, 5)
    k.add(hp, Matrix.Identity(4), 'wood', DARK, 74, name='wood')
    k.add(cv, Matrix.Identity(4), 'cloth', flat((150, 136, 108), 0.25, 3), 75, name='cloth', smooth=True)
    # Goods: crates, a keg, sacks, bottles hanging from the back hoop.
    gd = new()
    box(gd, (0.25, 0.98, 0.9), (0.45, 0.36, 0.4))
    box(gd, (-0.3, 0.95, 0.95), (0.4, 0.3, 0.35))
    bevel(gd, 0.01)
    k.add(gd, Matrix.Identity(4), 'wood', wood((120, 92, 62), 0.3), 76, name='wood')
    sk = new()
    for i, (x, z) in enumerate(((-0.25, 0.3), (0.25, 0.2), (0.0, -0.4))):
        s = sphere(0.24, (x, 1.0, z), 9, 6, 0.85)
        jitter(s, 0.03, i, 4)
        append(sk, s)
    k.add(sk, Matrix.Identity(4), 'cloth', flat((140, 118, 84), 0.3, 12), 77, name='cloth', smooth=True)
    bt = new()
    for i in range(5):
        x = -0.4 + i * 0.2
        append(bt, tube([(x, 1.92, -1.27), (x, 1.6 - i * 0.03, -1.3)], 0.004, 3))
        append(bt, lathe([(0, 0), (0.035, 0), (0.038, 0.12), (0.015, 0.17), (0.012, 0.22), (0, 0.22)], 8), T(x, 1.35 - i * 0.03, -1.3))
    k.add(bt, Matrix.Identity(4), 'glass', flat((52, 80, 60), 0.4), 78, name='bottles')
    # Lantern pole at the front-right (where the old emissive bulb was).
    pole = new()
    append(pole, tube([(0.55, 1.2, 1.15), (0.55, 2.15, 1.15), (0.55, 2.2, 1.05)], 0.02, 6))
    k.add(pole, Matrix.Identity(4), 'iron', IRONP, 79, name='iron')
    c = lantern(k, (0.55, 1.78, 1.15), 80)
    k.anchor('lantern', *c)
    sign = new()
    box(sign, (0, 1.55, 1.3), (0.9, 0.24, 0.03))
    k.add(sign, Matrix.Identity(4), 'wood', wood((40, 46, 40), 0.25, weather=0.3), 81, name='wood')
    k.collider(0, 0, 0.8, 0.8, 1.35, note='cart body and wheels')


def statue(k):
    """Hooded mourner on a plinth, head bowed, hands clasped; faces +Z (the scare turns it)."""
    pl = new()
    box(pl, (0, 0.06, 0), (0.86, 0.12, 0.86))
    box(pl, (0, 0.3, 0), (0.72, 0.4, 0.72))
    box(pl, (0, 0.53, 0), (0.8, 0.06, 0.8))
    bevel(pl, 0.012)
    jitter(pl, 0.006, 1, 4)
    k.add(pl, Matrix.Identity(4), 'stone', GRAVE_STONE, 91, name='stone')
    fig = lathe([(0, 0.56), (0.34, 0.56), (0.33, 0.7), (0.29, 1.1), (0.24, 1.5), (0.22, 1.7), (0.19, 1.85), (0.0, 1.9)], 14)
    for v in fig.verts:
        v.co.y *= 0.82                                    # flatter front to back
        if v.co.y < 0 and v.co.z > 1.0:                   # Blender -Y = game +Z (front): shoulders forward
            v.co.y -= 0.03
    jitter(fig, 0.012, 2, 3)
    hood = sphere(0.19, (0, 1.93, 0.04), 12, 8)
    for v in hood.verts:
        if v.co.z > 1.9:
            v.co.y += 0.05 * (v.co.z - 1.9) * 6          # peak toward the back
    face = sphere(0.1, (0, 1.86, 0.12), 8, 6)
    arms = new()
    for sx in (-1, 1):
        append(arms, tube([(sx * 0.2, 1.68, 0.02), (sx * 0.17, 1.42, 0.14), (sx * 0.05, 1.36, 0.22)], 0.055, 7))
    hands = sphere(0.075, (0, 1.38, 0.25), 8, 6, 1.2)
    folds = new()
    for i in range(7):
        a = -0.9 + i * 0.3
        append(folds, tube([(0.3 * math.sin(a), 0.6, 0.3 * math.cos(a) * 0.82), (0.22 * math.sin(a), 1.4, 0.24 * math.cos(a) * 0.82)], 0.025, 5))
    allf = merge(fig, hood, arms, hands, folds)
    k.add(allf, Matrix.Identity(4), 'stone', stone((150, 146, 136), moss=0.45, grime_h=1.2, streak=0.6), 92, name='stone', smooth=True)
    k.add(face, Matrix.Identity(4), 'stone', stone((96, 92, 86), 0.1, 0.0), 93, name='face', smooth=True)
    k.collider(0, 0, 0.43, 0.95, 0.43, note='statue')


def scare_door(k):
    """Crypt door that swings shut: hinge at the origin, leaf runs +X (1.0 x 2.1 x 0.08), as in ScareProps.tsx."""
    bm = new()
    for i in range(5):
        box(bm, (0.1 + i * 0.2, 1.05, 0), (0.195, 2.08 - R.uniform(0, 0.03), 0.06))
    for y in (0.35, 1.05, 1.75):
        box(bm, (0.5, y, -0.045), (0.9, 0.13, 0.03))
    k.add(bm, Matrix.Identity(4), 'wood', wood((60, 44, 32), 0.35, weather=0.5), 101, name='wood')
    hw = new()
    for y in (0.35, 1.75):
        box(hw, (0.35, y, 0.035), (0.7, 0.06, 0.01))
        for x in (0.1, 0.3, 0.55):
            append(hw, sphere(0.014, (x, y, 0.042), 5, 3))
        append(hw, cyl(0.025, 0.16, 6, y - 0.08), T(0.0, 0, 0))
    append(hw, lathe([(0.05, -0.008), (0.06, -0.008), (0.06, 0.008), (0.05, 0.008)], 12), T(0.85, 1.0, 0.06) @ RX(math.pi / 2))
    box(hw, (0.85, 1.06, 0.04), (0.06, 0.06, 0.01))
    k.add(hw, Matrix.Identity(4), 'iron', iron(0.6), 102, name='iron')


def candle_stub(k):
    """A thick church candle with wax drips and a puddle (the game keeps its animated flame above, at y 0.3)."""
    c = lathe([(0, 0), (0.05, 0), (0.048, 0.08), (0.045, 0.24), (0.038, 0.252), (0.006, 0.245), (0, 0.25)], 10)
    k.add(c, Matrix.Identity(4), 'wax', WAX, 111, name='wax', smooth=True)
    d = new()
    for i in range(5):
        a = i * 1.3
        h = R.uniform(0.06, 0.16)
        append(d, tube([(0.046 * math.cos(a), 0.245, 0.046 * math.sin(a)), (0.05 * math.cos(a), 0.245 - h, 0.05 * math.sin(a))], 0.01, 5, 0.013))
    append(d, lathe([(0, 0.0), (0.09, 0.0), (0.085, 0.01), (0, 0.012)], 12))
    k.add(d, Matrix.Identity(4), 'wax', flat((214, 200, 160), 0.1), 112, name='wax', smooth=True)
    wk = cyl(0.003, 0.03, 4, 0.245)
    k.add(wk, Matrix.Identity(4), 'stone', const((20, 16, 12)), 113, name='dark')


def grave_hand(k):
    """A dead hand clawing out of the soil (origin at ground level), fingers curled toward +Z."""
    arm = tube([(0, -0.05, 0), (0.01, 0.15, 0.01), (0.03, 0.3, 0.03)], 0.042, 8, 0.036)
    palm = sphere(0.055, (0.035, 0.35, 0.045), 8, 6, 1.1)
    for v in palm.verts:
        v.co.x *= 1.15
        v.co.y *= 0.55
    fingers = new()
    for i, ang in enumerate((-0.5, -0.17, 0.12, 0.42)):
        bx = 0.035 + 0.045 * math.sin(ang)
        pts = [(bx, 0.38, 0.06), (bx + 0.01, 0.45, 0.08), (bx + 0.012, 0.5, 0.12), (bx + 0.01, 0.48, 0.16)]
        append(fingers, tube(pts, 0.011, 5, 0.008))
    append(fingers, tube([(-0.01, 0.35, 0.06), (-0.04, 0.4, 0.1), (-0.045, 0.42, 0.14)], 0.012, 5, 0.009))
    h = merge(arm, palm, fingers)
    jitter(h, 0.003, 1, 20)
    k.add(h, Matrix.Identity(4), 'bone', flat((128, 132, 108), 0.25), 121, name='flesh', smooth=True)
    sl = new()
    for i in range(9):
        a = i * 0.7
        append(sl, sphere(R.uniform(0.05, 0.1), (0.14 * math.cos(a), 0.0, 0.14 * math.sin(a)), 6, 4, 0.6))
    k.add(sl, Matrix.Identity(4), 'earth', EARTH, 122, name='earth', smooth=True)


def woodpile(k):
    """Split logs stacked along Z with a chopping block in front (+X). The axe rests on the block (anchor)."""
    lg = new()
    rows = [5, 4, 3, 2]
    for r, n in enumerate(rows):
        for i in range(n):
            x = (i - (n - 1) / 2) * 0.22 + R.uniform(-0.015, 0.015)
            rad = 0.1 + R.uniform(-0.015, 0.015)
            c = cyl(rad, 0.9, 8)
            for v in c.verts:                                 # split faces: flatten one side of some logs
                if (i + r) % 3 == 0 and v.co.x > rad * 0.3:
                    v.co.x = rad * 0.3
            append(lg, c, T(x, 0.1 + r * 0.185, -0.45) @ RX(math.pi / 2) @ RY(R.uniform(0, 6)))
    k.add(lg, Matrix.Identity(4), 'wood', wood((100, 74, 50), 0.35, weather=0.4), 131, name='bark')
    ends = new()
    for r, n in enumerate(rows):
        for i in range(n):
            x = (i - (n - 1) / 2) * 0.22
            for zz in (0.452, -0.452):
                append(ends, lathe([(0, 0), (0.095, 0), (0.0, 0.004)], 8), T(x, 0.1 + r * 0.185, zz) @ RX(math.pi / 2 if zz > 0 else -math.pi / 2))
    k.add(ends, Matrix.Identity(4), 'wood', flat((176, 140, 96), 0.2), 132, name='ends')
    blk = lathe([(0, 0), (0.24, 0), (0.25, 0.1), (0.24, 0.42), (0.23, 0.45), (0, 0.45)], 12)
    k.add(blk, T(0.75, 0, 0.1), 'wood', wood((96, 70, 46), 0.4, weather=0.3), 133, name='bark', smooth=True)
    top = lathe([(0, 0.45), (0.23, 0.45), (0.22, 0.455), (0, 0.456)], 12)
    k.add(top, T(0.75, 0, 0.1), 'wood', flat((160, 126, 86), 0.25), 134, name='ends')
    k.collider(0, 0, 0.6, 0.38, 0.47, note='log stack')
    k.collider(0.75, 0.1, 0.25, 0.23, 0.25, note='chopping block')
    k.anchor('axe-rest', 0.75, 0.456, 0.1, note='seat the wood axe here, blade in the block')


def lodge_table(k):
    """Gatekeeper's lodge table for the shotgun: top surface 0.8, 1.0 x 0.4 (as WeaponPickups' Shelf)."""
    W, D, TOP = 1.0, 0.45, 0.8
    bm = new()
    box(bm, (0, TOP - 0.025, 0), (W, 0.05, D))
    for sx in (-1, 1):
        for sz in (-1, 1):
            box(bm, (sx * (W / 2 - 0.05), (TOP - 0.05) / 2, sz * (D / 2 - 0.05)), (0.05, TOP - 0.05, 0.05))
    box(bm, (0, 0.2, 0), (W - 0.1, 0.03, D - 0.1))
    box(bm, (0, TOP - 0.1, D / 2 - 0.04), (W - 0.1, 0.08, 0.025))
    bevel(bm, 0.005)
    k.add(bm, Matrix.Identity(4), 'wood', GREY, 141, name='wood')
    sh = new()
    for i in range(6):
        append(sh, cyl(0.011, 0.065, 6), T(-0.35 + i * 0.03, 0.23, -0.05) @ RX(math.pi / 2))
    box(sh, (0.3, 0.26, 0.0), (0.18, 0.06, 0.12))
    k.add(sh, Matrix.Identity(4), 'brass', BRASS, 142, name='brass')
    k.collider(0, 0, W / 2, TOP / 2, D / 2, note='table')
    k.anchor('top-surface', 0, TOP, 0, surfaceY=TOP)


def sabre_plinth(k):
    """Stone tomb chest for the silver sabre: top surface 0.3 above the origin, 0.9 x 0.5."""
    bm = new()
    box(bm, (0, 0.03, 0), (1.0, 0.06, 0.6))
    box(bm, (0, 0.16, 0), (0.86, 0.2, 0.46))
    box(bm, (0, 0.28, 0), (0.94, 0.04, 0.54))
    bevel(bm, 0.01)
    jitter(bm, 0.004, 2, 5)
    k.add(bm, Matrix.Identity(4), 'stone', GRAVE_STONE, 151, name='stone')
    cr = new()
    box(cr, (0, 0.16, 0.235), (0.04, 0.14, 0.01))
    box(cr, (0, 0.19, 0.235), (0.11, 0.035, 0.01))
    k.add(cr, Matrix.Identity(4), 'stone', const((40, 36, 32)), 152, name='dark')
    k.collider(0, 0, 0.5, 0.15, 0.3, note='plinth')
    k.anchor('top-surface', 0, 0.3, 0, surfaceY=0.3)


def ossuary_door(k):
    """Iron-banded oak door across the catacombs, 2.5 x 2.2 x 0.2, origin bottom centre (lifts as one piece)."""
    W, H, D = 2.5, 2.2, 0.2
    bm = new()
    n = 10
    for i in range(n):
        box(bm, (-W / 2 + W / n * (i + 0.5), H / 2, 0), (W / n - 0.008, H - R.uniform(0, 0.02), D * 0.7))
    k.add(bm, Matrix.Identity(4), 'wood', wood((56, 40, 30), 0.35), 161, name='wood')
    ir = new()
    for y in (0.3, 1.0, 1.75):
        box(ir, (0, y, -D * 0.35 - 0.01), (W, 0.12, 0.02))
        for x in [(-W / 2 + 0.1 + i * 0.25) for i in range(10)]:
            append(ir, sphere(0.022, (x, y, -D * 0.35 - 0.025), 6, 3))
    # Grille window with bars, and a big ring pull.
    box(ir, (0, 1.55, -D * 0.35 - 0.012), (0.5, 0.36, 0.02))
    for x in (-0.15, -0.05, 0.05, 0.15):
        append(ir, tube([(x, 1.4, -D * 0.35 - 0.04), (x, 1.7, -D * 0.35 - 0.04)], 0.012, 5))
    append(ir, lathe([(0.09, -0.012), (0.105, -0.012), (0.105, 0.012), (0.09, 0.012)], 14), T(0.6, 0.95, -D * 0.35 - 0.05) @ RX(math.pi / 2))
    k.add(ir, Matrix.Identity(4), 'iron', iron(0.5, (34, 32, 30)), 162, name='iron')
    gr = new()
    box(gr, (0, 1.55, -D * 0.35 - 0.005), (0.42, 0.28, 0.005))
    k.add(gr, Matrix.Identity(4), 'stone', const((10, 8, 7)), 163, name='dark')
    # Bone motif: a skull and crossed bones nailed to the middle band.
    bn, dk = new(), new()
    skull(bn, dk, (0, 1.06, -D * 0.35 - 0.04), yaw=math.pi, s=1.1, tilt=0.0)
    for s in (-1, 1):
        append(bn, tube([(-0.2 * s, 0.86, -D * 0.35 - 0.04), (0.2 * s, 1.2, -D * 0.35 - 0.04)], 0.016, 5))
    k.add(bn, Matrix.Identity(4), 'bone', BONEP, 164, name='bone', smooth=True)
    k.add(dk, Matrix.Identity(4), 'stone', const((18, 15, 12)), 165, name='dark')


# --- clue props (one per clue id) ----------------------------------------------------------------------------------
def clue_boots(k):
    """Elias's boots by the cot, muddy, one fallen over."""
    for i, (x, z, rot, lie) in enumerate(((-0.08, 0.0, 0.2, False), (0.12, 0.08, -0.5, True))):
        b = new()
        append(b, lathe([(0, 0), (0.05, 0), (0.055, 0.2), (0.05, 0.3), (0, 0.3)], 8), T(0, 0, -0.05))
        foot = sphere(0.06, (0, 0.04, 0.07), 8, 5)
        for v in foot.verts:
            v.co.y *= 2.0                                   # Blender -Y (game +Z) = toe
            v.co.z = max(v.co.z, 0.0)
        append(b, foot)
        box(b, (0, 0.01, 0.03), (0.1, 0.02, 0.27))
        M = T(x, 0.06 if lie else 0, z) @ RY(rot) @ (RX(-math.pi / 2) @ T(0, 0, 0) if lie else Matrix.Identity(4))
        k.add(b, M, 'cloth', flat((40, 30, 24), 0.25), 171 + i, name='leather', smooth=True)
        m = new()
        box(m, (0, 0.03, 0.04), (0.11, 0.06, 0.28))
        k.add(m, M, 'earth', earth((70, 52, 34)), 173 + i, name='mud')
    pr = new()
    for i in range(4):
        box(pr, (0.25 + i * 0.12, 0.002, 0.3 + i * 0.25), (0.08, 0.004, 0.18))
    k.add(pr, Matrix.Identity(4), 'earth', earth((60, 44, 30)), 175, name='mud')


def clue_turned_earth(k):
    """Freshly turned earth on an old grave, spade marks, a dropped lantern wick-tin."""
    bm = new()
    for i in range(16):
        append(bm, sphere(R.uniform(0.08, 0.18), (R.uniform(-0.45, 0.45), 0.0, R.uniform(-0.7, 0.7)), 7, 4, 0.4))
    k.add(bm, Matrix.Identity(4), 'earth', earth((56, 40, 26)), 181, name='earth', smooth=True)
    cut = new()
    for i in range(3):
        box(cut, (R.uniform(-0.3, 0.3), 0.03, R.uniform(-0.5, 0.5)), (0.22, 0.01, 0.03), M=None)
    k.add(cut, Matrix.Identity(4), 'stone', const((18, 13, 9)), 182, name='dark')


def clue_notice(k):
    """Burial notice nailed to a post (the 'parchment' prop at the chapel path)."""
    p = new()
    box(p, (0, 0.75, 0), (0.1, 1.5, 0.1))
    box(p, (0, 1.12, 0.07), (0.5, 0.6, 0.03))
    bevel(p, 0.008)
    k.add(p, Matrix.Identity(4), 'wood', GREY, 191, name='wood')
    pa = new()
    box(pa, (0.0, 1.12, 0.09), (0.34, 0.44, 0.004))
    box(pa, (0.12, 1.24, 0.092), (0.12, 0.16, 0.004))
    k.add(pa, T(0, 0, 0) @ RZ(0.03), 'paper', PAPER, 192, name='paper')
    ink = new()
    for i in range(6):
        box(ink, (-0.04, 1.28 - i * 0.05, 0.094), (0.22 - (i % 2) * 0.06, 0.008, 0.002))
    k.add(ink, T(0, 0, 0) @ RZ(0.03), 'stone', const((40, 30, 24)), 193, name='dark')
    nl = new()
    for x, y in ((-0.15, 1.32), (0.15, 1.32), (0.0, 0.92)):
        append(nl, sphere(0.01, (x, y, 0.095), 5, 3))
    k.add(nl, Matrix.Identity(4), 'iron', iron(0.7), 194, name='iron')
    k.collider(0, 0, 0.06, 0.75, 0.06, note='post')


def clue_sealed_entry(k):
    """A ledger page sealed in red wax, on a fallen stone in the catacombs."""
    s = new()
    box(s, (0, 0.2, 0), (0.6, 0.4, 0.45))
    bevel(s, 0.03)
    jitter(s, 0.02, 3, 4)
    k.add(s, Matrix.Identity(4), 'stone', stone((106, 100, 92), 0.1, 0.4), 201, name='stone')
    pa = new()
    box(pa, (0, 0.403, 0), (0.26, 0.004, 0.34))
    k.add(pa, T(0, 0, 0) @ RY(0.2), 'paper', PAPER, 202, name='paper')
    wx_ = lathe([(0, 0.405), (0.03, 0.405), (0.028, 0.413), (0, 0.415)], 10)
    k.add(wx_, T(0.02, 0, 0.08), 'wax', flat((140, 20, 18), 0.2), 203, name='seal')
    k.collider(0, 0, 0.3, 0.2, 0.23, note='stone')


def clue_coat(k):
    """The keeper's coat in a heap at the crypt, his lantern on its side beside it."""
    c = new()
    for i in range(6):
        s = sphere(R.uniform(0.22, 0.34), (R.uniform(-0.5, 0.5), 0.03, R.uniform(-0.2, 0.2)), 10, 6, 0.32)
        jitter(s, 0.03, i, 4)
        append(c, s)
    sl = tube([(-0.2, 0.06, 0.15), (-0.5, 0.05, 0.35), (-0.75, 0.04, 0.3)], 0.07, 7)
    append(c, sl)
    k.add(c, Matrix.Identity(4), 'cloth', flat((54, 50, 34), 0.3, 4), 211, name='cloth', smooth=True)
    lt = Kit()
    lantern(k, (0.55, 0.0, 0.15), 212, 0.9)
    bt = new()
    for i in range(4):
        box(bt, (0.2 - i * 0.12, 0.13, 0.0), (0.03, 0.03, 0.03))
    k.add(bt, Matrix.Identity(4), 'brass', BRASS, 214, name='brass')


def clue_scratches(k):
    """Deep gouges in a wall slab (faces +X; set against the catacomb's west wall)."""
    s = new()
    box(s, (0.02, 1.0, 0), (0.04, 1.2, 0.9))
    k.add(s, Matrix.Identity(4), 'stone', stone((112, 106, 96), 0.05, 0.6), 221, name='stone')
    g = new()
    for i in range(4):
        z = -0.25 + i * 0.13
        bmesh.ops.create_cube(g, size=1.0, matrix=T(0.042, 1.1, z) @ RX(0.25 + i * 0.05) @ S(0.006, 0.55, 0.02))
    for i in range(3):
        z = 0.15 + i * 0.1
        bmesh.ops.create_cube(g, size=1.0, matrix=T(0.042, 0.8, z) @ RX(-0.4) @ S(0.006, 0.35, 0.015))
    k.add(g, Matrix.Identity(4), 'stone', const((24, 20, 18)), 222, name='dark')
    nail = new()
    append(nail, sphere(0.012, (0.06, 0.62, -0.1), 5, 3))
    k.add(nail, Matrix.Identity(4), 'bone', flat((210, 196, 168)), 223, name='bone')


def clue_names_in_bone(k):
    """A tablet of names set into the bone wall (faces -X; set against the east bone wall)."""
    t = new()
    box(t, (-0.03, 1.05, 0), (0.06, 0.5, 0.7))
    k.add(t, Matrix.Identity(4), 'stone', stone((150, 144, 130), 0.05, 0.0, streak=0.3), 231, name='stone')
    ln = new()
    for i in range(6):
        box(ln, (-0.062, 1.24 - i * 0.07, 0), (0.004, 0.02, 0.5 - (i % 3) * 0.08))
    k.add(ln, Matrix.Identity(4), 'stone', const((30, 26, 22)), 232, name='dark')
    bn, dk = new(), new()
    skull(bn, dk, (-0.1, 0.72, 0.0), yaw=-math.pi / 2)
    k.add(bn, Matrix.Identity(4), 'bone', BONEP, 233, name='bone', smooth=True)
    k.add(dk, Matrix.Identity(4), 'stone', const((18, 15, 12)), 234, name='dark')


def clue_statue_plinth(k):
    """An empty statue plinth in Mausoleum Row: only the feet are left, the rest dragged away."""
    p = new()
    box(p, (0, 0.06, 0), (0.86, 0.12, 0.86))
    box(p, (0, 0.3, 0), (0.72, 0.4, 0.72))
    box(p, (0, 0.53, 0), (0.8, 0.06, 0.8))
    bevel(p, 0.012)
    k.add(p, Matrix.Identity(4), 'stone', GRAVE_STONE, 241, name='stone')
    f = new()
    for sx in (-1, 1):
        box(f, (sx * 0.1, 0.62, 0.05), (0.12, 0.12, 0.24))
    jitter(f, 0.015, 3, 8)
    k.add(f, Matrix.Identity(4), 'stone', stone((150, 146, 136), 0.4, 0.0), 242, name='stone')
    dr = new()
    for i in range(5):
        box(dr, (0.05 * i - 0.1, 0.003, 0.7 + i * 0.35), (0.06, 0.005, 0.3))
    k.add(dr, Matrix.Identity(4), 'stone', const((40, 34, 28)), 243, name='dark')
    k.collider(0, 0, 0.43, 0.3, 0.43, note='plinth')


def clue_west_hill(k):
    """A broken wooden bench on the west slope, facing the hill (+Z)."""
    b = new()
    for i in range(3):
        box(b, (0, 0.45, -0.08 + i * 0.12), (1.4, 0.04, 0.1))
    for sx in (-1, 1):
        box(b, (sx * 0.6, 0.22, 0.04), (0.08, 0.44, 0.34))
    box(b, (0, 0.75, -0.2), (1.4, 0.12, 0.04))
    for v in b.verts:
        if v.co.x > 0.2:
            v.co.z -= (v.co.x - 0.2) * 0.25
    k.add(b, Matrix.Identity(4), 'wood', GREY, 251, name='wood')
    k.collider(0, 0, 0.7, 0.4, 0.2, note='bench')


def vending_machine(k):
    """1891 coin-op 'automatic' cabinet for the hut: cast-iron case, glass front showing the goods, brass slot and
    five pull handles (one per stock row). Faces +Z; 0.72 wide, 0.46 deep, 1.92 high. Place against the hut's east wall
    at (2.83, 0, 1.85) with rotationY -PI/2. The game lights its marquee glass (anchor) and drives the handles."""
    W, D, Hh = 0.72, 0.46, 1.92
    case = new()
    box(case, (0, 0.06, 0), (W + 0.06, 0.12, D + 0.06))
    box(case, (0, 0.95, -0.02), (W, 1.66, D - 0.04))
    for sx in (-1, 1):
        box(case, (sx * (W / 2 - 0.02), 0.95, D / 2 - 0.04), (0.06, 1.66, 0.06))
        append(case, lathe([(0, 0), (0.035, 0), (0.035, 0.04), (0.02, 0.07), (0.03, 0.1), (0, 0.12)], 8), T(sx * (W / 2 - 0.02), 1.78, D / 2 - 0.04))
    box(case, (0, 1.82, 0), (W + 0.08, 0.06, D + 0.04))
    ped = prism([(-W / 2 - 0.04, 0), (W / 2 + 0.04, 0), (W / 2 - 0.05, 0.08), (0.0, 0.12), (-W / 2 + 0.05, 0.08)], 0.06)
    append(case, ped, T(0, 1.85, D / 2 - 0.02))
    bevel(case, 0.006)
    k.add(case, Matrix.Identity(4), 'iron', iron(0.25, (36, 44, 40)), 261, name='case')
    br = new()
    box(br, (0, 1.62, D / 2), (W - 0.12, 0.2, 0.02))
    box(br, (0.22, 0.98, D / 2), (0.12, 0.2, 0.02))
    box(br, (0.22, 1.0, D / 2 + 0.012), (0.012, 0.06, 0.004))
    append(br, lathe([(0, 0), (0.05, 0), (0.055, 0.05), (0.05, 0.06)], 10, cap=False), T(0.22, 0.6, D / 2 + 0.03))
    for i in range(5):
        x = -0.24 + i * 0.1
        append(br, tube([(x, 0.78, D / 2), (x, 0.78, D / 2 + 0.06)], 0.008, 5))
        append(br, lathe([(0, 0), (0.016, 0), (0.016, 0.03), (0, 0.03)], 8), T(x, 0.78, D / 2 + 0.06) @ RX(math.pi / 2))
    box(br, (0, 0.3, D / 2), (0.3, 0.08, 0.01))
    k.add(br, Matrix.Identity(4), 'brass', flat((168, 128, 58), 0.2), 262, name='brass')
    gl = new()
    for x in (-0.15, 0.0, 0.15):
        box(gl, (x, 1.22, D / 2 - 0.02), (0.012, 0.5, 0.012))
    box(gl, (0, 1.22, D / 2 - 0.02), (W - 0.16, 0.012, 0.012))
    k.add(gl, Matrix.Identity(4), 'brass', flat((168, 128, 58), 0.2), 263, name='brass')
    gd = new()
    for row in range(5):
        x = -0.24 + row * 0.1
        for j in range(3):
            append(gd, cyl(0.025, 0.09, 6), T(x, 1.02 + j * 0.15, D / 2 - 0.12))
    k.add(gd, Matrix.Identity(4), 'brass', flat((120, 110, 90), 0.5, 20), 264, name='goods')
    shelf = new()
    for j in range(3):
        box(shelf, (0, 1.0 + j * 0.15, D / 2 - 0.12), (W - 0.18, 0.012, 0.16))
    k.add(shelf, Matrix.Identity(4), 'wood', DARK, 265, name='case')
    mq = new()
    box(mq, (0, 1.62, D / 2 + 0.012), (W - 0.18, 0.15, 0.004))
    k.add(mq, Matrix.Identity(4), 'glass', glass_amber, 266, name='marquee')
    k.anchor('marquee-light', 0, 1.62, D / 2 + 0.15, note='small warm light; the marquee mesh is emissive')
    k.anchor('coin-slot', 0.22, 1.0, D / 2 + 0.02)
    k.anchor('tray', 0.22, 0.62, D / 2 + 0.05, note='bought goods drop here')
    for i in range(5):
        k.anchor(f'handle-{i}', -0.24 + i * 0.1, 0.78, D / 2 + 0.06, note='pull along +Z by 0.05 on purchase')
    k.collider(0, 0, W / 2 + 0.03, Hh / 2, D / 2 + 0.03, note='machine')


def bat_body(k, wings_open):
    """Shared bat: body, ears, feet; the head is its own mesh pivoting at the neck so it can turn to watch the player."""
    BODY = flat((32, 26, 24), 0.25, 9)
    MEMB = flat((44, 32, 30), 0.3, 4)
    b = sphere(0.045, (0, 0.1, 0), 8, 6, 1.5)
    k.add(b, Matrix.Identity(4), 'cloth', BODY, 271, name='body', smooth=True)
    neck = (0, 0.17, 0.005)
    h = sphere(0.032, (0, 0.18, 0.012), 8, 6)
    sn = sphere(0.014, (0, 0.175, 0.04), 6, 4)
    ears = new()
    for sx in (-1, 1):
        append(ears, prism([(0, 0), (0.02, 0.0), (0.006, 0.05)], 0.006), T(sx * 0.016, 0.2, 0.0) @ RZ(-sx * 0.35))
    k.add(merge(h, sn, ears), Matrix.Identity(4), 'cloth', BODY, 272, name='head', smooth=True, origin=neck)
    eyes = new()
    for sx in (-1, 1):
        append(eyes, sphere(0.0065, (sx * 0.013, 0.188, 0.038), 6, 4))
    k.add(eyes, Matrix.Identity(4), 'ember', const((255, 70, 30)), 273, name='eyes', origin=neck)
    k.anchor('neck', *neck, note='turn meshes "head" and "eyes" about Y toward the player')
    if wings_open:
        for sx, nm in ((-1, 'wing-left'), (1, 'wing-right')):
            sh = (sx * 0.035, 0.13, 0.0)
            pts = [(0, 0), (0.07, 0.03), (0.16, 0.05), (0.22, 0.0), (0.19, -0.03), (0.15, -0.015), (0.12, -0.05), (0.08, -0.02), (0.05, -0.06), (0.0, -0.04)]
            if sx < 0:
                pts = [(-x, y) for x, y in reversed(pts)]
            wbm = prism(pts, 0.004)
            bones_ = new()
            for (x, y) in ((0.16, 0.05), (0.22, 0.0), (0.12, -0.05), (0.05, -0.06)):
                append(bones_, tube([(0, 0, 0), (sx * x, y, 0)], 0.003, 4))
            M = T(*sh) @ RX(math.pi / 2)
            k.add(wbm, M, 'cloth', MEMB, 274, name=nm, origin=sh)
            k.add(bones_, M, 'cloth', BODY, 275, name=nm, origin=sh)
            k.anchor(nm + '-pivot', *sh, note='flap about Z')
    else:
        fw = new()
        for sx in (-1, 1):
            w = sphere(0.04, (sx * 0.035, 0.09, 0.0), 6, 5, 1.8)
            for v in w.verts:
                v.co.x *= 0.5
            append(fw, w)
        k.add(fw, Matrix.Identity(4), 'cloth', MEMB, 276, name='body', smooth=True)
        ft = new()
        for sx in (-1, 1):
            append(ft, tube([(sx * 0.015, 0.04, 0.0), (sx * 0.02, 0.0, 0.015)], 0.004, 4))
        k.add(ft, Matrix.Identity(4), 'cloth', BODY, 277, name='body')


def bat_perched(k):
    """Bat sitting upright on a headstone top (origin = its feet), wings folded, eyes faintly lit. Faces +Z."""
    bat_body(k, False)


def bat_flying(k):
    """Bat with wings spread (separate wing meshes pivoting at the shoulders for the flap). Faces +Z."""
    bat_body(k, True)


PROPS = {
    'workbench': workbench, 'lamp-post': lamp_post, 'coffin-broken': coffin_broken,
    'gate-catacombs': gate_catacombs, 'gate-mausoleum-row': gate_mausoleum, 'iron-railing': iron_railing,
    'grave-mound': grave_mound, 'grave-dug': grave_dug, 'merchant-cart': merchant_cart, 'statue-mourner': statue,
    'scare-door': scare_door, 'candle-stub': candle_stub, 'grave-hand': grave_hand, 'woodpile': woodpile,
    'lodge-table': lodge_table, 'sabre-plinth': sabre_plinth, 'ossuary-door': ossuary_door,
    'clue-hut-boots': clue_boots, 'clue-empty-graves': clue_turned_earth, 'clue-ledger-week': clue_notice,
    'clue-cat-ledger-seal': clue_sealed_entry, 'clue-elias-body': clue_coat, 'clue-cat-scratches': clue_scratches,
    'clue-cat-names': clue_names_in_bone, 'clue-row-statues': clue_statue_plinth, 'clue-west-hill-glint': clue_west_hill,
    'vending-machine': vending_machine, 'bat-perched': bat_perched, 'bat-flying': bat_flying,
}


def main():
    clear_scene()
    stats = {}
    placed = []
    for i, (name, fn) in enumerate(PROPS.items()):
        if ONLY and name not in ONLY:
            continue
        k = Kit()
        fn(k)
        coll = make_objects(k, name)
        size = export(coll, os.path.join(OUT, f'{name}.glb'), None, k)
        stats[name] = {'tris': k.tris(), 'kb': round(size / 1024)}
        placed.append((name, coll))
    # Contact sheets: lay the props out in rows and photograph them.
    preview_setup(world=(0.07, 0.08, 0.095), strength=1.2)
    light('SUN', (0, 10, 0), 2.6, (0.85, 0.88, 0.95), rot=(math.radians(50), 0, math.radians(-35)))
    light('SUN', (0, 10, 0), 0.8, (1.0, 0.8, 0.6), rot=(math.radians(60), 0, math.radians(140)))
    groups = [placed[i:i + 6] for i in range(0, len(placed), 6)]
    for gi, group in enumerate(groups):
        for ob in bpy.context.scene.objects:
            if ob.type == 'MESH' and ob.name != 'ground':
                ob.hide_render = True
        x = 0.0
        for name, coll in group:
            span = 5.0 if name in ('gate-mausoleum-row', 'merchant-cart', 'gate-catacombs', 'ossuary-door') else 2.4
            for ob in coll.objects:
                ob.hide_render = False
                ob.location = ob.location + G(x + span / 2, 0, 0)
            x += span
        if 'ground' not in bpy.data.objects:
            ground(80, (52, 58, 44), c=(20, 0))
        width = x
        sclib.shoot(PREVIEW, {f'props-{gi + 1}': ((width / 2, 3.2 + width * 0.12, 6.5 + width * 0.55), (width / 2, 0.7, 0), 30)})
        for name, coll in group:
            for ob in coll.objects:
                ob.location = ob.location - G(0, 0, 0)
                ob.location.y += 0  # leave in place; hidden next round
    print('PROPS_STATS ' + json.dumps(stats))


main()
