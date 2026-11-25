"""
Cuts the character photos and the chest out of their backgrounds, so the game can animate them as
sprites over its own scenes (the street plate, the home interiors). Runs after
scripts/meros/generate-art.mts, on the raw PNGs it caches.

    python3 -m venv .venv-art && .venv-art/bin/pip install "rembg[cpu]" pillow
    .venv-art/bin/python scripts/meros/cutout.py

Characters keep their 480x640 canvas, so every outfit lines up exactly (feet on the same line) and
an outfit change can swap one image for the next in place. The chest is trimmed to its outline.
Incremental: an output that already has an alpha channel is left alone.
"""

import os
import sys
from glob import glob

from PIL import Image
from rembg import new_session, remove

CACHE = os.environ.get("ART_CACHE", ".cache/meros-art")
OUT = "public/meros/art"
session = new_session("isnet-general-use")


def has_alpha(path: str) -> bool:
    try:
        with Image.open(path) as im:
            return im.mode in ("RGBA", "LA") and im.getextrema()[-1][0] < 255
    except (FileNotFoundError, OSError):
        return False


def cut(src: str, dst: str, size: tuple[int, int] | None, trim: bool) -> None:
    image = Image.open(src).convert("RGB")
    sprite = remove(image, session=session, post_process_mask=True)
    if trim:
        box = sprite.getbbox()
        if box:
            sprite = sprite.crop(box)
        side = int(max(sprite.size) * 1.08)
        canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        canvas.paste(sprite, ((side - sprite.width) // 2, (side - sprite.height) // 2))
        sprite = canvas.resize((560, 560), Image.LANCZOS)
    elif size:
        sprite = sprite.resize(size, Image.LANCZOS)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    sprite.save(dst, "WEBP", quality=78, method=6)


jobs = [(p, f"{OUT}/char/{os.path.basename(p)[:-4]}.webp", (480, 640), False) for p in sorted(glob(f"{CACHE}/char/*.png"))]
jobs += [(p, f"{OUT}/sprite/{os.path.basename(p)[:-4]}.webp", None, True) for p in sorted(glob(f"{CACHE}/sprite/*.png"))]
todo = [j for j in jobs if not has_alpha(j[1])]
print(f"{len(jobs)} sprites, {len(todo)} to cut out.")
for i, (src, dst, size, trim) in enumerate(todo, 1):
    cut(src, dst, size, trim)
    if i % 25 == 0 or i == len(todo):
        print(f"{i}/{len(todo)}", flush=True)
sys.exit(0)
