"""Builds the screen-scare flicker frames from the hand-drawn face (tools/scares/source-face.png).

Run: python tools/scares/makeFlicker.py
Writes public/assets/scares/flicker/frame-0.webp .. frame-5.webp: the drawing at 100% contrast
(pure ink, no greys) as glowing lines on a transparent background, each frame lit differently so
cycling them reads as a flickering, living face. Frames are 3:4 to fit the scare's face box.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageFilter, ImageOps

HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / 'public' / 'assets' / 'scares' / 'flicker'
SCALE = 3
THRESHOLD = 120  # 0-255: darker than this is ink


def ink_mask() -> Image.Image:
    """The drawing's ink as a pure 0/255 mask (255 = ink), upscaled and padded to 3:4."""
    src = Image.open(HERE / 'source-face.png').convert('L')
    # Even out uneven paper lighting before the hard threshold.
    paper = src.filter(ImageFilter.GaussianBlur(18))
    flat = ImageOps.autocontrast(ImageChops.invert(ImageChops.subtract(paper, src)), cutoff=1)
    big = flat.resize((src.width * SCALE, src.height * SCALE), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.2))
    a = np.array(big)
    mask = np.where(a < THRESHOLD, 255, 0).astype(np.uint8)
    m = Image.fromarray(mask, 'L')
    # Clean specks, keep lines a touch bolder so they read at full screen height.
    m = m.filter(ImageFilter.MedianFilter(3)).filter(ImageFilter.MaxFilter(3))
    w, h = m.size
    tw = round(h * 3 / 4)
    canvas = Image.new('L', (max(tw, w), h), 0)
    canvas.paste(m, ((canvas.width - w) // 2, 0))
    return canvas


def glow(mask: Image.Image, color, radius: float, strength: float) -> Image.Image:
    blur = mask.filter(ImageFilter.GaussianBlur(radius))
    alpha = blur.point(lambda v: min(255, int(v * strength)))
    layer = Image.new('RGBA', mask.size, color + (0,))
    layer.putalpha(alpha)
    return layer


def lines(mask: Image.Image, color, alpha: float = 1.0) -> Image.Image:
    layer = Image.new('RGBA', mask.size, color + (0,))
    layer.putalpha(mask.point(lambda v: int(v * alpha)))
    return layer


def stack(*layers: Image.Image) -> Image.Image:
    out = Image.new('RGBA', layers[0].size, (0, 0, 0, 0))
    for l in layers:
        out = Image.alpha_composite(out, l)
    return out


def shifted(img: Image.Image, dx: int, dy: int) -> Image.Image:
    return ImageChops.offset(img, dx, dy)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    m = ink_mask()
    white = (255, 255, 255)
    frames = [
        # 0: steady white lines with a cold halo
        stack(glow(m, (190, 210, 255), 14, 2.2), lines(m, white)),
        # 1: blood-red glow, hot lines
        stack(glow(m, (255, 20, 20), 22, 3.0), glow(m, (255, 90, 60), 6, 2.0), lines(m, (255, 230, 220))),
        # 2: near-dark gutter: dim lines, faint ember
        stack(glow(m, (120, 20, 10), 10, 1.2), lines(m, (200, 200, 200), 0.35)),
        # 3: chromatic split, as if the face jerks
        stack(lines(shifted(m, -9, 0), (255, 40, 40), 0.85), lines(shifted(m, 9, 0), (40, 220, 255), 0.75), lines(m, white)),
        # 4: sickly green flare
        stack(glow(m, (90, 255, 120), 26, 2.6), lines(m, (220, 255, 220))),
        # 5: over-bright flash: a wide white bloom
        stack(glow(m, white, 24, 1.6), glow(m, (255, 240, 200), 6, 2.2), lines(m, white)),
    ]
    for i, f in enumerate(frames):
        f.save(OUT / f'frame-{i}.webp', 'WEBP', quality=88, method=6)
        print(OUT / f'frame-{i}.webp', f.size)


if __name__ == '__main__':
    main()
