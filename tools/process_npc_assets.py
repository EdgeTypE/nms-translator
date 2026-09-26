#!/usr/bin/env python3
"""
Process No Man's Sky NPC portraits for the parallax dialogue mode.

For every race that has a colour frame + coloured depth map in public/:

  1. Depth decode (coloured -> grayscale height map, 960x540)
     The depth PNGs are a Spectral_r colourmap visualisation of a depth
     estimation output. We rebuild the 512-step Spectral_r LUT, map every
     pixel to its nearest LUT colour (scipy cKDTree), recover the scalar
     index, lightly blur to kill banding, percentile contrast-stretch, and
     downscale. This is the exact pipeline that produced the height map
     embedded in npc_mockup.html (verified: MAE 0.0016, corr 1.0000).

  2. UI inpaint (colour frame -> plate.jpg)
     The game frame has the dialogue UI, name label, continue arrow and a
     static mouse reticle baked in. We mask those regions (bright-pixel
     threshold for text, whole-box for solid icons) and inpaint with TELEA
     so the parallax scene is clean.

Originals are never modified; outputs are written next to them as
<race>_plate.jpg and <race>_height.png.

Usage:
    python tools/process_npc_assets.py
"""

from __future__ import annotations

import base64
import io
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import matplotlib
import numpy as np
from PIL import Image
from scipy.spatial import cKDTree

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"

# Fixed HUD boxes shared by every gameplay frame (the game UI is screen-locked).
# (x0, y0, x1, y1, brightness_threshold or None for whole-box)
NAME_BOX = (240, 790, 520, 830, 190)      # name label text
DIALOGUE_BOX = (250, 875, 1320, 935, 190)  # dialogue text line
ARROW_BOX = (720, 990, 795, 1040, None)    # continue chevron (solid icon)

# Fallback box for the static reticle if auto-detection misses it.
RETICLE_FALLBACK_BOX = (1525, 760, 1605, 840)
RETICLE_SEARCH = (1450, 720, 1700, 860)   # x0, y0, x1, y1

# Gek / Korvax / Vy'keen are all the same screen-locked dialogue layout.
GAMEPLAY_BOXES = (NAME_BOX, DIALOGUE_BOX, ARROW_BOX)

# Autophage is a gameplay frame too, but a different layout: a wider name pill,
# a numbered option list down the right edge, and no continue chevron. Its
# pointer ring sits near x=1290, well outside RETICLE_SEARCH, and the chevron
# box would land on the character's own body, so it is deliberately omitted.
AUTOPHAGE_BOXES = (
    (250, 793, 660, 840, 190),     # name pill text, wider than the default
    (400, 868, 1150, 932, 190),    # dialogue line
    (1332, 790, 1920, 950, None),  # numbered option rows, masked whole
)
AUTOPHAGE_RETICLE_SEARCH = (1180, 600, 1420, 780)


@dataclass(frozen=True)
class UiSpec:
    """Where the baked game UI lives in one source frame.

    No ``boxes`` and ``detect_reticle=False`` means the frame is a clean render:
    it is re-encoded to JPEG but never inpainted.
    """

    boxes: tuple = field(default_factory=tuple)
    detect_reticle: bool = True
    reticle_search: tuple = RETICLE_SEARCH
    reticle_fallback: tuple = RETICLE_FALLBACK_BOX


# race -> (colour source, depth source, baked UI layout)
RACES = {
    "Gek": ("gek.jpg", "gek_depth.webp", UiSpec(GAMEPLAY_BOXES)),
    "Korvax": ("korvax.png", "korvax_depth.webp", UiSpec(GAMEPLAY_BOXES)),
    "Vy'keen": ("vykenn.png", "vykenn_depth.webp", UiSpec(GAMEPLAY_BOXES)),
    # Atlas ships as a clean render with no dialogue UI baked in.
    "Atlas": ("atlas.png", "atlas_depth.webp", UiSpec(detect_reticle=False)),
    "Autophage": (
        "autophage.png",
        "autophage_depth.webp",
        UiSpec(AUTOPHAGE_BOXES, reticle_search=AUTOPHAGE_RETICLE_SEARCH),
    ),
}


def decode_depth(path: Path) -> tuple[np.ndarray, float]:
    """Coloured depth map -> grayscale height map in [0, 1], 960x540."""
    d = np.array(Image.open(path).convert("RGB"))

    # Rebuild the same 512-step Spectral_r LUT used to colour the depth map.
    lut = matplotlib.colormaps["Spectral_r"](np.linspace(0, 1, 512))[:, :3] * 255
    dist, idx = cKDTree(lut).query(d.reshape(-1, 3).astype(float))
    nn_error = float(dist.mean())

    depth = (idx / 511).reshape(d.shape[:2]).astype(np.float32)
    depth = cv2.GaussianBlur(depth, (0, 0), 1.5)

    lo, hi = np.percentile(depth, (0.5, 99.8))
    depth = np.clip((depth - lo) / (hi - lo), 0, 1)
    depth = cv2.resize(depth, (960, 540), interpolation=cv2.INTER_AREA)
    return depth, nn_error


def detect_reticle_box(gray: np.ndarray, spec: UiSpec) -> tuple[int, int, int, int]:
    """Locate the bright circular mouse reticle inside this frame's search area."""
    h, w = gray.shape
    x0, y0, x1, y1 = spec.reticle_search
    region = np.zeros((h, w), np.uint8)
    region[max(0, y0):min(h, y1), max(0, x0):min(w, x1)] = 255

    bright = ((gray > 200) & (region > 0)).astype(np.uint8) * 255
    close = cv2.morphologyEx(
        bright, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (11, 11))
    )
    n, _, stats, _ = cv2.connectedComponentsWithStats(close, 8)

    best = None
    for i in range(1, n):
        x, y, ww, hh, area = stats[i]
        if 30 <= ww <= 70 and 30 <= hh <= 70 and area >= 200:
            aspect = ww / max(hh, 1)
            if 0.7 <= aspect <= 1.4:
                if best is None or area > best[4]:
                    best = (x, y, ww, hh, area)

    if best is None:
        return spec.reticle_fallback
    x, y, ww, hh, _ = best
    return (max(0, x - 12), max(0, y - 12), min(w, x + ww + 12), min(h, y + hh + 12))


def inpaint_plate(path: Path, spec: UiSpec) -> tuple[int, int, int, int] | None:
    """Remove the baked game UI from a colour frame and save <race>_plate.jpg.

    A clean render (no boxes, no reticle to find) is only re-encoded to JPEG so
    the parallax shader keeps one texture format across every species.
    """
    img = cv2.imread(str(path))
    if img is None:
        raise FileNotFoundError(path)

    out = PUBLIC / f"{path.stem}_plate.jpg"
    if not spec.boxes and not spec.detect_reticle:
        cv2.imwrite(str(out), img, [cv2.IMWRITE_JPEG_QUALITY, 88])
        return None

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    v = img.max(axis=2)  # brightness = max channel
    h, w = v.shape
    mask = np.zeros((h, w), np.uint8)

    def add_box(box):
        x0, y0, x1, y1, thresh = box
        x0, y0 = max(0, x0), max(0, y0)
        x1, y1 = min(w, x1), min(h, y1)
        if thresh is None:
            mask[y0:y1, x0:x1] = 255
        else:
            region = v[y0:y1, x0:x1]
            mask[y0:y1, x0:x1][region > thresh] = 255

    for box in spec.boxes:
        add_box(box)

    reticle_box = None
    if spec.detect_reticle:
        reticle_box = detect_reticle_box(gray, spec)
        add_box((*reticle_box, None))

    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=3)
    result = cv2.inpaint(img, mask, 5, cv2.INPAINT_TELEA)

    cv2.imwrite(str(out), result, [cv2.IMWRITE_JPEG_QUALITY, 88])
    return reticle_box


def verify_gek_against_mockup(gek_height: np.ndarray) -> None:
    """The decoded Gek height should reproduce the mockup's embedded depth."""
    mockup = ROOT / "npc_mockup.html"
    if not mockup.exists():
        print("  (npc_mockup.html not found, skipping Gek cross-check)")
        return

    html = mockup.read_text(encoding="utf-8")
    m = re.search(r"DEPTH='data:image/[a-z]+;base64,([^']+)'", html)
    if not m:
        print("  (no embedded DEPTH found, skipping Gek cross-check)")
        return

    mock = np.array(
        Image.open(io.BytesIO(base64.b64decode(m.group(1)))).convert("L"),
        dtype=np.float32,
    ) / 255.0
    mock_small = cv2.resize(mock, (960, 540), interpolation=cv2.INTER_AREA)

    mae = float(np.abs(gek_height - mock_small).mean())
    corr = float(np.corrcoef(gek_height.ravel(), mock_small.ravel())[0, 1])
    print(f"  Gek vs npc_mockup embedded depth: MAE={mae:.4f} corr={corr:.4f}")
    if mae < 0.01 and corr > 0.99:
        print("  -> matches the mockup reference")
    else:
        print("  -> WARNING: decoded Gek height drifted from the mockup reference")


def main() -> int:
    if not PUBLIC.exists():
        print("public/ not found", file=sys.stderr)
        return 1

    gek_height = None
    for race, (color_name, depth_name, spec) in RACES.items():
        color_path = PUBLIC / color_name
        depth_path = PUBLIC / depth_name
        if not color_path.exists() or not depth_path.exists():
            print(f"[{race}] skipped (missing {color_name} or {depth_name})")
            continue

        depth, nn_error = decode_depth(depth_path)
        height_path = PUBLIC / f"{color_path.stem}_height.png"
        cv2.imwrite(str(height_path), (depth * 255).astype(np.uint8))

        reticle_box = inpaint_plate(color_path, spec)
        detail = "clean render, re-encoded only" if reticle_box is None else f"reticle box={reticle_box}"
        print(
            f"[{race}] depth NN err={nn_error:.2f} "
            f"-> {height_path.name}; plate saved; {detail}"
        )

        if race == "Gek":
            gek_height = depth

    if gek_height is not None:
        verify_gek_against_mockup(gek_height)

    print("done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
