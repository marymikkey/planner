"""Generates the PNG app icons (no dependencies). Run: python3 tools/make_icons.py"""
import math, struct, zlib, os

BG = (79, 113, 100); FG = (246, 243, 238)

def clamp(v): return max(0.0, min(1.0, v))

def render(size, rounded, scale=1.0):
    rows = []
    c = size / 2
    r_out = 118 / 512 * size * scale
    thick = 30 / 512 * size * scale
    r_dot = 38 / 512 * size * scale
    rad = 112 / 512 * size
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            px, py = x + 0.5, y + 0.5
            # rounded-square mask
            if rounded:
                dx = max(abs(px - c) - (c - rad), 0); dy = max(abs(py - c) - (c - rad), 0)
                a_bg = clamp(0.5 - (math.hypot(dx, dy) - rad))
            else:
                a_bg = 1.0
            d = math.hypot(px - c, py - c)
            ring = clamp(0.5 - (abs(d - r_out) - thick / 2))
            dot = clamp(0.5 - (d - r_dot))
            f = max(ring, dot)
            col = [BG[i] * (1 - f) + FG[i] * f for i in range(3)]
            row += bytes([round(col[0]), round(col[1]), round(col[2]), round(a_bg * 255)])
        rows.append(bytes(row))
    raw = b''.join(rows)
    def chunk(t, d):
        b = struct.pack('>I', len(d)) + t + d
        return b + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')

out = os.path.join(os.path.dirname(__file__), '..', 'icons')
for name, size, rounded, scale in [('icon-192.png', 192, True, 1), ('icon-512.png', 512, True, 1),
                                   ('icon-maskable-512.png', 512, False, 0.8), ('apple-touch-icon.png', 180, False, 0.9)]:
    open(os.path.join(out, name), 'wb').write(render(size, rounded, scale))
    print('wrote', name)
