#!/usr/bin/env python3
"""Label and stitch Seattle map filter comparison panels."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path('/opt/cursor/artifacts')
GAP = 16
LABEL_H = 44
BG = (28, 27, 25)
FG = (250, 248, 243)

def font(size):
    for p in (
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    ):
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def panel(path, label):
    im = Image.open(path).convert('RGB')
    canvas = Image.new('RGB', (im.width, im.height + LABEL_H), BG)
    canvas.paste(im, (0, LABEL_H))
    d = ImageDraw.Draw(canvas)
    f = font(22)
    d.text((14, 10), label, fill=FG, font=f)
    return canvas

def stitch(panels, dest):
    w = sum(p.width for p in panels) + GAP * (len(panels) + 1)
    h = max(p.height for p in panels) + GAP * 2
    out = Image.new('RGB', (w, h), BG)
    x = GAP
    for p in panels:
        out.paste(p, (x, GAP))
        x += p.width + GAP
    out.save(dest, 'PNG', optimize=True)
    print('wrote', dest, out.size)

three = [
    panel(OUT / 'seattle-map-original.png', 'Original'),
    panel(OUT / 'seattle-map-sketch.png', 'Sketch (CSS grayscale)'),
    panel(OUT / 'seattle-map-blueprint.png', 'Blueprint'),
]
four = three + [
    panel(OUT / 'seattle-map-sketch-edge.png', 'Sketch, edge filter'),
]
stitch(three, OUT / 'seattle-map-composite-3.png')
stitch(four, OUT / 'seattle-map-composite-4.png')
