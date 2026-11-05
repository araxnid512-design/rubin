#!/usr/bin/env python3
"""Конвейер Tripo AI → GLB-модели «Линии снабжения» с жёстким лимитом кредитов.

Для каждого объекта из каталога (frontline/spec/docs/TRIPO_ASSET_CATALOG.md) берётся отдельная картинка
frontline/spec/references/tripo/models/<id>.jpg и делается:
  1) Image to 3D (текстура, ограничение полигонов для телефона);
  2) для людей — скелет (biped, имена костей Mixamo) и анимации idle/walk/run/shoot/fall;
  3) скачивание GLB в frontline/assets/models/<id>.glb и запись в frontline/assets/manifest.json —
     игра сама подхватит модели вместо процедурных.

Ключ берётся только из переменной окружения TRIPO_API_KEY (в чат и в репозиторий не попадает).
Нужен доступ к openapi.tripo3d.ai и к серверу, с которого Tripo отдаёт файлы моделей.

Бюджет: --budget (по умолчанию 3000). Перед каждой задачей проверяется, что оценка её стоимости помещается
в остаток; после задачи учитывается фактический расход (credits_consumed или разница баланса).
Состояние пишется в frontline/assets/tripo_state.json — повторный запуск продолжает с места остановки
и не тратит кредиты на уже готовые модели.

Примеры:
  python3 tools/tripo_pipeline.py --dry-run                 # план и оценка без сети
  TRIPO_API_KEY=... python3 tools/tripo_pipeline.py         # всё по приоритету в пределах 3000
  TRIPO_API_KEY=... python3 tools/tripo_pipeline.py --only military_bunker,npc_infantry
"""
import argparse, json, mimetypes, os, sys, time, uuid, urllib.request, urllib.error, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(ROOT, 'frontline', 'spec', 'references', 'tripo', 'models')
OUT = os.path.join(ROOT, 'frontline', 'assets')
API = 'https://openapi.tripo3d.ai'
ANIMS = ['preset:idle', 'preset:walk', 'preset:run', 'preset:shoot', 'preset:fall']

BUILDINGS = ['military_barracks', 'military_headquarters', 'military_bunker', 'weapon_bench', 'ammo_bench', 'vehicle_light_garage',
             'weapon_workshop', 'ammo_workshop', 'vehicle_truck_workshop', 'weapon_factory', 'ammo_factory', 'vehicle_armor_factory',
             'enemy_military_barracks', 'enemy_military_headquarters', 'enemy_military_bunker']
CHARACTERS = ['avatar_player', 'npc_scrap_worker', 'npc_mechanic', 'npc_infantry', 'enemy_npc_scrap_worker', 'enemy_npc_mechanic', 'enemy_npc_infantry']
VEHICLES = ['veh_utility_car', 'veh_light_car', 'veh_motorcycle', 'veh_cargo_truck', 'veh_scrap_harvester', 'veh_fuel_tanker', 'veh_armored_scout', 'veh_light_tank', 'veh_apc']
WEAPONS = ['wp_rifle_v7', 'wp_assault_a47', 'wp_assault_a56', 'wp_assault_a39', 'wp_smg_pp9', 'wp_pistol_p9', 'wp_lmg_r7', 'wp_launcher_g40', 'wp_hand_grenade']
SMALL = ['scrap_metal', 'tool_hammer', 'tool_wrench']
EXTRA = ['avatar_friendly_soldier', 'avatar_enemy_soldier']
AMMO = ['ammo_9x19', 'ammo_762x54', 'ammo_545x39', 'ammo_556x45', 'ammo_762x39', 'ammo_762x54_belt', 'ammo_40mm_he', 'ammo_40mm_smoke', 'ammo_37mm_tank']

# id в манифесте: персонажи — по ролям игры (avatar_player → игрок; npc_* → наши; enemy_npc_* → враг)
MANIFEST_ID = {'enemy_npc_scrap_worker': 'enemy_npc_scrap_worker', 'enemy_npc_mechanic': 'enemy_npc_mechanic', 'enemy_npc_infantry': 'enemy_npc_infantry'}
FACES = {'building': 15000, 'character': 12000, 'vehicle': 10000, 'weapon': 4000, 'small': 3000, 'ammo': 1500}


def kind_of(i):
    if i in BUILDINGS: return 'building'
    if i in CHARACTERS or i in EXTRA: return 'character'
    if i in VEHICLES: return 'vehicle'
    if i in WEAPONS: return 'weapon'
    if i in AMMO: return 'ammo'
    return 'small'


class Tripo:
    def __init__(self, key):
        self.key = key

    def _req(self, method, path, body=None, headers=None, raw=False, tries=5):
        url = path if path.startswith('http') else API + path
        h = {'Authorization': 'Bearer ' + self.key, 'Accept': 'application/json', 'User-Agent': 'rubin-frontline-pipeline/1.0', 'X-Tripo-Trace-ID': str(uuid.uuid4())}
        if headers: h.update(headers)
        data = body
        if isinstance(body, (dict, list)): data = json.dumps(body).encode(); h['Content-Type'] = 'application/json'
        for k in range(tries):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=h, method=method), timeout=120) as r:
                    b = r.read()
                    if raw: return b
                    p = json.loads(b.decode() or '{}')
                    if isinstance(p, dict) and p.get('code') not in (None, 0): raise RuntimeError(f"Tripo {p.get('code')}: {p.get('message')} {p.get('suggestion') or ''}")
                    return p.get('data', p) if isinstance(p, dict) else p
            except urllib.error.HTTPError as e:
                text = e.read().decode(errors='replace')[:400]
                if e.code in (429, 500, 502, 503, 504) and k < tries - 1: time.sleep(2 ** k * 2); continue
                raise RuntimeError(f'HTTP {e.code} {path}: {text}')
            except urllib.error.URLError as e:
                if k < tries - 1: time.sleep(2 ** k * 2); continue
                raise RuntimeError(f'Сеть недоступна ({path}): {e.reason}. Разрешите домены Tripo в настройках среды.')

    def balance(self):
        d = self._req('GET', '/v3/account/balance'); return float(d.get('balance') or 0), float(d.get('frozen') or 0)

    def upload(self, path):
        boundary = '----rubin' + uuid.uuid4().hex
        ctype = mimetypes.guess_type(path)[0] or 'image/jpeg'
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{os.path.basename(path)}"\r\nContent-Type: {ctype}\r\n\r\n').encode() + open(path, 'rb').read() + f'\r\n--{boundary}--\r\n'.encode()
        d = self._req('POST', '/v3/files', body, {'Content-Type': f'multipart/form-data; boundary={boundary}'})
        tok = d.get('file_token') if isinstance(d, dict) else None
        if not tok: raise RuntimeError(f'Загрузка без file_token: {d}')
        return tok

    def submit(self, path, payload):
        d = self._req('POST', path, payload); tid = d.get('task_id') if isinstance(d, dict) else None
        if not tid: raise RuntimeError(f'Задача не создана ({path}): {d}')
        return tid

    def wait(self, tid, timeout=1800):
        t0, iv = time.time(), 3
        while True:
            d = self._req('GET', f'/v3/tasks/{tid}')
            st = str(d.get('status', '')).lower()
            if st in ('success', 'failed', 'cancelled', 'banned', 'expired'): return d
            if time.time() - t0 > timeout: raise RuntimeError(f'Задача {tid} не завершилась за {timeout} с')
            print(f'    … {tid}: {st} {d.get("progress", 0)}%', flush=True); time.sleep(iv); iv = min(iv * 1.5, 20)

    def model_url(self, d):
        o = d.get('output') or {}
        for k in ('model_url', 'pbr_model_url', 'model', 'pbr_model', 'base_model'):
            if o.get(k): return o[k]
        raise RuntimeError(f'В результате нет модели: {list(o.keys())}')

    def download(self, url, dest):
        req = urllib.request.Request(url, headers={'User-Agent': 'rubin-frontline-pipeline/1.0'})
        with urllib.request.urlopen(req, timeout=300) as r, open(dest + '.part', 'wb') as f:
            while True:
                b = r.read(1 << 16)
                if not b: break
                f.write(b)
        os.replace(dest + '.part', dest)


def load_json(p, default):
    try: return json.load(open(p, encoding='utf-8'))
    except Exception: return default


def save_json(p, d):
    tmp = p + '.tmp'; json.dump(d, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False, indent=2); os.replace(tmp, p)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--budget', type=float, default=3000, help='общий лимит кредитов с учётом прошлых запусков (по умолчанию 3000)')
    ap.add_argument('--only', default='', help='через запятую: только эти id')
    ap.add_argument('--with-ammo', action='store_true', help='также 9 моделей боеприпасов (в игре пока не используются)')
    ap.add_argument('--model-version', default='v2.5-20250123')
    ap.add_argument('--est-model', type=float, default=40, help='оценка стоимости Image to 3D для проверки остатка')
    ap.add_argument('--est-rig', type=float, default=25)
    ap.add_argument('--est-anim', type=float, default=25)
    ap.add_argument('--no-anim', action='store_true', help='персонажи без скелета и анимаций')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    order = BUILDINGS + CHARACTERS + VEHICLES + WEAPONS + SMALL + EXTRA + (AMMO if a.with_ammo else [])
    if a.only: order = [i for i in order if i in set(a.only.split(','))] or a.only.split(',')
    os.makedirs(os.path.join(OUT, 'models'), exist_ok=True)
    state_p, man_p = os.path.join(OUT, 'tripo_state.json'), os.path.join(OUT, 'manifest.json')
    state = load_json(state_p, {'spent': 0.0, 'items': {}})
    manifest = load_json(man_p, {'models': {}}); manifest.setdefault('models', {})

    def est(i):
        k = kind_of(i); return a.est_model + ((a.est_rig + a.est_anim) if k == 'character' and not a.no_anim else 0)
    todo = [i for i in order if (state['items'].get(i) or {}).get('status') != 'done']
    missing = [i for i in todo if not os.path.exists(os.path.join(REF, i + '.jpg'))]
    print(f'Объектов к генерации: {len(todo)} (готово ранее: {len(order) - len(todo)}), оценка ≈ {sum(est(i) for i in todo):.0f} кредитов, лимит {a.budget:.0f}, уже потрачено {state["spent"]:.0f}.')
    if missing: print('Нет картинок-референсов:', ', '.join(missing))
    if a.dry_run:
        for i in todo: print(f'  {i:28s} {kind_of(i):9s} ≈{est(i):.0f}')
        return
    key = os.environ.get('TRIPO_API_KEY', '').strip()
    if not key: sys.exit('Нет ключа: задайте переменную окружения TRIPO_API_KEY (в настройках среды), не вставляя его в чат.')
    T = Tripo(key)
    bal0, frozen = T.balance(); print(f'Баланс Tripo: {bal0:.0f} (заморожено {frozen:.0f}).')
    state.setdefault('start_balance', bal0)

    def left(): return a.budget - state['spent']

    def charge(d, before):
        c = d.get('credits_consumed')
        if c is None:
            try: c = max(0.0, before - T.balance()[0])
            except Exception: c = 0.0
        state['spent'] += float(c); save_json(state_p, state); return float(c)

    for i in todo:
        if i in missing: continue
        k = kind_of(i); need = est(i)
        if need > left(): print(f'Стоп: на «{i}» нужно ≈{need:.0f}, остаток лимита {left():.0f}.'); break
        it = state['items'].setdefault(i, {})
        try:
            print(f'▶ {i} ({k})', flush=True)
            if not it.get('model_task'):
                tok = T.upload(os.path.join(REF, i + '.jpg'))
                before = T.balance()[0]
                it['model_task'] = T.submit('/v3/generation/image-to-model', {'input': tok, 'model': a.model_version, 'texture': True, 'pbr': True, 'face_limit': FACES[k], 'texture_quality': 'standard'})
                save_json(state_p, state)
                d = T.wait(it['model_task']); it['model_credits'] = charge(d, before)
                if str(d.get('status')).lower() != 'success': raise RuntimeError(f'генерация: {d.get("status")} {d.get("error_msg") or ""}')
                it['model_url'] = T.model_url(d)
            final_task = it['model_task']
            if k == 'character' and not a.no_anim:
                if left() < a.est_rig + a.est_anim: raise RuntimeError('не хватает лимита на скелет и анимации')
                if not it.get('rig_task'):
                    before = T.balance()[0]
                    it['rig_task'] = T.submit('/v3/animations/rig', {'input': it['model_task'], 'rig_type': 'biped', 'spec': 'mixamo', 'out_format': 'glb'})
                    save_json(state_p, state)
                    d = T.wait(it['rig_task']); it['rig_credits'] = charge(d, before)
                    if str(d.get('status')).lower() != 'success': raise RuntimeError(f'скелет: {d.get("status")} {d.get("error_msg") or ""}')
                if not it.get('anim_task'):
                    before = T.balance()[0]
                    it['anim_task'] = T.submit('/v3/animations/retarget', {'input': it['rig_task'], 'animations': ANIMS, 'out_format': 'glb', 'export_with_geometry': True})
                    save_json(state_p, state)
                    d = T.wait(it['anim_task']); it['anim_credits'] = charge(d, before)
                    if str(d.get('status')).lower() != 'success': raise RuntimeError(f'анимации: {d.get("status")} {d.get("error_msg") or ""}')
                    it['model_url'] = T.model_url(d)
                final_task = it['anim_task']
            dest = os.path.join(OUT, 'models', i + '.glb')
            try: T.download(it['model_url'], dest)
            except Exception:  # ссылка устарела — берём свежую из задачи
                it['model_url'] = T.model_url(T._req('GET', f'/v3/tasks/{final_task}'))
                try: T.download(it['model_url'], dest)
                except Exception as ex2:
                    host = urllib.parse.urlparse(it['model_url']).hostname
                    raise RuntimeError(f'Сеть недоступна: не скачать модель с {host} ({ex2}). Добавьте этот домен в разрешённые и запустите снова — кредиты повторно не тратятся.')
            e = {'file': f'models/{i}.glb', 'kind': k, 'source': 'tripo', 'task': final_task}
            if k == 'character': e.update({'height': 1.78, 'yaw': 3.14159, 'clips': {'idle': 0, 'walk': 1, 'run': 2, 'shoot': 3, 'fall': 4}})
            manifest['models'][MANIFEST_ID.get(i, i)] = e
            save_json(man_p, manifest)
            it['status'] = 'done'; it['bytes'] = os.path.getsize(dest); save_json(state_p, state)
            print(f'  ✓ {i}: {it["bytes"] // 1024} КБ, потрачено всего {state["spent"]:.0f} / {a.budget:.0f}', flush=True)
        except Exception as ex:
            it['status'] = 'failed'; it['error'] = str(ex)[:300]; save_json(state_p, state)
            print(f'  ✗ {i}: {ex}', flush=True)
            if 'Сеть недоступна' in str(ex) or 'HTTP 401' in str(ex) or 'HTTP 403' in str(ex): break
    done = [i for i in order if (state['items'].get(i) or {}).get('status') == 'done']
    print(f'\nГотово моделей: {len(done)} из {len(order)}. Потрачено кредитов: {state["spent"]:.0f} из лимита {a.budget:.0f}.')
    print('Манифест:', man_p)


if __name__ == '__main__':
    main()
