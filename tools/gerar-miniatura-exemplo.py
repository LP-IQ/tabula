#!/usr/bin/env python3
"""Gera public/modelos/miniatura-exemplo.glb: um aventureiro simples feito de blocos, com animação
"idle" (respirando) e "walk" (andando). Serve para experimentar a Vista 3D sem procurar um modelo.

Uso: python3 tools/gerar-miniatura-exemplo.py public/modelos/miniatura-exemplo.glb
"""
import json
import math
import struct
import sys


def box(w, h, d):
    """caixa centrada na origem: posições, normais e índices"""
    x, y, z = w / 2, h / 2, d / 2
    faces = [
        ((1, 0, 0), [(x, -y, -z), (x, y, -z), (x, y, z), (x, -y, z)]),
        ((-1, 0, 0), [(-x, -y, z), (-x, y, z), (-x, y, -z), (-x, -y, -z)]),
        ((0, 1, 0), [(-x, y, -z), (-x, y, z), (x, y, z), (x, y, -z)]),
        ((0, -1, 0), [(-x, -y, z), (-x, -y, -z), (x, -y, -z), (x, -y, z)]),
        ((0, 0, 1), [(-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z)]),
        ((0, 0, -1), [(x, -y, -z), (-x, -y, -z), (-x, y, -z), (x, y, -z)]),
    ]
    pos, nor, idx = [], [], []
    for n, vs in faces:
        b = len(pos)
        pos += vs
        nor += [n] * 4
        idx += [b, b + 1, b + 2, b, b + 2, b + 3]
    return pos, nor, idx


class Glb:
    def __init__(self):
        self.bin = bytearray()
        self.views, self.accessors, self.meshes, self.materials, self.nodes = [], [], [], [], []
        self.animations = []

    def _view(self, data, target=None):
        while len(self.bin) % 4:
            self.bin.append(0)
        off = len(self.bin)
        self.bin += data
        v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
        if target:
            v['target'] = target
        self.views.append(v)
        return len(self.views) - 1

    def accessor(self, values, kind, comp=5126, target=None, minmax=False):
        n = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[kind]
        flat = [c for v in values for c in (v if isinstance(v, (tuple, list)) else (v,))]
        fmt = {5126: 'f', 5123: 'H'}[comp]
        data = struct.pack('<%d%s' % (len(flat), fmt), *flat)
        a = {'bufferView': self._view(data, target), 'componentType': comp, 'count': len(values), 'type': kind}
        if minmax:
            cols = [flat[i::n] for i in range(n)]
            a['min'] = [min(c) for c in cols]
            a['max'] = [max(c) for c in cols]
        self.accessors.append(a)
        return len(self.accessors) - 1

    def material(self, rgb, metal=0.0, rough=0.8):
        self.materials.append({'pbrMetallicRoughness': {'baseColorFactor': [*rgb, 1], 'metallicFactor': metal, 'roughnessFactor': rough}})
        return len(self.materials) - 1

    def box_mesh(self, w, h, d, mat):
        p, n, i = box(w, h, d)
        prim = {
            'attributes': {'POSITION': self.accessor(p, 'VEC3', target=34962, minmax=True),
                           'NORMAL': self.accessor(n, 'VEC3', target=34962)},
            'indices': self.accessor(i, 'SCALAR', 5123, target=34963), 'material': mat,
        }
        self.meshes.append({'primitives': [prim]})
        return len(self.meshes) - 1

    def node(self, name, mesh=None, t=(0, 0, 0), children=None, r=None):
        nd = {'name': name, 'translation': list(t)}
        if mesh is not None:
            nd['mesh'] = mesh
        if children:
            nd['children'] = children
        if r:
            nd['rotation'] = list(r)
        self.nodes.append(nd)
        return len(self.nodes) - 1

    def write(self, path, root):
        gltf = {
            'asset': {'version': '2.0', 'generator': 'Tábula'},
            'scene': 0, 'scenes': [{'nodes': [root]}], 'nodes': self.nodes, 'meshes': self.meshes,
            'materials': self.materials, 'accessors': self.accessors, 'bufferViews': self.views,
            'buffers': [{'byteLength': len(self.bin)}], 'animations': self.animations,
        }
        js = json.dumps(gltf, separators=(',', ':')).encode()
        js += b' ' * ((4 - len(js) % 4) % 4)
        while len(self.bin) % 4:
            self.bin.append(0)
        total = 12 + 8 + len(js) + 8 + len(self.bin)
        with open(path, 'wb') as fh:
            fh.write(struct.pack('<III', 0x46546C67, 2, total))
            fh.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
            fh.write(struct.pack('<II', len(self.bin), 0x004E4942) + self.bin)


def qx(a):
    return (math.sin(a / 2), 0, 0, math.cos(a / 2))


def main(out):
    g = Glb()
    steel = g.material((0.62, 0.64, 0.7), 0.85, 0.35)
    cloth = g.material((0.55, 0.12, 0.12), 0.0, 0.85)
    skin = g.material((0.86, 0.66, 0.52))
    leather = g.material((0.33, 0.21, 0.12), 0.0, 0.9)
    gold = g.material((0.85, 0.66, 0.2), 1.0, 0.3)
    wood = g.material((0.45, 0.3, 0.16), 0.0, 0.8)

    leg_l = g.node('perna_esq', g.box_mesh(0.16, 0.5, 0.18, leather), (-0.11, -0.25, 0))
    hip_l = g.node('quadril_esq', None, (0, 0.55, 0), [leg_l])
    g.nodes[hip_l]['translation'] = [0, 0.55, 0]
    leg_r = g.node('perna_dir', g.box_mesh(0.16, 0.5, 0.18, leather), (0.11, -0.25, 0))
    hip_r = g.node('quadril_dir', None, (0, 0.55, 0), [leg_r])
    torso = g.node('tronco', g.box_mesh(0.44, 0.5, 0.26, steel), (0, 0.25, 0))
    tabard = g.node('tabardo', g.box_mesh(0.3, 0.42, 0.02, cloth), (0, 0.2, 0.14))
    head = g.node('cabeca', g.box_mesh(0.24, 0.24, 0.24, skin), (0, 0.66, 0))
    helm = g.node('elmo', g.box_mesh(0.28, 0.14, 0.28, steel), (0, 0.79, 0))
    plume = g.node('pluma', g.box_mesh(0.05, 0.16, 0.2, cloth), (0, 0.92, -0.02))
    arm_l = g.node('braco_esq', g.box_mesh(0.12, 0.42, 0.14, steel), (-0.3, 0.27, 0))
    shield = g.node('escudo', g.box_mesh(0.05, 0.42, 0.34, wood), (-0.4, 0.22, 0.05))
    boss = g.node('umbo', g.box_mesh(0.03, 0.12, 0.12, gold), (-0.43, 0.24, 0.05))
    arm_r = g.node('braco_dir', g.box_mesh(0.12, 0.42, 0.14, steel), (0.3, 0.27, 0))
    sword = g.node('espada', g.box_mesh(0.04, 0.7, 0.07, steel), (0.32, 0.38, 0.22), r=qx(math.radians(70)))
    guard = g.node('guarda', g.box_mesh(0.2, 0.04, 0.05, gold), (0.32, 0.1, 0.1))
    body = g.node('corpo', None, (0, 0.55, 0), [torso, tabard, head, helm, plume, arm_l, shield, boss, arm_r, sword, guard])
    root = g.node('aventureiro', None, (0, 0, 0), [hip_l, hip_r, body])

    def anim(name, chans):
        samplers, channels = [], []
        for node, path, times, vals in chans:
            inp = g.accessor(times, 'SCALAR', minmax=True)
            out = g.accessor(vals, 'VEC4' if path == 'rotation' else 'VEC3')
            samplers.append({'input': inp, 'output': out, 'interpolation': 'LINEAR'})
            channels.append({'sampler': len(samplers) - 1, 'target': {'node': node, 'path': path}})
        g.animations.append({'name': name, 'samplers': samplers, 'channels': channels})

    ts = [i / 12 * 2.4 for i in range(13)]
    anim('idle', [(body, 'translation', ts, [(0, 0.55 + 0.018 * math.sin(t / 2.4 * 2 * math.pi), 0) for t in ts])])
    tw = [i / 12 * 0.8 for i in range(13)]
    sw = lambda t, ph: 0.6 * math.sin(t / 0.8 * 2 * math.pi + ph)
    anim('walk', [
        (hip_l, 'rotation', tw, [qx(sw(t, 0)) for t in tw]),
        (hip_r, 'rotation', tw, [qx(sw(t, math.pi)) for t in tw]),
        (body, 'translation', tw, [(0, 0.55 + 0.03 * abs(math.sin(t / 0.8 * 2 * math.pi)), 0) for t in tw]),
    ])
    g.write(out, root)
    print('ok', out)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'miniatura-exemplo.glb')
