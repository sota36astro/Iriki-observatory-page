#!/usr/bin/env python3
"""Prepare the fixed camera's north-up square image for the observatory page."""

import argparse
from datetime import datetime
from pathlib import Path
import math
import os
import tempfile

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
RESAMPLING = getattr(Image, "Resampling", Image)


def prepare(source, output, size=1200, rotation=0, font_path=None):
    # These cameras retain the sensor layout, but randomly change Orientation.
    # Do not apply exif_transpose: north is at the top in the raw pixel layout.
    with Image.open(source) as original:
        metadata = original.getexif().get_ifd(34665)
        captured = metadata.get(36867)
        try:
            captured = datetime.strptime(captured, "%Y:%m:%d %H:%M:%S").strftime(
                "%Y-%m-%d %H:%M:%S"
            )
        except (TypeError, ValueError):
            captured = "unknown"
        exposure = metadata.get(33434)
        exposure_text = "unknown"
        if exposure is not None and float(exposure) > 0:
            seconds = float(exposure)
            exposure_text = (
                f"1/{1 / seconds:g} s" if seconds < 1 else f"{seconds:g} s"
            )
        image = original.convert("RGB")

    # Both supplied 4496x3000 frames have a centered sky circle, diameter ~2025.
    # A 2400x2400 crop retains the horizon and margins above/below the circle.
    width, height = image.size
    side = round(min(width, height) * 0.8)
    left, top = (width - side) // 2, (height - side) // 2
    image = image.crop((left, top, left + side, top + side))
    if rotation:
        image = image.rotate(rotation, resample=RESAMPLING.BICUBIC,
                             expand=False, fillcolor="black")
    image = image.resize((size, size), RESAMPLING.LANCZOS)

    font = ImageFont.truetype(str(font_path or "DejaVuSans.ttf"), round(size * 0.025))
    draw = ImageDraw.Draw(image)
    padding = round(size * 0.016)
    # Sky view: east is on the left and west on the right when north is up.
    # Keep labels outside the sky circle (~0.423 * size radius).
    for bearing, label in enumerate(("N", "NE", "E", "SE", "S", "SW", "W", "NW")):
        angle = math.radians(bearing * 45)
        x = size / 2 - size * 0.47 * math.sin(angle)
        y = size / 2 - size * 0.47 * math.cos(angle)
        draw.text((round(x), round(y)), label, font=font, fill="white", anchor="mm")
    draw.text((padding, size - padding - round(size * 0.034)),
              f"Captured: {captured}", font=font, fill="white", anchor="lb")
    draw.text((padding, size - padding), f"Exposure: {exposure_text}",
              font=font, fill="white", anchor="lb")

    # Save without the source EXIF, and replace only after a complete encode.
    # A failed input/encode keeps the previous published image intact.
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=output.parent, suffix=".jpg", delete=False) as f:
            temporary = Path(f.name)
        image.save(temporary, format="JPEG", quality=92)
        temporary.chmod(0o644)
        os.replace(temporary, output)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Original camera JPEG")
    parser.add_argument("output", nargs="?", type=Path,
                        default=ROOT / "images" / "sky-camera.jpg")
    parser.add_argument("--size", type=int, default=1200, help="Square output size (default: 1200)")
    parser.add_argument("--rotation", type=float, default=0,
                        help="Counterclockwise correction in degrees if the camera mount changes")
    parser.add_argument("--font", type=Path, help="Path to a TrueType font")
    args = parser.parse_args()
    if args.size < 400:
        parser.error("--size must be at least 400")
    if args.source.resolve() == args.output.resolve():
        parser.error("source and output must differ to preserve the original")
    prepare(args.source, args.output, args.size, args.rotation, args.font)
    print(f"Saved {args.output}")


if __name__ == "__main__":
    main()
