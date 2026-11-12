"""Procedural graveyard scene for Last Rites.

Run headless:
  blender -b --factory-startup --python tools/blender/graveyard_scene.py -- LAYOUT.json OUT_DIR PREVIEW_DIR [render|export|both]

LAYOUT.json is the game's layout data (positions of the hut, chapel, gates, paths, items, clues,
scare props, spawn graves...). Every gameplay spot is kept clear: this scene only dresses the
world around them. Writes OUT_DIR/graveyard.glb, OUT_DIR/graveyard-colliders.json and preview renders.

Coordinates: game (x, y, z) with +X east, +Z south, Y up  <->  Blender (x, -z, y).
"""
import bpy, bmesh, json, math, os, random, sys
from mathutils import Vector, Matrix, noise

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
LAYOUT_PATH, OUT_DIR, PREVIEW_DIR = ARGV[0], ARGV[1], ARGV[2]
MODE = ARGV[3] if len(ARGV) > 3 else 'both'
L = json.load(open(LAYOUT_PATH, encoding='utf-8'))
CL = L['cemeteryLayout']
R = random.Random(1891)

def B(gx, gz, gy=0.0):
    return Vector((gx, -gz, gy))

def face_rot(fx, fz):
    """Z rotation that turns a piece whose front faces local -Y toward game direction (fx, fz)."""
    return math.atan2(-fz, fx) + math.pi / 2

def srgb(r, g, b):
    return Vector(((r / 255) ** 2.2, (g / 255) ** 2.2, (b / 255) ** 2.2))

def lerp(a, b, t):
    t = max(0.0, min(1.0, t))
    return a * (1 - t) + b * t

def clamp01(x):
    return max(0.0, min(1.0, x))

# ---------------------------------------------------------------------------------------------
# Clearance: every gameplay spot keeps a clear radius, and zombie paths keep a clear corridor.
# ---------------------------------------------------------------------------------------------
ANCHORS = []  # (x, z, radius)
def anchor(p, r):
    ANCHORS.append((p[0], p[2] if len(p) > 2 else p[1], r))

z = L['zones']
for p in z['SPAWN_POINTS']:
    anchor(p['position'], 3.0 if p['lootTable'] == 'grave-dig' else 2.2)
for p in z['FIXED_SPAWNS']:
    anchor(p['position'], 2.2)
for c in L['tombstones']['CLUE_SPOTS']:
    anchor(c['position'], 2.2)
for t in L['tombstones']['TOMBSTONES']:
    anchor(t['position'], 2.0)
sc = L['scares']
for s in sc['SCARE_STATUES']:
    anchor(s['position'], 2.2)
for s in sc['SCARE_DOORS']:
    anchor(s['position'], 1.5)
for s in sc['SCARE_CANDLES']:
    for p in s['positions']:
        anchor(p, 1.6)
for lp in CL['LAMP_POSTS']:
    anchor(lp['position'], 1.8)
for lm in L['mapLandmarks']['LANDMARKS']:
    anchor(lm['position'], 2.4)
for g in [(-30, -22), (2, -34), (30, -26), (-35, 8), (34, 14), (-26, 30), (-2, 35), (28, 32)]:  # wave graves
    ANCHORS.append((g[0], g[1], 3.0))
for p in [CL['WOODPILE_POSITION'], CL['POWDER_TIN_BELL_TOWER'], CL['HUT_DOOR_OUTSIDE'], [-9, 0, 37], [-7.2, 0, 36.2]]:
    anchor(p, 3.0)
anchor(CL['LODGE']['center'], 2.0)

NODES = {n['id']: (n['x'], n['z']) for n in L['waypoints']['WAYPOINT_NODES']}
EDGES = [(NODES[a], NODES[b]) for a, b in L['waypoints']['WAYPOINT_EDGES']]
WAVE_GRAVES = [(-30, -22), (2, -34), (30, -26), (-35, 8), (34, 14), (-26, 30), (-2, 35), (28, 32)]
# Zombies walk from their grave to the nearest node first, so that leg stays open too.
for g in WAVE_GRAVES:
    near = min(NODES.values(), key=lambda n: math.hypot(n[0] - g[0], n[1] - g[1]))
    EDGES.append((g, near))

H = CL['HUT']; C = CL['CHAPEL']; CC = CL['CHAPEL_CENTER']
RECTS = [  # (minx, maxx, minz, maxz): buildings plus a margin
    (-H['halfX'] - 2.5, H['halfX'] + 2.5, -H['halfZ'] - 2.5, H['halfZ'] + 3.5),
    (CC[0] - C['halfX'] - 3, CC[0] + C['halfX'] + 3, CC[2] - C['halfZ'] - 3.5, CC[2] + C['halfZ'] + 2.5),
    (-23, -17, -42, -36), (22, 28, 36, 42),  # gate mouths
]

def seg_dist(px, pz, a, b):
    ax, az = a; bx, bz = b
    dx, dz = bx - ax, bz - az
    L2 = dx * dx + dz * dz
    t = 0 if L2 == 0 else max(0, min(1, ((px - ax) * dx + (pz - az) * dz) / L2))
    return math.hypot(px - (ax + t * dx), pz - (az + t * dz))

def free(x, zz, r=0.6, path_half=2.3):
    if abs(x) > 39.2 or abs(zz) > 39.2:
        return False
    for ax, az, ar in ANCHORS:
        if math.hypot(x - ax, zz - az) < ar + r:
            return False
    for a, b in EDGES:
        if seg_dist(x, zz, a, b) < path_half + r:
            return False
    for x0, x1, z0, z1 in RECTS:
        if x0 - r < x < x1 + r and z0 - r < zz < z1 + r:
            return False
    return True

def free_rect(x0, x1, z0, z1, r=0.4):
    xs = [x0 + (x1 - x0) * i / 4 for i in range(5)]
    zs = [z0 + (z1 - z0) * i / 4 for i in range(5)]
    return all(free(x, zz, r) for x in xs for zz in zs)

# ---------------------------------------------------------------------------------------------
# Batches: geometry is merged per material and region, so the game draws few meshes.
# ---------------------------------------------------------------------------------------------
BATCHES = {}
COLLIDERS = []
STATS = {'headstones': 0, 'graves': 0, 'trees': 0}

def batch(key):
    if key not in BATCHES:
        BATCHES[key] = {'v': [], 'f': [], 'c': [], 's': []}
    return BATCHES[key]

def region_of(P):
    gx, gz = P.x, -P.y
    if gz < -41:
        return 'north'
    if abs(gx) > 41 or gz > 41:
        return 'outer'
    return ('w' if gx < 0 else 'e') + ('n' if gz < 0 else 's')

def add(bm, M, mat, paint, seed=0, smooth=False, region=None):
    bm.transform(M) if hasattr(bm, 'transform') else bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    bm.normal_update()
    centre = M.to_translation()
    key = mat + ':' + (region or region_of(centre))
    b = batch(key)
    base = len(b['v'])
    bm.verts.index_update()
    for v in bm.verts:
        b['v'].append(v.co.copy())
    for f in bm.faces:
        b['f'].append(tuple(base + v.index for v in f.verts))
        b['s'].append(smooth)
        for loop in f.loops:
            b['c'].append(paint(loop.vert.co, f.normal if not smooth else loop.vert.normal, seed))
    bm.free()

def collider(gx, gz, hx, hy, hz, rot=0.0, gy=None):
    COLLIDERS.append({'center': [round(gx, 3), round(hy if gy is None else gy, 3), round(gz, 3)], 'half': [round(hx, 3), round(hy, 3), round(hz, 3)], 'rotY': round(rot, 4)})

def place(x, zz, rot=0.0, y=0.0, tilt=(0.0, 0.0), scale=1.0):
    return Matrix.Translation(B(x, zz, y)) @ Matrix.Rotation(rot, 4, 'Z') @ Matrix.Rotation(tilt[0], 4, 'X') @ Matrix.Rotation(tilt[1], 4, 'Y') @ Matrix.Scale(scale, 4)

# ---------------------------------------------------------------------------------------------
# Painters (linear RGB per face corner).
# ---------------------------------------------------------------------------------------------
GRIME = srgb(48, 42, 34); MOSS = srgb(66, 78, 44); LICHEN = srgb(170, 166, 128); SOOT = srgb(30, 28, 26)

def stone(base_rgb, mossy=1.0, lichen=1.0):
    base = srgb(*base_rgb)
    def f(P, N, s):
        o = Vector((s * 3.1, s * 1.7, s * 0.3))
        n = noise.noise(P * 0.8 + o)
        c = base * (0.82 + 0.2 * n)
        c = lerp(c, GRIME, 0.55 * clamp01(1 - P.z / 0.5))
        streak = noise.noise(Vector((P.x * 6 + s, P.y * 6, P.z * 0.4)))
        if abs(N.z) < 0.5:
            c = c * (0.86 + 0.1 * streak)
        m = clamp01(N.z * 1.2) * 0.7 + clamp01(1 - P.z / 0.35) * 0.5
        m *= clamp01(0.5 + noise.noise(P * 2.3 + o)) * mossy
        c = lerp(c, MOSS, m)
        if noise.noise(P * 6.5 + o * 2) > 0.42 and lichen:
            c = lerp(c, LICHEN, 0.45 * lichen)
        return c
    return f

def iron(P, N, s):
    c = srgb(34, 31, 30) * (0.9 + 0.2 * noise.noise(P * 3 + Vector((s, 0, 0))))
    r = noise.noise(P * 5.5 + Vector((0, s, 0)))
    if r > 0.25:
        c = lerp(c, srgb(92, 50, 26), (r - 0.25) * 1.6)
    return c

def bark(P, N, s):
    n = noise.noise(Vector((P.x * 1.5, P.y * 1.5, P.z * 6)) + Vector((s, 0, 0)))
    c = srgb(58, 50, 44) * (0.78 + 0.28 * n)
    if N.y > 0.3:  # north side (game -Z is Blender +Y) carries moss
        c = lerp(c, MOSS, N.y * 0.5)
    return lerp(c, srgb(88, 82, 74), clamp01(P.z / 9) * 0.35)

def wood(P, N, s):
    return srgb(70, 54, 40) * (0.8 + 0.25 * noise.noise(Vector((P.x * 0.6, P.y * 0.6, P.z * 8)) + Vector((s, s, 0))))

def grass(P, N, s):
    t = clamp01(P.z / 0.45)
    base = lerp(srgb(46, 52, 30), srgb(112, 104, 64), t)
    return base * (0.8 + 0.3 * noise.noise(P * 0.3 + Vector((s, 0, 0))))

def leaf(P, N, s):
    pick = [srgb(92, 52, 26), srgb(70, 40, 22), srgb(110, 82, 40), srgb(58, 44, 30)]
    return pick[int(abs(s)) % 4]

# ---------------------------------------------------------------------------------------------
# Mesh helpers (local Blender coords: X across, -Y front, Z up).
# ---------------------------------------------------------------------------------------------
def box(bm, cx, cy, cz, sx, sy, sz):
    m = Matrix.Translation((cx, cy, cz)) @ Matrix.Diagonal((sx, sy, sz, 1))
    return bmesh.ops.create_cube(bm, size=1.0, matrix=m)['verts']

def bevel_all(bm, off, segs=1):
    try:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=off, segments=segs, affect='EDGES', clamp_overlap=True, profile=0.5)
    except Exception:
        pass

def jitter(bm, amp, s, scale=4.0):
    o = Vector((s * 1.3, s * 2.1, s * 0.7))
    for v in bm.verts:
        d = noise.noise_vector(v.co * scale + o)
        v.co += d * amp

def extrude(pts, t, y0=0.0):
    bm = bmesh.new()
    fr = [bm.verts.new((x, y0 - t / 2, zz)) for x, zz in pts]
    bk = [bm.verts.new((x, y0 + t / 2, zz)) for x, zz in pts]
    bm.faces.new(fr)
    bm.faces.new(list(reversed(bk)))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([fr[i], fr[j], bk[j], bk[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm

def front_face(bm):
    bm.normal_update()
    cands = [f for f in bm.faces if f.normal.y < -0.9]
    return max(cands, key=lambda f: f.calc_area()) if cands else None

def lathe(profile, segs=8, z0=0.0):
    bm = bmesh.new()
    rings = []
    for r, zz in profile:
        if r < 1e-4:
            rings.append([bm.verts.new((0, 0, z0 + zz))])
        else:
            rings.append([bm.verts.new((r * math.cos(2 * math.pi * i / segs), r * math.sin(2 * math.pi * i / segs), z0 + zz)) for i in range(segs)])
    for a, b in zip(rings, rings[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        if len(a) == 1:
            for i in range(segs):
                bm.faces.new([a[0], b[i], b[(i + 1) % segs]])
        elif len(b) == 1:
            for i in range(segs):
                bm.faces.new([a[i], b[0], a[(i + 1) % segs]])
        else:
            for i in range(segs):
                bm.faces.new([a[i], a[(i + 1) % segs], b[(i + 1) % segs], b[i]])
    if len(rings[0]) > 1:
        bm.faces.new(list(reversed(rings[0])))
    if len(rings[-1]) > 1:
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm

def tube(points, radii, sides=6, cap=True):
    bm = bmesh.new()
    rings = []
    prev_n = None
    for i, p in enumerate(points):
        d = (points[min(i + 1, len(points) - 1)] - points[max(i - 1, 0)]).normalized()
        if prev_n is None:
            up = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
            prev_n = d.cross(up).normalized()
        nrm = (prev_n - d * prev_n.dot(d)).normalized()
        bi = d.cross(nrm)
        prev_n = nrm
        rings.append([bm.verts.new(p + (nrm * math.cos(2 * math.pi * k / sides) + bi * math.sin(2 * math.pi * k / sides)) * radii[i]) for k in range(sides)])
    for a, b in zip(rings, rings[1:]):
        for k in range(sides):
            bm.faces.new([a[k], a[(k + 1) % sides], b[(k + 1) % sides], b[k]])
    if cap:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm

def merge(*bms):
    out = bmesh.new()
    for b in bms:
        tmp = bpy.data.meshes.new('tmp')
        b.to_mesh(tmp)
        out.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
        b.free()
    return out

def ring_mesh(Ro, Ri, t, segs=16, cz=0.0):
    bm = bmesh.new()
    def v(r, a, y):
        return bm.verts.new((r * math.cos(a), y, cz + r * math.sin(a)))
    pts = []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        pts.append((v(Ro, a, -t / 2), v(Ri, a, -t / 2), v(Ro, a, t / 2), v(Ri, a, t / 2)))
    for i in range(segs):
        a, b = pts[i], pts[(i + 1) % segs]
        bm.faces.new([a[0], b[0], b[1], a[1]])
        bm.faces.new([a[3], b[3], b[2], a[2]])
        bm.faces.new([a[2], b[2], b[0], a[0]])
        bm.faces.new([a[1], b[1], b[3], a[3]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm

# ---------------------------------------------------------------------------------------------
# Headstones.
# ---------------------------------------------------------------------------------------------
def arc(cx, cz, r, a0, a1, n):
    return [(cx + r * math.cos(a0 + (a1 - a0) * i / n), cz + r * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]

def outline(kind, w, h, rr):
    hw = w / 2
    if kind == 'round':
        return [(-hw, 0)] + arc(0, h - hw, hw, math.pi, 0, 10) + [(hw, 0)]
    if kind == 'segment':
        s = h - w * 0.18
        r = (hw * hw + (w * 0.18) ** 2) / (2 * w * 0.18)
        a = math.asin(hw / r)
        return [(-hw, 0)] + arc(0, h - r, r, math.pi / 2 + a, math.pi / 2 - a, 8) + [(hw, 0)]
    if kind == 'gothic':
        sh = h - w * 0.75
        return [(-hw, 0), (-hw, sh)] + [(-hw + (hw) * (i / 6), sh + (h - sh) * math.sin(math.pi / 2 * i / 6) ** 0.8) for i in range(1, 6)] + [(0, h)] + [(hw - hw * (i / 6), sh + (h - sh) * math.sin(math.pi / 2 * i / 6) ** 0.8) for i in range(5, 0, -1)] + [(hw, sh), (hw, 0)]
    if kind == 'scroll':
        q = w * 0.22
        return [(-hw, 0), (-hw, h - q)] + arc(-hw + q, h - q, q, math.pi, math.pi / 2, 4)[1:] + [(-w * 0.12, h), (0, h + w * 0.08), (w * 0.12, h)] + arc(hw - q, h - q, q, math.pi / 2, 0, 4)[:-1] + [(hw, h - q), (hw, 0)]
    if kind == 'broken':
        pts = [(-hw, 0), (-hw, h * rr.uniform(0.55, 0.8))]
        n = 5
        for i in range(1, n):
            pts.append((-hw + w * i / n, h * rr.uniform(0.45, 0.95)))
        return pts + [(hw, h * rr.uniform(0.5, 0.8)), (hw, 0)]
    if kind == 'cross':
        t = w * 0.28; arm = h * 0.62; ah = t
        return [(-t / 2, 0), (-t / 2, arm - ah / 2), (-hw, arm - ah / 2), (-hw, arm + ah / 2), (-t / 2, arm + ah / 2), (-t / 2, h), (t / 2, h), (t / 2, arm + ah / 2), (hw, arm + ah / 2), (hw, arm - ah / 2), (t / 2, arm - ah / 2), (t / 2, 0)]
    return [(-hw, 0), (-hw, h), (hw, h), (hw, 0)]

STONE_TONES = [(132, 128, 118), (118, 112, 100), (140, 134, 120), (104, 102, 98), (126, 116, 98), (96, 94, 92)]

def headstone(x, zz, facing, rr, kind=None, size=1.0):
    kind = kind or rr.choice(['round', 'round', 'segment', 'gothic', 'scroll', 'broken', 'cross', 'celtic', 'tablet'])
    w = rr.uniform(0.5, 0.78) * size
    h = rr.uniform(0.75, 1.25) * size
    t = rr.uniform(0.1, 0.16) * size
    if kind in ('cross', 'celtic'):
        h *= 1.25
        w = h * 0.62
    seed = rr.random() * 100
    parts = []
    plinth = rr.random() < 0.7
    bz = 0.16 if plinth else 0.0
    if plinth:
        bmp = bmesh.new()
        box(bmp, 0, 0, bz / 2, w + 0.16, t + 0.2, bz)
        bevel_all(bmp, 0.015)
        parts.append(bmp)
    bm = extrude(outline('cross' if kind == 'celtic' else kind, w, h, rr), t)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, bz))
    if kind not in ('cross', 'celtic', 'broken'):
        f = front_face(bm)
        if f:
            bmesh.ops.inset_region(bm, faces=[f], thickness=min(w, h) * 0.1, depth=-0.008, use_even_offset=True)
    bevel_all(bm, 0.012)
    parts.append(bm)
    if kind == 'celtic':
        parts.append(ring_mesh(w * 0.34, w * 0.25, t * 0.8, 14, bz + h * 0.62))
    if kind in ('round', 'segment', 'gothic', 'scroll', 'tablet') and rr.random() < 0.65:
        # A small carved relief at the top of the panel: cross, wreath or urn.
        motif = rr.choice(['cross', 'wreath', 'wreath', 'urn'])
        top = bz + h * 0.7
        if motif == 'cross':
            parts.append(extrude(outline('cross', w * 0.22, h * 0.2, rr), 0.02, -t / 2 - 0.004))
            bmesh.ops.translate(parts[-1], verts=parts[-1].verts, vec=(0, 0, top - h * 0.08))
        elif motif == 'wreath':
            rm = ring_mesh(w * 0.13, w * 0.09, 0.02, 12, top)
            bmesh.ops.translate(rm, verts=rm.verts, vec=(0, -t / 2 - 0.004, 0))
            parts.append(rm)
        else:
            u = lathe([(0.0, 0), (w * 0.05, 0.005), (w * 0.08, w * 0.08), (w * 0.05, w * 0.15), (w * 0.07, w * 0.17), (0.0, w * 0.18)], 6)
            bmesh.ops.scale(u, vec=(1, 0.3, 1), verts=u.verts)
            bmesh.ops.translate(u, verts=u.verts, vec=(0, -t / 2 - 0.01, top - w * 0.1))
            parts.append(u)
    out = merge(*parts)
    jitter(out, 0.006, seed)
    lean = (rr.uniform(-0.09, 0.09), rr.uniform(-0.07, 0.07)) if rr.random() < 0.6 else (0.0, 0.0)
    M = place(x, zz, face_rot(*facing) + rr.uniform(-0.12, 0.12), y=-rr.uniform(0.02, 0.07), tilt=lean)
    add(out, M, 'stone', stone(rr.choice(STONE_TONES), mossy=rr.uniform(0.4, 1.0)), seed)
    collider(x, zz, (w + 0.16) / 2, (h + bz) / 2, (t + 0.2) / 2, face_rot(*facing))
    STATS['headstones'] += 1

def kerb(x, zz, length, width, facing_rot, rr, fill):
    """Low stone kerb around a grave, filled with chippings or grass. Walkable (no collider)."""
    bm = bmesh.new()
    k, hgt = 0.09, 0.13
    box(bm, 0, -length / 2, hgt / 2, width, k, hgt)
    box(bm, 0, length / 2, hgt / 2, width, k, hgt)
    box(bm, -width / 2 + k / 2, 0, hgt / 2, k, length, hgt)
    box(bm, width / 2 - k / 2, 0, hgt / 2, k, length, hgt)
    bevel_all(bm, 0.012)
    jitter(bm, 0.008, rr.random() * 50)
    M = place(x, zz, facing_rot, y=-0.02, tilt=(rr.uniform(-0.02, 0.02), rr.uniform(-0.02, 0.02)))
    add(bm, M, 'stone', stone(rr.choice(STONE_TONES), 0.8), rr.random() * 10)
    fb = bmesh.new()
    box(fb, 0, 0, 0.04, width - 2 * k, length - 2 * k, 0.08)
    jitter(fb, 0.01, rr.random() * 40, 6)
    tone = srgb(118, 112, 100) if fill == 'chips' else srgb(52, 58, 34)
    add(fb, M, 'stone', lambda P, N, s, tone=tone: tone * (0.75 + 0.35 * noise.noise(P * 9 + Vector((s, 0, 0)))), rr.random() * 10)

def ledger(x, zz, length, width, facing_rot, rr, chest=False):
    seed = rr.random() * 80
    if chest:
        bm = bmesh.new()
        box(bm, 0, 0, 0.08, width + 0.14, length + 0.14, 0.16)
        box(bm, 0, 0, 0.5, width, length, 0.68)
        box(bm, 0, 0, 0.88, width + 0.1, length + 0.1, 0.1)
        box(bm, 0, 0, 0.96, width - 0.12, length - 0.12, 0.06)
        bevel_all(bm, 0.015)
        for f in list(bm.faces):
            if abs(f.normal.z) < 0.2 and f.calc_area() > 0.25:
                try:
                    bmesh.ops.inset_region(bm, faces=[f], thickness=0.06, depth=-0.012)
                except Exception:
                    pass
        jitter(bm, 0.005, seed)
        hgt = 1.0
        collider(x, zz, (width + 0.14) / 2, hgt / 2, (length + 0.14) / 2, facing_rot)
    else:
        bm = bmesh.new()
        box(bm, 0, 0, 0.07, width, length, 0.14)
        bevel_all(bm, 0.02)
        f = max((f for f in bm.faces if f.normal.z > 0.9), key=lambda f: f.calc_area())
        bmesh.ops.inset_region(bm, faces=[f], thickness=0.07, depth=-0.01)
        jitter(bm, 0.006, seed)
        if rr.random() < 0.3:  # cracked across
            for v in bm.verts:
                if v.co.y > 0.1 * length:
                    v.co.z -= 0.025
    M = place(x, zz, facing_rot, y=-0.01, tilt=(rr.uniform(-0.015, 0.015), rr.uniform(-0.015, 0.015)))
    add(bm, M, 'stone', stone(rr.choice(STONE_TONES), 0.9), seed)

def obelisk(x, zz, rr, height=3.4, urn=False):
    seed = rr.random() * 90
    parts = []
    bm = bmesh.new()
    box(bm, 0, 0, 0.15, 1.3, 1.3, 0.3)
    box(bm, 0, 0, 0.42, 1.0, 1.0, 0.24)
    box(bm, 0, 0, 0.9, 0.78, 0.78, 0.72)
    box(bm, 0, 0, 1.31, 0.88, 0.88, 0.1)
    bevel_all(bm, 0.02)
    for f in list(bm.faces):
        if abs(f.normal.z) < 0.2 and 0.4 < f.calc_area() < 0.7:
            try:
                bmesh.ops.inset_region(bm, faces=[f], thickness=0.07, depth=-0.012)
            except Exception:
                pass
    parts.append(bm)
    sh = height - 1.36
    s = bmesh.new()
    b0, b1 = 0.26, 0.17
    vs = [s.verts.new((sx * b0, sy * b0, 1.36)) for sx, sy in [(-1, -1), (1, -1), (1, 1), (-1, 1)]]
    vt = [s.verts.new((sx * b1, sy * b1, 1.36 + sh)) for sx, sy in [(-1, -1), (1, -1), (1, 1), (-1, 1)]]
    apex = s.verts.new((0, 0, 1.36 + sh + 0.3))
    s.faces.new(list(reversed(vs)))
    for i in range(4):
        j = (i + 1) % 4
        s.faces.new([vs[i], vs[j], vt[j], vt[i]])
        s.faces.new([vt[i], vt[j], apex])
    bmesh.ops.recalc_face_normals(s, faces=s.faces)
    parts.append(s)
    if urn:
        u = lathe([(0.0, 0), (0.12, 0.0), (0.08, 0.08), (0.2, 0.25), (0.16, 0.42), (0.1, 0.46), (0.14, 0.5), (0.0, 0.56)], 8, 1.36 + sh + 0.24)
        parts.append(u)
    out = merge(*parts)
    jitter(out, 0.008, seed)
    add(out, place(x, zz, rr.uniform(0, math.pi), y=-0.03), 'stone', stone((138, 132, 120), 0.7), seed)
    collider(x, zz, 0.65, 1.0, 0.65, 0)
    collider(x, zz, 0.27, height / 2, 0.27, 0, gy=height / 2)

def big_cross(x, zz, rr, facing):
    """Landmark Celtic cross on a stepped base."""
    seed = rr.random() * 70
    base = bmesh.new()
    box(base, 0, 0, 0.12, 1.8, 1.8, 0.24)
    box(base, 0, 0, 0.36, 1.3, 1.3, 0.24)
    box(base, 0, 0, 0.66, 0.7, 0.5, 0.36)
    bevel_all(base, 0.02)
    cr = extrude(outline('cross', 1.3, 2.4, rr), 0.24)
    bmesh.ops.translate(cr, verts=cr.verts, vec=(0, 0, 0.84))
    bevel_all(cr, 0.02)
    rg = ring_mesh(0.44, 0.33, 0.2, 18, 0.84 + 2.4 * 0.62)
    out = merge(base, cr, rg)
    jitter(out, 0.008, seed)
    add(out, place(x, zz, face_rot(*facing)), 'stone', stone((128, 124, 114), 0.8), seed)
    collider(x, zz, 0.9, 0.42, 0.9, face_rot(*facing))
    collider(x, zz, 0.66, 1.6, 0.15, face_rot(*facing), gy=2.4)

# ---------------------------------------------------------------------------------------------
# Iron railings and the boundary wall.
# ---------------------------------------------------------------------------------------------
def railing(p0, p1, height, rr, base_y=0.0, spacing=0.13, posts=2.0, region=None):
    """Spear-topped iron railing between two game points. Returns nothing; adds geometry."""
    a, b = B(p0[0], p0[1], base_y), B(p1[0], p1[1], base_y)
    d = b - a
    length = d.length
    if length < 0.05:
        return
    rot = math.atan2(d.y, d.x)
    M = Matrix.Translation(a) @ Matrix.Rotation(rot, 4, 'Z')
    bm = bmesh.new()
    for zr in (0.12, height - 0.12):
        box(bm, length / 2, 0, zr, length, 0.035, 0.035)
    n = max(1, int(length / spacing))
    for i in range(n + 1):
        xx = length * i / n
        sag = 0.0 if rr.random() > 0.06 else rr.uniform(-0.12, 0.12)
        box(bm, xx, 0, height / 2, 0.022, 0.022, height)
        tip = bm.verts.new((xx, 0, height + 0.12))
        q = [bm.verts.new((xx + sx * 0.03, sy * 0.03, height)) for sx, sy in [(-1, -1), (1, -1), (1, 1), (-1, 1)]]
        for k in range(4):
            bm.faces.new([q[k], q[(k + 1) % 4], tip])
        if sag:
            for v in bm.verts[-5:] if False else []:
                pass
    np_ = max(1, int(length / posts))
    for i in range(np_ + 1):
        xx = length * i / np_
        box(bm, xx, 0, height / 2 + 0.05, 0.06, 0.06, height + 0.1)
        ball = lathe([(0.0, 0), (0.04, 0.02), (0.05, 0.06), (0.03, 0.1), (0.0, 0.11)], 6, height + 0.1)
        bmesh.ops.translate(ball, verts=ball.verts, vec=(xx, 0, 0))
        tmp = bpy.data.meshes.new('t'); ball.to_mesh(tmp); bm.from_mesh(tmp); bpy.data.meshes.remove(tmp); ball.free()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    add(bm, M, 'iron', iron, rr.random() * 20, region=region)

def wall_run(p0, p1, rr, region=None, rail=True):
    """Rubble-stone wall with coping, piers and an iron railing on top, along a game line."""
    a, b = Vector((p0[0], p0[1])), Vector((p1[0], p1[1]))
    d = b - a
    length = d.length
    ux = d / length
    WH, T = 0.78, 0.46
    bm = bmesh.new()
    courses = 3
    for c in range(courses):
        zc = WH * c / courses
        hc = WH / courses
        s = rr.uniform(0, 0.3)
        while s < length:
            bl = rr.uniform(0.35, 0.7)
            e = min(length, s + bl)
            box(bm, (s + e) / 2, rr.uniform(-0.02, 0.02), zc + hc / 2, (e - s) - 0.02, T + rr.uniform(-0.04, 0.03), hc - 0.015)
            s = e
        # first block of the course from 0 so there is no gap at the start
        box(bm, 0.15, 0, zc + hc / 2, 0.3, T, hc - 0.015)
    box(bm, length / 2, 0, WH + 0.05, length, T + 0.1, 0.1)
    jitter(bm, 0.014, rr.random() * 30, 3)  # no bevel: the wall is long and the blocks read well enough
    rot = math.atan2(-d.y, d.x)  # game z -> blender -y
    M = Matrix.Translation(B(a.x, a.y)) @ Matrix.Rotation(rot, 4, 'Z')
    add(bm, M, 'stone', stone((112, 106, 96), 0.9, 0.6), rr.random() * 10, region=region)
    # Piers every ~6 m.
    npier = max(1, int(length / 6))
    for i in range(npier + 1):
        pp = a + ux * (length * i / npier)
        pier(pp.x, pp.y, rr, 1.95, region)
    if rail:
        railing((a.x, a.y), (b.x, b.y), 1.05, rr, base_y=WH + 0.1, spacing=0.17, posts=3.0, region=region)
    mid = (a + b) / 2
    collider(mid.x, mid.y, length / 2, 1.0, 0.25, -rot)

def pier(x, zz, rr, h, region=None, urn=False):
    bm = bmesh.new()
    box(bm, 0, 0, h / 2, 0.62, 0.62, h)
    box(bm, 0, 0, h + 0.05, 0.74, 0.74, 0.1)
    box(bm, 0, 0, 0.1, 0.72, 0.72, 0.2)
    bevel_all(bm, 0.015)
    parts = [bm]
    if urn:
        parts.append(lathe([(0.0, 0), (0.16, 0), (0.1, 0.1), (0.24, 0.3), (0.18, 0.5), (0.1, 0.55), (0.16, 0.6), (0.0, 0.66)], 8, h + 0.1))
    else:
        parts.append(lathe([(0.0, 0), (0.1, 0.0), (0.06, 0.06), (0.14, 0.17), (0.0, 0.3)], 8, h + 0.1))
    out = merge(*parts)
    jitter(out, 0.008, rr.random() * 40)
    add(out, place(x, zz), 'stone', stone((120, 114, 102), 0.8), rr.random() * 10, region=region)
    collider(x, zz, 0.37, h / 2, 0.37, 0)

# ---------------------------------------------------------------------------------------------
# Dead oaks and fallen logs.
# ---------------------------------------------------------------------------------------------
def oak_template(seed, max_depth=3):
    rr = random.Random(seed)
    parts = []
    def branch(p, d, r, length, depth):
        pts, radii = [p.copy()], [r]
        segs = max(2, int(length / 0.6))
        cur, dd = p.copy(), d.copy()
        for i in range(segs):
            dd = (dd + Vector((rr.uniform(-0.35, 0.35), rr.uniform(-0.35, 0.35), rr.uniform(-0.05, 0.25)))).normalized()
            cur = cur + dd * (length / segs)
            pts.append(cur.copy())
            radii.append(r * (1 - 0.75 * (i + 1) / segs))
        parts.append(tube(pts, radii, 6 if depth < 2 else 4, cap=True))
        if depth < max_depth:
            kids = rr.randint(2, 3)
            for k in range(kids):
                at = rr.randint(max(1, segs // 2), segs)
                nd = (dd + Vector((rr.uniform(-1, 1), rr.uniform(-1, 1), rr.uniform(-0.2, 0.6)))).normalized()
                branch(pts[at], nd, radii[at] * 0.85, length * rr.uniform(0.5, 0.75), depth + 1)
    trunk_h = rr.uniform(2.2, 3.2)
    lean = Vector((rr.uniform(-0.15, 0.15), rr.uniform(-0.15, 0.15), 1)).normalized()
    pts = [Vector((0, 0, -0.1)), Vector((0, 0, 0.5)), lean * 1.4, lean * trunk_h]
    parts.append(tube(pts, [0.42, 0.33, 0.28, 0.24], 8))
    for k in range(rr.randint(5, 7)):  # root flare
        a = 2 * math.pi * k / 6 + rr.uniform(-0.3, 0.3)
        o = Vector((math.cos(a), math.sin(a), 0))
        parts.append(tube([o * 0.1 + Vector((0, 0, 0.55)), o * 0.55 + Vector((0, 0, 0.12)), o * 1.05 + Vector((0, 0, -0.05))], [0.16, 0.09, 0.03], 5))
    for k in range(rr.randint(2, 3)):
        a = rr.uniform(0, 2 * math.pi)
        d = Vector((math.cos(a) * 0.7, math.sin(a) * 0.7, 0.8)).normalized()
        branch(lean * trunk_h, d, 0.2, rr.uniform(2.2, 3.4), 0)
    return parts

OAKS = [oak_template(s) for s in (11, 23, 37, 41)]
FAR_OAKS = [oak_template(s, 2) for s in (53, 67, 71)]  # fewer twigs for the trees beyond the wall

def oak(x, zz, rr, scale=1.0, region=None):
    t = rr.choice(OAKS)
    out = bmesh.new()
    for p in t:
        tmp = bpy.data.meshes.new('t'); p.to_mesh(tmp); out.from_mesh(tmp); bpy.data.meshes.remove(tmp)
    M = place(x, zz, rr.uniform(0, 2 * math.pi), y=0.0, scale=scale * rr.uniform(0.85, 1.15))
    add(out, M, 'bark', bark, rr.random() * 10, smooth=True, region=region)
    STATS['trees'] += 1

def log(x, zz, rr, length, rot):
    pts = [Vector((-length / 2 + length * i / 5, 0, 0.26 + 0.03 * math.sin(i))) for i in range(6)]
    bm = tube(pts, [0.3, 0.3, 0.28, 0.27, 0.25, 0.22], 7)
    br = tube([pts[2], pts[2] + Vector((0.3, 0.6, 0.35)), pts[2] + Vector((0.5, 1.1, 0.5))], [0.11, 0.07, 0.03], 5)
    tmp = bpy.data.meshes.new('t'); br.to_mesh(tmp); bm.from_mesh(tmp); bpy.data.meshes.remove(tmp)
    add(bm, place(x, zz, rot, y=-0.04), 'bark', bark, rr.random() * 10, smooth=True)
    collider(x, zz, length / 2, 0.3, 0.32, rot)

# ---------------------------------------------------------------------------------------------
# Mausolea (Mausoleum Row and the Crane crypt).
# ---------------------------------------------------------------------------------------------
def column(h, r):
    return lathe([(0.0, 0), (r * 1.35, 0), (r * 1.35, 0.06), (r * 1.15, 0.1), (r, 0.14), (r * 0.92, h - 0.16), (r * 1.1, h - 0.1), (r * 1.4, h - 0.06), (r * 1.4, h), (0.0, h)], 10)

def mausoleum(cx, cz, W, D, Hh, facing, rr, style, door=True, region=None):
    """W across the front, D deep, Hh to the cornice. Front faces local -Y."""
    seed = rr.random() * 60
    parts = []
    bm = bmesh.new()
    box(bm, 0, 0, 0.12, W + 0.2, D + 0.2, 0.24)          # plinth
    box(bm, 0, -D / 2 - 0.25, 0.08, W * 0.7, 0.5, 0.16)    # step
    body_h = Hh - 0.24
    cs = 6
    for i in range(cs):  # coursed ashlar: each course a slightly different block
        hz = body_h / cs
        inset = 0.0 if i % 2 == 0 else 0.015
        box(bm, 0, 0.0, 0.24 + hz * i + hz / 2, W - inset * 2, D - inset * 2, hz - 0.012)
    box(bm, 0, 0, Hh + 0.08, W + 0.18, D + 0.18, 0.16)      # cornice
    bevel_all(bm, 0.012)
    parts.append(bm)
    fy = -D / 2
    if style == 'classical':
        ped_h = W * 0.28
        pd = extrude([(-W / 2 - 0.09, 0), (0, ped_h), (W / 2 + 0.09, 0)], D + 0.18)
        bmesh.ops.rotate(pd, verts=pd.verts, cent=(0, 0, 0), matrix=Matrix.Identity(3))
        bmesh.ops.translate(pd, verts=pd.verts, vec=(0, 0, Hh + 0.16))
        bevel_all(pd, 0.01)
        parts.append(pd)
        for sx in (-1, 1):
            col = column(body_h - 0.05, 0.11)
            bmesh.ops.translate(col, verts=col.verts, vec=(sx * (W / 2 - 0.22), fy - 0.18, 0.24))
            parts.append(col)
            ac = lathe([(0.0, 0), (0.09, 0), (0.06, 0.06), (0.13, 0.18), (0.0, 0.3)], 8, Hh + 0.16)
            bmesh.ops.translate(ac, verts=ac.verts, vec=(sx * (W / 2), fy, 0))
            parts.append(ac)
        top = lathe([(0.0, 0), (0.1, 0), (0.07, 0.08), (0.16, 0.26), (0.0, 0.4)], 8, Hh + 0.16 + ped_h)
        bmesh.ops.translate(top, verts=top.verts, vec=(0, fy + 0.05, 0))
        parts.append(top)
    elif style == 'gothic':
        roof_h = W * 0.55
        rf = extrude([(-W / 2 - 0.12, 0), (0, roof_h), (W / 2 + 0.12, 0)], D + 0.3)
        bmesh.ops.translate(rf, verts=rf.verts, vec=(0, 0, Hh + 0.16))
        parts.append(rf)
        cr = extrude(outline('cross', 0.36, 0.6, rr), 0.08)
        bmesh.ops.translate(cr, verts=cr.verts, vec=(0, fy - 0.02, Hh + 0.16 + roof_h - 0.06))
        parts.append(cr)
        for sx in (-1, 1):
            bt = bmesh.new()
            box(bt, sx * (W / 2 + 0.05), fy + 0.1, body_h / 2 + 0.24, 0.22, 0.32, body_h)
            box(bt, sx * (W / 2 + 0.05), fy + 0.1, Hh + 0.3, 0.16, 0.16, 0.3)
            parts.append(bt)
    else:  # 'egyptian': battered walls with a deep cavetto cornice
        cv = bmesh.new()
        box(cv, 0, 0, Hh + 0.3, W + 0.4, D + 0.4, 0.14)
        box(cv, 0, 0, Hh + 0.42, W + 0.2, D + 0.2, 0.1)
        parts.append(cv)
        for sx in (-1, 1):
            ob = lathe([(0.0, 0), (0.1, 0), (0.07, 0.5), (0.0, 0.62)], 4, 0.24)
            bmesh.ops.translate(ob, verts=ob.verts, vec=(sx * (W / 2 + 0.25), fy - 0.25, 0))
            parts.append(ob)
    if door:
        dw = min(1.1, W * 0.5)
        dh = min(body_h * 0.72, 2.1)
        fr = bmesh.new()
        box(fr, 0, fy - 0.04, 0.24 + dh / 2, dw + 0.24, 0.1, dh + 0.12)
        bevel_all(fr, 0.01)
        parts.append(fr)
        panel = bmesh.new()
        box(panel, 0, fy - 0.05, 0.24 + dh + 0.32, dw + 0.1, 0.06, 0.26)  # name tablet
        parts.append(panel)
        dr = bmesh.new()
        box(dr, 0, fy - 0.1, 0.24 + dh / 2 - 0.02, dw - 0.04, 0.05, dh - 0.08)
        for i in range(1, 6):
            box(dr, -dw / 2 + dw * i / 6, fy - 0.135, 0.24 + dh / 2, 0.025, 0.03, dh - 0.14)
        for zf in (0.35, 0.5, 0.75):
            box(dr, 0, fy - 0.135, 0.24 + dh * zf, dw - 0.1, 0.03, 0.03)
        M = place(cx, cz, face_rot(*facing))
        add(dr, M, 'iron', iron, rr.random() * 10, region=region)
    out = merge(*parts)
    jitter(out, 0.006, seed, 2.5)
    M = place(cx, cz, face_rot(*facing))
    add(out, M, 'stone', stone(rr.choice([(120, 116, 106), (108, 104, 98), (126, 118, 104)]), 0.9, 0.8), seed, region=region)
    collider(cx, cz, (W + 0.2) / 2, Hh / 2 + 0.3, (D + 0.2) / 2, face_rot(*facing))

# ---------------------------------------------------------------------------------------------
# Ground, paths, grass and leaves.
# ---------------------------------------------------------------------------------------------
PATHS = [e for e in EDGES[:len(L['waypoints']['WAYPOINT_EDGES'])]]

def path_dist(x, zz):
    return min(seg_dist(x, zz, a, b) for a, b in PATHS)

def flat_zone(x, zz):
    if abs(x) < 44 and abs(zz) < 44:
        return True
    if -34 < x < -6 and -74 < zz < -38:
        return True
    if 19 < x < 31 and 38 < zz < 66:
        return True
    return False

def ground_h(x, zz):
    if flat_zone(x, zz):
        return 0.0
    dx = max(0, abs(x) - 44, 0)
    dz = max(0, abs(zz) - 44, 0)
    d = math.hypot(dx, dz)
    if -40 < x < 0 and zz < -38:
        d = min(d, max(0, -6 - x, x + 34) + max(0, -74 - zz))
    k = clamp01(d / 30)
    return (k * k * (3 - 2 * k)) * 9 + noise.noise(Vector((x * 0.04, zz * 0.04, 0))) * 3 * k - 0.05

def ground():
    rr = random.Random(5)
    step = 1.0
    span = 110
    n = int(span * 2 / step)
    for half in ('in', 'out'):
        bm = bmesh.new()
        grid = {}
        for i in range(n + 1):
            for j in range(n + 1):
                x, zz = -span + i * step, -span + j * step
                inside = flat_zone(x, zz)
                coarse = (i % 3 == 0 and j % 3 == 0)
                grid[(i, j)] = (x, zz)
        verts = {}
        def vert(i, j):
            if (i, j) not in verts:
                x, zz = grid[(i, j)]
                verts[(i, j)] = bm.verts.new(B(x, zz, ground_h(x, zz)))
            return verts[(i, j)]
        stp = 1 if half == 'in' else 3
        for i in range(0, n, stp):
            for j in range(0, n, stp):
                x, zz = grid[(i, j)]
                cxm, czm = x + step * stp / 2, zz + step * stp / 2
                isin = abs(cxm) < 46 and abs(czm) < 46
                if (half == 'in') != isin:
                    continue
                if half == 'out' and (i + stp > n or j + stp > n):
                    continue
                bm.faces.new([vert(i, j), vert(i + stp, j), vert(i + stp, j + stp), vert(i, j + stp)])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        for f in bm.faces:
            if f.normal.z < 0:
                f.normal_flip()
        def paint(P, N, s):
            x, zz = P.x, -P.y
            n1 = noise.noise(Vector((x * 0.12, zz * 0.12, 0)))
            n2 = noise.noise(Vector((x * 0.6, zz * 0.6, 3)))
            c = lerp(srgb(44, 50, 30), srgb(86, 78, 50), clamp01(0.5 + n1 * 0.8))
            c = lerp(c, srgb(58, 46, 34), clamp01(n2 - 0.1) * 0.8)
            if abs(x) < 44 and abs(zz) < 44:
                pd = path_dist(x, zz)
                c = lerp(c, srgb(66, 56, 44), clamp01(1.8 - pd) * 0.7)
            return c * (0.85 + 0.15 * clamp01(P.z / 6))
        add(bm, Matrix.Identity(4), 'ground', paint, 0, smooth=True, region='ground-' + half)

def gravel_path(a, b, rr, width=1.8):
    ax, az = a; bx, bz = b
    dx, dz = bx - ax, bz - az
    L_ = math.hypot(dx, dz)
    if L_ < 0.5:
        return
    ux, uz = dx / L_, dz / L_
    nx, nz = -uz, ux
    segs = max(1, int(L_ / 0.8))
    bm = bmesh.new()
    rows = []
    for i in range(segs + 1):
        t = L_ * i / segs
        row = []
        for k, off in enumerate((-width / 2, 0, width / 2)):
            j = rr.uniform(-0.12, 0.12) if k != 1 else 0
            x = ax + ux * t + nx * (off + j)
            zz = az + uz * t + nz * (off + j)
            row.append(bm.verts.new(B(x, zz, 0.014 if k == 1 else 0.008)))
        rows.append(row)
    for r0, r1 in zip(rows, rows[1:]):
        bm.faces.new([r0[0], r1[0], r1[1], r0[1]])
        bm.faces.new([r0[1], r1[1], r1[2], r0[2]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    add(bm, Matrix.Identity(4), 'ground', lambda P, N, s: srgb(104, 96, 84) * (0.7 + 0.4 * noise.noise(P * 2.2)), 0, smooth=True)
    # Edging setts along both sides (low, walkable).
    eb = bmesh.new()
    k = 0.0
    while k < L_:
        for side in (-1, 1):
            x = ax + ux * k + nx * side * (width / 2 + 0.08)
            zz = az + uz * k + nz * side * (width / 2 + 0.08)
            if free(x, zz, 0.0, 0.0) or True:
                c = B(x, zz, 0.03)
                box(eb, c.x, c.y, c.z, 0.22, 0.14, 0.08 + rr.uniform(0, 0.03))
        k += 0.42 + rr.uniform(-0.05, 0.08)
    bevel_all(eb, 0.01)
    jitter(eb, 0.01, rr.random() * 20)
    add(eb, Matrix.Identity(4), 'stone', stone((106, 100, 90), 0.6, 0.3), rr.random() * 10)

def grass_tufts(count, rr, area, avoid_paths=True, region=None):
    bm = bmesh.new()
    placed = 0
    tries = 0
    while placed < count and tries < count * 6:
        tries += 1
        x, zz = rr.uniform(area[0], area[1]), rr.uniform(area[2], area[3])
        if avoid_paths and abs(x) < 44 and abs(zz) < 44:
            if path_dist(x, zz) < 1.4:
                continue
            if any(math.hypot(x - ax, zz - az) < 1.0 for ax, az, _ in ANCHORS):
                continue
            if any(x0 < x < x1 and z0 < zz < z1 for x0, x1, z0, z1 in RECTS[:2]):
                continue
        if -24 < x < -16 and zz < -38:
            continue
        y = ground_h(x, zz)
        base = B(x, zz, y)
        for k in range(rr.randint(4, 7)):
            a = rr.uniform(0, 2 * math.pi)
            h = rr.uniform(0.18, 0.5)
            lean = Vector((math.cos(a), math.sin(a), 0)) * rr.uniform(0.05, 0.22)
            side = Vector((-math.sin(a), math.cos(a), 0)) * 0.018
            o = Vector((math.cos(a), math.sin(a), 0)) * rr.uniform(0, 0.08)
            v0 = bm.verts.new(base + o - side)
            v1 = bm.verts.new(base + o + side)
            v2 = bm.verts.new(base + o + lean + Vector((0, 0, h)))
            bm.faces.new([v0, v1, v2])
        placed += 1
    add(bm, Matrix.Identity(4), 'grass', grass, rr.random() * 10, region=region or 'grass')

def leaves(count, rr):
    bm = bmesh.new()
    for i in range(count):
        x, zz = rr.uniform(-39, 39), rr.uniform(-39, 39)
        if any(x0 < x < x1 and z0 < zz < z1 for x0, x1, z0, z1 in RECTS[:2]):
            continue
        c = B(x, zz, 0.018)
        a = rr.uniform(0, 2 * math.pi)
        s = rr.uniform(0.05, 0.09)
        u = Vector((math.cos(a), math.sin(a), 0)) * s
        v = Vector((-math.sin(a), math.cos(a), 0)) * s * 0.6
        q = [bm.verts.new(c + u), bm.verts.new(c + v), bm.verts.new(c - u), bm.verts.new(c - v)]
        bm.faces.new(q)
    tmp_paint = lambda P, N, s: leaf(P, N, int(abs(P.x * 7 + P.y * 13)))
    add(bm, Matrix.Identity(4), 'grass', tmp_paint, 0, region='leaves')

# ---------------------------------------------------------------------------------------------
# Build the scene.
# ---------------------------------------------------------------------------------------------
def build():
    rr = random.Random(1891)
    ground()
    for a, b in PATHS:
        if abs(a[1]) > 39 or abs(b[1]) > 39:
            continue  # the avenue and catacombs have their own floors
        if math.hypot(a[0] - b[0], a[1] - b[1]) > 1 and not (abs(a[0]) < 4 and abs(a[1]) < 6 and abs(b[0]) < 4 and abs(b[1]) < 6):
            gravel_path(a, b, rr, 2.0 if 'x' else 1.8)

    # Boundary wall on the fence lines, leaving the two gate mouths.
    for s in CL['buildFenceSegments()']:
        if s['axis'] == 'z':
            p0, p1 = (s['fixed'], s['from']), (s['fixed'], s['to'])
        else:
            p0, p1 = (s['from'], s['fixed']), (s['to'], s['fixed'])
        wall_run(p0, p1, rr, region='walls')
    for gx, gz in [(-22.4, -40), (-17.6, -40), (23.1, 40), (26.9, 40)]:
        pier(gx, gz, rr, 2.5, region='walls', urn=True)

    # Grave sections: east-facing burials in rows, thinned wherever gameplay needs space.
    sections = [(-37, -24, -37, -14), (-12, 12, -37, -25), (13, 37, -37, -14), (-38, -27, 15, 37), (-22, -6, 17, 34),
                (27, 38, -10, 30), (-38, -29, -11, 3), (14, 25, -15, -4), (-17, -7, -12, -3), (12, 22, 15, 26), (-26, -14, 18, 30)]
    for x0, x1, z0, z1 in sections:
        zz = z0 + 0.8
        while zz < z1 - 0.6:
            x = x0 + rr.uniform(0, 0.6)
            while x < x1 - 2.2:
                kind = rr.random()
                gx, gz = x + rr.uniform(-0.15, 0.15), zz + rr.uniform(-0.15, 0.15)
                if rr.random() < 0.18 or not free_rect(gx - 0.3, gx + 2.2, gz - 0.55, gz + 0.55, 0.35):
                    x += rr.uniform(2.9, 3.6)
                    continue
                facing = (1, rr.uniform(-0.05, 0.05))
                if kind < 0.08:
                    ledger(gx + 1.0, gz, 2.0, 0.95, face_rot(0, 1), rr, chest=True)
                    STATS['graves'] += 1
                elif kind < 0.2:
                    ledger(gx + 1.0, gz, 1.9, 0.9, face_rot(0, 1), rr)
                    if rr.random() < 0.5:
                        headstone(gx - 0.05, gz, facing, rr, size=0.85)
                    STATS['graves'] += 1
                else:
                    headstone(gx, gz, facing, rr)
                    if rr.random() < 0.55:
                        kerb(gx + 1.15, gz, 1.85, 0.85, face_rot(0, 1), rr, rr.choice(['chips', 'grass']))
                    STATS['graves'] += 1
                x += rr.uniform(2.9, 3.6)
            zz += rr.uniform(1.6, 2.0)

    # Family plots: kerbed, railed enclosures with an obelisk.
    plots = [(-34, -23), (20, -30), (-33, 24), (33, 22), (-14, 26), (34, -4)]
    for px, pz in plots:
        w, d = 4.2, 5.0
        if not free_rect(px - w / 2 - 0.5, px + w / 2 + 0.5, pz - d / 2 - 0.5, pz + d / 2 + 0.5, 0.2):
            continue
        corners = [(px - w / 2, pz - d / 2), (px + w / 2, pz - d / 2), (px + w / 2, pz + d / 2), (px - w / 2, pz + d / 2)]
        cb = bmesh.new()
        for (ax_, az_), (bx_, bz_) in zip(corners, corners[1:] + corners[:1]):
            pa, pb = B(ax_, az_, 0.1), B(bx_, bz_, 0.1)
            mid = (pa + pb) / 2
            dvec = pb - pa
            box(cb, mid.x, mid.y, mid.z, abs(dvec.x) + 0.25, abs(dvec.y) + 0.25, 0.22)
        bevel_all(cb, 0.015)
        jitter(cb, 0.01, rr.random() * 30)
        add(cb, Matrix.Identity(4), 'stone', stone((116, 110, 98), 0.9), rr.random() * 10)
        gap = 0.9  # gate opening on the east side
        segs = [(corners[0], corners[1]), (corners[1], (px + w / 2, pz - gap / 2)), ((px + w / 2, pz + gap / 2), corners[2]), (corners[2], corners[3]), (corners[3], corners[0])]
        for a, b in segs:
            railing(a, b, 1.0, rr, base_y=0.21, spacing=0.12, posts=1.4)
            ax_, az_ = a; bx_, bz_ = b
            collider((ax_ + bx_) / 2, (az_ + bz_) / 2, max(abs(bx_ - ax_), 0.1) / 2 + 0.05, 0.62, max(abs(bz_ - az_), 0.1) / 2 + 0.05, 0)
        obelisk(px - 0.6, pz, rr, height=rr.uniform(2.6, 3.4), urn=rr.random() < 0.5)
        for k in range(3):
            headstone(px + 0.6, pz - 1.5 + 1.5 * k, (1, 0), rr, kind=rr.choice(['round', 'gothic', 'scroll']), size=0.9)
        for (ax_, az_), (bx_, bz_) in zip(corners, corners[1:] + corners[:1]):
            pass
        for k in range(len(ANCHORS)):
            pass
        ANCHORS.append((px, pz, max(w, d) / 2 + 0.6))

    # Landmarks: tall obelisks and a Celtic cross at open sight lines.
    for (x, zz, hgt) in [(-28, -6, 4.6), (31, 3, 4.2), (-4, -30, 4.8), (6, 30, 4.0), (-34, 32, 3.8)]:
        if free(x, zz, 1.0):
            obelisk(x, zz, rr, height=hgt, urn=rr.random() < 0.5)
            ANCHORS.append((x, zz, 1.5))
    for (x, zz) in [(-24, 18), (20, 19), (-30, -30)]:
        if free(x, zz, 1.2):
            big_cross(x, zz, rr, (1, 0))
            ANCHORS.append((x, zz, 1.6))
            break

    # Dead oaks where the old pines stood; fallen logs where the trunks were.
    for t in CL['generateTrees()']:
        x, zz = t['position'][0], t['position'][2]
        hit = [(ax, az, ar) for ax, az, ar in ANCHORS if math.hypot(x - ax, zz - az) < ar]
        if hit:  # an old tree stood on a gameplay spot (e.g. the merchant): leave that spot clear
            print('SKIP_TREE', x, zz, 'near', hit[0][:2])
            continue
        if t['kind'].startswith('pine'):
            oak(x, zz, rr, scale=rr.uniform(0.9, 1.25))
            collider(x, zz, 0.42, 1.6, 0.42, 0)
        else:
            log(x, zz, rr, 2.6 if t['kind'] == 'trunk-long' else 1.6, rr.uniform(0, math.pi))

    # Mausoleum Row: the six crypts on their footprints, the Crane crypt closing the avenue.
    sizes = CL['AVENUE_CRYPT_SIZE']
    styles = ['classical', 'gothic', 'egyptian', 'classical', 'gothic', 'egyptian']
    for i, c in enumerate(CL['avenueCrypts()']):
        x, zz = c['position'][0], c['position'][2]
        s = sizes[c['model']]
        facing = (1, 0) if x < -20 else (-1, 0)
        mausoleum(x, zz, s['width'], s['depth'], 2.6 + (0.4 if c['model'] == 'crypt-small' else 0), facing, rr, styles[i], region='north')
    cx, _, cz = CL['craneCryptPosition()']
    CR = CL['CRANE_CRYPT']
    mausoleum(cx, cz, CR['halfX'] * 2, CR['halfZ'] * 2, 3.3, (0, 1), rr, 'classical', region='north')
    # More crypts behind the avenue so the row reads as a street of the dead (out of reach).
    for x in (-29.5, -10.5):
        for zz in (-46, -53, -60):
            mausoleum(x + rr.uniform(-0.4, 0.4), zz + rr.uniform(-0.6, 0.6), rr.uniform(2.2, 3.0), rr.uniform(2.6, 3.4), rr.uniform(2.4, 3.2), (1, 0) if x < -20 else (-1, 0), rr, rr.choice(styles), region='north')
    # Avenue paving: worn flagstones down the path and in front of the Crane crypt.
    fb = bmesh.new()
    zz = -40.2
    while zz > -61.5:
        lz = rr.uniform(0.55, 0.85)
        x = -21.7
        while x < -18.3:
            lx = rr.uniform(0.5, 0.9)
            ex = min(-18.3, x + lx)
            c = B((x + ex) / 2, zz - lz / 2, 0.012 + rr.uniform(0, 0.01))
            box(fb, c.x, c.y, c.z, (ex - x) - 0.05, lz - 0.05, 0.03)
            x = ex
        zz -= lz
    bevel_all(fb, 0.008)
    jitter(fb, 0.004, 3)
    add(fb, Matrix.Identity(4), 'stone', stone((96, 92, 86), 0.5, 0.2), 4, region='north')
    for zz in (-42, -47.2, -52.6, -57.6):
        for x in (-22.2, -17.8):
            if all(math.hypot(x - ax, zz - az) > 1.2 for ax, az, _ in ANCHORS if az < -40):
                pass
    # Graves and trees outside the walls (out of reach) so the land beyond reads as cemetery too.
    for i in range(60):
        x, zz = rr.uniform(-75, 75), rr.uniform(-75, 75)
        if flat_zone(x, zz) or abs(x) < 46 and abs(zz) < 46:
            continue
        if ground_h(x, zz) > 3:
            continue
        y = ground_h(x, zz)
        headstone_outer(x, zz, y, rr)
    for i in range(60):
        x, zz = rr.uniform(-100, 100), rr.uniform(-100, 100)
        if abs(x) < 50 and abs(zz) < 50 or flat_zone(x, zz):
            continue
        y = ground_h(x, zz)
        t = rr.choice(FAR_OAKS)
        out = bmesh.new()
        for p in t:
            tmp = bpy.data.meshes.new('t'); p.to_mesh(tmp); out.from_mesh(tmp); bpy.data.meshes.remove(tmp)
        add(out, place(x, zz, rr.uniform(0, 6.3), y=y - 0.1, scale=rr.uniform(1.1, 1.7)), 'bark', bark, rr.random(), smooth=True, region='outer')
    grass_tufts(4200, rr, (-39.5, 39.5, -39.5, 39.5))
    grass_tufts(1400, rr, (-90, 90, -90, 90), avoid_paths=False, region='grass-outer')
    leaves(2600, rr)

def headstone_outer(x, zz, y, rr):
    w, h, t = rr.uniform(0.5, 0.8), rr.uniform(0.6, 1.2), 0.13
    bm = extrude(outline(rr.choice(['round', 'broken', 'segment', 'cross']), w, h, rr), t)
    bevel_all(bm, 0.012)
    jitter(bm, 0.008, rr.random() * 20)
    add(bm, place(x, zz, rr.uniform(0, 6.3), y=y - 0.08, tilt=(rr.uniform(-0.25, 0.25), rr.uniform(-0.2, 0.2))), 'stone', stone(rr.choice(STONE_TONES)), rr.random(), region='outer')

# ---------------------------------------------------------------------------------------------
# Materials, mesh creation, export, previews.
# ---------------------------------------------------------------------------------------------
MATS = {
    'stone': (0.92, 0.0, False), 'iron': (0.55, 0.65, False), 'bark': (0.95, 0.0, False),
    'ground': (1.0, 0.0, False), 'grass': (0.9, 0.0, True), 'wood': (0.85, 0.0, False),
}

def material(name):
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    rough, metal, double = MATS[name]
    m = bpy.data.materials.new('lr-' + name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    ca = nt.nodes.new('ShaderNodeVertexColor')
    ca.layer_name = 'Col'
    nt.links.new(ca.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    m.use_backface_culling = not double
    return m

def make_objects(coll):
    tris = 0
    for key, b in sorted(BATCHES.items()):
        if not b['f']:
            continue
        mat, region = key.split(':')
        me = bpy.data.meshes.new(f'{region}-{mat}')
        me.from_pydata([tuple(v) for v in b['v']], [], b['f'])
        me.update()
        attr = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
        flat = []
        for c in b['c']:
            flat.extend((c.x, c.y, c.z, 1.0))
        attr.data.foreach_set('color', flat)
        me.polygons.foreach_set('use_smooth', b['s'])
        me.materials.append(material(mat))
        ob = bpy.data.objects.new(f'{region}-{mat}', me)
        coll.objects.link(ob)
        t = sum(len(f) - 2 for f in b['f'])
        tris += t
        print('BATCH', key, t)
    return tris

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def export(coll):
    os.makedirs(OUT_DIR, exist_ok=True)
    for ob in bpy.context.scene.objects:
        ob.select_set(ob.users_collection[0] == coll)
    path = os.path.join(OUT_DIR, 'graveyard.glb')
    kw = dict(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
              export_draco_position_quantization=14, export_draco_normal_quantization=10, export_draco_color_quantization=8,
              export_cameras=False, export_lights=False, export_materials='EXPORT')
    try:
        bpy.ops.export_scene.gltf(**kw, export_vertex_color='ACTIVE')
    except TypeError:
        bpy.ops.export_scene.gltf(**kw)
    json.dump({'note': 'Game coordinates (x east, y up, z south). Boxes: centre, half extents, rotation about Y in radians.',
               'count': len(COLLIDERS), 'boxes': COLLIDERS}, open(os.path.join(OUT_DIR, 'graveyard-colliders.json'), 'w'), indent=0)
    return os.path.getsize(path)

def preview_context(coll):
    """Stand-in blocks for the hut, chapel and catacomb tunnel, so renders read in context."""
    pc = bpy.data.collections.new('preview-only')
    bpy.context.scene.collection.children.link(pc)
    def block(name, gx, gz, sx, sz, h, col):
        bm = bmesh.new()
        box(bm, 0, 0, h / 2, sx, sz, h)
        me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
        ob = bpy.data.objects.new(name, me)
        ob.location = B(gx, gz)
        m = bpy.data.materials.new(name); m.diffuse_color = (*col, 1); m.use_nodes = True
        m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*col, 1)
        me.materials.append(m)
        pc.objects.link(ob)
    block('hut', 0, 0, 6.4, 6, 3.4, (0.12, 0.09, 0.07))
    block('chapel', 10, 5, 5.6, 12.6, 4.6, (0.16, 0.15, 0.14))
    block('catacombs', 25, 50, 3.3, 20, 2.6, (0.1, 0.1, 0.1))
    for lp in CL['LAMP_POSTS']:
        p = lp['position']
        L_ = bpy.data.lights.new('lamp', 'POINT'); L_.energy = 120; L_.color = (1.0, 0.62, 0.3); L_.shadow_soft_size = 0.2
        o = bpy.data.objects.new('lamp', L_); o.location = B(p[0], p[2], 2.6); pc.objects.link(o)

def render_previews():
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    sc = bpy.context.scene
    try:
        sc.render.engine = 'BLENDER_EEVEE_NEXT'
    except TypeError:
        sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 1280, 720
    try:
        sc.eevee.taa_render_samples = 24
    except Exception:
        pass
    sc.view_settings.view_transform = 'AgX' if 'AgX' in [i.identifier for i in sc.view_settings.bl_rna.properties['view_transform'].enum_items] else 'Filmic'
    sc.view_settings.look = 'None'
    world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
    bg = world.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.035, 0.045, 0.07, 1); bg.inputs['Strength'].default_value = 1.0
    sun = bpy.data.lights.new('moon', 'SUN'); sun.energy = 1.6; sun.color = (0.62, 0.72, 1.0); sun.angle = 0.06
    so = bpy.data.objects.new('moon', sun); so.rotation_euler = (math.radians(58), 0, math.radians(-140)); sc.collection.objects.link(so)
    # Distance fog through the compositor's mist pass.
    sc.view_layers[0].use_pass_mist = True
    world.mist_settings.start = 8; world.mist_settings.depth = 70; world.mist_settings.falloff = 'QUADRATIC'
    sc.use_nodes = True
    nt = sc.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    rl = nt.nodes.new('CompositorNodeRLayers'); comp = nt.nodes.new('CompositorNodeComposite')
    mix = nt.nodes.new('CompositorNodeMixRGB'); mix.inputs[2].default_value = (0.06, 0.07, 0.09, 1)
    nt.links.new(rl.outputs['Mist'], mix.inputs[0]); nt.links.new(rl.outputs['Image'], mix.inputs[1]); nt.links.new(mix.outputs[0], comp.inputs[0])
    cam_d = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cam_d); sc.collection.objects.link(cam); sc.camera = cam
    shots = {
        'overview': ((38, 48, 62), (-2, 0, -6), 30),
        'grounds-west': ((-6, 1.65, -6), (-26, 0.8, -22), 32),
        'grounds-east': ((8, 1.65, -12), (28, 0.8, -28), 32),
        'mausoleum-row': ((-20, 1.65, -38.5), (-20, 1.4, -62), 30),
        'south': ((4, 1.65, 12), (-20, 0.8, 30), 32),
        'graves-close': ((-14.5, 1.3, -30), (-22, 0.5, -34), 36),
    }
    for name, (pos, tgt, lens) in shots.items():
        cam_d.lens = lens
        cam.location = B(pos[0], pos[2], pos[1])
        d = B(tgt[0], tgt[2], tgt[1]) - cam.location
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        world.mist_settings.depth = 140 if name == 'overview' else 60
        sc.render.filepath = os.path.join(PREVIEW_DIR, name + '.png')
        bpy.ops.render.render(write_still=True)

clear_scene()
build()
coll = bpy.data.collections.new('graveyard')
bpy.context.scene.collection.children.link(coll)
tris = make_objects(coll)
size = 0
if MODE in ('export', 'both'):
    size = export(coll)
if MODE in ('render', 'both'):
    preview_context(coll)
    render_previews()
print('SCENE_STATS ' + json.dumps({'tris': tris, 'objects': len(coll.objects), 'colliders': len(COLLIDERS), 'glb_bytes': size, **STATS}))
