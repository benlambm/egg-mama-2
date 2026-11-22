#!/usr/bin/env python3
"""
Egg Mama — draw the app icons (icons/icon-192.png, icons/icon-512.png).

Pure stdlib: shapes are rasterized into an RGBA buffer at 4x and box-downscaled,
then written as PNG with zlib. The icon shows Mama (a big warm-white egg with a
face and a pink tuft) in front of a golden egg and a duckling, on a meadow
gradient — everything inside the middle 80% safe zone that phone masks crop to.

    python3 tools/make-icons.py
"""
import os
import struct
import zlib

SS = 4  # supersampling


def make_canvas(size):
    return [[[0, 0, 0, 0] for _ in range(size)] for _ in range(size)]


def blend(px, x, y, color):
    if 0 <= x < len(px[0]) and 0 <= y < len(px):
        r, g, b, a = color
        dr, dg, db, da = px[y][x]
        sa = a / 255.0
        da2 = da / 255.0
        oa = sa + da2 * (1 - sa)
        if oa <= 0:
            px[y][x] = [0, 0, 0, 0]
            return
        px[y][x] = [
            int((r * sa + dr * da2 * (1 - sa)) / oa),
            int((g * sa + dg * da2 * (1 - sa)) / oa),
            int((b * sa + db * da2 * (1 - sa)) / oa),
            int(oa * 255),
        ]


def lerp(c0, c1, t):
    return tuple(int(c0[i] + (c1[i] - c0[i]) * t) for i in range(4))


def fill_rounded_rect(px, x0, y0, x1, y1, r, c0, c1, vertical=True):
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            # rounded-rect SDF-ish mask
            cx = min(max(x + 0.5, x0 + r), x1 - r)
            cy = min(max(y + 0.5, y0 + r), y1 - r)
            d = ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) ** 0.5
            if d <= r:
                t = (y - y0) / max(1, y1 - y0) if vertical else (x - x0) / max(1, x1 - x0)
                blend(px, x, y, lerp(c0, c1, t))


def ellipse(px, cx, cy, rx, ry, color, outline=None, lw=0):
    """Fill an ellipse; draw the outline first as a slightly larger ellipse."""
    if outline:
        for yy in range(int(cy - ry - lw), int(cy + ry + lw) + 1):
            for xx in range(int(cx - rx - lw), int(cx + rx + lw) + 1):
                if ((xx + 0.5 - cx) / (rx + lw)) ** 2 + ((yy + 0.5 - cy) / (ry + lw)) ** 2 <= 1:
                    blend(px, xx, yy, outline)
    for yy in range(int(cy - ry), int(cy + ry) + 1):
        for xx in range(int(cx - rx), int(cx + rx) + 1):
            if ((xx + 0.5 - cx) / rx) ** 2 + ((yy + 0.5 - cy) / ry) ** 2 <= 1:
                blend(px, xx, yy, color)


def shaded_egg(px, cx, cy, rx, ry, lit, mid, shade, outline, lw):
    """An egg: rounder at the bottom, lit from the upper left."""
    # body
    for yy in range(int(cy - ry - lw), int(cy + ry + lw) + 1):
        for xx in range(int(cx - rx - lw), int(cx + rx + lw) + 1):
            nx = (xx + 0.5 - cx) / (rx + lw)
            ny = (yy + 0.5 - cy) / (ry + lw)
            d = nx * nx + ny * ny
            if d <= 1:
                blend(px, xx, yy, outline)
    for yy in range(int(cy - ry), int(cy + ry) + 1):
        for xx in range(int(cx - rx), int(cx + rx) + 1):
            nx = (xx + 0.5 - cx) / rx
            ny = (yy + 0.5 - cy) / ry
            d = nx * nx + ny * ny
            if d <= 1:
                # light from upper left
                t = min(1.0, max(0.0, (-nx * 0.7 - ny * 0.7 + 1) / 2))
                if t < 0.45:
                    c = lerp(shade, mid, t / 0.45)
                else:
                    c = lerp(mid, lit, (t - 0.45) / 0.55)
                # egg is narrower at the top: shrink test
                shrink = 0.82 + 0.18 * min(1, max(0, (ny + 1) / 2))
                if (nx / shrink) ** 2 + ny * ny <= 1:
                    blend(px, xx, yy, c)


def circle(px, cx, cy, r, color):
    for yy in range(int(cy - r), int(cy + r) + 1):
        for xx in range(int(cx - r), int(cx + r) + 1):
            if (xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2 <= r * r:
                blend(px, xx, yy, color)


def triangle(px, p0, p1, p2, color):
    xs = [p0[0], p1[0], p2[0]]
    ys = [p0[1], p1[1], p2[1]]
    for y in range(int(min(ys)), int(max(ys)) + 1):
        for x in range(int(min(xs)), int(max(xs)) + 1):
            x0, y0 = p0
            x1, y1 = p1
            x2, y2 = p2
            d = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
            if d == 0:
                continue
            a = ((x1 - x) * (y2 - y) - (x2 - x) * (y1 - y)) / d
            b = ((x2 - x) * (y0 - y) - (x0 - x) * (y2 - y)) / d
            g = 1 - a - b
            if a >= -0.02 and b >= -0.02 and g >= -0.02:
                blend(px, x, y, color)


def draw_icon(size):
    S = size * SS
    px = make_canvas(S)
    u = S / 1024.0  # design in a 1024 grid

    # sky-to-meadow background, rounded
    sky = (168, 216, 248, 255)
    grass = (110, 190, 90, 255)
    fill_rounded_rect(px, 0, 0, S, S, 230 * u, sky, (255, 246, 224, 255))
    fill_rounded_rect(px, 0, 560 * u, S, S, 0, grass, (74, 148, 66, 255), vertical=True)
    # a soft sun glow upper left
    for yy in range(0, S):
        for xx in range(0, S):
            d = ((xx - 200 * u) ** 2 + (yy - 170 * u) ** 2) ** 0.5 / (300 * u)
            if d < 1:
                blend(px, xx, yy, (255, 244, 190, int(120 * (1 - d))))

    # ground shadow
    ellipse(px, 512 * u, 830 * u, 300 * u, 46 * u, (40, 60, 30, 90))

    # golden egg (left, behind)
    shaded_egg(px, 300 * u, 700 * u, 105 * u, 135 * u, (255, 251, 214, 255), (255, 212, 59, 255),
               (232, 138, 0, 255), (138, 74, 0, 255), 14 * u)
    # star marks on the golden egg
    import math
    def star(cx, cy, r, color):
        for yy in range(int(cy - r), int(cy + r) + 1):
            for xx in range(int(cx - r), int(cx + r) + 1):
                dx, dy = xx + .5 - cx, yy + .5 - cy
                rr = math.hypot(dx, dy)
                if rr > r:
                    continue
                a = math.atan2(dy, dx) + math.pi / 2
                k = 4
                if rr <= r * (0.45 + 0.55 * abs(math.cos(k * a / 2)) ** (2.0 / k) * 0 + 0.45) or True:
                    # 4-point star: |cos(2a)|-style radius modulation
                    mod = 0.45 + 0.55 * abs(math.cos(2 * a))
                    if rr <= r * mod:
                        blend(px, xx, yy, color)
    star(340 * u, 640 * u, 26 * u, (255, 255, 255, 230))
    star(255 * u, 745 * u, 18 * u, (255, 255, 255, 230))

    # Mama (center-right, the star)
    shaded_egg(px, 560 * u, 640 * u, 190 * u, 235 * u, (255, 255, 255, 255), (254, 249, 239, 255),
               (216, 203, 232, 255), (107, 74, 122, 255), 20 * u)
    # gleam
    ellipse(px, 490 * u, 520 * u, 34 * u, 48 * u, (255, 255, 255, 200))
    # pink hair tuft
    triangle(px, (520 * u, 420 * u), (560 * u, 360 * u), (585 * u, 425 * u), (240, 106, 154, 255))
    triangle(px, (560 * u, 420 * u), (610 * u, 375 * u), (620 * u, 430 * u), (192, 58, 114, 255))
    # eyes (looking right)
    circle(px, 590 * u, 600 * u, 17 * u, (58, 38, 24, 255))
    circle(px, 662 * u, 600 * u, 17 * u, (58, 38, 24, 255))
    circle(px, 584 * u, 593 * u, 6 * u, (255, 255, 255, 255))
    circle(px, 656 * u, 593 * u, 6 * u, (255, 255, 255, 255))
    # rosy cheeks
    ellipse(px, 565 * u, 645 * u, 22 * u, 14 * u, (255, 120, 130, 110))
    ellipse(px, 685 * u, 645 * u, 22 * u, 14 * u, (255, 120, 130, 110))
    # smile
    for yy in range(int(630 * u), int(665 * u)):
        for xx in range(int(600 * u), int(660 * u)):
            dx, dy = (xx + .5 - 630 * u) / (30 * u), (yy + .5 - 648 * u) / (16 * u)
            d = dx * dx + dy * dy
            if 0.55 <= d <= 1.0 and dy > 0:
                blend(px, xx, yy, (58, 38, 24, 255))

    # duckling (right)
    ellipse(px, 830 * u, 780 * u, 62 * u, 30 * u, (40, 60, 30, 80))
    shaded_egg(px, 830 * u, 735 * u, 62 * u, 70 * u, (255, 240, 168, 255), (255, 207, 58, 255),
               (224, 154, 16, 255), (154, 98, 6, 255), 10 * u)
    circle(px, 862 * u, 690 * u, 8 * u, (58, 38, 24, 255))
    triangle(px, (888 * u, 705 * u), (922 * u, 715 * u), (888 * u, 725 * u), (244, 124, 60, 255))
    fill_rounded_rect(px, 806 * u, 798 * u, 822 * u, 812 * u, 6 * u, (255, 159, 46, 255), (255, 159, 46, 255), vertical=False)
    fill_rounded_rect(px, 838 * u, 798 * u, 854 * u, 812 * u, 6 * u, (255, 159, 46, 255), (255, 159, 46, 255), vertical=False)

    # downscale SS x SS by box average
    out = make_canvas(size)
    for y in range(size):
        for x in range(size):
            r = g = b = a = 0
            for sy in range(SS):
                for sx in range(SS):
                    p = px[y * SS + sy][x * SS + sx]
                    r += p[0]; g += p[1]; b += p[2]; a += p[3]
            n = SS * SS
            out[y][x] = [r // n, g // n, b // n, a // n]
    return out


def write_png(path, px):
    h = len(px)
    w = len(px[0])
    raw = bytearray()
    for row in px:
        raw.append(0)
        for p in row:
            raw += bytes(p)
    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    png += chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


if __name__ == '__main__':
    root = os.path.join(os.path.dirname(__file__), '..', 'icons')
    os.makedirs(root, exist_ok=True)
    for size in (192, 512):
        write_png(os.path.join(root, f'icon-{size}.png'), draw_icon(size))
        print('wrote icons/icon-%d.png' % size)
