"""Build the tile pack the game plays on: a GRID x GRID board over the DEM window.

Per tile (40 m at the default 40x40):
  slope = 90th-percentile slope of the 4 m DEM cells inside the tile (the steep part you must cross)
  soft  = 1 - normalised THEMIS night-IR brightness (dark at night = loose dust)
  elev  = mean elevation
Art (SUB x SUB pixels per tile):
  board.png  = the real HiRISE image as pixel art: Mars colours, cooler in lowlands, warmer on highlands
  height.png = elevation bands in the blue-to-red convention of NASA's MOLA maps

Usage: python tools/build_tiles.py   (needs data/jezero_dem.json; pulls Mars Trek tiles live)
"""
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_layers import HIRISE, ROOT, THEMIS, mosaic  # noqa: E402

GRID = 40
SUB = 8          # art pixels per tile side (5 m each)
BANDS = [(52, 48, 150), (44, 104, 214), (36, 176, 204), (54, 200, 128), (176, 220, 70),
         (250, 208, 62), (250, 150, 56), (236, 84, 66), (214, 60, 120)]
# Dark -> light ramps for the real-image pixel art. Lowlands lean plum/rose, highlands lean rust/gold.
LOW = [(20, 12, 52), (62, 28, 100), (118, 42, 122), (176, 62, 120), (222, 104, 128), (246, 168, 166), (255, 224, 218)]
MID = [(40, 14, 20), (100, 30, 30), (164, 52, 36), (212, 88, 44), (238, 136, 72), (250, 192, 124), (255, 234, 190)]
HIGH = [(46, 22, 6), (110, 52, 8), (172, 92, 12), (220, 140, 22), (246, 190, 50), (255, 226, 110), (255, 246, 190)]


def ramp(colours, v):
    c = np.array(colours, dtype=np.float32)
    x = np.clip(v, 0, 1) * (len(c) - 1)
    i = np.minimum(x.astype(int), len(c) - 2)
    f = (x - i)[..., None]
    return c[i] * (1 - f) + c[i + 1] * f


def norm(a, lo=2, hi=98):
    p, q = np.percentile(a, [lo, hi])
    return np.clip((a - p) / (q - p), 0, 1)


def main():
    dem = json.load(open(os.path.join(ROOT, "data", "jezero_dem.json")))
    b, n, cell = dem["bounds_lonlat"], dem["rows"], dem["cell_m"]
    k = n // GRID
    tiles = lambda a, f: f(a.reshape(GRID, k, GRID, k).transpose(0, 2, 1, 3).reshape(GRID, GRID, -1), axis=2)
    z = np.array(dem["elevation_m"], dtype=np.float32)
    slope90 = tiles(np.array(dem["slope_deg"], dtype=np.float32), lambda a, axis: np.percentile(a, 90, axis=axis))
    elev = tiles(z, np.mean)

    _, th = mosaic(THEMIS, 9, b, GRID)
    th = np.asarray(th, dtype=np.float32)
    soft = 1 - (th - th.min()) / (th.max() - th.min())

    # --- art ---
    P = GRID * SUB
    gy, gx = np.gradient(z * 4.0, cell)                                    # x4 vertical exaggeration for the hillshade
    az, alt = np.radians(315), np.radians(45)
    sl, asp = np.arctan(np.hypot(gx, gy)), np.arctan2(-gx, gy)
    shade = np.sin(alt) * np.cos(sl) + np.cos(alt) * np.sin(sl) * np.cos(az - asp)
    small = lambda arr: np.asarray(Image.fromarray(arr.astype(np.float32), "F").resize((P, P), Image.BOX))
    zs, hs = small(z), small(shade)
    _, hi = mosaic(HIRISE, 15, b, P * 2)
    tex = np.asarray(hi.resize((P, P), Image.BOX), dtype=np.float32)
    out = os.path.join(ROOT, "game", "data")
    os.makedirs(out, exist_ok=True)

    light = 0.72 * norm(tex, 1, 99) + 0.28 * norm(hs)                      # the real image leads; relief supports it
    light = np.clip((light - 0.5) * 1.25 + 0.5, 0, 1)
    e = (np.argsort(np.argsort(zs, axis=None)).reshape(zs.shape) / (zs.size - 1))[..., None]   # elevation rank 0..1
    lo_w, hi_w = np.clip(1 - 2 * e, 0, 1), np.clip(2 * e - 1, 0, 1)
    rgb = ramp(LOW, light) * lo_w + ramp(MID, light) * (1 - lo_w - hi_w) + ramp(HIGH, light) * hi_w
    art = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB")
    art.quantize(40, method=Image.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB").save(os.path.join(out, "board.png"))

    tone = np.array([0.66, 0.84, 1.0, 1.16])[np.minimum(3, ((0.6 * norm(hs) + 0.4 * norm(tex)) * 4).astype(int))]
    band = np.digitize(zs, np.quantile(zs, np.linspace(0, 1, len(BANDS) + 1)[1:-1]))
    Image.fromarray(np.clip(np.array(BANDS, dtype=np.float32)[band] * tone[..., None], 0, 255).astype(np.uint8), "RGB").save(os.path.join(out, "height.png"))

    pack = {
        "site": "Jezero Crater — Perseverance landing area",
        "center": dem["center"], "bounds_lonlat": b, "rows": GRID, "cols": GRID, "cell_m": dem["size_m"] / GRID,
        "sources": {"elevation": dem["source"], "imagery": "Mars Trek / " + HIRISE, "thermal": "Mars Trek / " + THEMIS},
        "slope": np.round(slope90, 1).flatten().tolist(),
        "soft": np.round(soft, 3).flatten().tolist(),
        "elev": np.round(elev, 1).flatten().tolist(),
        "art_px_per_tile": SUB,
        "elev_range_m": [round(float(z.min()), 1), round(float(z.max()), 1)],
        "palette": ["#%02x%02x%02x" % c for c in BANDS],
    }
    # real heightmap for the 3D view: the DEM at 8 m, as 16-bit values between its lowest and highest point
    hn = 200; hz = z.reshape(hn, n // hn, hn, n // hn).mean(axis=(1, 3)); h_lo, h_hi = float(hz.min()), float(hz.max())
    open(os.path.join(out, "height.bin"), "wb").write(np.round((hz - h_lo) / (h_hi - h_lo) * 65535).astype("<u2").tobytes())
    pack["heightmap"] = {"file": "data/height.bin", "size": hn, "min_m": round(h_lo, 2), "max_m": round(h_hi, 2)}
    json.dump(pack, open(os.path.join(out, "board.json"), "w"), separators=(",", ":"))
    q = np.percentile(slope90, [50, 90, 100])
    print(f"tiles {GRID}x{GRID} @ {pack['cell_m']:.0f} m | slope p90/tile: median {q[0]:.1f} p90 {q[1]:.1f} max {q[2]:.1f} | "
          f">15deg: {(slope90 > 15).sum()}")


if __name__ == "__main__":
    main()
