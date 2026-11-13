"""The keeper's hut for Last Rites, inside and out (the workbench itself is props/workbench.glb).

  blender -b --factory-startup --python tools/blender/hut.py -- OUT_GLB PREVIEW_DIR

Hut-local game coordinates = world (the hut is centred on the origin), matching HUT in cemeteryLayout.ts:
halfX 3.2, halfZ 3, walls 2.4 high and 0.2 thick, door 1.4 x 2.1 in the +Z wall, roof rise 1.3 with 0.4 eaves,
windows centred z -0.8, y 1.4 (0.9 x 0.7) on both side walls. Kept clear: the spawn and the walk to the bench
(|x| < 0.8, z -1.8..3), the bench footprint (|x| < 0.7, z -2.6..-1.8), the door, and the item spots:
hut-shelf (1.8, 0.8, -1) and journal page 1 (2.6, 0.8, -1.3) on the east table (surface 0.78),
the powder tin (-1.8, 0.8, -1) on the new west table (surface 0.78), Elias's boots clue at (-2.2, 0, 1.6).
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sclib import *  # noqa
import bpy

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT, PREVIEW = ARGV[0], ARGV[1]

HX, HZ, H, WT = 3.2, 3.0, 2.4, 0.2
DOOR_W, DOOR_H = 1.4, 2.1
RISE, EAVE = 1.3, 0.4
RXE = HX + EAVE
RIDGE = H + RISE
WIN = dict(z=-0.8, y0=1.05, y1=1.75, w=0.9)
SURFACE = 0.78

kit = Kit()

EXT = wood((104, 90, 74), 0.32, weather=0.55, grime_h=0.5)
INT = wood((112, 80, 52), 0.3)
TRIM = wood((66, 48, 34), 0.25, weather=0.3)
DARK = wood((58, 40, 28), 0.3)
FLOOR = wood((96, 68, 44), 0.35, grime_h=0.0)


def roof_y(x):
    return H + RISE * (1 - abs(x) / RXE)


WALLS = [  # axis, fixed, out, run range, openings (u0, u1, v0, v1), gable
    dict(axis='x', fixed=HZ, out=1, run=(-HX - WT / 2, HX + WT / 2), open=[(-DOOR_W / 2, DOOR_W / 2, -1, DOOR_H)], gable=True, seed=1),
    dict(axis='x', fixed=-HZ, out=-1, run=(-HX - WT / 2, HX + WT / 2), open=[], gable=True, seed=2),
    dict(axis='z', fixed=-HX, out=-1, run=(-HZ - WT / 2, HZ + WT / 2), open=[(WIN['z'] - WIN['w'] / 2, WIN['z'] + WIN['w'] / 2, WIN['y0'], WIN['y1'])], gable=False, seed=3),
    dict(axis='z', fixed=HX, out=1, run=(-HZ - WT / 2, HZ + WT / 2), open=[(WIN['z'] - WIN['w'] / 2, WIN['z'] + WIN['w'] / 2, WIN['y0'], WIN['y1'])], gable=False, seed=4),
]


def wpos(w, u, v, d):
    return (u, v, w['fixed'] + w['out'] * d) if w['axis'] == 'x' else (w['fixed'] + w['out'] * d, v, u)


def wsize(w, su, sv, sd):
    return (su, sv, sd) if w['axis'] == 'x' else (sd, sv, su)


def wtilt(w, a):
    return RX(w['out'] * a) if w['axis'] == 'x' else RZ(w['out'] * a)


def board(bm, w, u0, u1, v0, v1, d0, d1, tilt=0.0):
    p = wpos(w, (u0 + u1) / 2, (v0 + v1) / 2, (d0 + d1) / 2)
    bmesh.ops.create_cube(bm, size=1.0, matrix=T(*p) @ wtilt(w, tilt) @ S(*wsize(w, u1 - u0, v1 - v0, abs(d1 - d0))))


def clip(a, b, va, vb, ops, pad=0.0):
    pieces = [(a, b)]
    for u0, u1, v0, v1 in ops:
        if vb <= v0 or va >= v1:
            continue
        nxt = []
        for p0, p1 in pieces:
            if u1 + pad <= p0 or u0 - pad >= p1:
                nxt.append((p0, p1))
                continue
            if u0 - pad > p0:
                nxt.append((p0, u0 - pad))
            if u1 + pad < p1:
                nxt.append((u1 + pad, p1))
        pieces = nxt
    return [(p0, p1) for p0, p1 in pieces if p1 - p0 > 0.04]


def walls():
    ext, inn, trim = new(), new(), new()
    for w in WALLS:
        a, b = w['run']
        top = RIDGE if w['gable'] else H
        # Clapboard outside, from the sill beam up; each board tilts so its lower edge stands proud.
        v = 0.3
        while v < top - 0.02:
            hgt = 0.19
            if w['gable'] and v > H:
                lim = RXE * (1 - (v + hgt - H) / RISE) - 0.04
                ra, rb = max(a, -lim), min(b, lim)
            else:
                ra, rb = a, b
            for p0, p1 in clip(ra, rb, v, v + hgt, w['open'], 0.02):
                board(ext, w, p0, p1, v, v + hgt + 0.03, WT / 2 + 0.005, WT / 2 + 0.03, math.radians(3.5))
            v += hgt
        # Vertical planks inside.
        ia, ib = (a + WT, b - WT)
        u = ia
        while u < ib - 1e-3:
            pw = min(R.uniform(0.15, 0.22), ib - u)
            t_ = min(roof_y(u), roof_y(u + pw)) - 0.06 if w['gable'] else H
            for vv0, vv1 in ((0.05, t_),):
                spans = [(vv0, vv1)]
                for u0, u1, o0, o1 in w['open']:
                    if u + pw > u0 - 0.01 and u < u1 + 0.01:
                        nxt = []
                        for s0, s1 in spans:
                            if o1 <= s0 or o0 >= s1:
                                nxt.append((s0, s1))
                                continue
                            if o0 > s0:
                                nxt.append((s0, o0 - 0.02))
                            if o1 < s1:
                                nxt.append((o1 + 0.02, s1))
                        spans = nxt
                for s0, s1 in spans:
                    if s1 - s0 > 0.04:
                        board(inn, w, u + 0.004, u + pw - 0.004, s0, s1, -WT / 2 - 0.022, -WT / 2)
            u += pw
        # Girt rail inside at 1.0 m, broken by openings.
        for p0, p1 in clip(ia, ib, 0.96, 1.06, w['open'], 0.05):
            board(trim, w, p0, p1, 0.96, 1.06, -WT / 2 - 0.05, -WT / 2 - 0.02)
        # Sill beam on stone footing; top plate.
        board(trim, w, a - 0.02, b + 0.02, 0.12, 0.3, -WT / 2 - 0.01, WT / 2 + 0.04)
        board(trim, w, a, b, H - 0.12, H, -WT / 2 - 0.03, WT / 2 + 0.035)
        # Opening linings and outside trim.
        for u0, u1, v0, v1 in w['open']:
            v0 = max(v0, 0.0)
            for uu in (u0, u1):
                board(trim, w, uu - 0.03 if uu == u0 else uu, uu if uu == u0 else uu + 0.03, v0, v1, -WT / 2 - 0.03, WT / 2 + 0.03)
                s = -1 if uu == u0 else 1
                board(trim, w, uu + s * 0.0 - (0.12 if s < 0 else 0), uu + (0.12 if s > 0 else 0), v0 - (0.06 if v0 > 0 else 0), v1 + 0.12,
                      WT / 2 + 0.03, WT / 2 + 0.06)
            board(trim, w, u0, u1, v1, v1 + 0.04, -WT / 2 - 0.03, WT / 2 + 0.03)
            board(trim, w, u0 - 0.16, u1 + 0.16, v1 + 0.04, v1 + 0.18, WT / 2 + 0.03, WT / 2 + 0.07)          # head casing
            board(trim, w, u0 - 0.2, u1 + 0.2, v1 + 0.18, v1 + 0.22, WT / 2 + 0.03, WT / 2 + 0.12)           # drip cap
            if v0 > 0:
                board(trim, w, u0 - 0.1, u1 + 0.1, v0 - 0.05, v0, -WT / 2 - 0.08, WT / 2 + 0.1, math.radians(-6))  # sill
    # Corner boards.
    for sx in (-1, 1):
        for sz in (-1, 1):
            x, z = sx * (HX + WT / 2 + 0.035), sz * (HZ + WT / 2 + 0.035)
            box(trim, (x, (0.3 + H) / 2, sz * (HZ + WT / 2 - 0.04)), (0.05, H - 0.3, 0.16))
            box(trim, (sx * (HX + WT / 2 - 0.04), (0.3 + H) / 2, z), (0.16, H - 0.3, 0.05))
    kit.add(ext, Matrix.Identity(4), 'wood', EXT, 1, name='walls')
    kit.add(inn, Matrix.Identity(4), 'wood', INT, 2, name='walls')
    kit.add(trim, Matrix.Identity(4), 'wood', TRIM, 3, name='trim')
    # Stone footing blocks.
    st = new()
    for sx in (-1, 1):
        for zz in (-HZ, -1.0, 1.0, HZ):
            box(st, (sx * HX, 0.06, zz), (0.4, 0.14, 0.4))
    for xx in (-1.6, 1.6):
        for sz in (-1, 1):
            box(st, (xx, 0.06, sz * HZ), (0.4, 0.14, 0.4))
    bevel(st, 0.03)
    jitter(st, 0.02, 5, 3)
    kit.add(st, Matrix.Identity(4), 'stone', stone((120, 114, 104), 0.6, 0.2), 4, name='stone')


def floor():
    bm = new()
    x = -HX + WT / 2
    while x < HX - WT / 2 - 1e-3:
        w = min(R.uniform(0.16, 0.22), HX - WT / 2 - x)
        z = -HZ + WT / 2
        while z < HZ - WT / 2 - 1e-3:
            L = min(R.uniform(1.6, 3.2), HZ - WT / 2 - z)
            box(bm, (x + w / 2, 0.035 + R.uniform(-0.003, 0.003), z + L / 2), (w - 0.008, 0.03, L - 0.008))
            z += L
        x += w
    # Threshold and the doorway floor.
    box(bm, (0, 0.04, HZ), (DOOR_W, 0.04, WT + 0.02))
    kit.add(bm, Matrix.Identity(4), 'wood', FLOOR, 6, name='floor')
    # Rag rug in the middle.
    rug = new()
    box(rug, (0.0, 0.055, 0.6), (1.5, 0.008, 1.0))
    kit.add(rug, Matrix.Identity(4), 'cloth', flat((112, 58, 40), 0.35, 11), 7, name='cloth')
    fr = new()
    for zz in (0.12, 1.08):
        box(fr, (0.0, 0.058, zz), (1.5, 0.008, 0.06))
    kit.add(fr, Matrix.Identity(4), 'cloth', flat((70, 66, 52), 0.3, 18), 8, name='cloth')


SLOPE = math.atan2(RISE, RXE)
SLEN = math.hypot(RISE, RXE)
RZ0, RZ1 = -HZ - EAVE, HZ + EAVE


def on_slope(side, s, off):
    x = side * (RXE - s * math.cos(SLOPE))
    y = H + s * math.sin(SLOPE)
    return x + side * math.sin(SLOPE) * off, y + math.cos(SLOPE) * off


def roof():
    sark = new()
    for side in (-1, 1):
        # Plank sarking (visible from inside), laid along the slope in strips.
        s = 0.0
        while s < SLEN - 1e-3:
            w = min(0.2, SLEN - s)
            x, y = on_slope(side, s + w / 2, -0.015)
            bmesh.ops.create_cube(sark, size=1.0, matrix=T(x, y, 0) @ RZ(-side * SLOPE) @ S(w - 0.006, 0.03, RZ1 - RZ0))
            s += w
    kit.add(sark, Matrix.Identity(4), 'wood', DARK, 11, name='roof-timber')
    raft = new()
    z = -HZ + 0.1
    while z <= HZ:
        for side in (-1, 1):
            x, y = on_slope(side, SLEN / 2 - 0.02, -0.1)
            bmesh.ops.create_cube(raft, size=1.0, matrix=T(x, y, z) @ RZ(-side * SLOPE) @ S(SLEN + 0.3, 0.13, 0.07))
        z += 0.6
    for zz in (-1.6, 1.6):  # tie beams and king posts
        box(raft, (0, H - 0.05, zz), (HX * 2, 0.14, 0.12))
        box(raft, (0, (H + RIDGE) / 2 - 0.05, zz), (0.1, RISE - 0.1, 0.1))
    box(raft, (0, RIDGE - 0.12, 0), (0.12, 0.16, RZ1 - RZ0))                                   # ridge beam
    kit.add(raft, Matrix.Identity(4), 'wood', wood((70, 50, 34), 0.3), 12, name='roof-timber')

    tones = [(92, 76, 60), (78, 66, 54), (104, 92, 78), (70, 60, 50)]
    bms = [new() for _ in tones]
    for side in (-1, 1):
        s, row = -0.05, 0
        while s < SLEN - 0.06:
            z = RZ0 - (0.0 if row % 2 else 0.08)
            while z < RZ1:
                w = R.uniform(0.12, 0.26)
                a, b = max(z, RZ0), min(z + w, RZ1)
                z += w
                if b - a < 0.05 or R.random() < 0.012:
                    continue
                L = min(0.42, SLEN - s + 0.04)
                cx, cy = on_slope(side, s + L / 2, 0.02 + 0.01)
                M = T(cx, cy, (a + b) / 2) @ RZ(-side * SLOPE) @ RZ(side * math.radians(R.uniform(2.5, 6))) @ RY(math.radians(R.uniform(-2, 2)))
                bmesh.ops.create_cube(bms[R.randrange(len(tones))], size=1.0, matrix=M @ S(L, 0.018, b - a - 0.01))
            s += 0.17
            row += 1
    for bm, tone in zip(bms, tones):
        kit.add(bm, Matrix.Identity(4), 'wood', wood(tone, 0.4, weather=0.6), tone[0], name='shingles')
    cap = new()
    for side in (-1, 1):
        x, y = on_slope(side, SLEN - 0.1, 0.06)
        bmesh.ops.create_cube(cap, size=1.0, matrix=T(x, y, 0) @ RZ(-side * SLOPE) @ S(0.24, 0.025, RZ1 - RZ0 + 0.04))
        for zs in (-1, 1):  # bargeboards
            x, y = on_slope(side, SLEN / 2, -0.03)
            bmesh.ops.create_cube(cap, size=1.0, matrix=T(x, y - 0.05, zs * (RZ1 - 0.02)) @ RZ(-side * SLOPE) @ S(SLEN + 0.04, 0.2, 0.04))
        box(cap, (side * (RXE + 0.01), H - 0.03, 0), (0.04, 0.16, RZ1 - RZ0 + 0.04))                # fascia
    kit.add(cap, Matrix.Identity(4), 'wood', TRIM, 13, name='trim')


def door():
    # Ledged-and-braced plank door, standing open outward against the front wall west of the doorway.
    bm = new()
    n = 7
    for i in range(n):
        w = DOOR_W / n
        box(bm, (-DOOR_W / 2 + w * (i + 0.5), DOOR_H / 2, 0), (w - 0.006, DOOR_H - 0.02 - R.uniform(0, 0.02), 0.035))
    for y in (0.3, 1.05, 1.8):
        box(bm, (0, y, 0.035), (DOOR_W - 0.1, 0.14, 0.035))
    for y0, y1 in ((0.3, 1.05), (1.05, 1.8)):
        L = math.hypot(DOOR_W - 0.2, y1 - y0)
        a = math.atan2(y1 - y0, DOOR_W - 0.2)
        bmesh.ops.create_cube(bm, size=1.0, matrix=T(0, (y0 + y1) / 2, 0.035) @ RZ(a) @ S(L, 0.12, 0.03))
    hw = new()
    for y in (0.3, 1.8):
        box(hw, (-DOOR_W / 2 + 0.3, y, -0.025), (0.6, 0.05, 0.008))
    append(hw, tube([(DOOR_W / 2 - 0.12, 1.0, -0.03), (DOOR_W / 2 - 0.12, 1.0, -0.08), (DOOR_W / 2 - 0.12, 1.15, -0.08), (DOOR_W / 2 - 0.12, 1.15, -0.03)], 0.01, 5))
    # Hinged at the doorway's west jamb (x -0.7, z 3.1), swung 165 degrees open.
    M = T(-DOOR_W / 2 - 0.02, 0, HZ + WT / 2 + 0.03) @ RY(math.radians(165)) @ T(DOOR_W / 2, 0, 0)
    kit.add(bm, M, 'wood', wood((86, 64, 44), 0.35, weather=0.4), 21, name='trim')
    kit.add(hw, M, 'iron', iron(0.5), 22, name='iron')
    # Horseshoe over the door.
    hs = tube([(0.2 * math.cos(a), DOOR_H + 0.42 + 0.2 * math.sin(a), HZ + WT / 2 + 0.08) for a in
               [math.radians(d) for d in range(-40, 221, 20)]], 0.018, 5)
    kit.add(hs, Matrix.Identity(4), 'iron', iron(0.6), 23, name='iron')
    # Step.
    st = new()
    box(st, (0, 0.03, HZ + 0.45), (1.8, 0.06, 0.6))
    kit.add(st, Matrix.Identity(4), 'wood', EXT, 24, name='trim')


def windows():
    for side in (-1, 1):
        x = side * HX
        z0, z1 = WIN['z'] - WIN['w'] / 2, WIN['z'] + WIN['w'] / 2
        fr, gl = new(), new()
        # Sash: 2 x 2 panes with muntins.
        for k in (0, 1, 2):
            box(fr, (x, WIN['y0'] + (WIN['y1'] - WIN['y0']) * k / 2, WIN['z']), (0.06, 0.04, WIN['w']))
        for k in (0, 1, 2):
            box(fr, (x, (WIN['y0'] + WIN['y1']) / 2, z0 + WIN['w'] * k / 2), (0.06, WIN['y1'] - WIN['y0'], 0.04))
        kit.add(fr, Matrix.Identity(4), 'wood', DARK, 31 + side, name='trim')
        # Lit from outside, dark night glass from inside (two one-sided panes).
        yc = (WIN['y0'] + WIN['y1']) / 2
        out = pane((x + side * 0.005, yc, WIN['z']), (WIN['w'], WIN['y1'] - WIN['y0']), '+x' if side > 0 else '-x')
        inn = pane((x - side * 0.005, yc, WIN['z']), (WIN['w'], WIN['y1'] - WIN['y0']), '-x' if side > 0 else '+x')
        kit.add(out, Matrix.Identity(4), 'glass', glass_amber, 33 + side, name='glow')
        kit.add(inn, Matrix.Identity(4), 'night-glass', const((26, 32, 44)), 34 + side, name='night-glass')
        # Shutters hung open beside the window, one sagging.
        for k, zz in ((-1, z0 - 0.18 - WIN['w'] / 4), (1, z1 + 0.18 + WIN['w'] / 4)):
            sh = new()
            for i in range(4):
                box(sh, (0, 0, (i - 1.5) * WIN['w'] / 8), (0.03, WIN['y1'] - WIN['y0'] + 0.1, WIN['w'] / 8 - 0.008))
            for yy in (-0.25, 0.25):
                box(sh, (side * 0.02, yy, 0), (0.02, 0.08, WIN['w'] / 2 - 0.04))
            sag = math.radians(7) if (side > 0 and k > 0) else 0.0
            M = T(x + side * (WT / 2 + 0.09), (WIN['y0'] + WIN['y1']) / 2, zz) @ RX(sag)
            kit.add(sh, M, 'wood', wood((70, 84, 74), 0.3, weather=0.5), 35 + k + side, name='shutters')
        # Light anchor just inside each window (the game's warm fill).
        kit.anchor(f'window-{"east" if side > 0 else "west"}', side * (HX - 0.4), 1.45, WIN['z'])


def stove():
    x, z = -2.5, -2.3
    bm = new()
    body = lathe([(0, 0.18), (0.22, 0.18), (0.25, 0.25), (0.27, 0.45), (0.25, 0.68), (0.2, 0.78), (0.21, 0.82), (0, 0.84)], 12)
    append(bm, body, T(x, 0, z))
    for a in range(3):
        ang = a * 2 * math.pi / 3 + 0.4
        append(bm, tube([(x + 0.18 * math.cos(ang), 0.2, z + 0.18 * math.sin(ang)), (x + 0.26 * math.cos(ang), 0.0, z + 0.26 * math.sin(ang))], 0.025, 5))
    append(bm, lathe([(0.06, 0.82), (0.065, 0.84), (0.065, 2.3), (0.06, 2.31)], 8, cap=False), T(x, 0, z))
    pipe_top = RIDGE + 0.4
    append(bm, lathe([(0.065, 2.3), (0.065, pipe_top)], 8, cap=False), T(x, 0, z))
    append(bm, lathe([(0.065, 2.62), (0.16, 2.6), (0.16, 2.64), (0.065, 2.68)], 8, cap=False), T(x, 0, z))
    append(bm, lathe([(0, 0), (0.2, 0), (0.0, 0.12)], 8), T(x, pipe_top + 0.08, z))     # rain cap
    for k in range(3):
        append(bm, tube([(x, pipe_top - 0.02, z), (x + 0.12 * math.cos(k * 2.1), pipe_top + 0.08, z + 0.12 * math.sin(k * 2.1))], 0.01, 4))
    box(bm, (x + 0.27, 0.42, z), (0.02, 0.16, 0.18))                                          # door
    kit.add(bm, Matrix.Identity(4), 'iron', iron(0.25, (30, 28, 28)), 41, name='iron', smooth=True)
    em = new()
    box(em, (x + 0.285, 0.42, z), (0.005, 0.1, 0.12))
    kit.add(em, Matrix.Identity(4), 'ember', EMBER, 42, name='glow')
    kit.anchor('stove-glow', x + 0.35, 0.45, z)
    # Hearth slab and wood box.
    hs = new()
    box(hs, (x, 0.07, z + 0.05), (0.8, 0.04, 0.9))
    kit.add(hs, Matrix.Identity(4), 'stone', stone((90, 86, 80), 0.1, 0.0), 43, name='stone')
    wb = new()
    for i in range(4):
        box(wb, (-2.55, 0.25, -1.6 + 0.0), (0.5, 0.36, 0.02)) if False else None
    for dz in (-0.2, 0.2):
        box(wb, (-1.9 + 0.0, 0.18, -2.62 + dz * 0), (0.55, 0.32, 0.02)) if False else None
    box(wb, (-1.85, 0.17, -2.6), (0.5, 0.3, 0.4))
    kit.add(wb, Matrix.Identity(4), 'wood', DARK, 44, name='furniture')
    logs = new()
    for i in range(5):
        append(logs, cyl(0.055, 0.42, 7), T(-1.85 + (i % 3 - 1) * 0.12, 0.33 + (i // 3) * 0.1, -2.81) @ RX(math.pi / 2))
    kit.add(logs, Matrix.Identity(4), 'wood', wood((110, 84, 60), 0.4), 45, name='furniture')
    kit.collider(x, z, 0.3, 0.45, 0.3, note='stove')


def table(cx, cz, w, d, seed, items=True):
    bm = new()
    box(bm, (cx, SURFACE - 0.025, cz), (w, 0.05, d))
    for sx in (-1, 1):
        for sz in (-1, 1):
            box(bm, (cx + sx * (w / 2 - 0.07), (SURFACE - 0.05) / 2, cz + sz * (d / 2 - 0.07)), (0.07, SURFACE - 0.05, 0.07))
        box(bm, (cx + sx * (w / 2 - 0.07), 0.16, cz), (0.05, 0.05, d - 0.14))
    box(bm, (cx, 0.16, cz), (w - 0.14, 0.05, 0.05))
    box(bm, (cx, SURFACE - 0.1, cz - d / 2 + 0.05), (w - 0.14, 0.09, 0.03))
    bevel(bm, 0.006)
    kit.add(bm, Matrix.Identity(4), 'wood', wood((94, 64, 40), 0.35), seed, name='furniture')


def stool(cx, cz, seed):
    bm = cyl(0.17, 0.04, 10, 0.44)
    for k in range(3):
        a = k * 2 * math.pi / 3
        append(bm, tube([(cx * 0 + 0.1 * math.cos(a), 0.44, 0.1 * math.sin(a)), (0.17 * math.cos(a), 0.0, 0.17 * math.sin(a))], 0.018, 5))
    kit.add(bm, T(cx, 0, cz), 'wood', DARK, seed, name='furniture')


def furniture():
    # East table (the game already has its collider: x 2.1, z -1.1, 1.6 x 0.8).
    table(2.1, -1.1, 1.6, 0.8, 51)
    kit.collider(2.1, -1.1, 0.8, 0.39, 0.4, note='east table (matches the game collider)')
    stool(1.3, -0.4, 52)
    # Things on the east table, clear of the item spots (1.8, -1) and (2.6, -1.3).
    d = new()
    append(d, lathe([(0, 0), (0.05, 0), (0.05, 0.015), (0.015, 0.03), (0.015, 0.05), (0, 0.05)], 8), T(1.45, SURFACE, -1.35))
    append(d, cyl(0.03, 0.06, 8, 0.0), T(2.75, SURFACE, -0.8))                                  # tin cup
    kit.add(d, Matrix.Identity(4), 'iron', iron(0.3, (60, 58, 56)), 53, name='iron')
    c = cyl(0.014, 0.07, 6)
    kit.add(c, T(1.45, SURFACE + 0.03, -1.35), 'wax', WAX, 54, name='wax')
    f = lathe([(0, 0.1), (0.006, 0.11), (0.004, 0.125), (0, 0.135)], 5)
    kit.add(f, T(1.45, SURFACE, -1.35), 'flame', FLAME, 55, name='flames')
    p = new()
    box(p, (2.15, SURFACE + 0.003, -0.85), (0.22, 0.005, 0.3), M=None)
    kit.add(p, Matrix.Identity(4), 'paper', PAPER, 56, name='paper')
    ink = cyl(0.025, 0.05, 8)
    kit.add(ink, T(2.35, SURFACE, -0.75), 'glass', const((30, 30, 40)), 57, name='bottles')

    # West table for the powder tin (-1.8, 0.8, -1).
    table(-2.05, -1.0, 1.2, 0.7, 58)
    kit.collider(-2.05, -1.0, 0.6, 0.39, 0.35, note='west table (powder tin)')
    lamp = new()
    append(lamp, lathe([(0, 0), (0.07, 0), (0.07, 0.02), (0.03, 0.05), (0.035, 0.12), (0.06, 0.15), (0.0, 0.16)], 10), T(-2.5, SURFACE, -0.8))
    kit.add(lamp, Matrix.Identity(4), 'brass', BRASS, 59, name='iron')
    chim = lathe([(0.03, 0.16), (0.045, 0.2), (0.03, 0.3), (0.028, 0.33)], 10, cap=False)
    kit.add(chim, T(-2.5, SURFACE, -0.8), 'glass', glass_amber, 60, name='glow')
    stool(-1.3, -0.3, 61)

    # Cot along the west wall, south end, with a blanket and a pillow.
    cot = new()
    x0, x1, z0, z1 = -3.08, -2.42, 0.25, 2.35
    for sx in (x0 + 0.04, x1 - 0.04):
        for sz in (z0 + 0.04, z1 - 0.04):
            box(cot, (sx, 0.22, sz), (0.06, 0.44, 0.06))
        box(cot, (sx, 0.36, (z0 + z1) / 2), (0.05, 0.08, z1 - z0))
    for sz in (z0 + 0.04, z1 - 0.04):
        box(cot, ((x0 + x1) / 2, 0.36, sz), (x1 - x0, 0.08, 0.05))
    box(cot, ((x0 + x1) / 2, 0.58, z1 - 0.04), (x1 - x0, 0.3, 0.04))
    kit.add(cot, Matrix.Identity(4), 'wood', DARK, 62, name='furniture')
    bl = new()
    box(bl, ((x0 + x1) / 2, 0.45, (z0 + z1) / 2 - 0.15), (x1 - x0 - 0.04, 0.1, z1 - z0 - 0.4))
    box(bl, (x1 + 0.0, 0.36, (z0 + z1) / 2 - 0.15), (0.02, 0.2, z1 - z0 - 0.4))
    jitter(bl, 0.02, 3, 3)
    kit.add(bl, Matrix.Identity(4), 'cloth', flat((70, 76, 92), 0.3, 6), 63, name='cloth')
    pl = sphere(0.2, ((x0 + x1) / 2, 0.52, z1 - 0.3), 10, 6, 0.4)
    kit.add(pl, Matrix.Identity(4), 'cloth', flat((196, 186, 160), 0.2), 64, name='cloth', smooth=True)
    kit.collider((x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, 0.3, (z1 - z0) / 2, note='cot')

    # Shelves on the east wall, south of the window, with jars, tins and books.
    sh = new()
    for y in (1.25, 1.7):
        box(sh, (HX - WT / 2 - 0.13, y, 0.85), (0.24, 0.03, 1.2))
        for zz in (0.35, 1.35):
            bmesh.ops.create_cube(sh, size=1.0, matrix=T(HX - WT / 2 - 0.08, y - 0.08, zz) @ RZ(0.7) @ S(0.03, 0.18, 0.03))
    kit.add(sh, Matrix.Identity(4), 'wood', DARK, 65, name='furniture')
    jars, tins, books = new(), new(), new()
    for i, zz in enumerate((0.35, 0.5, 0.68, 0.85)):
        append(jars, lathe([(0, 0), (0.045, 0), (0.05, 0.1), (0.035, 0.14), (0.035, 0.16), (0, 0.16)], 8), T(HX - 0.25, 1.265, zz))
    for i, zz in enumerate((1.05, 1.18, 1.32)):
        append(tins, cyl(0.045, 0.1 + i * 0.02, 10), T(HX - 0.25, 1.265, zz))
    for i in range(6):
        h = R.uniform(0.17, 0.24)
        box(books, (HX - 0.26, 1.715 + h / 2, 0.4 + i * 0.045), (0.15, h, 0.04), M=None)
    kit.add(jars, Matrix.Identity(4), 'glass', flat((70, 92, 70), 0.3), 66, name='bottles')
    kit.add(tins, Matrix.Identity(4), 'iron', iron(0.5, (70, 66, 60)), 67, name='iron')
    kit.add(books, Matrix.Identity(4), 'cloth', flat((80, 40, 30), 0.5, 20), 68, name='cloth')

    # Coat pegs on the front wall west of the door: oilskin coat and a hat.
    pg = new()
    box(pg, (-1.75, 1.62, HZ - WT / 2 - 0.02), (1.1, 0.1, 0.03))
    for xx in (-2.15, -1.75, -1.35):
        append(pg, tube([(xx, 1.62, HZ - WT / 2 - 0.03), (xx, 1.66, HZ - WT / 2 - 0.13)], 0.012, 5))
    kit.add(pg, Matrix.Identity(4), 'wood', DARK, 69, name='furniture')
    coat = lathe([(0.05, 1.62), (0.16, 1.55), (0.2, 1.3), (0.24, 0.9), (0.26, 0.75), (0.0, 0.74)], 10)
    for v in coat.verts:
        v.co.y *= 0.45
    jitter(coat, 0.02, 9, 5)
    kit.add(coat, T(-2.15, 0, HZ - WT / 2 - 0.15), 'cloth', flat((72, 66, 40), 0.3, 4), 70, name='cloth', smooth=True)
    hat = lathe([(0, 0.0), (0.17, 0.0), (0.17, 0.012), (0.09, 0.02), (0.085, 0.11), (0.0, 0.12)], 12)
    kit.add(hat, T(-1.35, 1.58, HZ - WT / 2 - 0.15) @ RX(0.3), 'cloth', flat((30, 28, 26), 0.2), 71, name='cloth')

    # Barrel and sacks in the south-east corner.
    br = lathe([(0, 0), (0.23, 0), (0.27, 0.35), (0.23, 0.7), (0, 0.7)], 14)
    kit.add(br, T(2.05, 0, 2.55), 'wood', wood((90, 62, 40), 0.35), 72, name='furniture', smooth=True)
    hoops = new()
    for y, r in ((0.08, 0.245), (0.62, 0.245), (0.27, 0.268), (0.43, 0.268)):
        append(hoops, lathe([(r, y - 0.015), (r + 0.006, y - 0.015), (r + 0.006, y + 0.015), (r, y + 0.015)], 14, cap=False), T(2.05, 0, 2.55))
    kit.add(hoops, Matrix.Identity(4), 'iron', iron(0.6), 73, name='iron')
    kit.collider(2.05, 2.55, 0.28, 0.36, 0.28, note='barrel')
    kit.collider(2.83, 1.85, 0.26, 0.96, 0.39, note='vending machine (props/vending-machine.glb, rotationY -PI/2)')
    sacks = new()
    for i, (sx, sz) in enumerate(((1.45, 2.6), (2.75, 2.65))):
        s = sphere(0.25, (sx, 0.2, sz), 10, 7, 0.8)
        jitter(s, 0.035, i, 4)
        append(sacks, s)
    kit.add(sacks, Matrix.Identity(4), 'cloth', flat((140, 118, 84), 0.3, 12), 74, name='cloth', smooth=True)

    # Tool rack on the back wall above the bench: saw, hammer, pliers, a coil of rope.
    rk = new()
    box(rk, (0, 1.45, -HZ + WT / 2 + 0.015), (1.6, 0.7, 0.025))
    for xx in (-0.6, -0.2, 0.25, 0.6):
        append(rk, tube([(xx, 1.62, -HZ + WT / 2 + 0.03), (xx, 1.64, -HZ + WT / 2 + 0.1)], 0.01, 4))
    kit.add(rk, Matrix.Identity(4), 'wood', wood((80, 58, 40), 0.3), 75, name='furniture')
    tl = new()
    saw = prism([(-0.25, 0.0), (0.2, 0.0), (0.2, 0.14), (-0.25, 0.05)], 0.004)
    append(tl, saw, T(-0.62, 1.35, -HZ + WT / 2 + 0.06))
    append(tl, cyl(0.016, 0.3, 6), T(-0.2, 1.3, -HZ + WT / 2 + 0.06))
    box(tl, (-0.2, 1.62, -HZ + WT / 2 + 0.06), (0.14, 0.04, 0.04))
    append(tl, tube([(0.22, 1.6, -HZ + WT / 2 + 0.06), (0.25, 1.4, -HZ + WT / 2 + 0.06)], 0.01, 4))
    append(tl, tube([(0.28, 1.6, -HZ + WT / 2 + 0.06), (0.26, 1.4, -HZ + WT / 2 + 0.06)], 0.01, 4))
    kit.add(tl, Matrix.Identity(4), 'iron', iron(0.4, (70, 70, 72)), 76, name='iron')
    rope = tube([(0.6 + 0.12 * math.cos(a / 4), 1.45 + 0.14 * math.sin(a / 4), -HZ + WT / 2 + 0.06 + 0.004 * a) for a in range(0, 76)], 0.012, 5)
    kit.add(rope, Matrix.Identity(4), 'rope', ROPE, 77, name='cloth')

    # Calendar and a pinned notice by the door.
    pp = new()
    box(pp, (1.15, 1.55, HZ - WT / 2 - 0.025), (0.28, 0.36, 0.005))
    box(pp, (1.55, 1.45, HZ - WT / 2 - 0.025), (0.2, 0.26, 0.005))
    kit.add(pp, Matrix.Identity(4), 'paper', PAPER, 78, name='paper')

    # Hanging lantern from the ridge on a chain (the game's pointLight sits here).
    ch = new()
    for k in range(10):
        y = RIDGE - 0.15 - k * 0.12
        append(ch, lathe([(0.02, -0.04), (0.026, -0.04), (0.026, 0.04), (0.02, 0.04)], 6), T(0, y, 0) @ (RX(math.pi / 2) if k % 2 else RZ(math.pi / 2)))
    kit.add(ch, Matrix.Identity(4), 'iron', iron(0.4), 79, name='iron')
    lantern(kit, (0, RIDGE - 1.6 - 0.4, 0), 80)
    kit.anchor('hanging-lantern', 0, RIDGE - 1.85, 0, note='matches the existing warm pointLight; no new light')


def outside():
    # Rain barrel at the front-east corner, logs stacked against the back wall.
    br = lathe([(0, 0), (0.3, 0), (0.33, 0.45), (0.3, 0.9), (0, 0.9)], 14)
    kit.add(br, T(HX + 0.55, 0, HZ - 0.4), 'wood', wood((80, 60, 42), 0.35, weather=0.5), 91, name='furniture', smooth=True)
    hp = new()
    for y, r in ((0.1, 0.305), (0.8, 0.305), (0.35, 0.33), (0.55, 0.33)):
        append(hp, lathe([(r, y - 0.015), (r + 0.006, y - 0.015), (r + 0.006, y + 0.015), (r, y + 0.015)], 14, cap=False), T(HX + 0.55, 0, HZ - 0.4))
    kit.add(hp, Matrix.Identity(4), 'iron', iron(0.7), 92, name='iron')
    wa = cyl(0.29, 0.01, 14, 0.82)
    kit.add(wa, T(HX + 0.55, 0, HZ - 0.4), 'water', const((20, 24, 26)), 93, name='water')
    kit.collider(HX + 0.55, HZ - 0.4, 0.34, 0.45, 0.34, note='rain barrel')
    lg = new()
    for row in range(4):
        for i in range(9 - row):
            x = -1.6 + i * 0.24 + row * 0.12 + R.uniform(-0.02, 0.02)
            append(lg, cyl(0.11 + R.uniform(-0.02, 0.02), 0.55, 8), T(x, 0.11 + row * 0.2, -HZ - WT / 2 - 0.35) @ RX(math.pi / 2) @ T(0, -0.27, 0))
    kit.add(lg, Matrix.Identity(4), 'wood', wood((104, 78, 54), 0.4, weather=0.3), 94, name='furniture')
    kit.collider(-0.6, -HZ - WT / 2 - 0.35, 1.15, 0.42, 0.3, note='log stack')


def build():
    walls()
    floor()
    roof()
    door()
    windows()
    stove()
    furniture()
    outside()


def preview():
    preview_setup(world=(0.06, 0.07, 0.085), strength=1.0)
    ground(40, (44, 50, 36))
    light('SUN', (0, 10, 0), 1.8, (0.75, 0.8, 0.95), rot=(math.radians(55), 0, math.radians(-30)))
    light('POINT', (0, RIDGE - 1.85, 0), 60, (1, 0.6, 0.3), 0.4)
    light('POINT', (-2.1, 0.5, -2.3), 15, (1, 0.45, 0.2), 0.2)
    shoot(PREVIEW, {
        'hut-front': ((5.5, 1.8, 10), (0, 1.6, 1), 30),
        'hut-back': ((-6.5, 2.6, -9), (0, 1.4, -1), 30),
        'hut-in-bench': ((0.3, 1.6, 2.4), (0, 1.0, -3), 24),
        'hut-in-west': ((1.4, 1.6, 1.8), (-3, 0.8, -0.2), 24),
        'hut-in-east': ((-1.2, 1.6, 1.6), (3, 0.9, -0.6), 24),
        'hut-in-door': ((0.2, 1.6, -1.6), (-0.5, 1.2, 3), 24),
    })


clear_scene()
build()
coll = make_objects(kit, 'hut')
size = export(coll, OUT, {'surfaces': {'east-table-y': SURFACE, 'west-table-y': SURFACE}}, kit)
preview()
print('STATS ' + json.dumps({'tris': kit.tris(), 'objects': len(coll.objects), 'colliders': len(kit.colliders), 'bytes': size}))
