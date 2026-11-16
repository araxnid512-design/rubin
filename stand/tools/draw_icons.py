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


for name, fn in [("ammo", ammo), ("shells", shells), ("bandage", bandage), ("medkit", medkit), ("can", can), ("water", water), ("rusk", rusk)]:
    fn().save(OUT + name + ".png")
    print(name)
