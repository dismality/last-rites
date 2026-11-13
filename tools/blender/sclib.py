"""Shared toolkit for the Last Rites scenery generators (chapel exterior, hut, catacombs, props).

Everything is written in GAME coordinates: x east, y up, z south (three.js). G() converts to Blender (x, -z, y).
A game yaw (three.js rotation.y) equals a Blender rotation about Z by the same angle.

Geometry is collected into batches (one mesh per material or per named part), painted with vertex colours
(Col -> COLOR_0) and exported as a Draco GLB. Painters get the vertex in the piece's own space (L), in world space
(P, Blender axes) and the face normal (N, Blender axes), so grain follows the board while grime and moss follow
the world.
"""
import bpy, bmesh, json, math, os, random
from mathutils import Vector, Matrix, noise

R = random.Random(1891)


# ------------------------------------------------------------------ coordinates ----------------------------------------
def G(x, y, z):
    return Vector((x, -z, y))


def T(x, y, z):
    return Matrix.Translation(G(x, y, z))


def RY(a):
    return Matrix.Rotation(a, 4, 'Z')


def RX(a):
    """Rotation about the game X axis (positive tips +Y toward -Z, i.e. toward the viewer looking along -Z)."""
    return Matrix.Rotation(a, 4, 'X')


def RZ(a):
    """Rotation about the game Z axis (= Blender -Y)."""
    return Matrix.Rotation(-a, 4, 'Y')


def S(sx, sy, sz):
    return Matrix.Diagonal((sx, sz, sy, 1))


def srgb(r, g, b):
    return Vector(((r / 255) ** 2.2, (g / 255) ** 2.2, (b / 255) ** 2.2))


def lerp(a, b, t):
    t = max(0.0, min(1.0, t))
    return a * (1 - t) + b * t


def smoothstep(e0, e1, x):
    if e1 == e0:
        return 1.0 if x >= e1 else 0.0
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


# ------------------------------------------------------------------ kit (batches) --------------------------------------
class Kit:
    def __init__(self):
        self.batches = {}
        self.colliders = []
        self.anchors = {}

    def add(self, bm, M, mat, paint, seed=0.0, name=None, smooth=False, origin=None):
        """Adds a bmesh (in its own space) transformed by M. `origin` (game coords) makes the batch's object pivot there."""
        bm.normal_update()
        bm.verts.index_update()
        local = [v.co.copy() for v in bm.verts]
        lo = Vector((min(c.x for c in local), min(c.y for c in local), min(c.z for c in local))) if local else Vector()
        hi = Vector((max(c.x for c in local), max(c.y for c in local), max(c.z for c in local))) if local else Vector()
        ext = hi - lo
        grain = max(range(3), key=lambda i: ext[i])
        bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
        bm.normal_update()
        key = name or mat
        b = self.batches.setdefault(key, {'mat': mat, 'v': [], 'f': [], 'c': [], 's': [], 'origin': origin})
        if origin is not None:
            b['origin'] = origin
        base = len(b['v'])
        b['v'] += [v.co.copy() for v in bm.verts]
        for f in bm.faces:
            b['f'].append(tuple(base + v.index for v in f.verts))
            b['s'].append(smooth)
            for loop in f.loops:
                L = local[loop.vert.index]
                b['c'].append(paint(L, loop.vert.co, f.normal, seed, grain))
        bm.free()

    def collider(self, x, z, hx, hy, hz, rot=0.0, y=None, note=''):
        self.colliders.append({'center': [round(x, 3), round(hy if y is None else y, 3), round(z, 3)],
                               'half': [round(hx, 3), round(hy, 3), round(hz, 3)], 'rotY': round(rot, 4), 'note': note})

    def anchor(self, name, x, y, z, **extra):
        self.anchors[name] = dict(position=[round(x, 3), round(y, 3), round(z, 3)], **extra)

    def tris(self):
        return sum(sum(len(f) - 2 for f in b['f']) for b in self.batches.values())


# ------------------------------------------------------------------ painters -------------------------------------------
# Signature: paint(L, P, N, seed, grain) -> linear RGB Vector. L local (Blender axes), P world (Blender axes).
GRIME = srgb(36, 31, 26)
MOSS = srgb(74, 84, 44)
LICHEN = srgb(150, 146, 112)


def stone(tone=(128, 122, 112), moss=0.35, grime_h=0.5, streak=0.0, var=0.22):
    base = srgb(*tone)

    def f(L, P, N, s, g):
        n = noise.noise(P * 1.3 + Vector((s, 0, 0)))
        fine = noise.noise(P * 9 + Vector((0, s, 0)))
        c = base * (1 - var / 2 + var * (0.5 + 0.5 * n)) * (0.94 + 0.08 * fine)
        c = lerp(c, GRIME, 0.55 * (1 - smoothstep(0.0, grime_h, P.z)))
        if streak:
            st = 0.5 + 0.5 * noise.noise(Vector((P.x * 6, P.y * 6, P.z * 0.4)) + Vector((s, 3, 0)))
            c = lerp(c, GRIME, streak * smoothstep(0.55, 0.9, st))
        up = max(0.0, N.z)
        m = moss * (smoothstep(0.4, 0.95, up) * 0.8 + 0.6 * (1 - smoothstep(0.0, 0.7, P.z)))
        m *= smoothstep(-0.1, 0.5, noise.noise(P * 2.2 + Vector((7, s, 1))))
        c = lerp(c, MOSS, min(0.85, m))
        if noise.noise(P * 5.5 + Vector((s, 9, 4))) > 0.5:
            c = lerp(c, LICHEN, 0.35)
        return c
    return f


def wood(tone=(88, 58, 36), var=0.3, weather=0.0, grime_h=0.25):
    base = srgb(*tone)
    grey = srgb(118, 112, 102)

    def f(L, P, N, s, g):
        k = [3.0, 3.0, 3.0]
        k[g] = 0.35
        q = Vector((L.x * k[0] * 8, L.y * k[1] * 8, L.z * k[2] * 8))
        grain = noise.noise(q + Vector((s * 3.1, s, 0)))
        ring = 0.5 + 0.5 * math.sin(grain * 9.0)
        c = base * (1 - var / 2 + var * ring) * (0.9 + 0.12 * noise.noise(P * 3 + Vector((s, 0, 0))))
        if weather:
            c = lerp(c, grey * (0.8 + 0.25 * ring), weather * (0.6 + 0.4 * max(0.0, N.z)))
        c = lerp(c, GRIME, 0.4 * (1 - smoothstep(0.0, grime_h, P.z)))
        return c
    return f


def flat(rgb, var=0.12, freq=5.0):
    base = srgb(*rgb)

    def f(L, P, N, s, g):
        return base * (1 - var / 2 + var * (0.5 + 0.5 * noise.noise(P * freq + Vector((s, 0, 0)))))
    return f


def iron(rust=0.35, tone=(42, 38, 36)):
    base = srgb(*tone)
    r1, r2 = srgb(110, 52, 24), srgb(150, 84, 40)

    def f(L, P, N, s, g):
        c = base * (0.85 + 0.25 * noise.noise(P * 6 + Vector((s, 0, 0))))
        n = 0.5 + 0.5 * noise.noise(P * 4.0 + Vector((0, s, 2)))
        r = rust * smoothstep(0.45, 0.85, n) + rust * 0.6 * (1 - smoothstep(0.0, 0.4, P.z))
        return lerp(c, lerp(r1, r2, noise.noise(P * 11) * 0.5 + 0.5), min(0.9, r))
    return f


def slate(tone=(52, 56, 62)):
    base = srgb(*tone)

    def f(L, P, N, s, g):
        c = base * (0.8 + 0.3 * (0.5 + 0.5 * noise.noise(P * 0.9 + Vector((s, 1, 0)))))
        c *= 0.9 + 0.12 * noise.noise(P * 14)
        m = 0.5 * smoothstep(0.35, 0.8, noise.noise(P * 1.7 + Vector((4, s, 2))))
        return lerp(c, MOSS * 0.9, m)
    return f


def earth(tone=(46, 34, 24)):
    base = srgb(*tone)

    def f(L, P, N, s, g):
        c = base * (0.75 + 0.4 * (0.5 + 0.5 * noise.noise(P * 3 + Vector((s, 0, 0)))))
        if noise.noise(P * 9 + Vector((0, s, 0))) > 0.55:
            c = lerp(c, srgb(92, 86, 74), 0.5)   # pebbles / clay
        return c
    return f


def bone(tone=(196, 182, 150)):
    base = srgb(*tone)

    def f(L, P, N, s, g):
        c = base * (0.8 + 0.25 * noise.noise(P * 7 + Vector((s, 0, 0))))
        return lerp(c, GRIME, 0.35 * smoothstep(0.2, 0.8, noise.noise(P * 3 + Vector((0, s, 5)))) + 0.2 * (1 - max(0.0, N.z)))
    return f


def const(rgb):
    c = srgb(*rgb)
    return lambda L, P, N, s, g: c


WAX = flat((226, 214, 178), 0.1)
FLAME = const((255, 196, 96))
EMBER = flat((255, 120, 40), 0.3)
BRASS = flat((150, 112, 48), 0.25)
PAPER = flat((202, 186, 150), 0.18, 9)
ROPE = flat((122, 98, 64), 0.25, 14)


def glass_amber(L, P, N, s, g):
    pick = [srgb(190, 110, 50), srgb(214, 160, 70), srgb(160, 80, 40), srgb(220, 186, 110)]
    k = int(abs(math.floor(P.z * 7) * 3 + math.floor((P.x + P.y) * 6))) % len(pick)
    return pick[k]


# ------------------------------------------------------------------ mesh helpers ---------------------------------------
def new():
    return bmesh.new()


def box(bm, c, s, M=None):
    """Box at game centre c=(x,y,z) with game size s=(sx,sy,sz); optional extra matrix applied about the origin."""
    m = T(*c) @ S(*s)
    if M is not None:
        m = M @ m
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def bevel(bm, off, segs=1):
    try:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=off, segments=segs, affect='EDGES', clamp_overlap=True, profile=0.5)
    except Exception:
        pass


def jitter(bm, amp, s=0.0, freq=4.0):
    for v in bm.verts:
        v.co += noise.noise_vector(v.co * freq + Vector((s, s * 2, 0))) * amp


def append(dst, src, M=None):
    if M is not None:
        bmesh.ops.transform(src, matrix=M, verts=src.verts)
    me = bpy.data.meshes.new('t')
    src.to_mesh(me)
    dst.from_mesh(me)
    bpy.data.meshes.remove(me)
    src.free()
    return dst


def merge(*bms):
    out = new()
    for b in bms:
        append(out, b)
    return out


def lathe(profile, segs=12, start=0.0, sweep=2 * math.pi, cap=True):
    """Profile of (radius, y) around the game Y axis."""
    bm = new()
    full = abs(sweep - 2 * math.pi) < 1e-6
    n = segs if full else segs + 1
    rings = []
    for r, y in profile:
        if r < 1e-6:
            rings.append([bm.verts.new((0, 0, y))])
        else:
            rings.append([bm.verts.new((r * math.cos(start + sweep * i / segs), r * math.sin(start + sweep * i / segs), y))
                          for i in range(n)])
    for a, b in zip(rings, rings[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        for i in range(segs):
            j = (i + 1) % n if full else i + 1
            if len(a) == 1:
                bm.faces.new([a[0], b[i], b[j]])
            elif len(b) == 1:
                bm.faces.new([a[i], b[0], a[j]])
            else:
                bm.faces.new([a[i], a[j], b[j], b[i]])
    if cap and full:
        if len(rings[0]) > 1:
            bm.faces.new(list(reversed(rings[0])))
        if len(rings[-1]) > 1:
            bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def cyl(r, h, segs=10, y0=0.0, r2=None):
    return lathe([(0, y0), (r, y0), (r if r2 is None else r2, y0 + h), (0, y0 + h)], segs)


def prism(pts, depth, z0=None):
    """Extrudes a 2D outline of game (x, y) points along game Z, centred unless z0 is given (then z0..z0+depth)."""
    bm = new()
    a, b = (-depth / 2, depth / 2) if z0 is None else (z0, z0 + depth)
    fr = [bm.verts.new(G(x, y, a)) for x, y in pts]
    bk = [bm.verts.new(G(x, y, b)) for x, y in pts]
    bm.faces.new(fr)
    bm.faces.new(list(reversed(bk)))
    for i in range(len(pts)):
        j = (i + 1) % len(pts)
        bm.faces.new([fr[i], fr[j], bk[j], bk[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def arch_curve(w, spring, apex, n=10, pointed=True):
    """Points of an arch intrados from the left springing to the right springing, (x, y)."""
    hw = w / 2
    pts = []
    if pointed:
        rad = w * 0.85
        cx = -hw + rad                                  # left arc's centre sits right of the opening's middle
        a0, a1 = math.pi, math.acos((0 - cx) / rad)     # from the left springing to x = 0
        h0 = rad * math.sin(a1)
        half = [(cx + rad * math.cos(a0 + (a1 - a0) * i / (n // 2)),
                 spring + rad * math.sin(a0 + (a1 - a0) * i / (n // 2)) * (apex - spring) / h0) for i in range(n // 2 + 1)]
        half[-1] = (0.0, apex)
        pts = half + [(-x, y) for x, y in reversed(half[:-1])]
    else:
        for i in range(n + 1):
            a = math.pi * (1 - i / n)
            pts.append((hw * math.cos(a), spring + (apex - spring) * math.sin(a)))
    return pts


def arch_top(w, spring, apex, x, pointed=True):
    """Height of the arch intrados above x (inside |x| <= w/2)."""
    pts = arch_curve(w, spring, apex, 24, pointed)
    best = spring
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        lo, hi = min(ax, bx), max(ax, bx)
        if lo - 1e-6 <= x <= hi + 1e-6 and hi - lo > 1e-9:
            t = (x - ax) / (bx - ax)
            best = ay + (by - ay) * t
            break
    return best


def arch_ring(w, spring, apex, thick, depth, n=12, pointed=True, z0=None):
    """A moulded ring (archivolt) around an arch opening: outline offset outward by `thick`, depth along Z."""
    inner = arch_curve(w, spring, apex, n, pointed)
    outer = arch_curve(w + thick * 2, spring, apex + thick * 1.15, n, pointed)
    bm = new()
    for (a, b), (c, d) in zip(zip(inner, inner[1:]), zip(outer, outer[1:])):
        quad = [a, b, d, c]
        append(bm, prism(quad, depth, z0))
    return bm


def tube(pts, r, segs=6, r_end=None):
    """Sweeps a circle of radius r along game-space points (list of (x,y,z))."""
    P = [G(*p) for p in pts]
    bm = new()
    rings = []
    prev_n = None
    for i, p in enumerate(P):
        t = (P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized()
        if prev_n is None:
            up = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
            n = t.cross(up).normalized()
        else:
            n = (prev_n - t * prev_n.dot(t)).normalized()
        prev_n = n
        bn = t.cross(n)
        rr = r if r_end is None else r + (r_end - r) * i / (len(P) - 1)
        rings.append([bm.verts.new(p + (n * math.cos(2 * math.pi * k / segs) + bn * math.sin(2 * math.pi * k / segs)) * rr)
                      for k in range(segs)])
    for a, b in zip(rings, rings[1:]):
        for k in range(segs):
            j = (k + 1) % segs
            bm.faces.new([a[k], a[j], b[j], b[k]])
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def sphere(r, c=(0, 0, 0), u=10, v=7, sy=1.0):
    bm = new()
    bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=r)
    bmesh.ops.transform(bm, matrix=T(*c) @ S(1, sy, 1), verts=bm.verts)
    return bm


def plank_run(bm, axis, a0, a1, fixed, y0, y1, depth, board=0.18, gap=0.008, offset_axis_val=0.0, s=0.0, vertical=False,
              warp=0.006):
    """Boards covering a rectangle. axis 'x' or 'z' is the wall run; boards horizontal (clapboard) or vertical."""
    if vertical:
        u = a0
        while u < a1 - 1e-4:
            w = min(board * R.uniform(0.85, 1.2), a1 - u)
            c = (u + w / 2)
            h = (y1 - y0) - R.uniform(0, 0.02)
            if axis == 'x':
                box(bm, (c, y0 + h / 2, fixed + R.uniform(-warp, warp)), (w - gap, h, depth))
            else:
                box(bm, (fixed + R.uniform(-warp, warp), y0 + h / 2, c), (depth, h, w - gap))
            u += w
    else:
        y = y0
        while y < y1 - 1e-4:
            h = min(board, y1 - y)
            c = y + h / 2
            if axis == 'x':
                box(bm, (((a0 + a1) / 2) + R.uniform(-0.01, 0.01), c, fixed + R.uniform(-warp, warp)), (a1 - a0, h - gap, depth))
            else:
                box(bm, (fixed + R.uniform(-warp, warp), c, (a0 + a1) / 2 + R.uniform(-0.01, 0.01)), (depth, h - gap, a1 - a0))
            y += h


# ------------------------------------------------------------------ materials, objects, export -------------------------
MATS = {  # roughness, metallic, emission strength, emission colour
    'stone': (0.93, 0.0, 0, None), 'plaster': (0.95, 0.0, 0, None), 'wood': (0.75, 0.0, 0, None),
    'iron': (0.6, 0.55, 0, None), 'brass': (0.4, 0.65, 0, None), 'slate': (0.7, 0.0, 0, None), 'cloth': (0.97, 0.0, 0, None),
    'wax': (0.5, 0.0, 0, None), 'paper': (0.9, 0.0, 0, None), 'earth': (1.0, 0.0, 0, None), 'bone': (0.8, 0.0, 0, None),
    'rope': (0.95, 0.0, 0, None), 'glass': (0.2, 0.0, 0.9, (0.95, 0.6, 0.3)), 'flame': (0.6, 0.0, 3.0, (1.0, 0.62, 0.28)),
    'ember': (0.8, 0.0, 2.0, (1.0, 0.4, 0.12)), 'water': (0.05, 0.0, 0, None), 'night-glass': (0.15, 0.0, 0, None),
}


def material(name):
    key = 'lr-' + name
    if key in bpy.data.materials:
        return bpy.data.materials[key]
    rough, metal, emit, ecol = MATS[name]
    m = bpy.data.materials.new(key)
    m.use_nodes = True
    m.use_backface_culling = True   # exported single-sided; all meshes are closed
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    vc = nt.nodes.new('ShaderNodeVertexColor')
    vc.layer_name = 'Col'
    nt.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if emit:
        bsdf.inputs['Emission Color'].default_value = (*ecol, 1)
        bsdf.inputs['Emission Strength'].default_value = emit
    return m


def make_objects(kit, prefix):
    coll = bpy.data.collections.new(prefix)
    bpy.context.scene.collection.children.link(coll)
    for key, b in kit.batches.items():
        org = G(*b['origin']) if b['origin'] is not None else Vector()
        me = bpy.data.meshes.new(key)
        me.from_pydata([tuple(v - org) for v in b['v']], [], b['f'])
        me.update()
        attr = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
        flat_c = []
        for c in b['c']:
            flat_c += [c.x, c.y, c.z, 1.0]
        attr.data.foreach_set('color', flat_c)
        me.polygons.foreach_set('use_smooth', b['s'])
        me.materials.append(material(b['mat']))
        ob = bpy.data.objects.new(f'{prefix}-{key}', me)
        ob.location = org
        coll.objects.link(ob)
    return coll


def export(coll, path, meta=None, kit=None):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    for ob in bpy.context.scene.objects:
        ob.select_set(coll in ob.users_collection)
    bpy.context.view_layer.objects.active = next(iter(coll.objects), None)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                              export_vertex_color='ACTIVE', export_draco_mesh_compression_enable=True,
                              export_draco_mesh_compression_level=6, export_cameras=False, export_lights=False)
    if kit is not None and (kit.colliders or kit.anchors or meta):
        data = {'note': 'Game coordinates in this model\'s own space. Boxes: centre, half extents, rotY.'}
        data.update(meta or {})
        if kit.anchors:
            data['anchors'] = kit.anchors
        if kit.colliders:
            data['boxes'] = kit.colliders
        json.dump(data, open(path.replace('.glb', '.json'), 'w'), indent=1)
    return os.path.getsize(path)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


# ------------------------------------------------------------------ preview --------------------------------------------
def preview_setup(res=(1280, 720), world=(0.035, 0.04, 0.05), strength=1.0, samples=32):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.eevee.taa_render_samples = samples
    sc.view_settings.view_transform = 'AgX'
    sc.render.resolution_x, sc.render.resolution_y = res
    w = bpy.data.worlds.new('w')
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (*world, 1)
    bg.inputs['Strength'].default_value = strength
    return sc


def light(kind, pos, energy, color=(1, 1, 1), size=0.3, rot=None):
    L = bpy.data.lights.new('l', kind)
    L.energy = energy
    L.color = color
    if kind == 'SUN':
        L.angle = 0.1
    else:
        L.shadow_soft_size = size
    o = bpy.data.objects.new('l', L)
    o.location = G(*pos)
    if rot is not None:
        o.rotation_euler = rot
    bpy.context.scene.collection.objects.link(o)
    return o


def ground(size=40, tone=(46, 52, 38), y=-0.001, c=(0, 0)):
    bm = new()
    box(bm, (c[0], y - 0.05, c[1]), (size, 0.1, size))
    me = bpy.data.meshes.new('ground')
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new('ground', me)
    mat = bpy.data.materials.new('ground')
    mat.use_nodes = True
    col = srgb(*tone)
    mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (col.x, col.y, col.z, 1)
    mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1
    me.materials.append(mat)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def shoot(out_dir, shots, lens_default=28):
    sc = bpy.context.scene
    cd = bpy.data.cameras.new('c')
    cam = bpy.data.objects.new('c', cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    cd.clip_start = 0.05
    os.makedirs(out_dir, exist_ok=True)
    for name, (pos, tgt, *rest) in shots.items():
        cd.lens = rest[0] if rest else lens_default
        cam.location = G(*pos)
        cam.rotation_euler = (G(*tgt) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(out_dir, f'{name}.png')
        bpy.ops.render.render(write_still=True)


# ------------------------------------------------------------------ shared pieces --------------------------------------
def pane(c, size, normal):
    """One-sided quad (game coords) facing `normal` ('+x','-x','+z','-z'); size = (width along the wall, height)."""
    bm = new()
    w, h = size
    x, y, z = c
    if normal in ('+x', '-x'):
        pts = [(x, y - h / 2, z - w / 2), (x, y - h / 2, z + w / 2), (x, y + h / 2, z + w / 2), (x, y + h / 2, z - w / 2)]
    else:
        pts = [(x - w / 2, y - h / 2, z), (x + w / 2, y - h / 2, z), (x + w / 2, y + h / 2, z), (x - w / 2, y + h / 2, z)]
    f = bm.faces.new([bm.verts.new(G(*p)) for p in pts])
    bm.normal_update()
    want = {'+x': G(1, 0, 0), '-x': G(-1, 0, 0), '+z': G(0, 0, 1), '-z': G(0, 0, -1)}[normal]
    if f.normal.dot(want) < 0:
        f.normal_flip()
    return bm


def lantern(kit, base, seed, scale=1.0, name='iron'):
    """Caged iron lantern standing on `base` (game coords): base, four posts, cap, ring; glass and flame inside."""
    x, y, z = base
    s = scale
    bm = new()
    append(bm, lathe([(0, 0), (0.09 * s, 0), (0.09 * s, 0.025 * s), (0, 0.025 * s)], 8), T(x, y, z))
    append(bm, lathe([(0, 0.25 * s), (0.1 * s, 0.25 * s), (0.105 * s, 0.27 * s), (0.04 * s, 0.34 * s), (0.02 * s, 0.37 * s), (0, 0.37 * s)], 8), T(x, y, z))
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        box(bm, (x + 0.075 * s * math.cos(a), y + 0.14 * s, z + 0.075 * s * math.sin(a)), (0.014 * s, 0.23 * s, 0.014 * s))
    append(bm, lathe([(0.035 * s, -0.006 * s), (0.045 * s, -0.006 * s), (0.045 * s, 0.006 * s), (0.035 * s, 0.006 * s)], 10),
           T(x, y + 0.41 * s, z) @ RX(math.pi / 2))
    kit.add(bm, Matrix.Identity(4), 'iron', iron(0.35), seed, name=name)
    gl = lathe([(0.0, 0.03 * s), (0.062 * s, 0.03 * s), (0.066 * s, 0.14 * s), (0.062 * s, 0.25 * s), (0.0, 0.25 * s)], 10)
    kit.add(gl, T(x, y, z), 'glass', glass_amber, seed + 1, name='glow', smooth=True)
    return (x, y + 0.15 * s, z)
