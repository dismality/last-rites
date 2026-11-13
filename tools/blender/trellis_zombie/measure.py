# For each clip, the lowest point of the new and old zombie at the Body keyframe times.
import bpy, sys, json, numpy as np
sys.path.insert(0, 'C:/David/tripo/work')
NEW, ORIG, OUTJ = sys.argv[sys.argv.index('--')+1:][:3]
import importlib.util
spec = importlib.util.spec_from_file_location('rigio', 'C:/David/tripo/work/rigio.py'); rigio = importlib.util.module_from_spec(spec); spec.loader.exec_module(rigio)
j, b = rigio.read_glb(NEW)
times = {}
bodyi = [i for i, n in enumerate(j['nodes']) if n.get('name') == 'Body'][0]
for a in j['animations']:
    t = None
    for c in a['channels']:
        if c['target']['node'] == bodyi and c['target']['path'] == 'translation':
            t = rigio.acc(j, b, a['samplers'][c['sampler']]['input']).reshape(-1)
    if t is None:
        t = np.unique(np.concatenate([rigio.acc(j, b, a['samplers'][c['sampler']]['input']).reshape(-1) for c in a['channels']]))
    times[a['name']] = [float(x) for x in t]
def lows(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path, guess_original_bind_pose=False)
    arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]; me = bpy.data.objects['Zombie']
    sc = bpy.context.scene; fps = sc.render.fps / sc.render.fps_base
    res = {}
    for an, ts in times.items():
        act = bpy.data.actions[an]; arm.animation_data.action = None
        for pb in arm.pose.bones: pb.location=(0,0,0); pb.rotation_quaternion=(1,0,0,0); pb.scale=(1,1,1)
        arm.animation_data.action = act
        if len(act.slots): arm.animation_data.action_slot = act.slots[0]
        r = []
        for t in ts:
            f = t * fps; sc.frame_set(int(f), subframe=f - int(f))
            dg = bpy.context.evaluated_depsgraph_get(); m = me.evaluated_get(dg).to_mesh()
            co = np.empty(len(m.vertices) * 3); m.vertices.foreach_get('co', co)
            co = co.reshape(-1, 3) @ np.array(me.matrix_world.to_3x3()).T + np.array(me.matrix_world.translation)
            r.append(float(co[:, 2].min()))
        res[an] = r
    return res
ln = lows(NEW); lo = lows(ORIG)
out = {an: {'times': times[an], 'delta': [o - n for o, n in zip(lo[an], ln[an])]} for an in times}
print('IDLE new', [round(x,3) for x in ln['Idle']][:6], 'orig', [round(x,3) for x in lo['Idle']][:6], 'times', times['Idle'][:6]); print([ (a.name, tuple(a.frame_range)) for a in bpy.data.actions][:3])
for an in out: print(an, 'delta min/max', round(min(out[an]['delta']), 3), round(max(out[an]['delta']), 3))
json.dump(out, open(OUTJ, 'w'))
