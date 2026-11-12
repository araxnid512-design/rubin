#!/usr/bin/env python3
"""Шаг 2 генератора голосов: озвучивает реплики из lines.json — у каждой героини свой голос.

Движок — RHVoice (свободные русские голоса Анна, Елена, Ирина). Характер героини задаётся
профилем: базовый голос, высота тона, темп, сдвиг тембра и эффекты (sox). Результат —
Ogg/Opus-файлы charmer/src/main/assets/www/voice/<героиня>/<хеш>.ogg и список voice/index.js.

Нужно: rhvoice, rhvoice-russian, sox, opus-tools.   Запуск: python3 tools/charmer-voice/synth.py
"""
import json, os, re, subprocess, sys, tempfile, shutil
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '../../charmer/src/main/assets/www/voice'))
VER = 1  # увеличьте, чтобы переозвучить всё с новыми профилями

# героиня: (базовый голос, тон %, темп %, сдвиг тембра в центах, эффекты sox)
PROFILES = {
    'fox':      ('anna',  108, 108,   90, 'treble 2'),                                   # бойкая, звонкая
    'slime':    ('irina', 122, 102,  280, 'chorus 0.6 0.9 40 0.3 0.3 2 -t'),             # тоненькая, булькающая
    'harpy':    ('anna',  126, 128,  210, 'treble 3'),                                   # высокая, тараторит
    'lamia':    ('elena',  90,  84, -130, 'treble 5 4k reverb 12'),                      # низкая, тягучая, шипящая
    'dryad':    ('irina', 103,  80,  -30, 'lowpass 5200 reverb 18'),                     # сонная, мягкая
    'minotaur': ('elena',  92,  92, -290, 'bass 5'),                                     # крупная, грудной голос
    'vampire':  ('elena',  94,  86, -190, 'bass 2 reverb 32 60 100'),                    # бархатная, с эхом зала
    'valkyrie': ('elena', 106, 106,   20, 'treble 1'),                                   # чёткая, командная
    'neko':     ('anna',  116, 100,  160, 'treble 2'),                                   # кошачья, игривая
    'snow':     ('irina', 126,  90,  150, 'treble 3 reverb 14'),                         # нежная, воздушная
    'witch':    ('anna',   98,  98,  -70, 'chorus 0.7 0.9 55 0.4 0.25 2 -t'),            # насмешливая
    'mermaid':  ('irina', 106,  94,   50, 'chorus 0.6 0.9 50 0.4 0.25 2 -t reverb 26'),  # певучая, «под водой»
    'frog':     ('anna',  132, 114,  330, 'tremolo 22 28'),                              # квакающая
    'ghost':    ('irina', 110,  86,  100, 'highpass 260 reverb 62 50 100 echo 0.8 0.6 140 0.3'),  # призрачная
    'dragon':   ('elena',  80,  90, -390, 'bass 6 overdrive 3 reverb 16'),               # низкая, властная
}

def tts_text(t):
    """Правки текста для синтезатора: звукоподражания и паузы."""
    t = re.sub(r'[Сс]с+с', 'с-с-с', t)
    t = re.sub(r'\b([А-ЯЁа-яё])-\1', r'\1', t)          # «Т-такое» → «такое»
    t = t.replace('—', ',').replace('…', ',')
    return t

def synth(job):
    gid, text, h = job
    dst = os.path.join(OUT, gid, h + '.ogg')
    if os.path.exists(dst):
        return 0
    base, pitch, rate, cents, fx = PROFILES[gid]
    tmp = tempfile.mkdtemp()
    try:
        raw, wav = os.path.join(tmp, 'a.wav'), os.path.join(tmp, 'b.wav')
        subprocess.run(['RHVoice-test', '-p', base, '-t', str(pitch), '-r', str(rate), '-o', raw],
                       input=tts_text(text).encode(), check=True, stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
        cmd = ['sox', raw, wav, 'pitch', str(cents)] + fx.split() + ['pad', '0.03', '0.12', 'norm', '-2']
        subprocess.run(cmd, check=True, stderr=subprocess.DEVNULL)
        subprocess.run(['opusenc', '--quiet', '--bitrate', '14', '--speech', wav, dst], check=True, stderr=subprocess.DEVNULL)
        return 1
    except Exception as e:
        print('ошибка', gid, text[:40], e, file=sys.stderr)
        return 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

def main():
    lines = json.load(open(os.path.join(HERE, 'lines.json'), encoding='utf-8'))
    stamp = os.path.join(OUT, '.ver')
    if not os.path.exists(stamp) or open(stamp).read().strip() != str(VER):
        for g in PROFILES: shutil.rmtree(os.path.join(OUT, g), ignore_errors=True)
    for g in PROFILES: os.makedirs(os.path.join(OUT, g), exist_ok=True)
    jobs = [(l['id'], l['text'], l['hash']) for l in lines if l['id'] in PROFILES]
    with ThreadPoolExecutor(os.cpu_count() or 4) as ex:
        made = sum(ex.map(synth, jobs))
    open(stamp, 'w').write(str(VER))
    # убрать записи реплик, которых больше нет, и собрать список
    keep = {}
    for g, _, h in jobs: keep.setdefault(g, set()).add(h)
    idx, total = {}, 0
    for g in PROFILES:
        d = os.path.join(OUT, g); have = []
        for f in sorted(os.listdir(d)):
            if f[:-4] in keep.get(g, ()): have.append(f[:-4]); total += os.path.getsize(os.path.join(d, f))
            else: os.remove(os.path.join(d, f))
        idx[g] = ''.join(have)
    with open(os.path.join(OUT, 'index.js'), 'w') as f:
        f.write('/* Список озвученных реплик. Создаётся tools/charmer-voice/synth.py */\nU.VOX = ' + json.dumps(idx) + ';\n')
    print('озвучено новых: %d, всего файлов: %d, размер: %.1f МБ' % (made, sum(len(v) // 8 for v in idx.values()), total / 1e6))

if __name__ == '__main__':
    main()
