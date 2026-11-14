#!/usr/bin/env python3
"""Фотоотчёт проверки анимаций: графики, сводные таблицы PASS/WARN/FAIL «до/после», пары снимков «до/после».

    python3 tools/anim_qa_report.py <папка «до»> <папка «после»> <docs/anim_qa>

В папках — итог лаборатории (tools/anim_lab_qa.tscn): qa_hero.json, qa_suit.json, sheet_*.png, trans_*.png,
eight_*.png, phases_*.png. Снимки ужимаются (палитра, PNG), таблицы пишутся в <docs/anim_qa>/tables.md.
"""
import json
import os
import shutil
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from PIL import Image, ImageDraw, ImageFont  # noqa: E402

# палитра (проверена валидатором: синий / оранжевый — соседние категориальные слоты; статусы — отдельно)
BLUE, ORANGE = "#2a78d6", "#eb6834"
GOOD, WARN, CRIT = "#0ca30c", "#fab219", "#d03b3b"
INK, INK2, GRID, SURF = "#0b0b0b", "#52514e", "#dddcd8", "#fcfcfb"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONTB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

# 48 клипов задания + 5 поз; дальше — новые (эмоции, удары трубой, отскок)
BASE = ["idle", "breathe", "walk", "walk_back", "strafe_left", "strafe_right", "run", "sprint", "start", "stop", "turn_left",
        "turn_right", "crouch_idle", "crouch_walk", "sneak", "stairs_up", "stairs_down", "ladder_up", "door_open", "door_close",
        "terminal", "pickup", "suit_on", "suit_off", "sit_down", "stand_up", "bed_lie", "bed_up", "combat_idle", "punch_light",
        "punch_heavy", "block", "dodge_left", "dodge_right", "pistol_draw", "pistol_aim", "pistol_fire", "pistol_reload",
        "rifle_aim", "rifle_fire", "hit_front", "hit_back", "hit_left", "hit_right", "stagger", "fall", "get_up", "death",
        "sit_idle", "lie_idle", "inspect", "kick", "dead"]

plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10, "axes.edgecolor": GRID, "axes.labelcolor": INK2,
                     "xtick.color": INK2, "ytick.color": INK2, "axes.titlecolor": INK, "figure.facecolor": SURF,
                     "axes.facecolor": SURF, "savefig.facecolor": SURF})


def load(d, s):
    p = Path(d) / f"qa_{s}.json"
    return json.loads(p.read_text()) if p.exists() else None


def squash(src, dst, scale=0.8, colors=64):
    im = Image.open(src).convert("RGB")
    if scale != 1.0:
        im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    im.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(dst, optimize=True)


def short(issues, n=2):
    out = []
    for i in issues[:n]:
        out.append(i.split(":")[0] if len(i) > 60 else i)
    return "; ".join(out)


def verdict_counts(q, names):
    c = {"PASS": 0, "WARN": 0, "FAIL": 0, "—": 0}
    for n in names:
        r = q["clips"].get(n) if q else None
        c[r["verdict"] if r else "—"] += 1
    return c


def chart_verdicts(qb, qa, out):
    fig, ax = plt.subplots(figsize=(7.2, 2.8), dpi=110)
    rows = []
    for s, lab in (("hero", "герой"), ("suit", "в костюме")):
        for tag, q in (("до", qb.get(s)), ("после", qa.get(s))):
            rows.append((f"{lab}, {tag}", verdict_counts(q, BASE)))
    for i, (lab, c) in enumerate(rows):
        left = 0
        for k, col in (("PASS", GOOD), ("WARN", WARN), ("FAIL", CRIT), ("—", GRID)):
            v = c[k]
            if v == 0:
                continue
            ax.barh(i, v, left=left, color=col, height=0.62, edgecolor=SURF, linewidth=2)
            if v >= 3:
                ax.text(left + v / 2, i, f"{k} {v}" if k != "—" else f"нет {v}", ha="center", va="center", fontsize=8.5,
                        color=INK if k != "FAIL" else "white")
            left += v
    ax.set_yticks(range(len(rows)), [r[0] for r in rows])
    ax.invert_yaxis()
    ax.set_xlim(0, len(BASE))
    ax.set_xlabel("клипов (из 53: 48 по заданию + позы и запасные)")
    ax.set_title("Проверка клипов: PASS / WARN / FAIL до и после доводки", loc="left", fontsize=11)
    for sp in ("top", "right", "left"):
        ax.spines[sp].set_visible(False)
    ax.tick_params(left=False)
    fig.tight_layout()
    fig.savefig(out)
    plt.close(fig)


def gait_curves(q, clip):
    """ряд углов колена/бедра от постановки левой стопы, в долях цикла (двойного шага)"""
    r = q["clips"][clip]
    s = r["series"]
    t = s["t"]
    cl = s["опора_L"]
    # постановки левой стопы
    st = [t[i] for i in range(1, len(cl)) if cl[i] and not cl[i - 1]]
    L = r["len"]
    strides = 2.0
    T = L / strides
    t0 = st[0] if st else 0.0
    xs, kl, kr, hl, hr = [], [], [], [], []
    for i, tt in enumerate(t):
        ph = ((tt - t0) % T) / T
        xs.append(ph * 100)
        kl.append(s["колено_L"][i])
        kr.append(s["колено_R"][i])
        hl.append(s["бедро_сгиб_L"][i])
        hr.append(s["бедро_сгиб_R"][i])
    order = sorted(range(len(xs)), key=lambda i: xs[i])
    return [xs[i] for i in order], [kl[i] for i in order], [kr[i] for i in order], [hl[i] for i in order], [hr[i] for i in order]


# нормативные полосы (по графикам Perry 2010 / Novacheck 1998, ±разброс; оценка), % цикла → (низ, верх)
NORM_KNEE = {
    "walk": [(0, 0, 10), (10, 10, 25), (30, 0, 10), (50, 0, 12), (60, 30, 45), (72, 55, 70), (87, 20, 40), (100, 0, 10)],
    "run": [(0, 10, 25), (15, 35, 50), (35, 15, 30), (50, 55, 85), (70, 85, 115), (90, 30, 55), (100, 10, 25)],
}
NORM_HIP = {
    "walk": [(0, 25, 35), (10, 20, 30), (30, -5, 5), (50, -20, -5), (62, -10, 5), (75, 10, 25), (87, 20, 30), (100, 25, 35)],
    "run": [(0, 30, 45), (15, 15, 30), (35, -15, -5), (50, 10, 30), (70, 40, 55), (90, 40, 55), (100, 30, 45)],
}


def chart_gait(q, clip, out, title):
    xs, kl, kr, hl, hr = gait_curves(q, clip)
    fig, axs = plt.subplots(1, 2, figsize=(9.6, 3.2), dpi=110)
    for ax, (name, l, r, norm) in zip(axs, (("колено, сгиб °", kl, kr, NORM_KNEE[clip]), ("бедро, сгиб ° (разгиб −)", hl, hr, NORM_HIP[clip]))):
        nx = [p[0] for p in norm]
        ax.fill_between(nx, [p[1] for p in norm], [p[2] for p in norm], color="#c3c2b7", alpha=0.55, linewidth=0, label="норма (оценка)")
        ax.plot(xs, l, color=BLUE, lw=2, label="левая")
        ax.plot(xs, r, color=ORANGE, lw=2, label="правая")
        ax.set_xlim(0, 100)
        ax.set_xlabel("% цикла от постановки левой стопы")
        ax.set_title(name, loc="left", fontsize=10)
        ax.grid(True, color=GRID, lw=0.6)
        for sp in ("top", "right"):
            ax.spines[sp].set_visible(False)
    axs[0].legend(loc="upper left", frameon=False, fontsize=8.5)
    fig.suptitle(title, x=0.01, ha="left", fontsize=11)
    fig.tight_layout()
    fig.savefig(out)
    plt.close(fig)


def chart_slide(qb, qa, out):
    names = ["idle", "walk", "run", "sprint", "crouch_walk", "sneak", "walk_back", "strafe_left", "strafe_right", "turn_left", "turn_right"]
    b = [qb["clips"].get(n, {}).get("m", {}).get("скольжение_p95", 0) for n in names]
    a = [qa["clips"].get(n, {}).get("m", {}).get("скольжение_p95", 0) for n in names]
    fig, ax = plt.subplots(figsize=(9.6, 3.0), dpi=110)
    x = range(len(names))
    ax.bar([i - 0.2 for i in x], b, width=0.38, color=ORANGE, label="до", edgecolor=SURF, linewidth=2)
    ax.bar([i + 0.2 for i in x], a, width=0.38, color=BLUE, label="после", edgecolor=SURF, linewidth=2)
    ax.axhline(25, color=CRIT, lw=1, ls="--")
    ax.text(len(names) - 0.5, 27, "FAIL > 25", color=INK2, fontsize=8, ha="right")
    ax.axhline(12, color=GOOD, lw=1, ls="--")
    ax.text(len(names) - 0.5, 14, "PASS ≤ 12", color=INK2, fontsize=8, ha="right")
    ax.set_xticks(list(x), names, rotation=30, ha="right")
    ax.set_ylabel("см/с")
    ax.set_yscale("symlog", linthresh=30)
    ax.set_title("Скольжение опорной точки подошвы, 95-й процентиль (герой, «как в игре»)", loc="left", fontsize=11)
    ax.legend(frameon=False, loc="upper left")
    for sp in ("top", "right"):
        ax.spines[sp].set_visible(False)
    fig.tight_layout()
    fig.savefig(out)
    plt.close(fig)


def pair(before, after, out, title, note_b="", note_a=""):
    """две картинки друг над другом с подписями «ДО» / «ПОСЛЕ»"""
    ib = Image.open(before).convert("RGB")
    ia = Image.open(after).convert("RGB")
    w = max(ib.width, ia.width)
    head = 30
    canvas = Image.new("RGB", (w, ib.height + ia.height + head * 3), SURF)
    d = ImageDraw.Draw(canvas)
    f = ImageFont.truetype(FONTB, 18)
    f2 = ImageFont.truetype(FONT, 14)
    d.text((8, 5), title, fill=INK, font=f)
    d.text((8, head + 6), "ДО  " + note_b, fill=CRIT, font=f2)
    canvas.paste(ib, (0, head * 2))
    d.text((8, head * 2 + ib.height + 6), "ПОСЛЕ  " + note_a, fill="#0a7f0a", font=f2)
    canvas.paste(ia, (0, head * 3 + ib.height))
    tmp = out + ".tmp.png"
    canvas.save(tmp)
    squash(tmp, out, 0.75, 72)
    os.remove(tmp)


def main():
    bdir, adir, dst = sys.argv[1], sys.argv[2], Path(sys.argv[3])
    dst.mkdir(parents=True, exist_ok=True)
    (dst / "sheets").mkdir(exist_ok=True)
    (dst / "before_after").mkdir(exist_ok=True)
    qb = {s: load(bdir, s) for s in ("hero", "suit")}
    qa = {s: load(adir, s) for s in ("hero", "suit")}
    chart_verdicts(qb, qa, str(dst / "verdicts.png"))
    for clip, title in (("walk", "Ходьба: углы по циклу шага против нормы (после доводки)"), ("run", "Бег: углы по циклу против нормы (после доводки)")):
        chart_gait(qa["hero"], clip, str(dst / f"gait_{clip}.png"), title)
        chart_gait(qb["hero"], clip, str(dst / f"gait_{clip}_before.png"), title.replace("после доводки", "до доводки"))
    chart_slide(qb["hero"], qa["hero"], str(dst / "slide.png"))
    # таблицы
    lines = []
    lines.append("| № | Клип | Герой до | Герой после | Костюм до | Костюм после | Что осталось (герой, после) |")
    lines.append("|---|---|---|---|---|---|---|")
    for i, n in enumerate(BASE, 1):
        cells = []
        for s in ("hero", "suit"):
            for q in (qb[s], qa[s]):
                r = q["clips"].get(n) if q else None
                cells.append(r["verdict"] if r else "нет клипа")
        ra = qa["hero"]["clips"].get(n)
        rest = short(ra["issues"]) if ra and ra["issues"] else (short(ra["warn"], 1) if ra and ra["warn"] else "")
        lines.append(f"| {i} | `{n}` | {cells[0]} | {cells[1]} | {cells[2]} | {cells[3]} | {rest} |")
    extra = [n for n in sorted(qa["hero"]["clips"]) if n not in BASE]
    lines.append("")
    lines.append("Новые клипы (эмоции, удары трубой, отскок):")
    lines.append("")
    lines.append("| Клип | Герой | Костюм | Что отмечено (герой) |")
    lines.append("|---|---|---|---|")
    for n in extra:
        rh = qa["hero"]["clips"].get(n)
        rs = qa["suit"]["clips"].get(n) if qa["suit"] else None
        note = short(rh["issues"]) if rh["issues"] else short(rh["warn"], 1)
        lines.append(f"| `{n}` | {rh['verdict']} | {rs['verdict'] if rs else '—'} | {note} |")
    # переходы
    lines.append("")
    lines.append("| Сценарий (герой) | До: итог / скольжение ср.–p95, см/с | После: итог / скольжение ср.–p95, см/с | Переходы FAIL до → после |")
    lines.append("|---|---|---|---|")
    for name in qa["hero"].get("sims", {}):
        b = qb["hero"].get("sims", {}).get(name)
        a = qa["hero"]["sims"][name]
        fb = sum(1 for t in b["transitions"] if t["verdict"] == "FAIL") if b else "—"
        fa = sum(1 for t in a["transitions"] if t["verdict"] == "FAIL")
        lines.append(f"| {name} | {b['verdict'] if b else '—'} / {b['slide_mean'] if b else '—'}–{b['slide_p95'] if b else '—'} | "
                     f"{a['verdict']} / {a['slide_mean']}–{a['slide_p95']} | {fb} → {fa} |")
    (dst / "tables.md").write_text("\n".join(lines) + "\n")
    # снимки «после»: герой — все клипы, костюм — передвижение и те, где итог отличается от героя
    for f in Path(adir).glob("sheet_hero_*.png"):
        squash(f, dst / "sheets" / f.name, 0.8, 64)
    for f in Path(adir).glob("sheet_suit_*.png"):
        n = f.stem.replace("sheet_suit_", "")
        rh = qa["hero"]["clips"].get(n)
        rs = qa["suit"]["clips"].get(n) if qa["suit"] else None
        if n in ("walk", "run", "idle", "crouch_walk") or (rh and rs and rh["verdict"] != rs["verdict"]):
            squash(f, dst / "sheets" / f.name, 0.8, 64)
    for pat in ("eight_*.png", "trans_*.png", "phases_*.png"):
        for f in Path(adir).glob(pat):
            squash(f, dst / f.name, 0.85, 64)
    # пары «до/после» по главным исправлениям (номер — как в отчёте)
    mirror_b = Path(adir).parent / "mir_before" / "sheet_hero_hit_mirror.png"
    mirror_a = Path(adir).parent / "mir_after" / "sheet_hero_hit_mirror.png"
    pairs = [
        ("01_transition_idle_walk", f"{bdir}/trans_hero_передвижение.png", f"{adir}/trans_hero_передвижение.png",
         "Переходы при движении (стойка → шаг → бег → рывок → стоп)", "скачок позы до 38 см за кадр", "без скачков, смешивание 0.2 с"),
        ("02_walk_feet", f"{bdir}/sheet_hero_walk.png", f"{adir}/sheet_hero_walk.png",
         "Ходьба: опорная стопа", "красные точки — подошва едет по полу", "стопа фиксируется, таз не блуждает"),
        ("03_run_feet", f"{bdir}/sheet_hero_run.png", f"{adir}/sheet_hero_run.png",
         "Бег: опорная стопа и смещение тела", "скорость клипа 3.01 вместо 4.22 м/с, тело на 0.9 м впереди капсулы", "скорость по подошве, тело над капсулой"),
        ("04_idle_arms", f"{bdir}/sheet_hero_idle.png", f"{adir}/sheet_hero_idle.png",
         "Стойка: руки в куртке", "фиолетовые круги — предплечья внутри туловища до 10 см", "плечо отведено ровно до поверхности"),
        ("05_hit_knees", f"{bdir}/sheet_hero_hit_front.png", f"{adir}/sheet_hero_hit_front.png",
         "Удар спереди: колени и локти «вывернуты»", "колено вне плоскости сгиба до 49°", "бедро довёрнуто, стопа на месте"),
        ("06_knee_hyperext", f"{bdir}/sheet_hero_look_around.png", f"{adir}/sheet_hero_look_around.png",
         "Оглядывается: переразгиб колена", "колено согнуто назад до 17°", "колено на своей стороне"),
        ("07_crouch_walk", f"{bdir}/sheet_hero_crouch_walk.png", f"{adir}/sheet_hero_crouch_walk.png",
         "Ходьба в приседе: новый клип Tripo", "ноги разведены на 100°, шея запрокинута", "новая генерация"),
        ("08_stand_up", f"{bdir}/sheet_hero_stand_up.png", f"{adir}/sheet_hero_stand_up.png",
         "Встать со стула", "клип Tripo начинается не в позе «сидит» (46 см)", "посадка наоборот — стык 0 см"),
        ("09_bed_up", f"{bdir}/trans_hero_сесть_лечь.png", f"{adir}/trans_hero_сесть_лечь.png",
         "Сесть, лечь, встать: переходы", "встать с кровати — тело «перелетает» 2.3 м за 0.25 с", "без рывков"),
        ("10_mirror", str(mirror_b), str(mirror_a),
         "Зеркалирование (удар слева → справа)", "прежняя формула: тело висит на 25 см, локоть вывернут на 126°", "исправленная формула"),
        ("11_walk_back", f"{bdir}/sheet_hero_walk_back.png", f"{adir}/sheet_hero_walk_back.png",
         "Ходьба назад: новый клип Tripo", "стопа под полом 10 см, шаги несимметричны", "новая генерация"),
        ("12_fight", f"{bdir}/trans_hero_бой.png", f"{adir}/trans_hero_бой.png",
         "Бой: серия ударов и попадания", "повторный удар обрывал клип", "два слота действий"),
    ]
    for name, b, a, title, nb, na in pairs:
        if Path(b).exists() and Path(a).exists():
            pair(b, a, str(dst / "before_after" / f"{name}.png"), title, nb, na)
    print("готово:", dst)


if __name__ == "__main__":
    main()
