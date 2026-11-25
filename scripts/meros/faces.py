"""
Finds the face in every character cutout, for the round avatar crop (Character crop="face").

OpenCV's frontal-face detector runs on the top of each figure (upscaled; faces are ~40px). If it
finds nothing, a silhouette fallback places the face a little below the top of the head.

Writes lib/meros/content/faces.json: { "<file>": [cx, cy, size] } in image pixels (480x640), where
size is the detected face box's side.
Run after adding or regenerating art (needs opencv-python-headless, numpy, pillow):
  python3 scripts/meros/faces.py
"""
import glob, json, os
import cv2
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
SCALE = 3
out, fallbacks = {}, []
for path in sorted(glob.glob(os.path.join(ROOT, "public/meros/art/char/*.webp"))):
    name = os.path.basename(path)
    rgba = np.array(Image.open(path).convert("RGBA")).astype(np.float32)
    alpha = rgba[:, :, 3:] / 255
    rgb = (rgba[:, :, :3] * alpha + 255 * (1 - alpha)).astype(np.uint8)
    top = int(np.nonzero((rgba[:, :, 3] > 128).any(1))[0].min())
    y0, y1 = max(0, top - 10), min(640, top + 220)
    gray = cv2.cvtColor(rgb[y0:y1], cv2.COLOR_RGB2GRAY)
    gray = cv2.resize(gray, None, fx=SCALE, fy=SCALE, interpolation=cv2.INTER_CUBIC)
    faces = cascade.detectMultiScale(gray, scaleFactor=1.05, minNeighbors=5, minSize=(25 * SCALE, 25 * SCALE))
    if len(faces):
        # The face is the top-most detection; shirts and collars sometimes register lower down.
        x, y, w, h = min(faces, key=lambda f: f[1])
        out[name] = [round(x / SCALE + w / SCALE / 2, 1), round(y0 + y / SCALE + h / SCALE / 2, 1), round(w / SCALE, 1)]
    else:
        fallbacks.append(name)
        out[name] = None

# A box much larger than the same person's other outfits is a false hit (a shirt); redo those.
for name, v in list(out.items()):
    if not v:
        continue
    person = name.rsplit("-", 1)[0]
    sizes = [w[2] for k, w in out.items() if w and k.startswith(person + "-")]
    if v[2] > 1.25 * float(np.median(sizes)):
        fallbacks.append(name)
        out[name] = None

# Fallback: same person (skin + hair) in another outfit has the same head; else the top of the figure.
for name in fallbacks:
    person = name.rsplit("-", 1)[0]
    found = [v for k, v in out.items() if v and k.startswith(person + "-")]
    if found:
        out[name] = [round(float(np.median([f[i] for f in found])), 1) for i in range(3)]
    else:
        a = np.array(Image.open(os.path.join(ROOT, "public/meros/art/char", name)).convert("RGBA"))[:, :, 3] > 128
        top = int(np.nonzero(a.any(1))[0].min())
        out[name] = [240.0, top + 45.0, 50.0]

dest = os.path.join(ROOT, "lib/meros/content/faces.json")
with open(dest, "w") as f:
    json.dump(out, f, separators=(",", ":"))
sizes = [v[2] for v in out.values()]
print(f"{len(out)} faces ({len(fallbacks)} fallbacks: {fallbacks[:6]}) size {min(sizes)}-{max(sizes)}")
