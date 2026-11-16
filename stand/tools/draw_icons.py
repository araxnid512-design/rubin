#!/usr/bin/env python3
"""Иконки расходников (256×256, прозрачный фон): коробка патронов, патроны 12 калибра, бинт, аптечка, банка
тушёнки, бутылка воды, пачка сухарей. Рисуются один раз: python3 stand/tools/draw_icons.py (из корня репо)."""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
FONT = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 15)
import math, random
OUT = "stand/assets/icons/"
S = 256


def shade(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c[:3]) + ((c[3],) if len(c) > 3 else ())


def soft_shadow(im, box, r=10):
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse(box, fill=(0, 0, 0, 110))
    return Image.alpha_composite(sh.filter(ImageFilter.GaussianBlur(r)), im)


def ammo():
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # картонная коробка в изометрии
    top = [(48, 96), (150, 66), (210, 92), (108, 124)]
    left = [(48, 96), (108, 124), (108, 196), (48, 168)]
    right = [(108, 124), (210, 92), (210, 162), (108, 196)]
    base = (150, 132, 98)
    d.polygon(left, fill=shade(base, 0.82))
    d.polygon(right, fill=shade(base, 0.66))
    d.polygon(top, fill=base)
    d.line(left + [left[0]], fill=(60, 50, 35), width=2)
    d.line(right + [right[0]], fill=(60, 50, 35), width=2)
    d.line(top + [top[0]], fill=(60, 50, 35), width=2)
    # полоса и патроны сверху
    d.polygon([(58, 150), (100, 168), (100, 178), (58, 160)], fill=(70, 60, 45))
    for i in range(4):
        x, y = 128 + i * 14, 72 + i * 6
        d.rounded_rectangle([x, y - 30, x + 10, y + 8], 3, fill=(196, 160, 70), outline=(110, 85, 35))
        d.ellipse([x, y - 36, x + 10, y - 22], fill=(160, 110, 60), outline=(100, 70, 30))
    return soft_shadow(im, (50, 180, 215, 215))


def shells():
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for i, (x, y) in enumerate([(70, 70), (112, 60), (154, 74), (90, 118), (134, 112)]):
        d.rounded_rectangle([x, y, x + 34, y + 96], 6, fill=(186, 52, 40), outline=(90, 20, 15), width=2)
        d.rectangle([x, y + 70, x + 34, y + 96], fill=(200, 170, 80), outline=(110, 85, 35), width=2)
        d.line([(x + 8, y + 6), (x + 8, y + 64)], fill=(225, 110, 90), width=4)
    return soft_shadow(im, (60, 200, 200, 232))


def bandage():
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([56, 70, 176, 190], fill=(232, 228, 214), outline=(150, 145, 130), width=3)
    d.ellipse([92, 106, 140, 154], fill=(205, 200, 185), outline=(150, 145, 130), width=2)
    d.ellipse([106, 120, 126, 140], fill=(120, 115, 100))
    for r in range(70, 120, 9):
        d.arc([116 - r // 2 - 4, 130 - r // 2 - 4, 116 + r // 2 + 4, 130 + r // 2 + 4], 200, 320, fill=(200, 195, 180), width=1)
    d.polygon([(170, 120), (220, 140), (214, 186), (166, 160)], fill=(236, 232, 218), outline=(150, 145, 130))
    return soft_shadow(im, (60, 175, 220, 210))


def medkit():
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([46, 74, 210, 196], 14, fill=(196, 44, 40), outline=(100, 20, 18), width=3)
    d.rounded_rectangle([96, 56, 160, 80], 8, outline=(100, 20, 18), width=6)
    d.rectangle([116, 100, 140, 170], fill=(240, 240, 235))
    d.rectangle([94, 122, 162, 148], fill=(240, 240, 235))
    d.line([(52, 90), (204, 90)], fill=(220, 90, 80), width=3)
    return soft_shadow(im, (50, 185, 210, 215))


def can():
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([74, 80, 182, 186], fill=(170, 172, 176))
    for x in range(74, 183):
        k = 0.7 + 0.5 * math.sin((x - 74) / 108 * math.pi)
        d.line([(x, 96), (x, 172)], fill=shade((200, 160, 60), k))
    d.rectangle([74, 118, 182, 150], fill=(150, 40, 35))
    d.text((84, 125), "ТУШЁНКА", fill=(240, 220, 160), font=FONT)
    d.ellipse([74, 70, 182, 92], fill=(200, 202, 206), outline=(110, 112, 116), width=2)
    d.ellipse([84, 74, 172, 88], outline=(150, 152, 156), width=2)
    d.ellipse([74, 176, 182, 196], fill=(140, 142, 146))
    return soft_shadow(im, (66, 180, 190, 210))


def water():
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([96, 80, 160, 214], 18, fill=(150, 200, 230, 210), outline=(70, 110, 140), width=3)
    d.polygon([(104, 82), (152, 82), (140, 56), (116, 56)], fill=(150, 200, 230, 210), outline=(70, 110, 140))
    d.rectangle([116, 36, 140, 56], fill=(40, 90, 170), outline=(20, 50, 100))
    d.rectangle([98, 120, 158, 160], fill=(30, 110, 190))
    d.line([(108, 92), (108, 200)], fill=(230, 245, 255, 200), width=5)
    return soft_shadow(im, (88, 200, 170, 228))


def rusk():
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(54, 108), (150, 76), (206, 110), (110, 144)], fill=(196, 170, 120))
    d.polygon([(54, 108), (110, 144), (110, 196), (54, 160)], fill=(160, 136, 92))
    d.polygon([(110, 144), (206, 110), (206, 162), (110, 196)], fill=(130, 108, 70))
    d.text((120, 152), "СУХАРИ", fill=(250, 235, 200), font=FONT)
    random.seed(3)
    for i in range(5):
        x, y = 70 + i * 22, 100 - i * 6
        d.rounded_rectangle([x, y - 22, x + 26, y + 4], 6, fill=(150, 90, 45), outline=(90, 50, 20))
    return soft_shadow(im, (56, 180, 210, 212))


def glyph(draw_fn):
    """белый значок для кнопок: рисуется в 4× и сглаживается"""
    big = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(big))
    return big.resize((128, 128), Image.LANCZOS)


W = (255, 255, 255, 255)


def g_swap(d):
    # две дуги со стрелками — смена оружия
    d.arc([96, 96, 416, 416], 200, 340, fill=W, width=44)
    d.polygon([(400, 120), (452, 232), (330, 220)], fill=W)
    d.arc([96, 96, 416, 416], 20, 160, fill=W, width=44)
    d.polygon([(112, 392), (60, 280), (182, 292)], fill=W)


def g_heal(d):
    d.rounded_rectangle([196, 76, 316, 436], 28, fill=W)
    d.rounded_rectangle([76, 196, 436, 316], 28, fill=W)


def g_take(d):
    # раскрытая ладонь
    d.rounded_rectangle([150, 230, 370, 450], 60, fill=W)
    for i, (x, h) in enumerate([(150, 150), (207, 96), (264, 84), (321, 120)]):
        d.rounded_rectangle([x, h, x + 48, 300], 24, fill=W)
    d.polygon([(150, 300), (92, 236), (60, 262), (120, 380), (150, 400)], fill=W)
    d.ellipse([52, 214, 108, 270], fill=W)


def g_bag(d):
    d.rounded_rectangle([116, 150, 396, 450], 60, fill=W)
    d.arc([190, 60, 322, 220], 180, 360, fill=W, width=36)
    d.rounded_rectangle([166, 290, 346, 400], 24, fill=(0, 0, 0, 0), outline=(0, 0, 0, 140), width=22)
    d.line([(116, 236), (396, 236)], fill=(0, 0, 0, 140), width=18)


def g_fire(d):
    # прицел
    d.ellipse([106, 106, 406, 406], outline=W, width=34)
    for a, b in [((256, 40), (256, 170)), ((256, 342), (256, 472)), ((40, 256), (170, 256)), ((342, 256), (472, 256))]:
        d.line([a, b], fill=W, width=34)
    d.ellipse([232, 232, 280, 280], fill=W)


def g_fist(d):
    d.rounded_rectangle([120, 190, 400, 420], 60, fill=W)
    for x in [120, 190, 260, 330]:
        d.rounded_rectangle([x, 130, x + 66, 260], 30, fill=W)
    d.rounded_rectangle([80, 250, 200, 330], 36, fill=W)
    for x in [188, 258, 328]:
        d.line([(x, 150), (x, 250)], fill=(0, 0, 0, 120), width=10)


def g_blade(d):
    d.polygon([(110, 400), (150, 440), (420, 150), (440, 70), (360, 96)], fill=W)
    d.line([(86, 344), (168, 426)], fill=W, width=34)
    d.line([(70, 452), (128, 394)], fill=W, width=44)


def g_reload(d):
    d.arc([96, 96, 416, 416], 300, 250, fill=W, width=44)
    d.polygon([(300, 40), (420, 110), (300, 170)], fill=W)


def g_heart(d):
    d.ellipse([70, 90, 270, 290], fill=W)
    d.ellipse([242, 90, 442, 290], fill=W)
    d.polygon([(84, 236), (428, 236), (256, 440)], fill=W)


def g_bolt(d):
    d.polygon([(300, 40), (120, 290), (236, 290), (196, 472), (392, 210), (270, 210)], fill=W)


def g_drop(d):
    d.polygon([(256, 50), (140, 280), (372, 280)], fill=W)
    d.ellipse([126, 190, 386, 450], fill=W)


def g_helmet(d):
    d.pieslice([90, 110, 422, 450], 180, 360, fill=W)
    d.rounded_rectangle([70, 270, 442, 330], 20, fill=W)
    d.rounded_rectangle([110, 330, 190, 400], 16, fill=W)


def g_vest(d):
    d.polygon([(150, 80), (210, 80), (256, 150), (302, 80), (362, 80), (420, 190), (380, 440), (132, 440), (92, 190)], fill=W)
    d.line([(256, 150), (256, 440)], fill=(0, 0, 0, 130), width=14)
    d.rounded_rectangle([150, 300, 236, 380], 10, fill=(0, 0, 0, 0), outline=(0, 0, 0, 130), width=12)
    d.rounded_rectangle([276, 300, 362, 380], 10, fill=(0, 0, 0, 0), outline=(0, 0, 0, 130), width=12)


def g_jacket(d):
    d.polygon([(180, 70), (332, 70), (400, 120), (470, 300), (400, 330), (372, 230), (372, 450), (140, 450), (140, 230), (112, 330), (42, 300), (112, 120)], fill=W)
    d.line([(256, 80), (256, 450)], fill=(0, 0, 0, 130), width=14)
    d.polygon([(200, 70), (256, 140), (312, 70)], fill=(0, 0, 0, 110))


def g_pants(d):
    d.polygon([(140, 60), (372, 60), (392, 460), (290, 460), (256, 190), (222, 460), (120, 460)], fill=W)
    d.line([(140, 110), (372, 110)], fill=(0, 0, 0, 130), width=12)


def g_boots(d):
    d.polygon([(150, 70), (270, 70), (270, 300), (420, 350), (440, 440), (150, 440)], fill=W)
    d.line([(150, 400), (440, 400)], fill=(0, 0, 0, 130), width=14)


def g_box(d):
    d.polygon([(256, 70), (450, 160), (256, 250), (62, 160)], fill=W)
    d.polygon([(62, 190), (240, 276), (240, 460), (62, 372)], fill=W)
    d.polygon([(272, 276), (450, 190), (450, 372), (272, 460)], fill=W)


for name, fn in [("stat_hp", g_heart), ("stat_en", g_bolt), ("stat_water", g_drop), ("slot_helmet", g_helmet), ("slot_vest", g_vest), ("slot_jacket", g_jacket), ("slot_pants", g_pants), ("slot_boots", g_boots), ("hud_box", g_box)]:
    glyph(fn).save(OUT + name + ".png")

for name, fn in [("hud_swap", g_swap), ("hud_heal", g_heal), ("hud_take", g_take), ("hud_bag", g_bag), ("hud_fire", g_fire), ("hud_fist", g_fist), ("hud_blade", g_blade), ("hud_reload", g_reload)]:
    glyph(fn).save(OUT + name + ".png")
    print(name)

for name, fn in [("ammo", ammo), ("shells", shells), ("bandage", bandage), ("medkit", medkit), ("can", can), ("water", water), ("rusk", rusk)]:
    fn().save(OUT + name + ".png")
    print(name)
