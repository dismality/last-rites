"""Chapel shell for Last Rites: masonry walls with real openings, buttresses, slate roof, bellcote, ceiling.

  blender -b --factory-startup --python tools/blender/chapel_exterior.py -- OUT_GLB PREVIEW_DIR [INTERIOR_GLB]

Chapel-local game coordinates (origin = CHAPEL_CENTER, no rotation), matching CHAPEL in cemeteryLayout.ts:
halfX 2.5, halfZ 6, height 3, wall 0.3, front door 1.4 wide x 2.5 high in the -Z wall, vestry door 1.4 wide centred on
local z 4.5 in the west wall, windows at z +-1.5 on both side walls (opening 0.62 wide, sill 1.02, apex 2.5, matching
the interior's leaded glass), roof rise 2 with 0.4 overhang, bellcote over z -4.9. The game keeps its wall colliders;
this replaces what is drawn. The bell is its own mesh ("chapel-ext-bell") pivoting at its yoke, so it can swing.
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sclib import *  # noqa
import bpy

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT, PREVIEW = ARGV[0], ARGV[1]
INTERIOR = ARGV[2] if len(ARGV) > 2 else None

HX, HZ, H, WT = 2.5, 6.0, 3.0, 0.3
OX, OZ = HX + WT / 2, HZ + WT / 2          # outer faces
IX, IZ = HX - WT / 2, HZ - WT / 2          # inner faces
RISE, EAVE = 2.0, 0.4
RX_ = HX + EAVE                          # roof half width at the eaves (2.9)
DOOR_W, DOOR_H = 1.4, 2.5
VESTRY_Z = 4.5
WIN = dict(w=0.62, sill=1.02, spring=1.91, apex=2.5)
WINDOW_Z = (-1.5, 1.5)
BUTTRESS_Z = (-3.0, 0.0, 3.0)
CORNER_Z = (-5.9, 5.9)
BELL_Z = -HZ + 1.1
RIDGE = H + RISE
OCULUS = dict(v=4.0, r=0.4)

kit = Kit()


def roof_y(x):
    """Underside of the roof sarking above x."""
    return H + RISE * (1 - abs(x) / RX_)


# ------------------------------------------------------------------ walls ----------------------------------------------
def opening_v(o, u):
    k = o[0]
    if k == 'rect':
        _, u0, u1, v0, v1 = o
        return (v0, v1) if u0 < u < u1 else None
    if k == 'arch':
        _, uc, w, sill, spring, apex = o
        return (sill, arch_top(w, spring, apex, u - uc)) if abs(u - uc) < w / 2 else None
    if k == 'circle':
        _, uc, vc, r = o
        d = u - uc
        if abs(d) < r:
            h = math.sqrt(r * r - d * d)
            return (vc - h, vc + h)
    return None


def opening_u(o, va, vb, pad=0.0):
    k = o[0]
    if k == 'rect':
        _, u0, u1, v0, v1 = o
        return (u0 - pad, u1 + pad) if vb > v0 and va < v1 else None
    if k == 'arch':
        _, uc, w, sill, spring, apex = o
        if vb <= sill or va >= apex + pad:
            return None
        if va < spring:
            half = w / 2
        else:
            half = max([abs(x) for x, y in arch_curve(w, spring, apex, 24) if y >= va - 1e-6] + [0.02])
        return (uc - half - pad, uc + half + pad)
    if k == 'circle':
        _, uc, vc, r = o
        dmin = 0 if va <= vc <= vb else min(abs(va - vc), abs(vb - vc))
        if dmin >= r + pad:
            return None
        half = math.sqrt(max(0.0, (r + pad) ** 2 - dmin ** 2))
        return (uc - half, uc + half)
    return None


def wall_pos(w, u, v, d):
    """Game position on wall w at run u, height v, d metres outward from the wall's centre line."""
    if w['axis'] == 'x':
        return (u, v, w['fixed'] + w['out'] * d)
    return (w['fixed'] + w['out'] * d, v, u)


def wall_box(bm, w, u0, u1, v0, v1, d0, d1):
    """Box on wall w spanning run u0..u1, height v0..v1, depth d0..d1 measured outward from the centre line."""
    uc, vc, dc = (u0 + u1) / 2, (v0 + v1) / 2, (d0 + d1) / 2
    su, sv, sd = u1 - u0, v1 - v0, abs(d1 - d0)
    p = wall_pos(w, uc, vc, dc)
    s = (su, sv, sd) if w['axis'] == 'x' else (sd, sv, su)
    box(bm, p, s)


def core_painter(w):
    out = Vector((0, w['out'], 0)) if w['axis'] == 'x' else Vector((w['out'], 0, 0))
    out = G(*out)
    mortar, plaster, reveal = stone((84, 80, 72), 0.25), flat((178, 168, 148), 0.14, 2.5), stone((150, 144, 130), 0.1)

    def f(L, P, N, s, g):
        d = N.dot(out)
        if d > 0.5:
            return mortar(L, P, N, s, g)
        if d < -0.5:
            c = plaster(L, P, N, s, g)
            return lerp(c, GRIME, 0.35 * (1 - smoothstep(0.0, 0.9, P.z)))
        return reveal(L, P, N, s, g)
    return f


COURSES = []
_v = 0.0
while _v < RIDGE + 0.2:
    _h = R.uniform(0.24, 0.34)
    COURSES.append((_v, _v + _h))
    _v += _h


def build_wall(w):
    u0, u1 = w['core']
    ops = w['open']
    top = w['top']
    core = new()
    # Core: plain spans where no opening is, 5 cm strips where one is.
    cuts = sorted({u0, u1} | {x for o in ops for x in (opening_u(o, -1, 99) or ()) if u0 < x < u1})
    for a, b in zip(cuts, cuts[1:]):
        mid = (a + b) / 2
        hit = any(opening_v(o, mid) for o in ops)
        gable = top(a) != top(b)
        if not hit and not gable:
            wall_box(core, w, a, b, 0, top(mid), -WT / 2, WT / 2)
            continue
        n = max(1, int(math.ceil((b - a) / 0.05)))
        for i in range(n):
            ua, ub = a + (b - a) * i / n, a + (b - a) * (i + 1) / n
            uc = (ua + ub) / 2
            t = min(top(ua), top(ub)) if gable else top(uc)
            solid = [(0.0, t)]
            for o in ops:
                cut = opening_v(o, uc)
                if not cut:
                    continue
                nxt = []
                for s0, s1 in solid:
                    if cut[1] <= s0 or cut[0] >= s1:
                        nxt.append((s0, s1))
                        continue
                    if cut[0] > s0:
                        nxt.append((s0, cut[0]))
                    if cut[1] < s1:
                        nxt.append((cut[1], s1))
                solid = nxt
            for s0, s1 in solid:
                if s1 - s0 > 0.005:
                    wall_box(core, w, ua, ub, s0, s1, -WT / 2, WT / 2)
    kit.add(core, Matrix.Identity(4), 'stone', core_painter(w), w['seed'], name='walls')

    # Ashlar facing on the outer face, clipped around openings and under the roof line.
    tones = [(132, 126, 114), (118, 113, 104), (142, 136, 122), (124, 116, 100), (108, 104, 98)]
    bms = [new() for _ in tones]
    bu0, bu1 = w['face']
    for ci, (va, vb) in enumerate(COURSES):
        if va >= w['max_top']:
            break
        u = bu0 - (R.uniform(0, 0.4) if ci % 2 else 0.0)
        while u < bu1:
            L = R.uniform(0.38, 0.78)
            a, b = max(u, bu0), min(u + L, bu1)
            u += L
            if b - a < 0.08:
                continue
            pieces = [(a, b)]
            for o in ops:
                cut = opening_u(o, va, vb, 0.0)
                if not cut:
                    continue
                nxt = []
                for p0, p1 in pieces:
                    if cut[1] <= p0 or cut[0] >= p1:
                        nxt.append((p0, p1))
                        continue
                    if cut[0] > p0:
                        nxt.append((p0, cut[0]))
                    if cut[1] < p1:
                        nxt.append((cut[1], p1))
                pieces = nxt
            for p0, p1 in pieces:
                # Gable: shorten to stay under the roof line at the block's top.
                if w['gable']:
                    lim = RX_ * (1 - (vb - H) / RISE) if vb > H else 99
                    p0, p1 = max(p0, -lim), min(p1, lim)
                if p1 - p0 < 0.06:
                    continue
                proud = R.uniform(0.018, 0.04)
                wall_box(bms[R.randrange(len(tones))], w, p0 + 0.006, p1 - 0.006, va + 0.006, vb - 0.006, WT / 2 - 0.01, WT / 2 + proud)
    for i, (bm, tone) in enumerate(zip(bms, tones)):
        bevel(bm, 0.012)
        jitter(bm, 0.004, w['seed'] + i, 6)
        kit.add(bm, Matrix.Identity(4), 'stone', stone(tone, moss=0.45, grime_h=0.7, streak=0.35), w['seed'] + i, name='ashlar')


def gable_top(u):
    return roof_y(u) - 0.02


WALLS = [
    dict(axis='x', fixed=-HZ, out=-1, core=(-OX, OX), face=(-OX - 0.05, OX + 0.05), top=gable_top, max_top=RIDGE, gable=True,
         open=[('rect', -DOOR_W / 2, DOOR_W / 2, -1, DOOR_H)], seed=1),
    dict(axis='x', fixed=HZ, out=1, core=(-OX, OX), face=(-OX - 0.05, OX + 0.05), top=gable_top, max_top=RIDGE, gable=True,
         open=[('circle', 0.0, OCULUS['v'], OCULUS['r'])], seed=2),
    dict(axis='z', fixed=-HX, out=-1, core=(-IZ, IZ), face=(-OZ, OZ), top=lambda u: H, max_top=H, gable=False,
         open=[('rect', VESTRY_Z - 0.7, VESTRY_Z + 0.7, -1, DOOR_H)] +
              [('arch', z, WIN['w'], WIN['sill'], WIN['spring'], WIN['apex']) for z in WINDOW_Z], seed=3),
    dict(axis='z', fixed=HX, out=1, core=(-IZ, IZ), face=(-OZ, OZ), top=lambda u: H, max_top=H, gable=False,
         open=[('arch', z, WIN['w'], WIN['sill'], WIN['spring'], WIN['apex']) for z in WINDOW_Z], seed=4),
]


# ------------------------------------------------------------------ dressings ------------------------------------------
DRESSED = stone((156, 150, 136), moss=0.3, grime_h=0.6, streak=0.2)


def plinth_and_courses():
    bm = new()
    for w in WALLS:
        doors = [o for o in w['open'] if o[0] == 'rect']
        a0, a1 = w['face']
        spans = [(a0, a1)]
        for o in doors:
            nxt = []
            for p0, p1 in spans:
                if o[2] <= p0 or o[1] >= p1:
                    nxt.append((p0, p1))
                    continue
                if o[1] > p0:
                    nxt.append((p0, o[1]))
                if o[2] < p1:
                    nxt.append((o[2], p1))
            spans = nxt
        for p0, p1 in spans:
            wall_box(bm, w, p0, p1, 0.0, 0.32, WT / 2 - 0.02, WT / 2 + 0.09)          # plinth
            wall_box(bm, w, p0, p1, 0.32, 0.38, WT / 2 - 0.02, WT / 2 + 0.05)         # chamfer step
        if w['axis'] == 'z':
            # Sill course under the windows, and a cornice of corbels under the eaves.
            for p0, p1 in spans:
                wall_box(bm, w, p0, p1, WIN['sill'] - 0.1, WIN['sill'] - 0.02, WT / 2 - 0.02, WT / 2 + 0.07)
            wall_box(bm, w, -OZ - 0.05, OZ + 0.05, H - 0.1, H, WT / 2 - 0.02, WT / 2 + 0.16)
            u = -OZ + 0.2
            while u < OZ - 0.1:
                wall_box(bm, w, u - 0.07, u + 0.07, H - 0.3, H - 0.1, WT / 2, WT / 2 + 0.12)
                u += 0.45
    bevel(bm, 0.008)
    kit.add(bm, Matrix.Identity(4), 'stone', DRESSED, 21, name='dressings')


def buttress(x_sign=None, z=None, front=None, x=None):
    """Stepped buttress; side buttresses project along x, front/back ones along z."""
    prof = [(0, 0), (0.7, 0), (0.7, 0.3), (0.62, 0.38), (0.62, 1.35), (0.44, 1.6), (0.44, 2.35), (0.08, 2.95), (0, 2.95)]
    bm = prism(prof, 0.56)
    caps = new()
    for y, d in ((1.35, 0.62), (2.35, 0.44)):
        box(caps, (d / 2 + 0.02, y + 0.02, 0), (d + 0.06, 0.05, 0.62))
    append(bm, caps)
    bevel(bm, 0.01)
    jitter(bm, 0.006, z or x or 0, 5)
    if front is None:
        M = T(x_sign * OX, 0, z) @ (RY(0) if x_sign > 0 else RY(math.pi))
        kit.collider(x_sign * (OX + 0.35), z, 0.36, 1.48, 0.29, note='buttress')
    else:
        M = T(x, 0, front * OZ) @ RY(-front * math.pi / 2)
        kit.collider(x, front * (OZ + 0.35), 0.29, 1.48, 0.36, note='buttress')
    kit.add(bm, M, 'stone', stone((136, 130, 118), moss=0.6, grime_h=0.8, streak=0.3), (z or 0) + (x or 0), name='buttresses')


def windows_outside():
    for side in (-1, 1):
        w = WALLS[2] if side < 0 else WALLS[3]
        for z in WINDOW_Z:
            M = T(side * OX, 0, z) @ RY(-side * math.pi / 2)    # local +Z points out of the wall
            ring = arch_ring(WIN['w'], WIN['spring'], WIN['apex'], 0.1, 0.12, 12, z0=-0.02)
            hood = arch_ring(WIN['w'] + 0.26, WIN['spring'], WIN['apex'] + 0.15, 0.06, 0.1, 12, z0=0.03)
            for sx in (-1, 1):  # jamb stones and label stops
                for v in (WIN['sill'], WIN['sill'] + 0.32, WIN['sill'] + 0.62):
                    box(ring, (sx * (WIN['w'] / 2 + 0.07), v + 0.14, 0.04), (0.14 + R.uniform(0, 0.06), 0.28, 0.12))
                box(hood, (sx * (WIN['w'] / 2 + 0.2), WIN['spring'] - 0.04, 0.08), (0.1, 0.12, 0.1))
            box(ring, (0, WIN['sill'] - 0.04, 0.06), (WIN['w'] + 0.36, 0.08, 0.22))   # sill, proud
            append(ring, hood)
            bevel(ring, 0.006)
            kit.add(ring, M, 'stone', DRESSED, z * side, name='dressings')
            # Iron storm grille on the outside.
            g = new()
            for gx in (-0.15, 0.0, 0.15):
                top = arch_top(WIN['w'], WIN['spring'], WIN['apex'], gx) - 0.02
                box(g, (gx, (WIN['sill'] + top) / 2, 0.05), (0.018, top - WIN['sill'], 0.018))
            for gv in (1.35, 1.75):
                box(g, (0, gv, 0.05), (WIN['w'] - 0.02, 0.018, 0.018))
            kit.add(g, M, 'iron', iron(0.5), z, name='iron')


def front_door():
    M = T(0, 0, -OZ)                                     # front face; local -Z points out
    bm = new()
    for sx in (-1, 1):
        x = sx * (DOOR_W / 2 + 0.11)
        append(bm, cyl(0.075, DOOR_H - 0.3, 10, 0.15), T(x, 0, -0.06))                # colonnettes
        append(bm, lathe([(0, 0), (0.13, 0), (0.13, 0.15), (0, 0.15)], 8), T(x, 0, -0.06))
        append(bm, lathe([(0, DOOR_H - 0.17), (0.08, DOOR_H - 0.17), (0.14, DOOR_H - 0.03), (0.15, DOOR_H), (0, DOOR_H)], 8), T(x, 0, -0.06))
        box(bm, (sx * (DOOR_W / 2 + 0.04), DOOR_H / 2, 0.0), (0.08, DOOR_H, 0.34))     # jamb returns
    box(bm, (0, DOOR_H + 0.06, -0.02), (DOOR_W + 0.08, 0.12, 0.3))                       # lintel
    for i, (th, ap) in enumerate(((0.12, 3.2), (0.12, 3.42))):
        r = arch_ring(DOOR_W + 0.24 + i * 0.28, DOOR_H, ap, th, 0.16 - i * 0.04, 14, z0=-0.17 + i * 0.03)
        append(bm, r, RY(0))
    hood = arch_ring(DOOR_W + 0.95, DOOR_H + 0.05, 3.7, 0.07, 0.1, 14, z0=-0.12)
    append(bm, hood)
    for sx in (-1, 1):
        box(bm, (sx * (DOOR_W / 2 + 0.52), DOOR_H, -0.08), (0.12, 0.14, 0.12))
    bevel(bm, 0.006)
    kit.add(bm, M, 'stone', DRESSED, 31, name='dressings')
    # Tympanum: recessed panel with a carved cross and two roundels.
    ty = prism(arch_curve(DOOR_W, DOOR_H + 0.12, 3.08, 14), 0.04, z0=-0.165)
    kit.add(ty, M, 'stone', stone((112, 108, 100), 0.2), 32, name='dressings')
    cr = new()
    box(cr, (0, 2.78, -0.2), (0.07, 0.42, 0.04))
    box(cr, (0, 2.86, -0.2), (0.28, 0.07, 0.04))
    for sx in (-1, 1):
        append(cr, lathe([(0, 0), (0.07, 0), (0.07, 0.03), (0, 0.03)], 10), T(sx * 0.38, 2.72, -0.17) @ RX(math.pi / 2))
    kit.add(cr, M, 'stone', DRESSED, 33, name='dressings')
    # Threshold and two worn flags outside.
    fl = new()
    box(fl, (0, 0.03, -0.12), (DOOR_W + 0.1, 0.06, 0.34))
    box(fl, (0.05, 0.015, -0.7), (1.6, 0.03, 0.75))
    box(fl, (-0.1, 0.012, -1.45), (1.3, 0.024, 0.7))
    bevel(fl, 0.02)
    jitter(fl, 0.006, 4)
    kit.add(fl, M, 'stone', stone((120, 116, 108), moss=0.5, grime_h=0.2), 34, name='dressings')
    # Lantern bracket by the door (light anchor for the game).
    lb = new()
    append(lb, tube([(1.35, 2.25, -0.02), (1.35, 2.25, -0.3), (1.35, 2.15, -0.4)], 0.018, 6))
    append(lb, tube([(1.35, 1.95, -0.02), (1.35, 2.2, -0.28)], 0.012, 5))
    kit.add(lb, M, 'iron', iron(0.4), 35, name='iron')
    lantern(kit, (1.35, 1.72, -OZ - 0.4), 36)
    kit.anchor('door-lantern-light', 1.35, 1.88, -OZ - 0.4)
    # Boot scraper.
    bs = new()
    box(bs, (-1.2, 0.06, -0.3), (0.3, 0.12, 0.08))
    box(bs, (-1.2, 0.12, -0.3), (0.32, 0.015, 0.012))
    kit.add(bs, M, 'iron', iron(0.7), 37, name='iron')


def vestry_door():
    M = T(-OX, 0, VESTRY_Z) @ RY(math.pi / 2)            # local +Z points out (west)
    bm = new()
    for sx in (-1, 1):
        for i, v in enumerate((0.0, 0.42, 0.78, 1.22, 1.6, 2.02)):
            wide = 0.24 if i % 2 else 0.16
            box(bm, (sx * (0.7 + wide / 2), v + 0.2, 0.03), (wide, 0.4, 0.1))
    box(bm, (0, DOOR_H + 0.12, 0.03), (DOOR_W + 0.5, 0.24, 0.12))
    for k in range(5):  # flat arch voussoirs over the lintel
        box(bm, (-0.6 + k * 0.3, DOOR_H + 0.12, 0.09), (0.26, 0.22, 0.02))
    box(bm, (0, DOOR_H + 0.3, 0.06), (DOOR_W + 0.7, 0.08, 0.14))                          # hood
    box(bm, (0, 0.03, 0.12), (DOOR_W + 0.1, 0.06, 0.3))                                    # step
    bevel(bm, 0.006)
    kit.add(bm, M, 'stone', DRESSED, 41, name='dressings')


def oculus():
    M = T(0, OCULUS['v'], OZ)                             # back face, local +Z out
    r = OCULUS['r']
    ring = new()
    n = 16
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        pts = [(r * math.cos(a0), r * math.sin(a0)), (r * math.cos(a1), r * math.sin(a1)),
               ((r + 0.14) * math.cos(a1), (r + 0.14) * math.sin(a1)), ((r + 0.14) * math.cos(a0), (r + 0.14) * math.sin(a0))]
        append(ring, prism(pts, 0.14, z0=-0.02))
    # Quatrefoil tracery.
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        cx, cy = 0.17 * math.cos(a), 0.17 * math.sin(a)
        for i in range(10):
            b0, b1 = 2 * math.pi * i / 10, 2 * math.pi * (i + 1) / 10
            rr = 0.15
            pts = [(cx + rr * math.cos(b0), cy + rr * math.sin(b0)), (cx + rr * math.cos(b1), cy + rr * math.sin(b1)),
                   (cx + (rr + 0.03) * math.cos(b1), cy + (rr + 0.03) * math.sin(b1)), (cx + (rr + 0.03) * math.cos(b0), cy + (rr + 0.03) * math.sin(b0))]
            append(ring, prism(pts, 0.06, z0=-0.15))
    kit.add(ring, M, 'stone', DRESSED, 51, name='dressings')
    gl = prism([(r * math.cos(2 * math.pi * i / 16), r * math.sin(2 * math.pi * i / 16)) for i in range(16)], 0.01, z0=-0.16)
    kit.add(gl, M, 'glass', glass_amber, 52, name='glow')
    # Stone cross on the back gable apex.
    cr = new()
    box(cr, (0, RIDGE + 0.12, OZ - 0.1), (0.36, 0.24, 0.4))
    box(cr, (0, RIDGE + 0.62, OZ - 0.1), (0.1, 0.8, 0.1))
    box(cr, (0, RIDGE + 0.74, OZ - 0.1), (0.42, 0.1, 0.1))
    bevel(cr, 0.008)
    kit.add(cr, Matrix.Identity(4), 'stone', DRESSED, 53, name='dressings')


# ------------------------------------------------------------------ roof -----------------------------------------------
SLOPE = math.atan2(RISE, RX_)
SLEN = math.hypot(RISE, RX_)
RZ0, RZ1 = -HZ - EAVE, HZ + EAVE


def on_slope(side, s, off):
    """Game point on the roof slope `side` at distance s up from the eave, `off` above the sarking (perpendicular)."""
    x = side * (RX_ - s * math.cos(SLOPE))
    y = H + s * math.sin(SLOPE)
    nx, ny = side * math.sin(SLOPE), math.cos(SLOPE)
    return x + nx * off, y + ny * off


def roof():
    sark = new()
    for side in (-1, 1):
        x, y = on_slope(side, SLEN / 2, -0.04)
        box(sark, (x, y, 0), (SLEN + 0.02, 0.08, RZ1 - RZ0), M=None)
        # rotate about the box's own centre: rebuild with matrix
    sark.free()
    sark = new()
    for side in (-1, 1):
        x, y = on_slope(side, SLEN / 2, -0.04)
        bmesh.ops.create_cube(sark, size=1.0, matrix=T(x, y, 0) @ RZ(-side * SLOPE) @ S(SLEN + 0.02, 0.08, RZ1 - RZ0))
    kit.add(sark, Matrix.Identity(4), 'wood', wood((46, 32, 22), 0.25), 61, name='roof-timber')

    tones = [(50, 54, 60), (60, 62, 66), (44, 48, 54), (66, 64, 60)]
    bms = [new() for _ in tones]
    exposure, tile_len = 0.19, 0.4
    for side in (-1, 1):
        s = -0.06
        row = 0
        while s < SLEN - 0.08:
            z = RZ0 + (0.0 if row % 2 else -0.15)
            while z < RZ1:
                w = R.uniform(0.24, 0.34)
                a, b = max(z, RZ0), min(z + w, RZ1)
                z += w
                if b - a < 0.08 or R.random() < 0.015:
                    continue
                slip = 0.06 if R.random() < 0.02 else 0.0
                L = min(tile_len, SLEN - s + 0.05)
                cx, cy = on_slope(side, s + L / 2 - slip, 0.012 + 0.012 * 1.4)
                M = T(cx, cy, (a + b) / 2) @ RZ(-side * SLOPE) @ RZ(side * math.radians(R.uniform(2, 4.5))) \
                    @ RY(math.radians(R.uniform(-1.5, 1.5)))
                bmesh.ops.create_cube(bms[R.randrange(len(tones))], size=1.0, matrix=M @ S(L, 0.014, b - a - 0.012))
            s += exposure
            row += 1
    for bm, tone in zip(bms, tones):
        kit.add(bm, Matrix.Identity(4), 'slate', slate(tone), tone[0], name='slates')

    # Ridge: rolled clay ridge tiles.
    rid = new()
    z = RZ0 - 0.02
    while z < RZ1:
        L = 0.42
        t = lathe([(0.11, 0), (0.11, L - 0.02), (0.125, L)], 10, start=0, sweep=math.pi, cap=False)
        for v in t.verts:
            v.co = Vector((v.co.x, v.co.y, v.co.z))
        append(rid, t, T(0, RIDGE + 0.02, z) @ RX(math.pi / 2) @ RY(0))
        z += L - 0.03
    bmesh.ops.recalc_face_normals(rid, faces=rid.faces)
    kit.add(rid, Matrix.Identity(4), 'slate', flat((86, 60, 46), 0.25), 62, name='slates')

    # Bargeboards on both gables, fascia boards along both eaves.
    tb = new()
    for zs in (-1, 1):
        for side in (-1, 1):
            x, y = on_slope(side, SLEN / 2, -0.04)
            bmesh.ops.create_cube(tb, size=1.0, matrix=T(x, y - 0.06, zs * (RZ1 - 0.03)) @ RZ(-side * SLOPE) @ S(SLEN + 0.06, 0.24, 0.05))
        # A little king post and finial where the boards meet.
        box(tb, (0, RIDGE - 0.15, zs * (RZ1 - 0.03)), (0.08, 0.5, 0.07))
    for side in (-1, 1):
        box(tb, (side * (RX_ + 0.01), H - 0.05, 0), (0.05, 0.2, RZ1 - RZ0 + 0.04))
    kit.add(tb, Matrix.Identity(4), 'wood', wood((40, 30, 24), 0.25, weather=0.35), 63, name='roof-timber')
    # Cast-iron gutters and a downpipe at each corner.
    gu = new()
    for side in (-1, 1):
        append(gu, lathe([(0.07, 0), (0.07, RZ1 - RZ0)], 8, start=math.pi, sweep=math.pi, cap=False),
               T(side * (RX_ + 0.08), H - 0.05, RZ0) @ RX(math.pi / 2) @ RY(math.pi / 2))
        for zs in (-1, 1):
            append(gu, tube([(side * (RX_ + 0.08), H - 0.08, zs * (RZ1 - 0.25)), (side * (OX + 0.06), H - 0.4, zs * (OZ - 0.32)),
                             (side * (OX + 0.06), 0.2, zs * (OZ - 0.32)), (side * (OX + 0.25), 0.04, zs * (OZ - 0.32))], 0.035, 8))
    kit.add(gu, Matrix.Identity(4), 'iron', iron(0.55, (30, 30, 32)), 64, name='iron')

    # Ceiling boards inside, at the wall tops.
    ce = new()
    x = -IX
    while x < IX - 1e-3:
        w = min(0.17, IX - x)
        box(ce, (x + w / 2, H - 0.015 + R.uniform(-0.003, 0.003), 0), (w - 0.01, 0.03, IZ * 2))
        x += w
    kit.add(ce, Matrix.Identity(4), 'wood', wood((62, 44, 30), 0.3), 65, name='ceiling')


# ------------------------------------------------------------------ bellcote -------------------------------------------
def bellcote():
    z = BELL_Z
    base_lo, base_hi, post_hi = 4.25, 5.25, 6.45
    hw = 0.72
    clad = new()
    for zs in (-1, 1):
        plank_run(clad, 'x', -hw, hw, z + zs * hw, base_lo, base_hi, 0.03, 0.12, vertical=True)
    for xs in (-1, 1):
        plank_run(clad, 'z', z - hw, z + hw, xs * hw, base_lo, base_hi, 0.03, 0.12, vertical=True)
    box(clad, (0, base_hi + 0.03, z), (hw * 2 + 0.14, 0.06, hw * 2 + 0.14))           # sill plate
    for xs in (-1, 1):
        for zs in (-1, 1):
            box(clad, (xs * (hw - 0.07), (base_hi + post_hi) / 2, z + zs * (hw - 0.07)), (0.14, post_hi - base_hi, 0.14))
    for zs in (-1, 1):  # head beams, braces and louvres on the front and back
        box(clad, (0, post_hi - 0.06, z + zs * (hw - 0.07)), (hw * 2, 0.12, 0.16))
        for xs in (-1, 1):
            bmesh.ops.create_cube(clad, size=1.0, matrix=T(xs * (hw - 0.26), post_hi - 0.26, z + zs * (hw - 0.07)) @ RZ(xs * 0.75) @ S(0.44, 0.07, 0.07))
        for k in range(3):
            bmesh.ops.create_cube(clad, size=1.0, matrix=T(0, base_hi + 0.12 + k * 0.11, z + zs * (hw - 0.06)) @ RX(zs * 0.6) @ S(hw * 2 - 0.2, 0.012, 0.13))
    for xs in (-1, 1):
        box(clad, (xs * (hw - 0.07), post_hi - 0.06, z), (0.16, 0.12, hw * 2))
        for k in range(3):
            bmesh.ops.create_cube(clad, size=1.0, matrix=T(xs * (hw - 0.06), base_hi + 0.12 + k * 0.11, z) @ RZ(-xs * 0.6) @ S(0.13, 0.012, hw * 2 - 0.2))
    box(clad, (0, base_hi + 0.85, z), (hw * 2 - 0.1, 0.1, 0.12))                       # bell beam
    kit.add(clad, Matrix.Identity(4), 'wood', wood((56, 40, 28), 0.3, weather=0.45), 71, name='bellcote')
    # Lead flashing where the base meets the roof.
    fl = new()
    for side in (-1, 1):
        x, y = on_slope(side, (RX_ - hw) / math.cos(SLOPE), 0.03)
        bmesh.ops.create_cube(fl, size=1.0, matrix=T(side * (hw + 0.04), y + 0.08, z) @ RZ(-side * SLOPE) @ S(0.25, 0.02, hw * 2 + 0.25))
    kit.add(fl, Matrix.Identity(4), 'iron', flat((70, 74, 78), 0.2), 72, name='iron')
    # Spire: courses of slate on a four-sided pyramid.
    sp = new()
    y0, y1, r0 = post_hi, post_hi + 1.25, hw + 0.22
    n = 9
    for i in range(n):
        a, b = i / n, (i + 1) / n
        ra, rb = r0 * (1 - a) + 0.02, r0 * (1 - b) + 0.02
        ya, yb = y0 + (y1 - y0) * a, y0 + (y1 - y0) * b
        band = lathe([(0, ya - 0.02), (ra + 0.025, ya - 0.02), (ra + 0.01, ya + 0.01), (rb, yb + 0.03), (0, yb + 0.03)], 4, start=math.pi / 4)
        append(sp, band, T(0, 0, z))
    kit.add(sp, Matrix.Identity(4), 'slate', slate((48, 52, 58)), 73, name='slates')
    fin = new()
    append(fin, lathe([(0, 0), (0.05, 0), (0.06, 0.05), (0.03, 0.12), (0.05, 0.16), (0, 0.24)], 8), T(0, y1, z))
    box(fin, (0, y1 + 0.55, z), (0.035, 0.7, 0.035))
    box(fin, (0, y1 + 0.68, z), (0.32, 0.035, 0.035))
    ring = lathe([(0.11, -0.012), (0.13, -0.012), (0.13, 0.012), (0.11, 0.012)], 14)
    append(fin, ring, T(0, y1 + 0.68, z) @ RX(math.pi / 2))
    kit.add(fin, Matrix.Identity(4), 'iron', iron(0.3, (34, 32, 30)), 74, name='iron')
    # The bell, pivoting at its yoke (separate mesh so the game can swing it).
    pivot = (0, base_hi + 0.78, z)
    bell = lathe([(0, 0.0), (0.06, 0.0), (0.1, -0.02), (0.15, -0.08), (0.17, -0.2), (0.19, -0.33), (0.25, -0.46), (0.31, -0.52),
                  (0.32, -0.55), (0.28, -0.55), (0.24, -0.5), (0.16, -0.36), (0.13, -0.16), (0.0, -0.12)], 14)
    yoke = new()
    box(yoke, (0, 0.05, 0), (0.5, 0.1, 0.12))
    clap = lathe([(0, -0.2), (0.015, -0.2), (0.015, -0.42), (0.045, -0.45), (0.045, -0.5), (0, -0.52)], 8)
    b = merge(bell, clap)
    kit.add(b, T(*pivot), 'brass', flat((112, 92, 52), 0.3), 75, name='bell', smooth=True, origin=pivot)
    kit.add(yoke, T(*pivot), 'wood', wood((50, 36, 26)), 76, name='bell', origin=pivot)
    kit.anchor('bell-pivot', *pivot, note='mesh chapel-ext-bell pivots here; swing about local X')


# ------------------------------------------------------------------ build ----------------------------------------------
def build():
    for w in WALLS:
        build_wall(w)
    plinth_and_courses()
    for side in (-1, 1):
        for z in BUTTRESS_Z + CORNER_Z:
            buttress(x_sign=side, z=z)
    for front in (-1, 1):
        for x in (-2.15, 2.15):
            buttress(front=front, x=x)
    windows_outside()
    front_door()
    vestry_door()
    oculus()
    roof()
    bellcote()


def preview(coll):
    sc = preview_setup(world=(0.05, 0.06, 0.075), strength=0.9)
    ground(60, (44, 50, 36))
    light('SUN', (0, 10, 0), 1.6, (0.75, 0.8, 0.95), rot=(math.radians(50), 0, math.radians(35)))
    light('POINT', (1.35, 1.9, -OZ - 0.45), 25, (1, 0.6, 0.3))
    light('POINT', (0, 1.8, 0), 120, (1, 0.6, 0.3), 1.0)     # glow through the windows
    light('POINT', (0, 2.0, 4.0), 80, (1, 0.6, 0.3), 1.0)
    if INTERIOR and os.path.exists(INTERIOR):
        bpy.ops.import_scene.gltf(filepath=INTERIOR)
    shoot(PREVIEW, {
        'chapel-ext-front': ((-7.5, 2.2, -15.5), (0, 2.6, -2), 30),
        'chapel-ext-side': ((13, 3.5, 4), (0, 2.6, 0), 28),
        'chapel-ext-back': ((6, 2.0, 15), (0, 3.2, 4), 30),
        'chapel-ext-door': ((-1.5, 1.7, -10.5), (0, 2.1, -6), 30),
        'chapel-ext-bellcote': ((-4.5, 7.5, -10), (0, 6.2, -4.9), 40),
        'chapel-ext-vestry': ((-8.5, 1.8, 7.5), (-2.5, 1.6, 3.2), 30),
        'chapel-ext-inside': ((0.2, 1.65, -5.4), (0, 1.5, 4.5), 22),
    })


clear_scene()
build()
coll = make_objects(kit, 'chapel-ext')
size = export(coll, OUT, {'surfaces': {'note': 'walls keep the game colliders; boxes here are the new buttresses'}}, kit)
preview(coll)
print('STATS ' + json.dumps({'tris': kit.tris(), 'objects': len(coll.objects), 'colliders': len(kit.colliders), 'bytes': size}))
