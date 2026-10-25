"""Derives the login page assets from the frontend's logo: a dark-theme logo and the two icons.

Usage: python3 -I infra/scripts/make-login-assets.py apps/frontend/public/logo.png infra/terraform/modules/zitadel_config/files/login
Needs Pillow.
"""
import sys
from pathlib import Path

from PIL import Image

LIGHT_ON_DARK_FLOOR = 24  # darkest value a gray pixel gets in the dark variant, so black never sits on the dark page
ICON_SIZE = 192


def dark_variant(logo: Image.Image) -> Image.Image:
    """Inverts the gray pixels (book and letter) and keeps the saturated ones (the circuit)."""
    result = logo.convert("RGBA")
    pixels = result.load()
    for y in range(result.height):
        for x in range(result.width):
            r, g, b, a = pixels[x, y]
            if a == 0 or max(r, g, b) - min(r, g, b) > 40:
                continue
            value = max(LIGHT_ON_DARK_FLOOR, 255 - r)
            pixels[x, y] = (value, value, value, a)
    return result


def icon(logo: Image.Image) -> Image.Image:
    bounds = logo.getbbox()
    cropped = logo.crop(bounds) if bounds else logo
    side = max(cropped.size)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(cropped, ((side - cropped.width) // 2, (side - cropped.height) // 2))
    return square.resize((ICON_SIZE, ICON_SIZE), Image.LANCZOS)


source, destination = Path(sys.argv[1]), Path(sys.argv[2])
logo = Image.open(source).convert("RGBA")
destination.mkdir(parents=True, exist_ok=True)
dark = dark_variant(logo)
dark.save(destination / "logo-dark.png", optimize=True)
icon(logo).save(destination / "icon.png", optimize=True)
icon(dark).save(destination / "icon-dark.png", optimize=True)
