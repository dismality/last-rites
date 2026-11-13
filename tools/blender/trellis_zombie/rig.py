# Puts the baked TRELLIS zombie onto the game's existing zombie skeleton and clips.
# glTF clips store absolute joint rotations, so the clips are copied as they are; only
# the bind pose (where each joint sits inside the new body) and the skin weights are new.
import json, struct, sys
import numpy as np
from mathutils import Matrix, Quaternion, Vector

STATIC = "C:/David/tripo/work/zombie_static.glb"
ORIG = "C:/David/last-rites/public/assets/models/enemies/zombie.glb"
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = ARGS[0] if ARGS else "C:/David/tripo/work/zombie_rigged.glb"
DROP = float(ARGS[1]) if len(ARGS) > 1 else 0.0

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def read_glb(p):
    b = open(p, 'rb').read()
    jl = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + jl])
    o = 20 + jl
    bl = struct.unpack('<I', b[o:o + 4])[0]
    return j, b[o + 8:o + 8 + bl]


def acc(j, binb, i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]
    dt = np.dtype(CT[a['componentType']]); n = NC[a['type']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = bv.get('byteStride', 0)
    if stride and stride != dt.itemsize * n:
        raw = np.frombuffer(binb, np.uint8, a['count'] * stride, off).reshape(a['count'], stride)
        arr = raw[:, :dt.itemsize * n].copy().view(dt).reshape(a['count'], n)
    else:
        arr = np.frombuffer(binb, dt, a['count'] * n, off).reshape(a['count'], n).copy()
    return arr


class Out:
    def __init__(self):
        self.bin = bytearray(); self.views = []; self.accs = []

    def view(self, data, target=None):
        while len(self.bin) % 4: self.bin.append(0)
        v = {'buffer': 0, 'byteOffset': len(self.bin), 'byteLength': len(data)}
        if target: v['target'] = target
        self.bin += data; self.views.append(v); return len(self.views) - 1

    def acc(self, arr, typ, ctype=5126, target=None, minmax=False):
        arr = np.ascontiguousarray(arr.astype(CT[ctype]))
        a = {'bufferView': self.view(arr.tobytes(), target), 'componentType': ctype, 'count': int(arr.shape[0]), 'type': typ}
        if minmax:
            a['min'] = [float(x) for x in arr.reshape(arr.shape[0], -1).min(0)]
            a['max'] = [float(x) for x in arr.reshape(arr.shape[0], -1).max(0)]
        self.accs.append(a); return len(self.accs) - 1


def local(n):
    if 'matrix' in n:
        return Matrix([n['matrix'][i::4] for i in range(4)])
    t = Vector(n.get('translation', [0, 0, 0])); r = n.get('rotation', [0, 0, 0, 1]); s = n.get('scale', [1, 1, 1])
    q = Quaternion((r[3], r[0], r[1], r[2]))
    return Matrix.Translation(t) @ q.to_matrix().to_4x4() @ Matrix.Diagonal((s[0], s[1], s[2], 1))


# ---------- read both files
sj, sb = read_glb(STATIC)
oj, ob = read_glb(ORIG)
prim = sj['meshes'][0]['primitives'][0]
P = acc(sj, sb, prim['attributes']['POSITION']).astype(np.float64)
N = acc(sj, sb, prim['attributes']['NORMAL']).astype(np.float64)
UV = acc(sj, sb, prim['attributes']['TEXCOORD_0'])
IDX = acc(sj, sb, prim['indices']).reshape(-1)
snode = [n for n in sj['nodes'] if 'mesh' in n][0]
assert 'rotation' not in snode and 'scale' not in snode, snode
img = sj['images'][0]; ibv = sj['bufferViews'][img['bufferView']]
IMG = sb[ibv.get('byteOffset', 0):ibv.get('byteOffset', 0) + ibv['byteLength']]
print('mesh verts', len(P), 'tris', len(IDX) // 3, 'image', img['mimeType'], len(IMG))

nodes = oj['nodes']
parent = {}
for i, n in enumerate(nodes):
    for c in n.get('children', []): parent[c] = i
W = {}
def world(i):
    if i not in W:
        W[i] = (world(parent[i]) if i in parent else Matrix.Identity(4)) @ local(nodes[i])
    return W[i]
name = {i: n.get('name', '') for i, n in enumerate(nodes)}
idx = {v: k for k, v in name.items()}
skin = oj['skins'][0]; joints = skin['joints']
po = {name[i]: Vector(world(i).to_translation()) for i in joints}
Ro = {name[i]: world(i).to_quaternion() for i in joints}
So = {name[i]: world(i).to_scale()[0] for i in joints}

# ---------- find the joints inside the new body (glTF space: y up, +z front, character left = +x)
x, y, z = P[:, 0], P[:, 1], P[:, 2]
cx = float(np.median(x[(y > 0.75) & (y < 0.95)]))
def sl(y0, cond, w=0.02):
    m = (np.abs(y - y0) < w) & cond
    assert m.sum() > 5, (y0, m.sum())
    return Vector(P[m].mean(0))
mid = np.abs(x - cx) < 0.2
pelvis = sl(0.93, mid); pelvis.x = cx
abdomen = sl(1.07, mid); abdomen.x = cx
chest = sl(1.24, mid); chest.x = cx
neck = sl(1.49, np.abs(x - cx) < 0.12); neck.x = cx
headj = sl(1.57, np.abs(x - cx) < 0.14); headj.x = cx
top = Vector((cx, y.max(), headj.z))
crotch = Vector((cx, 0.78, pelvis.z))
J = {'Body': pelvis.copy(), 'Hips': pelvis - Vector((0, 0.02, 0)), 'Abdomen': abdomen, 'Torso': chest, 'Neck': neck, 'Head': headj}
seg = {'Hips': [(crotch, pelvis + Vector((0, 0.05, 0)))], 'Abdomen': [(pelvis + Vector((0, 0.05, 0)), abdomen + Vector((0, 0.08, 0)))],
       'Torso': [(abdomen + Vector((0, 0.08, 0)), Vector((cx, 1.45, chest.z)))], 'Neck': [(Vector((cx, 1.45, neck.z)), headj)], 'Head': [(headj, top)]}
side = {}
hand = {}
for s, sfx in ((1, '.L'), (-1, '.R')):
    xs = s * (x - cx)
    leg = (xs > 0.015) & (xs < 0.25)
    hip = sl(0.88, leg); knee = sl(0.48, leg); ankle = sl(0.09, leg, 0.03)
    lm = leg & (y < 0.08); toe = Vector(P[lm][np.argmax(P[lm][:, 2])]); toe.y = 0.04
    sh = Vector(P[(xs > 0.16) & (xs < 0.22) & (y > 1.28)].mean(0))
    clav = Vector((cx + s * 0.06, sh.y - 0.02, chest.z))
    arm = (xs > 0.22) & (y > 0.85)
    tipi = np.argmax(((P[arm] - np.array(sh)) ** 2).sum(1)); tip = Vector(P[arm][tipi])
    pts = [sh]
    for b0 in np.arange(0.24, xs[arm].max() - 0.03, 0.035):
        m = arm & (xs >= b0) & (xs < b0 + 0.035)
        if m.sum() > 8: pts.append(Vector(P[m].mean(0)))
    pts.append(tip)
    L = [0.0]
    for a, b in zip(pts, pts[1:]): L.append(L[-1] + (b - a).length)
    def along(f):
        t = f * L[-1]
        for k in range(1, len(pts)):
            if L[k] >= t:
                u = (t - L[k - 1]) / max(L[k] - L[k - 1], 1e-6); return pts[k - 1].lerp(pts[k], u)
        return pts[-1]
    elbow = along(0.42); wrist = along(0.76)
    J.update({'Shoulder' + sfx: clav, 'UpperArm' + sfx: sh, 'LowerArm' + sfx: elbow, 'UpperLeg' + sfx: hip, 'LowerLeg' + sfx: knee, 'Foot' + sfx: ankle})
    for f in ('Pinky1', 'Middle1', 'Index1', 'Thumb1'): J[f + sfx] = wrist.copy()
    seg.update({'Shoulder' + sfx: [(clav, sh)], 'UpperArm' + sfx: [(sh, elbow)], 'LowerArm' + sfx: [(elbow, wrist)], 'Middle1' + sfx: [(wrist, tip)],
                'UpperLeg' + sfx: [(hip, knee)], 'LowerLeg' + sfx: [(knee, ankle), (ankle, toe)]})
    side.update({k + sfx: s for k in ('Shoulder', 'UpperArm', 'LowerArm', 'Middle1', 'UpperLeg', 'LowerLeg')})
    hand[sfx] = (wrist, tip)
    print(sfx, 'hip', hip, 'knee', knee, 'ankle', ankle, 'shoulder', sh, 'elbow', elbow, 'wrist', wrist, 'tip', tip)
print('pelvis', pelvis, 'chest', chest, 'neck', neck, 'head', headj, 'top', top)

# ---------- bind rotations: turn each original joint frame so its limb follows the new body
def qd(a, b, c, d):
    return (Vector(b) - Vector(a)).rotation_difference(Vector(d) - Vector(c))
child = {'Hips': 'Abdomen', 'Abdomen': 'Torso', 'Torso': 'Neck', 'Neck': 'Head'}
for sfx in ('.L', '.R'):
    child.update({'Shoulder' + sfx: 'UpperArm' + sfx, 'UpperArm' + sfx: 'LowerArm' + sfx, 'LowerArm' + sfx: 'Middle1' + sfx, 'UpperLeg' + sfx: 'LowerLeg' + sfx, 'LowerLeg' + sfx: 'Foot' + sfx})
Q = {}
for b, c in child.items():
    Q[b] = qd(po[b], po[c], J[b], J[c])
Q['Head'] = Q['Neck']
for sfx in ('.L', '.R'):
    wrist, tip = hand[sfx]
    qh = qd(po['Middle1' + sfx], po['Middle3' + sfx], wrist, tip)
    kh = (tip - wrist).length / (po['Middle3' + sfx] - po['Middle1' + sfx]).length * 0.8
    for f in ('Pinky', 'Middle', 'Index', 'Thumb'):
        for k in (1, 2, 3):
            n = f'{f}{k}{sfx}'
            if n not in po: continue
            Q[n] = qh
            if n not in J: J[n] = wrist + qh @ ((po[n] - po[f + '1' + sfx]) * kh)
kh = (top - headj).length / 0.6
for n in po:
    if n.startswith(('Tongue', 'Eyelid')):
        Q[n] = Q['Head']; J[n] = headj + Q['Head'] @ ((po[n] - po['Head']) * kh)
    if n.startswith('PoleTarget'):
        J[n] = J['LowerLeg' + n[-2:]] + (po[n] - po['LowerLeg' + n[-2:]])
for n in po:
    Q.setdefault(n, Quaternion())
    J.setdefault(n, po[n].copy())
missing = [n for n in po if n not in J]
assert not missing, missing

Wb = {}
for i in joints:
    n = name[i]
    Wb[i] = Matrix.Translation(J[n]) @ (Q[n] @ Ro[n]).to_matrix().to_4x4() @ Matrix.Diagonal((So[n],) * 3 + (1,))
def bindworld(i):
    return Wb[i] if i in Wb else world(i)

# ---------- skin weights from distance to each bone segment
names = [name[i] for i in joints]
D = []
for jn in names:
    if jn not in seg:
        D.append(np.full(len(P), np.inf)); continue
    d = np.full(len(P), np.inf)
    for a, b in seg[jn]:
        a = np.array(a); b = np.array(b); ab = b - a
        t = np.clip(((P - a) @ ab) / max(ab @ ab, 1e-9), 0, 1)
        d = np.minimum(d, np.linalg.norm(P - (a + t[:, None] * ab), axis=1))
    if jn in side:
        d[side[jn] * (x - cx) < -0.012] = np.inf
    D.append(d)
D = np.array(D).T
dmin = D.min(1, keepdims=True)
Wt = np.exp(-(D - dmin) / 0.018)
Wt[~np.isfinite(D)] = 0
order = np.argsort(-Wt, 1)[:, :4]
JW = np.take_along_axis(Wt, order, 1)
JW[JW < 0.03] = 0
JW /= JW.sum(1, keepdims=True)
JI = order.astype(np.uint8)
JI[JW == 0] = 0
used = sorted(set(names[k] for k in np.unique(JI[JW > 0])))
print('weighted joints', used)

# ---------- mesh into the skinned node's space
meshnode = idx['Zombie']
M = world(meshnode); Mi = M.inverted()
M3 = np.array(M.to_3x3())
Pl = (np.array(Mi) @ np.c_[P, np.ones(len(P))].T).T[:, :3]
Nl = N @ M3  # inverse-transpose of Mi's linear part
Nl /= np.linalg.norm(Nl, axis=1, keepdims=True)
IBM = np.array([np.array(bindworld(i).inverted() @ M).T.reshape(-1) for i in joints])  # column-major

# ---------- node defaults: original rotations, new offsets
newnodes = json.loads(json.dumps(nodes))
tnew, torig = {}, {}
for i in joints:
    p = parent.get(i)
    Lb = (bindworld(p).inverted() if p is not None else Matrix.Identity(4)) @ Wb[i]
    torig[i] = list(nodes[i].get('translation', [0, 0, 0]))
    tnew[i] = list(Lb.to_translation())
    newnodes[i]['translation'] = tnew[i]
for i, n in enumerate(newnodes):
    if 'mesh' in n and i != meshnode:
        n.pop('mesh', None); n.pop('skin', None)
newnodes[meshnode]['mesh'] = 0; newnodes[meshnode]['skin'] = 0

def leglen(h, k, a): return (k - h).length + (a - k).length
k_body = (leglen(J['UpperLeg.L'], J['LowerLeg.L'], J['Foot.L']) + leglen(J['UpperLeg.R'], J['LowerLeg.R'], J['Foot.R'])) / (
    leglen(po['UpperLeg.L'], po['LowerLeg.L'], po['Foot.L']) + leglen(po['UpperLeg.R'], po['LowerLeg.R'], po['Foot.R']))
bi = idx['Body']; bp = parent[bi]
dropv = bindworld(bp).inverted().to_3x3() @ Vector((0, -DROP, 0))
tnew[bi] = list(Vector(torig[bi]) * k_body + dropv); newnodes[bi]['translation'] = tnew[bi]  # Body keeps the clip's crouch, scaled to the longer legs
print('body translation scale', k_body)

o = Out()
attrs = {'POSITION': o.acc(Pl, 'VEC3', target=34962, minmax=True), 'NORMAL': o.acc(Nl, 'VEC3', target=34962),
         'TEXCOORD_0': o.acc(UV, 'VEC2', target=34962), 'JOINTS_0': o.acc(JI, 'VEC4', 5121, target=34962),
         'WEIGHTS_0': o.acc(JW, 'VEC4', target=34962)}
ind = o.acc(IDX.reshape(-1, 1), 'SCALAR', 5125 if IDX.max() > 65535 else 5123, target=34963)
ibm = o.acc(IBM, 'MAT4')
imv = o.view(IMG)

import os
GROUND = json.load(open(ARGS[2])) if len(ARGS) > 2 and os.path.exists(ARGS[2]) else {}
Rp = bindworld(bp).inverted().to_3x3()
def lift(dy):
    return np.array(Rp @ Vector((0, dy, 0)))
anims = []
for a in oj['animations']:
    gd = GROUND.get(a['name'])
    has_body_t = any(c['target']['node'] == bi and c['target']['path'] == 'translation' for c in a['channels'])
    samplers, channels = [], []
    for c in a['channels']:
        sm = a['samplers'][c['sampler']]
        inp = acc(oj, ob, sm['input']); out = acc(oj, ob, sm['output']).astype(np.float64)
        ti = c['target']['node']; path = c['target']['path']
        if path == 'translation' and ti in tnew:
            if name[ti] == 'Body':
                out = out * k_body + np.array(dropv)
                if gd:
                    assert len(gd['delta']) == len(out), (a['name'], len(gd['delta']), len(out))
                    out = out + np.array([lift(d) for d in gd['delta']])
            elif name[ti] in ('Root', 'Hips'):
                out = np.array(tnew[ti]) + (out - np.array(torig[ti])) * k_body
            else:
                out = np.tile(np.array(tnew[ti]), (len(out), 1))
        si = len(samplers)
        samplers.append({'input': o.acc(inp, 'SCALAR', minmax=True), 'output': o.acc(out, sm.get('type') or {'translation': 'VEC3', 'scale': 'VEC3', 'rotation': 'VEC4'}[path] if False else {'translation': 'VEC3', 'scale': 'VEC3', 'rotation': 'VEC4', 'weights': 'SCALAR'}[path]),
                         'interpolation': sm.get('interpolation', 'LINEAR')})
        channels.append({'sampler': si, 'target': c['target']})
    if gd and not has_body_t:
        out = np.array([np.array(tnew[bi]) + lift(d) for d in gd['delta']])
        samplers.append({'input': o.acc(np.array(gd['times']).reshape(-1, 1), 'SCALAR', minmax=True), 'output': o.acc(out, 'VEC3'), 'interpolation': 'LINEAR'})
        channels.append({'sampler': len(samplers) - 1, 'target': {'node': bi, 'path': 'translation'}})
        print('added Body translation to', a['name'])
    anims.append({'name': a['name'], 'samplers': samplers, 'channels': channels})

g = {
    'asset': {'version': '2.0', 'generator': 'Last Rites rig.py (TRELLIS mesh on the game zombie skeleton)'},
    'scene': oj.get('scene', 0), 'scenes': oj['scenes'], 'nodes': newnodes,
    'meshes': [{'name': 'Zombie', 'primitives': [{'attributes': attrs, 'indices': ind, 'material': 0}]}],
    'skins': [{'joints': joints, 'inverseBindMatrices': ibm, **({'skeleton': skin['skeleton']} if 'skeleton' in skin else {})}],
    'materials': [{'name': 'ZombieSkin', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0.0, 'roughnessFactor': 0.85}}],
    'textures': [{'source': 0, 'sampler': 0}],
    'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}],
    'images': [{'bufferView': imv, 'mimeType': img['mimeType'], 'name': 'zombie_base'}],
    'animations': anims,
    'accessors': o.accs, 'bufferViews': o.views, 'buffers': [{'byteLength': len(o.bin)}],
}
js = json.dumps(g, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
while len(o.bin) % 4: o.bin.append(0)
total = 12 + 8 + len(js) + 8 + len(o.bin)
with open(OUT, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, total))
    f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
    f.write(struct.pack('<II', len(o.bin), 0x004E4942)); f.write(o.bin)
print('wrote', OUT, total)
