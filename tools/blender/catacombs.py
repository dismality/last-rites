"""The catacombs for Last Rites: entrance portal in an earth mound, rubble walls with burial niches, bone walls,
vault ribs, flagstones, ledges, a bier and the reliquary altar.

  blender -b --factory-startup --python tools/blender/catacombs.py -- OUT_GLB PREVIEW_DIR

WORLD game coordinates (mount with no transform). Matches CATACOMBS in cemeteryLayout.ts: centre x 25, entrance
z 40 (gate at z 40.2), runs +Z for 20 m, 2.5 m wide, 2.2 m high, walls 0.4 thick (inner faces x 23.75 / 26.25),
ossuary door at z 55.6 (props/ossuary-door.glb). The game keeps its floor, wall, ceiling and end-wall colliders;
this replaces the Kenney brick panels and the plain boxes. Niches are cut into the wall's thickness behind the
collider plane, so nothing can walk into them.

Surfaces for the pickups that float today (see the JSON 'surfaces'): three wall ledges at y 0.95, a stone bier
(top 0.78) for the shroud and page 4, and the reliquary altar (top 0.78) for the heart at (25, 0.8, 58).
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sclib import *  # noqa
import bpy

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT, PREVIEW = ARGV[0], ARGV[1]

CX, Z0, Z1 = 25.0, 40.2, 60.0
IN, HT, WTH = 1.25, 2.2, 0.4
DOOR_Z = 55.6
BONE_Z = (46.0, 52.0)
LEDGES = [(-1, 45.0), (1, 50.0), (-1, 54.9)]
LEDGE_Y = 0.95
BIER = dict(x0=CX - IN + 0.05, x1=CX - IN + 0.9, z0=52.2, z1=54.0, top=0.78)
ALTAR = dict(z=58.0, top=0.78, w=1.1, d=0.7)
RIB_Z = [41.5, 44.0, 46.0, 52.0, 55.6, 58.0]
CLUES = [(-1, 43.5), (1, 47.0), (1, 42.0)]          # scratch marks, names in bone, sealed entry: keep the wall plain here

kit = Kit()
bone_paint = bone()          # the toolkit's bone painter, before bone() is redefined below
RUBBLE = [(98, 92, 84), (84, 80, 74), (110, 102, 90), (76, 72, 68), (92, 88, 80)]
MORTAR = stone((40, 37, 34), moss=0.1, grime_h=0.3)


def wx(side, d):
    return CX + side * (IN + d)


# ------------------------------------------------------------------ walls and niches -----------------------------------
def niche_plan(side):
    """(z0, z1, y0, y1, kind) loculi for one wall, avoiding bone walls, ledges, clues, ribs and the door."""
    out = []
    spans = [(Z0 + 0.4, BONE_Z[0] - 0.2), (DOOR_Z + 0.25, Z1 - 0.3)] if side < 0 else [(Z0 + 0.4, BONE_Z[0] - 0.2), (BONE_Z[1] + 0.3, DOOR_Z - 0.2), (DOOR_Z + 0.25, Z1 - 0.3)]
    for a, b in spans:
        z = a
        while z + 1.5 <= b:
            z0, z1 = z, z + 1.45
            blocked = any(abs(rz - (z0 + z1) / 2) < 0.95 for rz in RIB_Z) and False
            near_clue = any(s == side and z0 - 0.4 < cz < z1 + 0.4 for s, cz in CLUES)
            near_ledge = any(s == side and z0 - 0.7 < lz < z1 + 0.7 for s, lz in LEDGES)
            for y0, y1 in ((0.22, 0.66), (1.12, 1.56)):
                if near_ledge and y0 > 1.0:
                    continue
                if near_clue and y0 < 1.0:
                    continue
                if not blocked:
                    out.append((z0, z1, y0, y1, R.choice(['sealed', 'sealed', 'bones', 'shroud', 'broken', 'empty'])))
            z += 1.75
    return out


def rubble_wall(side, holes):
    bms = [new() for _ in RUBBLE]
    back = new()
    box(back, (wx(side, 0.34), HT / 2, (Z0 + Z1) / 2), (0.08, HT, Z1 - Z0))
    kit.add(back, Matrix.Identity(4), 'stone', MORTAR, 1 + side, name='walls')
    y = 0.0
    row = 0
    while y < HT - 0.01:
        h = min(R.uniform(0.17, 0.3), HT - y)
        z = Z0 - (R.uniform(0.0, 0.25) if row % 2 else 0.0)
        while z < Z1:
            L = R.uniform(0.22, 0.55)
            a, b = max(z, Z0), min(z + L, Z1)
            z += L
            if b - a < 0.06:
                continue
            pieces = [(a, b)]
            for z0, z1, y0, y1 in holes:
                if y + h <= y0 or y >= y1:
                    continue
                nxt = []
                for p0, p1 in pieces:
                    if z1 <= p0 or z0 >= p1:
                        nxt.append((p0, p1))
                        continue
                    if z0 > p0:
                        nxt.append((p0, z0))
                    if z1 < p1:
                        nxt.append((z1, p1))
                pieces = nxt
            for p0, p1 in pieces:
                if p1 - p0 < 0.05:
                    continue
                proud = R.uniform(-0.015, 0.03)
                d0, d1 = -proud, 0.3
                box(bms[R.randrange(len(RUBBLE))], (wx(side, (d0 + d1) / 2), y + h / 2, (p0 + p1) / 2),
                    (d1 - d0, h - 0.018, p1 - p0 - 0.018))
        y += h
        row += 1
    for i, bm in enumerate(bms):
        bevel(bm, 0.02)
        jitter(bm, 0.018, side * 10 + i, 3.5)
        kit.add(bm, Matrix.Identity(4), 'stone', stone(RUBBLE[i], moss=0.12, grime_h=0.9, streak=0.5, var=0.3), side * 10 + i, name='walls')


def skull(bm_bone, bm_dark, pos, yaw=0.0, s=1.0, tilt=0.0):
    x, y, z = pos
    M = T(x, y, z) @ RY(yaw) @ RX(tilt)
    cr = sphere(0.085 * s, (0, 0.085 * s, -0.01 * s), 8, 5, 1.0)
    for v in cr.verts:
        v.co.y *= 1.18                      # longer front to back (Blender -Y is game +Z)
    append(bm_bone, cr, M)
    face = new()
    box(face, (0, 0.045 * s, 0.07 * s), (0.11 * s, 0.07 * s, 0.06 * s))
    box(face, (0, 0.012 * s, 0.065 * s), (0.08 * s, 0.03 * s, 0.05 * s))      # jaw
    append(bm_bone, face, M)
    for ex in (-0.028, 0.028):
        append(bm_dark, sphere(0.021 * s, (ex * s, 0.09 * s, 0.093 * s), 5, 3), M)
    box(bm_dark, (0, 0.06 * s, 0.1 * s), (0.02 * s, 0.025 * s, 0.01 * s), M=M)


def bone(bm, a, b, r=0.022):
    append(bm, tube([a, b], r, 5))
    for p in (a, b):
        append(bm, sphere(r * 1.7, p, 6, 4))


def niches(side, plan):
    seal, bonebm, dark, cloth = new(), new(), new(), new()
    for z0, z1, y0, y1, kind in plan:
        zc, yc = (z0 + z1) / 2, (y0 + y1) / 2
        if kind in ('sealed', 'broken'):
            if kind == 'sealed':
                box(seal, (wx(side, 0.02), yc, zc), (0.05, y1 - y0 + 0.04, z1 - z0 + 0.04))
            else:
                # Half the slab gone: the rest leans in the opening, pieces on the niche floor.
                box(seal, (wx(side, 0.05), yc - 0.05, z0 + (z1 - z0) * 0.3), (0.05, y1 - y0 - 0.08, (z1 - z0) * 0.55),
                    M=None)
                for k in range(3):
                    box(seal, (wx(side, 0.15), y0 + 0.03, z0 + (z1 - z0) * (0.6 + 0.12 * k)), (0.12, 0.04, 0.16))
                skull(bonebm, dark, (wx(side, 0.18), y0, z1 - 0.3), yaw=-side * math.pi / 2, s=0.95)
            # Incised cross and name-plate grooves.
            box(dark, (wx(side, -0.005), yc + 0.08, zc - 0.45), (0.01, 0.16, 0.025))
            box(dark, (wx(side, -0.005), yc + 0.11, zc - 0.45), (0.01, 0.025, 0.1))
            for k in range(2):
                box(dark, (wx(side, -0.005), yc + 0.06 - k * 0.07, zc + 0.15), (0.01, 0.012, 0.5 - k * 0.15))
        elif kind == 'bones':
            skull(bonebm, dark, (wx(side, 0.15), y0, z0 + 0.25), yaw=-side * math.pi / 2 + R.uniform(-0.5, 0.5))
            for k in range(5):
                za = z0 + 0.45 + k * 0.17
                bone(bonebm, (wx(side, 0.1 + R.uniform(0, 0.12)), y0 + 0.03, za), (wx(side, 0.12 + R.uniform(0, 0.1)), y0 + 0.03, za + 0.38))
        elif kind == 'shroud':
            b = sphere(0.5, (wx(side, 0.16), y0 + 0.09, zc), 12, 6, 0.2)
            for v in b.verts:
                v.co.x *= 0.24 / 0.5
                v.co.y *= 1.35
            jitter(b, 0.02, zc, 4)
            append(cloth, b)
            skull(bonebm, dark, (wx(side, 0.16), y0 + 0.06, z1 - 0.2), yaw=-side * math.pi / 2, s=0.9, tilt=-0.3)
        # Dust on every niche floor.
        box(dark, (wx(side, 0.16), y0 + 0.004, zc), (0.26, 0.008, z1 - z0 - 0.04))
    kit.add(seal, Matrix.Identity(4), 'stone', stone((112, 106, 96), moss=0.1, grime_h=0.9, streak=0.55), 31 + side, name='slabs')
    kit.add(bonebm, Matrix.Identity(4), 'bone', bone_paint, 32 + side, name='bones', smooth=True)
    kit.add(dark, Matrix.Identity(4), 'stone', const((22, 19, 17)), 33 + side, name='dark')
    kit.add(cloth, Matrix.Identity(4), 'cloth', flat((150, 140, 116), 0.3, 6), 34 + side, name='cloth', smooth=True)




def bone_walls():
    ends, skulls, dark = new(), new(), new()
    # Only the visible end of each bone: a knobbed stub with no back cap (it disappears into the packing).
    end = lathe([(0.03, -0.07), (0.042, 0.0), (0.0, 0.026)], 4, start=math.pi / 4, cap=False)
    me = bpy.data.meshes.new('end')
    end.to_mesh(me)
    end.free()
    pattern = ['f', 'f', 'f', 'f', 's', 'f', 'f', 'f', 'f', 's', 'f', 'f', 'f', 'f']
    for side in (-1, 1):
        y = 0.12
        for kind in pattern:
            if kind == 'f':
                z = BONE_Z[0] + 0.05 + R.uniform(0, 0.03)
                while z < BONE_Z[1] - 0.05:
                    tmp = new()
                    tmp.from_mesh(me)
                    # Bone axis is the lathe Y (game up): turn it to point into the wall.
                    M = T(wx(side, -0.03 + R.uniform(-0.012, 0.012)), y + R.uniform(-0.008, 0.008), z) @ RZ(side * math.pi / 2) \
                        @ RX(R.uniform(-0.08, 0.08))
                    append(ends, tmp, M)
                    z += R.uniform(0.078, 0.092)
                y += 0.082
            else:
                z = BONE_Z[0] + 0.12
                while z < BONE_Z[1] - 0.1:
                    skull(skulls, dark, (wx(side, -0.05), y - 0.005, z), yaw=-side * math.pi / 2 + R.uniform(-0.15, 0.15), s=0.95)
                    z += 0.22
                y += 0.18
        # Dark packing behind and a stone cap on top.
        box(dark, (wx(side, 0.06), y / 2, sum(BONE_Z) / 2), (0.12, y, BONE_Z[1] - BONE_Z[0]))
        cap = new()
        box(cap, (wx(side, 0.05), y + 0.04, sum(BONE_Z) / 2), (0.24, 0.08, BONE_Z[1] - BONE_Z[0] + 0.1))
        bevel(cap, 0.01)
        kit.add(cap, Matrix.Identity(4), 'stone', stone((112, 106, 96), 0.05, 0.0), 40 + side, name='slabs')
        kit.anchor(f'bone-wall-top-{"east" if side > 0 else "west"}', wx(side, -0.08), y + 0.08, sum(BONE_Z) / 2)
    bpy.data.meshes.remove(me)
    kit.add(ends, Matrix.Identity(4), 'bone', bone_paint, 41, name='bones')
    kit.add(skulls, Matrix.Identity(4), 'bone', bone_paint, 42, name='bones', smooth=True)
    kit.add(dark, Matrix.Identity(4), 'stone', const((20, 17, 15)), 43, name='dark')


def ribs_and_ceiling():
    rb = new()
    for z in RIB_Z:
        pts_in = arch_curve(IN * 2, 1.78, HT - 0.02, 12, pointed=False)
        pts_out = arch_curve(IN * 2 + 0.4, 1.78, HT + 0.25, 12, pointed=False)
        for (a, b), (c, d) in zip(zip(pts_in, pts_in[1:]), zip(pts_out, pts_out[1:])):
            q = prism([a, b, d, c], 0.3)
            bmesh.ops.translate(q, verts=q.verts, vec=G(CX, 0, z))
            append(rb, q)
        for side in (-1, 1):
            box(rb, (wx(side, -0.05), 0.89, z), (0.14, 1.78, 0.34))
            box(rb, (wx(side, -0.08), 1.74, z), (0.2, 0.08, 0.4))                 # impost
            box(rb, (wx(side, -0.08), 0.08, z), (0.2, 0.16, 0.4))                 # base
    bevel(rb, 0.01)
    jitter(rb, 0.01, 7, 3)
    kit.add(rb, Matrix.Identity(4), 'stone', stone((118, 112, 100), 0.05, 0.6, streak=0.3), 51, name='ribs')
    ce = new()
    z = Z0
    while z < Z1:
        L = R.uniform(0.5, 0.9)
        x = CX - IN - 0.1
        while x < CX + IN + 0.1:
            w = R.uniform(0.4, 0.8)
            box(ce, (min(x + w / 2, CX + IN), HT + 0.04 + R.uniform(-0.01, 0.02), min(z + L / 2, Z1)), (w - 0.02, 0.1, L - 0.02))
            x += w
        z += L
    jitter(ce, 0.012, 3, 4)
    kit.add(ce, Matrix.Identity(4), 'stone', stone((70, 66, 60), 0.1, 0.0, streak=0.6), 52, name='walls')
    # End wall facing the corridor.
    ew = new()
    y = 0
    while y < HT:
        h = R.uniform(0.18, 0.3)
        x = CX - IN - R.uniform(0, 0.2)
        while x < CX + IN:
            w = R.uniform(0.25, 0.55)
            a, b = max(x, CX - IN), min(x + w, CX + IN)
            if b - a > 0.05 and not (abs((a + b) / 2 - CX) < 0.55 and 0.85 < y + h / 2 < 2.0):
                box(ew, ((a + b) / 2, y + h / 2, Z1 - 0.15 + R.uniform(-0.02, 0.01)), (b - a - 0.015, h - 0.015, 0.3))
            x += w
        y += h
    bevel(ew, 0.02)
    jitter(ew, 0.015, 9, 3.5)
    kit.add(ew, Matrix.Identity(4), 'stone', stone((96, 90, 82), 0.1, 0.9, streak=0.5), 53, name='walls')


def floor():
    fl = new()
    z = Z0 - 0.05
    while z < Z1:
        L = R.uniform(0.4, 0.7)
        x = CX - IN
        while x < CX + IN - 0.01:
            w = min(R.uniform(0.4, 0.75), CX + IN - x)
            box(fl, (x + w / 2, 0.015 + R.uniform(-0.006, 0.006), z + L / 2), (w - 0.025, 0.03, L - 0.025))
            x += w
        z += L
    bevel(fl, 0.008)
    jitter(fl, 0.006, 2, 3)
    kit.add(fl, Matrix.Identity(4), 'stone', stone((82, 78, 72), moss=0.0, grime_h=0.0, var=0.35), 61, name='floor')
    wa = new()
    for x, z, r in ((25.3, 43.0, 0.35), (24.6, 49.5, 0.25), (25.5, 56.8, 0.4), (24.9, 47.8, 0.2)):
        d = lathe([(0, 0.032), (r, 0.032)], 14)
        for v in d.verts:
            v.co.x *= R.uniform(0.9, 1.4)
        append(wa, d, T(x, 0, z))
    kit.add(wa, Matrix.Identity(4), 'water', const((14, 16, 18)), 62, name='water')
    sc, dk = new(), new()
    for k in range(18):
        side = R.choice((-1, 1))
        z = R.uniform(Z0 + 0.5, Z1 - 0.5)
        x = wx(side, -R.uniform(0.08, 0.3))
        a = R.uniform(0, math.pi)
        bone(sc, (x, 0.04, z), (x + 0.3 * math.cos(a), 0.04, z + 0.3 * math.sin(a)), 0.016)
    for k in range(4):
        side = R.choice((-1, 1))
        skull(sc, dk, (wx(side, -0.2), 0.03, R.uniform(Z0 + 1, Z1 - 1)), yaw=R.uniform(0, 6), tilt=R.uniform(-0.3, 0.3))
    kit.add(sc, Matrix.Identity(4), 'bone', bone_paint, 63, name='bones')
    kit.add(dk, Matrix.Identity(4), 'stone', const((20, 17, 15)), 64, name='dark')


def surfaces():
    st = new()
    for side, z in LEDGES:
        box(st, (wx(side, -0.12), LEDGE_Y - 0.04, z), (0.28, 0.08, 1.2))
        for dz in (-0.45, 0.45):
            pr = prism([(0, 0), (0.22, 0), (0, -0.25)], 0.12)
            M = T(wx(side, 0.0), LEDGE_Y - 0.08, z + dz) @ (RY(math.pi) if side > 0 else RY(0))
            append(st, pr, M)
        kit.anchor(f'ledge-{z:g}', wx(side, -0.13), LEDGE_Y, z, surfaceY=LEDGE_Y)
        kit.collider(wx(side, -0.12), z, 0.14, 0.04, 0.6, y=LEDGE_Y - 0.04, note='ledge')
    # Bier: stone chest against the west wall with a carved front.
    b = BIER
    box(st, ((b['x0'] + b['x1']) / 2, 0.06, (b['z0'] + b['z1']) / 2), (b['x1'] - b['x0'] + 0.08, 0.12, b['z1'] - b['z0'] + 0.08))
    box(st, ((b['x0'] + b['x1']) / 2, (b['top'] - 0.06) / 2 + 0.06, (b['z0'] + b['z1']) / 2), (b['x1'] - b['x0'] - 0.06, b['top'] - 0.12, b['z1'] - b['z0'] - 0.06))
    box(st, ((b['x0'] + b['x1']) / 2, b['top'] - 0.03, (b['z0'] + b['z1']) / 2), (b['x1'] - b['x0'], 0.06, b['z1'] - b['z0']))
    for k in range(3):
        box(st, (b['x1'] - 0.02, 0.42, b['z0'] + 0.3 + k * 0.6), (0.02, 0.36, 0.42))
    kit.collider((b['x0'] + b['x1']) / 2, (b['z0'] + b['z1']) / 2, (b['x1'] - b['x0']) / 2 + 0.04, b['top'] / 2, (b['z1'] - b['z0']) / 2 + 0.04, note='bier')
    kit.anchor('bier-top', (b['x0'] + b['x1']) / 2, b['top'], (b['z0'] + b['z1']) / 2, surfaceY=b['top'], size=[b['x1'] - b['x0'], b['z1'] - b['z0']])
    # Reliquary altar in the last chamber.
    a = ALTAR
    box(st, (CX, 0.07, a['z']), (a['w'] + 0.2, 0.14, a['d'] + 0.2))
    box(st, (CX, (a['top'] - 0.07) / 2 + 0.07, a['z']), (a['w'] - 0.14, a['top'] - 0.15, a['d'] - 0.14))
    box(st, (CX, a['top'] - 0.04, a['z']), (a['w'], 0.08, a['d']))
    for sx in (-1, 1):
        for sz in (-1, 1):
            append(st, cyl(0.05, a['top'] - 0.2, 8, 0.14), T(CX + sx * (a['w'] / 2 - 0.1), 0, a['z'] + sz * (a['d'] / 2 - 0.1)))
    kit.collider(CX, a['z'], a['w'] / 2 + 0.1, a['top'] / 2, a['d'] / 2 + 0.1, note='reliquary altar')
    kit.anchor('altar-top', CX, a['top'], a['z'], surfaceY=a['top'])
    bevel(st, 0.008)
    kit.add(st, Matrix.Identity(4), 'stone', stone((128, 122, 110), moss=0.05, grime_h=0.5, streak=0.2), 71, name='slabs')
    # Shrine on the end wall: pointed recess lined with a pyramid of skulls, two candles.
    sk, dk = new(), new()
    rows = [5, 4, 3, 2, 1]
    for r, n in enumerate(rows):
        for i in range(n):
            skull(sk, dk, (CX + (i - (n - 1) / 2) * 0.2, 0.86 + r * 0.17, Z1 - 0.32), yaw=math.pi, s=0.95)
    box(dk, (CX, 1.45, Z1 - 0.06), (1.9, 1.5, 0.05))
    kit.add(sk, Matrix.Identity(4), 'bone', bone_paint, 72, name='bones', smooth=True)
    kit.add(dk, Matrix.Identity(4), 'stone', const((18, 15, 13)), 73, name='dark')
    ring = arch_ring(1.1, 1.75, 2.12, 0.08, 0.12, 12)
    kit.add(ring, T(CX, 0, Z1 - 0.32), 'stone', stone((140, 134, 120), 0.0, 0.0), 74, name='slabs')
    sill = new()
    box(sill, (CX, 0.82, Z1 - 0.3), (1.2, 0.06, 0.3))
    kit.add(sill, Matrix.Identity(4), 'stone', stone((140, 134, 120), 0.0, 0.0), 75, name='slabs')


def candles():
    spots = [(wx(-1, -0.1), LEDGE_Y, 45.45), (wx(1, -0.1), LEDGE_Y, 49.55), (CX - 0.45, 0.85, Z1 - 0.3), (CX + 0.45, 0.85, Z1 - 0.3),
             (CX + 0.4, ALTAR['top'], ALTAR['z'] + 0.2), (BIER['x0'] + 0.15, BIER['top'], BIER['z1'] - 0.2)]
    wax, fl, puddle = new(), new(), new()
    for i, (x, y, z) in enumerate(spots):
        for k in range(2 if i % 2 else 3):
            dx, dz = (k - 1) * 0.06, (k % 2) * 0.05
            h = R.uniform(0.06, 0.16)
            append(wax, lathe([(0, 0), (0.022, 0), (0.024, h * 0.4), (0.02, h), (0, h - 0.004)], 7), T(x + dx, y, z + dz))
            append(fl, lathe([(0, h + 0.002), (0.007, h + 0.014), (0.004, h + 0.03), (0, h + 0.042)], 5), T(x + dx, y, z + dz))
        append(puddle, lathe([(0, 0.002), (0.07, 0.002), (0.06, 0.012), (0, 0.012)], 9), T(x, y, z))
        kit.anchor(f'candle-{i}', x, y + 0.15, z, note='dim warm light (no shadows) if the budget allows')
    kit.add(wax, Matrix.Identity(4), 'wax', WAX, 81, name='wax', smooth=True)
    kit.add(puddle, Matrix.Identity(4), 'wax', WAX, 82, name='wax')
    kit.add(fl, Matrix.Identity(4), 'flame', FLAME, 83, name='flames')


def portal():
    """Stone entrance front at z 40 facing the grounds, set into an earth mound."""
    zf = 40.0
    st = new()
    for sx in (-1, 1):
        x = CX + sx * 1.95
        box(st, (x, 0.15, zf - 0.05), (0.72, 0.3, 0.6))
        box(st, (x, 1.35, zf - 0.02), (0.58, 2.1, 0.5))
        for k in range(5):
            box(st, (x, 0.45 + k * 0.4, zf - 0.28), (0.5, 0.36, 0.04))                  # rusticated faces
        box(st, (x, 2.5, zf - 0.05), (0.7, 0.2, 0.6))
        kit.collider(x, zf - 0.02, 0.36, 1.3, 0.3, note='portal pier')
    box(st, (CX, 2.45, zf - 0.02), (3.4, 0.5, 0.5))                                         # lintel
    box(st, (CX, 2.8, zf - 0.06), (4.7, 0.2, 0.62))                                         # cornice
    ped = prism([(-2.25, 0), (2.25, 0), (0, 0.85)], 0.5)
    append(st, ped, T(CX, 2.9, zf - 0.02))
    cor = new()
    for sx in (-1, 1):
        L = math.hypot(2.35, 0.9)
        bmesh.ops.create_cube(cor, size=1.0, matrix=T(CX + sx * 1.15, 3.33, zf - 0.06) @ RZ(-sx * math.atan2(0.9, 2.35)) @ S(L, 0.12, 0.6))
        box(cor, (CX + sx * 2.25, 3.0, zf - 0.06), (0.24, 0.3, 0.3))                       # acroteria
    box(cor, (CX, 3.85, zf - 0.06), (0.22, 0.26, 0.3))
    append(st, cor)
    # Inscription panel with incised lines.
    box(st, (CX, 2.45, zf - 0.28), (2.2, 0.32, 0.03))
    bevel(st, 0.01)
    jitter(st, 0.008, 3, 4)
    kit.add(st, Matrix.Identity(4), 'stone', stone((126, 120, 108), moss=0.55, grime_h=0.8, streak=0.45), 91, name='portal')
    inc = new()
    for k, w in enumerate((1.7, 1.2)):
        box(inc, (CX, 2.5 - k * 0.1, zf - 0.297), (w, 0.03, 0.01))
    kit.add(inc, Matrix.Identity(4), 'stone', const((26, 22, 20)), 92, name='dark')
    # Winged skull in the pediment.
    sk, dk = new(), new()
    skull(sk, dk, (CX, 3.05, zf - 0.32), yaw=math.pi, s=1.6)
    for sx in (-1, 1):
        wg = prism([(0, 0), (sx * 0.55, 0.12), (sx * 0.62, 0.32), (sx * 0.4, 0.26), (sx * 0.22, 0.3), (0, 0.16)], 0.05)
        append(sk, wg, T(CX + sx * 0.14, 3.05, zf - 0.3))
    kit.add(sk, Matrix.Identity(4), 'stone', stone((150, 144, 130), 0.3, 0.0), 93, name='portal')
    kit.add(dk, Matrix.Identity(4), 'stone', const((26, 22, 20)), 94, name='dark')
    # Wing walls splaying back into the mound.
    ww = new()
    for sx in (-1, 1):
        for k in range(4):
            h = 2.3 - k * 0.45
            box(ww, (CX + sx * (2.55 + k * 0.42), h / 2, zf + 0.1 + k * 0.3), (0.45, h, 0.4))
            box(ww, (CX + sx * (2.55 + k * 0.42), h + 0.06, zf + 0.1 + k * 0.3), (0.52, 0.12, 0.48))
        kit.collider(CX + sx * 3.2, zf + 0.55, 0.9, 1.0, 0.55, rot=-sx * 0.6, note='wing wall')
    bevel(ww, 0.015)
    jitter(ww, 0.015, 5, 3)
    kit.add(ww, Matrix.Identity(4), 'stone', stone((112, 106, 96), moss=0.7, grime_h=1.0, streak=0.4), 95, name='portal')
    lantern(kit, (CX + 1.95, 2.6, zf - 0.05), 96)
    kit.anchor('portal-lantern', CX + 1.95, 2.75, zf - 0.05)


def mound():
    """Grassy earth mound over the tunnel so it reads as a burial hill from the grounds."""
    bm = new()
    nz, na = 24, 16
    za, zb = 40.15, 62.0
    rings = []
    for i in range(nz + 1):
        t = i / nz
        z = za + (zb - za) * t
        hw = 4.6 if t < 0.92 else 4.6 * (1 - (t - 0.92) / 0.08 * 0.85)
        hh = 3.5 if t > 0.03 else 3.0
        if t > 0.92:
            hh *= 1 - (t - 0.92) / 0.08 * 0.85
        ring = []
        for j in range(na + 1):
            a = math.pi * j / na
            n = noise.noise(Vector((z * 0.35, a * 2, 0.5))) * 0.25
            x = CX + math.cos(a) * (hw + n)
            y = max(-0.2, math.sin(a) * (hh + n)) - 0.15
            ring.append(bm.verts.new(G(x, y, z)))
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for j in range(na):
            bm.faces.new([a[j], a[j + 1], b[j + 1], b[j]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.dot(Vector((0, 0, 1))) < -0.2 and False:
            f.normal_flip()
    grass, dirt = srgb(54, 64, 36), srgb(58, 46, 34)

    def paint(L, P, N, s, g):
        t = smoothstep(0.2, 0.75, max(0.0, N.z))
        c = lerp(dirt, grass, t * (0.7 + 0.3 * noise.noise(P * 0.8)))
        return c * (0.8 + 0.3 * (0.5 + 0.5 * noise.noise(P * 2.3)))
    kit.add(bm, Matrix.Identity(4), 'earth', paint, 101, name='mound')


def build():
    for side in (-1, 1):
        plan = niche_plan(side)
        holes = [(z0, z1, y0, y1) for z0, z1, y0, y1, _ in plan]
        # Bone walls replace the rubble facing between BONE_Z.
        holes.append((BONE_Z[0], BONE_Z[1], 0.0, 1.62))
        rubble_wall(side, holes)
        niches(side, plan)
    bone_walls()
    ribs_and_ceiling()
    floor()
    surfaces()
    candles()
    portal()
    mound()


def preview():
    preview_setup(world=(0.02, 0.022, 0.03), strength=0.6)
    ground(60, (44, 50, 36), c=(25, 35))
    light('SUN', (0, 10, 0), 1.2, (0.75, 0.8, 0.95), rot=(math.radians(55), 0, math.radians(20)))
    for name, a in kit.anchors.items():
        if name.startswith('candle'):
            light('POINT', a['position'], 6, (1, 0.6, 0.3), 0.1)
    light('POINT', (CX, 1.8, 42.5), 25, (1, 0.62, 0.35), 0.4)
    light('POINT', (CX, 1.8, 49), 30, (1, 0.62, 0.35), 0.4)
    light('POINT', (CX, 1.8, 57.5), 20, (1, 0.62, 0.35), 0.4)
    light('POINT', (CX + 1.95, 2.75, 39.8), 20, (1, 0.6, 0.3), 0.2)
    shoot(PREVIEW, {
        'cat-portal': ((20.5, 2.0, 32.5), (25, 1.8, 40), 30),
        'cat-entry': ((25.2, 1.6, 40.6), (25, 1.2, 48), 22),
        'cat-bones': ((25.6, 1.5, 45.2), (24.0, 0.9, 49.5), 24),
        'cat-niches': ((25.0, 1.5, 42.0), (26.2, 0.9, 44.0), 24),
        'cat-chamber': ((25.0, 1.6, 55.9), (25, 1.0, 60), 22),
        'cat-bier': ((25.8, 1.5, 51.0), (24.2, 0.7, 53.5), 26),
    })


clear_scene()
build()
coll = make_objects(kit, 'catacombs')
size = export(coll, OUT, {'surfaces': {
    'ledges-y': LEDGE_Y, 'bier-top-y': BIER['top'], 'altar-top-y': ALTAR['top'],
    'move-items': {
        'cat-wall-a [24.5, 1, 45]': [round(wx(-1, -0.13), 3), LEDGE_Y, 45.0],
        'cat-wall-b [25.5, 1, 50]': [round(wx(1, -0.13), 3), LEDGE_Y, 50.0],
        'cat-wall-c [24.5, 1, 55]': [round(wx(-1, -0.13), 3), LEDGE_Y, 54.9],
        'fx-page-4 [25, 1, 52]': [24.2, BIER['top'], 52.6],
        'fx-shroud [24.5, 0.8, 53]': [24.35, BIER['top'], 53.4],
        'fx-heart [25, 0.8, 58]': [25.0, ALTAR['top'], 58.0]}}}, kit)
preview()
print('STATS ' + json.dumps({'tris': kit.tris(), 'objects': len(coll.objects), 'colliders': len(kit.colliders), 'bytes': size}))
