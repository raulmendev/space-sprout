"""Shared steps for the tools that import the design team's art. Needs Pillow."""
import json
from pathlib import Path

from PIL import Image

ASSETS = Path(__file__).resolve().parent.parent / 'apps/web/public/assets/game'
MANIFEST = ASSETS / 'manifest.json'


def trim(im: Image.Image) -> Image.Image:
    """Clean the alpha (drop the faint halo exports carry, make near-opaque fully opaque) and trim the empty margin."""
    r, g, b, a = im.convert('RGBA').split()
    a = a.point(lambda v: 0 if v < 16 else (255 if v >= 250 else v))
    return Image.merge('RGBA', (r, g, b, a)).crop(a.getbbox())


def save_scaled(im: Image.Image, size: tuple[int, int], out: Path) -> None:
    """Scale to the in-game size with LANCZOS and save."""
    out.parent.mkdir(parents=True, exist_ok=True)
    im.resize(size, Image.LANCZOS).save(out, optimize=True)


def mark_delivered(*keys: str) -> None:
    """Add asset keys to manifest.json → delivered (sorted, no duplicates)."""
    manifest = json.loads(MANIFEST.read_text())
    manifest['delivered'] = sorted(set(manifest['delivered']) | set(keys))
    MANIFEST.write_text(json.dumps(manifest, indent=2) + '\n')
