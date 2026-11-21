"""The five readable gravestones for Last Rites, built in detail (they replace the low-poly kit stones).

  blender -b --factory-startup --python tools/blender/headstones.py -- OUT_DIR PREVIEW_DIR

Writes OUT_DIR/gravestone-{round,bevel,cross,wide,broken}.glb. Each stone is fitted to the bounds the
game's colliders already use (HEADSTONE_FOOTPRINTS in src/data/colliderFootprints.ts), so the
colliders and the footprint test hold. Game axes: +X right, +Y up, front face toward +Z.
Every stone: a chamfered plinth, a slab with a moulded border, an incised inscription, weathered
edges, lichen and grime from the shared stone painter.
"""
import os, sys, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sclib import *  # noqa
import bpy
import bmesh
from mathutils import Vector

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT, PREVIEW = ARGV[0], ARGV[1]

# Target bounds (game metres): minX, maxX, minZ, maxZ, height. Must match colliderFootprints.ts.
FOOT = {
    'gravestone-cross': (-0.337, 0.337, -0.247, 0.247, 1.372),
    'gravestone-round': (-0.337, 0.337, -0.188, 0.188, 0.862),
    'gravestone-bevel': (-0.337, 0.337, -0.188, 0.188, 0.794),
    'gravestone-wide': (-0.638, 0.638, -0.225, 0.225, 0.856),
    'gravestone-broken': (-0.337, 0.426, -0.188, 0.4, 0.512),
}

TONES = {
    'gravestone-cross': (132, 128, 118),
    'gravestone-round': (124, 120, 110),
    'gravestone-bevel': (118, 116, 110),
    'gravestone-wide': (128, 122, 108),
    'gravestone-broken': (114, 110, 102),
}
INK = const((56, 53, 48))


def arch_outline(w, h_spring, h_top, n=14):
    """Slab outline (x, y): straight sides to the spring line, then a round head."""
    pts = [(-w / 2, 0.0), (w / 2, 0.0), (w / 2, h_spring)]
    r = w / 2
    rise = h_top - h_spring
    for i in range(1, n):
        a = math.pi * i / n
        pts.append((r * math.cos(a), h_spring + rise * math.sin(a)))
    pts.append((-w / 2, h_spring))
    return pts


def shoulder_outline(w, h_side, h_top, shoulder=0.07):
    """Slab with chamfered shoulders and a low gable."""
    return [(-w / 2, 0.0), (w / 2, 0.0), (w / 2, h_side), (w / 2 - shoulder, h_side + shoulder * 0.6),
            (0.0, h_top), (-w / 2 + shoulder, h_side + shoulder * 0.6), (-w / 2, h_side)]


def scale_outline(pts, k, cy):
    return [(x * k, cy + (y - cy) * k) for x, y in pts]


def slab(pts, depth, y0, z=0.0, bev=0.012, rough=0.004, seed=0.0):
    bm = prism(pts, depth)
    bmesh.ops.subdivide_edges(bm, edges=[e for e in bm.edges if e.calc_length() > 0.12], cuts=2, use_grid_fill=False)
    bevel(bm, bev)
    jitter(bm, rough, seed, 9.0)
    bmesh.ops.translate(bm, verts=bm.verts, vec=G(0, y0, z))
    return bm


def plinth(w, d, h, tiers=1, seed=0.0):
    bm = new()
    y = 0.0
    for t in range(tiers):
        k = 1 - t * 0.14
        box(bm, (0, y + h / 2, 0), (w * k, h, d * k))
        y += h
    bevel(bm, 0.014, 2)
    jitter(bm, 0.004, seed, 7.0)
    return bm, y


def letters(kit, w, y_top, z_face, lines, seed):
    """Incised lettering: each letter a few thin strokes (stems and bars) cut just proud of the face."""
    bm = new()
    r = random.Random(seed)
    y = y_top
    for count, size in lines:
        adv = size * 0.68
        x = -count * adv / 2
        t = size * 0.13
        for _ in range(count):
            if r.random() < 0.13:  # word gaps
                x += adv
                continue
            cw = size * r.uniform(0.42, 0.56)
            strokes = [(x, y - size / 2, t, size)]                                       # left stem
            if r.random() < 0.6:
                strokes.append((x + cw - t, y - size / 2, t, size))                      # right stem
            for by in r.sample((y - t / 2, y - size / 2, y - size + t / 2), r.choice((1, 2))):
                strokes.append((x, by - t / 2, cw, t))                                   # bars
            for sx, sy, sw, sh in strokes:
                box(bm, (sx + sw / 2, sy + sh / 2, z_face + 0.0012), (sw, sh, 0.0025))
            x += adv
        y -= size * 1.75
    kit.add(bm, Matrix.Identity(4), 'stone', INK, seed, name='letters')


def border(kit, pts, depth_z, inset, seed, tone):
    """A raised moulded border round the face: the outline minus a smaller copy, as a thin frame."""
    cy = sum(p[1] for p in pts) / len(pts)
    outer = pts
    inner = scale_outline(pts, 1 - inset, cy)
    bm = new()
    n = len(outer)
    zf, zb = depth_z, depth_z + 0.008
    vo = [bm.verts.new(G(x, y, zb)) for x, y in outer]
    vi = [bm.verts.new(G(x, y, zb)) for x, y in inner]
    vo2 = [bm.verts.new(G(x, y, zf)) for x, y in outer]
    vi2 = [bm.verts.new(G(x, y, zf)) for x, y in inner]
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([vo[i], vo[j], vi[j], vi[i]])
        bm.faces.new([vi2[i], vi2[j], vi[j], vi[i]])
        bm.faces.new([vo[i], vo2[i], vo2[j], vo[j]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    kit.add(bm, Matrix.Identity(4), 'stone', stone(tone, 0.5, 0.4), seed, name='stone')


def fit(kit, foot):
    """Scales and moves every vertex so the whole stone fills the target bounds exactly."""
    minx, maxx, minz, maxz, h = foot
    allv = [v for b in kit.batches.values() for v in b['v']]
    # Blender axes: game x = x, game z = -y, game y = z.
    lo = Vector((min(v.x for v in allv), min(v.y for v in allv), min(v.z for v in allv)))
    hi = Vector((max(v.x for v in allv), max(v.y for v in allv), max(v.z for v in allv)))
    tx0, tx1 = minx, maxx
    ty0, ty1 = -maxz, -minz
    for b in kit.batches.values():
        for v in b['v']:
            v.x = tx0 + (v.x - lo.x) / (hi.x - lo.x) * (tx1 - tx0)
            v.y = ty0 + (v.y - lo.y) / (hi.y - lo.y) * (ty1 - ty0)
            v.z = (v.z - lo.z) / (hi.z - lo.z) * h


def round_stone(kit, tone):
    pb, top = plinth(0.68, 0.38, 0.1, 1, 1)
    kit.add(pb, Matrix.Identity(4), 'stone', stone(tone, 0.9, 0.7), 1, name='stone')
    pts = arch_outline(0.56, 0.5, 0.76)
    kit.add(slab(pts, 0.12, top, seed=2), Matrix.Identity(4), 'stone', stone(tone, 0.6, 0.45), 2, name='stone')
    border(kit, [(x, y + top) for x, y in scale_outline(pts, 0.9, 0.38)], 0.06, 0.12, 3, tone)
    # A carved cross in the head, then the name and dates.
    c = new()
    box(c, (0, top + 0.6, 0.068), (0.022, 0.1, 0.006))
    box(c, (0, top + 0.62, 0.068), (0.07, 0.02, 0.006))
    kit.add(c, Matrix.Identity(4), 'stone', INK, 4, name='letters')
    letters(kit, 0.4, top + 0.47, 0.06, [(9, 0.032), (12, 0.022), (8, 0.022), (14, 0.016)], 5)


def bevel_stone(kit, tone):
    pb, top = plinth(0.68, 0.38, 0.09, 1, 11)
    kit.add(pb, Matrix.Identity(4), 'stone', stone(tone, 0.9, 0.7), 11, name='stone')
    pts = shoulder_outline(0.56, 0.58, 0.7)
    kit.add(slab(pts, 0.13, top, seed=12), Matrix.Identity(4), 'stone', stone(tone, 0.5, 0.45), 12, name='stone')
    border(kit, [(x, y + top) for x, y in scale_outline(pts, 0.88, 0.35)], 0.065, 0.1, 13, tone)
    letters(kit, 0.4, top + 0.5, 0.065, [(10, 0.03), (11, 0.02), (11, 0.02), (6, 0.02)], 14)


def cross_stone(kit, tone):
    # Stepped base, a tapered shaft and a ringed (Celtic) cross head.
    pb, top = plinth(0.66, 0.48, 0.12, 2, 21)
    kit.add(pb, Matrix.Identity(4), 'stone', stone(tone, 1.0, 0.8), 21, name='stone')
    shaft = [(-0.09, 0.0), (0.09, 0.0), (0.075, 0.82), (0.2, 0.82), (0.2, 0.94), (0.075, 0.94), (0.075, 1.12),
             (-0.075, 1.12), (-0.075, 0.94), (-0.2, 0.94), (-0.2, 0.82), (-0.075, 0.82)]
    kit.add(slab(shaft, 0.12, top, seed=22, bev=0.01), Matrix.Identity(4), 'stone', stone(tone, 0.6, 0.5), 22, name='stone')
    ring = new()
    cy = top + 0.88
    segs = 28
    ro, ri = 0.17, 0.13
    pts = []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        pts.append(((math.cos(a) * ro, cy + math.sin(a) * ro), (math.cos(a) * ri, cy + math.sin(a) * ri)))
    vs = []
    for (ox, oy), (ix, iy) in pts:
        vs.append([ring.verts.new(G(ox, oy, -0.04)), ring.verts.new(G(ix, iy, -0.04)),
                   ring.verts.new(G(ix, iy, 0.04)), ring.verts.new(G(ox, oy, 0.04))])
    for i in range(segs):
        a, b = vs[i], vs[(i + 1) % segs]
        for k in range(4):
            ring.faces.new([a[k], b[k], b[(k + 1) % 4], a[(k + 1) % 4]])
    bmesh.ops.recalc_face_normals(ring, faces=ring.faces)
    kit.add(ring, Matrix.Identity(4), 'stone', stone(tone, 0.7, 0.5), 23, name='stone')
    # Knotwork bosses where the arms meet, and the plaque on the base.
    bosses = new()
    append(bosses, sphere(0.035, (0, cy, 0.06), 8, 6, 0.6))
    kit.add(bosses, Matrix.Identity(4), 'stone', stone(tone, 0.4, 0.3), 24, name='stone')
    letters(kit, 0.3, top + 0.42, 0.06, [(8, 0.026), (10, 0.018), (9, 0.018)], 25)


def wide_stone(kit, tone):
    # A double stone for a husband and wife: two round heads on one slab.
    pb, top = plinth(1.27, 0.45, 0.1, 1, 31)
    kit.add(pb, Matrix.Identity(4), 'stone', stone(tone, 0.9, 0.7), 31, name='stone')
    w = 1.12
    pts = [(-w / 2, 0.0), (w / 2, 0.0), (w / 2, 0.5)]
    for side in (1, -1):
        cx = side * w / 4
        for i in range(1, 12):
            a = math.pi * i / 12 if side > 0 else math.pi * i / 12
            x = cx + (w / 4) * math.cos(a)
            y = 0.5 + 0.24 * math.sin(a)
            pts.append((x, y))
        if side > 0:
            pts.append((0.0, 0.52))
    pts.append((-w / 2, 0.5))
    kit.add(slab(pts, 0.14, top, seed=32), Matrix.Identity(4), 'stone', stone(tone, 0.6, 0.45), 32, name='stone')
    for side in (-1, 1):
        sub = arch_outline(w / 2 - 0.1, 0.42, 0.66)
        border(kit, [(x + side * w / 4, y + top) for x, y in scale_outline(sub, 0.92, 0.33)], 0.07, 0.12, 33 + side, tone)
        lt = new()
        kit.add(lt, Matrix.Identity(4), 'stone', INK, 35, name='letters')
    # Two inscriptions.
    for side in (-1, 1):
        sub = Kit()
        letters(sub, 0.4, top + 0.5, 0.07, [(8, 0.03), (11, 0.02), (9, 0.02)], 36 + side)
        b = sub.batches['letters']
        tgt = kit.batches.setdefault('letters', {'mat': 'stone', 'v': [], 'f': [], 'c': [], 's': [], 'origin': None})
        base = len(tgt['v'])
        tgt['v'] += [v + Vector((side * w / 4, 0, 0)) for v in b['v']]
        tgt['f'] += [tuple(base + i for i in f) for f in b['f']]
        tgt['c'] += b['c']
        tgt['s'] += b['s']


def broken_stone(kit, tone):
    # The lower half still standing with a jagged break, the top lying face-down in front of it.
    pb, top = plinth(0.66, 0.37, 0.09, 1, 41)
    kit.add(pb, Matrix.Identity(4), 'stone', stone(tone, 1.0, 0.8), 41, name='stone')
    r = random.Random(4)
    w = 0.54
    pts = [(-w / 2, 0.0), (w / 2, 0.0), (w / 2, 0.3)]
    n = 7
    for i in range(1, n):
        x = w / 2 - w * i / n
        pts.append((x, 0.3 + r.uniform(-0.06, 0.1)))
    pts.append((-w / 2, 0.24))
    kit.add(slab(pts, 0.12, top, seed=42, rough=0.008), Matrix.Identity(4), 'stone', stone(tone, 0.8, 0.7), 42, name='stone')
    letters(kit, 0.4, top + 0.2, 0.06, [(9, 0.022), (7, 0.022)], 43)
    # The fallen head, flat on the turf, a little skewed, its broken edge toward the stump.
    head = arch_outline(0.5, 0.22, 0.4)
    bm = slab(head, 0.1, 0.0, seed=44, rough=0.008)
    M = T(0.09, 0.05, 0.25) @ RY(math.radians(-14)) @ RX(math.radians(-90))
    kit.add(bm, M, 'stone', stone(tone, 1.0, 0.9), 44, name='stone')
    # Chips at the foot.
    ch = new()
    for i in range(5):
        box(ch, (r.uniform(-0.25, 0.35), 0.015, r.uniform(0.12, 0.36)), (r.uniform(0.03, 0.07), 0.03, r.uniform(0.03, 0.06)),
            RY(r.uniform(0, 3)))
    bevel(ch, 0.006)
    kit.add(ch, Matrix.Identity(4), 'stone', stone(tone, 0.6, 0.5), 45, name='stone')


BUILD = {
    'gravestone-round': round_stone,
    'gravestone-bevel': bevel_stone,
    'gravestone-cross': cross_stone,
    'gravestone-wide': wide_stone,
    'gravestone-broken': broken_stone,
}

stats = {}
for name, build in BUILD.items():
    clear_scene()
    kit = Kit()
    build(kit, TONES[name])
    fit(kit, FOOT[name])
    coll = make_objects(kit, name)
    size = export(coll, os.path.join(OUT, f'{name}.glb'))
    stats[name] = {'tris': kit.tris(), 'bytes': size}
    # Preview, lit like a grey day.
    preview_setup(res=(640, 640), world=(0.08, 0.09, 0.1), strength=1.0)
    ground(6, (46, 52, 38))
    light('SUN', (0, 10, 0), 2.2, (0.85, 0.88, 0.95), rot=(math.radians(50), 0, math.radians(-35)))
    h = FOOT[name][4]
    shoot(PREVIEW, {name: ((0.9, h * 0.85, 1.7), (0, h * 0.5, 0), 40)})
print('STATS ' + json.dumps(stats))
