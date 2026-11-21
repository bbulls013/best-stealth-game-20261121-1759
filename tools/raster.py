#!/usr/bin/env python3
"""Replay Silent Ledger display-list ops (from tools/shots.mjs) into PNGs.

This is the software backend for the game's own draw() output: the same
ops the browser replays onto Canvas2D via gfx.js. Text uses a monospace
font to match the game's canvas font stack.
"""
import json
import sys
from PIL import Image, ImageDraw, ImageFont

W, H = 960, 600
FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
]


def font(size):
    for path in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, int(size))
        except OSError:
            continue
    return ImageFont.load_default()


def rgba(c):
    if c.startswith("rgba("):
        parts = [float(p) for p in c[5:-1].split(",")]
        return (int(parts[0]), int(parts[1]), int(parts[2]), int(parts[3] * 255))
    h = c.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def render(ops_path, out_path):
    ops = json.load(open(ops_path))
    img = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    d = ImageDraw.Draw(img)
    for o in ops:
        t = o["t"]
        if t == "clear":
            d.rectangle([0, 0, W, H], fill=rgba(o["c"]))
        elif t == "rect":
            c = rgba(o["c"])
            tgt = od if c[3] < 255 else d
            tgt.rectangle([o["x"], o["y"], o["x"] + o["w"], o["y"] + o["h"]], fill=c)
        elif t == "circle":
            r = o["r"]
            d.ellipse([o["x"] - r, o["y"] - r, o["x"] + r, o["y"] + r], fill=rgba(o["c"]))
        elif t == "ring":
            r = o["r"]
            d.ellipse([o["x"] - r, o["y"] - r, o["x"] + r, o["y"] + r],
                      outline=rgba(o["c"]), width=int(o.get("w", 2)))
        elif t == "poly":
            pts = [(p[0], p[1]) for p in o["p"]]
            if len(pts) >= 3:
                od.polygon(pts, fill=rgba(o["c"]))
        elif t == "line":
            d.line([o["x1"], o["y1"], o["x2"], o["y2"]], fill=rgba(o["c"]), width=int(o.get("w", 1)))
        elif t == "text":
            f = font(o["size"])
            anchor = {"left": "lm", "center": "mm", "right": "rm"}.get(o.get("align", "left"), "lm")
            d.text((o["x"], o["y"]), o["s"], fill=rgba(o["c"]), font=f, anchor=anchor)
    img.alpha_composite(overlay)
    img.convert("RGB").save(out_path, "PNG", optimize=True)
    print(out_path, "written")


if __name__ == "__main__":
    render(sys.argv[1], sys.argv[2])
