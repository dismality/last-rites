# Low-poly copy of the TRELLIS zombie with its colour baked onto new UVs.
import bpy, math
from mathutils import Vector
SRC = "C:/David/tripo/zombie-trellis-raw.glb"
OUT = "C:/David/tripo/work/"
HEIGHT = 1.78
TRIS = 12000
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
hi = [o for o in bpy.data.objects if o.type == 'MESH'][0]
bpy.context.view_layer.objects.active = hi; hi.select_set(True)
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
zs = [v.co.z for v in hi.data.vertices]; zmin = min(zs); s = HEIGHT / (max(zs) - zmin)
xs = [v.co.x for v in hi.data.vertices if 0.75 * HEIGHT / s + zmin > v.co.z > 0.45 / s + zmin]
for v in hi.data.vertices:
    v.co = (v.co - Vector((0, 0, zmin))) * s
hi.data.update()
lo = hi.copy(); lo.data = hi.data.copy(); bpy.context.collection.objects.link(lo); lo.name = 'Zombie'
bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active = lo; lo.select_set(True)
m = lo.modifiers.new('d', 'DECIMATE'); m.ratio = TRIS / len(lo.data.polygons); m.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier='d')
print('after decimate', len(lo.data.polygons), len(lo.data.vertices))
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=0.0006)
bpy.ops.object.mode_set(mode='OBJECT')
while lo.data.uv_layers: lo.data.uv_layers.remove(lo.data.uv_layers[0])
lo.data.validate()
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.quads_convert_to_tris()
bpy.ops.mesh.delete_loose()
lo.data.uv_layers.new(name='UV')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.004)
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.shade_smooth()
print('low tris', len(lo.data.polygons), 'verts', len(lo.data.vertices))
# bake target material
img = bpy.data.images.new('zombie_base', 1024, 1024)
mat = bpy.data.materials.new('ZombieSkin'); mat.use_nodes = True
nt = mat.node_tree; tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img
bsdf = nt.nodes['Principled BSDF']
bsdf.inputs['Roughness'].default_value = 0.85; bsdf.inputs['Metallic'].default_value = 0.0
lo.data.materials.clear(); lo.data.materials.append(mat)
nt.nodes.active = tex
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 4; sc.cycles.device = 'CPU'
sc.render.bake.use_pass_direct = False; sc.render.bake.use_pass_indirect = False; sc.render.bake.use_pass_color = True
sc.render.bake.use_selected_to_active = True; sc.render.bake.cage_extrusion = 0.03; sc.render.bake.max_ray_distance = 0.09
sc.render.bake.margin = 6
bpy.ops.object.select_all(action='DESELECT'); hi.select_set(True); lo.select_set(True); bpy.context.view_layer.objects.active = lo
for mm in hi.data.materials:
    b = mm.node_tree.nodes.get('Principled BSDF')
    for inp in ('Metallic',):
        for l in list(b.inputs[inp].links): mm.node_tree.links.remove(l)
        b.inputs[inp].default_value = 0.0
    src = b.inputs['Base Color'].links[0].from_socket if b.inputs['Base Color'].links else None
    print('base color from', src.node.type if src else None, src.node.image.name if src and src.node.type=='TEX_IMAGE' else '')
    em = mm.node_tree.nodes.new('ShaderNodeEmission'); mm.node_tree.links.new(src, em.inputs['Color'])
    out = mm.node_tree.nodes['Material Output']; mm.node_tree.links.new(em.outputs[0], out.inputs['Surface'])
print('hi mats', [m.name for m in hi.data.materials], [(i.name, i.size[:], i.has_data) for i in bpy.data.images])
print('hi polys', len(hi.data.polygons), 'hi bounds', [round(min(v.co[i] for v in hi.data.vertices),3) for i in range(3)], [round(max(v.co[i] for v in hi.data.vertices),3) for i in range(3)], 'lo bounds', [round(min(v.co[i] for v in lo.data.vertices),3) for i in range(3)], 'matrix', hi.matrix_world.to_translation(), lo.matrix_world.to_translation())
print('sel', [o.name for o in bpy.context.selected_objects], 'active', bpy.context.view_layer.objects.active.name, 'hidden', hi.hide_render, hi.hide_get())
bpy.ops.object.bake(type='EMIT')
import numpy as np
print('baked max', np.array(img.pixels[:]).reshape(-1,4).max(0))
nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
img.filepath_raw = OUT + 'zombie_base.png'; img.file_format = 'PNG'; img.save()
bpy.data.objects.remove(hi)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT + 'zombie_static.glb', export_format='GLB', use_selection=True,
    export_image_format='JPEG', export_jpeg_quality=88, export_materials='EXPORT', export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=OUT + 'zombie_static.blend')
print('done')
