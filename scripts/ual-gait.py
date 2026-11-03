# Шаг и бег героя по живым клипам Quaternius Universal Animation Library (CC0, quaternius.com; копия набора —
# github.com/tilakpatell/tilakverse-assets, см. docs/assets-catalog.md). Из клипа берутся по кадрам: таз (смещение и
# поворот), корпус относительно таза, голова относительно корпуса, лодыжки и повороты стоп — в осях героя (вперёд +Z,
# вверх +Y, левая сторона +X), длины — в долях длины ноги (бедро → колено → лодыжка в покое). По ним
# src/hero-animations.js (gait) запекает клипы шага и бега на скелет героя, руки с оружием — свои.
#
#   curl -sSfLo UAL1.glb https://raw.githubusercontent.com/tilakpatell/tilakverse-assets/3fc5b474cacffc5b3958aca4f8a652d3d9f75524/quaternius/universal-animation-library/Unreal-Godot/UAL1.glb
#   (UAL2.glb — та же ссылка с b88b0c642f0f04c031f20b4304ff95878f79528e/…/universal-animation-library-2/Unreal-Godot/UAL2.glb)
#   python3 scripts/ual-gait.py UAL1.glb Walk_Loop Jog_Fwd_Loop … UAL2.glb Walk_Fwd_Loop … > src/gait-ual.js
#
# Нужен numpy.
import json, struct, sys
import numpy as np

def process(f, clips):
    b = open(f, 'rb').read()
    n = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20+n])
    bin0 = 20 + n + 8
    nodes = j['nodes']
    names = [nd['name'] for nd in nodes]
    parent = {}
    for i, nd in enumerate(nodes):
        for c in nd.get('children', []):
            parent[c] = i

    def acc(i):
        a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]
        comp = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
        off = bin0 + bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        assert bv.get('byteStride', 4 * comp) == 4 * comp
        return np.frombuffer(b, dtype=np.float32, count=a['count'] * comp, offset=off).reshape(a['count'], comp).astype(np.float64)

    def qmul(a, b):
        x1, y1, z1, w1 = a; x2, y2, z2, w2 = b
        return np.array([w1*x2 + x1*w2 + y1*z2 - z1*y2, w1*y2 - x1*z2 + y1*w2 + z1*x2, w1*z2 + x1*y2 - y1*x2 + z1*w2, w1*w2 - x1*x2 - y1*y2 - z1*z2])
    def qinv(q): return np.array([-q[0], -q[1], -q[2], q[3]])
    def qrot(q, v):
        u = q[:3]; w = q[3]
        return v + 2 * np.cross(u, np.cross(u, v) + w * v)
    def qmat(q):
        return np.array([qrot(q, np.array(e, float)) for e in ([1, 0, 0], [0, 1, 0], [0, 0, 1])]).T
    def mat_q(m):
        t = np.trace(m)
        if t > 0:
            s = np.sqrt(t + 1) * 2; return np.array([(m[2,1]-m[1,2])/s, (m[0,2]-m[2,0])/s, (m[1,0]-m[0,1])/s, s/4])
        i = np.argmax(np.diag(m))
        if i == 0:
            s = np.sqrt(1 + m[0,0] - m[1,1] - m[2,2]) * 2; return np.array([s/4, (m[0,1]+m[1,0])/s, (m[0,2]+m[2,0])/s, (m[2,1]-m[1,2])/s])
        if i == 1:
            s = np.sqrt(1 + m[1,1] - m[0,0] - m[2,2]) * 2; return np.array([(m[0,1]+m[1,0])/s, s/4, (m[1,2]+m[2,1])/s, (m[0,2]-m[2,0])/s])
        s = np.sqrt(1 + m[2,2] - m[0,0] - m[1,1]) * 2; return np.array([(m[0,2]+m[2,0])/s, (m[1,2]+m[2,1])/s, s/4, (m[1,0]-m[0,1])/s])
    def euler_yxz(q):
        # как THREE.Euler(order 'YXZ').setFromQuaternion — градусы [x, y, z]
        m = qmat(q / np.linalg.norm(q))
        x = np.arcsin(-np.clip(m[1, 2], -1, 1))
        if abs(m[1, 2]) < 0.9999999:
            y = np.arctan2(m[0, 2], m[2, 2]); z = np.arctan2(m[1, 0], m[1, 1])
        else:
            y = np.arctan2(-m[2, 0], m[0, 0]); z = 0
        return [round(float(np.degrees(v)), 2) for v in (x, y, z)]

    def rest_local(i):
        nd = nodes[i]
        return np.array(nd.get('translation', [0, 0, 0]), float), np.array(nd.get('rotation', [0, 0, 0, 1]), float)

    def world(local):
        out = {}
        def w(i):
            if i in out: return out[i]
            t, q = local[i]
            if i in parent:
                pt, pq = w(parent[i]); out[i] = (pt + qrot(pq, t), qmul(pq, q))
            else:
                out[i] = (t, q)
            return out[i]
        for i in range(len(nodes)): w(i)
        return out

    idx = {nm: i for i, nm in enumerate(names)}
    rest = world({i: rest_local(i) for i in range(len(nodes))})

    # оси персонажа в покое: вверх — от лодыжек к тазу, влево — от правого бедра к левому, вперёд — up × left... (вперёд = left × up)
    P = lambda W, nm: W[idx[nm]][0]
    up = P(rest, 'pelvis') - (P(rest, 'foot_l') + P(rest, 'foot_r')) / 2; up /= np.linalg.norm(up)
    left = P(rest, 'thigh_l') - P(rest, 'thigh_r'); left -= up * left.dot(up); left /= np.linalg.norm(left)
    fwd = np.cross(left, up)
    toe = P(rest, 'ball_l') - P(rest, 'foot_l')
    assert toe.dot(fwd) > 0, 'носок не вперёд'
    A = np.array([left, up, fwd])        # строки: мировые оси → оси героя (X=влево, Y=вверх, Z=вперёд)
    qA = mat_q(A)
    leg = np.linalg.norm(P(rest, 'thigh_l') - P(rest, 'calf_l')) + np.linalg.norm(P(rest, 'calf_l') - P(rest, 'foot_l'))
    hip_h = (A @ P(rest, 'pelvis'))[1] - (A @ ((P(rest, 'foot_l') + P(rest, 'foot_r')) / 2))[1]
    print('нога', round(leg, 4), 'таз над лодыжками', round(hip_h, 4), file=sys.stderr)

    def aligned(W, nm):
        t, q = W[idx[nm]]
        return A @ t, qmul(qA, q)

    def delta(W, nm):
        _, q = aligned(W, nm); _, q0 = aligned(rest, nm)
        return qmul(q, qinv(q0))

    out = {'clips': {}}
    for clip in clips:
        an = next(a for a in j['animations'] if a['name'] == clip)
        ch = {}
        for c in an['channels']:
            s = an['samplers'][c['sampler']]
            ch[(c['target']['node'], c['target']['path'])] = (acc(s['input'])[:, 0], acc(s['output']))
        times = next(iter(ch.values()))[0]
        frames = []
        p0 = aligned(rest, 'pelvis')[0]
        f0 = {s: aligned(rest, 'foot_' + s.lower())[0] for s in 'LR'}
        for k in range(len(times)):
            loc = {}
            for i in range(len(nodes)):
                t, q = rest_local(i)
                if (i, 'translation') in ch: t = ch[(i, 'translation')][1][k]
                if (i, 'rotation') in ch: q = ch[(i, 'rotation')][1][k]
                loc[i] = (t, q)
            W = world(loc)
            dp, ds, dh = delta(W, 'pelvis'), delta(W, 'spine_03'), delta(W, 'Head')
            hp = (aligned(W, 'pelvis')[0] - p0) / leg
            fr = {'hips': [round(float(v), 4) for v in hp], 'pelvis': euler_yxz(dp),
                  'torso': euler_yxz(qmul(qinv(dp), ds)), 'look': euler_yxz(qmul(qinv(ds), dh)), 'feet': {}}
            for s in 'LR':
                fp = (aligned(W, 'foot_' + s.lower())[0] - f0[s]) / leg
                fr['feet'][s] = {'pos': [round(float(v), 4) for v in fp], 'rot': euler_yxz(delta(W, 'foot_' + s.lower())),
                                 'toe': euler_yxz(qmul(qinv(delta(W, 'foot_' + s.lower())), delta(W, 'ball_' + s.lower())))[0]}
            frames.append(fr)
        # скорость и направление хода: стопа на земле едет под телом назад относительно хода — тело идёт в обратную
        # сторону (вектор в плоскости XZ осей героя); фаза постановки левой стопы — для выравнивания клипов набора
        dur = float(times[-1]); dt = dur / (len(times) - 1)
        vs = []
        for s in 'LR':
            ys = np.array([fr['feet'][s]['pos'][1] for fr in frames])
            xz = np.array([[fr['feet'][s]['pos'][0], fr['feet'][s]['pos'][2]] for fr in frames])
            low = ys < ys.min() + 0.03
            for k in range(len(frames) - 1):
                if low[k] and low[k + 1]:
                    vs.append(-(xz[k + 1] - xz[k]) / dt)
        v = np.median(np.array(vs), axis=0) if vs else np.zeros(2)
        speed = float(np.linalg.norm(v))
        yl = np.array([fr['feet']['L']['pos'][1] for fr in frames[:-1]])
        lowl = yl < yl.min() + 0.03
        n = len(yl)
        strike = next((k for k in range(n) if lowl[k] and not lowl[k - 1]), 0)
        out['clips'][clip] = {'d': round(dur, 4), 'speed': round(speed, 4), 'dir': [round(float(v[0] / max(speed, 1e-6)), 4), round(float(v[1] / max(speed, 1e-6)), 4)],
                              'strike': round(strike / n, 4), 'frames': frames[:-1]}
        print(clip, 'длит', round(dur, 3), 'скорость (ног/с)', round(speed, 3), 'направление', np.round(v / max(speed, 1e-6), 2), 'постановка L', round(strike / n, 3), file=sys.stderr)
    return out['clips']

# аргументы: файл .glb, его клипы, следующий файл .glb, его клипы…
groups = []
for a in sys.argv[1:]:
    if a.endswith('.glb'):
        groups.append((a, []))
    else:
        groups[-1][1].append(a)
clips = {}
for f, names in groups:
    clips.update(process(f, names))
print('// Создано scripts/ual-gait.py из клипов %s — не править руками.' % ', '.join(clips))
print('// Источник: Quaternius Universal Animation Library (CC0). Кадры 30 к/с, длины — в долях длины ноги.')
print('export const UAL_GAIT = ' + json.dumps(clips, separators=(',', ':'), ensure_ascii=False) + ';')
